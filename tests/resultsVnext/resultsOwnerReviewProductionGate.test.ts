import { afterEach, describe, expect, it, vi } from 'vitest';

import { isResultsOwnerReviewModeEnabled } from '../../src/components/Results/resultsOwnerReviewMode';

describe('Results owner-review production gate', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fails closed for an explicit query on the public production host', () => {
    vi.stubGlobal('window', {
      location: { search: '?ff_wave3ResultsOwnerReview=1', hostname: 'www.consultify.ai' },
      localStorage: { getItem: vi.fn(), setItem: vi.fn() },
    });

    expect(isResultsOwnerReviewModeEnabled()).toBe(false);
  });

  it('fails closed for a persisted override on the public production host', () => {
    const getItem = vi.fn(() => '1');
    vi.stubGlobal('window', {
      location: { search: '', hostname: 'consultify.ai' },
      localStorage: { getItem, setItem: vi.fn() },
    });

    expect(isResultsOwnerReviewModeEnabled()).toBe(false);
    expect(getItem).not.toHaveBeenCalled();
  });
});
