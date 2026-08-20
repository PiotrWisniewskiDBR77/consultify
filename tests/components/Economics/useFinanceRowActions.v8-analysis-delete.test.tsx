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
    delete: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    deleteAnalysis: vi.fn(),
    deleteModel: vi.fn(),
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
  title: 'FY26 Operating Model',
  status: 'draft',
} as any;

describe('useFinanceRowActions V8 analysis delete seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('uses the governed analysis deletion command', async () => {
    vi.mocked(V8FinanceApi.deleteAnalysis).mockResolvedValue({
      success: true,
      deleted: 'analysis-1',
    } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(analysisRow);
    const deleteAction = actions.find((action) => action.id === 'delete');

    await act(async () => {
      await deleteAction?.onClick();
    });

    expect(V8FinanceApi.deleteAnalysis).toHaveBeenCalledWith('analysis-1');
    expect(Api.delete).not.toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1');
  });

  it('fails closed without reopening legacy analysis deletion', async () => {
    vi.mocked(V8FinanceApi.deleteAnalysis).mockRejectedValue({ status: 404 });

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(analysisRow);
    const deleteAction = actions.find((action) => action.id === 'delete');

    await act(async () => {
      await deleteAction?.onClick();
    });

    expect(V8FinanceApi.deleteAnalysis).toHaveBeenCalledWith('analysis-1');
    expect(Api.delete).not.toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1');
  });

  it('prefers governed model deletion before legacy fallback', async () => {
    vi.mocked(V8FinanceApi.deleteModel).mockResolvedValue({
      success: true,
      deleted: 'model-1',
    } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(modelRow);
    const deleteAction = actions.find((action) => action.id === 'delete');

    await act(async () => {
      await deleteAction?.onClick();
    });

    expect(V8FinanceApi.deleteModel).toHaveBeenCalledWith('model-1');
    expect(Api.delete).not.toHaveBeenCalledWith('/api/financial-modeling/models/model-1');
  });

  it('falls back to legacy model deletion on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.deleteModel).mockRejectedValue({ status: 404 });
    vi.mocked(Api.delete).mockResolvedValue({ success: true } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(modelRow);
    const deleteAction = actions.find((action) => action.id === 'delete');

    await act(async () => {
      await deleteAction?.onClick();
    });

    expect(Api.delete).toHaveBeenCalledWith('/api/financial-modeling/models/model-1');
  });
});
