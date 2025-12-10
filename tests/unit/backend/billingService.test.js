import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn()
};

vi.mock('../../../server/database', () => {
    return {
        default: mockDb,
        get: mockDb.get,
        all: mockDb.all,
        run: mockDb.run
    };
});

// Mock Stripe
const mockStripe = {
    customers: {
        retrieve: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
    },
    paymentMethods: {
        attach: vi.fn()
    },
    subscriptions: {
        create: vi.fn(),
        update: vi.fn(),
        retrieve: vi.fn()
    }
};

vi.mock('stripe', () => {
    return {
        default: vi.fn(() => mockStripe)
    };
});

import BillingService from '../../../server/services/billingService';

describe('BillingService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getPlans', () => {
        it('should return all active plans', async () => {
            const mockPlans = [{ id: 'plan-1', name: 'Pro', is_active: 1 }];
            mockDb.all.mockImplementation((sql, params, callback) => callback(null, mockPlans));

            const plans = await BillingService.getPlans();
            expect(plans).toEqual(mockPlans);
            expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM subscription_plans'), [], expect.any(Function));
        });
    });

    // Basic CRUD tests for plans
    describe('createPlan', () => {
        it('should create a new plan', async () => {
            const planData = { name: 'Enterprise', price_monthly: 100 };
            mockDb.run.mockImplementation((sql, params, callback) => callback(null));

            const plan = await BillingService.createPlan(planData);
            expect(plan).toMatchObject(planData);
            expect(mockDb.run).toHaveBeenCalled();
        });
    });

    describe('getOrganizationBilling', () => {
        it('should return billing info with plan details', async () => {
            const mockBilling = { organization_id: 'org-1', plan_name: 'Pro' };
            mockDb.get.mockImplementation((sql, params, callback) => callback(null, mockBilling));

            const billing = await BillingService.getOrganizationBilling('org-1');
            expect(billing).toEqual(mockBilling);
        });
    });

    describe('createSubscription', () => {
        it('should create a subscription if stripe is configured', async () => {
            // This test assumes STRIPE_SECRET_KEY is set or mocked behavior inside service
            // Since we mocked 'stripe' module, let's see if we can trigger the flow
            process.env.STRIPE_SECRET_KEY = 'sk_test_123';

            // Mock getPlanById
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('subscription_plans')) {
                    callback(null, { id: 'plan-1', stripe_price_id: 'price_123' });
                } else if (sql.includes('organization_billing')) {
                    callback(null, {}); // No existing billing
                }
            });

            mockStripe.customers.create.mockResolvedValue({ id: 'cus_123' });
            mockStripe.subscriptions.create.mockResolvedValue({
                id: 'sub_123',
                status: 'active',
                current_period_start: 1000000,
                current_period_end: 2000000
            });

            // Mock upsert
            mockDb.run.mockImplementation((sql, params, callback) => callback(null));

            const sub = await BillingService.createSubscription('org-1', 'plan-1', 'pm_123', 'test@test.com', 'Test Org');

            expect(sub.id).toBe('sub_123');
            expect(mockStripe.customers.create).toHaveBeenCalled();
            expect(mockStripe.subscriptions.create).toHaveBeenCalled();
        });
    });
});
