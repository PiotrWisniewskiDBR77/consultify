/**
 * Chat V10 / V10-ONB-020 — feature flag for the 20 s OAuth
 * fallback path (honest-fallback contract on first-connector
 * OAuth failure).
 *
 * Runtime contract lives in
 * `src/models/onboarding/OAuthFallback.ts`. Default OFF — Wave A
 * seed pins the 20 s budget, the closed waiter-outcome and
 * fallback-option catalogues, the pure reducer, and the
 * "fallback rendered on 100% of failures", "connector context
 * preserved", "live sync warning present", and "no demo
 * substitute" invariants. The Wave B OAuth UI + real provider
 * adapters bind to this shape.
 */

const LS_KEY = 'ff.onboard_oauth_fallback';
const QUERY_KEY = 'ff_onboard_oauth_fallback';
const ENV_KEY = 'VITE_ONBOARD_OAUTH_FALLBACK';

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

export function isOnboardOAuthFallbackEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_OAUTH_FALLBACK_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
