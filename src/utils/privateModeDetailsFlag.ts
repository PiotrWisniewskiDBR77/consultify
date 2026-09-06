/**
 * Chat V9 / TRUST T-PM1 — feature flag for the Private Mode details popover.
 *
 * Where this flag gates
 * ---------------------
 *   - `PrivateModeDetails` wraps the "Private mode" badge that already
 *     appears in `UnifiedChatPanel` when `aiConfig.privateMode === true`.
 *     When the flag is OFF, the component falls back to the legacy
 *     read-only chip (static `title=` tooltip, no popover). When ON, the
 *     chip becomes a button that opens a short explainer popover.
 *
 * The flag never influences the underlying `privateMode` aiConfig value;
 * only the UX surface that explains it. If this flag is disabled the
 * user still gets the exact same privacy guarantees — they just don't
 * get the new popover.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_privateModeDetails=0|1` — operator bypass.
 *   2. `localStorage["ff.private_mode_details"]` — per-user override.
 *   3. `import.meta.env.VITE_PRIVATE_MODE_DETAILS` — build-time default.
 *   4. Default: ON. Explainer content is purely additive trust copy; it
 *      never changes runtime behaviour, so shipping enabled-by-default
 *      is the honest default.
 */

const LS_KEY = 'ff.private_mode_details';
const QUERY_KEY = 'ff_privateModeDetails';
const ENV_KEY = 'VITE_PRIVATE_MODE_DETAILS';

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
    return parsed === null ? true : parsed;
  } catch {
    return true;
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

export function isPrivateModeDetailsEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const PRIVATE_MODE_DETAILS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
