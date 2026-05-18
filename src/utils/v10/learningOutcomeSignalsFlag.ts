/**
 * Chat V10 / V10-LRN-005 — feature flag for learning-side outcome signals
 * (wraps OutcomeSignalV1 with weight/decay for memory-pack adjustment).
 *
 * Runtime contract lives in
 * `src/models/learning/LearningOutcomeSignals.ts`. Default OFF —
 * Wave A seed pins the observation catalogue and pure mapping helpers;
 * Wave B emitters and pack-write path bind to this flag.
 */

const LS_KEY = 'ff.learning_outcome_signals';
const QUERY_KEY = 'ff_learning_outcome_signals';
const ENV_KEY = 'VITE_LEARNING_OUTCOME_SIGNALS';

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

export function isLearningOutcomeSignalsEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const LEARNING_OUTCOME_SIGNALS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
