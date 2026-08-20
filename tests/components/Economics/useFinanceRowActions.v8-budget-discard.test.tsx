/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, f?: any) => (typeof f === 'string' ? f : _k),
    i18n: { language: 'en' },
  }),
}));
vi.mock('@/services/api', () => ({ Api: { delete: vi.fn(), get: vi.fn(), post: vi.fn() } }));
vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: { discardBudget: vi.fn() },
  shouldFallbackToLegacyFinance: () => false,
}));
import { useFinanceRowActions } from '@/components/Economics/hooks/useFinanceRowActions';
import { mapBudgetToPredictionRow } from '@/components/Economics/hooks/useFinanceData';
import { Api } from '@/services/api';
import { V8FinanceApi } from '@/services/api/v8/finance';
const params: any = {
  handleOpenFull: vi.fn(),
  handleExport: vi.fn(),
  handleCreateModelFromStatement: vi.fn(),
  handleCreateAnalysisFromStatements: vi.fn(),
  loadStatements: vi.fn(),
  loadModels: vi.fn(),
  loadAnalyses: vi.fn(),
  loadBudgets: vi.fn(),
  loadValuations: vi.fn(),
  loadPredictionPreview: vi.fn(),
  loadBudgetPreviewScenarios: vi.fn(),
  loadValuationPreviewResults: vi.fn(),
  getBudgetRawId: (id: string) => id.replace('budget-', ''),
};
const row = mapBudgetToPredictionRow(
  {
    id: 'budget-1',
    title: 'FY27 Draft',
    status: 'DRAFT',
    currency: 'PLN',
    period_start: '2027-01-01',
    period_end: '2027-12-31',
    granularity: 'monthly',
    version: 7,
    updated_at: '2026-08-20T00:00:00.000Z',
  },
  (_key, fallback) => fallback
);
describe('useFinanceRowActions governed budget discard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    vi.mocked(V8FinanceApi.discardBudget).mockResolvedValue({} as any);
  });
  it('uses canonical versioned discard and never the legacy hard delete', async () => {
    const { result } = renderHook(() => useFinanceRowActions(params));
    const action = result.current.getRowActions(row).find((item: any) => item.id === 'delete');
    await act(async () => {
      await action?.onClick();
    });
    expect(V8FinanceApi.discardBudget).toHaveBeenCalledWith(
      'budget-1',
      7,
      'Discarded from Finance workspace',
      expect.any(String)
    );
    expect(Api.delete).not.toHaveBeenCalledWith('/api/economics/budgets/budget-1');
    expect(params.loadBudgets).toHaveBeenCalled();
  });
  it('fails closed when canonical discard rejects', async () => {
    vi.mocked(V8FinanceApi.discardBudget).mockRejectedValue({ status: 404 });
    const { result } = renderHook(() => useFinanceRowActions(params));
    await act(async () => {
      await result.current
        .getRowActions(row)
        .find((item: any) => item.id === 'delete')
        ?.onClick();
    });
    expect(Api.delete).not.toHaveBeenCalled();
  });
});
