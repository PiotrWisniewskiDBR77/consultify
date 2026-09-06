/**
 * Chat V9 / TRUST T-TR1.3 — feature flag for the "Copy citations"
 * affordance inside the Trust Badge popover.
 *
 * What this gates
 * ---------------
 * When on (default), the Trust Badge popover renders a small
 * "Copy" button that serialises the citation list (plus the
 * humanised model label when available) to a deterministic
 * Markdown blob and writes it to the system clipboard. When off,
 * the button disappears; the popover otherwise behaves exactly as
 * it did before T-TR1.3.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_trustBadgeCopyCitations=0|1`.
 *   2. `localStorage["ff.trust_badge_copy_citations"]`.
 *   3. `import.meta.env.VITE_TRUST_BADGE_COPY_CITATIONS`.
 *   4. Default ON.
 *
 * The flag exists purely as an operational kill-switch in case the
 * clipboard API surfaces an unexpected Permissions-Policy failure
 * on a hosted domain. The happy path is a non-networked
 * write-string-to-clipboard; it should not need flipping in
 * practice.
 */

const LS_KEY = 'ff.trust_badge_copy_citations';
const QUERY_KEY = 'ff_trustBadgeCopyCitations';
const ENV_KEY = 'VITE_TRUST_BADGE_COPY_CITATIONS';

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

export function isTrustBadgeCopyCitationsEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const TRUST_BADGE_COPY_CITATIONS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
