/**
 * Billing Routes Tests
 * Tests billing and payment endpoints
 * CRITICAL FOR ENTERPRISE MONETIZATION
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { setupStandardTest } from '../../../helpers/unifiedMockSetup.js';
// Correct import path to the subdirectory
import billingRoutes from '../../../../server/src/routes/billing/billing.routes.js';

describe('Billing Routes', () => {
  let app: express.Application;
  let mocks: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks = setupStandardTest();

    app = express();
    app.use(express.json());

    // Mock auth middleware
    app.use((req: any, res: any, next: any) => {
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
      mocks.db.get.mockResolvedValueOnce({ mrr: 15000 }); // mrrResult
      mocks.db.get.mockResolvedValueOnce({ total_revenue: 50000, invoice_count: 10 }); // revenueResult
      mocks.db.all.mockResolvedValueOnce([]); // subscriptionsByPlan
      mocks.db.all.mockResolvedValueOnce([]); // trends
      mocks.db.get.mockResolvedValueOnce({ count: 2, total_amount: 1000 }); // unpaidResult

      const response = await request(app)
        .get('/api/billing/stats?period=30')
        .expect(200);

      expect(response.body.mrr).toBe(15000);
      expect(response.body.revenue.total).toBe(50000);
    });

    it('should require superadmin access for stats', async () => {
      // Create a separate app instance for this test to change the middleware
      const restrictedApp = express();
      restrictedApp.use(express.json());
      restrictedApp.use((req: any, res: any, next: any) => {
        req.user = { id: 'test-user', role: 'USER', organizationId: 'test-org' };
        next();
      });
      restrictedApp.use('/api/billing', billingRoutes);

      const response = await request(restrictedApp)
        .get('/api/billing/stats')
        .expect(403);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/billing/subscriptions', () => {
    it('should get subscriptions', async () => {
      mocks.db.all.mockResolvedValue([
        {
          id: 'sub-123',
          status: 'active',
          plan_id: 'plan-premium',
          current_period_start: '2025-01-01',
          current_period_end: '2025-02-01'
        }
      ]);

      const response = await request(app)
        .get('/api/billing/subscriptions')
        .expect(200);

      expect(response.body.subscriptions).toBeDefined();
      expect(response.body.subscriptions[0].id).toBe('sub-123');
    });
  });

  describe('GET /api/billing/invoices', () => {
    it('should get organization invoices', async () => {
      mocks.db.all.mockResolvedValue([
        {
          id: 'inv-123',
          amount: 29900,
          currency: 'usd',
          status: 'paid',
          created_at: '2025-01-01'
        }
      ]);
      mocks.db.get.mockResolvedValue({ total: 1 });

      const response = await request(app)
        .get('/api/billing/invoices')
        .expect(200);

      expect(response.body.invoices).toBeDefined();
      expect(response.body.invoices[0].id).toBe('inv-123');
    });
  });

  describe('POST /api/billing/subscriptions', () => {
    it('should create new subscription', async () => {
      mocks.db.get.mockResolvedValue(null); // No existing subscription
      mocks.db.run.mockResolvedValue({ lastID: 1 });

      const subscriptionData = {
        organizationId: 'org-123',
        planId: 'plan-premium',
        billingCycle: 'monthly',
        trialDays: 14
      };

      const response = await request(app)
        .post('/api/billing/subscriptions')
        .send(subscriptionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.id).toBeDefined();
    });
  });

  describe('GET /api/billing/plans', () => {
    it('should get available plans', async () => {
      mocks.db.all.mockResolvedValue([
        {
          id: 'plan-basic',
          name: 'Basic',
          price_monthly: 2999,
          features: JSON.stringify(['feature1', 'feature2'])
        }
      ]);

      const response = await request(app)
        .get('/api/billing/plans')
        .expect(200);

      expect(response.body.plans).toBeDefined();
      expect(response.body.plans[0].name).toBe('Basic');
    });
  });
});
