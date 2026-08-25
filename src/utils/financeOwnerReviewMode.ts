const QUERY_KEY = 'ff_wave3FinanceOwnerReview';
const STORAGE_KEY = 'ff.wave3_finance_owner_review';
const ENV_KEY = 'VITE_WAVE3_FINANCE_OWNER_REVIEW';

function enabled(value: string | null | undefined): boolean | null {
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'on', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'off', 'no'].includes(normalized)) return false;
  return null;
}

/** Explicit, never hostname-derived, canonical-only Finance review profile. */
export function isFinanceOwnerReviewModeEnabled(): boolean {
  if (typeof window !== 'undefined') {
    if (isPublicProductionHost(window.location?.hostname ?? '')) return false;
    try {
      const query = enabled(new URLSearchParams(window.location.search).get(QUERY_KEY));
      if (query !== null) {
        window.localStorage?.setItem(STORAGE_KEY, query ? '1' : '0');
        return query;
      }
      const stored = enabled(window.localStorage?.getItem(STORAGE_KEY));
      if (stored !== null) return stored;
    } catch {
      // Explicit build configuration remains available when storage is blocked.
    }
  }
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    return enabled(env?.[ENV_KEY]) === true;
  } catch {
    return false;
  }
}

export const FINANCE_OWNER_REVIEW_FLAG = {
  query: QUERY_KEY,
  localStorage: STORAGE_KEY,
  env: ENV_KEY,
} as const;
import { isPublicProductionHost } from './publicProduction';
