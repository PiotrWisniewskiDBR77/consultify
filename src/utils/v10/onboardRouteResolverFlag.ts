/**
 * Chat V10 / V10-ONB-003 — feature flag for the admin-first vs
 * user-first onboarding route resolver.
 *
 * What this flag gates
 * --------------------
 * Routing the first authenticated session through
 * `resolveOnboardingRoute` instead of the V9 generic onboarding
 * entry. When ON, the wizard reads `ONBOARDING_ROUTE_STEPS` to drive
 * step order; when OFF, the V9 linear flow runs.
 *
 * Default: **OFF**. See `ADR-V10-002`.
 *
 * Resolution order
 * ----------------
 *   1. URL query   `?ff_onboard_route_resolver=0|1`
 *   2. localStorage `ff.onboard_route_resolver`
 *   3. env          `VITE_ONBOARD_ROUTE_RESOLVER`
 *   4. Hard default — `false`.
 */

const LS_KEY = 'ff.onboard_route_resolver';
const QUERY_KEY = 'ff_onboard_route_resolver';
const ENV_KEY = 'VITE_ONBOARD_ROUTE_RESOLVER';

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

export function isOnboardRouteResolverEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_ROUTE_RESOLVER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
