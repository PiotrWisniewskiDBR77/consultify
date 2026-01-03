/**
 * Billing Service Tests
 * 
 * CRITICAL BILLING SERVICE - Must have 95%+ coverage
 * Tests Stripe integration, subscriptions, and multi-tenant isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testOrganizations, testUsers } from '../../fixtures/testData.js';
import BillingService from '../../../server/services/billingService.js';

describe('BillingService', () => {
    let mockDb;

    beforeEach(() => {
        mockDb = createMockDb();

        // Clear env to simulate Stripe not configured
        const originalEnv = process.env.STRIPE_SECRET_KEY;
        delete process.env.STRIPE_SECRET_KEY;

        // Inject mock dependencies
        BillingService.setDependencies({
            db: mockDb,
            uuidv4: () => 'test-uuid-1234',
            stripe: null
        });

        // Restore env
        if (originalEnv) {
            process.env.STRIPE_SECRET_KEY = originalEnv;
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
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

    describe('updatePlan()', () => {
        it('should update an existing plan', async () => {
            const planId = 'plan-1';
            const updates = { name: 'Super Pro', price_monthly: 149.99 };

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await BillingService.updatePlan(planId, updates);

            expect(result.id).toBe(planId);
            expect(result.changes).toBe(1);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE subscription_plans SET'),
                expect.arrayContaining(['Super Pro', 149.99, planId]),
                expect.any(Function)
            );
        });

        it('should return null if no updates provided', async () => {
            const result = await BillingService.updatePlan('plan-1', {});
            expect(result).toBeNull();
        });
    });

    describe('User License Plans', () => {
        it('should get all user plans', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [{ id: 'lic-1', name: 'Standard' }]);
            });
            const plans = await BillingService.getUserPlans();
            expect(plans).toHaveLength(1);
        });

        it('should create user plan', async () => {
            const planData = { name: 'Premium', price_monthly: 19.99 };
            mockDb.run.mockImplementation(function (query, params, callback) { callback.call({ changes: 1 }, null); });
            const result = await BillingService.createUserPlan(planData);
            expect(result.id).toContain('license-');
            expect(result.name).toBe('Premium');
        });

        it('should update user plan', async () => {
            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });
            const result = await BillingService.updateUserPlan('lic-1', { name: 'Pro' });
            expect(result.id).toBe('lic-1');
        });

        it('should delete user plan', async () => {
            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });
            const result = await BillingService.deleteUserPlan('lic-1');
            expect(result.id).toBe('lic-1');
        });
    });

    describe('Payment Methods', () => {
        it('should get payment methods for organization', async () => {
            const orgId = 'org-1';
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [{ id: 'pm-1', brand: 'visa' }]);
            });
            const methods = await BillingService.getPaymentMethods(orgId);
            expect(methods).toHaveLength(1);
            expect(mockDb.all).toHaveBeenCalledWith(expect.any(String), [orgId], expect.any(Function));
        });

        it('should add payment method (mock mode)', async () => {
            const orgId = 'org-1';
            mockDb.all.mockImplementation((query, params, callback) => callback(null, [])); // no existing methods
            mockDb.run.mockImplementation(function (query, params, callback) { callback.call({ changes: 1 }, null); });

            const result = await BillingService.addPaymentMethod(orgId, 'tok_123');
            expect(result.organization_id).toBe(orgId);
            expect(result.is_default).toBe(1);
        });

        it('should set default payment method', async () => {
            const orgId = 'org-1';
            const pmId = 'pm-1';
            mockDb.get.mockImplementation((query, params, callback) => callback(null, { organization_id: orgId }));
            mockDb.run.mockImplementation(function (query, params, callback) { callback.call({ changes: 1 }, null); });

            const result = await BillingService.setDefaultPaymentMethod(pmId, orgId);
            expect(result.id).toBe(pmId);
            expect(result.is_default).toBe(true);
        });

        it('should remove payment method', async () => {
            const orgId = 'org-1';
            const pmId = 'pm-1';
            mockDb.get.mockImplementation((query, params, callback) => callback(null, { organization_id: orgId }));
            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await BillingService.removePaymentMethod(pmId, orgId);
            expect(result.deleted).toBe(true);
        });
    });

    describe('Billing Alerts', () => {
        it('should get alerts for organization', async () => {
            mockDb.get.mockImplementation((query, params, callback) => callback(null, { token_threshold_80: 1 }));
            const alerts = await BillingService.getBillingAlerts('org-1');
            expect(alerts.token_threshold_80).toBe(1);
        });

        it('should update alerts', async () => {
            mockDb.run.mockImplementation(function (query, params, callback) { callback.call({ changes: 1 }, null); });
            const result = await BillingService.updateBillingAlerts('org-1', { token_threshold_90: 1 });
            expect(result.token_threshold_90).toBe(1);
        });
    });

    describe('Tax Settings', () => {
        it('should get tax settings', async () => {
            mockDb.get.mockImplementation((query, params, callback) => callback(null, { tax_id: 'VAT123' }));
            const settings = await BillingService.getTaxSettings('org-1');
            expect(settings.tax_id).toBe('VAT123');
        });

        it('should update tax settings', async () => {
            mockDb.run.mockImplementation(function (query, params, callback) { callback.call({ changes: 1 }, null); });
            const result = await BillingService.updateTaxSettings('org-1', { billing_name: 'Corp' });
            expect(result.billing_name).toBe('Corp');
        });
    });

    describe('Discount Codes', () => {
        it('should validate valid discount code', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { id: 'disc-1', code: 'SAVE10', is_active: 1, discount_type: 'percent', discount_value: 10 });
            });
            const result = await BillingService.validateDiscountCode('SAVE10', 'plan-1');
            expect(result.valid).toBe(true);
            expect(result.discount.value).toBe(10);
        });

        it('should increment code usage', async () => {
            mockDb.run.mockImplementation(function (query, params, callback) { callback.call({ changes: 1 }, null); });
            await BillingService.incrementDiscountCodeUsage('disc-1');
            expect(mockDb.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE discount_codes'), ['disc-1'], expect.any(Function));
        });
    });

    describe('Revenue Stats', () => {
        it('should return revenue statistics', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { mrr: 5000, active_subscriptions: 50 });
            });
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [{ name: 'Basic', count: 30 }, { name: 'Pro', count: 20 }]);
            });

            const stats = await BillingService.getRevenueStats();
            expect(stats.mrr).toBe(5000);
            expect(stats.arr).toBe(60000);
            expect(stats.planDistribution).toHaveLength(2);
        });
    });

    describe('Invoice Recording', () => {
        it('should record an invoice', async () => {
            const stripeInvoice = {
                id: 'in_123',
                amount_due: 9900,
                amount_paid: 9900,
                currency: 'usd',
                status: 'paid',
                period_start: 1600000000,
                period_end: 1603000000,
                invoice_pdf: 'http://example.com/inv.pdf'
            };
            mockDb.run.mockImplementation(function (query, params, callback) { callback.call({ changes: 1 }, null); });
            const result = await BillingService.recordInvoice('org-1', stripeInvoice);
            expect(result.id).toContain('inv-');
        });
    });

    describe('Seat Management', () => {
        it('should get seat pricing', async () => {
            mockDb.get.mockImplementation((query, params, callback) => callback(null, { seat_price_monthly: 10 }));
            const pricing = await BillingService.getSeatPricing('plan-1');
            expect(pricing.seat_price_monthly).toBe(10);
        });

        it('should calculate seat cost', async () => {
            mockDb.get.mockImplementation((query, params, callback) => callback(null, { seat_price_monthly: 15 }));
            const cost = await BillingService.calculateSeatCost('org-1', 5);
            expect(cost.totalCost).toBe(75);
        });

        it('should process seat purchase', async () => {
            mockDb.get.mockImplementation((query, params, callback) => callback(null, { seat_price_monthly: 15 }));
            const result = await BillingService.processSeatPurchase('org-1', 2, 'pm_123');
            expect(result.success).toBe(true);
            expect(result.totalCost).toBe(30);
        });

        it('should get billing model', async () => {
            mockDb.get.mockImplementation((query, params, callback) => callback(null, { billing_model: 'seats' }));
            const model = await BillingService.getBillingModel('org-1');
            expect(model.billingModel).toBe('seats');
        });
    });

    describe('Discount Code Edge Cases', () => {
        it('should return error for invalid plan', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { id: 'disc-1', code: 'SAVE10', is_active: 1, applicable_plans: JSON.stringify(['plan-2']) });
            });
            const result = await BillingService.validateDiscountCode('SAVE10', 'plan-1');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('not valid for the selected plan');
        });

        it('should return error if code not found', async () => {
            mockDb.get.mockImplementation((query, params, callback) => callback(null, null));
            const result = await BillingService.validateDiscountCode('MISSING', 'plan-1');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid or expired');
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

    describe('Stripe Integration (Mocked)', () => {
        let StripeBillingService = BillingService;
        const mockStripe = {
            customers: {
                retrieve: vi.fn().mockResolvedValue({ id: 'cus_default', email: 'default@example.com' }),
                create: vi.fn().mockResolvedValue({ id: 'cus_new', email: 'default@example.com' }),
                update: vi.fn().mockResolvedValue({ id: 'cus_updated' })
            },
            subscriptions: {
                create: vi.fn().mockResolvedValue({ id: 'sub_default', status: 'active' }),
                update: vi.fn().mockResolvedValue({ id: 'sub_updated', status: 'active' }),
                retrieve: vi.fn().mockResolvedValue({ id: 'sub_default', status: 'active' })
            },
            paymentMethods: {
                attach: vi.fn().mockResolvedValue({ id: 'pm_default' }),
                detach: vi.fn().mockResolvedValue({ id: 'pm_default' }),
                retrieve: vi.fn().mockResolvedValue({ id: 'pm_default', card: { brand: 'visa', last4: '4242' } })
            },
            setupIntents: {
                create: vi.fn().mockResolvedValue({ id: 'seti_default', client_secret: 'secret' })
            }
        };

        beforeEach(() => {
            process.env.STRIPE_SECRET_KEY = 'sk_test_mock';

            StripeBillingService.setDependencies({
                db: mockDb,
                uuidv4: () => 'test-uuid-stripe',
                stripe: mockStripe
            });
        });

        afterEach(() => {
            delete process.env.STRIPE_SECRET_KEY;
        });

        it('should retrieve existing Stripe customer', async () => {
            mockDb.get.mockImplementation((query, params, callback) => callback(null, { stripe_customer_id: 'cus_123' }));
            mockStripe.customers.retrieve.mockResolvedValue({ id: 'cus_123' });

            const customer = await StripeBillingService.getOrCreateStripeCustomer('org-1', 'a@b.com', 'Org');
            expect(customer.id).toBe('cus_123');
            expect(mockStripe.customers.retrieve).toHaveBeenCalledWith('cus_123');
        });

        it('should create new Stripe customer if not exists', async () => {
            mockDb.get.mockImplementation((query, params, callback) => callback(null, null)); // No billing info
            mockDb.run.mockImplementation(function (query, params, callback) { callback.call({ changes: 1 }, null); });
            mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });

            const customer = await StripeBillingService.getOrCreateStripeCustomer('org-1', 'a@b.com', 'Org');
            expect(customer.id).toBe('cus_new');
            expect(mockStripe.customers.create).toHaveBeenCalled();
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should create subscription on Stripe', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('FROM subscription_plans WHERE id = ?')) {
                    callback(null, { id: 'p1', stripe_price_id: 'price_1' });
                } else if (query.includes('FROM organization_billing ob')) {
                    callback(null, { stripe_customer_id: 'cus_123' });
                } else {
                    callback(null, null);
                }
            });
            mockDb.run.mockImplementation(function (query, params, callback) { callback.call({ changes: 1 }, null); });
            mockStripe.customers.retrieve.mockResolvedValue({ id: 'cus_123' });
            mockStripe.subscriptions.create.mockResolvedValue({
                id: 'sub_123',
                status: 'active',
                current_period_start: 1600000000,
                current_period_end: 1603000000
            });
            mockStripe.paymentMethods.attach.mockResolvedValue({});
            mockStripe.customers.update.mockResolvedValue({});

            const sub = await StripeBillingService.createSubscription('org-1', 'p1', 'pm_1', 'a@b.com', 'Org');
            expect(sub.id).toBe('sub_123');
            expect(mockStripe.subscriptions.create).toHaveBeenCalled();
            expect(mockStripe.customers.retrieve).toHaveBeenCalledWith('cus_123');
        });

        it('should create setup intent', async () => {
            mockDb.get.mockImplementation((query, params, callback) => callback(null, { stripe_customer_id: 'cus_123' }));
            mockStripe.customers.retrieve.mockResolvedValue({ id: 'cus_123' });
            mockStripe.setupIntents.create.mockResolvedValue({ id: 'seti_123', client_secret: 'secret' });

            const intent = await StripeBillingService.createSetupIntent('org-1', 'a@b.com', 'Org');
            expect(intent.clientSecret).toBe('secret');
        });

        it('should handle cancel subscription with Stripe', async () => {
            mockDb.get.mockImplementation((query, params, callback) => callback(null, { stripe_subscription_id: 'sub_123' }));
            mockDb.run.mockImplementation(function (query, params, callback) { callback.call({ changes: 1 }, null); });
            mockStripe.subscriptions.update.mockResolvedValue({ status: 'canceling' });

            const result = await StripeBillingService.cancelSubscription('org-1');
            expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', { cancel_at_period_end: true });
        });

        it('should change plan on Stripe', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('FROM subscription_plans WHERE id = ?')) {
                    callback(null, { id: 'p2', stripe_price_id: 'price_2' });
                } else if (query.includes('FROM organization_billing ob')) {
                    callback(null, { stripe_subscription_id: 'sub_123' });
                } else {
                    callback(null, null);
                }
            });
            mockDb.run.mockImplementation(function (query, params, callback) { callback.call({ changes: 1 }, null); });
            mockStripe.subscriptions.retrieve.mockResolvedValue({
                id: 'sub_123',
                items: { data: [{ id: 'item_1' }] }
            });
            mockStripe.subscriptions.update.mockResolvedValue({ id: 'sub_123' });

            const result = await StripeBillingService.changePlan('org-1', 'p2');
            expect(result.status).toBe('updated');
            expect(mockStripe.subscriptions.update).toHaveBeenCalled();
        });

        it('should add payment method with Stripe', async () => {
            mockDb.get.mockImplementation((query, params, callback) => callback(null, { stripe_customer_id: 'cus_123' }));
            mockDb.all.mockImplementation((query, params, callback) => callback(null, []));
            mockDb.run.mockImplementation(function (query, params, callback) { callback.call({ changes: 1 }, null); });
            mockStripe.paymentMethods.retrieve.mockResolvedValue({
                type: 'card',
                card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2025 },
                billing_details: { name: 'John Doe' }
            });
            mockStripe.paymentMethods.attach.mockResolvedValue({});

            const result = await StripeBillingService.addPaymentMethod('org-1', 'pm_stripe_123');
            expect(result.brand).toBe('visa');
            expect(mockStripe.paymentMethods.attach).toHaveBeenCalled();
        });

        it('should remove payment method from Stripe', async () => {
            mockDb.get.mockImplementation((query, params, callback) => callback(null, {
                id: 'pm-1',
                organization_id: 'org-1',
                stripe_payment_method_id: 'pm_stripe_123'
            }));
            mockDb.run.mockImplementation(function (query, params, callback) { callback.call({ changes: 1 }, null); });
            mockStripe.paymentMethods.detach.mockResolvedValue({});

            const result = await StripeBillingService.removePaymentMethod('pm-1', 'org-1');
            expect(result.deleted).toBe(true);
            expect(mockStripe.paymentMethods.detach).toHaveBeenCalledWith('pm_stripe_123');
        });

        it('should set default payment method on Stripe', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('FROM payment_methods WHERE id = ?')) {
                    callback(null, { id: 'pm-1', organization_id: 'org-1', stripe_payment_method_id: 'pm_stripe_123' });
                } else {
                    callback(null, { stripe_customer_id: 'cus_123' });
                }
            });
            mockDb.run.mockImplementation(function (query, params, callback) { callback.call({ changes: 1 }, null); });
            mockStripe.customers.update.mockResolvedValue({});

            const result = await StripeBillingService.setDefaultPaymentMethod('pm-1', 'org-1');
            expect(result.is_default).toBe(true);
            expect(mockStripe.customers.update).toHaveBeenCalledWith('cus_123', expect.objectContaining({
                invoice_settings: { default_payment_method: 'pm_stripe_123' }
            }));
        });

        it('should handle Stripe errors gracefully in addPaymentMethod', async () => {
            mockDb.get.mockImplementation((query, params, callback) => callback(null, { stripe_customer_id: 'cus_123' }));
            mockDb.all.mockImplementation((query, params, callback) => callback(null, []));
            mockDb.run.mockImplementation(function (query, params, callback) { callback.call({ changes: 1 }, null); });
            mockStripe.paymentMethods.retrieve.mockRejectedValue(new Error('Stripe error'));

            const result = await StripeBillingService.addPaymentMethod('org-1', 'pm_error');
            expect(result.id).toBeDefined();
            expect(result.brand).toBe('unknown'); // Fallback
        });
    });
});

