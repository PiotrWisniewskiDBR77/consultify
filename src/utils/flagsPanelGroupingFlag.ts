/**
 * Chat V9 / ADMIN AG1 v1.6 — feature flag for collapsible block
 * groups in the admin panel.
 *
 * What this gates
 * ---------------
 * When on (default), the flag control panel renders flags grouped
 * under collapsible block headers (`voice`, `trust`, `admin`,
 * `navigation`, `input`) instead of a single flat list. Each group
 * header shows:
 *
 *   - the block name,
 *   - a `{visible}/{total}` count (the visible side respects
 *     whatever query AG1 v1.5 has applied),
 *   - an override-count pill when at least one flag in the group
 *     is overridden in the current browser session,
 *   - a chevron that toggles the body open / closed.
 *
 * When off, the panel falls back to the pre-v1.6 flat list — same
 * DOM ordering as the registry, no group chrome.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_flagsPanelGrouping=0|1`.
 *   2. `localStorage["ff.flags_panel_grouping"]`.
 *   3. `import.meta.env.VITE_FLAGS_PANEL_GROUPING`.
 *   4. Default ON.
 *
 * Rationale for the kill-switch: grouping reshuffles DOM structure
 * the admin may have muscle memory for. Keeping a flag means ops
 * can fall back to the flat view without a deploy if the grouping
 * UX surprises anyone in production.
 */

const LS_KEY = 'ff.flags_panel_grouping';
const QUERY_KEY = 'ff_flagsPanelGrouping';
const ENV_KEY = 'VITE_FLAGS_PANEL_GROUPING';

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

export function isFlagsPanelGroupingEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const FLAGS_PANEL_GROUPING_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
