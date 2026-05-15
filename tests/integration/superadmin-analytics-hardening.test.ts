import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { dbGet, dbAll } = vi.hoisted(() => ({
  dbGet: vi.fn(),
  dbAll: vi.fn(),
}));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
  all: (...args: any[]) => dbAll(...args),
  run: vi.fn(),
}));

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/middleware/rateLimiting.middleware.js', () => ({
  defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: any, next: any) => next(),
  requireSuperAdminCapability: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/services/annaAnalyticsService.js', () => ({
  getPublicAnnaFunnelSummary: vi.fn(async () => ({})),
}));

async function loadAnalyticsRouter() {
  return (await import('../../server/src/routes/analytics-superadmin.routes.ts')).default;
}

describe('Superadmin analytics hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_SUPERADMIN_SQL_REPORTS;
    dbAll.mockResolvedValue([]);
    dbGet.mockResolvedValue({
      id: 'r-1',
      query_sql: 'select * from organizations',
      layout_json: '{}',
      widgets_json: '[]',
    });
  });

  it('blocks operator executed SQL reports by default', async () => {
    const router = await loadAnalyticsRouter();
    const app = makeTestApp({ mountPath: '/api/superadmin/analytics', router });

    const res = await request(app)
      .post('/api/superadmin/analytics/reports/r-1/execute')
      .send({})
      .expect(422);

    expect(res.body.code).toBe('ANALYTICS_SQL_DISABLED');
    expect(dbAll).not.toHaveBeenCalled();
  });
});
