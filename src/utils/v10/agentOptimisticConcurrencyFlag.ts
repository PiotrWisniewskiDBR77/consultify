/**
 * Chat V10 / V10-AGT-005 — feature flag for optimistic concurrency.
 *
 * Gates adoption of `throwIfStale` / `verifyExpectedVersions` at the
 * proposal-apply boundary. When ON, every apply pre-loads current
 * versions, compares against `expectedVersions`, and raises
 * `StaleProposalError` on drift. Default OFF. See `ADR-V10-002`.
 */

const LS_KEY = 'ff.agent_optimistic_concurrency';
const QUERY_KEY = 'ff_agent_optimistic_concurrency';
const ENV_KEY = 'VITE_AGENT_OPTIMISTIC_CONCURRENCY';

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

export function isAgentOptimisticConcurrencyEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const AGENT_OPTIMISTIC_CONCURRENCY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
