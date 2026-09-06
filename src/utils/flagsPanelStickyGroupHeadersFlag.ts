/**
 * Chat V9 / AG1 v1.9 — kill-switch for sticky block-group
 * headers inside the admin `ChatV9FlagsPanel`.
 *
 * When ON (default) and the AG1 v1.6 grouping flag is ON, each
 * block-group header (`navigation`, `trust`, `voice`, `control`,
 * `input`, `admin`, `context`) sticks to the top of the panel's
 * scroll container as the admin scrolls through a long list of
 * flags. This keeps the section label + override count +
 * chevron affordance in view, so admins never lose context
 * while scanning a filtered list.
 *
 * When OFF, headers scroll normally (AG1 v1.6 v1 behaviour).
 * The base `ff.flags_panel_grouping` remains the outer safety
 * net — when grouping itself is OFF the panel renders a flat
 * list and this flag is moot.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_flagsPanelStickyGroupHeaders=0|1`.
 *   2. `localStorage["ff.flags_panel_sticky_group_headers"]`.
 *   3. `import.meta.env.VITE_FLAGS_PANEL_STICKY_GROUP_HEADERS`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.flags_panel_sticky_group_headers';
const QUERY_KEY = 'ff_flagsPanelStickyGroupHeaders';
const ENV_KEY = 'VITE_FLAGS_PANEL_STICKY_GROUP_HEADERS';

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

export function isFlagsPanelStickyGroupHeadersEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const FLAGS_PANEL_STICKY_GROUP_HEADERS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
