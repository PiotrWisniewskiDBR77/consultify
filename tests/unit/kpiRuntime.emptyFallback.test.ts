import { describe, it, expect, vi, beforeEach } from 'vitest';

const getKpiCatalog = vi.fn();
const apiGet = vi.fn();
const shouldUseShowcase = vi.fn(() => false);

vi.mock('@/services/api', () => ({ Api: { get: (...a: unknown[]) => apiGet(...a) } }));
vi.mock('@/services/api/v8/results', () => ({
  V8ResultsApi: { getKpiCatalog: (...a: unknown[]) => getKpiCatalog(...a) },
  shouldFallbackToLegacyResults: (e: any) => [400, 404, 405, 501].includes(Number(e?.status)),
}));
vi.mock('@/components/Results/kpiDomain', () => ({ mapResultsKpis: (kpis: unknown[]) => kpis ?? [] }));
vi.mock('./kpiDomain', () => ({ mapResultsKpis: (kpis: unknown[]) => kpis ?? [] }));
vi.mock('@/components/Results/resultsShowcaseData', () => ({
  createResultsShowcaseInitiatives: () => [{ id: 'sc-i' }],
  createResultsShowcaseKpis: () => [{ id: 'sc-k' }],
  shouldUseResultsShowcaseData: () => shouldUseShowcase(),
}));
vi.mock('./resultsShowcaseData', () => ({
  createResultsShowcaseInitiatives: () => [{ id: 'sc-i' }],
  createResultsShowcaseKpis: () => [{ id: 'sc-k' }],
  shouldUseResultsShowcaseData: () => shouldUseShowcase(),
}));

import { loadResultsKpis } from '../../src/components/Results/kpiRuntime';

describe('loadResultsKpis — empty-v8 → legacy fallback (Z82 split-brain)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldUseShowcase.mockReturnValue(false);
  });

  it('uses v8 when v8 has data', async () => {
    getKpiCatalog.mockResolvedValue({ initiatives: [{ id: 'i1' }], kpis: [{ id: 'k1' }], mappings: [] });
    const r = await loadResultsKpis();
    expect(r.source).toBe('v8');
    expect(r.kpis).toHaveLength(1);
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('★ falls back to legacy when v8 returns empty-200 but legacy has data', async () => {
    getKpiCatalog.mockResolvedValue({ initiatives: [], kpis: [], mappings: [] });
    apiGet.mockImplementation((path: string) =>
      path.includes('/benefits/kpis')
        ? Promise.resolve({ data: [{ id: 'legacy-k1' }, { id: 'legacy-k2' }] })
        : Promise.resolve({ data: [] })
    );
    const r = await loadResultsKpis();
    expect(r.source).toBe('legacy');
    expect(r.kpis).toHaveLength(2);
  });

  it('returns empty v8 when both v8 and legacy are empty', async () => {
    getKpiCatalog.mockResolvedValue({ initiatives: [], kpis: [], mappings: [] });
    apiGet.mockResolvedValue({ data: [] });
    const r = await loadResultsKpis();
    expect(r.source).toBe('v8');
    expect(r.kpis).toHaveLength(0);
  });

  it('prefers showcase over legacy when showcase is enabled and v8 empty', async () => {
    shouldUseShowcase.mockReturnValue(true);
    getKpiCatalog.mockResolvedValue({ initiatives: [], kpis: [], mappings: [] });
    const r = await loadResultsKpis();
    expect(r.source).toBe('showcase');
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('falls back to legacy when v8 errors with 404', async () => {
    getKpiCatalog.mockRejectedValue({ status: 404 });
    apiGet.mockImplementation((path: string) =>
      path.includes('/benefits/kpis')
        ? Promise.resolve({ data: [{ id: 'legacy-k1' }] })
        : Promise.resolve({ data: [] })
    );
    const r = await loadResultsKpis();
    expect(r.source).toBe('legacy');
    expect(r.kpis).toHaveLength(1);
  });
});
