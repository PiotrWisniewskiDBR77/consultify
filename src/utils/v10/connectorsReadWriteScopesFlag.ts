/**
 * Chat V10 / V10-CON-007 — feature flag for ReadWriteScopes
 * (splits connector scopes into read vs write sets, closed SCOPE_CLASSES
 * catalogue, explicit write-consent + admin-role invariants, pure
 * assertReadWriteSplit validator, requiredWriteScopes helper).
 *
 * Runtime contract lives in
 * `src/models/connectors/ReadWriteScopes.ts`. Default OFF —
 * Wave A seed pins the scope-split shape and four runtime invariants;
 * Wave B consent-persistence and scope introspection attach to this contract.
 */

const LS_KEY = 'ff.connectors_read_write_scopes';
const QUERY_KEY = 'ff_connectors_read_write_scopes';
const ENV_KEY = 'VITE_CONNECTORS_READ_WRITE_SCOPES';

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

export function isConnectorsReadWriteScopesEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const CONNECTORS_READ_WRITE_SCOPES_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
