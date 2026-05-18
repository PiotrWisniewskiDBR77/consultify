/**
 * Chat V10 / V10-AGT-020 — feature flag for fan-out / fan-in
 * parallel-execution plans.
 *
 * Runtime contract lives in `src/models/agent/FanOutFanIn.ts`.
 * Default OFF — V10-AGT-020 is dev-plan **Wave C scope** ("ship
 * only after core executors proven"); Wave A seed pins the
 * schema + pure reducer + the "fan-in waits for all" + "abort
 * propagates up" invariants. The actual parallel-execution
 * driver lands in V10-AGT-023.
 */

const LS_KEY = 'ff.agent_fan_out_fan_in';
const QUERY_KEY = 'ff_agent_fan_out_fan_in';
const ENV_KEY = 'VITE_AGENT_FAN_OUT_FAN_IN';

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

export function isAgentFanOutFanInEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const AGENT_FAN_OUT_FAN_IN_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
