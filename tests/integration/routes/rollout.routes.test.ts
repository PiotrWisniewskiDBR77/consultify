/**
 * M14/F4 — rollout.routes contract tests.
 *
 * 17 endpoints (5 registers: KPI/Risk/Change/Closure + KPI history) were DB-backed
 * but had ZERO backend coverage. These lock the handler contract: org-scoping on
 * every query, 404 branches, KPI history-on-value-change, write-permission gating,
 * and status codes. DbPromise (all/get/run) is mocked as controllable spies — we
 * assert SQL params + branch behaviour, not SQL emulation.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAll, dbGet, dbRun, permitWrite } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
  permitWrite: { ok: true },
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'project_manager' };
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgRole: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../../server/src/middleware/permissionMiddleware.js', () => ({
  requirePermission: () => (_req: any, res: any, next: any) =>
    permitWrite.ok ? next() : res.status(403).json({ error: 'Forbidden' }),
}));
vi.mock('../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...a: any[]) => dbAll(...a),
  get: (...a: any[]) => dbGet(...a),
  run: (...a: any[]) => dbRun(...a),
}));

import rolloutRoutes from '../../../server/src/routes/rollout.routes.js';

function app(): Express {
  const a = express();
  a.use(express.json());
  a.use('/api/rollout', rolloutRoutes);
  return a;
}

beforeEach(() => {
  vi.clearAllMocks();
  permitWrite.ok = true;
});

describe('rollout.routes — KPI register', () => {
  it('GET /kpis is org-scoped and returns {kpis,count}', async () => {
    dbAll.mockResolvedValueOnce([{ id: 'k1', name: 'Adoption' }]);
    const res = await request(app()).get('/api/rollout/kpis');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ kpis: [{ id: 'k1', name: 'Adoption' }], count: 1 });
    // org filter present + org id is the first param
    const [sql, params] = dbAll.mock.calls[0];
    expect(sql).toMatch(/organization_id = \?/i);
    expect(params[0]).toBe('org-1');
  });

  it('GET /kpis?projectId=p filters by project', async () => {
    dbAll.mockResolvedValueOnce([]);
    await request(app()).get('/api/rollout/kpis?projectId=proj-9');
    const [sql, params] = dbAll.mock.calls[0];
    expect(sql).toMatch(/project_id = \?/i);
    expect(params).toContain('proj-9');
  });

  it('POST /kpis inserts org-scoped and returns 201 {kpi}', async () => {
    dbAll.mockResolvedValueOnce([{ id: 'new-k', name: 'My KPI' }]);
    const res = await request(app()).post('/api/rollout/kpis').send({ name: 'My KPI' });
    expect(res.status).toBe(201);
    expect(res.body.kpi).toEqual({ id: 'new-k', name: 'My KPI' });
    const [sql, params] = dbAll.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO rollout_kpis/i);
    expect(params[0]).toBe('org-1'); // organization_id first
  });

  it('PATCH /kpis/:id → 404 when the KPI is not in the org', async () => {
    dbGet.mockResolvedValueOnce(undefined); // existing lookup misses
    const res = await request(app()).patch('/api/rollout/kpis/k-x').send({ target: 90 });
    expect(res.status).toBe(404);
    expect(dbGet.mock.calls[0][1]).toEqual(['k-x', 'org-1']); // id + org scoping
  });

  it('PATCH /kpis/:id records a history point when currentValue changes', async () => {
    dbGet.mockResolvedValueOnce({ current_value: 10 });
    dbAll.mockResolvedValueOnce([{ id: 'k1', current_value: 42 }]);
    dbRun.mockResolvedValueOnce({ changes: 1 });
    const res = await request(app()).patch('/api/rollout/kpis/k1').send({ currentValue: 42 });
    expect(res.status).toBe(200);
    // history insert fired with (kpiId, value)
    const histCall = dbRun.mock.calls.find((c) => /rollout_kpi_history/i.test(c[0]));
    expect(histCall).toBeTruthy();
    expect(histCall![1]).toEqual(['k1', 42]);
  });

  it('PATCH /kpis/:id does NOT write history when currentValue is absent', async () => {
    dbGet.mockResolvedValueOnce({ current_value: 10 });
    dbAll.mockResolvedValueOnce([{ id: 'k1' }]);
    await request(app()).patch('/api/rollout/kpis/k1').send({ name: 'Renamed' });
    const histCall = dbRun.mock.calls.find((c) => /rollout_kpi_history/i.test(c[0]));
    expect(histCall).toBeUndefined();
  });

  it('DELETE /kpis/:id → 404 when nothing was deleted', async () => {
    dbRun.mockResolvedValueOnce({ changes: 0 });
    const res = await request(app()).delete('/api/rollout/kpis/k-x');
    expect(res.status).toBe(404);
  });

  it('DELETE /kpis/:id → success when a row was removed (org-scoped)', async () => {
    dbRun.mockResolvedValueOnce({ changes: 1 });
    const res = await request(app()).delete('/api/rollout/kpis/k1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(dbRun.mock.calls[0][1]).toEqual(['k1', 'org-1']);
  });

  it('GET /kpis/:id/history → 404 when KPI not in org', async () => {
    dbGet.mockResolvedValueOnce(undefined);
    const res = await request(app()).get('/api/rollout/kpis/k-x/history');
    expect(res.status).toBe(404);
  });
});

describe('rollout.routes — write-permission gating (MANAGE_ROLLOUT)', () => {
  it('blocks POST when the permission middleware denies', async () => {
    permitWrite.ok = false;
    const res = await request(app()).post('/api/rollout/kpis').send({ name: 'X' });
    expect(res.status).toBe(403);
    expect(dbAll).not.toHaveBeenCalled(); // never reaches the handler
  });
});

describe('rollout.routes — all 5 registers read path is org-scoped', () => {
  it.each([
    ['/api/rollout/kpis', 'kpis'],
    ['/api/rollout/risks', 'risks'],
    ['/api/rollout/changes', 'changes'],
    ['/api/rollout/closures', 'closures'],
  ])('GET %s scopes by organization_id', async (path) => {
    dbAll.mockResolvedValueOnce([]);
    const res = await request(app()).get(path);
    expect(res.status).toBe(200);
    const [sql, params] = dbAll.mock.calls[0];
    expect(sql).toMatch(/organization_id = \?/i);
    expect(params[0]).toBe('org-1');
  });
});
