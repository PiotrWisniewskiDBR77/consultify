/**
 * Chat V10 / V10-ONB-007 — feature flag for the buyer-data-only invariant.
 *
 * Gates adoption of `assertBuyerDataOnly` at the first-draft generator
 * ingress (V10-ONB-016). When ON, empty / non-tenant source sets are
 * rejected and the UI renders the honest "no sources yet" empty state.
 * When OFF, the legacy generator path is preserved (which may silently
 * fall through to demo content). Default OFF.
 *
 * NOTE: The path-based lint rule (`no-demo-data`) is flag-independent —
 * it runs at build time regardless of this flag's resolved state, to
 * prevent a future engineer from silently re-introducing demo imports
 * under `src/onboarding/`.
 * See `ADR-V10-002`.
 */

const LS_KEY = 'ff.onboard_buyer_data_only';
const QUERY_KEY = 'ff_onboard_buyer_data_only';
const ENV_KEY = 'VITE_ONBOARD_BUYER_DATA_ONLY';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const parsed = parseFlag(meta?.env?.[ENV_KEY]);
    return parsed === null ? false : parsed;
  } catch {
    return false;
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

export function isOnboardBuyerDataOnlyEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_BUYER_DATA_ONLY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
