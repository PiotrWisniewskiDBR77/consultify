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
  t: (_key: string, fallback?: string) => fallback || _key,
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
    getModels: vi.fn(),
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
});
