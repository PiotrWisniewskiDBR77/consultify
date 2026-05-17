/**
 * Chat V10 / V10-ONB-005 — feature flag for the trust-first banner.
 *
 * Special-case default
 * --------------------
 * This flag ships **default: true** (on-by-construction) per:
 *   - master plan §4.3 "flag defaults" exception list
 *   - `ADR-V10-002` ("flag registry split") "safety flags default on"
 *   - `ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md` rollout
 *     order §3.
 *
 * The V10 CI invariant 23 mirror asserts that the set of V10 flags
 * with `default: true` is exactly
 * {`ff.onboard_trust_first_banner`, `ff.onboard_conservative_defaults`}
 * — no more, no less. (The second flag lands with V10-ONB-019; the
 * invariant is written against a subset-of-allowlist check so Wave A
 * Seed can pass with only this one.)
 *
 * When OFF (explicitly, via override), the onboarding container falls
 * back to V9 generic onboarding and the trust-first rule is not
 * enforced. This is the documented kill-switch for incident response,
 * not a legitimate production state.
 */

const LS_KEY = 'ff.onboard_trust_first_banner';
const QUERY_KEY = 'ff_onboard_trust_first_banner';
const ENV_KEY = 'VITE_ONBOARD_TRUST_FIRST_BANNER';

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
    // Hard default for this flag is TRUE (on-by-construction).
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

export function isOnboardTrustFirstBannerEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_TRUST_FIRST_BANNER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
