// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

// NOTE (ciecie ResultsHub, 2026-09-02): this file used to also cover
// `loadResultsKpis` from `../kpiRuntime`, mocking `../resultsShowcaseData` and
// the legacy V8/Api clients. `kpiRuntime.ts` and `resultsShowcaseData.ts` were
// deleted with the retired ResultsHub subtree, so those two cases went with
// them. What remains is the LIVE surface: the owner-review flag and the three
// canonical ResultsVNext registries it unlocks. `resultsOwnerReviewMode.ts`
// stays because `src/components/ResultsVNext/resultsVNextFeatureFlags.ts:29`
// imports it.
import { isResultsOwnerReviewModeEnabled } from '../resultsOwnerReviewMode';
import { isResultsVNextFlagEnabled } from '../../ResultsVNext/resultsVNextFeatureFlags';

describe('Wave 3 Results owner-review profile', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('ff.wave3_results_owner_review', '1');
  });

  it('explicitly enables all three canonical registries and persists across navigation', () => {
    expect(isResultsOwnerReviewModeEnabled()).toBe(true);
    expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(true);
    expect(isResultsVNextFlagEnabled('roiRegistry')).toBe(true);
    expect(isResultsVNextFlagEnabled('okrRegistry')).toBe(true);

    expect(isResultsOwnerReviewModeEnabled()).toBe(true);
  });
});
