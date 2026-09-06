/**
 * Chat V9 / AG1 v1.7 — kill-switch for the admin flag panel's
 * per-row spec-doc breadcrumb.
 *
 * When ON (default), every `ChatV9FlagsPanel` row renders the
 * flag's first `specDocs` entry as a small, selectable monospace
 * line below the ticket pill (with the full list surfaced via the
 * `title=` tooltip). When OFF, the row collapses to the pre-AG1
 * v1.7 shape — title + ticket + state/override pills only —
 * without the docs line.
 *
 * The row is admin-only (the whole panel is role-gated) and emits
 * zero telemetry, so the kill-switch exists purely so ops can cut
 * the visual clutter for a session without rebuilding.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_flagsPanelDocLinks=0|1`.
 *   2. `localStorage["ff.flags_panel_doc_links"]`.
 *   3. `import.meta.env.VITE_FLAGS_PANEL_DOC_LINKS`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.flags_panel_doc_links';
const QUERY_KEY = 'ff_flagsPanelDocLinks';
const ENV_KEY = 'VITE_FLAGS_PANEL_DOC_LINKS';

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

export function isFlagsPanelDocLinksEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const FLAGS_PANEL_DOC_LINKS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
