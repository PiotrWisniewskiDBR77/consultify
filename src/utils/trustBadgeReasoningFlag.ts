/**
 * Chat V9 / TRUST T-TR2 — kill-switch for the "Why this answer?"
 * reasoning snippet inside the Trust Badge popover.
 *
 * When ON (default), the popover renders a collapsible
 * disclosure between the source list and the verify-claims
 * disclaimer footer. When OFF, the disclosure is not rendered at
 * all — the popover is pixel-for-pixel identical to the T-TR1.3
 * shipped surface.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_trustBadgeReasoning=0|1`.
 *   2. `localStorage["ff.trust_badge_reasoning"]`.
 *   3. `import.meta.env.VITE_TRUST_BADGE_REASONING`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.trust_badge_reasoning';
const QUERY_KEY = 'ff_trustBadgeReasoning';
const ENV_KEY = 'VITE_TRUST_BADGE_REASONING';

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

export function isTrustBadgeReasoningEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const TRUST_BADGE_REASONING_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
