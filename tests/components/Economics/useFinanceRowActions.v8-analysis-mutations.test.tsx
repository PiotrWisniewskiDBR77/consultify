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
    post: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    runAnalysis: vi.fn(),
    approveAnalysis: vi.fn(),
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

describe('useFinanceRowActions V8 analysis mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers governed analysis run and approve actions before legacy fallback', async () => {
    vi.mocked(V8FinanceApi.runAnalysis).mockResolvedValue({ success: true } as any);
    vi.mocked(V8FinanceApi.approveAnalysis).mockResolvedValue({ success: true } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(analysisRow);
    const runAction = actions.find((action) => action.id === 'reanalyze');
    const approveAction = actions.find((action) => action.id === 'approve');

    await act(async () => {
      await runAction?.onClick();
      await approveAction?.onClick();
    });

    expect(V8FinanceApi.runAnalysis).toHaveBeenCalledWith('analysis-1');
    expect(V8FinanceApi.approveAnalysis).toHaveBeenCalledWith('analysis-1');
    expect(Api.post).not.toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1/run', {});
    expect(Api.post).not.toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1/approve', {});
  });

  it('falls back to legacy analysis run and approve actions on bounded compatibility statuses', async () => {
    vi.mocked(V8FinanceApi.runAnalysis).mockRejectedValue({ status: 404 });
    vi.mocked(V8FinanceApi.approveAnalysis).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ success: true } as any);

    const { result } = renderHook(() => useFinanceRowActions(baseParams));
    const actions = result.current.getRowActions(analysisRow);
    const runAction = actions.find((action) => action.id === 'reanalyze');
    const approveAction = actions.find((action) => action.id === 'approve');

    await act(async () => {
      await runAction?.onClick();
      await approveAction?.onClick();
    });

    expect(Api.post).toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1/run', {});
    expect(Api.post).toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1/approve', {});
  });
});
