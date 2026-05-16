/**
 * Chat V10 / V10-AGT-014 — feature flag for the Run Ledger core schema.
 *
 * **On-by-construction.** Per master plan §4.3 and
 * `AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md § "Flags to register
 * at implementation time"`, this flag ships `default: true`. The
 * ledger is a safety-critical audit surface — disabling it is an
 * incident-response kill switch only. V10 CI invariant 23 mirror
 * asserts membership in the on-by-construction allowlist.
 *
 * When ON (the default), `LedgerStore.writeRun` / `.writeStep` /
 * `.writeCheckpoint` (V10-AGT-015) runs the typed transition +
 * tenant-scope guards from `src/models/agent/RunLedger.ts` before
 * persisting. When OFF (kill-switch), the store skips persistence —
 * use ONLY during a Run Ledger outage drill.
 */

const LS_KEY = 'ff.agent_run_ledger';
const QUERY_KEY = 'ff_agent_run_ledger';
const ENV_KEY = 'VITE_AGENT_RUN_LEDGER';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

const HARDCODED_DEFAULT = true;

function readEnvFlag(): boolean {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const parsed = parseFlag(meta?.env?.[ENV_KEY]);
    return parsed === null ? HARDCODED_DEFAULT : parsed;
  } catch {
    return HARDCODED_DEFAULT;
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

export function isAgentRunLedgerEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const AGENT_RUN_LEDGER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
