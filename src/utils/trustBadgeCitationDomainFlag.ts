/**
 * Chat V9 / TRUST T-TR3.4 — kill-switch for the citation
 * domain pill in the Trust Badge popover.
 *
 * What this gates
 * ---------------
 * When ON (default), each citation row in the Trust Badge
 * preview renders a small secondary pill showing the
 * hostname of the citation URL (e.g. `nytimes.com`,
 * `wikipedia.org`). The pill is independent of the
 * clickable-link path (`trust-badge-citation-links`):
 * admins may want the visible provenance cue even on
 * tenants that must stay non-interactive.
 *
 * When OFF, the row renders exactly as before — just title
 * (optionally linkified), no trailing domain. Layout is
 * pixel-identical to pre-T-TR3.4.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_trustBadgeCitationDomain=0|1`.
 *   2. `localStorage["ff.trust_badge_citation_domain"]`.
 *   3. `import.meta.env.VITE_TRUST_BADGE_CITATION_DOMAIN`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.trust_badge_citation_domain';
const QUERY_KEY = 'ff_trustBadgeCitationDomain';
const ENV_KEY = 'VITE_TRUST_BADGE_CITATION_DOMAIN';

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

export function isTrustBadgeCitationDomainEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const TRUST_BADGE_CITATION_DOMAIN_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
