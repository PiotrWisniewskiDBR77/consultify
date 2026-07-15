/**
 * Wiring test for the 3 previously orphaned Results engines
 * (server/src/services/results/{kpiAnomalyService,kpiForecastService,
 * deviationRcaSuggestService}.ts — 0 importers before this change).
 *
 * Scope: routing -> service, not the pure-logic math (already covered by
 * tests/unit/results/{kpiAnomalyService,kpiForecastService,
 * deviationRcaSuggestService}.test.ts). Services are NOT mocked here — only
 * the DB layer is — so a real computation flows through the route and the
 * response shape is verified end-to-end.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAll = vi.fn();
const mockGet = vi.fn();
const mockRun = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockAll(...args),
  get: (...args: unknown[]) => mockGet(...args),
  run: (...args: unknown[]) => mockRun(...args),
}));

import resultsRoutes from '../../../server/src/routes/v8/results.routes.js';

const ORG = 'org-1';
const UID = 'user-1';
const KPI_ID = 'kpi-1';
const CASE_ID = 'case-1';

function createApp(role: string = 'owner'): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.v8Context = { organizationId: ORG, userId: UID, userRole: role, isSuperAdmin: false };
    req.user = { id: UID, organizationId: ORG, role };
    next();
  });
  app.use('/api/v8/results', resultsRoutes);
  return app;
}

describe('V8 Results — orphaned engine wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockResolvedValue({ changes: 1 });
  });

  describe('GET /kpis/:kpiId/anomalies -> kpiAnomalyService.detectAnomalies', () => {
    it('404s when the KPI is not owned by the caller org', async () => {
      mockGet.mockResolvedValueOnce(null); // ownership lookup
      const res = await request(createApp()).get(`/api/v8/results/kpis/${KPI_ID}/anomalies`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RESULTS_KPI_NOT_FOUND');
    });

    it('detects an outlier in the recorded time-series and reports it org-scoped', async () => {
      mockGet.mockResolvedValueOnce({ id: KPI_ID }); // ownership lookup
      mockAll.mockResolvedValueOnce([
        { value: 10, period_start: '2026-01-01', measured_at: null },
        { value: 11, period_start: '2026-02-01', measured_at: null },
        { value: 9, period_start: '2026-03-01', measured_at: null },
        { value: 10, period_start: '2026-04-01', measured_at: null },
        { value: 100, period_start: '2026-05-01', measured_at: null }, // outlier
      ]);

      const res = await request(createApp()).get(`/api/v8/results/kpis/${KPI_ID}/anomalies`);

      expect(res.status).toBe(200);
      expect(res.body.data.kpiId).toBe(KPI_ID);
      expect(res.body.data.summary.hasAnomalies).toBe(true);
      expect(res.body.data.anomalies.length).toBeGreaterThan(0);
      expect(res.body.data.anomalies[0]).toMatchObject({ value: 100, periodIso: '2026-05-01' });

      // Org-scope: both the ownership check and the time-series read are scoped to ORG.
      expect(mockGet).toHaveBeenCalledWith(expect.any(String), [KPI_ID, ORG]);
      expect(mockAll).toHaveBeenCalledWith(expect.any(String), [KPI_ID, ORG]);
    });
  });

  describe('GET /kpis/:kpiId/forecast -> kpiForecastService.{linearTrend,projectToTarget,leadingAlert}', () => {
    it('404s when the KPI is not owned by the caller org', async () => {
      mockGet.mockResolvedValueOnce(null);
      const res = await request(createApp()).get(`/api/v8/results/kpis/${KPI_ID}/forecast`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RESULTS_KPI_NOT_FOUND');
    });

    it('projects a rising trend onto the target and reports willHitTarget', async () => {
      mockGet.mockResolvedValueOnce({ id: KPI_ID, target_value: 100, direction: 'HIGHER_IS_BETTER' });
      mockAll.mockResolvedValueOnce([
        { value: 10, period_start: '2026-01-01', measured_at: null },
        { value: 40, period_start: '2026-02-01', measured_at: null },
        { value: 70, period_start: '2026-03-01', measured_at: null },
      ]);

      const res = await request(createApp()).get(`/api/v8/results/kpis/${KPI_ID}/forecast`);

      expect(res.status).toBe(200);
      expect(res.body.data.kpiId).toBe(KPI_ID);
      expect(res.body.data.target).toBe(100);
      expect(res.body.data.direction).toBe('HIGHER_IS_BETTER');
      expect(res.body.data.trend.slope).toBeGreaterThan(0);
      expect(res.body.data.projection.willHitTarget).toBe(true);
      expect(res.body.data.points).toHaveLength(3);
    });

    it('omits projection/alert when the KPI has no target configured', async () => {
      mockGet.mockResolvedValueOnce({ id: KPI_ID, target_value: null, direction: 'HIGHER_IS_BETTER' });
      mockAll.mockResolvedValueOnce([{ value: 10, period_start: '2026-01-01', measured_at: null }]);

      const res = await request(createApp()).get(`/api/v8/results/kpis/${KPI_ID}/forecast`);

      expect(res.status).toBe(200);
      expect(res.body.data.target).toBeNull();
      expect(res.body.data.projection).toBeNull();
      expect(res.body.data.alert).toBeNull();
    });
  });

  describe('GET /deviation-cases/:caseId/rca-suggest -> deviationRcaSuggestService.{suggestRca,suggestActions}', () => {
    it('is permission-gated by manage_deviation (viewer role is rejected)', async () => {
      const res = await request(createApp('nonexistent-role')).get(
        `/api/v8/results/deviation-cases/${CASE_ID}/rca-suggest`
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('P04_PERMISSION_DENIED');
      // Permission gate short-circuits before any DB call.
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('404s when the deviation case is not owned by the caller org', async () => {
      mockGet.mockResolvedValueOnce(null); // case lookup
      const res = await request(createApp()).get(`/api/v8/results/deviation-cases/${CASE_ID}/rca-suggest`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RESULTS_DEVIATION_CASE_NOT_FOUND');
    });

    it('derives signals from stored data and returns hypotheses + actions', async () => {
      mockGet
        .mockResolvedValueOnce({ id: CASE_ID, kpi_id: KPI_ID, period_start: '2026-03-01' }) // case
        .mockResolvedValueOnce({ target_value: 100, measurement_frequency: 'monthly' }) // kpi
        .mockResolvedValueOnce({ value: 60 }); // measurement at/near period_start
      mockAll.mockResolvedValueOnce([
        { value: 60, period_start: '2026-03-01', measured_at: null },
        { value: 70, period_start: '2026-02-01', measured_at: null },
        { value: 80, period_start: '2026-01-01', measured_at: null },
      ]); // recent (DESC)

      const res = await request(createApp()).get(
        `/api/v8/results/deviation-cases/${CASE_ID}/rca-suggest`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.caseId).toBe(CASE_ID);
      expect(res.body.data.kpiId).toBe(KPI_ID);
      expect(res.body.data.signals.deviationPct).toBeCloseTo(-0.4, 5); // (60-100)/100
      expect(res.body.data.signals.trend).toBe('declining'); // 60 (recent) < 80 (oldest)
      expect(Array.isArray(res.body.data.hypotheses)).toBe(true);
      expect(res.body.data.hypotheses.length).toBeGreaterThan(0);
      expect(res.body.data.hypotheses[0]).toHaveProperty('category');
      expect(res.body.data.hypotheses[0]).toHaveProperty('confidence');
      expect(Array.isArray(res.body.data.actions)).toBe(true);
      expect(res.body.data.actions.length).toBeGreaterThan(0);
      // Does NOT write rca_text — read-only suggest endpoint.
      expect(mockRun).not.toHaveBeenCalled();
    });

    it('lets the caller override non-derivable judgment signals via query string', async () => {
      mockGet
        .mockResolvedValueOnce({ id: CASE_ID, kpi_id: KPI_ID, period_start: '2026-03-01' })
        .mockResolvedValueOnce({ target_value: 100, measurement_frequency: 'monthly' })
        .mockResolvedValueOnce({ value: 95 });
      mockAll.mockResolvedValueOnce([{ value: 95, period_start: '2026-03-01', measured_at: null }]);

      const res = await request(createApp()).get(
        `/api/v8/results/deviation-cases/${CASE_ID}/rca-suggest?adoptionScore=0.1&scopeChanged=true&capacityOverloaded=true`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.signals.adoptionScore).toBe(0.1);
      expect(res.body.data.signals.scopeChanged).toBe(true);
      expect(res.body.data.signals.capacityOverloaded).toBe(true);
      const categories = res.body.data.hypotheses.map((h: { category: string }) => h.category);
      expect(categories).toEqual(expect.arrayContaining(['adoption', 'scope', 'capacity']));
    });
  });
});
