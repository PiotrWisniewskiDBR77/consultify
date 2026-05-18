/**
 * Chat V10 / V10-CON-013 — feature flag for RateLimitBackoff
 * (rate limit + backoff contract across connectors, branded RateLimitDecisionId,
 * closed BACKOFF_STRATEGIES catalogue, pure nextRetryDelay reducer, monotonic +
 * delay-bounded + strategy-catalogue + deterministic + attempt-non-negative
 * invariants).
 *
 * Runtime contract lives in
 * `src/models/connectors/RateLimitBackoff.ts`. Default OFF —
 * Wave A seed pins the rate limit backoff shape and invariants;
 * Wave B HTTP retry logic attaches to this contract.
 */

const LS_KEY = 'ff.connectors_rate_limit_backoff';
const QUERY_KEY = 'ff_connectors_rate_limit_backoff';
const ENV_KEY = 'VITE_CONNECTORS_RATE_LIMIT_BACKOFF';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const parsed = parseFlag(meta?.env?.[ENV_KEY]);
    return parsed === null ? false : parsed;
  } catch {
    return false;
  }
}

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorage(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(LS_KEY));
  } catch {
    return null;
  }
}

export function isConnectorsRateLimitBackoffEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const CONNECTORS_RATE_LIMIT_BACKOFF_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
