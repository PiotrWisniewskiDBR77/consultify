import { afterEach, describe, expect, it, vi } from 'vitest';

import { isDeckReviewSimpleEnabled } from '../deckReviewFlag';

describe('deck review rollout flag', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is off by default', () => {
    expect(isDeckReviewSimpleEnabled()).toBe(false);
  });

  it('turns on only for an explicit true build flag', () => {
    vi.stubEnv('VITE_DECK_REVIEW_SIMPLE', 'true');
    expect(isDeckReviewSimpleEnabled()).toBe(true);

    vi.stubEnv('VITE_DECK_REVIEW_SIMPLE', 'false');
    expect(isDeckReviewSimpleEnabled()).toBe(false);
  });
});
