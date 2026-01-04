/**
 * Billing Routes Tests
 * Tests billing and payment endpoints
 * CRITICAL FOR ENTERPRISE MONETIZATION
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { setupStandardTest } from '../../../helpers/unifiedMockSetup.js';
import billingRoutes from '../../../../server/src/routes/billing.routes.ts';

describe('Billing Routes', () => {
  let app: express.Application;
  let mocks;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks = setupStandardTest();

    app = express();
    app.use(express.json());

    // Mock auth middleware
    app.use((req, res, next) => {
      req.user = {
        id: 'test-user',
        organizationId: 'test-org',
        role: 'SUPERADMIN'
      };
      req.organizationId = 'test-org';
      next();
    });

    app.use('/api/billing', billingRoutes);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/billing/stats', () => {
    it('should get billing statistics for superadmin', async () => {
      mocks.db.get.mockImplementation((sql, params, callback) => {
        callback(null, { mrr: 15000, arr: 180000 });
      });

      const response = await request(app)
        .get('/api/billing/stats?period=30')
        .expect(200);

      expect(response.body.mrr).toBeDefined();
    });

    it('should require superadmin access for stats', async () => {
      // Mock non-superadmin user
      app.use((req, res, next) => {
        req.user = { id: 'test-user', role: 'ADMIN' };
        next();
      });

      const response = await request(app)
        .get('/api/billing/stats')
        .expect(403);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/billing/subscription', () => {
    it('should get current subscription', async () => {
      mocks.db.get.mockImplementation((sql, params, callback) => {
        callback(null, {
          id: 'sub-123',
          status: 'active',
          plan_id: 'plan-premium',
          current_period_start: '2025-01-01',
          current_period_end: '2025-02-01'
        });
      });

      const response = await request(app)
        .get('/api/billing/subscription')
        .expect(200);

      expect(response.body.status).toBe('active');
    });

    it('should handle no active subscription', async () => {
      mocks.db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .get('/api/billing/subscription')
        .expect(404);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/billing/invoices', () => {
    it('should get organization invoices', async () => {
      mocks.db.all.mockImplementation((sql, params, callback) => {
        callback(null, [
          {
            id: 'inv-123',
            amount: 29900,
            currency: 'usd',
            status: 'paid',
            created_at: '2025-01-01'
          }
        ]);
      });

      const response = await request(app)
        .get('/api/billing/invoices')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/billing/subscription', () => {
    it('should create new subscription', async () => {
      mocks.db.run.mockImplementation(function(sql, params, callback) {
        if (callback) callback.call({ lastID: 1 }, null);
      });

      const subscriptionData = {
        plan_id: 'plan-premium',
        payment_method_id: 'pm_123'
      };

      const response = await request(app)
        .post('/api/billing/subscription')
        .send(subscriptionData)
        .expect(201);

      expect(response.body.subscriptionId).toBeDefined();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/billing/subscription')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('PUT /api/billing/subscription', () => {
    it('should update subscription', async () => {
      mocks.db.run.mockImplementation(function(sql, params, callback) {
        if (callback) callback.call({ changes: 1 }, null);
      });

      const updateData = {
        plan_id: 'plan-enterprise'
      };

      const response = await request(app)
        .put('/api/billing/subscription')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/billing/subscription/cancel', () => {
    it('should cancel subscription', async () => {
      mocks.db.run.mockImplementation(function(sql, params, callback) {
        if (callback) callback.call({ changes: 1 }, null);
      });

      const cancelData = {
        reason: 'cost',
        feedback: 'Too expensive'
      };

      const response = await request(app)
        .post('/api/billing/subscription/cancel')
        .send(cancelData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/billing/usage', () => {
    it('should record usage', async () => {
      mocks.db.run.mockImplementation(function(sql, params, callback) {
        if (callback) callback.call({ lastID: 1 }, null);
      });

      const usageData = {
        event_type: 'api_call',
        quantity: 1000
      };

      const response = await request(app)
        .post('/api/billing/usage')
        .send(usageData)
        .expect(201);

      expect(response.body.usageId).toBeDefined();
    });
  });

  describe('GET /api/billing/plans', () => {
    it('should get available plans', async () => {
      mocks.db.all.mockImplementation((sql, params, callback) => {
        callback(null, [
          {
            id: 'plan-basic',
            name: 'Basic',
            price_monthly: 2999,
            features: JSON.stringify(['feature1', 'feature2'])
          }
        ]);
      });

      const response = await request(app)
        .get('/api/billing/plans')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/billing/payment-method', () => {
    it('should add payment method', async () => {
      mocks.db.run.mockImplementation(function(sql, params, callback) {
        if (callback) callback.call({ lastID: 1 }, null);
      });

      const paymentData = {
        type: 'card',
        token: 'tok_visa'
      };

      const response = await request(app)
        .post('/api/billing/payment-method')
        .send(paymentData)
        .expect(201);

      expect(response.body.paymentMethodId).toBeDefined();
    });
  });
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
