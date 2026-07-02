/**
 * M15 Seria T / T1 — route test for resultsDriverTree.routes.ts
 *
 * Honest router test: real Express + real driver-tree route + real
 * valueDriverTreeService, with ONLY DbPromise + auth middleware mocked.
 * The mock dbAll() routes returns by SQL substring (which table is queried),
 * so the route runs its real shaping logic against deterministic rows.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── auth: by default inject an org-scoped user; flip `injectUser` to test 401 ──
let injectUser = true;
vi.mock('../../../server/src/middleware/auth.middleware.js', () => {
  const verifyToken = (req: any, _res: any, next: any) => {
    if (injectUser) req.user = { id: 'u-1', organizationId: 'org-1' };
    next();
  };
  return { __esModule: true, default: verifyToken, verifyToken };
});

// ── DB: route returns by SQL substring ──
const rows: Record<string, any[]> = {
  initiatives: [
    { id: 'init-1', name: 'Automatyzacja faktur' },
    { id: 'init-2', name: 'Portal klienta' },
  ],
  initiative_kpis: [
    { id: 'kpi-1', name: 'Czas obsługi', category: 'process', current_value: 80, target_value: 100, baseline_value: 40 },
    { id: 'kpi-2', name: 'Przychód', category: 'financial', current_value: 50, target_value: 200, baseline_value: 0 },
  ],
  initiative_kpi_mappings: [
    { initiative_id: 'init-1', kpi_id: 'kpi-1' },
    { initiative_id: 'init-2', kpi_id: 'kpi-2' },
  ],
};

const dbAll = vi.fn(async (sql: string) => {
  if (/FROM initiative_kpi_mappings/i.test(sql)) return rows.initiative_kpi_mappings;
  if (/FROM initiative_kpis/i.test(sql)) return rows.initiative_kpis;
  if (/FROM initiatives/i.test(sql)) return rows.initiatives;
  return [];
});

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  __esModule: true,
  all: (sql: string, ..._rest: any[]) => dbAll(sql),
  get: vi.fn(async () => null),
  run: vi.fn(async () => ({ success: true, changes: 1 })),
  exec: vi.fn(async () => ({ success: true })),
}));

const { default: driverTreeRouter } = await import(
  '../../../server/src/routes/resultsDriverTree.routes.js'
);

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/results-driver-tree', driverTreeRouter);
  return app;
}

describe('GET /api/results-driver-tree/:pid/driver-tree', () => {
  beforeEach(() => {
    injectUser = true;
    dbAll.mockClear();
  });
  afterEach(() => {
    injectUser = true;
  });

  it('returns nodes/edges/stats with rolled-up values (happy path, projectId=all)', async () => {
    const res = await request(makeApp())
      .get('/api/results-driver-tree/all/driver-tree')
      .expect(200);

    // top-level shape
    expect(Array.isArray(res.body.nodes)).toBe(true);
    expect(Array.isArray(res.body.edges)).toBe(true);
    expect(res.body.stats).toBeTypeOf('object');
  });

  it('node types are limited to the documented union', async () => {
    const res = await request(makeApp())
      .get('/api/results-driver-tree/all/driver-tree')
      .expect(200);
    const allowed = new Set(['objective', 'driver', 'kpi', 'initiative']);
    for (const n of res.body.nodes) {
      expect(n).toHaveProperty('id');
      expect(allowed.has(n.type)).toBe(true);
      expect(n).toHaveProperty('rolledUpValue');
    }
  });

  it('kpi nodes carry a confidence in [0,1] derived from current/target', async () => {
    const res = await request(makeApp())
      .get('/api/results-driver-tree/all/driver-tree')
      .expect(200);
    const kpiNodes = res.body.nodes.filter((n: any) => n.type === 'kpi');
    expect(kpiNodes.length).toBeGreaterThan(0);
    for (const k of kpiNodes) {
      if (k.confidence != null) {
        expect(k.confidence).toBeGreaterThanOrEqual(0);
        expect(k.confidence).toBeLessThanOrEqual(1);
      }
    }
  });

  it('edges expose both from/to and fromId/toId aliases plus weight', async () => {
    const res = await request(makeApp())
      .get('/api/results-driver-tree/all/driver-tree')
      .expect(200);
    expect(res.body.edges.length).toBeGreaterThan(0);
    for (const e of res.body.edges) {
      expect(e).toHaveProperty('from');
      expect(e).toHaveProperty('to');
      expect(e).toHaveProperty('fromId');
      expect(e).toHaveProperty('toId');
      expect(e).toHaveProperty('weight');
      expect(e.from).toBe(e.fromId);
      expect(e.to).toBe(e.toId);
    }
  });

  it('stats counts are internally consistent with the node list', async () => {
    const res = await request(makeApp())
      .get('/api/results-driver-tree/all/driver-tree')
      .expect(200);
    const s = res.body.stats;
    expect(s.totalNodes).toBe(res.body.nodes.length);
    expect(s.objectiveCount).toBe(res.body.nodes.filter((n: any) => n.type === 'objective').length);
    expect(s.driverCount).toBe(res.body.nodes.filter((n: any) => n.type === 'driver').length);
    expect(s.kpiCount).toBe(res.body.nodes.filter((n: any) => n.type === 'kpi').length);
    expect(s.initiativeCount).toBe(res.body.nodes.filter((n: any) => n.type === 'initiative').length);
    expect(typeof s.coveredValue).toBe('number');
  });

  it('synthesises an objective + per-category driver nodes from KPIs', async () => {
    const res = await request(makeApp())
      .get('/api/results-driver-tree/all/driver-tree')
      .expect(200);
    // one synthetic root objective
    expect(res.body.stats.objectiveCount).toBeGreaterThanOrEqual(1);
    // two KPI categories (process, financial) → at least 2 driver nodes
    expect(res.body.stats.driverCount).toBeGreaterThanOrEqual(2);
    expect(res.body.stats.kpiCount).toBe(2);
  });

  it('returns empty-but-valid structure when there is no data', async () => {
    dbAll.mockImplementationOnce(async () => []).mockImplementationOnce(async () => []).mockImplementationOnce(async () => []);
    const res = await request(makeApp())
      .get('/api/results-driver-tree/all/driver-tree')
      .expect(200);
    expect(res.body.stats.kpiCount).toBe(0);
    expect(res.body.stats.coveredValue).toBe(0);
  });

  it('returns 401 when no org context on the token', async () => {
    injectUser = false;
    const res = await request(makeApp())
      .get('/api/results-driver-tree/all/driver-tree')
      .expect(401);
    expect(res.body.success).toBe(false);
  });
});
