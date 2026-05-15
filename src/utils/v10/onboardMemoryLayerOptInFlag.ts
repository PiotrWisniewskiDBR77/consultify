/**
 * Chat V10 / V10-ONB-017 — feature flag for the per-memory-layer
 * learning opt-in + write-authorisation gate.
 *
 * Runtime contract lives in
 * `src/models/onboarding/MemoryLayerOptIn.ts`.
 *
 * **On-by-construction.** Default `true`. The gate is a safety
 * rail: it refuses persistent-memory writes when
 * `feedback.consent_granted` has not fired for the current session.
 * Turning it off would silently permit ghost writes, contradicting
 * the dev-plan acceptance criterion "Default persistent memory
 * state is **off** for 100% of new tenants." V10 CI invariant 23
 * mirror pins this flag in the `ON_BY_CONSTRUCTION_ALLOWLIST`
 * (see `chatV10FeatureFlags.test.ts`).
 */

const LS_KEY = 'ff.onboard_memory_layer_opt_in';
const QUERY_KEY = 'ff_onboard_memory_layer_opt_in';
const ENV_KEY = 'VITE_ONBOARD_MEMORY_LAYER_OPT_IN';

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

export function isOnboardMemoryLayerOptInEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_MEMORY_LAYER_OPT_IN_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
