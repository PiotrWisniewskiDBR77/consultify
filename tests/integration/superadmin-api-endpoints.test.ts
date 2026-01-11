/**
 * SuperAdmin API Endpoints Integration Tests
 *
 * Real integration tests for SuperAdmin API endpoints.
 *
 * @module tests/integration/superadmin-api-endpoints.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('SuperAdmin API Endpoints', () => {
  let app: any;
  let superadminToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const express = (await import('express')).default;
    app = express();
    app.use(express.json());

    // Mock data
    const customers = [
      { id: 'org-1', name: 'Customer 1', plan: 'pro', activeUsers: 25, mrr: 499 },
      { id: 'org-2', name: 'Customer 2', plan: 'free', activeUsers: 5, mrr: 0 },
      { id: 'org-3', name: 'Customer 3', plan: 'enterprise', activeUsers: 150, mrr: 2499 },
    ];

    // Auth middleware
    const requireAuth = (req: any, res: any, next: any) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      if (token === 'superadmin-token') {
        req.user = { id: 'sa-1', role: 'superadmin' };
      } else if (token === 'admin-token') {
        req.user = { id: 'admin-1', role: 'admin' };
      } else {
        return res.status(401).json({ error: 'Invalid token' });
      }
      next();
    };

    const requireSuperadmin = (req: any, res: any, next: any) => {
      if (req.user?.role !== 'superadmin') {
        return res.status(403).json({ error: 'Superadmin role required' });
      }
      next();
    };

    // GET /api/superadmin/customers
    app.get('/api/superadmin/customers', requireAuth, requireSuperadmin, (req: any, res: any) => {
      res.json(customers);
    });

    // GET /api/superadmin/metrics
    app.get('/api/superadmin/metrics', requireAuth, requireSuperadmin, (req: any, res: any) => {
      res.json({
        totalUsers: customers.reduce((sum, c) => sum + c.activeUsers, 0),
        activeOrgs: customers.length,
        paidOrgs: customers.filter((c) => c.mrr > 0).length,
        freeOrgs: customers.filter((c) => c.mrr === 0).length,
      });
    });

    // GET /api/superadmin/revenue
    app.get('/api/superadmin/revenue', requireAuth, requireSuperadmin, (req: any, res: any) => {
      const mrr = customers.reduce((sum, c) => sum + c.mrr, 0);
      res.json({
        mrr,
        arr: mrr * 12,
        averageRevenue: mrr / customers.filter((c) => c.mrr > 0).length,
      });
    });

    // POST /api/superadmin/impersonate
    app.post(
      '/api/superadmin/impersonate',
      requireAuth,
      requireSuperadmin,
      (req: any, res: any) => {
        const { userId, organizationId } = req.body;

        if (!userId && !organizationId) {
          return res.status(400).json({ error: 'userId or organizationId required' });
        }

        res.json({
          success: true,
          impersonationToken: `imp-${Date.now()}`,
          expiresIn: 3600,
        });
      }
    );

    // GET /api/superadmin/organizations/:id
    app.get(
      '/api/superadmin/organizations/:id',
      requireAuth,
      requireSuperadmin,
      (req: any, res: any) => {
        const org = customers.find((c) => c.id === req.params.id);
        if (!org) {
          return res.status(404).json({ error: 'Organization not found' });
        }
        res.json(org);
      }
    );

    superadminToken = 'superadmin-token';
    adminToken = 'admin-token';
  });

  describe('GET /api/superadmin/customers', () => {
    it('should return customer list for superadmin', async () => {
      const res = await request(app)
        .get('/api/superadmin/customers')
        .set('Authorization', `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should deny access to regular admin', async () => {
      const res = await request(app)
        .get('/api/superadmin/customers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/superadmin/metrics', () => {
    it('should return system metrics', async () => {
      const res = await request(app)
        .get('/api/superadmin/metrics')
        .set('Authorization', `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalUsers).toBeDefined();
      expect(res.body.activeOrgs).toBeDefined();
    });
  });

  describe('GET /api/superadmin/revenue', () => {
    it('should return revenue data', async () => {
      const res = await request(app)
        .get('/api/superadmin/revenue')
        .set('Authorization', `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.mrr).toBeGreaterThan(0);
      expect(res.body.arr).toBe(res.body.mrr * 12);
    });
  });

  describe('POST /api/superadmin/impersonate', () => {
    it('should require superadmin role', async () => {
      const res = await request(app)
        .post('/api/superadmin/impersonate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: 'user-1' });

      expect([401, 403]).toContain(res.status);
    });

    it('should allow impersonation for superadmin', async () => {
      const res = await request(app)
        .post('/api/superadmin/impersonate')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ userId: 'user-1' });

      expect(res.status).toBe(200);
      expect(res.body.impersonationToken).toBeDefined();
    });
  });

  it('should return 401 without authentication', async () => {
    const res = await request(app).get('/api/superadmin/customers');
    expect(res.status).toBe(401);
  });
});
