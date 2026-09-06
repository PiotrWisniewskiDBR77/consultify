/**
 * Chat V9 / TRUST T-TR1 — feature flag for the AI response trust badge.
 *
 * Where this flag gates
 * ---------------------
 *   - `TrustBadge` renders a small always-on summary chip beneath AI
 *     replies (citation count + optional model name). When the flag is
 *     OFF the component returns null; the existing `CitationList` and
 *     the stub `SourcesStrip` / `TrustPanel` are not affected.
 *
 * This badge is read-only explainability — it never changes the model
 * output, citation rendering, or any backend contract.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_trustBadge=0|1` — operator bypass.
 *   2. `localStorage["ff.trust_badge"]` — per-user override.
 *   3. `import.meta.env.VITE_TRUST_BADGE` — build-time default.
 *   4. Default: ON. A summary chip is additive to the existing citation
 *      list; it never replaces or hides other trust surfaces.
 */

const LS_KEY = 'ff.trust_badge';
const QUERY_KEY = 'ff_trustBadge';
const ENV_KEY = 'VITE_TRUST_BADGE';

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

export function isTrustBadgeEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const TRUST_BADGE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
