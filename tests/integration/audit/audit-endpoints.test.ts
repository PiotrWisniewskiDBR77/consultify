import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

const { dbAll, dbGet, dbRun } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/admin.middleware.js', () => ({
  verifyAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('uuid', () => ({ v4: () => 'a-1' }));

async function loadAuditRouter() {
  return (await import('../../../server/src/routes/audit.routes.ts')).default;
}

async function makeAuditApp() {
  const router = await loadAuditRouter();
  return makeTestApp({
    mountPath: '/api/audits',
    router,
    beforeMount: (app) => {
      app.use((req, _res, next) => {
        (req as any).user = { id: 'u-1', organizationId: 'org-1' };
        next();
      });
    },
  });
}

describe('Audit routes - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
    dbGet.mockResolvedValue(undefined);
    dbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  it('GET / returns list from dbAll', async () => {
    dbAll.mockResolvedValueOnce([{ id: 'x' }]);
    const app = await makeAuditApp();
    const res = await request(app).get('/api/audits');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'x' }]);
  });

  it('POST / returns 400 when name missing', async () => {
    const app = await makeAuditApp();
    const res = await request(app).post('/api/audits').send({ type: 'internal' });
    expect(res.status).toBe(400);
  });

  it('POST / inserts row and returns 201 with id', async () => {
    const app = await makeAuditApp();
    const res = await request(app)
      .post('/api/audits')
      .send({ name: 'N', type: 'internal', scheduledDate: '2026-01-01' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, id: 'a-1' });
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audits'),
      expect.any(Array)
    );
  });

  it('PUT /:id returns 400 when no updates', async () => {
    const app = await makeAuditApp();
    const res = await request(app).put('/api/audits/a-1').send({});
    expect(res.status).toBe(400);
  });

  it('PUT /:id stringifies findings when provided', async () => {
    const app = await makeAuditApp();
    const res = await request(app)
      .put('/api/audits/a-1')
      .send({ findings: [{ id: 1 }] });
    expect(res.status).toBe(200);
    const params = dbRun.mock.calls[0]?.[1] as any[];
    expect(params[0]).toBe(JSON.stringify([{ id: 1 }]));
  });
});
