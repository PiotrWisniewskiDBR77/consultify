/**
 * Chat V10 / V10-ONB-016 — feature flag for the research cost-cap +
 * source-policy confirmation gate.
 *
 * Gates `assertResearchConfirmation` /
 * `buildResearchConfirmationRecord` at the onboarding service
 * boundary. Runtime contract lives in
 * `src/models/onboarding/ResearchConfirmationGate.ts`.
 *
 * Default: **ON (on-by-construction).** Rationale per dev plan: "no
 * research run starts without a cost cap." This flag is marked safe-
 * by-construction in the V10 feature-flag registry; the allowlist
 * mirror in the CI invariant covers it explicitly.
 */

const LS_KEY = 'ff.onboard_research_confirmation_gate';
const QUERY_KEY = 'ff_onboard_research_confirmation_gate';
const ENV_KEY = 'VITE_ONBOARD_RESEARCH_CONFIRMATION_GATE';

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

export function isOnboardResearchConfirmationGateEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_RESEARCH_CONFIRMATION_GATE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
