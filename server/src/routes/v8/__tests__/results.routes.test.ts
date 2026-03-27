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

vi.mock('../../../services/v8/resultsROIService.js', () => ({
  getResultsDashboard: (...args: unknown[]) => mockGetResultsDashboard(...args),
  getResultsKpiCatalog: (...args: unknown[]) => mockGetResultsKpiCatalog(...args),
  getResultsKpiDrawerDetail: (...args: unknown[]) => mockGetResultsKpiDrawerDetail(...args),
  getROIPortfolioSummary: (...args: unknown[]) => mockGetROIPortfolioSummary(...args),
  getROIInitiativeDetail: (...args: unknown[]) => mockGetROIInitiativeDetail(...args),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
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
});
