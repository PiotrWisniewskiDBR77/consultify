import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/results', () => ({
  V8ResultsApi: {
    getKpiCatalog: vi.fn(),
  },
  shouldFallbackToLegacyResults: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

import { Api } from '@/services/api';
import { shouldFallbackToLegacyResults, V8ResultsApi } from '@/services/api/v8/results';

import { loadResultsKpis } from '../../../../src/components/Results/kpiRuntime';

describe('loadResultsKpis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns v8 source when governed catalog resolves', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      initiatives: [],
      kpis: [],
      mappings: [],
    } as any);

    const result = await loadResultsKpis();

    expect(result.source).toBe('v8');
    expect(result.initiatives).toEqual([]);
    expect(result.kpis).toEqual([]);
  });

  it('falls back to legacy paths only for bounded compatibility statuses', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockRejectedValue({ status: 404 });
    vi.mocked(shouldFallbackToLegacyResults).mockReturnValue(true);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/benefits/kpis') {
        return {
          data: [{ id: 'kpi-1', name: 'Revenue Growth', latestValue: null, isOnTarget: false }],
        } as any;
      }
      if (url === '/benefits/kpi-mappings') {
        return { data: [] } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    const result = await loadResultsKpis();

    expect(result.source).toBe('legacy');
    expect(result.kpis).toHaveLength(1);
    expect(Api.get).toHaveBeenCalledWith('/benefits/kpis');
    expect(Api.get).toHaveBeenCalledWith('/benefits/kpi-mappings');
  });

  it('rethrows hard failures when fallback is not allowed', async () => {
    const err = { status: 500, message: 'server down' };
    vi.mocked(V8ResultsApi.getKpiCatalog).mockRejectedValue(err);
    vi.mocked(shouldFallbackToLegacyResults).mockReturnValue(false);

    await expect(loadResultsKpis()).rejects.toEqual(err);
  });
});
