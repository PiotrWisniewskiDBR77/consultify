/**
 * Chat V10 / V10-CON-014 — feature flag for AclPropagation
 * (propagates ACL changes to retrieval cache invalidations, branded
 * AclPropagationId, closed ACL_CHANGE_KINDS catalogue, pure
 * planAclPropagation reducer, revoke-terminal + tenant-scoped +
 * source-ref-affected + deterministic invariants).
 *
 * Runtime contract lives in
 * `src/models/connectors/AclPropagation.ts`. Default OFF —
 * Wave A seed pins the ACL propagation shape and invariants;
 * Wave B cache invalidation attaches to this contract.
 */

const LS_KEY = 'ff.connectors_acl_propagation';
const QUERY_KEY = 'ff_connectors_acl_propagation';
const ENV_KEY = 'VITE_CONNECTORS_ACL_PROPAGATION';

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

export function isConnectorsAclPropagationEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const CONNECTORS_ACL_PROPAGATION_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
