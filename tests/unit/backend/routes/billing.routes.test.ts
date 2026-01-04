/**
 * Billing Routes Tests
 * Tests billing and payment endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import billingRoutes from '../../../../server/src/routes/billing.routes.ts';

// Mock services
const mockBillingService = vi.hoisted(() => ({
  getSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  getInvoices: vi.fn(),
  createPaymentMethod: vi.fn(),
  processPayment: vi.fn(),
}));

const mockAuthMiddleware = vi.hoisted(() => ({
  authenticate: vi.fn((req, res, next) => next()),
  requireOrgAccess: vi.fn((req, res, next) => next()),
}));

vi.mock('../../../../server/src/services/billing/BillingCommandService.ts', () => ({
  default: mockBillingService,
}));

vi.mock('../../../../server/src/middleware/auth.middleware.ts', () => ({
  authenticate: mockAuthMiddleware.authenticate,
  requireOrgAccess: mockAuthMiddleware.requireOrgAccess,
}));

describe('Billing Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/billing', billingRoutes);
  });

  describe('GET /api/billing/subscription', () => {
    it('should get current subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        status: 'active',
        plan: 'premium',
        currentPeriodEnd: '2024-12-31',
      };

      mockBillingService.getSubscription.mockResolvedValue(mockSubscription);

      const response = await request(app)
        .get('/api/billing/subscription')
        .set('x-organization-id', 'org-123')
        .expect(200);

      expect(response.body).toEqual(mockSubscription);
      expect(mockBillingService.getSubscription).toHaveBeenCalledWith('org-123');
    });

    it('should handle subscription not found', async () => {
      mockBillingService.getSubscription.mockRejectedValue(new Error('Subscription not found'));

      const response = await request(app)
        .get('/api/billing/subscription')
        .set('x-organization-id', 'org-123')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/billing/subscription', () => {
    it('should update subscription plan', async () => {
      const updateData = { plan: 'enterprise' };
      const mockResult = { success: true, effectiveDate: '2024-02-01' };

      mockBillingService.updateSubscription.mockResolvedValue(mockResult);

      const response = await request(app)
        .put('/api/billing/subscription')
        .set('x-organization-id', 'org-123')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual(mockResult);
      expect(mockBillingService.updateSubscription).toHaveBeenCalledWith('org-123', updateData);
    });
  });

  describe('DELETE /api/billing/subscription', () => {
    it('should cancel subscription', async () => {
      const cancelData = { reason: 'cost', feedback: 'too expensive' };
      const mockResult = { success: true, effectiveDate: '2024-03-01' };

      mockBillingService.cancelSubscription.mockResolvedValue(mockResult);

      const response = await request(app)
        .delete('/api/billing/subscription')
        .set('x-organization-id', 'org-123')
        .send(cancelData)
        .expect(200);

      expect(response.body).toEqual(mockResult);
      expect(mockBillingService.cancelSubscription).toHaveBeenCalledWith('org-123', cancelData);
    });
  });

  describe('GET /api/billing/invoices', () => {
    it('should get invoices list', async () => {
      const mockInvoices = [
        { id: 'inv-1', amount: 99, status: 'paid', date: '2024-01-01' },
        { id: 'inv-2', amount: 99, status: 'pending', date: '2024-02-01' },
      ];

      mockBillingService.getInvoices.mockResolvedValue(mockInvoices);

      const response = await request(app)
        .get('/api/billing/invoices')
        .set('x-organization-id', 'org-123')
        .expect(200);

      expect(response.body).toEqual(mockInvoices);
      expect(mockBillingService.getInvoices).toHaveBeenCalledWith('org-123', {});
    });

    it('should support pagination', async () => {
      const mockInvoices = [{ id: 'inv-1', amount: 99 }];
      const query = { limit: '10', offset: '0' };

      mockBillingService.getInvoices.mockResolvedValue(mockInvoices);

      const response = await request(app)
        .get('/api/billing/invoices')
        .set('x-organization-id', 'org-123')
        .query(query)
        .expect(200);

      expect(mockBillingService.getInvoices).toHaveBeenCalledWith('org-123', query);
    });
  });

  describe('POST /api/billing/payment-methods', () => {
    it('should create payment method', async () => {
      const paymentData = {
        type: 'card',
        token: 'pm_card_visa',
        isDefault: true,
      };

      const mockResult = {
        id: 'pm-123',
        type: 'card',
        last4: '4242',
        brand: 'visa',
      };

      mockBillingService.createPaymentMethod.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/billing/payment-methods')
        .set('x-organization-id', 'org-123')
        .send(paymentData)
        .expect(201);

      expect(response.body).toEqual(mockResult);
      expect(mockBillingService.createPaymentMethod).toHaveBeenCalledWith('org-123', paymentData);
    });
  });

  describe('POST /api/billing/process-payment', () => {
    it('should process payment', async () => {
      const paymentData = {
        amount: 99,
        currency: 'usd',
        paymentMethodId: 'pm-123',
        description: 'Monthly subscription',
      };

      const mockResult = {
        id: 'pay-123',
        status: 'succeeded',
        amount: 99,
        currency: 'usd',
      };

      mockBillingService.processPayment.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/billing/process-payment')
        .set('x-organization-id', 'org-123')
        .send(paymentData)
        .expect(200);

      expect(response.body).toEqual(mockResult);
      expect(mockBillingService.processPayment).toHaveBeenCalledWith('org-123', paymentData);
    });
  });
});
