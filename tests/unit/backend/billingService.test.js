import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
};

vi.mock('../../../server/database', () => ({
    default: mockDb
}));

vi.mock('uuid', () => ({
    v4: () => 'uuid-1234'
}));

// Mock Stripe if needed, or rely on it being null in test env
// Since the file wraps require('stripe') in try-catch, checking env var,
// in test env without STRIPE_SECRET_KEY it will process.env.STRIPE_SECRET_KEY be undefined?
// Let's assume standard behavior. If we want to test Stripe calls, we should mock the module.

vi.mock('stripe', () => {
    return {
        default: vi.fn(() => ({
            customers: {
                create: vi.fn().mockResolvedValue({ id: 'cus_123' }),
                list: vi.fn().mockResolvedValue({ data: [] })
            },
            subscriptions: {
                create: vi.fn().mockResolvedValue({ id: 'sub_123', status: 'active' }),
                del: vi.fn().mockResolvedValue({ status: 'canceled' })
            }
        }))
    };
});

// We need to set env var for tests to load stripe mock
process.env.STRIPE_SECRET_KEY = 'test_key';

import BillingService from '../../../server/services/billingService.js';

describe('BillingService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockDb.get.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, null);
        });

        mockDb.run.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb.call({ changes: 1 }, null);
        });
    });

    describe('getPlans', () => {
        it('should return plans', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [{ id: 'p1', name: 'Pro' }]);
                }
            });

            const plans = await BillingService.getPlans();
            expect(plans).toHaveLength(1);
        });
    });

    describe('createPlan', () => {
        it('should create plan', async () => {
            const result = await BillingService.createPlan({ name: 'Enterprise', price: 99 });
            expect(result.id).toBe('uuid-1234');
        });
    });

    describe('getOrganizationBilling', () => {
        it('should return default if no record', async () => {
            const billing = await BillingService.getOrganizationBilling('org-1');
            expect(billing.orgId).toBe('org-1');
            expect(billing.planId).toBe('FREE'); // Checking implementation default
        });

        it('should return stored record', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, { org_id: 'org-1', plan_id: 'PRO' });
                }
            });

            const billing = await BillingService.getOrganizationBilling('org-1');
            expect(billing.plan_id).toBe('PRO');
        });
    });

    describe('createSubscription', () => {
        it('should create stripe subscription and update DB', async () => {
            // Mock Billing Record exists
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, { stripe_customer_id: 'cus_123' });
                }
            });

            // Mock Plan
            mockDb.all.mockImplementation((...args) => {
                // If getPlanById uses .all or .get, let's catch both
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [{ id: 'plan-1', stripe_price_id: 'price_1' }]); // db.all returns array
                }
            });
            // Overwrite get for plan check if it uses get
            const originalGet = mockDb.get;
            mockDb.get = vi.fn((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (query.includes('FROM subscription_plans')) {
                    cb(null, { id: 'plan-1', stripe_price_id: 'price_1', limits: '{}' });
                } else {
                    originalGet(...args);
                }
            });

            const result = await BillingService.createSubscription('org-1', 'plan-1', 'pm_123');

            expect(result.subscriptionId).toBe('sub_123');
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE organization_billing'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });
});
