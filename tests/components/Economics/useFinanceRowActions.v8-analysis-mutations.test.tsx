/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    runAnalysis: vi.fn(),
    approveAnalysis: vi.fn(),
    approveModel: vi.fn(),
    computeModel: vi.fn(),
    createBudget: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

vi.mock('@/services/api/financeV2.api', () => ({
  runCanonicalFinancialAnalysis: vi.fn(),
  approveCanonicalFinancialAnalysis: vi.fn(),
  resolveLegacyFinanceArtifact: vi.fn(),
  approveFinanceModel: vi.fn(),
  createRegisteredValuation: vi.fn(),
}));

import { useFinanceRowActions } from '@/components/Economics/hooks/useFinanceRowActions';
import { Api } from '@/services/api';
import {
  approveCanonicalFinancialAnalysis,
  approveFinanceModel,
  createRegisteredValuation,
  resolveLegacyFinanceArtifact,
  runCanonicalFinancialAnalysis,
} from '@/services/api/financeV2.api';
import { V8FinanceApi } from '@/services/api/v8/finance';

const baseParams = {
  handleOpenFull: vi.fn(),
  handleExport: vi.fn(),
  handleCreateModelFromStatement: vi.fn(),
  handleCreateAnalysisFromStatements: vi.fn(),
  loadStatements: vi.fn(),
  loadModels: vi.fn(),
  loadAnalyses: vi.fn().mockResolvedValue(undefined),
  loadBudgets: vi.fn(),
  loadValuations: vi.fn(),
  loadPredictionPreview: vi.fn(),
  loadBudgetPreviewScenarios: vi.fn(),
  loadValuationPreviewResults: vi.fn(),
  getBudgetRawId: vi.fn((id: string) => id),
};

const analysisRow = {
  id: 'analysis-1',
  kind: 'analysis',
  title: 'Working capital analysis',
  status: 'DRAFT',
  analysisType: 'financial',
} as any;

const predictionRow = {
  id: 'model-1',
  kind: 'prediction',
  title: 'Revenue forecast',
  status: 'DRAFT',
  predictionType: 'model',
} as any;

const modelRow = {
  id: 'model-1',
  kind: 'models',
  title: 'Revenue forecast',
  status: 'DRAFT',
} as any;
const valuationRow = {
  id: 'valuation-1',
  kind: 'valuation',
  title: 'Acme valuation',
  status: 'DRAFT',
  currency: 'EUR',
} as any;
const budgetRow = {
  id: 'budget-1',
  kind: 'prediction',
  title: 'FY26 Budget',
  status: 'DRAFT',
  predictionType: 'budget',
} as any;

describe('useFinanceRowActions V8 analysis mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('duplicates a valuation only through canonical registration', async () => {
    vi.mocked(Api.get).mockResolvedValue({
      valuation: { source_type: 'manual', source_id: null, horizon_years: 7, currency: 'EUR' },
    } as any);
    vi.mocked(createRegisteredValuation).mockResolvedValue({
      id: 'valuation-copy',
      artifactId: 'artifact-copy',
      businessVersionId: 'bv-copy',
      workingRevisionId: 'wr-copy',
      replay: false,
    });
    const { result } = renderHook(() =>
      useFinanceRowActions({ ...baseParams, getExistingTitles: () => [] })
    );
    const duplicate = result.current
      .getRowActions(valuationRow)
      .find((action) => action.id === 'duplicate');
    await act(async () => {
      await duplicate?.onClick();
    });
    expect(createRegisteredValuation).toHaveBeenCalledWith({
      title: 'Acme valuation (copy)',
      sourceType: 'manual',
      sourceId: null,
      horizonYears: 7,
      currency: 'EUR',
    });
    expect(Api.post).not.toHaveBeenCalledWith('/api/economics/valuations', expect.anything());
    expect(baseParams.loadValuations).toHaveBeenCalled();
  });

  it('duplicates a budget only through canonical registration', async () => {
    vi.mocked(Api.get).mockResolvedValue({
      id: 'budget-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      granularity: 'monthly',
      currency: 'EUR',
    } as any);
    vi.mocked(V8FinanceApi.createBudget).mockResolvedValue({
      budget: { id: 'budget-copy' },
      lineCount: 15,
      scenarioCount: 3,
      replay: false,
    } as any);
    const { result } = renderHook(() =>
      useFinanceRowActions({ ...baseParams, getExistingTitles: () => [] })
    );
    const duplicate = result.current
      .getRowActions(budgetRow)
      .find((action) => action.id === 'duplicate');

    await act(async () => {
      await duplicate?.onClick();
    });

    expect(V8FinanceApi.createBudget).toHaveBeenCalledWith(
      {
        title: 'FY26 Budget (copy)',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        granularity: 'monthly',
        currency: 'EUR',
        sourceKind: 'manual',
      },
      expect.any(String)
    );
    expect(Api.post).not.toHaveBeenCalledWith('/api/economics/budgets', expect.anything());
    expect(baseParams.loadBudgets).toHaveBeenCalled();
  });

  it('uses only canonical analysis run and approval actions', async () => {
    vi.mocked(runCanonicalFinancialAnalysis).mockResolvedValue({ results: [] } as any);
    vi.mocked(approveCanonicalFinancialAnalysis).mockResolvedValue({ success: true } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(analysisRow);
    const runAction = actions.find((action) => action.id === 'reanalyze');
    const approveAction = actions.find((action) => action.id === 'approve');

    await act(async () => {
      await runAction?.onClick();
      await approveAction?.onClick();
    });

    expect(runCanonicalFinancialAnalysis).toHaveBeenCalledWith('analysis-1');
    expect(approveCanonicalFinancialAnalysis).toHaveBeenCalledWith('analysis-1');
    expect(V8FinanceApi.runAnalysis).not.toHaveBeenCalled();
    expect(V8FinanceApi.approveAnalysis).not.toHaveBeenCalled();
    expect(Api.post).not.toHaveBeenCalledWith(
      '/api/economics/financial-analyses/analysis-1/run',
      {}
    );
    expect(Api.post).not.toHaveBeenCalledWith(
      '/api/economics/financial-analyses/analysis-1/approve',
      {}
    );
  });

  it('fails closed when canonical analysis identity is unavailable', async () => {
    vi.mocked(runCanonicalFinancialAnalysis).mockRejectedValue({
      code: 'LEGACY_IDENTITY_UNMAPPED',
    });
    vi.mocked(approveCanonicalFinancialAnalysis).mockRejectedValue({
      code: 'LEGACY_IDENTITY_UNMAPPED',
    });

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(analysisRow);
    const runAction = actions.find((action) => action.id === 'reanalyze');
    const approveAction = actions.find((action) => action.id === 'approve');

    await act(async () => {
      await runAction?.onClick();
      await approveAction?.onClick();
    });

    expect(Api.post).not.toHaveBeenCalledWith(
      '/api/economics/financial-analyses/analysis-1/run',
      {}
    );
    expect(Api.post).not.toHaveBeenCalledWith(
      '/api/economics/financial-analyses/analysis-1/approve',
      {}
    );
  });

  it('prefers governed model compute action before legacy fallback', async () => {
    vi.mocked(V8FinanceApi.computeModel).mockResolvedValue({ success: true } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(predictionRow);
    const computeAction = actions.find((action) => action.id === 'compute');

    await act(async () => {
      await computeAction?.onClick();
    });

    expect(V8FinanceApi.computeModel).toHaveBeenCalledWith('model-1');
    expect(baseParams.loadPredictionPreview).toHaveBeenCalledWith('model-1');
    expect(Api.post).not.toHaveBeenCalledWith('/api/financial-modeling/models/model-1/compute', {});
  });

  it('falls back to legacy model compute action on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.computeModel).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ success: true } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(predictionRow);
    const computeAction = actions.find((action) => action.id === 'compute');

    await act(async () => {
      await computeAction?.onClick();
    });

    expect(Api.post).toHaveBeenCalledWith('/api/financial-modeling/models/model-1/compute', {});
    expect(baseParams.loadPredictionPreview).toHaveBeenCalledWith('model-1');
  });

  it('approves a model only through its resolved canonical identity', async () => {
    vi.mocked(resolveLegacyFinanceArtifact).mockResolvedValue({
      status: 'RESOLVED',
      artifactId: 'artifact-model-1',
      businessVersionId: 'bv-model-1',
    } as any);
    vi.mocked(approveFinanceModel).mockResolvedValue({ success: true, status: 'approved' } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(modelRow);
    const approveAction = actions.find((action) => action.id === 'approve');

    await act(async () => {
      await approveAction?.onClick();
    });

    expect(resolveLegacyFinanceArtifact).toHaveBeenCalledWith('financial_models', 'model-1');
    expect(approveFinanceModel).toHaveBeenCalledWith({
      modelArtifactId: 'artifact-model-1',
      idempotencyKey: expect.any(String),
    });
    expect(baseParams.loadModels).toHaveBeenCalled();
    expect(Api.post).not.toHaveBeenCalledWith('/api/financial-modeling/models/model-1/approve', {});
  });

  it('fails closed when a model has no canonical identity', async () => {
    vi.mocked(resolveLegacyFinanceArtifact).mockResolvedValue({ status: 'UNMAPPED' } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(modelRow);
    const approveAction = actions.find((action) => action.id === 'approve');

    await act(async () => {
      await approveAction?.onClick();
    });

    expect(approveFinanceModel).not.toHaveBeenCalled();
    expect(Api.post).not.toHaveBeenCalledWith('/api/financial-modeling/models/model-1/approve', {});
    expect(baseParams.loadModels).not.toHaveBeenCalled();
  });
});
