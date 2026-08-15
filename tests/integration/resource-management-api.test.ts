/**
 * L2: resourceManagement.routes (honest router test)
 *
 * Replaces nondeterministic "hit localhost if server is running" checks.
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakeDb = vi.hoisted(() => ({
  all: vi.fn(async () => []),
  get: vi.fn(async () => null),
  run: vi.fn(async () => ({ changes: 1 })),
}));

vi.mock('../../server/src/database/Database.js', () => ({
  getDatabase: () => fakeDb,
}));

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'u-1', organizationId: 'org-1' };
    next();
  },
  requireSuperAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: any, next: any) => next(),
  requireSuperAdminCapability: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/services/budgetTrackingService.js', () => ({
  budgetTrackingService: {
    getBudgetStatus: vi.fn(async () => ({ ok: true })),
    getExpenseHistory: vi.fn(async () => []),
    initializeBudget: vi.fn(async () => undefined),
    recordExpense: vi.fn(async () => undefined),
  },
}));

import resourceManagementRouter from '../../server/src/routes/resourceManagement.routes.js';

describe('resourceManagement.routes', () => {
  let app: express.Express;

  beforeEach(() => {
    fakeDb.all.mockReset();
    fakeDb.get.mockReset();
    fakeDb.run.mockReset();

    app = express();
    app.use(express.json());
    app.use('/api/superadmin', resourceManagementRouter);
  });

  it('GET /api/superadmin/subscription-plans returns plans', async () => {
    fakeDb.all.mockResolvedValueOnce([{ id: 'p1', name: 'Plan 1' }]);

    const res = await request(app).get('/api/superadmin/subscription-plans').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.plans).toEqual([{ id: 'p1', name: 'Plan 1' }]);
  });

  it('POST /api/superadmin/subscription-plans creates plan', async () => {
    const res = await request(app)
      .post('/api/superadmin/subscription-plans')
      .send({
        name: 'Test Plan',
        priceMonthly: 10,
        tokenLimit: 100,
        storageLimitGb: 1,
        memoryLimitMb: 256,
        cpuQuotaPercent: 10,
        maxConcurrentAiJobs: 1,
        tokenOverageRate: 0.01,
        storageOverageRate: 0.1,
        stripePriceId: 'price_123',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(String(res.body.planId)).toMatch(/^plan_/);
    expect(fakeDb.run).toHaveBeenCalled();
  });

  it('DELETE /api/superadmin/subscription-plans/:id rejects deletion when in use', async () => {
    fakeDb.get.mockResolvedValueOnce({ count: 2 });
    const res = await request(app).delete('/api/superadmin/subscription-plans/p1').expect(400);
    expect(res.body.error).toMatch(/in use/i);
    expect(res.body.organizationsUsing).toBe(2);
  });

  it('DELETE /api/superadmin/subscription-plans/:id deletes when not in use', async () => {
    fakeDb.get.mockResolvedValueOnce({ count: 0 });
    await request(app).delete('/api/superadmin/subscription-plans/p1').expect(200);
    expect(fakeDb.run).toHaveBeenCalled();
  });

  it('GET /api/superadmin/organizations/:id/resources returns 404 when org missing', async () => {
    fakeDb.get.mockResolvedValueOnce(null);
    await request(app).get('/api/superadmin/organizations/org-404/resources').expect(404);
  });
});
