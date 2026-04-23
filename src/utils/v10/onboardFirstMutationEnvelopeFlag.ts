/**
 * Chat V10 / V10-ONB-011 — feature flag for first-mutation envelope.
 *
 * Gates the activation-time guard that requires the first AI-generated
 * artifact to be wrapped in a MutationProposal with explicit approval
 * before any write to the library. Runtime contract lives in
 * `src/models/onboarding/FirstMutationEnvelope.ts`. Default OFF.
 */

const LS_KEY = 'ff.onboard_first_mutation_envelope';
const QUERY_KEY = 'ff_onboard_first_mutation_envelope';
const ENV_KEY = 'VITE_ONBOARD_FIRST_MUTATION_ENVELOPE';

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

export function isOnboardFirstMutationEnvelopeEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_FIRST_MUTATION_ENVELOPE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
