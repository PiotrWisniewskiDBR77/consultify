/**
 * Module 13 (Inicjatywy — Portfolio) — kill-switch for the not-yet-wired bulk
 * actions in the selection bar.
 *
 * Decision DP-5 (Harvard/wdrozenie-100/M13-inicjatywy.md, D-03 → DP-5):
 * the bulk **Tag**, **Change due date** and **Delete** actions have NO backend
 * endpoint. Rather than half-building a backend or shipping disabled "dead"
 * CTAs, hide the stub behind a flag + label. The wired bulk actions
 * (Export CSV, Assign, Archive, AI: analyze selection) stay visible regardless.
 *
 * Where this flag gates
 * ---------------------
 *   * `InitiativesHub` bulk bar — when OFF (default), Tag / Change due date /
 *     Delete are NOT rendered. When ON (operator/dev), they render disabled
 *     with a "Coming soon (backend)" tooltip so the planned surface can be
 *     previewed before the endpoints exist.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_initiativesBulkStub=0|1` — operator bypass for staging.
 *   2. `localStorage["ff.initiatives_bulk_stub"]` — user / org override.
 *   3. `import.meta.env.VITE_INITIATIVES_BULK_STUB` — build-time default.
 *   4. Default: OFF. Flip this ON only once the bulk tag/due/delete endpoints
 *      are implemented and verified.
 */

const LS_KEY = 'ff.initiatives_bulk_stub';
const QUERY_KEY = 'ff_initiativesBulkStub';
const ENV_KEY = 'VITE_INITIATIVES_BULK_STUB';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const parsed = parseFlag(
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
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

export function isInitiativesBulkStubEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const INITIATIVES_BULK_STUB_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
