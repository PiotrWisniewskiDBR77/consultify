/**
 * Chat V9 / NAV-M3-lite+ — kill-switch for the "pinned
 * conversations first" ordering rule inside the workspace
 * breadcrumb's recent-conversations dropdown.
 *
 * When ON (default), `buildRecentConversationsList` bubbles
 * entries whose upstream `Conversation.starred` or
 * `Conversation.isPinned` is `true` to the top of the popover,
 * preserving the newest-first rule within the pinned and
 * non-pinned sub-groups. The dropdown renders a small `★` glyph
 * next to pinned rows so the pin state is scannable.
 *
 * When OFF, the list is sorted purely by
 * `lastMessageAt`/`updatedAt` (NAV-M3-lite v1 behaviour); pinned
 * rows blend back into the recents order and the glyph never
 * renders.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_workspaceBreadcrumbRecentsPinned=0|1`.
 *   2. `localStorage["ff.workspace_breadcrumb_recents_pinned"]`.
 *   3. `import.meta.env.VITE_WORKSPACE_BREADCRUMB_RECENTS_PINNED`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.workspace_breadcrumb_recents_pinned';
const QUERY_KEY = 'ff_workspaceBreadcrumbRecentsPinned';
const ENV_KEY = 'VITE_WORKSPACE_BREADCRUMB_RECENTS_PINNED';

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

export function isWorkspaceBreadcrumbRecentsPinnedEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const WORKSPACE_BREADCRUMB_RECENTS_PINNED_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
