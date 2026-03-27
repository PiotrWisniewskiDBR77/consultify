/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/finance', () => ({
  V8FinanceApi: {
    getAnalysisRatios: vi.fn(),
  },
  shouldFallbackToLegacyFinance: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { useFinanceSelection } from '@/components/Economics/hooks/useFinanceSelection';
import { Api } from '@/services/api';
import { V8FinanceApi } from '@/services/api/v8/finance';

describe('useFinanceSelection V8 analysis ratios seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers governed finance analysis ratios before legacy fallback', async () => {
    vi.mocked(V8FinanceApi.getAnalysisRatios).mockResolvedValue({
      ratios: [
        {
          category: 'liquidity',
          ratio_code: 'current_ratio',
          ratio_name: 'Current ratio',
          value: 1.42,
        },
      ],
    } as any);

    const { result } = renderHook(() => useFinanceSelection('analysis'));

    await act(async () => {
      await result.current.loadAnalysisPreviewRatios('analysis-1');
    });

    await waitFor(() => {
      expect(result.current.analysisPreviewRatios).toHaveLength(1);
    });

    expect(V8FinanceApi.getAnalysisRatios).toHaveBeenCalledWith('analysis-1');
    expect(Api.get).not.toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1/ratios');
    expect(result.current.analysisPreviewRatios?.[0]?.ratio_code).toBe('current_ratio');
  });

  it('falls back to legacy analysis ratios when V8 seam returns a bounded compatibility status', async () => {
    vi.mocked(V8FinanceApi.getAnalysisRatios).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockResolvedValue({
      ratios: [
        {
          category: 'liquidity',
          ratio_code: 'quick_ratio',
          ratio_name: 'Quick ratio',
          value: 1.13,
        },
      ],
    } as any);

    const { result } = renderHook(() => useFinanceSelection('analysis'));

    await act(async () => {
      await result.current.loadAnalysisPreviewRatios('analysis-1');
    });

    await waitFor(() => {
      expect(result.current.analysisPreviewRatios).toHaveLength(1);
    });

    expect(V8FinanceApi.getAnalysisRatios).toHaveBeenCalledWith('analysis-1');
    expect(Api.get).toHaveBeenCalledWith('/api/economics/financial-analyses/analysis-1/ratios');
    expect(result.current.analysisPreviewRatios?.[0]?.ratio_code).toBe('quick_ratio');
  });
});
