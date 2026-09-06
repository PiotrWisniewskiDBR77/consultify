/**
 * Chat V9 / NAV-M3.5 — kill-switch for the recents-dropdown
 * trigger's `ArrowUp` shortcut.
 *
 * What this gates
 * ---------------
 * When ON (default) and the popover is **closed**, pressing
 * `ArrowUp` while the recents caret trigger is focused:
 *
 *   1. Opens the popover via the existing `onOpenChange(true)`
 *      contract (same path as the click + `ArrowDown` entries).
 *   2. Lands focus on the **last** menuitem (oldest recent, or
 *      the bottom of the pinned-then-recents ordering), not the
 *      first. This mirrors the ARIA authoring-practices menu-
 *      button pattern where ArrowDown opens to the top and
 *      ArrowUp opens to the bottom, so users who know "the last
 *      entry is what I want" save a Home/End round-trip.
 *
 * The component advertises the shortcut on the trigger's
 * `aria-keyshortcuts`. When both NAV-M3.4 (ArrowDown) and this
 * flag are ON the attribute reads `"ArrowDown ArrowUp"`; when
 * only one of the two is ON only that shortcut is advertised;
 * when both are OFF the attribute is absent and the trigger
 * reverts to click-only semantics.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_workspaceBreadcrumbRecentsTriggerArrowUp=0|1`.
 *   2. `localStorage["ff.workspace_breadcrumb_recents_trigger_arrow_up"]`.
 *   3. `import.meta.env.VITE_WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW_UP`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.workspace_breadcrumb_recents_trigger_arrow_up';
const QUERY_KEY = 'ff_workspaceBreadcrumbRecentsTriggerArrowUp';
const ENV_KEY = 'VITE_WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW_UP';

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

export function isWorkspaceBreadcrumbRecentsTriggerArrowUpEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW_UP_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
