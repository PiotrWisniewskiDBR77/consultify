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

vi.mock('uuid', () => ({ v4: () => 'rl-1' }));

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));

async function loadRapidleanRouter() {
  return (await import('../../server/src/routes/rapidlean.routes.ts')).default;
}

async function makeRapidleanApp(opts?: { orgId?: string }) {
  const router = await loadRapidleanRouter();
  return makeTestApp({
    mountPath: '/api/rapidlean',
    router,
    beforeMount: (app) => {
      app.use((req, _res, next) => {
        (req as any).user = { id: 'u-1', organizationId: opts?.orgId ?? 'org-1' };
        next();
      });
    },
  });
}

describe('RapidLean routes - error handling (REAL integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
    dbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  it('GET /assessments returns array and passes orgId param to dbAll', async () => {
    const app = await makeRapidleanApp({ orgId: 'org-x' });
    const res = await request(app).get('/api/rapidlean/assessments');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(dbAll).toHaveBeenCalledWith(expect.stringContaining('rapid_lean_assessments'), [
      'org-x',
    ]);
  });

  it('POST /assessments inserts defaults and returns 201', async () => {
    const app = await makeRapidleanApp();
    const res = await request(app)
      .post('/api/rapidlean/assessments')
      .send({ dimensions: { a: 1 } });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, id: 'rl-1' });

    const args = dbRun.mock.calls[0]?.[1] || [];
    expect(args[0]).toBe('rl-1');
    expect(args[1]).toBe('org-1');
    expect(args[2]).toBe('Rapid Lean Assessment');
    expect(args[3]).toBe('lean_4_0');
    expect(args[4]).toBe(JSON.stringify({ a: 1 }));
  });

  it('PUT /assessments/:id returns 400 when no updates were provided', async () => {
    const app = await makeRapidleanApp();
    const res = await request(app).put('/api/rapidlean/assessments/a1').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('PUT /assessments/:id updates score when provided', async () => {
    const app = await makeRapidleanApp();
    const res = await request(app).put('/api/rapidlean/assessments/a1').send({ score: 77 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    const [sql, params] = dbRun.mock.calls[0];
    expect(String(sql)).toContain('score = ?');
    expect(params).toEqual([77, 'a1']);
  });

  it('PUT /assessments/:id stringifies dimensions updates', async () => {
    const app = await makeRapidleanApp();
    const res = await request(app)
      .put('/api/rapidlean/assessments/a2')
      .send({ dimensions: { x: true } });
    expect(res.status).toBe(200);

    const [sql, params] = dbRun.mock.calls[0];
    expect(String(sql)).toContain('dimensions = ?');
    expect(params[0]).toBe(JSON.stringify({ x: true }));
    expect(params[1]).toBe('a2');
  });
});
