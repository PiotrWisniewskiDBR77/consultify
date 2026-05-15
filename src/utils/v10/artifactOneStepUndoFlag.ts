/**
 * Chat V10 / V10-ART-013 — feature flag for one-step undo
 * (ReversibleTxn envelope + LIFO stack).
 *
 * Gates the `buildReversibleTxn` / `isUndoEligible` /
 * `pushUndoStack` / `popUndoStack` contract at the applier boundary.
 * Runtime contract lives in `src/models/artifact/ReversibleTxn.ts`.
 * Default OFF.
 */

const LS_KEY = 'ff.artifact_one_step_undo';
const QUERY_KEY = 'ff_artifact_one_step_undo';
const ENV_KEY = 'VITE_ARTIFACT_ONE_STEP_UNDO';

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

export function isArtifactOneStepUndoEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_ONE_STEP_UNDO_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
