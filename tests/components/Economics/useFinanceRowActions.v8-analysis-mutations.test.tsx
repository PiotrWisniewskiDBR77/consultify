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
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    post: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    runAnalysis: vi.fn(),
    approveAnalysis: vi.fn(),
    approveModel: vi.fn(),
    computeModel: vi.fn(),
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
}));

import { useFinanceRowActions } from '@/components/Economics/hooks/useFinanceRowActions';
import { Api } from '@/services/api';
import {
  approveCanonicalFinancialAnalysis,
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

describe('useFinanceRowActions V8 analysis mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(Api.post).not.toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1/run', {});
    expect(Api.post).not.toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1/approve', {});
  });

  it('fails closed when canonical analysis identity is unavailable', async () => {
    vi.mocked(runCanonicalFinancialAnalysis).mockRejectedValue({ code: 'LEGACY_IDENTITY_UNMAPPED' });
    vi.mocked(approveCanonicalFinancialAnalysis).mockRejectedValue({ code: 'LEGACY_IDENTITY_UNMAPPED' });

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(analysisRow);
    const runAction = actions.find((action) => action.id === 'reanalyze');
    const approveAction = actions.find((action) => action.id === 'approve');

    await act(async () => {
      await runAction?.onClick();
      await approveAction?.onClick();
    });

    expect(Api.post).not.toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1/run', {});
    expect(Api.post).not.toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1/approve', {});
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

  it('prefers governed model approve action before legacy fallback', async () => {
    vi.mocked(V8FinanceApi.approveModel).mockResolvedValue({ success: true, status: 'approved' } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(modelRow);
    const approveAction = actions.find((action) => action.id === 'approve');

    await act(async () => {
      await approveAction?.onClick();
    });

    expect(V8FinanceApi.approveModel).toHaveBeenCalledWith('model-1');
    expect(baseParams.loadModels).toHaveBeenCalled();
    expect(Api.post).not.toHaveBeenCalledWith('/api/financial-modeling/models/model-1/approve', {});
  });

  it('falls back to legacy model approve action on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.approveModel).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ success: true } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(modelRow);
    const approveAction = actions.find((action) => action.id === 'approve');

    await act(async () => {
      await approveAction?.onClick();
    });

    expect(Api.post).toHaveBeenCalledWith('/api/financial-modeling/models/model-1/approve', {});
    expect(baseParams.loadModels).toHaveBeenCalled();
  });
});
