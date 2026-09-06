/**
 * Chat V9 / AG1 v1.8 — kill-switch for the admin flag panel's
 * per-row description expansion toggle.
 *
 * When ON (default), long flag descriptions in
 * `ChatV9FlagsPanel` keep their `line-clamp-3` default but grow
 * a small `Show more` / `Show less` button that lets an admin
 * read the full text inline without opening dev-tools or
 * hovering for a tooltip. Short descriptions are not offered
 * the toggle — see `shouldOfferChatV9FlagExpand`.
 *
 * When OFF, the toggle never renders and descriptions behave
 * exactly as they did pre-AG1 v1.8 (`line-clamp-3`,
 * full-text via right-click / DOM inspect).
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_flagsPanelDescriptionExpand=0|1`.
 *   2. `localStorage["ff.flags_panel_description_expand"]`.
 *   3. `import.meta.env.VITE_FLAGS_PANEL_DESCRIPTION_EXPAND`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.flags_panel_description_expand';
const QUERY_KEY = 'ff_flagsPanelDescriptionExpand';
const ENV_KEY = 'VITE_FLAGS_PANEL_DESCRIPTION_EXPAND';

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

export function isFlagsPanelDescriptionExpandEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const FLAGS_PANEL_DESCRIPTION_EXPAND_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
