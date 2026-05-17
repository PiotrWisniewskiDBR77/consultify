/**
 * Chat V10 / V10-OUT-005 — feature flag for LineageBinding
 * (lineage DAG builder binding OutcomeSignalV1 to upstream sources,
 * closed LINEAGE_EDGE_KINDS catalogue, assertLineageAcyclic DAG invariant,
 * pure buildLineage reducer).
 *
 * Runtime contract lives in
 * `src/models/outcome/LineageBinding.ts`. Default OFF —
 * Wave A seed pins the edge shape, closed kind catalogue, and DAG invariant;
 * Wave B lineage persistence and cross-signal chaining bind to this contract.
 */

const LS_KEY = 'ff.outcome_lineage_binding';
const QUERY_KEY = 'ff_outcome_lineage_binding';
const ENV_KEY = 'VITE_OUTCOME_LINEAGE_BINDING';

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

export function isOutcomeLineageBindingEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const OUTCOME_LINEAGE_BINDING_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
