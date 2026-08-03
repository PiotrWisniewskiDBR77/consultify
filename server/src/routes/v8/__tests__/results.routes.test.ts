import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KpiDefinitionVersionConflictError } from '../../../services/results/kpiDefinitionService.js';
import { V8_RESULTS_READ_CONTRACT, V8_RESULTS_WRITE_CONTRACT } from '../results.routes.js';

const mockGetResultsDashboard = vi.fn();
const mockGetReconciliationOverview = vi.fn();
const mockGetROIPortfolioSummary = vi.fn();
const mockGetROIInitiativeDetail = vi.fn();
const mockGetResultsKpiCatalog = vi.fn();
const mockGetResultsKpiDrawerDetail = vi.fn();
const mockInitiateReconciliation = vi.fn();
const mockResolveReconciliation = vi.fn();
const mockGetKpiSignals = vi.fn();
const mockCreateKpiSignal = vi.fn();
const mockAcknowledgeKpiSignal = vi.fn();
const mockGetKpiNextActions = vi.fn();
const mockCreateKpiNextAction = vi.fn();
const mockCompleteKpiNextAction = vi.fn();
const mockGetKpiWorkflowStatus = vi.fn();
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();
const mockCreateKpiReportSnapshot = vi.fn();
const mockCreateReport = vi.fn();
const mockUpdateSectionContent = vi.fn();
const mockUpdateReportStatus = vi.fn();
const mockHandleTimeSeriesRecorded = vi.fn();
const mockCreateKpiDefinition = vi.fn();
const mockUpdateKpiDefinition = vi.fn();
const mockArchiveKpiDefinition = vi.fn();
const mockGetCurrentKpiDefinition = vi.fn();
const mockGetCurrentDefinitionVersionId = vi.fn();

vi.mock('../../../services/v8/resultsROIService.js', () => ({
  getResultsDashboard: (...args: unknown[]) => mockGetResultsDashboard(...args),
  getReconciliationOverview: (...args: unknown[]) => mockGetReconciliationOverview(...args),
  getResultsKpiCatalog: (...args: unknown[]) => mockGetResultsKpiCatalog(...args),
  getResultsKpiDrawerDetail: (...args: unknown[]) => mockGetResultsKpiDrawerDetail(...args),
  getROIPortfolioSummary: (...args: unknown[]) => mockGetROIPortfolioSummary(...args),
  getROIInitiativeDetail: (...args: unknown[]) => mockGetROIInitiativeDetail(...args),
  initiateReconciliation: (...args: unknown[]) => mockInitiateReconciliation(...args),
  resolveReconciliation: (...args: unknown[]) => mockResolveReconciliation(...args),
  getKpiSignals: (...args: unknown[]) => mockGetKpiSignals(...args),
  createKpiSignal: (...args: unknown[]) => mockCreateKpiSignal(...args),
  acknowledgeKpiSignal: (...args: unknown[]) => mockAcknowledgeKpiSignal(...args),
  getKpiNextActions: (...args: unknown[]) => mockGetKpiNextActions(...args),
  createKpiNextAction: (...args: unknown[]) => mockCreateKpiNextAction(...args),
  completeKpiNextAction: (...args: unknown[]) => mockCompleteKpiNextAction(...args),
  getKpiWorkflowStatus: (...args: unknown[]) => mockGetKpiWorkflowStatus(...args),
}));

vi.mock('../../../services/results/kpiReportSnapshotService.js', () => ({
  createKpiReportSnapshot: (...args: unknown[]) => mockCreateKpiReportSnapshot(...args),
}));

vi.mock('../../../services/results/kpiDeviationService.js', () => ({
  handleTimeSeriesRecorded: (...args: unknown[]) => mockHandleTimeSeriesRecorded(...args),
}));

// RES-02: kpiDefinitionService is the canonical writer the route now
// delegates to for create/update/delete — mock the module boundary (same
// pattern as resultsROIService above) rather than asserting on raw SQL that
// no longer runs in THIS file. Error classes are kept REAL (importActual) so
// the route's `instanceof` checks against thrown errors still work.
vi.mock('../../../services/results/kpiDefinitionService.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../services/results/kpiDefinitionService.js')
  >('../../../services/results/kpiDefinitionService.js');
  return {
    ...actual,
    createDefinition: (...args: unknown[]) => mockCreateKpiDefinition(...args),
    updateDefinition: (...args: unknown[]) => mockUpdateKpiDefinition(...args),
    archiveDefinition: (...args: unknown[]) => mockArchiveKpiDefinition(...args),
    getCurrentDefinition: (...args: unknown[]) => mockGetCurrentKpiDefinition(...args),
    getCurrentDefinitionVersionId: (...args: unknown[]) =>
      mockGetCurrentDefinitionVersionId(...args),
  };
});

vi.mock('../../../services/reportBuilderService.js', () => ({
  createReport: (...args: unknown[]) => mockCreateReport(...args),
  updateSectionContent: (...args: unknown[]) => mockUpdateSectionContent(...args),
  updateReportStatus: (...args: unknown[]) => mockUpdateReportStatus(...args),
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

let mockUser: {
  id: string;
  role: string;
  organizationId: string;
  isSuperAdmin: boolean;
} | null = null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: () => void) => {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    next();
  },
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
const UID = 'user-results-v8';
/** Valid UUID for InitiateReconciliationParamsSchema.kpiId */
const KPI_UUID = '11111111-1111-4111-8111-111111111111';

describe('V8 results read-only routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    mockGetResultsDashboard.mockResolvedValue({
      organizationId: ORG,
      kpiScorecard: {
        organizationId: ORG,
        totalKpis: 0,
        byStatus: {},
        byCategory: {},
        averageTargetAchievementRate: null,
      },
      activeDeviationsCount: 0,
      roiDashboard: {
        organizationId: ORG,
        totalEntries: 0,
        totalRealized: 0,
        projectedFromKpiTargets: 0,
        overallRealizationRate: null,
        byInitiative: [],
      },
      reconciliationHealth: {
        organizationId: ORG,
        total: 0,
        byStatus: {},
        unresolvedCount: 0,
        averageResolutionHours: null,
      },
      recentReviewPacks: [],
    });
    mockGetReconciliationOverview.mockResolvedValue({
      organizationId: ORG,
      initiativeId: null,
      items: [
        {
          reconciliationId: 'rec-1',
          kpiId: KPI_UUID,
          kpiName: 'Annual Savings',
          initiativeId: 'init-1',
          financeRef: `finance:${KPI_UUID}`,
          reconciliationStatus: 'disputed',
          initiatedBy: 'finance',
          projectedValue: 100000,
          realizedValue: 80000,
          varianceAbsolute: -20000,
          variancePercent: -20,
          hasMismatch: true,
          createdAt: '2026-03-31T00:00:00.000Z',
          updatedAt: '2026-03-31T01:00:00.000Z',
        },
      ],
      summary: { total: 1, byStatus: { disputed: 1 }, mismatchCount: 1, unresolvedCount: 1 },
    });
    mockGetROIPortfolioSummary.mockResolvedValue({
      organizationId: ORG,
      items: [],
      summary: {
        totalProjected: 0,
        totalRealized: 0,
        totalCapex: 0,
        totalVariance: 0,
        initiativeCount: 0,
        coveragePercent: 0,
      },
    });
    mockGetResultsKpiCatalog.mockResolvedValue({
      organizationId: ORG,
      kpis: [],
      mappings: [],
    });
    mockGetROIInitiativeDetail.mockResolvedValue({
      organizationId: ORG,
      initiativeId: 'init-1',
      variance: { hasAssumptions: false, variance: null },
      assumptions: null,
      realized: [],
    });
    mockGetResultsKpiDrawerDetail.mockResolvedValue({
      organizationId: ORG,
      kpiId: 'kpi-1',
      measurements: [],
      openCase: null,
    });
    mockCreateKpiReportSnapshot.mockResolvedValue({
      snapshotId: 'snap-1',
      snapshot: {
        title: 'Monthly KPI Review',
        periodStart: '2026-02-01',
        periodEnd: '2026-02-28',
      },
      markdown: {
        executive_summary: 'summary',
        kpi_overview: 'overview',
        deviation_cases: 'cases',
        action_plan: 'plan',
        appendix: 'appendix',
      },
    });
    mockCreateReport.mockResolvedValue({ report: { id: 'report-1' } });
    mockUpdateSectionContent.mockResolvedValue(undefined);
    mockUpdateReportStatus.mockResolvedValue(undefined);
    mockHandleTimeSeriesRecorded.mockResolvedValue({ eval: { status: 'GREEN', severity: null } });
    mockInitiateReconciliation.mockResolvedValue({
      reconciliationId: 'rec-1',
      organizationId: ORG,
      kpiId: KPI_UUID,
      financeRef: `finance:${KPI_UUID}`,
      reconciliationStatus: 'pending',
      initiatedBy: 'results',
      createdAt: '2026-03-31T00:00:00.000Z',
      updatedAt: '2026-03-31T00:00:00.000Z',
    });
    mockResolveReconciliation.mockResolvedValue({
      reconciliationId: 'rec-1',
      organizationId: ORG,
      kpiId: KPI_UUID,
      financeRef: `finance:${KPI_UUID}`,
      reconciliationStatus: 'reconciled',
      initiatedBy: 'results',
      createdAt: '2026-03-31T00:00:00.000Z',
      updatedAt: '2026-03-31T00:00:01.000Z',
    });
    mockGetKpiSignals.mockResolvedValue([]);
    mockCreateKpiSignal.mockResolvedValue({
      signalId: 'sig-1',
      organizationId: ORG,
      kpiId: KPI_UUID,
      signalType: 'deviation',
      severity: 'medium',
      description: 'test',
      evidencePointers: [],
      nextActionStatus: 'pending',
      nextActionRef: null,
      acknowledgedBy: null,
      acknowledgedAt: null,
      createdAt: '2026-03-31T00:00:00.000Z',
    });
    mockAcknowledgeKpiSignal.mockResolvedValue({
      signalId: 'sig-1',
      organizationId: ORG,
      kpiId: KPI_UUID,
      signalType: 'deviation',
      severity: 'medium',
      description: 'test',
      evidencePointers: [],
      nextActionStatus: 'acknowledged',
      nextActionRef: null,
      acknowledgedBy: UID,
      acknowledgedAt: '2026-03-31T00:00:00.000Z',
      createdAt: '2026-03-31T00:00:00.000Z',
    });
    mockGetKpiNextActions.mockResolvedValue([]);
    mockCreateKpiNextAction.mockResolvedValue({
      actionId: 'act-1',
      organizationId: ORG,
      signalId: 'sig-1',
      kpiId: KPI_UUID,
      actionType: 'reconcile',
      description: 'Reconcile',
      assignedTo: null,
      status: 'open',
      financeConsequenceRef: 'fin:1',
      executionFollowUpRef: null,
      createdBy: UID,
      createdAt: '2026-03-31T00:00:00.000Z',
      completedAt: null,
    });
    mockCompleteKpiNextAction.mockResolvedValue(undefined);
    mockGetKpiWorkflowStatus.mockResolvedValue({
      kpiId: KPI_UUID,
      organizationId: ORG,
      workflowState: 'ready',
      degradedReasons: [],
      openSignals: 0,
      pendingActions: 0,
      reconciliationHealth: {
        organizationId: ORG,
        total: 0,
        byStatus: { pending: 0, reconciled: 0, disputed: 0, escalated: 0 },
        unresolvedCount: 0,
        averageResolutionHours: null,
      },
    });
    // Default: parent lookups (KPI / signal ownership prechecks added in the wave-6
    // follow-up) resolve to an owned row, and the measurement_frequency lookup still
    // returns MONTHLY. `id` satisfies the COALESCE org-ownership SELECTs.
    mockDbGet.mockResolvedValue({ id: 'kpi-1', measurement_frequency: 'MONTHLY' });
    mockDbAll.mockResolvedValue([{ name: 'current_value' }]);
    mockDbRun.mockResolvedValue({ changes: 1 });
  });

  it('GET /api/v8/results/dashboard returns envelope and delegates to getResultsDashboard', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/results/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_READ_CONTRACT);
    expect(res.body.data?.snapshot?.organizationId).toBe(ORG);
    expect(mockGetResultsDashboard).toHaveBeenCalledWith(ORG, { initiativeId: undefined });
  });

  it('GET /api/v8/results/dashboard forwards initiativeId scope when provided', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'init-1' });
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/results/dashboard')
      .query({ initiativeId: 'init-1' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_READ_CONTRACT);
    expect(mockDbGet).toHaveBeenCalledWith(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      ['init-1', ORG],
      { fallback: true }
    );
    expect(mockGetResultsDashboard).toHaveBeenCalledWith(ORG, { initiativeId: 'init-1' });
  });

  it('GET /api/v8/results/dashboard returns 404 for invalid initiativeId scope', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/results/dashboard')
      .query({ initiativeId: 'missing-init' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INITIATIVE_NOT_FOUND');
    expect(mockGetResultsDashboard).not.toHaveBeenCalled();
  });

  it('GET /api/v8/results/dashboard returns 500 with code when getResultsDashboard rejects', async () => {
    mockGetResultsDashboard.mockRejectedValueOnce(new Error('dashboard down'));
    const app = createApp();
    const res = await request(app).get('/api/v8/results/dashboard');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('RESULTS_DASHBOARD_READ_FAILED');
    expect(res.body.error).toBe('Failed to load results dashboard');
  });

  it('GET /api/v8/results/reconciliations returns envelope and delegates to getReconciliationOverview (M16→M15)', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/results/reconciliations');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_READ_CONTRACT);
    expect(res.body.data?.organizationId).toBe(ORG);
    expect(res.body.data?.items?.[0]?.varianceAbsolute).toBe(-20000);
    expect(res.body.data?.summary?.mismatchCount).toBe(1);
    expect(mockGetReconciliationOverview).toHaveBeenCalledWith(ORG, {
      initiativeId: undefined,
      kpiId: undefined,
    });
  });

  it('GET /api/v8/results/reconciliations forwards initiativeId + kpiId scope when provided', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'init-1' });
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/results/reconciliations')
      .query({ initiativeId: 'init-1', kpiId: KPI_UUID });

    expect(res.status).toBe(200);
    expect(mockGetReconciliationOverview).toHaveBeenCalledWith(ORG, {
      initiativeId: 'init-1',
      kpiId: KPI_UUID,
    });
  });

  it('GET /api/v8/results/reconciliations returns 404 for invalid initiativeId scope (no cross-org leak)', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/results/reconciliations')
      .query({ initiativeId: 'missing-init' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INITIATIVE_NOT_FOUND');
    expect(mockGetReconciliationOverview).not.toHaveBeenCalled();
  });

  it('GET /api/v8/results/reconciliations returns 500 with code when service rejects', async () => {
    mockGetReconciliationOverview.mockRejectedValueOnce(new Error('recon down'));
    const app = createApp();
    const res = await request(app).get('/api/v8/results/reconciliations');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('RESULTS_RECONCILIATION_READ_FAILED');
  });

  it('GET /api/v8/results/roi/portfolio-summary returns envelope and delegates to getROIPortfolioSummary', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/results/roi/portfolio-summary');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_READ_CONTRACT);
    expect(res.body.data?.organizationId).toBe(ORG);
    expect(mockGetROIPortfolioSummary).toHaveBeenCalledWith(ORG, undefined);
  });

  it('GET /api/v8/results/roi/portfolio-summary forwards initiativeId scope when provided', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'init-1' });
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/results/roi/portfolio-summary')
      .query({ initiativeId: 'init-1' });

    expect(res.status).toBe(200);
    expect(mockDbGet).toHaveBeenCalledWith(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      ['init-1', ORG],
      { fallback: true }
    );
    expect(mockGetROIPortfolioSummary).toHaveBeenCalledWith(ORG, { initiativeId: 'init-1' });
  });

  it('GET /api/v8/results/roi/portfolio-summary returns 404 for invalid initiative scope', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/results/roi/portfolio-summary')
      .query({ initiativeId: 'missing-init' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INITIATIVE_NOT_FOUND');
    expect(mockGetROIPortfolioSummary).not.toHaveBeenCalled();
  });

  it('GET /api/v8/results/roi/portfolio-summary returns 500 with code when portfolio service rejects', async () => {
    mockGetROIPortfolioSummary.mockRejectedValueOnce(new Error('portfolio down'));
    const app = createApp();
    const res = await request(app).get('/api/v8/results/roi/portfolio-summary');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('RESULTS_ROI_PORTFOLIO_READ_FAILED');
    expect(res.body.error).toBe('Failed to load ROI portfolio summary');
  });

  it('GET /api/v8/results/kpis/catalog returns envelope and delegates to getResultsKpiCatalog', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/results/kpis/catalog').query({ kpiId: 'kpi-1' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_READ_CONTRACT);
    expect(res.body.data?.organizationId).toBe(ORG);
    expect(mockGetResultsKpiCatalog).toHaveBeenCalledWith(ORG, {
      kpiId: 'kpi-1',
      initiativeId: undefined,
    });
  });

  it('GET /api/v8/results/kpis/catalog forwards initiative scope', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'init-1' });
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/results/kpis/catalog')
      .query({ initiativeId: 'init-1' });

    expect(res.status).toBe(200);
    expect(mockDbGet).toHaveBeenCalledWith(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      ['init-1', ORG],
      { fallback: true }
    );
    expect(mockGetResultsKpiCatalog).toHaveBeenCalledWith(ORG, {
      kpiId: undefined,
      initiativeId: 'init-1',
    });
  });

  it('GET /api/v8/results/kpis/catalog normalizes missing arrays in response data', async () => {
    mockGetResultsKpiCatalog.mockResolvedValueOnce({
      organizationId: ORG,
      kpis: undefined,
    } as any);
    const app = createApp();
    const res = await request(app).get('/api/v8/results/kpis/catalog');

    expect(res.status).toBe(200);
    expect(res.body.data?.organizationId).toBe(ORG);
    expect(res.body.data?.initiatives).toEqual([]);
    expect(res.body.data?.kpis).toEqual([]);
    expect(res.body.data?.mappings).toEqual([]);
  });

  it('GET /api/v8/results/kpis/catalog coerces non-array catalog collections to empty arrays', async () => {
    mockGetResultsKpiCatalog.mockResolvedValueOnce({
      organizationId: ORG,
      initiatives: {} as any,
      kpis: 'invalid' as any,
      mappings: 42 as any,
    });
    const app = createApp();
    const res = await request(app).get('/api/v8/results/kpis/catalog');

    expect(res.status).toBe(200);
    expect(res.body.data?.organizationId).toBe(ORG);
    expect(res.body.data?.initiatives).toEqual([]);
    expect(res.body.data?.kpis).toEqual([]);
    expect(res.body.data?.mappings).toEqual([]);
  });

  it('GET /api/v8/results/kpis/catalog returns 500 with code when catalog service rejects', async () => {
    mockGetResultsKpiCatalog.mockRejectedValueOnce(new Error('catalog down'));
    const app = createApp();
    const res = await request(app).get('/api/v8/results/kpis/catalog');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('RESULTS_CATALOG_READ_FAILED');
    expect(res.body.error).toBe('Failed to load KPI catalog');
  });

  it('GET /api/v8/results/kpis/catalog returns 404 for invalid initiative scope', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/results/kpis/catalog')
      .query({ initiativeId: 'missing-init' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INITIATIVE_NOT_FOUND');
    expect(mockGetResultsKpiCatalog).not.toHaveBeenCalled();
  });

  it('GET /api/v8/results/roi/initiative/:initiativeId/detail returns envelope and delegates to getROIInitiativeDetail', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'init-1' });
    const app = createApp();
    const res = await request(app).get('/api/v8/results/roi/initiative/init-1/detail');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_READ_CONTRACT);
    expect(res.body.data?.initiativeId).toBe('init-1');
    expect(mockDbGet).toHaveBeenCalledWith(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      ['init-1', ORG],
      { fallback: true }
    );
    expect(mockGetROIInitiativeDetail).toHaveBeenCalledWith('init-1', ORG);
  });

  it('GET /api/v8/results/roi/initiative/:initiativeId/detail returns 404 for invalid initiative scope', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app).get('/api/v8/results/roi/initiative/missing-init/detail');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INITIATIVE_NOT_FOUND');
    expect(mockGetROIInitiativeDetail).not.toHaveBeenCalled();
  });

  it('GET /api/v8/results/kpis/:kpiId/drawer-detail returns envelope and delegates to getResultsKpiDrawerDetail', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/results/kpis/kpi-1/drawer-detail');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_READ_CONTRACT);
    expect(res.body.data?.kpiId).toBe('kpi-1');
    expect(mockGetResultsKpiDrawerDetail).toHaveBeenCalledWith('kpi-1', ORG, {
      initiativeId: undefined,
    });
  });

  it('GET /api/v8/results/kpis/:kpiId/drawer-detail forwards initiative scope', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'init-1' });
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/results/kpis/kpi-1/drawer-detail')
      .query({ initiativeId: 'init-1' });

    expect(res.status).toBe(200);
    expect(mockDbGet).toHaveBeenCalledWith(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      ['init-1', ORG],
      { fallback: true }
    );
    expect(mockGetResultsKpiDrawerDetail).toHaveBeenCalledWith('kpi-1', ORG, {
      initiativeId: 'init-1',
    });
  });

  it('GET /api/v8/results/kpis/:kpiId/drawer-detail returns 404 for invalid initiative scope', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/results/kpis/kpi-1/drawer-detail')
      .query({ initiativeId: 'missing-init' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INITIATIVE_NOT_FOUND');
    expect(mockGetResultsKpiDrawerDetail).not.toHaveBeenCalled();
  });

  it('GET /api/v8/results/kpis/:kpiId/drawer-detail returns 404 when KPI is outside initiative scope', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'init-1' });
    mockGetResultsKpiDrawerDetail.mockRejectedValueOnce(new Error('RESULTS_KPI_NOT_FOUND'));
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/results/kpis/kpi-1/drawer-detail')
      .query({ initiativeId: 'init-1' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESULTS_KPI_NOT_FOUND');
  });

  it('GET /api/v8/results/kpis/:kpiId/drawer-detail returns 500 with code on unexpected drawer failure', async () => {
    mockGetResultsKpiDrawerDetail.mockRejectedValueOnce(new Error('drawer down'));
    const app = createApp();
    const res = await request(app).get('/api/v8/results/kpis/kpi-1/drawer-detail');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('RESULTS_KPI_DRAWER_READ_FAILED');
    expect(res.body.error).toBe('Failed to load KPI drawer detail');
  });

  // RES-02: create/update/delete now delegate to kpiDefinitionService (the
  // canonical, CAS-versioned writer) instead of running inline SQL in this
  // router — these assert on that delegation, not on raw SQL text that no
  // longer runs here.
  it('POST /api/v8/results/kpis creates a KPI in the governed V8 namespace', async () => {
    mockCreateKpiDefinition.mockResolvedValueOnce({ id: 'new-kpi-1' });

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/results/kpis')
      .set('x-kpi-role', 'kpi_owner')
      .send({
        name: 'Revenue Growth',
        targetValue: 100,
        measurementFrequency: 'MONTHLY',
        direction: 'HIGHER_IS_BETTER',
      });

    expect(res.status).toBe(201);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data?.id).toBe('new-kpi-1');
    expect(mockCreateKpiDefinition).toHaveBeenCalledTimes(1);
    expect(mockCreateKpiDefinition.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        organizationId: ORG,
        name: 'Revenue Growth',
        targetValue: 100,
        measurementFrequency: 'MONTHLY',
        direction: 'HIGHER_IS_BETTER',
      })
    );
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('PUT /api/v8/results/kpis/:kpiId saves governed KPI settings', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'kpi-1' });
    mockGetCurrentKpiDefinition.mockResolvedValueOnce({ id: 'kpi-1', currentDefinitionVersion: 1 });
    mockUpdateKpiDefinition.mockResolvedValueOnce({ id: 'kpi-1', currentDefinitionVersion: 2 });

    const app = createApp();
    const res = await request(app)
      .put('/api/v8/results/kpis/kpi-1')
      .set('x-kpi-role', 'kpi_owner')
      .send({
        name: 'KPI Alpha Updated',
        description: 'Updated description',
        unit: '%',
        baselineValue: 10,
        targetValue: 20,
        measurementFrequency: 'MONTHLY',
        direction: 'HIGHER_IS_BETTER',
        thresholdMode: 'PERCENT_FROM_TARGET',
        amberThresholdPct: 5,
        redThresholdPct: 10,
      });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockDbGet).toHaveBeenCalledWith(expect.stringContaining('SELECT k.id'), ['kpi-1', ORG]);
    expect(mockUpdateKpiDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        kpiId: 'kpi-1',
        expectedVersion: 1,
        name: 'KPI Alpha Updated',
        description: 'Updated description',
        unit: '%',
        baselineValue: 10,
        targetValue: 20,
        measurementFrequency: 'MONTHLY',
        direction: 'HIGHER_IS_BETTER',
        thresholdMode: 'PERCENT_FROM_TARGET',
        amberThresholdPct: 5,
        redThresholdPct: 10,
      })
    );
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('PUT /api/v8/results/kpis/:kpiId returns 409 on a stale expectedVersion (CAS conflict)', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'kpi-1' });
    mockGetCurrentKpiDefinition.mockResolvedValueOnce({ id: 'kpi-1', currentDefinitionVersion: 3 });
    mockUpdateKpiDefinition.mockRejectedValueOnce(
      new KpiDefinitionVersionConflictError('kpi-1', 3, 4)
    );

    const app = createApp();
    const res = await request(app)
      .put('/api/v8/results/kpis/kpi-1')
      .set('x-kpi-role', 'kpi_owner')
      .send({ name: 'Racing Update' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('RESULTS_KPI_VERSION_CONFLICT');
  });

  it('DELETE /api/v8/results/kpis/:kpiId removes a governed KPI with bounded cleanup', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'kpi-1' });
    mockArchiveKpiDefinition.mockResolvedValueOnce({
      id: 'kpi-1',
      archivedAt: '2026-08-02T00:00:00.000Z',
      alreadyArchived: false,
    });

    const app = createApp();
    const res = await request(app)
      .delete('/api/v8/results/kpis/kpi-1')
      .set('x-kpi-role', 'kpi_owner');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockDbGet).toHaveBeenCalledWith(expect.stringContaining('SELECT k.id'), ['kpi-1', ORG]);
    expect(mockDbRun).toHaveBeenCalledWith(
      'DELETE FROM initiative_kpi_mappings WHERE kpi_id = ? AND organization_id = ?',
      ['kpi-1', ORG]
    );
    // RES-02: delete = archive — no hard DELETE against initiative_kpis,
    // kpi_time_series, or kpi_deviation_cases anymore; history is preserved.
    expect(mockArchiveKpiDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, kpiId: 'kpi-1' })
    );
    expect(mockDbRun).not.toHaveBeenCalledWith(
      'DELETE FROM initiative_kpis WHERE id = ?',
      expect.anything()
    );
  });

  it('POST /api/v8/results/kpi-mappings creates a governed KPI mapping', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'init-1' }).mockResolvedValueOnce({ id: 'kpi-1' });
    const app = createApp();
    const res = await request(app).post('/api/v8/results/kpi-mappings').send({
      initiativeId: 'init-1',
      kpiId: 'kpi-1',
      impactDirection: 'increase',
      confidence: 'medium',
      notes: 'Linked from Results KPI create',
    });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        initiativeId: 'init-1',
        kpiId: 'kpi-1',
      })
    );
    expect(mockDbRun).toHaveBeenCalledTimes(1);
    expect(String(mockDbRun.mock.calls[0]?.[0] || '')).toContain(
      'INSERT INTO initiative_kpi_mappings'
    );
    expect(mockDbRun.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining(['init-1', 'kpi-1', ORG, 'increase', 'medium', UID])
    );
  });

  it('POST /api/v8/results/kpi-mappings returns 404 when initiative is outside org scope', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app).post('/api/v8/results/kpi-mappings').send({
      initiativeId: 'init-missing',
      kpiId: 'kpi-1',
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INITIATIVE_NOT_FOUND');
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('POST /api/v8/results/kpi-mappings returns 404 when KPI is outside org scope', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'init-1' }).mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app).post('/api/v8/results/kpi-mappings').send({
      initiativeId: 'init-1',
      kpiId: 'kpi-missing',
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESULTS_KPI_NOT_FOUND');
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('DELETE /api/v8/results/kpi-mappings/:mappingId removes a governed KPI mapping', async () => {
    const app = createApp();
    const res = await request(app).delete('/api/v8/results/kpi-mappings/map-1');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM initiative_kpi_mappings'),
      ['map-1', ORG]
    );
  });

  it('POST /api/v8/results/deviation-cases/:caseId/acknowledge acknowledges a governed deviation case', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'case-1' });

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/results/deviation-cases/case-1/acknowledge')
      .set('x-kpi-role', 'kpi_owner')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockDbGet).toHaveBeenCalledWith(expect.stringContaining('FROM kpi_deviation_cases'), [
      'case-1',
      ORG,
    ]);
    expect(mockDbRun).toHaveBeenCalledWith(expect.stringContaining("SET status = 'ACKNOWLEDGED'"), [
      'case-1',
      ORG,
    ]);
  });

  it('PUT /api/v8/results/deviation-cases/:caseId/rca saves governed deviation RCA', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'case-1' });

    const app = createApp();
    const res = await request(app)
      .put('/api/v8/results/deviation-cases/case-1/rca')
      .set('x-kpi-role', 'kpi_owner')
      .send({
        rcaText: 'Root cause analysis details',
      });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockDbGet).toHaveBeenCalledWith(expect.stringContaining('FROM kpi_deviation_cases'), [
      'case-1',
      ORG,
    ]);
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining(
        "SET rca_text = ?, status = CASE WHEN status = 'OPEN' THEN 'IN_PROGRESS' ELSE status END"
      ),
      ['Root cause analysis details', 'case-1', ORG]
    );
  });

  it('POST /api/v8/results/deviation-cases/:caseId/actions creates a governed deviation action', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'case-1' });

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/results/deviation-cases/case-1/actions')
      .set('x-kpi-role', 'kpi_owner')
      .send({
        title: 'Create mitigation plan',
        dueDate: '2026-03-31',
      });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data?.id).toEqual(expect.any(String));
    expect(res.body.data?.caseId).toBe('case-1');
    expect(mockDbGet).toHaveBeenCalledWith(expect.stringContaining('FROM kpi_deviation_cases'), [
      'case-1',
      ORG,
    ]);
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO kpi_deviation_actions'),
      [expect.any(String), 'case-1', 'Create mitigation plan', null, '2026-03-31']
    );
  });

  it('PUT /api/v8/results/deviation-cases/:caseId/actions/:actionId updates a governed deviation action', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'action-1' });

    const app = createApp();
    const res = await request(app)
      .put('/api/v8/results/deviation-cases/case-1/actions/action-1')
      .set('x-kpi-role', 'kpi_owner')
      .send({
        status: 'DONE',
      });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockDbGet).toHaveBeenCalledWith(expect.stringContaining('SELECT a.id'), [
      'action-1',
      'case-1',
      ORG,
    ]);
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE kpi_deviation_actions a'),
      [null, null, null, 'DONE', 'action-1', 'case-1', ORG]
    );
  });

  it('POST /api/v8/results/deviation-cases/:caseId/resolve resolves a governed deviation case', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'case-1' });

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/results/deviation-cases/case-1/resolve')
      .set('x-kpi-role', 'kpi_owner')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockDbGet).toHaveBeenCalledWith(expect.stringContaining('FROM kpi_deviation_cases'), [
      'case-1',
      ORG,
    ]);
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP"),
      ['case-1', ORG]
    );
  });

  it('POST /api/v8/results/deviation-cases/:caseId/close closes a governed deviation case', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'case-1' });

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/results/deviation-cases/case-1/close')
      .set('x-kpi-role', 'kpi_owner')
      .send({
        evidenceText: 'Verified mitigation in review pack',
        resolutionNotes: 'Closed after governance review',
      });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockDbGet).toHaveBeenCalledWith(expect.stringContaining('FROM kpi_deviation_cases'), [
      'case-1',
      ORG,
    ]);
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP"),
      [
        'Verified mitigation in review pack',
        null,
        UID,
        'Closed after governance review',
        null,
        null,
        'case-1',
        ORG,
      ]
    );
  });

  it('POST /api/v8/results/deviation-cases/:caseId/close returns 404 when linked initiative is outside org scope', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'case-1' }).mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/results/deviation-cases/case-1/close')
      .set('x-kpi-role', 'kpi_owner')
      .send({
        evidenceText: 'Verified mitigation in review pack',
        linkedInitiativeId: 'missing-init',
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INITIATIVE_NOT_FOUND');
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('POST /api/v8/results/kpi-reports creates a governed KPI report builder draft', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/results/kpi-reports')
      .set('x-kpi-role', 'kpi_owner')
      .send({
        periodStart: '2026-02-01',
        periodEnd: '2026-02-28',
        title: 'Monthly KPI Review',
        kpiIds: ['kpi-1'],
      });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data).toEqual({
      snapshotId: 'snap-1',
      reportId: 'report-1',
    });
    expect(mockCreateKpiReportSnapshot).toHaveBeenCalledWith({
      organizationId: ORG,
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      title: 'Monthly KPI Review',
      createdBy: UID,
      filters: null,
      kpiIds: ['kpi-1'],
    });
    expect(mockCreateReport).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        sourceType: 'RESULTS_KPI_REPORT',
        sourceId: 'snap-1',
        title: 'Monthly KPI Review',
        createdBy: UID,
      })
    );
    expect(mockUpdateSectionContent).toHaveBeenCalledTimes(5);
    expect(mockUpdateReportStatus).toHaveBeenCalledWith('report-1', 'GENERATED', UID);
  });

  it('POST /api/v8/results/kpis/:kpiId/time-series records governed KPI measurement', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/results/kpis/kpi-1/time-series')
      .set('x-kpi-role', 'kpi_owner')
      .send({
        value: 24,
        periodStart: '2026-03-01',
        notes: 'March value',
      });

    expect(res.status).toBe(201);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        kpiId: 'kpi-1',
        value: 24,
        measuredAt: '2026-03-01',
        periodStart: '2026-03-01',
        periodKey: '2026-03',
      })
    );
    // RES-003: the writer's ownership precheck fetches id + measurement_frequency
    // in one merged query (replacing this route's separate, now-removed
    // frequency-only SELECT — see kpiMeasurementWriterService.ts).
    expect(mockDbGet).toHaveBeenCalledWith(
      expect.stringContaining('SELECT k.id, k.measurement_frequency'),
      ['kpi-1', ORG]
    );
    // RES-003: the upsert needs its RETURNING clause (id, was_new_row), so the
    // writer issues it via dbGet, not dbRun — dbRun in this codebase's DbPromise
    // wrapper doesn't surface returned rows.
    expect(mockDbGet).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO kpi_time_series'),
      expect.arrayContaining(['kpi-1', ORG, 24, '2026-03-01', 'manual', 'March value', UID])
    );
    expect(mockHandleTimeSeriesRecorded).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: ORG,
        kpiId: 'kpi-1',
        value: 24,
        periodStart: '2026-03-01',
        recordedByUserId: UID,
      })
    );
  });

  it('POST /api/v8/results/kpis/:kpiId/time-series returns 404 when KPI is outside org scope', async () => {
    // First dbGet is the SEC-3 ownership precheck (SELECT k.id ... COALESCE org). A
    // foreign-org kpiId resolves to null there and must 404 before any INSERT runs.
    mockDbGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/results/kpis/kpi-foreign/time-series')
      .set('x-kpi-role', 'kpi_owner')
      .send({
        value: 24,
        periodStart: '2026-03-01',
        notes: 'March value',
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESULTS_KPI_NOT_FOUND');
    expect(mockDbGet).toHaveBeenCalledWith(expect.stringContaining('SELECT k.id'), [
      'kpi-foreign',
      ORG,
    ]);
    expect(mockDbRun).not.toHaveBeenCalled();
    expect(mockHandleTimeSeriesRecorded).not.toHaveBeenCalled();
  });

  it('PUT /api/v8/results/roi/initiative/:initiativeId/assumptions saves governed ROI assumptions', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'init-1' });
    const app = createApp();
    const res = await request(app).put('/api/v8/results/roi/initiative/init-1/assumptions').send({
      expectedRevenueDelta: 200,
      expectedCostDelta: 100,
      capex: 50,
      opexAnnual: 20,
      horizonMonths: 24,
      confidence: 'medium',
      assumptionsOwner: 'owner-1',
      assumptionsText: 'Updated from drawer',
    });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockDbRun).toHaveBeenCalledTimes(1);
    expect(String(mockDbRun.mock.calls[0]?.[0] || '')).toContain('INSERT INTO roi_assumptions');
    expect(mockDbRun.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining([
        'init-1',
        ORG,
        50,
        20,
        24,
        200,
        100,
        'Updated from drawer',
        'owner-1',
        'medium',
        UID,
      ])
    );
  });

  it('PUT /api/v8/results/roi/initiative/:initiativeId/assumptions returns 404 for invalid initiative scope', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app).put('/api/v8/results/roi/initiative/missing/assumptions').send({
      expectedRevenueDelta: 200,
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INITIATIVE_NOT_FOUND');
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('POST /api/v8/results/roi/initiative/:initiativeId/realized creates governed ROI realized entry', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'init-1' });
    const app = createApp();
    const res = await request(app).post('/api/v8/results/roi/initiative/init-1/realized').send({
      periodMonth: '2026-03-01',
      realizedSavings: 120,
      varianceNotes: 'March realized benefit',
      source: 'manual',
    });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data?.id).toBeTruthy();
    expect(mockDbRun).toHaveBeenCalledTimes(1);
    expect(String(mockDbRun.mock.calls[0]?.[0] || '')).toContain('INSERT INTO roi_realized_values');
    expect(mockDbRun.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining([
        'init-1',
        ORG,
        '2026-03-01',
        120,
        'manual',
        'March realized benefit',
        UID,
      ])
    );
  });

  it('POST /api/v8/results/roi/initiative/:initiativeId/realized returns 404 for invalid initiative scope', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app).post('/api/v8/results/roi/initiative/missing/realized').send({
      periodMonth: '2026-03-01',
      realizedSavings: 120,
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INITIATIVE_NOT_FOUND');
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('POST /api/v8/results/reconciliations returns 400 when kpiId missing', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/results/reconciliations').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('P04_KPI_ID_REQUIRED');
    expect(mockInitiateReconciliation).not.toHaveBeenCalled();
  });

  it('POST /api/v8/results/reconciliations delegates to initiateReconciliation', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/results/reconciliations')
      .set('x-kpi-role', 'kpi_owner')
      .send({ kpiId: KPI_UUID });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data?.reconciliationId).toBe('rec-1');
    expect(mockInitiateReconciliation).toHaveBeenCalledWith({
      organizationId: ORG,
      kpiId: KPI_UUID,
      financeRef: `finance:${KPI_UUID}`,
      initiatedBy: 'results',
    });
  });

  it('PUT /api/v8/results/reconciliations/:id/resolve returns 400 when status missing', async () => {
    const app = createApp();
    const res = await request(app).put('/api/v8/results/reconciliations/rec-1/resolve').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('P04_STATUS_REQUIRED');
    expect(mockResolveReconciliation).not.toHaveBeenCalled();
  });

  it('PUT /api/v8/results/reconciliations/:id/resolve returns 400 when resolvedBy invalid', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/v8/results/reconciliations/rec-1/resolve')
      .set('x-kpi-role', 'finance_owner')
      .send({ status: 'reconciled', resolvedBy: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('P04_RESOLVED_BY_INVALID');
    expect(mockResolveReconciliation).not.toHaveBeenCalled();
  });

  it('PUT /api/v8/results/reconciliations/:id/resolve delegates to resolveReconciliation', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/v8/results/reconciliations/rec-1/resolve')
      .set('x-kpi-role', 'finance_owner')
      .send({ status: 'reconciled' });

    expect(res.status).toBe(200);
    expect(res.body.data?.reconciliationStatus).toBe('reconciled');
    expect(mockResolveReconciliation).toHaveBeenCalledWith('rec-1', ORG, 'reconciled');
  });

  it('GET /api/v8/results/signals delegates to getKpiSignals with query filters', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/results/signals')
      .query({ kpiId: KPI_UUID, status: 'pending', signalType: 'deviation' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_READ_CONTRACT);
    expect(mockGetKpiSignals).toHaveBeenCalledWith(ORG, {
      kpiId: KPI_UUID,
      status: 'pending',
      signalType: 'deviation',
    });
  });

  it('POST /api/v8/results/signals returns 400 when kpiId or signalType missing', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/results/signals').send({ kpiId: KPI_UUID });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('P04_SIGNAL_PARAMS_REQUIRED');
    expect(mockCreateKpiSignal).not.toHaveBeenCalled();
  });

  it('POST /api/v8/results/signals returns 403 when role cannot create_signal', async () => {
    mockUser = { ...mockUser!, role: 'viewer' };
    const app = createApp();
    const res = await request(app).post('/api/v8/results/signals').send({
      kpiId: KPI_UUID,
      signalType: 'data_quality',
      severity: 'high',
      description: 'Gap',
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('P04_PERMISSION_DENIED');
    expect(mockCreateKpiSignal).not.toHaveBeenCalled();
  });

  it('POST /api/v8/results/signals delegates to createKpiSignal', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/results/signals')
      .set('x-kpi-role', 'kpi_owner')
      .send({
        kpiId: KPI_UUID,
        signalType: 'data_quality',
        severity: 'high',
        description: 'Gap',
        evidencePointers: ['ev:1'],
      });

    expect(res.status).toBe(200);
    expect(res.body.data?.signalId).toBe('sig-1');
    expect(mockCreateKpiSignal).toHaveBeenCalledWith({
      organizationId: ORG,
      kpiId: KPI_UUID,
      signalType: 'data_quality',
      severity: 'high',
      description: 'Gap',
      evidencePointers: ['ev:1'],
    });
  });

  it('POST /api/v8/results/signals/:signalId/acknowledge delegates to acknowledgeKpiSignal', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/results/signals/sig-1/acknowledge')
      .set('x-kpi-role', 'commenter')
      .send({ reason: 'reviewed' });

    expect(res.status).toBe(200);
    expect(mockAcknowledgeKpiSignal).toHaveBeenCalledWith('sig-1', ORG, UID, 'reviewed');
  });

  it('GET /api/v8/results/next-actions delegates to getKpiNextActions', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/v8/results/next-actions')
      .query({ kpiId: KPI_UUID, signalId: 'sig-1', status: 'open' });

    expect(res.status).toBe(200);
    expect(mockGetKpiNextActions).toHaveBeenCalledWith(ORG, {
      kpiId: KPI_UUID,
      signalId: 'sig-1',
      status: 'open',
    });
  });

  it('POST /api/v8/results/next-actions delegates to createKpiNextAction with finance refs', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/results/next-actions')
      .set('x-kpi-role', 'kpi_owner')
      .send({
        signalId: 'sig-1',
        kpiId: KPI_UUID,
        actionType: 'reconcile',
        description: 'Align with Finance',
        financeConsequenceRef: 'fin:ledger:1',
        executionFollowUpRef: 'exec:task:2',
      });

    expect(res.status).toBe(200);
    expect(mockCreateKpiNextAction).toHaveBeenCalledWith({
      organizationId: ORG,
      signalId: 'sig-1',
      kpiId: KPI_UUID,
      actionType: 'reconcile',
      description: 'Align with Finance',
      assignedTo: undefined,
      createdBy: UID,
      financeConsequenceRef: 'fin:ledger:1',
      executionFollowUpRef: 'exec:task:2',
    });
  });

  it('POST /api/v8/results/next-actions/:actionId/complete delegates to completeKpiNextAction', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/results/next-actions/act-1/complete')
      .set('x-kpi-role', 'finance_owner')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data?.success).toBe(true);
    expect(mockCompleteKpiNextAction).toHaveBeenCalledWith('act-1', ORG);
  });

  it('GET /api/v8/results/kpis/:kpiId/workflow-status delegates to getKpiWorkflowStatus', async () => {
    const app = createApp();
    const res = await request(app).get(`/api/v8/results/kpis/${KPI_UUID}/workflow-status`);

    expect(res.status).toBe(200);
    expect(res.body.data?.workflowState).toBe('ready');
    expect(mockGetKpiWorkflowStatus).toHaveBeenCalledWith(KPI_UUID, ORG);
  });
});
