/**
 * Chat V10 / V10-AGT-015 — feature flag for the durable
 * QueueExecutor (LISTEN/NOTIFY + polling + exponential-backoff
 * retries + DLQ).
 *
 * Gates the QueueExecutor schema contracts (`JobStatus` FSM,
 * `computeNextRetryAt`, `buildDeadLetterRow`) at the service
 * boundary. Runtime contract lives in
 * `src/models/agent/QueueExecutor.ts`. Default OFF — the Wave A
 * seed is schema-only; the executor service lands in Wave B.
 */

const LS_KEY = 'ff.agent_queue_executor';
const QUERY_KEY = 'ff_agent_queue_executor';
const ENV_KEY = 'VITE_AGENT_QUEUE_EXECUTOR';

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

export function isAgentQueueExecutorEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const AGENT_QUEUE_EXECUTOR_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
