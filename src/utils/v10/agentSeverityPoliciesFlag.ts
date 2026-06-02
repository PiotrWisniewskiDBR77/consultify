/**
 * Chat V10 / V10-AGT-002 — feature flag for the Severity S0..S4 policy table.
 *
 * What this flag gates
 * --------------------
 * Adoption of `SEVERITY_POLICIES` as the single lookup for severity
 * defaults (approval mode, undo window, audit retention, UI affordance).
 * Per-severity enforcement tickets (V10-AGT-009..013) will route
 * through this table when the flag is ON; until then callers fall
 * through to legacy ad-hoc severity handling.
 *
 * Default: **OFF**. See `ADR-V10-002`.
 *
 * Resolution order
 * ----------------
 *   1. URL query   `?ff_agent_severity_policies=0|1`
 *   2. localStorage `ff.agent_severity_policies`
 *   3. env          `VITE_AGENT_SEVERITY_POLICIES`
 *   4. Hard default — `false`.
 */

const LS_KEY = 'ff.agent_severity_policies';
const QUERY_KEY = 'ff_agent_severity_policies';
const ENV_KEY = 'VITE_AGENT_SEVERITY_POLICIES';

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

export function isAgentSeverityPoliciesEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const AGENT_SEVERITY_POLICIES_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
