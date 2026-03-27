import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8_FINANCE_READ_CONTRACT } from '../finance.routes.js';

const mockGetFinanceDashboard = vi.fn();
const mockGetStatementPackDetail = vi.fn();
const mockGetStatementDetail = vi.fn();
const mockListStatements = vi.fn();
const mockListStatementPacks = vi.fn();
const mockListModels = vi.fn();
const mockListValuations = vi.fn();
const mockListBudgets = vi.fn();
const mockListAnalyses = vi.fn();
const mockGetAnalysisRatios = vi.fn();
const mockGetAnalysisInsights = vi.fn();
const mockApproveAnalysis = vi.fn();
const mockCreateAnalysis = vi.fn();
const mockComputeRatios = vi.fn();
const mockRunFullAnalysis = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();
const mockDbRun = vi.fn();

vi.mock('../../../services/v8/financeIntegrationService.js', () => ({
  getFinanceDashboard: (...args: unknown[]) => mockGetFinanceDashboard(...args),
}));

vi.mock('../../../services/financialAnalysisService.js', () => ({
  createAnalysis: (...args: unknown[]) => mockCreateAnalysis(...args),
  listAnalyses: (...args: unknown[]) => mockListAnalyses(...args),
  getAnalysisRatios: (...args: unknown[]) => mockGetAnalysisRatios(...args),
  getAnalysisInsights: (...args: unknown[]) => mockGetAnalysisInsights(...args),
  approveAnalysis: (...args: unknown[]) => mockApproveAnalysis(...args),
  runFullAnalysis: (...args: unknown[]) => mockRunFullAnalysis(...args),
}));

vi.mock('../../../services/financialModelingService.js', () => ({
  listModels: (...args: unknown[]) => mockListModels(...args),
}));

vi.mock('../../../services/financialStatementPackService.js', () => ({
  getStatementPackDetail: (...args: unknown[]) => mockGetStatementPackDetail(...args),
  listStatementPacks: (...args: unknown[]) => mockListStatementPacks(...args),
}));

vi.mock('../../../services/financialStatementReadService.js', () => ({
  getStatementDetail: (...args: unknown[]) => mockGetStatementDetail(...args),
  listStatements: (...args: unknown[]) => mockListStatements(...args),
}));

vi.mock('../../../services/valuationService.js', () => ({
  listValuations: (...args: unknown[]) => mockListValuations(...args),
}));

vi.mock('../../../services/budgetingService.js', () => ({
  listBudgets: (...args: unknown[]) => mockListBudgets(...args),
}));

vi.mock('../../../services/ratioAnalysisService.js', () => ({
  computeRatios: (...args: unknown[]) => mockComputeRatios(...args),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
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

const ORG = '00000000-0000-4000-8000-000000000088';
const UID = 'user-finance-v8';

describe('V8 finance read-only routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    mockGetFinanceDashboard.mockResolvedValue({
      ingestionPipeline: {
        totalCount: 0,
        byState: {},
        confidenceBands: { high: 0, medium: 0, low: 0, unknown: 0 },
        averageConfidence: null,
      },
      linkageHealth: {
        totalLinkages: 0,
        byLinkageType: {},
        unlinkedInitiativesCount: 0,
      },
      unresolvedEscalationsCount: 0,
      staleSourceRefreshesCount: 0,
      promotionGatePassRate: null,
    });
    mockGetStatementPackDetail.mockResolvedValue(null);
    mockGetStatementDetail.mockResolvedValue(null);
    mockListStatements.mockResolvedValue([]);
    mockListStatementPacks.mockResolvedValue([]);
    mockListModels.mockResolvedValue([]);
    mockListValuations.mockResolvedValue([]);
    mockListBudgets.mockResolvedValue([]);
    mockListAnalyses.mockResolvedValue([]);
    mockGetAnalysisRatios.mockResolvedValue([]);
    mockGetAnalysisInsights.mockResolvedValue([]);
    mockApproveAnalysis.mockResolvedValue(undefined);
    mockCreateAnalysis.mockResolvedValue({
      id: 'analysis-created-1',
      title: 'Created analysis',
      status: 'DRAFT',
      analysisType: 'comprehensive',
      periods: [],
      currency: 'PLN',
      sourceStatementIds: [],
      createdAt: '2026-03-26T10:00:00.000Z',
      updatedAt: '2026-03-26T10:00:00.000Z',
    });
    mockComputeRatios.mockResolvedValue({
      statementId: 'statement-1',
      periodLabel: 'Q1 2026',
      ratios: [],
      coverageSummary: { total: 0, computed: 0, na: 0, coveragePct: 0 },
    });
    mockRunFullAnalysis.mockResolvedValue({ ratios: [] });
    mockDbGet.mockResolvedValue(null);
    mockDbAll.mockResolvedValue([]);
    mockDbRun.mockResolvedValue(undefined);
  });

  it('GET /api/v8/finance/dashboard returns envelope and delegates to getFinanceDashboard', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/finance/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.dashboard?.ingestionPipeline?.totalCount).toBe(0);
    expect(mockGetFinanceDashboard).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/finance/analyses returns envelope and delegates to listAnalyses', async () => {
    mockListAnalyses.mockResolvedValue([
      {
        id: 'analysis-1',
        title: 'Working capital analysis',
        description: null,
        status: 'DRAFT',
        analysisType: 'financial',
        periods: ['2025-Q4'],
        currency: 'PLN',
        sourceStatementIds: [],
        createdAt: '2026-03-26T10:00:00.000Z',
        updatedAt: '2026-03-26T10:05:00.000Z',
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/api/v8/finance/analyses')
      .query({ status: 'DRAFT', projectId: 'project-1' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.analyses?.[0]?.title).toBe('Working capital analysis');
    expect(mockListAnalyses).toHaveBeenCalledWith(ORG, {
      status: 'DRAFT',
      projectId: 'project-1',
    });
  });

  it('GET /api/v8/finance/models returns envelope and delegates to listModels', async () => {
    mockListModels.mockResolvedValue([
      {
        id: 'model-1',
        name: 'Revenue forecast',
        status: 'draft',
        currency: 'PLN',
        horizon_months: 36,
        start_date: '2026-01-01',
        updated_at: '2026-03-27T09:00:00.000Z',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/models');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.models?.[0]?.name).toBe('Revenue forecast');
    expect(mockListModels).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/finance/statement-packs returns envelope and delegates to listStatementPacks', async () => {
    mockListStatementPacks.mockResolvedValue([
      {
        id: 'pack-1',
        entity_name: 'Acme Sp. z o.o.',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        period_label: 'Q1 2026',
        currency: 'PLN',
        pack_status: 'pending',
        pack_readiness_status: 'recoverable',
        source_statement_count: 2,
        updated_at: '2026-03-27T12:00:00.000Z',
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/api/v8/finance/statement-packs')
      .query({ readiness: 'recoverable' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.statementPacks?.[0]?.entity_name).toBe('Acme Sp. z o.o.');
    expect(mockListStatementPacks).toHaveBeenCalledWith(ORG, 'recoverable');
  });

  it('GET /api/v8/finance/statement-packs/:id returns envelope and delegates to getStatementPackDetail', async () => {
    mockGetStatementPackDetail.mockResolvedValue({
      id: 'pack-1',
      entity_name: 'Acme Sp. z o.o.',
      period_label: 'Q1 2026',
      pack_status: 'pending',
      pack_readiness_status: 'recoverable',
      statements: [],
      validations: [],
    });

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/statement-packs/pack-1');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.pack?.entity_name).toBe('Acme Sp. z o.o.');
    expect(mockGetStatementPackDetail).toHaveBeenCalledWith(ORG, 'pack-1');
  });

  it('GET /api/v8/finance/statements/:id returns envelope and delegates to getStatementDetail', async () => {
    mockGetStatementDetail.mockResolvedValue({
      id: 'statement-1',
      statement_type: 'P&L',
      period_label: 'Q1 2026',
      values: [],
      validationLedger: [],
    });

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/statements/statement-1');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.statement?.id).toBe('statement-1');
    expect(res.body.data?.statement?.statement_type).toBe('P&L');
    expect(mockGetStatementDetail).toHaveBeenCalledWith(ORG, 'statement-1');
  });

  it('GET /api/v8/finance/statements returns envelope and delegates to listStatements', async () => {
    mockListStatements.mockResolvedValue([
      {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        source_file_name: 'acme-q1.csv',
        readiness_status: 'recoverable',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/statements').query({ readiness: 'recoverable' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.statements?.[0]?.id).toBe('statement-1');
    expect(mockListStatements).toHaveBeenCalledWith(ORG, 'recoverable');
  });

  it('GET /api/v8/finance/statements/:id/ratios returns envelope and delegates to computeRatios', async () => {
    mockComputeRatios.mockResolvedValue({
      statementId: 'statement-1',
      periodLabel: 'Q1 2026',
      ratios: [{ code: 'CURRENT_RATIO', name: 'Current Ratio', value: 1.42, status: 'ok' }],
      coverageSummary: { total: 1, computed: 1, na: 0, coveragePct: 100 },
    });

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/statements/statement-1/ratios');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.ratios?.statementId).toBe('statement-1');
    expect(res.body.data?.ratios?.coverageSummary?.coveragePct).toBe(100);
    expect(mockComputeRatios).toHaveBeenCalledWith('statement-1', ORG);
  });

  it('GET /api/v8/finance/canonical-lines returns envelope and delegates to the canonical line query', async () => {
    mockDbAll.mockResolvedValue([
      {
        id: 'line-1',
        statement_type: 'P&L',
        line_code: 'revenue',
        line_name: 'Revenue',
        line_name_pl: 'Przychody',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/canonical-lines');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.canonicalLines?.[0]?.line_name).toBe('Revenue');
    expect(mockDbAll).toHaveBeenCalledWith(expect.stringContaining('FROM financial_statement_lines'), [ORG]);
  });

  it('GET /api/v8/finance/valuations returns envelope and delegates to listValuations', async () => {
    mockListValuations.mockResolvedValue([
      {
        id: 'valuation-1',
        title: 'DCF valuation',
        status: 'draft',
        source_type: 'financial_model',
        currency: 'PLN',
        horizon_years: 5,
        updated_at: '2026-03-27T10:00:00.000Z',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/valuations');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.valuations?.[0]?.title).toBe('DCF valuation');
    expect(mockListValuations).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/finance/budgets returns envelope and delegates to listBudgets', async () => {
    mockListBudgets.mockResolvedValue([
      {
        id: 'budget-1',
        title: 'FY26 operating budget',
        status: 'draft',
        currency: 'PLN',
        granularity: 'monthly',
        period_start: '2026-01-01',
        period_end: '2026-12-31',
        updated_at: '2026-03-27T11:00:00.000Z',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/budgets');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.budgets?.[0]?.title).toBe('FY26 operating budget');
    expect(mockListBudgets).toHaveBeenCalledWith(ORG);
  });

  it('POST /api/v8/finance/analyses returns envelope and delegates to createAnalysis', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/finance/analyses').send({
      title: 'Created analysis',
      analysisType: 'comprehensive',
      currency: 'PLN',
    });

    expect(res.status).toBe(201);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.analysis?.title).toBe('Created analysis');
    expect(mockCreateAnalysis).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({
        title: 'Created analysis',
        analysisType: 'comprehensive',
        currency: 'PLN',
      }),
      UID,
    );
  });

  it('GET /api/v8/finance/analyses/:id/ratios returns envelope and delegates to getAnalysisRatios', async () => {
    mockListAnalyses.mockResolvedValue([
      {
        id: 'analysis-1',
        title: 'Working capital analysis',
      },
    ]);
    mockGetAnalysisRatios.mockResolvedValue([
      {
        category: 'liquidity',
        ratio_code: 'current_ratio',
        ratio_name: 'Current ratio',
        value: 1.42,
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/analyses/analysis-1/ratios');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.ratios?.[0]?.ratio_code).toBe('current_ratio');
    expect(mockListAnalyses).toHaveBeenCalledWith(ORG);
    expect(mockGetAnalysisRatios).toHaveBeenCalledWith('analysis-1');
  });

  it('GET /api/v8/finance/analyses/:id/initiative-proposals returns filtered proposal envelope', async () => {
    mockListAnalyses.mockResolvedValue([
      {
        id: 'analysis-1',
        title: 'Working capital analysis',
      },
    ]);
    mockGetAnalysisInsights.mockResolvedValue([
      {
        id: 'insight-1',
        insight_type: 'action',
        title: 'Reduce overdue receivables',
        description: 'Shorten DSO with collections sprint',
        priority: 9,
      },
      {
        id: 'insight-2',
        insight_type: 'quality_note',
        title: 'Ignore me',
        description: 'Non-proposal insight',
        priority: 1,
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/analyses/analysis-1/initiative-proposals');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.proposals).toHaveLength(1);
    expect(res.body.data?.proposals?.[0]?.title).toBe('Reduce overdue receivables');
    expect(mockListAnalyses).toHaveBeenCalledWith(ORG);
    expect(mockGetAnalysisInsights).toHaveBeenCalledWith('analysis-1');
  });

  it('POST /api/v8/finance/analyses/:id/initiatives creates initiatives from accepted proposals', async () => {
    mockDbGet.mockResolvedValue({
      id: 'analysis-1',
      organization_id: ORG,
      project_id: 'project-1',
      title: 'Working capital analysis',
    });
    mockDbAll.mockResolvedValue([
      {
        id: 'proposal-1',
        insight_type: 'action',
        title: 'Reduce overdue receivables',
        description: 'Shorten DSO with collections sprint',
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/finance/analyses/analysis-1/initiatives')
      .send({ acceptedProposalIds: ['proposal-1'] });

    expect(res.status).toBe(201);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(res.body.data?.initiativeIds).toHaveLength(1);
    expect(mockDbGet).toHaveBeenCalled();
    expect(mockDbAll).toHaveBeenCalled();
    expect(mockDbRun).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v8/finance/analyses/:id/run delegates to runFullAnalysis', async () => {
    mockRunFullAnalysis.mockResolvedValue({
      ratios: [{ ratio_code: 'current_ratio', value: 1.42 }],
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/finance/analyses/analysis-1/run').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockRunFullAnalysis).toHaveBeenCalledWith(ORG, 'analysis-1');
  });

  it('POST /api/v8/finance/analyses/:id/approve delegates to approveAnalysis', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/finance/analyses/analysis-1/approve').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockApproveAnalysis).toHaveBeenCalledWith(ORG, 'analysis-1', UID);
  });

  it('DELETE /api/v8/finance/analyses/:id deletes a non-approved analysis', async () => {
    mockDbGet.mockResolvedValue({ id: 'analysis-1', status: 'DRAFT' });
    const app = createApp();
    const res = await request(app).delete('/api/v8/finance/analyses/analysis-1');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data).toEqual({ success: true, deleted: 'analysis-1' });
    expect(mockDbRun).toHaveBeenCalledWith(
      'DELETE FROM financial_analysis_insights WHERE analysis_id = ?',
      ['analysis-1'],
    );
    expect(mockDbRun).toHaveBeenCalledWith(
      'DELETE FROM financial_analysis_ratios WHERE analysis_id = ?',
      ['analysis-1'],
    );
    expect(mockDbRun).toHaveBeenCalledWith('DELETE FROM financial_analyses WHERE id = ?', [
      'analysis-1',
    ]);
  });
});
