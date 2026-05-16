/**
 * Chat V10 / V10-ONB-010 — feature flag for the no-ghost-capabilities
 * rule.
 *
 * **On-by-construction.** Per master plan §4.3 and `ADR-V10-002`,
 * this flag ships `default: true`. Disabling it is an incident-
 * response override only (e.g. to surface a capability during a
 * live-debugging session); V10 CI invariant 23 mirror asserts it is
 * a member of the on-by-construction allowlist.
 *
 * When ON, every onboarding CTA renderer calls
 * `decideCapabilityRender` and honours the `'hide'` decision by
 * returning `null` (not by greying-out). When OFF, the pre-V10
 * "render everything, disable unavailable" behaviour is restored.
 */

const LS_KEY = 'ff.onboard_no_ghost_caps';
const QUERY_KEY = 'ff_onboard_no_ghost_caps';
const ENV_KEY = 'VITE_ONBOARD_NO_GHOST_CAPS';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

const HARDCODED_DEFAULT = true;

function readEnvFlag(): boolean {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const parsed = parseFlag(meta?.env?.[ENV_KEY]);
    return parsed === null ? HARDCODED_DEFAULT : parsed;
  } catch {
    return HARDCODED_DEFAULT;
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

export function isOnboardNoGhostCapsEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_NO_GHOST_CAPS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
