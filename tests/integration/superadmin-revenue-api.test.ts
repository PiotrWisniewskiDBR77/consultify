import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { dbAll } = vi.hoisted(() => ({
  dbAll: vi.fn(),
}));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
  requireSuperAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/middleware/rateLimiting.middleware.js', () => ({
  defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

async function loadBillingRoutes() {
  return (await import('../../server/src/routes/billing/billing.routes.ts')).default;
}

async function makeBillingAdminApp() {
  const router = await loadBillingRoutes();
  return makeTestApp({
    mountPath: '/api/billing',
    router,
    beforeMount: (app) => {
      app.use((req, _res, next) => {
        (req as any).user = { id: 'u-1', organizationId: 'org-1', role: 'SUPERADMIN' };
        next();
      });
    },
  });
}

describe('Superadmin revenue API (billing admin mocks) - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
  });

  it('GET /admin/revenue returns dashboard-compatible payload', async () => {
    const app = await makeBillingAdminApp();
    const res = await request(app).get('/api/billing/admin/revenue');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        mrr: 0,
        arr: 0,
        activeSubscriptions: 0,
        planDistribution: expect.any(Array),
      })
    );
  });

  it('GET /admin/usage returns dashboard-compatible payload', async () => {
    const app = await makeBillingAdminApp();
    const res = await request(app).get('/api/billing/admin/usage');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        totalTokensThisMonth: 0,
        totalStorageGB: 0,
        activeOrganizations: 0,
      })
    );
  });

  it('GET /admin/operational-costs returns empty list', async () => {
    const app = await makeBillingAdminApp();
    const res = await request(app).get('/api/billing/admin/operational-costs');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], totalCost: 0 });
  });

  it('GET /analytics/mrr returns 500 when dbAll throws', async () => {
    dbAll.mockRejectedValueOnce(new Error('db'));
    const app = await makeBillingAdminApp();
    const res = await request(app).get('/api/billing/analytics/mrr');
    expect(res.status).toBe(500);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('GET /analytics/mrr returns computed totalMRR and arr', async () => {
    dbAll.mockResolvedValueOnce([
      { plan_id: 'p', plan_name: 'P', price_monthly: 10, subscriber_count: 2 },
    ]);
    const app = await makeBillingAdminApp();
    const res = await request(app).get('/api/billing/analytics/mrr');
    expect(res.status).toBe(200);
    expect(res.body.mrr.totalMRR).toBe(20);
    expect(res.body.mrr.arr).toBe(240);
  });
});
