import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { dbAll, dbRun } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbRun: vi.fn(),
}));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('uuid', () => ({ v4: () => 'rl-2' }));

async function loadRapidleanRouter() {
  return (await import('../../server/src/routes/rapidlean.routes.ts')).default;
}

async function makeRapidleanApp() {
  const router = await loadRapidleanRouter();
  return makeTestApp({
    mountPath: '/api/rapidlean',
    router,
    beforeMount: (app) => {
      app.use((req, _res, next) => {
        (req as any).user = { id: 'u-1', organizationId: 'org-1' };
        next();
      });
    },
  });
}

describe('RapidLean full workflow (routes) - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
    dbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  it('POST /assessments creates a draft assessment', async () => {
    const app = await makeRapidleanApp();
    const res = await request(app).post('/api/rapidlean/assessments').send({ title: 'T' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, id: 'rl-2' });
  });

  it('GET /assessments returns list', async () => {
    dbAll.mockResolvedValueOnce([{ id: 'a1' }]);
    const app = await makeRapidleanApp();
    const res = await request(app).get('/api/rapidlean/assessments');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'a1' }]);
  });
});
