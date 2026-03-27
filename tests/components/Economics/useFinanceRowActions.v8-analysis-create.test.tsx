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
    t: (_key: string, fallback?: string) => fallback || _key,
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

describe('useFinanceRowActions V8 analysis create seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers governed analysis creation for duplicate before legacy fallback', async () => {
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

  it('falls back to legacy analysis creation for duplicate on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.createAnalysis).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ analysis: { id: 'analysis-copy-legacy-1' } } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(analysisRow);
    const duplicateAction = actions.find((action) => action.id === 'duplicate');

    await act(async () => {
      await duplicateAction?.onClick();
    });

    expect(Api.post).toHaveBeenCalledWith(
      '/api/economics/financial-analyses',
      expect.objectContaining({
        title: 'Working capital analysis (copy)',
      }),
    );
  });
});
