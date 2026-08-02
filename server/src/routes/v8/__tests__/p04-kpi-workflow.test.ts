/**
 * P04 KPI Workflow Canon — Integration tests.
 *
 * Covers: §8.1A vocabulary, §8.1D closed-loop workflow, §8.1F degraded posture,
 * §8.1B linkage, §8.1C permissions, §8.1E anti-duplicate, §8.1G acceptance.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { P04_KPI_WORKFLOW_CONTRACT } from '../../../services/v8/kpiWorkflowCanon.js';

const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();

vi.mock('../../../services/v8/resultsROIService.js', () => ({
  getResultsDashboard: vi.fn().mockResolvedValue({}),
  getResultsKpiCatalog: vi.fn().mockResolvedValue({ kpis: [], mappings: [] }),
  getResultsKpiDrawerDetail: vi.fn().mockResolvedValue({ measurements: [], openCase: null }),
  getROIPortfolioSummary: vi.fn().mockResolvedValue({ items: [], summary: {} }),
  getROIInitiativeDetail: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../services/results/kpiReportSnapshotService.js', () => ({
  createKpiReportSnapshot: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../services/results/kpiDeviationService.js', () => ({
  handleTimeSeriesRecorded: vi.fn(),
}));

// RES-02: create/update/delete on /kpis delegate to kpiDefinitionService,
// which opens a REAL pinned pg connection — must be mocked here, otherwise
// the /kpis create/update/delete requests exercised below try to reach a
// real Postgres pool (crashing or hanging) and their unconsumed/misaligned
// mockDbRun queue entries were bleeding into unrelated later tests in this
// file (e.g. the report-creation test reading a stale `{success:false}`-ish
// value off the shared mockDbRun queue).
vi.mock('../../../services/results/kpiDefinitionService.js', () => ({
  createDefinition: vi.fn().mockResolvedValue({ id: 'kpi-created' }),
  updateDefinition: vi.fn().mockResolvedValue({ id: 'kpi-001', currentDefinitionVersion: 2 }),
  archiveDefinition: vi
    .fn()
    .mockResolvedValue({ id: 'kpi-001', archivedAt: new Date().toISOString(), alreadyArchived: false }),
  getCurrentDefinition: vi.fn().mockResolvedValue({ id: 'kpi-001', currentDefinitionVersion: 1 }),
  getCurrentDefinitionVersionId: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../services/reportBuilderService.js', () => ({
  createReport: vi.fn().mockResolvedValue({ id: 'rpt-1' }),
  updateSectionContent: vi.fn(),
  updateReportStatus: vi.fn(),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  getV8Flags: vi.fn().mockResolvedValue({ v8_enabled: true }),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  setV8OrgFlag: vi.fn().mockResolvedValue({}),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

let mockUser: { id: string; role: string; organizationId: string; isSuperAdmin: boolean } | null =
  null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, _res: any, next: () => void) => {
    if (mockUser) {
      req.userId = mockUser.id;
      req.userRole = mockUser.role;
      req.organizationId = mockUser.organizationId;
      req.user = mockUser;
      req.can = () => true;
    }
    next();
  },
  verifyToken: (req: any, _res: any, next: () => void) => {
    if (mockUser) {
      req.userId = mockUser.id;
      req.userRole = mockUser.role;
      req.organizationId = mockUser.organizationId;
      req.user = mockUser;
      req.can = () => true;
    }
    next();
  },
  requireSuperAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOrganization: (_req: unknown, _res: unknown, next: () => void) => next(),
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import v8Router from '../index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

const ORG = '00000000-0000-4000-8000-000000000099';
const USER = 'u-test-001';
const KPI_ID = 'kpi-001';

describe('P04 KPI Workflow Canon', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: USER, role: 'admin', organizationId: ORG, isSuperAdmin: false };
    app = createApp();
  });

  // ─── §8.1A Vocabulary + §8.1G Acceptance ───────────────────

  describe('GET /workflow/contract — vocabulary introspection', () => {
    it('returns frozen vocabulary and acceptance checklist', async () => {
      const res = await request(app).get('/api/v8/results/workflow/contract');
      expect(res.status).toBe(200);
      expect(res.body.meta.contract).toBe(P04_KPI_WORKFLOW_CONTRACT);

      const {
        vocabulary,
        workflowStates,
        linkagePatterns,
        permissions,
        antiDuplicateRules,
        acceptanceChecklist,
      } = res.body.data;
      expect(vocabulary).toEqual(
        expect.arrayContaining([
          'signal',
          'target',
          'trend',
          'report',
          'reconciliation',
          'next_action',
        ])
      );
      expect(linkagePatterns).toEqual(
        expect.arrayContaining(['interpretation', 'driver', 'review', 'realization'])
      );
      expect(permissions).toHaveProperty('edit_definition');
      expect(permissions).toHaveProperty('edit_targets');
      expect(permissions).toHaveProperty('delete_kpi');
      expect(permissions).toHaveProperty('record_measurement');
      expect(permissions).toHaveProperty('create_report');
      expect(permissions).toHaveProperty('manage_deviation');
      expect(permissions).toHaveProperty('view');
      expect(permissions).toHaveProperty('comment');
      expect(permissions).toHaveProperty('manage_reconciliation_results');
      expect(antiDuplicateRules).toHaveProperty('no_bi_suite_drift');
      expect(antiDuplicateRules).toHaveProperty('no_parallel_finance_truth');
      expect(antiDuplicateRules).toHaveProperty('no_charts_only');
      expect(acceptanceChecklist).toHaveLength(21);
    });

    it('returns all 6 canonical workflow states', async () => {
      const res = await request(app).get('/api/v8/results/workflow/contract');
      expect(res.status).toBe(200);
      const { workflowStates } = res.body.data;
      expect(workflowStates).toHaveLength(6);
      expect(workflowStates).toEqual(
        expect.arrayContaining([
          'signal_detected',
          'inspecting',
          'report_created',
          'reconciling',
          'action_assigned',
          'resolved',
        ])
      );
    });
  });

  // ─── P04 Permission enforcement on legacy routes ───────────

  describe('P04 permission enforcement — viewer/commenter blocked on write routes', () => {
    it('POST /kpis returns 403 for viewer', async () => {
      mockUser = { ...mockUser!, role: 'viewer' };
      const res = await request(app)
        .post('/api/v8/results/kpis')
        .send({ name: 'Test KPI', kpiType: 'STANDARD' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('P04_PERMISSION_DENIED');
    });

    it('POST /kpis returns 403 for commenter', async () => {
      mockUser = { ...mockUser!, role: 'commenter' };
      const res = await request(app)
        .post('/api/v8/results/kpis')
        .send({ name: 'Test KPI', kpiType: 'STANDARD' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('P04_PERMISSION_DENIED');
    });

    it('PUT /kpis/:kpiId returns 403 for viewer', async () => {
      mockUser = { ...mockUser!, role: 'viewer' };
      const res = await request(app).put('/api/v8/results/kpis/kpi-001').send({ name: 'Updated' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('P04_PERMISSION_DENIED');
    });

    it('DELETE /kpis/:kpiId returns 403 for viewer', async () => {
      mockUser = { ...mockUser!, role: 'viewer' };
      const res = await request(app).delete('/api/v8/results/kpis/kpi-001');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('P04_PERMISSION_DENIED');
    });

    it('DELETE /kpis/:kpiId returns 403 for finance_owner', async () => {
      mockUser = { ...mockUser!, role: 'manager' };
      const res = await request(app).delete('/api/v8/results/kpis/kpi-001');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('P04_PERMISSION_DENIED');
    });

    it('POST /kpis/:kpiId/time-series returns 403 for viewer', async () => {
      mockUser = { ...mockUser!, role: 'viewer' };
      const res = await request(app)
        .post('/api/v8/results/kpis/kpi-001/time-series')
        .send({ value: 42, measuredAt: '2026-04-01' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('P04_PERMISSION_DENIED');
    });

    it('POST /kpi-reports returns 403 for viewer', async () => {
      mockUser = { ...mockUser!, role: 'viewer' };
      const res = await request(app)
        .post('/api/v8/results/kpi-reports')
        .send({ periodStart: '2026-01-01', periodEnd: '2026-03-31' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('P04_PERMISSION_DENIED');
    });

    it('POST /kpi-reports/:snapshotId/refresh returns 403 for commenter', async () => {
      mockUser = { ...mockUser!, role: 'commenter' };
      const res = await request(app).post('/api/v8/results/kpi-reports/snap-001/refresh');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('P04_PERMISSION_DENIED');
    });

    it('POST /deviation-cases/:caseId/acknowledge returns 403 for viewer', async () => {
      mockUser = { ...mockUser!, role: 'viewer' };
      const res = await request(app).post('/api/v8/results/deviation-cases/case-001/acknowledge');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('P04_PERMISSION_DENIED');
    });

    it('PUT /deviation-cases/:caseId/rca returns 403 for commenter', async () => {
      mockUser = { ...mockUser!, role: 'commenter' };
      const res = await request(app)
        .put('/api/v8/results/deviation-cases/case-001/rca')
        .send({ rcaText: 'Root cause' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('P04_PERMISSION_DENIED');
    });

    it('POST /deviation-cases/:caseId/resolve returns 403 for viewer', async () => {
      mockUser = { ...mockUser!, role: 'viewer' };
      const res = await request(app).post('/api/v8/results/deviation-cases/case-001/resolve');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('P04_PERMISSION_DENIED');
    });

    it('POST /deviation-cases/:caseId/close returns 403 for viewer', async () => {
      mockUser = { ...mockUser!, role: 'viewer' };
      const res = await request(app)
        .post('/api/v8/results/deviation-cases/case-001/close')
        .send({ evidenceText: 'Evidence' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('P04_PERMISSION_DENIED');
    });

    it('POST /kpis succeeds with kpi_owner role (admin)', async () => {
      // RES-02: the write goes through the mocked kpiDefinitionService now,
      // not dbRun — queuing a mockDbRun value here would sit unconsumed
      // (vi.clearAllMocks() does not clear pending mockResolvedValueOnce
      // entries) and leak into whichever LATER test calls dbRun next.
      const res = await request(app)
        .post('/api/v8/results/kpis')
        .send({ name: 'Test KPI', kpiType: 'STANDARD' });
      expect(res.status).not.toBe(403);
    });
  });

  // ─── §8.1D Closed-loop: signal → inspect → next-action ────

  describe('GET /workflow/signals — signal detection', () => {
    it('returns active deviation signals for the org', async () => {
      mockDbAll.mockResolvedValueOnce([
        {
          id: 'sig-1',
          kpi_id: KPI_ID,
          severity: 'RED',
          status: 'OPEN',
          deviation_summary: 'Below target',
          detected_at: '2026-03-01',
          created_at: '2026-03-01',
        },
        {
          id: 'sig-2',
          kpi_id: 'kpi-002',
          severity: 'AMBER',
          status: 'ACKNOWLEDGED',
          deviation_summary: 'Trending down',
          detected_at: '2026-03-15',
          created_at: '2026-03-15',
        },
      ]);

      const res = await request(app).get('/api/v8/results/workflow/signals');
      expect(res.status).toBe(200);
      expect(res.body.meta.contract).toBe(P04_KPI_WORKFLOW_CONTRACT);
      expect(res.body.data.signals).toHaveLength(2);
      expect(res.body.data.signals[0]).toMatchObject({
        signalId: 'sig-1',
        kpiId: KPI_ID,
        signalType: 'deviation',
        severity: 'red',
      });
      expect(res.body.data.count).toBe(2);
    });

    it('returns empty signals when no open deviations', async () => {
      mockDbAll.mockResolvedValueOnce([]);
      const res = await request(app).get('/api/v8/results/workflow/signals');
      expect(res.status).toBe(200);
      expect(res.body.data.signals).toHaveLength(0);
    });
  });

  describe('GET /workflow/kpi/:kpiId/inspect — KPI inspection', () => {
    it('returns target, trend, health, and open signals', async () => {
      mockDbGet.mockResolvedValueOnce({
        id: KPI_ID,
        kpi_id: KPI_ID,
        name: 'Revenue Growth',
        target_value: 100,
        baseline_value: 50,
        latest_value: 75,
        measurement_frequency: 'MONTHLY',
        updated_at: new Date().toISOString(),
        created_at: '2026-01-01',
      });

      mockDbAll
        .mockResolvedValueOnce([
          {
            value: 75,
            measured_at: '2026-03-01',
            period_start: '2026-03-01',
            period_end: '2026-03-31',
          },
          {
            value: 60,
            measured_at: '2026-02-01',
            period_start: '2026-02-01',
            period_end: '2026-02-28',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'sig-1',
            severity: 'RED',
            status: 'OPEN',
            deviation_summary: 'Below target',
            detected_at: '2026-03-01',
          },
        ]);

      mockDbGet.mockResolvedValueOnce(null);

      const res = await request(app).get(`/api/v8/results/workflow/kpi/${KPI_ID}/inspect`);
      expect(res.status).toBe(200);

      const { target, trend, healthPosture, openSignals, workflowHint } = res.body.data;
      expect(target.targetValue).toBe(100);
      expect(target.baselineValue).toBe(50);
      expect(trend.direction).toBe('improving');
      expect(trend.points).toHaveLength(2);
      expect(healthPosture).toBe('nominal');
      expect(openSignals).toHaveLength(1);
      expect(workflowHint).toContain('Signal detected');
    });

    it('returns 404 for non-existent KPI', async () => {
      mockDbGet.mockResolvedValueOnce(null);
      const res = await request(app).get('/api/v8/results/workflow/kpi/nonexistent/inspect');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('KPI_NOT_FOUND');
    });
  });

  describe('POST /workflow/kpi/:kpiId/next-action — create next action', () => {
    it('creates a next action from a signal', async () => {
      // Handler get sequence: KPI ownership → owned; v8_kpi_signals (org-scoped) → owned
      // signal; existing-case collision check → null (sig-1 is not a deviation case id).
      mockDbGet
        .mockResolvedValueOnce({ id: KPI_ID })
        .mockResolvedValueOnce({ id: 'sig-1' })
        .mockResolvedValueOnce(null);
      mockDbRun.mockResolvedValueOnce({ changes: 1 });

      const res = await request(app)
        .post(`/api/v8/results/workflow/kpi/${KPI_ID}/next-action`)
        .send({
          title: 'Investigate revenue drop',
          sourceType: 'signal',
          sourceRef: 'sig-1',
          assigneeId: 'user-42',
          dueDate: '2026-04-15',
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        kpiId: KPI_ID,
        sourceType: 'signal',
        sourceRef: 'sig-1',
        title: 'Investigate revenue drop',
        status: 'open',
        assigneeId: 'user-42',
      });
      expect(res.body.data.actionId).toBeTruthy();
      expect(mockDbRun).toHaveBeenCalledTimes(1);
    });

    it('rejects missing required fields', async () => {
      const res = await request(app)
        .post(`/api/v8/results/workflow/kpi/${KPI_ID}/next-action`)
        .send({ title: 'No source' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('KPI_NEXT_ACTION_MISSING_FIELDS');
    });

    it('rejects invalid sourceType', async () => {
      const res = await request(app)
        .post(`/api/v8/results/workflow/kpi/${KPI_ID}/next-action`)
        .send({ title: 'Bad type', sourceType: 'invalid', sourceRef: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('KPI_NEXT_ACTION_INVALID_SOURCE_TYPE');
    });
  });

  // ─── §8.1F Degraded posture ────────────────────────────────

  describe('GET /workflow/kpi/:kpiId/health — degraded posture', () => {
    it('returns nominal for healthy KPI', async () => {
      mockDbGet
        .mockResolvedValueOnce({
          id: KPI_ID,
          latest_value: 80,
          target_value: 100,
          updated_at: new Date().toISOString(),
        })
        .mockResolvedValueOnce(null);

      const res = await request(app).get(`/api/v8/results/workflow/kpi/${KPI_ID}/health`);
      expect(res.status).toBe(200);
      expect(res.body.data.posture).toBe('nominal');
    });

    it('returns missing_data when values are null', async () => {
      mockDbGet
        .mockResolvedValueOnce({
          id: KPI_ID,
          latest_value: null,
          target_value: null,
          updated_at: new Date().toISOString(),
        })
        .mockResolvedValueOnce(null);

      const res = await request(app).get(`/api/v8/results/workflow/kpi/${KPI_ID}/health`);
      expect(res.status).toBe(200);
      expect(res.body.data.posture).toBe('missing_data');
      expect(res.body.data.message).toContain('missing');
    });

    it('returns stale_data when >30 days old', async () => {
      const staleDate = new Date(Date.now() - 40 * 86400000).toISOString();
      mockDbGet
        .mockResolvedValueOnce({
          id: KPI_ID,
          latest_value: 50,
          target_value: 100,
          updated_at: staleDate,
        })
        .mockResolvedValueOnce(null);

      const res = await request(app).get(`/api/v8/results/workflow/kpi/${KPI_ID}/health`);
      expect(res.status).toBe(200);
      expect(res.body.data.posture).toBe('stale_data');
    });

    it('returns discrepancy_unresolved when reconciliation is pending', async () => {
      mockDbGet
        .mockResolvedValueOnce({
          id: KPI_ID,
          latest_value: 80,
          target_value: 100,
          updated_at: new Date().toISOString(),
        })
        .mockResolvedValueOnce({ reconciliation_status: 'pending' });

      const res = await request(app).get(`/api/v8/results/workflow/kpi/${KPI_ID}/health`);
      expect(res.status).toBe(200);
      expect(res.body.data.posture).toBe('discrepancy_unresolved');
    });

    it('returns 404 for non-existent KPI', async () => {
      mockDbGet.mockResolvedValueOnce(null);
      const res = await request(app).get('/api/v8/results/workflow/kpi/nope/health');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /workflow/org-health — org-wide health', () => {
    it('returns posture breakdown and degraded count', async () => {
      const now = new Date().toISOString();
      const stale = new Date(Date.now() - 60 * 86400000).toISOString();

      mockDbAll
        .mockResolvedValueOnce([
          { id: 'k1', latest_value: 80, target_value: 100, updated_at: now },
          { id: 'k2', latest_value: null, target_value: null, updated_at: now },
          { id: 'k3', latest_value: 50, target_value: 100, updated_at: stale },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ cnt: 2 }]);

      const res = await request(app).get('/api/v8/results/workflow/org-health');
      expect(res.status).toBe(200);

      const { totalKpis, postureBreakdown, unresolvedSignals, degradedCount } = res.body.data;
      expect(totalKpis).toBe(3);
      expect(postureBreakdown.nominal).toBe(1);
      expect(postureBreakdown.missing_data).toBe(1);
      expect(postureBreakdown.stale_data).toBe(1);
      expect(unresolvedSignals).toBe(2);
      expect(degradedCount).toBe(2);
    });
  });

  // ─── §8.1D Report creation (closed-loop bridge) ─────────────

  describe('POST /workflow/kpi/:kpiId/report — report creation', () => {
    it('creates a report/scorecard from KPI inspection', async () => {
      mockDbGet.mockResolvedValueOnce({
        id: KPI_ID,
        name: 'Revenue Growth',
        latest_value: 65,
        target_value: 100,
        baseline_value: 50,
      });
      mockDbAll.mockResolvedValueOnce([
        { id: 'sig-1', severity: 'RED', deviation_summary: 'Revenue drop' },
      ]);
      mockDbRun.mockResolvedValueOnce({ success: true, changes: 1 });

      const res = await request(app).post(`/api/v8/results/workflow/kpi/${KPI_ID}/report`).send({
        commentary: 'Revenue below target',
        actionPlan: 'Increase outreach',
        reconciliationNeeded: true,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.kpiId).toBe(KPI_ID);
      expect(res.body.data.commentary).toBe('Revenue below target');
      expect(res.body.data.actionPlan).toBe('Increase outreach');
      expect(res.body.data.reconciliationNeeded).toBe(true);
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.signalsSummary).toHaveLength(1);
      expect(res.body.data.snapshot.currentValue).toBe(65);
    });

    it('returns 404 for non-existent KPI', async () => {
      mockDbGet.mockResolvedValueOnce(null);
      const res = await request(app)
        .post('/api/v8/results/workflow/kpi/nonexistent/report')
        .send({ commentary: 'test' });
      expect(res.status).toBe(404);
    });
  });

  // ─── §8.1D E2E workflow: signal → inspect → report → next-action ───

  describe('E2E closed-loop workflow', () => {
    it('signal → inspect → report → next-action creates traceable chain', async () => {
      // Step 1: Get signals
      mockDbAll.mockResolvedValueOnce([
        {
          id: 'sig-e2e',
          kpi_id: KPI_ID,
          severity: 'RED',
          status: 'OPEN',
          deviation_summary: 'Revenue drop',
          detected_at: '2026-03-20',
          created_at: '2026-03-20',
        },
      ]);

      const signalsRes = await request(app).get('/api/v8/results/workflow/signals');
      expect(signalsRes.status).toBe(200);
      const signal = signalsRes.body.data.signals[0];
      expect(signal.signalId).toBe('sig-e2e');

      // Step 2: Inspect the KPI
      mockDbGet.mockResolvedValueOnce({
        id: KPI_ID,
        kpi_id: KPI_ID,
        name: 'Revenue Growth',
        target_value: 100,
        baseline_value: 50,
        latest_value: 65,
        measurement_frequency: 'MONTHLY',
        updated_at: new Date().toISOString(),
        created_at: '2026-01-01',
      });
      mockDbAll
        .mockResolvedValueOnce([
          { value: 65, measured_at: '2026-03-01', period_start: '2026-03-01' },
        ])
        .mockResolvedValueOnce([
          {
            id: 'sig-e2e',
            severity: 'RED',
            status: 'OPEN',
            deviation_summary: 'Revenue drop',
            detected_at: '2026-03-20',
          },
        ]);
      mockDbGet.mockResolvedValueOnce(null);

      const inspectRes = await request(app).get(`/api/v8/results/workflow/kpi/${KPI_ID}/inspect`);
      expect(inspectRes.status).toBe(200);
      expect(inspectRes.body.data.openSignals).toHaveLength(1);
      expect(inspectRes.body.data.workflowHint).toContain('Signal detected');

      // Step 3: Create report/scorecard
      mockDbGet.mockResolvedValueOnce({
        id: KPI_ID,
        name: 'Revenue Growth',
        latest_value: 65,
        target_value: 100,
        baseline_value: 50,
      });
      mockDbAll.mockResolvedValueOnce([
        { id: 'sig-e2e', severity: 'RED', deviation_summary: 'Revenue drop' },
      ]);
      mockDbRun.mockResolvedValueOnce({ success: true, changes: 1 });

      const reportRes = await request(app)
        .post(`/api/v8/results/workflow/kpi/${KPI_ID}/report`)
        .send({
          commentary: 'Revenue below target — corrective action needed',
          actionPlan: 'Increase outreach',
        });
      expect(reportRes.status).toBe(200);
      expect(reportRes.body.data.status).toBe('draft');

      // Step 4: Create next action from report.
      // Handler get sequence: KPI ownership → owned; results_kpi_report_snapshots
      // (org-scoped) → owned report; existing-case collision check → null.
      mockDbGet
        .mockResolvedValueOnce({ id: KPI_ID })
        .mockResolvedValueOnce({ id: reportRes.body.data.reportId })
        .mockResolvedValueOnce(null);
      mockDbRun.mockResolvedValueOnce({ changes: 1 });
      const actionRes = await request(app)
        .post(`/api/v8/results/workflow/kpi/${KPI_ID}/next-action`)
        .send({
          title: 'Investigate and create corrective plan',
          sourceType: 'report',
          sourceRef: reportRes.body.data.reportId,
        });

      expect(actionRes.status).toBe(200);
      expect(actionRes.body.data.sourceType).toBe('report');
      expect(actionRes.body.data.sourceRef).toBe(reportRes.body.data.reportId);
      expect(actionRes.body.data.kpiId).toBe(KPI_ID);
      expect(actionRes.body.data.status).toBe('open');
    });
  });
});

// ─── Unit tests for kpiWorkflowCanon.ts ──────────────────────

import {
  canPerformKpiAction,
  computeKpiHealthPosture,
  KPI_WORKFLOW_DEGRADED_REASONS,
  KPI_WORKFLOW_STATES,
  KPI_WORKFLOW_TRANSITIONS,
  P04_ACCEPTANCE_CHECKLIST,
} from '../../../services/v8/kpiWorkflowCanon.js';

describe('kpiWorkflowCanon — unit tests', () => {
  describe('computeKpiHealthPosture', () => {
    it('returns permission_denied when hasPermission is false', () => {
      expect(
        computeKpiHealthPosture({ currentValue: 10, targetValue: 20, hasPermission: false })
      ).toBe('permission_denied');
    });

    it('returns missing_data when both values are null', () => {
      expect(computeKpiHealthPosture({ currentValue: null, targetValue: null })).toBe(
        'missing_data'
      );
    });

    it('returns stale_data when updatedAt is >30 days ago', () => {
      const old = new Date(Date.now() - 35 * 86400000).toISOString();
      expect(computeKpiHealthPosture({ currentValue: 10, targetValue: 20, updatedAt: old })).toBe(
        'stale_data'
      );
    });

    it('returns linkage_unavailable when finance linked but no reconciliation', () => {
      expect(
        computeKpiHealthPosture({
          currentValue: 10,
          targetValue: 20,
          financeLinked: true,
          reconciliationStatus: null,
        })
      ).toBe('linkage_unavailable');
    });

    it('returns discrepancy_unresolved for disputed reconciliation', () => {
      expect(
        computeKpiHealthPosture({
          currentValue: 10,
          targetValue: 20,
          reconciliationStatus: 'disputed',
        })
      ).toBe('discrepancy_unresolved');
    });

    it('returns nominal for healthy KPI', () => {
      expect(
        computeKpiHealthPosture({
          currentValue: 80,
          targetValue: 100,
          updatedAt: new Date().toISOString(),
        })
      ).toBe('nominal');
    });
  });

  describe('canPerformKpiAction', () => {
    it('kpi_owner can edit definition', () => {
      expect(canPerformKpiAction('kpi_owner', 'edit_definition')).toBe(true);
    });

    it('viewer cannot edit definition', () => {
      expect(canPerformKpiAction('viewer', 'edit_definition')).toBe(false);
    });

    it('finance_owner can manage reconciliation from finance side', () => {
      expect(canPerformKpiAction('finance_owner', 'manage_reconciliation_finance')).toBe(true);
    });

    it('commenter can view and comment but not edit', () => {
      expect(canPerformKpiAction('commenter', 'view')).toBe(true);
      expect(canPerformKpiAction('commenter', 'comment')).toBe(true);
      expect(canPerformKpiAction('commenter', 'edit_targets')).toBe(false);
    });
  });

  describe('KPI_WORKFLOW_TRANSITIONS', () => {
    it('signal_detected can transition to inspecting', () => {
      expect(KPI_WORKFLOW_TRANSITIONS.signal_detected).toContain('inspecting');
    });

    it('resolved is terminal', () => {
      expect(KPI_WORKFLOW_TRANSITIONS.resolved).toHaveLength(0);
    });

    it('report_created can go to reconciling or action_assigned', () => {
      expect(KPI_WORKFLOW_TRANSITIONS.report_created).toEqual(
        expect.arrayContaining(['reconciling', 'action_assigned'])
      );
    });
  });

  describe('P04_ACCEPTANCE_CHECKLIST', () => {
    it('has exactly 21 items', () => {
      expect(P04_ACCEPTANCE_CHECKLIST).toHaveLength(21);
    });

    it('covers all required sections including P04-D/E/F/G/H', () => {
      const sections = new Set(P04_ACCEPTANCE_CHECKLIST.map((c) => c.section));
      expect(sections).toEqual(
        new Set([
          '§8.1A',
          '§8.1B',
          '§8.1C',
          '§8.1D',
          '§8.1E',
          '§8.1F',
          'P04-D',
          'P04-E',
          'P04-F',
          'P04-G',
          'P04-H',
        ])
      );
    });
  });

  describe('KPI_WORKFLOW_STATES', () => {
    it('contains all 6 canonical states', () => {
      expect(KPI_WORKFLOW_STATES).toHaveLength(6);
      expect([...KPI_WORKFLOW_STATES]).toEqual([
        'signal_detected',
        'inspecting',
        'report_created',
        'reconciling',
        'action_assigned',
        'resolved',
      ]);
    });
  });

  describe('KPI_WORKFLOW_DEGRADED_REASONS (unified canon)', () => {
    it('contains all 4 canonical degraded reasons', () => {
      expect(KPI_WORKFLOW_DEGRADED_REASONS).toHaveLength(4);
      expect([...KPI_WORKFLOW_DEGRADED_REASONS]).toEqual([
        'missing_data',
        'discrepancy_unresolved',
        'linkage_unavailable',
        'permission_denied',
      ]);
    });
  });

  describe('canPerformKpiAction — extended matrix', () => {
    it('kpi_owner can delete KPI', () => {
      expect(canPerformKpiAction('kpi_owner', 'delete_kpi')).toBe(true);
    });

    it('viewer cannot delete KPI', () => {
      expect(canPerformKpiAction('viewer', 'delete_kpi')).toBe(false);
    });

    it('kpi_owner can record measurement', () => {
      expect(canPerformKpiAction('kpi_owner', 'record_measurement')).toBe(true);
    });

    it('viewer cannot record measurement', () => {
      expect(canPerformKpiAction('viewer', 'record_measurement')).toBe(false);
    });

    it('finance_owner can create report', () => {
      expect(canPerformKpiAction('finance_owner', 'create_report')).toBe(true);
    });

    it('commenter cannot create report', () => {
      expect(canPerformKpiAction('commenter', 'create_report')).toBe(false);
    });

    it('kpi_owner can manage deviation', () => {
      expect(canPerformKpiAction('kpi_owner', 'manage_deviation')).toBe(true);
    });

    it('viewer cannot manage deviation', () => {
      expect(canPerformKpiAction('viewer', 'manage_deviation')).toBe(false);
    });
  });
});
