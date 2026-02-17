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

vi.mock('uuid', () => ({ v4: () => 'sr-1' }));

async function loadStatusReportsRouter() {
  return (await import('../../server/src/routes/status-reports.routes.ts')).default;
}

describe('Status reports routes - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
    dbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  it('GET / passes optional projectId filter', async () => {
    const router = await loadStatusReportsRouter();
    const app = makeTestApp({
      mountPath: '/api/status-reports',
      router,
      beforeMount: (a) =>
        a.use((req, _res, next) => {
          (req as any).user = { id: 'u1', organizationId: 'org-1' };
          next();
        }),
    });
    await request(app).get('/api/status-reports?projectId=p1');
    expect(dbAll).toHaveBeenCalledWith(expect.stringContaining('AND project_id = ?'), [
      'org-1',
      'p1',
    ]);
  });

  it('POST / inserts and returns 201 with id', async () => {
    const router = await loadStatusReportsRouter();
    const app = makeTestApp({
      mountPath: '/api/status-reports',
      router,
      beforeMount: (a) =>
        a.use((req, _res, next) => {
          (req as any).user = { id: 'u1', organizationId: 'org-1' };
          next();
        }),
    });
    const res = await request(app).post('/api/status-reports').send({ projectId: 'p1' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, id: 'sr-1' });
  });
});
