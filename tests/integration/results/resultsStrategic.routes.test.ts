/**
 * M15 Seria T / T1 — route test for resultsStrategic.routes.ts
 *
 * Covers GET /:pid/strategic (BSC + BDN + narrative) and GET /:pid/okr
 * (objectives + summary). Real Express + real route + real services
 * (resultsStrategicViewService, okrService) with DbPromise + auth mocked.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let injectUser = true;
vi.mock('../../../server/src/middleware/auth.middleware.js', () => {
  const verifyToken = (req: any, _res: any, next: any) => {
    if (injectUser) req.user = { id: 'u-1', organizationId: 'org-1' };
    next();
  };
  return { __esModule: true, default: verifyToken, verifyToken };
});

const rows: Record<string, any[]> = {
  initiatives: [
    { id: 'init-1', name: 'Automatyzacja faktur' },
    { id: 'init-2', name: 'Portal klienta' },
  ],
  initiative_kpis: [
    { id: 'kpi-1', name: 'Czas obsługi', current_value: 80, target_value: 100, measurement_frequency: 'monthly' },
    { id: 'kpi-2', name: 'Przychód', current_value: 50, target_value: 200, measurement_frequency: 'quarterly' },
  ],
  initiative_kpi_mappings: [
    { initiative_id: 'init-1', kpi_id: 'kpi-1' },
    { initiative_id: 'init-2', kpi_id: 'kpi-2' },
  ],
  okr_objectives: [
    { id: 'obj-1', label: 'Wzrost przychodu', parent_id: null },
    { id: 'obj-2', label: 'Efektywność', parent_id: 'obj-1' },
  ],
  okr_key_results: [
    { id: 'kr-1', objective_id: 'obj-1', label: 'ARR +20%', baseline: 0, target: 100, current: 50, weight: 1 },
    { id: 'kr-2', objective_id: 'obj-2', label: 'Czas -30%', baseline: 0, target: 100, current: 80, weight: 1 },
  ],
};

const defaultDbAll = async (sql: string) => {
  if (/FROM okr_key_results/i.test(sql)) return rows.okr_key_results;
  if (/FROM okr_objectives/i.test(sql)) return rows.okr_objectives;
  if (/FROM initiative_kpi_mappings/i.test(sql)) return rows.initiative_kpi_mappings;
  if (/FROM initiative_kpis/i.test(sql)) return rows.initiative_kpis;
  if (/FROM initiatives/i.test(sql)) return rows.initiatives;
  return [];
};
const dbAll = vi.fn(defaultDbAll);

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  __esModule: true,
  all: (sql: string, ..._rest: any[]) => dbAll(sql),
  get: vi.fn(async () => null),
  run: vi.fn(async () => ({ success: true, changes: 1 })),
  exec: vi.fn(async () => ({ success: true })),
}));

const { default: strategicRouter } = await import(
  '../../../server/src/routes/resultsStrategic.routes.js'
);

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/results-strategic', strategicRouter);
  return app;
}

describe('GET /api/results-strategic/:pid/strategic', () => {
  beforeEach(() => {
    injectUser = true;
    dbAll.mockReset();
    dbAll.mockImplementation(defaultDbAll);
  });

  it('returns the strategic payload (BSC + BDN + narrative)', async () => {
    const res = await request(makeApp())
      .get('/api/results-strategic/all/strategic')
      .expect(200);
    expect(res.body).toHaveProperty('bsc');
    expect(res.body).toHaveProperty('bdn');
    expect(res.body).toHaveProperty('narrative');
  });

  it('returns a bare payload, not a {success,data} wrapper', async () => {
    const res = await request(makeApp())
      .get('/api/results-strategic/all/strategic')
      .expect(200);
    expect(res.body).not.toHaveProperty('success');
    expect(res.body).not.toHaveProperty('data');
  });

  it('queries initiatives, kpis and mappings for the org', async () => {
    await request(makeApp()).get('/api/results-strategic/all/strategic').expect(200);
    const sqls = dbAll.mock.calls.map((c) => c[0]);
    expect(sqls.some((s) => /FROM initiatives/i.test(s))).toBe(true);
    expect(sqls.some((s) => /FROM initiative_kpis/i.test(s))).toBe(true);
    expect(sqls.some((s) => /FROM initiative_kpi_mappings/i.test(s))).toBe(true);
  });

  it('survives an empty org (no initiatives/kpis)', async () => {
    dbAll.mockImplementation(async () => []);
    const res = await request(makeApp())
      .get('/api/results-strategic/all/strategic')
      .expect(200);
    expect(res.body).toHaveProperty('bsc');
  });

  it('returns 401 without org context', async () => {
    injectUser = false;
    const res = await request(makeApp())
      .get('/api/results-strategic/all/strategic')
      .expect(401);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/results-strategic/:pid/okr', () => {
  beforeEach(() => {
    injectUser = true;
    dbAll.mockReset();
    dbAll.mockImplementation(defaultDbAll);
  });

  it('returns objectives[] + summary with cascade scores', async () => {
    const res = await request(makeApp())
      .get('/api/results-strategic/all/okr')
      .expect(200);
    expect(Array.isArray(res.body.objectives)).toBe(true);
    expect(res.body.objectives.length).toBe(2);
    expect(res.body.summary).toBeTypeOf('object');
  });

  it('objectives carry id/label/parentId/keyResults and a score', async () => {
    const res = await request(makeApp())
      .get('/api/results-strategic/all/okr')
      .expect(200);
    const obj = res.body.objectives.find((o: any) => o.id === 'obj-1');
    expect(obj).toBeTruthy();
    expect(obj).toHaveProperty('label');
    expect(obj).toHaveProperty('keyResults');
    expect(Array.isArray(obj.keyResults)).toBe(true);
    // score and/or rollupScore present on cascaded objectives
    expect('score' in obj || 'rollupScore' in obj).toBe(true);
  });

  it('attaches key results to the right objective', async () => {
    const res = await request(makeApp())
      .get('/api/results-strategic/all/okr')
      .expect(200);
    const obj1 = res.body.objectives.find((o: any) => o.id === 'obj-1');
    expect(obj1.keyResults.map((k: any) => k.id)).toContain('kr-1');
  });

  it('summary exposes total + status buckets', async () => {
    const res = await request(makeApp())
      .get('/api/results-strategic/all/okr')
      .expect(200);
    const s = res.body.summary;
    expect(s).toHaveProperty('total');
    expect(s).toHaveProperty('onTrack');
    expect(s).toHaveProperty('atRisk');
    expect(s).toHaveProperty('offTrack');
    expect(s.total).toBe(2);
  });

  it('returns empty objectives + zeroed summary for a fresh org', async () => {
    dbAll.mockImplementation(async () => []);
    const res = await request(makeApp())
      .get('/api/results-strategic/all/okr')
      .expect(200);
    expect(res.body.objectives).toHaveLength(0);
    expect(res.body.summary.total).toBe(0);
  });

  it('returns 401 without org context', async () => {
    injectUser = false;
    const res = await request(makeApp())
      .get('/api/results-strategic/all/okr')
      .expect(401);
    expect(res.body.success).toBe(false);
  });
});
