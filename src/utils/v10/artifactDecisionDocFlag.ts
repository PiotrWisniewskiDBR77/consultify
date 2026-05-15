/**
 * Chat V10 / V10-ART-019 — feature flag for the decision_doc
 * typed schema + addressability + unresolved-panel visibility
 * invariants.
 *
 * Runtime contract lives in
 * `src/models/artifact/DecisionDocSchema.ts`. Default OFF — the
 * Wave A seed pins the schema + pure accessors + visibility
 * predicate; the one-pager renderer + drill-down view land in
 * Wave B.
 */

const LS_KEY = 'ff.artifact_decision_doc';
const QUERY_KEY = 'ff_artifact_decision_doc';
const ENV_KEY = 'VITE_ARTIFACT_DECISION_DOC';

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

export function isArtifactDecisionDocEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_DECISION_DOC_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
