/**
 * Chat V10 / V10-ART-028 — feature flag for role-based approval
 * gates (Wave A seed).
 *
 * Runtime contract lives in
 * `src/models/artifact/RoleBasedApprovalGates.ts`. Default OFF —
 * Wave A seed pins the 5-role catalogue, 4 match kinds, and six
 * invariants; the Wave B review workflow consults the routing
 * table only when this flag is ON.
 */

const LS_KEY = 'ff.artifact_role_based_approval_gates';
const QUERY_KEY = 'ff_artifact_role_based_approval_gates';
const ENV_KEY = 'VITE_ARTIFACT_ROLE_BASED_APPROVAL_GATES';

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

export function isArtifactRoleBasedApprovalGatesEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_ROLE_BASED_APPROVAL_GATES_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
