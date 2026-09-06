/**
 * Chat V9 / ADMIN AG1 v1.10 — kill-switch for per-row keyboard
 * shortcuts on the admin flag panel.
 *
 * What this gates
 * ---------------
 * When ON (default), each flag row in `ChatV9FlagsPanel`
 * handles lowercase `o` / `f` / `d` keypresses that bubble up
 * from any focused element inside the row:
 *
 *   - `o` → set override to `on`  (same as clicking "ON")
 *   - `f` → set override to `off` (same as clicking "OFF")
 *   - `d` → clear override, fall back to shipped default
 *
 * Each of the three toggle buttons inside the row carries the
 * matching `aria-keyshortcuts` attribute (e.g. `o`, `f`, `d`)
 * so screen readers announce the shortcut the same way they
 * would announce a `⌘` hint on a desktop menu.
 *
 * When OFF, the keydown listener and the `aria-keyshortcuts`
 * attributes are both removed; the row behaves exactly as it
 * did before AG1 v1.10 (mouse / Enter only). This is the same
 * shape as every other AG1 sub-flag so ops can disable the
 * feature with one `localStorage.setItem(..., '0')` call.
 *
 * The row keydown handler refuses to hijack typing inside an
 * `<input>` / `<textarea>` / `contenteditable` so a future
 * inline edit field (e.g. annotation on a row) wouldn't lose
 * the `o`/`f`/`d` keystrokes — the kill-switch covers the
 * listener's presence; the handler covers the listener's
 * safety.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_flagsPanelRowShortcuts=0|1`.
 *   2. `localStorage["ff.flags_panel_row_shortcuts"]`.
 *   3. `import.meta.env.VITE_FLAGS_PANEL_ROW_SHORTCUTS`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.flags_panel_row_shortcuts';
const QUERY_KEY = 'ff_flagsPanelRowShortcuts';
const ENV_KEY = 'VITE_FLAGS_PANEL_ROW_SHORTCUTS';

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

export function isFlagsPanelRowShortcutsEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const FLAGS_PANEL_ROW_SHORTCUTS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
