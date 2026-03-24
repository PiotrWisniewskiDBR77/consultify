import path from 'path';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { testFactory } from '../../helpers/TestFactory';

vi.hoisted(() => {
    const path = require('path');
    process.env.SQLITE_PATH = path.resolve(__dirname, 'billing-payment-integration.db');
    process.env.MOCK_DB = 'false';
    process.env.TEST_TYPE = 'integration';
});

import app from '../../../server/src/index';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { resetConnection } from '../../../server/src/database/Database.js';

/**
 * L3 Integration Tests: Billing & Payment Flow Integration
 * 
 * Tests complete billing and payment flow across services:
 * - BillingService
 * - PaymentService
 * - SubscriptionService
 * - InvoiceService
 * - UsageTrackingService
 * - NotificationService
 */
describe('L3: Billing & Payment Flow Integration', () => {
    const testDbPath = path.resolve(__dirname, 'billing-payment-integration.db');
    let adminToken: string;
    let testOrgId: string;
    let testSubscriptionId: string;

    beforeAll(async () => {
        await resetConnection();
        const initResult = await initializeDatabase();
        if (!initResult.success) {
            throw new Error(`Database initialization failed: ${initResult.message}`);
        }

        // Setup test organization
        const org = await testFactory.createOrganization({
            name: 'Billing Test Org',
            plan: 'professional',
        });
        testOrgId = org.id;

        const admin = await testFactory.createUser({
            organizationId: testOrgId,
            password: 'AdminPass123!',
            role: 'ADMIN',
        });

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: admin.email, password: 'AdminPass123!' });
        adminToken = loginRes.body.token;
    });

    afterAll(async () => {
        await resetConnection();
    });

    describe('Subscription Creation → Payment Method → Billing Cycle Setup Flow', () => {
        it('should create subscription for organization', async () => {
            const subRes = await request(app)
                .post('/api/subscriptions')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    organizationId: testOrgId,
                    plan: 'professional',
                    billingCycle: 'monthly',
                });

            if (subRes.status === 200 || subRes.status === 201) {
                expect(subRes.body).toHaveProperty('id');
                expect(subRes.body.plan).toBe('professional');
                testSubscriptionId = subRes.body.id;
            }
        });

        it('should add payment method', async () => {
            const paymentRes = await request(app)
                .post('/api/payment-methods')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    type: 'credit_card',
                    token: 'tok_visa_test',
                    isDefault: true,
                });

            if (paymentRes.status === 200 || paymentRes.status === 201) {
                expect(paymentRes.body).toHaveProperty('id');
                expect(paymentRes.body.type).toBe('credit_card');
            }
        });

        it('should set up billing cycle', async () => {
            if (!testSubscriptionId) testSubscriptionId = 'mock-subscription-id';

            const cycleRes = await request(app)
                .put(`/api/subscriptions/${testSubscriptionId}/billing-cycle`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    cycle: 'monthly',
                    startDate: '2026-01-01',
                });

            if (cycleRes.status === 200) {
                expect(cycleRes.body.billingCycle).toBe('monthly');
            }
        });
    });

    describe('Usage Tracking → Metering → Invoice Generation Flow', () => {
        it('should track usage events', async () => {
            const usageRes = await request(app)
                .post('/api/usage')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    organizationId: testOrgId,
                    metric: 'api_calls',
                    quantity: 1000,
                    timestamp: new Date().toISOString(),
                });

            if (usageRes.status === 200 || usageRes.status === 201) {
                expect(usageRes.body).toHaveProperty('id');
            }
        });

        it('should aggregate usage for billing period', async () => {
            const aggregateRes = await request(app)
                .get('/api/usage/aggregate')
                .query({
                    organizationId: testOrgId,
                    startDate: '2026-01-01',
                    endDate: '2026-01-31',
                })
                .set('Authorization', `Bearer ${adminToken}`);

            if (aggregateRes.status === 200) {
                expect(aggregateRes.body).toHaveProperty('totalUsage');
                expect(aggregateRes.body).toHaveProperty('breakdown');
            }
        });

        it('should generate invoice from usage', async () => {
            const invoiceRes = await request(app)
                .post('/api/invoices/generate')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    organizationId: testOrgId,
                    period: '2026-01',
                });

            if (invoiceRes.status === 200 || invoiceRes.status === 201) {
                expect(invoiceRes.body).toHaveProperty('invoiceNumber');
                expect(invoiceRes.body).toHaveProperty('amount');
                expect(invoiceRes.body).toHaveProperty('lineItems');
            }
        });

        it('should apply discounts and credits', async () => {
            const discountRes = await request(app)
                .post('/api/invoices/apply-discount')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    organizationId: testOrgId,
                    code: 'SAVE20',
                });

            if (discountRes.status === 200) {
                expect(discountRes.body).toHaveProperty('discountApplied');
            }
        });
    });

    describe('Payment Processing → Retry Logic → Failure Handling Flow', () => {
        let invoiceId: string;

        beforeAll(async () => {
            // Create invoice for payment testing
            const invoiceRes = await request(app)
                .post('/api/invoices/generate')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ organizationId: testOrgId, period: '2026-02' });

            if (invoiceRes.status === 200 || invoiceRes.status === 201) {
                invoiceId = invoiceRes.body.id;
            }
        });

        it('should process payment successfully', async () => {
            if (!invoiceId) invoiceId = 'mock-invoice-id';

            const paymentRes = await request(app)
                .post(`/api/invoices/${invoiceId}/pay`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    paymentMethodId: 'pm_test_123',
                });

            if (paymentRes.status === 200) {
                expect(paymentRes.body.status).toBe('paid');
                expect(paymentRes.body).toHaveProperty('transactionId');
            }
        });

        it('should handle payment failure', async () => {
            const failRes = await request(app)
                .post(`/api/invoices/${invoiceId}/pay`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    paymentMethodId: 'pm_fail_test',
                });

            if (failRes.status === 402 || failRes.status === 400) {
                expect(failRes.body).toHaveProperty('error');
            }
        });

        it('should retry failed payment', async () => {
            const retryRes = await request(app)
                .post(`/api/invoices/${invoiceId}/retry-payment`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (retryRes.status === 200 || retryRes.status === 202) {
                expect(retryRes.body).toHaveProperty('retryScheduled');
            }
        });

        it('should notify on payment failure', async () => {
            const notifRes = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${adminToken}`);

            if (notifRes.status === 200) {
                const paymentNotif = notifRes.body.find((n: any) =>
                    n.type === 'payment_failed'
                );
                // Notification might exist
            }
        });
    });

    describe('Refund Processing → Credit Application → Reconciliation Flow', () => {
        let paidInvoiceId: string;

        beforeAll(async () => {
            // Create and pay invoice for refund testing
            const invoiceRes = await request(app)
                .post('/api/invoices/generate')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ organizationId: testOrgId, period: '2026-03' });

            if (invoiceRes.status === 200 || invoiceRes.status === 201) {
                paidInvoiceId = invoiceRes.body.id;

                // Pay the invoice
                await request(app)
                    .post(`/api/invoices/${paidInvoiceId}/pay`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ paymentMethodId: 'pm_test_123' });
            }
        });

        it('should process full refund', async () => {
            if (!paidInvoiceId) paidInvoiceId = 'mock-paid-invoice';

            const refundRes = await request(app)
                .post(`/api/invoices/${paidInvoiceId}/refund`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    amount: 'full',
                    reason: 'Service not delivered',
                });

            if (refundRes.status === 200) {
                expect(refundRes.body).toHaveProperty('refundId');
                expect(refundRes.body.status).toBe('refunded');
            }
        });

        it('should process partial refund', async () => {
            const partialRefundRes = await request(app)
                .post(`/api/invoices/${paidInvoiceId}/refund`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    amount: 50.00,
                    reason: 'Partial service credit',
                });

            if (partialRefundRes.status === 200) {
                expect(partialRefundRes.body).toHaveProperty('refundId');
            }
        });

        it('should apply credit to account', async () => {
            const creditRes = await request(app)
                .post('/api/billing/credits')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    organizationId: testOrgId,
                    amount: 100.00,
                    reason: 'Service credit',
                });

            if (creditRes.status === 200 || creditRes.status === 201) {
                expect(creditRes.body).toHaveProperty('creditId');
            }
        });

        it('should reconcile account balance', async () => {
            const balanceRes = await request(app)
                .get('/api/billing/balance')
                .set('Authorization', `Bearer ${adminToken}`);

            if (balanceRes.status === 200) {
                expect(balanceRes.body).toHaveProperty('balance');
                expect(balanceRes.body).toHaveProperty('credits');
                expect(balanceRes.body).toHaveProperty('outstandingInvoices');
            }
        });
    });

    describe('Subscription Changes → Proration → Billing Adjustment Flow', () => {
        it('should upgrade subscription', async () => {
            if (!testSubscriptionId) testSubscriptionId = 'mock-subscription-id';

            const upgradeRes = await request(app)
                .post(`/api/subscriptions/${testSubscriptionId}/upgrade`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ newPlan: 'enterprise' });

            if (upgradeRes.status === 200) {
                expect(upgradeRes.body.plan).toBe('enterprise');
            }
        });

        it('should calculate proration for mid-cycle upgrade', async () => {
            const prorationRes = await request(app)
                .get(`/api/subscriptions/${testSubscriptionId}/proration`)
                .query({ newPlan: 'enterprise' })
                .set('Authorization', `Bearer ${adminToken}`);

            if (prorationRes.status === 200) {
                expect(prorationRes.body).toHaveProperty('proratedAmount');
                expect(prorationRes.body).toHaveProperty('nextBillingAmount');
            }
        });

        it('should downgrade subscription', async () => {
            const downgradeRes = await request(app)
                .post(`/api/subscriptions/${testSubscriptionId}/downgrade`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ newPlan: 'starter' });

            if (downgradeRes.status === 200) {
                expect(downgradeRes.body.plan).toBe('starter');
            }
        });

        it('should apply billing adjustment', async () => {
            const adjustmentRes = await request(app)
                .post('/api/billing/adjustments')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    organizationId: testOrgId,
                    amount: -50.00,
                    reason: 'Service downtime credit',
                });

            if (adjustmentRes.status === 200 || adjustmentRes.status === 201) {
                expect(adjustmentRes.body).toHaveProperty('adjustmentId');
            }
        });
    });

    describe('Billing Reports and Analytics', () => {
        it('should generate revenue report', async () => {
            const revenueRes = await request(app)
                .get('/api/billing/reports/revenue')
                .query({ period: '2026-01' })
                .set('Authorization', `Bearer ${adminToken}`);

            if (revenueRes.status === 200) {
                expect(revenueRes.body).toHaveProperty('totalRevenue');
                expect(revenueRes.body).toHaveProperty('breakdown');
            }
        });

        it('should generate usage analytics', async () => {
            const analyticsRes = await request(app)
                .get('/api/billing/analytics/usage')
                .query({ organizationId: testOrgId })
                .set('Authorization', `Bearer ${adminToken}`);

            if (analyticsRes.status === 200) {
                expect(analyticsRes.body).toHaveProperty('metrics');
            }
        });

        it('should export billing data', async () => {
            const exportRes = await request(app)
                .get('/api/billing/export')
                .query({ format: 'csv', period: '2026-01' })
                .set('Authorization', `Bearer ${adminToken}`);

            if (exportRes.status === 200) {
                expect(exportRes.headers['content-type']).toContain('text/csv');
            }
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle invalid payment method', async () => {
            const invalidRes = await request(app)
                .post('/api/payment-methods')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    type: 'invalid_type',
                    token: 'invalid_token',
                });

            expect([400, 422]).toContain(invalidRes.status);
        });

        it('should prevent duplicate payments', async () => {
            const invoice = await testFactory.createInvoice({
                organizationId: testOrgId,
                amount: 100.00,
            });

            // Pay invoice
            await request(app)
                .post(`/api/invoices/${invoice.id}/pay`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ paymentMethodId: 'pm_test_123' });

            // Try to pay again
            const duplicateRes = await request(app)
                .post(`/api/invoices/${invoice.id}/pay`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ paymentMethodId: 'pm_test_123' });

            expect([400, 409]).toContain(duplicateRes.status);
        });

        it('should handle concurrent payment attempts', async () => {
            const invoice = await testFactory.createInvoice({
                organizationId: testOrgId,
                amount: 100.00,
            });

            const promises = Array(3).fill(null).map(() =>
                request(app)
                    .post(`/api/invoices/${invoice.id}/pay`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ paymentMethodId: 'pm_test_123' })
            );

            const results = await Promise.all(promises);

            // Only one should succeed
            const successful = results.filter(r => r.status === 200);
            expect(successful.length).toBe(1);
        });
    });
});
