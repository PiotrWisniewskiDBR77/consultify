/**
 * Chat V10 / V10-OUT-012 — feature flag for OutcomeReversal
 * (reverses a previously-accepted outcome, branded OutcomeReversalId, closed
 * REVERSAL_REASONS catalogue, pure reverseOutcome reducer, reversal-terminal
 * + tenant-scoped invariants).
 *
 * Runtime contract lives in
 * `src/models/outcome/OutcomeReversal.ts`. Default OFF —
 * Wave A seed pins the reversal shape and four runtime invariants;
 * Wave B event-bus wiring and persistence attach to this contract.
 */

const LS_KEY = 'ff.outcome_reversal';
const QUERY_KEY = 'ff_outcome_reversal';
const ENV_KEY = 'VITE_OUTCOME_REVERSAL';

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

export function isOutcomeReversalEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const OUTCOME_REVERSAL_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
