/**
 * Unit Tests for Stripe Service
 * Tests checkout sessions, payment intents, proration, and usage tracking
 */

import { jest } from '@jest/globals';

// Mock dependencies before importing the service
const mockDb = {
    run: jest.fn((sql, params, callback) => callback?.(null)),
    get: jest.fn((sql, params, callback) => callback?.(null, null)),
    all: jest.fn((sql, params, callback) => callback?.(null, []))
};

const mockStripe = {
    checkout: {
        sessions: {
            create: jest.fn(),
            retrieve: jest.fn()
        }
    },
    billingPortal: {
        sessions: {
            create: jest.fn()
        }
    },
    paymentIntents: {
        create: jest.fn(),
        confirm: jest.fn(),
        retrieve: jest.fn()
    },
    subscriptions: {
        retrieve: jest.fn()
    },
    subscriptionItems: {
        createUsageRecord: jest.fn()
    }
};

const mockBillingService = {
    getPlanById: jest.fn(),
    getOrCreateStripeCustomer: jest.fn(),
    getOrganizationBilling: jest.fn(),
    validateDiscountCode: jest.fn()
};

// Import and set up the service
import stripeService from '../../../../server/services/stripeService.js';

describe('StripeService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        stripeService.setDependencies({
            db: mockDb,
            stripe: mockStripe,
            billingService: mockBillingService
        });
    });

    describe('createCheckoutSession', () => {
        it('should create a checkout session with valid plan', async () => {
            const mockPlan = {
                id: 'plan-1',
                name: 'Pro',
                stripe_price_id: 'price_123',
                stripe_price_id_yearly: 'price_yearly_123'
            };
            const mockCustomer = { id: 'cus_123' };
            const mockSession = { 
                id: 'cs_123', 
                url: 'https://checkout.stripe.com/cs_123',
                expires_at: Math.floor(Date.now() / 1000) + 3600
            };

            mockBillingService.getPlanById.mockResolvedValue(mockPlan);
            mockBillingService.getOrCreateStripeCustomer.mockResolvedValue(mockCustomer);
            mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

            const result = await stripeService.createCheckoutSession({
                orgId: 'org-1',
                userId: 'user-1',
                planId: 'plan-1',
                successUrl: 'https://app.example.com/success',
                cancelUrl: 'https://app.example.com/cancel',
                customerEmail: 'test@example.com'
            });

            expect(result).toHaveProperty('sessionId', 'cs_123');
            expect(result).toHaveProperty('url', 'https://checkout.stripe.com/cs_123');
        });

        it('should throw error for invalid plan', async () => {
            mockBillingService.getPlanById.mockResolvedValue(null);

            await expect(stripeService.createCheckoutSession({
                orgId: 'org-1',
                userId: 'user-1',
                planId: 'invalid-plan',
                successUrl: 'https://app.example.com/success',
                cancelUrl: 'https://app.example.com/cancel'
            })).rejects.toThrow('Invalid plan');
        });

        it('should apply discount code when provided', async () => {
            const mockPlan = {
                id: 'plan-1',
                name: 'Pro',
                stripe_price_id: 'price_123'
            };
            const mockCustomer = { id: 'cus_123' };
            const mockSession = { id: 'cs_123', url: 'https://checkout.stripe.com/cs_123', expires_at: Date.now() / 1000 + 3600 };
            const mockDiscount = { valid: true, discount: { stripe_coupon_id: 'coupon_123' } };

            mockBillingService.getPlanById.mockResolvedValue(mockPlan);
            mockBillingService.getOrCreateStripeCustomer.mockResolvedValue(mockCustomer);
            mockBillingService.validateDiscountCode.mockResolvedValue(mockDiscount);
            mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

            await stripeService.createCheckoutSession({
                orgId: 'org-1',
                userId: 'user-1',
                planId: 'plan-1',
                successUrl: 'https://app.example.com/success',
                cancelUrl: 'https://app.example.com/cancel',
                discountCode: 'SAVE20'
            });

            expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    discounts: [{ coupon: 'coupon_123' }]
                })
            );
        });
    });

    describe('createPortalSession', () => {
        it('should create a portal session for existing customer', async () => {
            const mockBilling = { stripe_customer_id: 'cus_123' };
            const mockSession = { url: 'https://billing.stripe.com/portal_123' };

            mockBillingService.getOrganizationBilling.mockResolvedValue(mockBilling);
            mockStripe.billingPortal.sessions.create.mockResolvedValue(mockSession);

            const result = await stripeService.createPortalSession('org-1', 'https://app.example.com/billing');

            expect(result).toHaveProperty('url', 'https://billing.stripe.com/portal_123');
        });

        it('should throw error when no customer exists', async () => {
            mockBillingService.getOrganizationBilling.mockResolvedValue({ stripe_customer_id: null });

            await expect(stripeService.createPortalSession('org-1', 'https://app.example.com'))
                .rejects.toThrow('No Stripe customer found');
        });
    });

    describe('createPaymentIntent', () => {
        it('should create a payment intent', async () => {
            const mockPaymentIntent = {
                id: 'pi_123',
                client_secret: 'pi_123_secret'
            };
            const mockBilling = { stripe_customer_id: 'cus_123' };

            mockBillingService.getOrganizationBilling.mockResolvedValue(mockBilling);
            mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

            const result = await stripeService.createPaymentIntent({
                orgId: 'org-1',
                amount: 5000,
                currency: 'usd',
                description: 'One-time payment'
            });

            expect(result).toHaveProperty('id', 'pi_123');
            expect(result).toHaveProperty('clientSecret', 'pi_123_secret');
        });

        it('should include customer when available', async () => {
            const mockBilling = { stripe_customer_id: 'cus_123' };
            mockBillingService.getOrganizationBilling.mockResolvedValue(mockBilling);
            mockStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_123', client_secret: 'secret' });

            await stripeService.createPaymentIntent({
                orgId: 'org-1',
                amount: 5000
            });

            expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customer: 'cus_123'
                })
            );
        });
    });

    describe('calculateProration', () => {
        it('should calculate proration for upgrade', async () => {
            const mockBilling = {
                subscription_plan_id: 'plan-basic',
                current_period_start: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                current_period_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
            };
            const mockCurrentPlan = { id: 'plan-basic', name: 'Basic', price_monthly: 29 };
            const mockNewPlan = { id: 'plan-pro', name: 'Pro', price_monthly: 99 };

            mockBillingService.getOrganizationBilling.mockResolvedValue(mockBilling);
            mockBillingService.getPlanById
                .mockResolvedValueOnce(mockCurrentPlan)
                .mockResolvedValueOnce(mockNewPlan);

            const result = await stripeService.calculateProration('org-1', 'plan-pro');

            expect(result).toHaveProperty('isUpgrade', true);
            expect(result).toHaveProperty('currentPlan');
            expect(result).toHaveProperty('newPlan');
            expect(result).toHaveProperty('prorationAmount');
            expect(result.newPlan.priceMonthly).toBeGreaterThan(result.currentPlan.priceMonthly);
        });

        it('should calculate proration for downgrade', async () => {
            const mockBilling = {
                subscription_plan_id: 'plan-pro',
                current_period_start: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                current_period_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
            };
            const mockCurrentPlan = { id: 'plan-pro', name: 'Pro', price_monthly: 99 };
            const mockNewPlan = { id: 'plan-basic', name: 'Basic', price_monthly: 29 };

            mockBillingService.getOrganizationBilling.mockResolvedValue(mockBilling);
            mockBillingService.getPlanById
                .mockResolvedValueOnce(mockCurrentPlan)
                .mockResolvedValueOnce(mockNewPlan);

            const result = await stripeService.calculateProration('org-1', 'plan-basic');

            expect(result).toHaveProperty('isUpgrade', false);
            expect(result.creditAmount).toBeGreaterThan(result.chargeAmount);
        });

        it('should throw error for missing billing record', async () => {
            mockBillingService.getOrganizationBilling.mockResolvedValue(null);

            await expect(stripeService.calculateProration('org-1', 'plan-pro'))
                .rejects.toThrow('No billing record found');
        });
    });

    describe('recordUsageEvent', () => {
        it('should record usage event', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => callback(null, null));
            mockDb.run.mockImplementation((sql, params, callback) => {
                if (callback) callback.call({ lastID: 1, changes: 1 }, null);
            });

            const result = await stripeService.recordUsageEvent({
                orgId: 'org-1',
                metricName: 'ai_tokens',
                quantity: 1000,
                idempotencyKey: 'idem_123'
            });

            expect(result).toHaveProperty('id');
        });

        it('should return duplicate flag for existing idempotency key', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('idempotency_key')) {
                    callback(null, { id: 'existing-id' });
                } else {
                    callback(null, null);
                }
            });

            const result = await stripeService.recordUsageEvent({
                orgId: 'org-1',
                metricName: 'ai_tokens',
                quantity: 1000,
                idempotencyKey: 'idem_existing'
            });

            expect(result).toHaveProperty('duplicate', true);
        });
    });

    describe('applyCredit', () => {
        it('should apply credit to organization', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                if (callback) callback.call({ lastID: 1, changes: 1 }, null);
            });

            const result = await stripeService.applyCredit({
                orgId: 'org-1',
                amount: 5000,
                reason: 'Promo credit',
                source: 'promo'
            });

            expect(result).toHaveProperty('id');
        });
    });

    describe('getAvailableCredits', () => {
        it('should return available credits', async () => {
            const mockCredits = [
                { id: 'credit-1', amount: 5000, used_amount: 1000 },
                { id: 'credit-2', amount: 3000, used_amount: 0 }
            ];

            mockDb.all.mockResolvedValue($2);

            const result = await stripeService.getAvailableCredits('org-1');

            expect(result.total).toBe(7000); // (5000-1000) + (3000-0)
            expect(result.credits).toHaveLength(2);
        });
    });
});

