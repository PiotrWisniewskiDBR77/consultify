/**
 * Chat V9 / TRUST T-TR3-lite — kill-switch for per-citation
 * clickable links inside the Trust Badge popover.
 *
 * What this gates
 * ---------------
 * When ON (default) and a citation's `link` field passes
 * `isSafeCitationLink` (http/https absolute URL, non-empty
 * host, no javascript: / data: / file: tricks), the popover's
 * source list renders the title inside an `<a href target="_
 * blank" rel="noopener noreferrer">` element instead of a
 * plain `<span>`. The numeric prefix (`1.`) and the row's
 * tooltip / truncation behaviour are unchanged so the popover
 * still reads as a scannable "sources list" rather than a
 * dense link blob.
 *
 * When OFF, titles render exactly as they did before
 * T-TR3-lite (plain text). Citations without a safe link also
 * render as plain text regardless of this flag — the kill-
 * switch only governs whether the *linkification path* is
 * allowed to activate at all.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_trustBadgeCitationLinks=0|1`.
 *   2. `localStorage["ff.trust_badge_citation_links"]`.
 *   3. `import.meta.env.VITE_TRUST_BADGE_CITATION_LINKS`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.trust_badge_citation_links';
const QUERY_KEY = 'ff_trustBadgeCitationLinks';
const ENV_KEY = 'VITE_TRUST_BADGE_CITATION_LINKS';

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

export function isTrustBadgeCitationLinksEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const TRUST_BADGE_CITATION_LINKS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
