/**
 * Chat V10 / V10-AGT-023 — feature flag for SwarmDefinitionV1
 * (Wave C multi-agent fan-out/fan-in with distinct roles +
 * coordinator + synthesis).
 *
 * Runtime contract lives in
 * `src/models/agent/SwarmDefinitionV1.ts`. Default OFF — Wave
 * A seed pins the schema + distinct-roles rule +
 * coordinator/synthesis distinctness + budget-share
 * arithmetic; the Wave C swarm scheduler binds to this shape.
 */

const LS_KEY = 'ff.agent_swarm_definition';
const QUERY_KEY = 'ff_agent_swarm_definition';
const ENV_KEY = 'VITE_AGENT_SWARM_DEFINITION';

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

export function isAgentSwarmDefinitionEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const AGENT_SWARM_DEFINITION_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
