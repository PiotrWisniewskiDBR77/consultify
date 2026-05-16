/**
 * Chat V10 / V10-LRN-007 — feature flag for TTL + forgetting
 * (memory pack expiry and purge logic).
 *
 * Runtime contract lives in
 * `src/models/learning/TtlForgetting.ts`. ON-by-construction —
 * TTL/forgetting is a safety property that must be active whenever the
 * memory pack is in use; it ships with the pack (V10-LRN-006).
 */

const LS_KEY = 'ff.learning_ttl_forgetting';
const QUERY_KEY = 'ff_learning_ttl_forgetting';
const ENV_KEY = 'VITE_LEARNING_TTL_FORGETTING';

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

export function isLearningTtlForgettingEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const LEARNING_TTL_FORGETTING_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
