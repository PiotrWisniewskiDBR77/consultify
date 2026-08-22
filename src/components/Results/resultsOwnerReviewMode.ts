const QUERY_KEY = 'ff_wave3ResultsOwnerReview';
const STORAGE_KEY = 'ff.wave3_results_owner_review';
const ENV_KEY = 'VITE_WAVE3_RESULTS_OWNER_REVIEW';

function parseEnabled(value: string | null | undefined): boolean | null {
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'on', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'off', 'no'].includes(normalized)) return false;
  return null;
}

/**
 * Explicit owner-review profile for Results. It enables the three canonical
 * registries and forbids legacy/showcase fallback; it is never enabled by
 * hostname or development mode alone.
 */
export function isResultsOwnerReviewModeEnabled(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const query = parseEnabled(new URLSearchParams(window.location.search).get(QUERY_KEY));
      if (query !== null) {
        window.localStorage?.setItem(STORAGE_KEY, query ? '1' : '0');
        return query;
      }
      const stored = parseEnabled(window.localStorage?.getItem(STORAGE_KEY));
      if (stored !== null) return stored;
    } catch {
      // Storage can be unavailable. The explicit build env remains usable.
    }
  }
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    return parseEnabled(env?.[ENV_KEY]) === true;
  } catch {
    return false;
  }
}

export const RESULTS_OWNER_REVIEW_FLAG = {
  query: QUERY_KEY,
  localStorage: STORAGE_KEY,
  env: ENV_KEY,
} as const;
