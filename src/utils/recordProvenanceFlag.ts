/**
 * Tabele Block B / EPIC-T9 — feature flag for the record-provenance UI
 * (confidence bar, validation badge, source popover, AddSourceDialog).
 *
 * Where this flag gates
 * ---------------------
 *   - `<ProvenanceCell>` and its subcomponents render `null` when the
 *     flag is OFF. Until the backend `ENABLE_RECORD_PROVENANCE` flag is
 *     ON in the same environment, network calls would 404 / 200-empty,
 *     so the UI MUST be silent.
 *   - The flag is safe to flip per-user via `localStorage` because the
 *     UI is purely additive (no destructive paths).
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_recordProvenance=0|1` — operator bypass.
 *   2. `localStorage["ff.record_provenance"]` — user / org override.
 *   3. `import.meta.env.VITE_RECORD_PROVENANCE` — build-time default.
 *   4. Default: OFF. Block B ships behind a closed flag until backend
 *      `ENABLE_RECORD_PROVENANCE` is rolled out across staging + prod.
 */

const LS_KEY = 'ff.record_provenance';
const QUERY_KEY = 'ff_recordProvenance';
const ENV_KEY = 'VITE_RECORD_PROVENANCE';

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

export function isRecordProvenanceEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const RECORD_PROVENANCE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
