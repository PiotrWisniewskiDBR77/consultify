/**
 * Chat V10 / V10-OUT-002 — feature flag for `OutcomeRecordV1`
 * (durable outcome record, closed state catalogue, transition-rules
 * reducer, ≥1-signal + attribution-pinned + closed-transitions invariants).
 *
 * Runtime contract lives in
 * `src/models/outcome/OutcomeRecordV1.ts`. Default OFF —
 * Wave A seed pins the schema and three record-level invariants;
 * Wave B double-count guard and revert emission bind to this contract.
 */

const LS_KEY = 'ff.outcome_record';
const QUERY_KEY = 'ff_outcome_record';
const ENV_KEY = 'VITE_OUTCOME_RECORD';

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

export function isOutcomeRecordEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const OUTCOME_RECORD_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
