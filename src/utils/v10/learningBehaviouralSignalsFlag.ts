/**
 * Chat V10 / V10-LRN-004 — feature flag for behavioural signals
 * (undo, abandon, edit-after-accept, reject-wrong-tool).
 *
 * Runtime contract lives in
 * `src/models/learning/BehaviouralSignals.ts`. Default OFF —
 * Wave A seed pins the event catalogue and pure anonymisation/redaction
 * helpers; Wave B event emitters and store bind to this flag.
 */

const LS_KEY = 'ff.learning_behavioural_signals';
const QUERY_KEY = 'ff_learning_behavioural_signals';
const ENV_KEY = 'VITE_LEARNING_BEHAVIOURAL_SIGNALS';

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

export function isLearningBehaviouralSignalsEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const LEARNING_BEHAVIOURAL_SIGNALS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
