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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
  shouldAllowDemoData: vi.fn(() => false),
}));

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
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
});
