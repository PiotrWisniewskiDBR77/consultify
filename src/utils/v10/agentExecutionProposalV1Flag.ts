/**
 * Chat V10 / V10-AGT-001 — feature flag for the `ExecutionProposalV1` envelope.
 *
 * What this flag gates
 * --------------------
 * Adoption of `src/models/agent/ExecutionProposalV1.ts` as the
 * single envelope for AI-originated mutations (R-AGENT-1). At Wave A
 * seed, the gate is dormant — the schema simply exists. It becomes
 * meaningful when the boundary validator (V10-AGT-026) and the first
 * apply path (V10-AGT-017 atomic executor) land.
 *
 * Default
 * -------
 * **OFF**. See `ADR-V10-002`.
 *
 * Resolution order
 * ----------------
 *   1. URL query   `?ff_agent_execution_proposal_v1=0|1`
 *   2. localStorage `ff.agent_execution_proposal_v1`
 *   3. env          `VITE_AGENT_EXECUTION_PROPOSAL_V1`
 *   4. Hard default — `false`.
 */

const LS_KEY = 'ff.agent_execution_proposal_v1';
const QUERY_KEY = 'ff_agent_execution_proposal_v1';
const ENV_KEY = 'VITE_AGENT_EXECUTION_PROPOSAL_V1';

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

export function isAgentExecutionProposalV1Enabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const AGENT_EXECUTION_PROPOSAL_V1_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
