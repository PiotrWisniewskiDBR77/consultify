import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { dbAll, dbGet, dbRun } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
}));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (sql: string, ...args: any[]) =>
    sql.includes('organization_members') ? Promise.resolve({ status: 'ACTIVE' }) : dbGet(sql, ...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

async function loadSettingsRouter() {
  return (await import('../../server/src/routes/settings.routes.ts')).default;
}

describe('Settings API (root) - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
    dbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  it('GET / returns key-value object', async () => {
    dbAll.mockResolvedValueOnce([
      { key: 'k1', value: 'v1' },
      { key: 'k2', value: 'v2' },
    ]);
    const router = await loadSettingsRouter();
    const app = makeTestApp({
      mountPath: '/api/settings',
      router,
      beforeMount: (a) =>
        a.use((req, _res, next) => {
          (req as any).user = { id: 'u1', organizationId: 'org1' };
          (req as any).userRole = 'superadmin';
          next();
        }),
    });
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ k1: 'v1', k2: 'v2' });
  });

  it('POST / returns 400 when key is missing', async () => {
    const router = await loadSettingsRouter();
    const app = makeTestApp({
      mountPath: '/api/settings',
      router,
      beforeMount: (a) =>
        a.use((req, _res, next) => {
          (req as any).user = { id: 'u1', organizationId: 'org1' };
          (req as any).userRole = 'superadmin';
          next();
        }),
    });
    const res = await request(app).post('/api/settings').send({ value: 1 });
    expect(res.status).toBe(400);
  });
});
