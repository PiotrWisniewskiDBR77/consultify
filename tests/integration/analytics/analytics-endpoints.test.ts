import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

const { dbAll, dbGet } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

async function loadAnalyticsRouter() {
  return (await import('../../../server/src/routes/analytics.routes.ts')).default;
}

async function makeAnalyticsApp(opts?: { orgId?: string }) {
  const router = await loadAnalyticsRouter();
  return makeTestApp({
    mountPath: '/api/analytics',
    router,
    beforeMount: (app) => {
      app.use((req, _res, next) => {
        (req as any).user = { id: 'u-1', organizationId: opts?.orgId };
        next();
      });
    },
  });
}

describe('Analytics routes - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
    dbGet.mockResolvedValue(undefined);
  });

  it('GET /health returns 400 when organizationId is missing', async () => {
    const app = await makeAnalyticsApp();
    const res = await request(app).get('/api/analytics/health');
    expect(res.status).toBe(400);
  });

  it('GET /health returns initiativesByStatus + overdueTasks', async () => {
    dbAll.mockResolvedValueOnce([{ status: 'OK', count: 1 }]);
    dbGet.mockResolvedValueOnce({ overdue_count: 2 });
    const app = await makeAnalyticsApp({ orgId: 'org-1' });
    const res = await request(app).get('/api/analytics/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ initiativesByStatus: expect.any(Array), overdueTasks: 2 })
    );
  });

  it('GET /performance returns rows from dbAll', async () => {
    dbAll.mockResolvedValueOnce([{ id: 'u1', total_tasks: 1 }]);
    const app = await makeAnalyticsApp({ orgId: 'org-1' });
    const res = await request(app).get('/api/analytics/performance');
    expect(res.status).toBe(200);
    expect(res.body[0]).toEqual(expect.objectContaining({ id: 'u1' }));
  });

  it('GET /economics returns row with actualSpend', async () => {
    dbGet
      .mockResolvedValueOnce({ total_capex: 1, total_opex: 2, expected_benefit: 3, total_cost: 3 })
      .mockResolvedValueOnce({ actual_spend: 9 });
    const app = await makeAnalyticsApp({ orgId: 'org-1' });
    const res = await request(app).get('/api/analytics/economics');
    expect(res.status).toBe(200);
    expect(res.body.actualSpend).toBe(9);
  });

  it('GET /economics defaults actualSpend to 0 when spendRow is missing', async () => {
    dbGet.mockResolvedValueOnce({
      total_capex: 0,
      total_opex: 0,
      expected_benefit: 0,
      total_cost: 0,
    });
    dbGet.mockResolvedValueOnce(undefined);
    const app = await makeAnalyticsApp({ orgId: 'org-1' });
    const res = await request(app).get('/api/analytics/economics');
    expect(res.status).toBe(200);
    expect(res.body.actualSpend).toBe(0);
  });
});
