/**
 * Chat V10 / V10-CON-011 — feature flag for IncrementalSync
 * (incremental delta sync contract across connectors, branded SyncCursorId,
 * closed SYNC_MODES catalogue, pure advanceSyncCursor reducer, cursor-monotonic
 * + tenant-scoped + mode-catalogue + full-resets-cursor + deterministic
 * invariants).
 *
 * Runtime contract lives in
 * `src/models/connectors/IncrementalSync.ts`. Default OFF —
 * Wave A seed pins the incremental sync shape and invariants;
 * Wave B connector sync execution attaches to this contract.
 */

const LS_KEY = 'ff.connectors_incremental_sync';
const QUERY_KEY = 'ff_connectors_incremental_sync';
const ENV_KEY = 'VITE_CONNECTORS_INCREMENTAL_SYNC';

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

export function isConnectorsIncrementalSyncEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const CONNECTORS_INCREMENTAL_SYNC_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
