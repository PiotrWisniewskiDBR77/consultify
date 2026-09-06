/**
 * Chat V9 / TRUST T-TR1.2 — feature flag for the Trust Badge model
 * label humanizer.
 *
 * What this gates
 * ---------------
 * When on (default), the `TrustBadge` runs its raw `modelUsed`
 * string through `formatTrustBadgeModelLabel()` — a pure dictionary
 * + heuristic formatter — before rendering it next to the source
 * count and inside the "Answered by" line in the popover. When off,
 * the badge falls back to rendering the raw `modelUsed` string
 * unchanged (the pre-T-TR1.2 behaviour). The flag exists purely so
 * we can roll back the humanizer if a user / backend reports a
 * mislabelled model without redeploying the component.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_trustBadgeHumanizeModel=0|1`.
 *   2. `localStorage["ff.trust_badge_humanize_model"]`.
 *   3. `import.meta.env.VITE_TRUST_BADGE_HUMANIZE_MODEL`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.trust_badge_humanize_model';
const QUERY_KEY = 'ff_trustBadgeHumanizeModel';
const ENV_KEY = 'VITE_TRUST_BADGE_HUMANIZE_MODEL';

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

export function isTrustBadgeHumanizeModelEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const TRUST_BADGE_HUMANIZE_MODEL_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
