/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockTranslation = {
  t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
  i18n: { language: 'en' },
};

vi.mock('react-i18next', () => ({
  useTranslation: () => mockTranslation,
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
  shouldAllowDemoData: vi.fn(() => false),
}));

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    getStatementPacks: vi.fn(),
    getModels: vi.fn(),
    getValuations: vi.fn(),
    getBudgets: vi.fn(),
    getAnalyses: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { useFinanceData } from '@/components/Economics/hooks/useFinanceData';
import { Api } from '@/services/api';
import { V8FinanceApi } from '@/services/api/v8/finance';

describe('useFinanceData V8 analyses seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers governed finance analyses before legacy economics fallback', async () => {
    vi.mocked(V8FinanceApi.getAnalyses).mockResolvedValue({
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
    } as any);

    const { result } = renderHook(() => useFinanceData('analysis', '', []));

    await waitFor(() => {
      expect(result.current.loadingTab).toBeNull();
      expect(result.current.analyses).toHaveLength(1);
    });

    expect(V8FinanceApi.getAnalyses).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/api/economics/financial-analyses');
    expect(result.current.rowsForActiveTab[0]?.title).toBe('Working capital analysis');
  });

  it('prefers governed finance statement packs before legacy finance-statements fallback', async () => {
    vi.mocked(V8FinanceApi.getStatementPacks).mockResolvedValue({
      statementPacks: [
        {
          id: 'pack-1',
          entity_name: 'Acme Sp. z o.o.',
          period_start: '2026-01-01',
          period_end: '2026-03-31',
          period_label: 'Q1 2026',
          currency: 'PLN',
          scaling: 'units',
          pack_status: 'pending',
          pack_readiness_status: 'recoverable',
          source_statement_count: 2,
          updated_at: '2026-03-27T12:00:00.000Z',
        },
      ],
      count: 1,
    } as any);

    const { result } = renderHook(() => useFinanceData('statements', '', []));

    await waitFor(() => {
      expect(result.current.loadingTab).toBeNull();
      expect(result.current.statements).toHaveLength(1);
    });

    expect(V8FinanceApi.getStatementPacks).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/api/finance-statements/packs');
    expect(result.current.rowsForActiveTab[0]?.title).toBe('Acme Sp. z o.o.');
  });

  it('falls back to legacy statement packs when V8 seam returns a bounded compatibility status', async () => {
    vi.mocked(V8FinanceApi.getStatementPacks).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockResolvedValue([
      {
        id: 'pack-legacy-1',
        entity_name: 'Legacy Co.',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        period_label: 'Q1 2026',
        currency: 'PLN',
        scaling: 'units',
        pack_status: 'pending',
        pack_readiness_status: 'recoverable',
        source_statement_count: 2,
        updated_at: '2026-03-27T12:05:00.000Z',
      },
    ] as any);

    const { result } = renderHook(() => useFinanceData('statements', '', []));

    await waitFor(() => {
      expect(result.current.loadingTab).toBeNull();
      expect(result.current.statements).toHaveLength(1);
    });

    expect(V8FinanceApi.getStatementPacks).toHaveBeenCalled();
    expect(Api.get).toHaveBeenCalledWith('/api/finance-statements/packs');
    expect(result.current.rowsForActiveTab[0]?.title).toBe('Legacy Co.');
  });

  it('falls back to legacy analyses when V8 seam returns a bounded compatibility status', async () => {
    vi.mocked(V8FinanceApi.getAnalyses).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockResolvedValue({
      analyses: [
        {
          id: 'analysis-legacy-1',
          title: 'Legacy analysis',
          analysis_type: 'financial',
          status: 'DRAFT',
          periods: ['2025-Q4'],
          currency: 'PLN',
          source_statement_ids: [],
          updated_at: '2026-03-26T10:05:00.000Z',
        },
      ],
    } as any);

    const { result } = renderHook(() => useFinanceData('analysis', '', []));

    await waitFor(() => {
      expect(result.current.loadingTab).toBeNull();
      expect(result.current.analyses).toHaveLength(1);
    });

    expect(V8FinanceApi.getAnalyses).toHaveBeenCalled();
    expect(Api.get).toHaveBeenCalledWith('/api/economics/financial-analyses');
    expect(result.current.rowsForActiveTab[0]?.title).toBe('Legacy analysis');
  });

  it('prefers governed finance models before legacy financial-modeling fallback', async () => {
    vi.mocked(V8FinanceApi.getModels).mockResolvedValue({
      models: [
        {
          id: 'model-1',
          name: 'Revenue forecast',
          status: 'draft',
          currency: 'PLN',
          horizon_months: 36,
          start_date: '2026-01-01',
          updated_at: '2026-03-27T09:00:00.000Z',
        },
      ],
      count: 1,
    } as any);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/finance-statements/packs') {
        return [];
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    const { result } = renderHook(() => useFinanceData('models', '', []));

    await waitFor(() => {
      expect(result.current.loadingTab).toBeNull();
      expect(result.current.models).toHaveLength(1);
    });

    expect(V8FinanceApi.getModels).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/api/financial-modeling/models');
    expect(result.current.rowsForActiveTab[0]?.title).toBe('Revenue forecast');
  });

  it('falls back to legacy finance models when V8 seam returns a bounded compatibility status', async () => {
    vi.mocked(V8FinanceApi.getModels).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/finance-statements/packs') {
        return [];
      }
      if (url === '/api/financial-modeling/models') {
        return [
          {
            id: 'model-legacy-1',
            name: 'Legacy forecast',
            status: 'draft',
            currency: 'PLN',
            horizon_months: 24,
            start_date: '2026-01-01',
            updated_at: '2026-03-27T09:05:00.000Z',
          },
        ];
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    const { result } = renderHook(() => useFinanceData('models', '', []));

    await waitFor(() => {
      expect(result.current.loadingTab).toBeNull();
      expect(result.current.models).toHaveLength(1);
    });

    expect(V8FinanceApi.getModels).toHaveBeenCalled();
    expect(Api.get).toHaveBeenCalledWith('/api/financial-modeling/models');
    expect(result.current.rowsForActiveTab[0]?.title).toBe('Legacy forecast');
  });

  it('keeps valuation list reads on the same legacy family as valuation writes', async () => {
    vi.mocked(Api.get).mockResolvedValue({
      valuations: [
        {
          id: 'valuation-1',
          title: 'DCF valuation',
          status: 'draft',
          source_type: 'financial_model',
          currency: 'PLN',
          horizon_years: 5,
          updated_at: '2026-03-27T10:00:00.000Z',
        },
      ],
    } as any);

    const { result } = renderHook(() => useFinanceData('valuation', '', []));

    await waitFor(() => {
      expect(result.current.loadingTab).toBeNull();
      expect(result.current.valuations).toHaveLength(1);
    });

    expect(V8FinanceApi.getValuations).not.toHaveBeenCalled();
    expect(Api.get).toHaveBeenCalledWith('/api/economics/valuations');
    expect(result.current.rowsForActiveTab[0]?.title).toBe('DCF valuation');
  });

  it('returns an empty valuation list when the legacy valuation payload lacks valuations', async () => {
    vi.mocked(Api.get).mockResolvedValue({
      invalid: [],
    } as any);

    const { result } = renderHook(() => useFinanceData('valuation', '', []));

    await waitFor(() => {
      expect(result.current.loadingTab).toBeNull();
      expect(result.current.valuations).toHaveLength(0);
    });

    expect(Api.get).toHaveBeenCalledWith('/api/economics/valuations');
    expect(result.current.rowsForActiveTab).toHaveLength(0);
  });

  it('keeps budget list reads on the same legacy family as budget writes', async () => {
    vi.mocked(V8FinanceApi.getModels).mockResolvedValue({
      models: [],
      count: 0,
    } as any);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/economics/budgets') {
        return {
          budgets: [
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
          ],
        } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    const { result } = renderHook(() => useFinanceData('prediction', '', []));

    await waitFor(() => {
      expect(result.current.loadingTab).toBeNull();
      expect(result.current.budgets).toHaveLength(1);
    });

    expect(V8FinanceApi.getBudgets).not.toHaveBeenCalled();
    expect(Api.get).toHaveBeenCalledWith('/api/economics/budgets');
    expect(result.current.rowsForActiveTab[0]?.title).toBe('FY26 operating budget');
  });

  it('keeps legacy budget payloads as the single source of truth for prediction budgets', async () => {
    vi.mocked(V8FinanceApi.getModels).mockResolvedValue({
      models: [],
      count: 0,
    } as any);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/economics/budgets') {
        return {
          budgets: [
            {
              id: 'budget-legacy-1',
              title: 'Legacy operating budget',
              status: 'approved',
              currency: 'PLN',
              granularity: 'quarterly',
              period_start: '2026-01-01',
              period_end: '2026-12-31',
              updated_at: '2026-03-27T11:05:00.000Z',
            },
          ],
        } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    const { result } = renderHook(() => useFinanceData('prediction', '', []));

    await waitFor(() => {
      expect(result.current.loadingTab).toBeNull();
      expect(result.current.budgets).toHaveLength(1);
    });

    expect(Api.get).toHaveBeenCalledWith('/api/economics/budgets');
    expect(result.current.rowsForActiveTab[0]?.title).toBe('Legacy operating budget');
  });
});
