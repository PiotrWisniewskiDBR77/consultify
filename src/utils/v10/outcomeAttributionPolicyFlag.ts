/**
 * Chat V10 / V10-OUT-004 — feature flag for the AttributionPolicyV1
 * (attribution policy contract, closed attribution methods, conservative
 * defaults invariant, weights-sum invariant, pure attribution reducer).
 *
 * Runtime contract lives in
 * `src/models/outcome/AttributionPolicyV1.ts`. Default OFF —
 * Wave A seed pins the policy shape, four closed method catalogue entries,
 * and five runtime invariants; Wave B passive decay scheduler and admin
 * audit logging bind to this contract.
 */

const LS_KEY = 'ff.outcome_attribution_policy';
const QUERY_KEY = 'ff_outcome_attribution_policy';
const ENV_KEY = 'VITE_OUTCOME_ATTRIBUTION_POLICY';

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

export function isOutcomeAttributionPolicyEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const OUTCOME_ATTRIBUTION_POLICY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
