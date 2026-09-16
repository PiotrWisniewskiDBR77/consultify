const QUERY_KEY = 'ff_deckReview';

/**
 * DEC-543 / U-43 — opt-in rollout for the simplified Deck Builder review.
 *
 * The URL override is intentionally session-local and exists for acceptance
 * evidence. Production remains OFF unless VITE_DECK_REVIEW_SIMPLE=true.
 */
export function isDeckReviewSimpleEnabled(): boolean {
  if (typeof window !== 'undefined' && window.location) {
    const value = new URLSearchParams(window.location.search).get(QUERY_KEY);
    if (value === '1' || value === 'true') return true;
    if (value === '0' || value === 'false') return false;
  }

  return import.meta.env.VITE_DECK_REVIEW_SIMPLE === 'true';
}
