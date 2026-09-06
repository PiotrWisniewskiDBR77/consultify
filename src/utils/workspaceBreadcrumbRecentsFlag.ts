/**
 * Chat V9 / NAV-M3-lite — kill-switch for the "recent conversations"
 * dropdown attached to the workspace breadcrumb's `Chat` segment.
 *
 * When ON (default), the floating breadcrumb pill renders a small
 * caret button right after the `Chat` link. Clicking it opens a
 * popover listing the N most-recent conversations (excluding the
 * active one and anything archived) so the user can hop between
 * siblings without the sidebar. Selecting a row calls the
 * conversation store's `setActiveConversation(id)` and then the
 * existing `returnToFullChat()` verb — the same one NAV-M1 /
 * NAV-M1.1 / NAV-M2-lite use — so all four affordances end in the
 * same place.
 *
 * When OFF, the caret button does not render at all; the
 * breadcrumb collapses back to the NAV-M2.1 shape.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_workspaceBreadcrumbRecents=0|1`.
 *   2. `localStorage["ff.workspace_breadcrumb_recents"]`.
 *   3. `import.meta.env.VITE_WORKSPACE_BREADCRUMB_RECENTS`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.workspace_breadcrumb_recents';
const QUERY_KEY = 'ff_workspaceBreadcrumbRecents';
const ENV_KEY = 'VITE_WORKSPACE_BREADCRUMB_RECENTS';

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

export function isWorkspaceBreadcrumbRecentsEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const WORKSPACE_BREADCRUMB_RECENTS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
