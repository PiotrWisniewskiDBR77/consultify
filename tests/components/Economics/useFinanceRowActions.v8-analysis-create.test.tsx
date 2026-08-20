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
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    createAnalysis: vi.fn(),
    createModel: vi.fn(),
    getModel: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { useFinanceRowActions } from '@/components/Economics/hooks/useFinanceRowActions';
import { Api } from '@/services/api';
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

const modelRow = {
  id: 'model-1',
  kind: 'models',
  title: 'Revenue forecast',
  status: 'draft',
  predictionType: 'model',
} as any;

describe('useFinanceRowActions V8 analysis create seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses governed analysis creation for duplicate', async () => {
    vi.mocked(V8FinanceApi.createAnalysis).mockResolvedValue({
      analysis: { id: 'analysis-copy-1', title: 'Working capital analysis (copy)' },
    } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(analysisRow);
    const duplicateAction = actions.find((action) => action.id === 'duplicate');

    await act(async () => {
      await duplicateAction?.onClick();
    });

    expect(V8FinanceApi.createAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Working capital analysis (copy)',
      }),
    );
    expect(Api.post).not.toHaveBeenCalledWith('/api/economics/financial-analyses', expect.anything());
  });

  it('fails closed without reopening legacy analysis creation for duplicate', async () => {
    vi.mocked(V8FinanceApi.createAnalysis).mockRejectedValue({ status: 404 });

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(analysisRow);
    const duplicateAction = actions.find((action) => action.id === 'duplicate');

    await act(async () => {
      await duplicateAction?.onClick();
    });

    expect(V8FinanceApi.createAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Working capital analysis (copy)' }),
    );
    expect(Api.post).not.toHaveBeenCalledWith(
      '/api/economics/financial-analyses',
      expect.anything(),
    );
  });

  it('prefers governed model creation for duplicate before legacy fallback', async () => {
    vi.mocked(V8FinanceApi.getModel).mockResolvedValue({
      model: {
        id: 'model-1',
        start_date: '2026-01-01',
        horizon_months: 36,
        granularity: 'monthly',
        currency: 'PLN',
        assumptions_json: { revenueGrowth: 0.1 },
      },
    } as any);
    vi.mocked(V8FinanceApi.createModel).mockResolvedValue({
      model: { id: 'model-copy-1', name: 'Revenue forecast (copy)' },
    } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(modelRow);
    const duplicateAction = actions.find((action) => action.id === 'duplicate');

    await act(async () => {
      await duplicateAction?.onClick();
    });

    expect(V8FinanceApi.getModel).toHaveBeenCalledWith('model-1');
    expect(V8FinanceApi.createModel).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Revenue forecast (copy)',
        startDate: '2026-01-01',
      }),
    );
    expect(Api.post).not.toHaveBeenCalledWith('/api/financial-modeling/models', expect.anything());
  });

  it('falls back to legacy model creation for duplicate on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.getModel).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockResolvedValue({
      id: 'model-1',
      start_date: '2026-01-01',
      horizon_months: 36,
      granularity: 'monthly',
      currency: 'PLN',
      assumptions: { revenueGrowth: 0.1 },
    } as any);
    vi.mocked(V8FinanceApi.createModel).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ id: 'model-copy-legacy-1' } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(modelRow);
    const duplicateAction = actions.find((action) => action.id === 'duplicate');

    await act(async () => {
      await duplicateAction?.onClick();
    });

    expect(Api.post).toHaveBeenCalledWith(
      '/api/financial-modeling/models',
      expect.objectContaining({
        name: 'Revenue forecast (copy)',
        startDate: '2026-01-01',
      }),
    );
  });
});
