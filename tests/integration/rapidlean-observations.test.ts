import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { dbRun } = vi.hoisted(() => ({
  dbRun: vi.fn(),
}));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));

async function loadRapidleanRouter() {
  return (await import('../../server/src/routes/rapidlean.routes.ts')).default;
}

describe('RapidLean PUT /assessments/:id update query - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  it('updates multiple fields and stringifies dimensions', async () => {
    const router = await loadRapidleanRouter();
    const app = makeTestApp({
      mountPath: '/api/rapidlean',
      router,
      beforeMount: (a) => {
        a.use((req: any, _res: any, next: any) => {
          req.user = { id: 'u-1', organizationId: 'org-1' };
          next();
        });
      },
    });
    const res = await request(app)
      .put('/api/rapidlean/assessments/a1')
      .send({ score: 1, status: 'done', dimensions: { x: 1 } });
    expect(res.status).toBe(200);

    const [sql, params] = dbRun.mock.calls[0];
    expect(String(sql)).toContain('score = ?');
    expect(String(sql)).toContain('status = ?');
    expect(String(sql)).toContain('dimensions = ?');
    expect(params).toEqual([1, 'done', JSON.stringify({ x: 1 }), 'a1']);
  });
});
