/**
 * Chat V9 / ADMIN AG1 v1.11 — kill-switch for the shortcut
 * cheat-sheet pill in the admin flag panel header.
 *
 * What this gates
 * ---------------
 * When ON (default) AND the AG1 v1.10 row-shortcuts flag is
 * also ON, the `ChatV9FlagsPanel` renders a tiny
 * `Shortcuts · o ON · f OFF · d default` pill below the panel
 * heading. Each shortcut letter is wrapped in a `<kbd>`
 * element so the shortcut reads the same way the browser
 * renders an accelerator in a menu.
 *
 * The pill only advertises shortcuts that are actually wired
 * up — it is a passive label, not a handler. When the AG1 v1.10
 * kill-switch flips OFF the pill disappears too, so the panel
 * never promises a shortcut the handler has decided not to
 * serve. When this v1.11 kill-switch flips OFF the pill
 * disappears regardless of v1.10's state — useful for tenants
 * who want the behaviour but not the visible UI.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_flagsPanelShortcutCheatSheet=0|1`.
 *   2. `localStorage["ff.flags_panel_shortcut_cheat_sheet"]`.
 *   3. `import.meta.env.VITE_FLAGS_PANEL_SHORTCUT_CHEAT_SHEET`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.flags_panel_shortcut_cheat_sheet';
const QUERY_KEY = 'ff_flagsPanelShortcutCheatSheet';
const ENV_KEY = 'VITE_FLAGS_PANEL_SHORTCUT_CHEAT_SHEET';

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

export function isFlagsPanelShortcutCheatSheetEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const FLAGS_PANEL_SHORTCUT_CHEAT_SHEET_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
