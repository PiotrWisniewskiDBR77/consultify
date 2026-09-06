/**
 * Chat V9 / TRUST T-TR1.4 — feature flag for the "Copy reasoning"
 * affordance inside the Trust Badge popover's expanded "Why this
 * answer?" disclosure.
 *
 * What this gates
 * ---------------
 * When on (default) and the T-TR2 reasoning disclosure is itself
 * open, a small "Copy" button renders inside the disclosure body.
 * It serialises the deterministic `buildTrustBadgeReasoning`
 * observations (plus the humanised model label when available)
 * into a Markdown blob modelled on the T-TR1.3 "Copy citations"
 * payload, then writes it via the same injectable clipboard
 * helper. When off, the button disappears; the disclosure
 * otherwise behaves exactly as it did before T-TR1.4.
 *
 * The flag is an operational kill-switch in case the clipboard
 * API surfaces an unexpected Permissions-Policy failure on a
 * hosted domain. The happy path is a non-networked
 * write-string-to-clipboard; it should not need flipping in
 * practice.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_trustBadgeCopyReasoning=0|1`.
 *   2. `localStorage["ff.trust_badge_copy_reasoning"]`.
 *   3. `import.meta.env.VITE_TRUST_BADGE_COPY_REASONING`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.trust_badge_copy_reasoning';
const QUERY_KEY = 'ff_trustBadgeCopyReasoning';
const ENV_KEY = 'VITE_TRUST_BADGE_COPY_REASONING';

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

export function isTrustBadgeCopyReasoningEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const TRUST_BADGE_COPY_REASONING_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
