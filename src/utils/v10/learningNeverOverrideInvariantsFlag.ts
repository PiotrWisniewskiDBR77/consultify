/**
 * Chat V10 / V10-LRN-011 — feature flag for never-override invariants guard.
 *
 * Runtime contract lives in `src/models/learning/NeverOverrideInvariants.ts`.
 * ON-by-construction — the never-override guard is a safety + compliance
 * property that ships unconditionally. The flag is provided for emergency
 * circuit-breaking only.
 */

const LS_KEY = 'ff.learning_never_override_invariants';
const QUERY_KEY = 'ff_learning_never_override_invariants';
const ENV_KEY = 'VITE_LEARNING_NEVER_OVERRIDE_INVARIANTS';

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

export function isLearningNeverOverrideInvariantsEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const LEARNING_NEVER_OVERRIDE_INVARIANTS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
