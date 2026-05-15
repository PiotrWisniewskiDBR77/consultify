/**
 * Chat V10 / V10-ONB-019 — feature flag for the conservative-
 * defaults baseline (new-tenant policy manifest floor).
 *
 * Runtime contract lives in
 * `src/models/onboarding/ConservativeDefaults.ts`.
 *
 * **On-by-construction** (default: `true`). Dev plan §6 pins this
 * flag as on-by-construction (CI invariant 40) — disabling would
 * let a bootstrap job seed a tenant with looser defaults, which
 * breaches the "100% of new tenants default-safe" rule. Joins the
 * `ON_BY_CONSTRUCTION_ALLOWLIST` in chatV10FeatureFlags.test.ts.
 */

const LS_KEY = 'ff.onboard_conservative_defaults';
const QUERY_KEY = 'ff_onboard_conservative_defaults';
const ENV_KEY = 'VITE_ONBOARD_CONSERVATIVE_DEFAULTS';

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
    return parsed === null ? true : parsed;
  } catch {
    return true;
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

export function isOnboardConservativeDefaultsEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_CONSERVATIVE_DEFAULTS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
