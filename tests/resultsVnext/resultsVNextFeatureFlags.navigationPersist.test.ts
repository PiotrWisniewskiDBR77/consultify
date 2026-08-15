import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isResultsVNextFlagEnabled, RESULTS_VNEXT_FLAG_KEYS } from '../../src/components/ResultsVNext/resultsVNextFeatureFlags';

function setLocationSearch(search: string): void {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
  });
}

describe('RES-001 Results VNext canonical cutover', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });
  afterEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });

  it.each(['kpiRegistry', 'roiRegistry', 'okrRegistry'] as const)(
    '%s is enabled for an ordinary build',
    (flag) => {
    expect(isResultsVNextFlagEnabled(flag)).toBe(true);
    }
  );

  it('does not depend on query or localStorage and does not write browser state', () => {
    const keys = RESULTS_VNEXT_FLAG_KEYS.kpiRegistry;
    window.localStorage.setItem(keys.localStorage, '0');
    setLocationSearch(`?${keys.query}=0`);
    expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(true);
    expect(window.localStorage.getItem(keys.localStorage)).toBe('0');
  });

  it('keeps domains isolated from stale browser overrides', () => {
    window.localStorage.setItem(RESULTS_VNEXT_FLAG_KEYS.roiRegistry.localStorage, '0');
    expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(true);
    expect(isResultsVNextFlagEnabled('roiRegistry')).toBe(true);
    expect(isResultsVNextFlagEnabled('okrRegistry')).toBe(true);
  });
});
