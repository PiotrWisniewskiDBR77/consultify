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
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('uuid', () => ({ v4: () => 'b-1' }));

async function loadBudgetRouter() {
  return (await import('../../server/src/routes/budget.routes.ts')).default;
}

async function makeBudgetApp() {
  const router = await loadBudgetRouter();
  return makeTestApp({
    mountPath: '/api/budgets',
    router,
    beforeMount: (app) => {
      app.use((req, _res, next) => {
        (req as any).user = { id: 'u-1', organizationId: 'org-1' };
        next();
      });
    },
  });
}

describe('Budget routes - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
    dbGet.mockResolvedValue(undefined);
    dbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  it('GET /summary returns defaults when dbGet returns undefined', async () => {
    const app = await makeBudgetApp();
    const res = await request(app).get('/api/budgets/summary');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total_planned: 0, total_actual: 0, budget_count: 0 });
  });

  it('GET / passes projectId filter to dbAll', async () => {
    const app = await makeBudgetApp();
    await request(app).get('/api/budgets?projectId=p1');
    expect(dbAll).toHaveBeenCalledWith(expect.stringContaining('AND project_id = ?'), [
      'org-1',
      'p1',
    ]);
  });

  it('POST / inserts budget and returns 201 with id', async () => {
    const app = await makeBudgetApp();
    const res = await request(app)
      .post('/api/budgets')
      .send({ projectId: 'p1', plannedAmount: 10 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, id: 'b-1' });
  });

  it('PUT /:id returns 400 when no updates', async () => {
    const app = await makeBudgetApp();
    const res = await request(app).put('/api/budgets/b-1').send({});
    expect(res.status).toBe(400);
  });

  it('DELETE /:id deletes row and returns success', async () => {
    const app = await makeBudgetApp();
    const res = await request(app).delete('/api/budgets/b-1');
    expect(res.status).toBe(200);
    expect(dbRun).toHaveBeenCalledWith('DELETE FROM budgets WHERE id = ?', ['b-1']);
  });
});
