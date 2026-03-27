import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Delete: vi.fn(),
  v8Put: vi.fn(),
}));

import { shouldFallbackToLegacyFinance, V8FinanceApi } from '@/services/api/v8/finance';
import { v8Delete, v8Get, v8Post } from '@/services/api/v8/client';

describe('V8FinanceApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the governed finance dashboard from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      dashboard: {
        ingestionPipeline: {
          totalCount: 8,
          byState: { ready: 5, review_required: 3 },
          confidenceBands: { high: 4, medium: 2, low: 1, unknown: 1 },
          averageConfidence: 0.82,
        },
        linkageHealth: {
          totalLinkages: 11,
          byLinkageType: { initiative: 6, statement_pack: 5 },
          unlinkedInitiativesCount: 2,
        },
        unresolvedEscalationsCount: 3,
        staleSourceRefreshesCount: 1,
        promotionGatePassRate: 0.75,
      },
    });

    const data = await V8FinanceApi.getDashboard();

    expect(v8Get).toHaveBeenCalledWith('/finance/dashboard');
    expect(data.dashboard.ingestionPipeline.totalCount).toBe(8);
    expect(data.dashboard.linkageHealth.totalLinkages).toBe(11);
  });

  it('requests governed finance analyses from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      analyses: [
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
      ],
      count: 1,
    });

    const data = await V8FinanceApi.getAnalyses({ status: 'DRAFT', projectId: 'project-1' });

    expect(v8Get).toHaveBeenCalledWith('/finance/analyses', {
      status: 'DRAFT',
      projectId: 'project-1',
    });
    expect(data.count).toBe(1);
    expect(data.analyses[0].title).toBe('Working capital analysis');
  });

  it('requests governed finance analysis ratios from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      ratios: [
        {
          category: 'liquidity',
          ratio_code: 'current_ratio',
          ratio_name: 'Current ratio',
          value: 1.42,
        },
      ],
    });

    const data = await V8FinanceApi.getAnalysisRatios('analysis-1');

    expect(v8Get).toHaveBeenCalledWith('/finance/analyses/analysis-1/ratios');
    expect(data.ratios[0].ratio_code).toBe('current_ratio');
  });

  it('requests governed finance initiative proposals from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      proposals: [
        {
          id: 'proposal-1',
          title: 'Reduce overdue receivables',
          summary: 'Shorten DSO with collections sprint',
          kind: 'action',
          priority: 9,
        },
      ],
    });

    const data = await V8FinanceApi.getInitiativeProposals('analysis-1');

    expect(v8Get).toHaveBeenCalledWith('/finance/analyses/analysis-1/initiative-proposals');
    expect(data.proposals[0].kind).toBe('action');
  });

  it('creates initiatives from an analysis through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
      initiativeIds: ['initiative-1'],
    } as any);

    const data = await V8FinanceApi.createInitiativesFromAnalysis('analysis-1', {
      acceptedProposalIds: ['proposal-1'],
    });

    expect(v8Post).toHaveBeenCalledWith('/finance/analyses/analysis-1/initiatives', {
      acceptedProposalIds: ['proposal-1'],
    });
    expect(data.initiativeIds[0]).toBe('initiative-1');
  });

  it('creates an analysis through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      analysis: {
        id: 'analysis-1',
        title: 'Created analysis',
        status: 'DRAFT',
        analysisType: 'comprehensive',
        periods: [],
        currency: 'PLN',
        sourceStatementIds: [],
        createdAt: '2026-03-26T10:00:00.000Z',
        updatedAt: '2026-03-26T10:00:00.000Z',
      },
    } as any);

    const data = await V8FinanceApi.createAnalysis({
      title: 'Created analysis',
      analysisType: 'comprehensive',
      currency: 'PLN',
    });

    expect(v8Post).toHaveBeenCalledWith('/finance/analyses', {
      title: 'Created analysis',
      analysisType: 'comprehensive',
      currency: 'PLN',
    });
    expect(data.analysis.title).toBe('Created analysis');
  });

  it('deletes an analysis through the V8 namespace', async () => {
    vi.mocked(v8Delete).mockResolvedValue({
      success: true,
      deleted: 'analysis-1',
    } as any);

    const data = await V8FinanceApi.deleteAnalysis('analysis-1');

    expect(v8Delete).toHaveBeenCalledWith('/finance/analyses/analysis-1');
    expect(data.deleted).toBe('analysis-1');
  });

  it('runs an analysis through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
      result: { ratios: [{ ratio_code: 'current_ratio', value: 1.42 }] },
    } as any);

    const data = await V8FinanceApi.runAnalysis('analysis-1');

    expect(v8Post).toHaveBeenCalledWith('/finance/analyses/analysis-1/run', {});
    expect(data.success).toBe(true);
  });

  it('approves an analysis through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
    } as any);

    const data = await V8FinanceApi.approveAnalysis('analysis-1');

    expect(v8Post).toHaveBeenCalledWith('/finance/analyses/analysis-1/approve', {});
    expect(data.success).toBe(true);
  });

  it('falls back to legacy finance routes only for bounded compatibility statuses', () => {
    expect(shouldFallbackToLegacyFinance({ status: 404 })).toBe(true);
    expect(shouldFallbackToLegacyFinance({ status: 501 })).toBe(true);
    expect(shouldFallbackToLegacyFinance({ status: 500 })).toBe(false);
  });
});
