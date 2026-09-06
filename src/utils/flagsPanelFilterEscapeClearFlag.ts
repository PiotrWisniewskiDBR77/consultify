/**
 * Chat V9 / ADMIN AG1 v1.13 — kill-switch for the "Escape
 * clears the filter input" behaviour on the admin flag panel.
 *
 * What this gates
 * ---------------
 * When ON (default) and the AG1 v1.5 filter input has focus:
 *   - Pressing `Escape` while the input has text clears the
 *     text in place (matching APG search-input convention).
 *     The keydown is `preventDefault`ed + `stopPropagation`ed
 *     so the panel's overlay (ChatV9FlagsOverlay) does NOT
 *     also treat it as "close me".
 *   - Pressing `Escape` while the input is empty lets the
 *     event bubble normally — admin keeps one-keystroke escape
 *     to close the overlay when there is nothing to clear.
 *
 * When OFF the input behaves exactly as pre-AG1-v1.13: every
 * Escape bubbles straight to the overlay regardless of the
 * input's content. Default back-compat for tenants that wire
 * their own overlay dismiss.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_flagsPanelFilterEscapeClear=0|1`.
 *   2. `localStorage["ff.flags_panel_filter_escape_clear"]`.
 *   3. `import.meta.env.VITE_FLAGS_PANEL_FILTER_ESCAPE_CLEAR`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.flags_panel_filter_escape_clear';
const QUERY_KEY = 'ff_flagsPanelFilterEscapeClear';
const ENV_KEY = 'VITE_FLAGS_PANEL_FILTER_ESCAPE_CLEAR';

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

export function isFlagsPanelFilterEscapeClearEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const FLAGS_PANEL_FILTER_ESCAPE_CLEAR_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
