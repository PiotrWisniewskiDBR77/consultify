/**
 * Chat V10 / V10-ONB-006 — feature flag for the 5-minute activation SLA.
 *
 * Gates adoption of `computeActivationVerdict` in the onboarding
 * telemetry pipeline and SLA dashboard. When ON, the session service
 * emits `onboard.activation_reached` on gate-4 and marks the session
 * `abandoned / sla_exceeded` at 600 s of inactivity. Default OFF.
 * See `ADR-V10-002`.
 */

const LS_KEY = 'ff.onboard_five_minute_sla';
const QUERY_KEY = 'ff_onboard_five_minute_sla';
const ENV_KEY = 'VITE_ONBOARD_FIVE_MINUTE_SLA';

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

export function isOnboardFiveMinuteSlaEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_FIVE_MINUTE_SLA_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
