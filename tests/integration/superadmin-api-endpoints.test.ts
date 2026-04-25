import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { dbAll } = vi.hoisted(() => ({ dbAll: vi.fn() }));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../server/src/controllers/SuperAdminController.js', () => ({
  default: new Proxy(
    {},
    {
      get: () => (_req: any, res: any) => res.status(501).json({ error: 'stub' }),
    }
  ),
}));

vi.mock('../../server/src/middleware/rateLimiting.middleware.js', () => ({
  authRateLimiter: (_req: any, _res: any, next: any) => next(),
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: any, next: any) => next(),
  requireSuperAdminCapability: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

async function loadSuperadminRouter() {
  return (await import('../../server/src/routes/superadmin.routes.ts')).default;
}

describe('Superadmin API (security permissions stats) - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
  });

  it('GET /security/permissions/stats returns computed totals and category breakdown', async () => {
    dbAll
      .mockResolvedValueOnce([
        { category: 'auth', is_system: 1 },
        { category: 'auth', is_system: 0 },
        { category: 'billing', is_system: 1 },
      ])
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

    const router = await loadSuperadminRouter();
    const app = makeTestApp({
      mountPath: '/api/superadmin',
      router,
      beforeMount: (a) =>
        a.use((req, _res, next) => {
          (req as any).user = { id: 'u1' };
          next();
        }),
    });
    const res = await request(app).get('/api/superadmin/security/permissions/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        totalPermissions: 3,
        systemPermissions: 2,
        customPermissions: 1,
        totalRoles: 2,
        categoryBreakdown: expect.objectContaining({ auth: 2, billing: 1 }),
      })
    );
  });
});
