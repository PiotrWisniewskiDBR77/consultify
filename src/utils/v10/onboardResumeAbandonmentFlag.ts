/**
 * Chat V10 / V10-ONB-022 — feature flag for resume-on-
 * abandonment (7-section snapshot, 2-click restore, 7-day TTL,
 * hash-based source-delta detection).
 *
 * Runtime contract lives in
 * `src/models/onboarding/ResumeOnAbandonment.ts`. Default OFF —
 * Wave A seed pins the snapshot shape, the 3-outcome resume
 * reducer, the 2-click restore budget, and the source-hash
 * delta detection rule; the Wave B durable snapshot store +
 * delta-banner renderer bind to this contract.
 */

const LS_KEY = 'ff.onboard_resume_abandonment';
const QUERY_KEY = 'ff_onboard_resume_abandonment';
const ENV_KEY = 'VITE_ONBOARD_RESUME_ABANDONMENT';

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

export function isOnboardResumeAbandonmentEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_RESUME_ABANDONMENT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
