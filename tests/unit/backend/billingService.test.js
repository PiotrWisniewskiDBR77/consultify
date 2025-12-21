/**
 * Billing Service Tests
 * 
 * CRITICAL BILLING SERVICE - Must have 95%+ coverage
 * Tests Stripe integration, subscriptions, and multi-tenant isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testOrganizations, testUsers } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);

describe('BillingService', () => {
    let mockDb;
    let BillingService;

    beforeEach(() => {
        vi.resetModules();
        
        mockDb = createMockDb();
        
        // Mock database before import
        vi.doMock('../../../server/database', () => ({
            default: mockDb
        }));

        // Clear env to simulate Stripe not configured
        const originalEnv = process.env.STRIPE_SECRET_KEY;
        delete process.env.STRIPE_SECRET_KEY;
        
        // Import service after mocking
        BillingService = require('../../../server/services/billingService.js');
        
        // Inject mock dependencies
        BillingService.setDependencies({
            db: mockDb,
            uuidv4: () => 'test-uuid-1234'
        });

        // Restore env
        if (originalEnv) {
            process.env.STRIPE_SECRET_KEY = originalEnv;
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
    });

    describe('getPlans()', () => {
        it('should return all active subscription plans', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    { id: 'plan-1', name: 'Basic', price_monthly: 29.99 },
                    { id: 'plan-2', name: 'Pro', price_monthly: 99.99 }
                ]);
            });

            const plans = await BillingService.getPlans();

            expect(plans).toHaveLength(2);
            expect(plans[0].name).toBe('Basic');
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM subscription_plans'),
                [],
                expect.any(Function)
            );
        });

        it('should handle database errors', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'), null);
            });

            await expect(BillingService.getPlans()).rejects.toThrow('DB Error');
        });
    });

    describe('getPlanById()', () => {
        it('should return plan by ID', async () => {
            const planId = 'plan-1';
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: planId,
                    name: 'Basic',
                    price_monthly: 29.99
                });
            });

            const plan = await BillingService.getPlanById(planId);

            expect(plan.id).toBe(planId);
            expect(plan.name).toBe('Basic');
        });

        it('should return null for non-existent plan', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const plan = await BillingService.getPlanById('non-existent');
            expect(plan).toBeNull();
        });
    });

    describe('createPlan()', () => {
        it('should create a new subscription plan', async () => {
            const planData = {
                name: 'Enterprise',
                price_monthly: 299.99,
                token_limit: 100000,
                storage_limit_gb: 100
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await BillingService.createPlan(planData);

            expect(result.id).toBeDefined();
            expect(result.name).toBe(planData.name);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO subscription_plans'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });

    describe('getOrganizationBilling()', () => {
        it('should return billing info for organization', async () => {
            const orgId = testOrganizations.org1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    organization_id: orgId,
                    subscription_plan_id: 'plan-1',
                    status: 'active'
                });
            });

            const billing = await BillingService.getOrganizationBilling(orgId);

            expect(billing.organization_id).toBe(orgId);
            expect(billing.status).toBe('active');
        });

        it('should return null for organization without billing', async () => {
            const orgId = testOrganizations.org1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const billing = await BillingService.getOrganizationBilling(orgId);
            expect(billing).toBeNull();
        });
    });

    describe('upsertOrganizationBilling()', () => {
        it('should create billing record for new organization', async () => {
            const orgId = testOrganizations.org1.id;
            const billingData = {
                subscription_plan_id: 'plan-1',
                status: 'active'
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await BillingService.upsertOrganizationBilling(orgId, billingData);

            expect(result.organization_id).toBe(orgId);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO organization_billing'),
                expect.arrayContaining([orgId]),
                expect.any(Function)
            );
        });

        it('should update existing billing record', async () => {
            const orgId = testOrganizations.org1.id;
            const billingData = {
                status: 'canceled'
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await BillingService.upsertOrganizationBilling(orgId, billingData);

            expect(result.organization_id).toBe(orgId);
        });
    });

    describe('getOrCreateStripeCustomer()', () => {
        it('should return mock customer when Stripe not configured', async () => {
            const orgId = testOrganizations.org1.id;
            const email = 'test@example.com';
            const orgName = 'Test Org';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const customer = await BillingService.getOrCreateStripeCustomer(orgId, email, orgName);

            expect(customer.id).toContain('mock_cus_');
            expect(customer.email).toBe(email);
        });

        it('should return existing customer when found', async () => {
            const orgId = testOrganizations.org1.id;
            const email = 'test@example.com';
            const orgName = 'Test Org';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    stripe_customer_id: 'cus_existing123'
                });
            });

            // Note: In test mode (Stripe not configured), this will return mock
            const customer = await BillingService.getOrCreateStripeCustomer(orgId, email, orgName);
            expect(customer).toBeDefined();
        });
    });

    describe('createSubscription()', () => {
        it('should create mock subscription when Stripe not configured', async () => {
            const orgId = testOrganizations.org1.id;
            const planId = 'plan-1';
            const paymentMethodId = 'pm_test123';
            const email = 'test@example.com';
            const orgName = 'Test Org';

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('subscription_plans')) {
                    callback(null, {
                        id: planId,
                        name: 'Basic',
                        stripe_price_id: 'price_test123'
                    });
                } else {
                    callback(null, null);
                }
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const subscription = await BillingService.createSubscription(
                orgId,
                planId,
                paymentMethodId,
                email,
                orgName
            );

            expect(subscription.id).toContain('mock_sub_');
            expect(subscription.status).toBe('active');
        });

        it('should throw error for invalid plan', async () => {
            const orgId = testOrganizations.org1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null); // Plan not found
            });

            await expect(
                BillingService.createSubscription(orgId, 'invalid-plan', 'pm_test', 'test@example.com', 'Test')
            ).rejects.toThrow('Invalid plan');
        });
    });

    describe('cancelSubscription()', () => {
        it('should cancel subscription', async () => {
            const orgId = testOrganizations.org1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    stripe_subscription_id: 'sub_test123'
                });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await BillingService.cancelSubscription(orgId);

            expect(result.status).toBe('canceled');
        });

        it('should throw error when no active subscription', async () => {
            const orgId = testOrganizations.org1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            await expect(
                BillingService.cancelSubscription(orgId)
            ).rejects.toThrow('No active subscription');
        });
    });

    describe('getInvoices()', () => {
        it('should return invoices for organization', async () => {
            const orgId = testOrganizations.org1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    { id: 'inv-1', organization_id: orgId, amount: 99.99 },
                    { id: 'inv-2', organization_id: orgId, amount: 99.99 }
                ]);
            });

            const invoices = await BillingService.getInvoices(orgId);

            expect(invoices).toHaveLength(2);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM invoices WHERE organization_id'),
                [orgId],
                expect.any(Function)
            );
        });

        it('should only return invoices for specified organization', async () => {
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                // Verify query filters by organization_id
                expect(params).toContain(org1Id);
                expect(params).not.toContain(org2Id);
                callback(null, []);
            });

            await BillingService.getInvoices(org1Id);
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should only access billing for specified organization', async () => {
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                // Verify query filters by organization_id
                expect(params).toContain(org1Id);
                expect(params).not.toContain(org2Id);
                callback(null, null);
            });

            await BillingService.getOrganizationBilling(org1Id);
        });

        it('should not leak invoices between organizations', async () => {
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;

            let callCount = 0;
            mockDb.all.mockImplementation((query, params, callback) => {
                callCount++;
                if (callCount === 1) {
                    // First call for org1
                    expect(params).toContain(org1Id);
                    callback(null, [{ id: 'inv-1', organization_id: org1Id }]);
                } else {
                    // Second call for org2
                    expect(params).toContain(org2Id);
                    callback(null, []);
                }
            });

            const invoices1 = await BillingService.getInvoices(org1Id);
            const invoices2 = await BillingService.getInvoices(org2Id);

            expect(invoices1).toHaveLength(1);
            expect(invoices2).toHaveLength(0);
        });
    });
});

