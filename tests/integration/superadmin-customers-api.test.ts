import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { dbAll, dbRun } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbRun: vi.fn(),
}));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  run: (...args: any[]) => dbRun(...args),
  get: vi.fn(),
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

async function makeSuperadminApp() {
  const router = await loadSuperadminRouter();
  return makeTestApp({
    mountPath: '/api/superadmin',
    router,
    beforeMount: (app) => {
      app.use((req, _res, next) => {
        (req as any).user = { id: 'u-1', organizationId: 'org-1', role: 'SUPERADMIN' };
        next();
      });
    },
  });
}

describe('Superadmin customers API (lifecycle stages) - REAL integration', () => {
  let nowSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
    dbRun.mockResolvedValue({ success: true, changes: 1 });
    nowSpy?.mockRestore();
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(123);
  });

  afterEach(() => {
    nowSpy?.mockRestore();
    nowSpy = null;
  });

  it('GET /lifecycle/stages returns list from dbAll', async () => {
    dbAll.mockResolvedValueOnce([{ id: 's1' }]);
    const app = await makeSuperadminApp();
    const res = await request(app).get('/api/superadmin/lifecycle/stages');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 's1' }]);
  });

  it('POST /lifecycle/stages inserts and returns success + stage id', async () => {
    const app = await makeSuperadminApp();
    const res = await request(app)
      .post('/api/superadmin/lifecycle/stages')
      .send({ name: 'New', orderIndex: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, id: 'stage-123' });
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO customer_lifecycle_stages'),
      expect.any(Array)
    );
  });

  it('PUT /lifecycle/stages/:id updates is_active flag as integer', async () => {
    const app = await makeSuperadminApp();
    const res = await request(app)
      .put('/api/superadmin/lifecycle/stages/s1')
      .send({ name: 'N', isActive: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    const args = dbRun.mock.calls[0]?.[1] as any[];
    expect(args[4]).toBe(1);
    expect(args[5]).toBe('s1');
  });

  it('DELETE /lifecycle/stages/:id deletes row', async () => {
    const app = await makeSuperadminApp();
    const res = await request(app).delete('/api/superadmin/lifecycle/stages/s1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM customer_lifecycle_stages'),
      ['s1']
    );
  });

  it('GET /lifecycle/stages returns 500 on dbAll error', async () => {
    dbAll.mockRejectedValueOnce(new Error('db'));
    const app = await makeSuperadminApp();
    const res = await request(app).get('/api/superadmin/lifecycle/stages');
    expect(res.status).toBe(500);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});
