/**
 * Chat V9 / NAV-M3-lite++ — kill-switch for the "View all
 * conversations" footer row rendered at the bottom of the
 * workspace breadcrumb's recent-conversations dropdown.
 *
 * When ON (default) and the filtered recents count exceeds the
 * dropdown's cap, a small non-`menuitem` footer row renders
 * below the last `menuitem`. Clicking it returns the user to
 * the main chat surface (same verb the row-click path uses) and
 * opens the conversations sidebar if it was closed, so the user
 * can browse the remaining threads without the popover having
 * to grow.
 *
 * When OFF, the popover stays at the NAV-M3-lite+ shape — no
 * footer row even if recents overflow the cap.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_workspaceBreadcrumbRecentsViewAll=0|1`.
 *   2. `localStorage["ff.workspace_breadcrumb_recents_view_all"]`.
 *   3. `import.meta.env.VITE_WORKSPACE_BREADCRUMB_RECENTS_VIEW_ALL`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.workspace_breadcrumb_recents_view_all';
const QUERY_KEY = 'ff_workspaceBreadcrumbRecentsViewAll';
const ENV_KEY = 'VITE_WORKSPACE_BREADCRUMB_RECENTS_VIEW_ALL';

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

export function isWorkspaceBreadcrumbRecentsViewAllEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const WORKSPACE_BREADCRUMB_RECENTS_VIEW_ALL_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
