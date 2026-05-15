/**
 * Chat V10 / V10-AGT-016 — feature flag for CheckpointStore +
 * resume-from-checkpoint.
 *
 * Gates `shouldCheckpoint` / `registerCheckpoint` /
 * `resolveResumePoint` at the agent-runtime ingress. Runtime contract
 * lives in `src/models/agent/CheckpointStore.ts`. Default OFF — the
 * Wave A seed pins the schema + pure helpers; the WAL + resume driver
 * land in Wave B (V10-AGT-022).
 */

const LS_KEY = 'ff.agent_checkpoint_store';
const QUERY_KEY = 'ff_agent_checkpoint_store';
const ENV_KEY = 'VITE_AGENT_CHECKPOINT_STORE';

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

export function isAgentCheckpointStoreEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const AGENT_CHECKPOINT_STORE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
