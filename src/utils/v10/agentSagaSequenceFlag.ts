/**
 * Chat V10 / V10-AGT-018 — feature flag for the Sequential
 * compensating sequence (Saga pattern) for S3 blast-radius
 * cross-entity mutations.
 *
 * Runtime contract lives in `src/models/agent/SagaSequence.ts`.
 * Default OFF — Wave A seed pins the schema + pure simulator +
 * escalation contract; the multi-entity execution driver lands
 * in Wave B.
 */

const LS_KEY = 'ff.agent_saga_sequence';
const QUERY_KEY = 'ff_agent_saga_sequence';
const ENV_KEY = 'VITE_AGENT_SAGA_SEQUENCE';

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

export function isAgentSagaSequenceEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const AGENT_SAGA_SEQUENCE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
