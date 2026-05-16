/**
 * Chat V10 / V10-ONB-021 — feature flag for the honest
 * citation-validation fallback (coverage gate + scaffold +
 * 4-option panel + `onboard.artifact_blocked` telemetry).
 *
 * Runtime contract lives in
 * `src/models/onboarding/CitationValidationFallback.ts`.
 * Default OFF — Wave A seed pins the 80% coverage floor, the
 * 2-entry block-reason catalogue, the 4-entry options
 * catalogue, the zero-conclusion scaffold honesty rule, and
 * the telemetry invariant; the Wave B blocked-fallback UI and
 * the V10-ONB-007 generator bind to this shape.
 */

const LS_KEY = 'ff.onboard_citation_validation_fallback';
const QUERY_KEY = 'ff_onboard_citation_validation_fallback';
const ENV_KEY = 'VITE_ONBOARD_CITATION_VALIDATION_FALLBACK';

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

export function isOnboardCitationValidationFallbackEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_CITATION_VALIDATION_FALLBACK_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
