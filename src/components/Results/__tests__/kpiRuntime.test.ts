import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDashboard, getKpiCatalog } = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  getKpiCatalog: vi.fn(),
}));

vi.mock('@/services/api/v8/results', () => ({
  V8ResultsApi: { getDashboard, getKpiCatalog },
  shouldFallbackToLegacyResults: () => false,
}));

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn() },
}));

vi.mock('../resultsShowcaseData', () => ({
  createResultsShowcaseInitiatives: () => [],
  createResultsShowcaseKpis: () => [],
  shouldUseResultsShowcaseData: () => false,
}));

import { loadResultsDashboard, loadResultsKpis } from '../kpiRuntime';

describe('Results runtime response truth', () => {
  beforeEach(() => {
    getDashboard.mockReset();
    getKpiCatalog.mockReset();
  });

  it('accepts the valid nested KPI catalog envelope', async () => {
    getKpiCatalog.mockResolvedValue({
      data: {
        data: {
          initiatives: [{ id: 'initiative-1', name: 'Initiative One' }],
          kpis: [{ id: 'kpi-1', name: 'Throughput' }],
          mappings: [],
        },
        meta: { contract: 'results-v8' },
      },
    });

    const result = await loadResultsKpis();

    expect(result.source).toBe('v8');
    expect(result.initiatives).toHaveLength(1);
    expect(result.kpis).toHaveLength(1);
    expect(result.kpis[0]?.name).toBe('Throughput');
  });

  it('accepts an empty V8 catalog when legacy Api.get returns its real Proxy shape', async () => {
    getKpiCatalog.mockResolvedValue({
      data: {
        organizationId: 'org-1',
        initiatives: [],
        kpis: [],
        mappings: [],
      },
      meta: { contract: 'results-v8' },
    });

    const makeGenericApiResponse = (data: unknown) =>
      new Proxy(
        { success: true, data },
        {
          get(target, prop, receiver) {
            if (prop === 'data') return target;
            return Reflect.get(target, prop, receiver);
          },
        }
      );
    const { Api } = await import('@/services/api');
    vi.mocked(Api.get)
      .mockResolvedValueOnce(makeGenericApiResponse([]))
      .mockResolvedValueOnce(makeGenericApiResponse([]));

    await expect(loadResultsKpis()).resolves.toEqual({
      initiatives: [],
      kpis: [],
      source: 'v8',
    });
  });

  it('does not request a dashboard without a real initiative scope', async () => {
    await expect(loadResultsDashboard(undefined)).resolves.toBeNull();
    await expect(loadResultsDashboard('   ')).resolves.toBeNull();
    expect(getDashboard).not.toHaveBeenCalled();
  });

  it('requests and returns a scoped dashboard snapshot', async () => {
    const snapshot = { organizationId: 'org-1' };
    getDashboard.mockResolvedValue({ snapshot });

    await expect(loadResultsDashboard(' initiative-1 ')).resolves.toBe(snapshot);
    expect(getDashboard).toHaveBeenCalledWith({ initiativeId: 'initiative-1' });
  });
});
