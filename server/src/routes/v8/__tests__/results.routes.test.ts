import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8_RESULTS_READ_CONTRACT, V8_RESULTS_WRITE_CONTRACT } from '../results.routes.js';

const mockGetResultsDashboard = vi.fn();
const mockGetROIPortfolioSummary = vi.fn();
const mockGetROIInitiativeDetail = vi.fn();
const mockGetResultsKpiCatalog = vi.fn();
const mockGetResultsKpiDrawerDetail = vi.fn();
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();
const mockCreateKpiReportSnapshot = vi.fn();
const mockCreateReport = vi.fn();
const mockUpdateSectionContent = vi.fn();
const mockUpdateReportStatus = vi.fn();
const mockHandleTimeSeriesRecorded = vi.fn();

vi.mock('../../../services/v8/resultsROIService.js', () => ({
  getResultsDashboard: (...args: unknown[]) => mockGetResultsDashboard(...args),
  getResultsKpiCatalog: (...args: unknown[]) => mockGetResultsKpiCatalog(...args),
  getResultsKpiDrawerDetail: (...args: unknown[]) => mockGetResultsKpiDrawerDetail(...args),
  getROIPortfolioSummary: (...args: unknown[]) => mockGetROIPortfolioSummary(...args),
  getROIInitiativeDetail: (...args: unknown[]) => mockGetROIInitiativeDetail(...args),
}));

vi.mock('../../../services/results/kpiReportSnapshotService.js', () => ({
  createKpiReportSnapshot: (...args: unknown[]) => mockCreateKpiReportSnapshot(...args),
}));

vi.mock('../../../services/results/kpiDeviationService.js', () => ({
  handleTimeSeriesRecorded: (...args: unknown[]) => mockHandleTimeSeriesRecorded(...args),
}));

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
    mockDbGet.mockResolvedValue({ measurement_frequency: 'MONTHLY' });
    mockDbAll.mockResolvedValue([{ name: 'current_value' }]);
    mockDbRun.mockResolvedValue({ changes: 1 });
  });

  it('GET /api/v8/results/dashboard returns envelope and delegates to getResultsDashboard', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/results/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_READ_CONTRACT);
    expect(res.body.data?.snapshot?.organizationId).toBe(ORG);
    expect(mockGetResultsDashboard).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/results/roi/portfolio-summary returns envelope and delegates to getROIPortfolioSummary', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/results/roi/portfolio-summary');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_READ_CONTRACT);
    expect(res.body.data?.organizationId).toBe(ORG);
    expect(mockGetROIPortfolioSummary).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/results/kpis/catalog returns envelope and delegates to getResultsKpiCatalog', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/results/kpis/catalog').query({ kpiId: 'kpi-1' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_READ_CONTRACT);
    expect(res.body.data?.organizationId).toBe(ORG);
    expect(mockGetResultsKpiCatalog).toHaveBeenCalledWith(ORG, { kpiId: 'kpi-1' });
  });

  it('GET /api/v8/results/roi/initiative/:initiativeId/detail returns envelope and delegates to getROIInitiativeDetail', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/results/roi/initiative/init-1/detail');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_READ_CONTRACT);
    expect(res.body.data?.initiativeId).toBe('init-1');
    expect(mockGetROIInitiativeDetail).toHaveBeenCalledWith('init-1', ORG);
  });

  it('GET /api/v8/results/kpis/:kpiId/drawer-detail returns envelope and delegates to getResultsKpiDrawerDetail', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/results/kpis/kpi-1/drawer-detail');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_READ_CONTRACT);
    expect(res.body.data?.kpiId).toBe('kpi-1');
    expect(mockGetResultsKpiDrawerDetail).toHaveBeenCalledWith('kpi-1', ORG);
  });

  it('POST /api/v8/results/kpis creates a KPI in the governed V8 namespace', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/results/kpis').send({
      name: 'Revenue Growth',
      targetValue: 100,
      measurementFrequency: 'MONTHLY',
      direction: 'HIGHER_IS_BETTER',
    });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data?.id).toBeTruthy();
    expect(mockDbRun).toHaveBeenCalledTimes(1);
    expect(String(mockDbRun.mock.calls[0]?.[0] || '')).toContain('INSERT INTO initiative_kpis');
    expect(mockDbRun.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining([ORG, 'Revenue Growth', 100, 'MONTHLY', 'HIGHER_IS_BETTER']),
    );
  });

  it('PUT /api/v8/results/kpis/:kpiId saves governed KPI settings', async () => {
    mockDbGet.mockResolvedValueOnce({ id: 'kpi-1' });

    const app = createApp();
    const res = await request(app).put('/api/v8/results/kpis/kpi-1').send({
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
    expect(mockDbGet).toHaveBeenCalledWith(
      expect.stringContaining('SELECT k.id'),
      ['kpi-1', ORG],
    );
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE initiative_kpis'),
      expect.arrayContaining([
        'KPI Alpha Updated',
        'Updated description',
        '%',
        10,
        20,
        'MONTHLY',
        'HIGHER_IS_BETTER',
        'PERCENT_FROM_TARGET',
        5,
        10,
        'kpi-1',
      ]),
    );
  });

  it('POST /api/v8/results/kpi-mappings creates a governed KPI mapping', async () => {
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
      }),
    );
    expect(mockDbRun).toHaveBeenCalledTimes(1);
    expect(String(mockDbRun.mock.calls[0]?.[0] || '')).toContain(
      'INSERT INTO initiative_kpi_mappings',
    );
    expect(mockDbRun.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining(['init-1', 'kpi-1', ORG, 'increase', 'medium', UID]),
    );
  });

  it('POST /api/v8/results/kpi-reports creates a governed KPI report builder draft', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/results/kpi-reports').send({
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
      }),
    );
    expect(mockUpdateSectionContent).toHaveBeenCalledTimes(5);
    expect(mockUpdateReportStatus).toHaveBeenCalledWith('report-1', 'GENERATED', UID);
  });

  it('POST /api/v8/results/kpis/:kpiId/time-series records governed KPI measurement', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/results/kpis/kpi-1/time-series').send({
      value: 24,
      periodStart: '2026-03-01',
      notes: 'March value',
    });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_RESULTS_WRITE_CONTRACT);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        kpiId: 'kpi-1',
        value: 24,
        measuredAt: '2026-03-01',
        periodStart: '2026-03-01',
        periodKey: '2026-03',
      }),
    );
    expect(mockDbGet).toHaveBeenCalledWith(
      `SELECT measurement_frequency FROM initiative_kpis WHERE id = ? LIMIT 1`,
      ['kpi-1'],
    );
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO kpi_time_series'),
      expect.arrayContaining(['kpi-1', ORG, 24, '2026-03-01', 'manual', 'March value', UID]),
    );
    expect(mockHandleTimeSeriesRecorded).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: ORG,
        kpiId: 'kpi-1',
        value: 24,
        periodStart: '2026-03-01',
        recordedByUserId: UID,
      }),
    );
  });

  it('PUT /api/v8/results/roi/initiative/:initiativeId/assumptions saves governed ROI assumptions', async () => {
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
      ]),
    );
  });

  it('POST /api/v8/results/roi/initiative/:initiativeId/realized creates governed ROI realized entry', async () => {
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
      ]),
    );
  });
});
