/**
 * Chat V9 / NAV-M3-lite^3 — kill-switch for roving arrow-key
 * navigation inside the workspace breadcrumb's recent-
 * conversations dropdown.
 *
 * When ON (default) and the popover is open, each menuitem
 * gains an `onKeyDown` handler that:
 *   - ArrowDown   → move focus to the next menuitem (wraps).
 *   - ArrowUp     → move focus to the previous menuitem (wraps).
 *   - Home        → jump focus to the first menuitem.
 *   - End         → jump focus to the last menuitem.
 *   - Enter/Space → activate the focused menuitem (native click).
 *   - Tab         → close the popover (hand focus back to the
 *                   natural Tab order above the trigger).
 * Escape stays attached at the window level (NAV-M3-lite v1).
 * The "View all" footer row is deliberately NOT part of the
 * roving ring — it remains reachable via Tab but does not steal
 * focus from the menuitem ring.
 *
 * When OFF, the component keeps the NAV-M3-lite v1 shape: the
 * first item is auto-focused on open and Escape closes, but
 * arrows move focus through native Tab order only. This is
 * what ships today whenever someone needs to A/B the
 * accessibility upgrade without redeploying.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_workspaceBreadcrumbRecentsArrowKeys=0|1`.
 *   2. `localStorage["ff.workspace_breadcrumb_recents_arrow_keys"]`.
 *   3. `import.meta.env.VITE_WORKSPACE_BREADCRUMB_RECENTS_ARROW_KEYS`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.workspace_breadcrumb_recents_arrow_keys';
const QUERY_KEY = 'ff_workspaceBreadcrumbRecentsArrowKeys';
const ENV_KEY = 'VITE_WORKSPACE_BREADCRUMB_RECENTS_ARROW_KEYS';

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

export function isWorkspaceBreadcrumbRecentsArrowKeysEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const WORKSPACE_BREADCRUMB_RECENTS_ARROW_KEYS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
