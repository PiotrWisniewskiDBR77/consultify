/**
 * Chat V9 / NAV-M3.4 — kill-switch for the ARIA-APG
 * menu-button upgrade on the workspace breadcrumb's
 * recent-conversations trigger.
 *
 * When ON (default) and the trigger button is focused (popover
 * closed), pressing `ArrowDown` opens the popover *and* lets
 * NAV-M3-lite v1's open-effect land focus on the first
 * menuitem — one keystroke instead of two (click + wait for
 * focus, or Tab + Enter). `event.preventDefault()` keeps the
 * page from scrolling while the popover opens.
 *
 * Why a dedicated flag (not piggyback on NAV-M3.3)
 * ------------------------------------------------
 * NAV-M3.3 (`ff.workspace_breadcrumb_recents_arrow_keys`) gates
 * *intra-menu* roving focus — Tab closes, ↑/↓ wrap through
 * menuitems, Home/End jump to the ends. This flag gates only
 * the trigger-level ArrowDown shortcut. Keeping them separate
 * lets ops silence one without the other if a user study finds
 * that e.g. the APG shortcut confuses keyboard-novice users
 * while the roving ring is still valuable.
 *
 * When OFF, the trigger behaves like a plain `<button>` again:
 * ArrowDown does nothing special (scrolls the page); only
 * click / Enter / Space opens the popover, matching the
 * NAV-M3-lite v1 shipped behaviour pixel-for-pixel.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_workspaceBreadcrumbRecentsTriggerArrow=0|1`.
 *   2. `localStorage["ff.workspace_breadcrumb_recents_trigger_arrow"]`.
 *   3. `import.meta.env.VITE_WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.workspace_breadcrumb_recents_trigger_arrow';
const QUERY_KEY = 'ff_workspaceBreadcrumbRecentsTriggerArrow';
const ENV_KEY = 'VITE_WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW';

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

export function isWorkspaceBreadcrumbRecentsTriggerArrowEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
