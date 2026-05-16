/**
 * Chat V10 / V10-AGT-003 — feature flag for the OpType registry.
 *
 * What this flag gates
 * --------------------
 * Adoption of `OP_TYPE_REGISTRY` as the single source for op metadata
 * (severity floor, reversibility, tenant scope, canonical handler
 * path). Handler dispatch (V10-AGT-006..008) reads this table when
 * ON; legacy hard-coded op routing runs when OFF.
 *
 * Default: **OFF**. See `ADR-V10-002`.
 *
 * Resolution order
 * ----------------
 *   1. URL query   `?ff_agent_op_type_registry=0|1`
 *   2. localStorage `ff.agent_op_type_registry`
 *   3. env          `VITE_AGENT_OP_TYPE_REGISTRY`
 *   4. Hard default — `false`.
 */

const LS_KEY = 'ff.agent_op_type_registry';
const QUERY_KEY = 'ff_agent_op_type_registry';
const ENV_KEY = 'VITE_AGENT_OP_TYPE_REGISTRY';

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

export function isAgentOpTypeRegistryEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const AGENT_OP_TYPE_REGISTRY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
