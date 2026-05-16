/**
 * Chat V10 / V10-AGT-019 — feature flag for the Approval barrier
 * sequence (pause-for-human between steps).
 *
 * Runtime contract lives in
 * `src/models/agent/ApprovalBarrierSequence.ts`. Default OFF —
 * Wave A seed pins the schema, the pause / resume pure simulator,
 * the `agent.approval_required` event-emission invariant, and
 * the "resume re-enters ledger at correct step" post-condition;
 * the Wave B barrier executor that persists pauses to the ledger
 * + awaits operator input lands in V10-AGT-024 (interrupt verbs).
 */

const LS_KEY = 'ff.agent_approval_barrier';
const QUERY_KEY = 'ff_agent_approval_barrier';
const ENV_KEY = 'VITE_AGENT_APPROVAL_BARRIER';

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

export function isAgentApprovalBarrierEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const AGENT_APPROVAL_BARRIER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
