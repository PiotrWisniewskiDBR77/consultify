/**
 * Chat V10 / V10-RSN-003 — feature flag for the reasoning scope
 * resolver (entities / sources / artifacts / ACL union).
 *
 * Runtime contract lives in
 * `src/models/reasoning/ScopeResolver.ts`. Default OFF —
 * Wave A seed pins the 3-kind SCOPE_RESOLUTION_KINDS catalogue,
 * the pure `resolveScope` reducer, ACL union derivation, and the
 * four runtime invariants; the Wave B connector ACL integration
 * (V10-CON-014) and clarification UI (V10-RSN-022) bind to this contract.
 */

const LS_KEY = 'ff.reasoning_scope_resolver';
const QUERY_KEY = 'ff_reasoning_scope_resolver';
const ENV_KEY = 'VITE_REASONING_SCOPE_RESOLVER';

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

export function isReasoningScopeResolverEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const REASONING_SCOPE_RESOLVER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
