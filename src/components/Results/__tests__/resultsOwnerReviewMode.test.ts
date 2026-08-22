// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getKpiCatalog, legacyGet, showcaseEnabled } = vi.hoisted(() => ({
  getKpiCatalog: vi.fn(),
  legacyGet: vi.fn(),
  showcaseEnabled: vi.fn(() => false),
}));

vi.mock('@/services/api', () => ({ Api: { get: legacyGet } }));
vi.mock('@/services/api/v8/results', () => ({
  V8ResultsApi: { getKpiCatalog },
  shouldFallbackToLegacyResults: () => true,
}));
vi.mock('../resultsShowcaseData', () => ({
  shouldUseResultsShowcaseData: showcaseEnabled,
  createResultsShowcaseInitiatives: vi.fn(() => [{ initiativeId: 'showcase' }]),
  createResultsShowcaseKpis: vi.fn(() => [{ id: 'showcase' }]),
}));

import { loadResultsKpis } from '../kpiRuntime';
import { isResultsOwnerReviewModeEnabled } from '../resultsOwnerReviewMode';
import { isResultsVNextFlagEnabled } from '../../ResultsVNext/resultsVNextFeatureFlags';

describe('Wave 3 Results owner-review profile', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('ff.wave3_results_owner_review', '1');
    getKpiCatalog.mockReset();
    legacyGet.mockReset();
    showcaseEnabled.mockClear();
  });

  it('explicitly enables all three canonical registries and persists across navigation', () => {
    expect(isResultsOwnerReviewModeEnabled()).toBe(true);
    expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(true);
    expect(isResultsVNextFlagEnabled('roiRegistry')).toBe(true);
    expect(isResultsVNextFlagEnabled('okrRegistry')).toBe(true);

    expect(isResultsOwnerReviewModeEnabled()).toBe(true);
  });

  it('keeps a canonical 200-empty result and never reads legacy or showcase data', async () => {
    getKpiCatalog.mockResolvedValue({ initiatives: [], kpis: [], mappings: [] });
    showcaseEnabled.mockReturnValue(true);

    await expect(loadResultsKpis()).resolves.toEqual({
      initiatives: [],
      kpis: [],
      source: 'v8',
    });
    expect(legacyGet).not.toHaveBeenCalled();
    expect(showcaseEnabled).not.toHaveBeenCalled();
  });

  it('surfaces a canonical API failure and never falls back to legacy', async () => {
    const failure = new Error('canonical unavailable');
    getKpiCatalog.mockRejectedValue(failure);

    await expect(loadResultsKpis()).rejects.toBe(failure);
    expect(legacyGet).not.toHaveBeenCalled();
  });
});
