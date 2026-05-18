/**
 * Chat V10 / V10-ONB-018 — feature flag for the first-run tenant
 * bootstrap contract (10 object kinds × SLA p99 10_000 ms ×
 * idempotent × GDPR-deletable).
 *
 * Runtime contract lives in
 * `src/models/onboarding/TenantBootstrap.ts`. Default OFF — the
 * Wave A seed pins the schema, the coverage / SLA / idempotency /
 * deletability invariants as pure validators; the Postgres-level
 * driver + template-pack fan-out land in Wave B.
 */

const LS_KEY = 'ff.onboard_tenant_bootstrap';
const QUERY_KEY = 'ff_onboard_tenant_bootstrap';
const ENV_KEY = 'VITE_ONBOARD_TENANT_BOOTSTRAP';

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

export function isOnboardTenantBootstrapEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_TENANT_BOOTSTRAP_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
