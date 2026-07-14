/**
 * I1-I3 Faza 0 — unified "+ Nowy" launcher feature flag (default OFF, live-safe).
 *
 * Gates `UnifiedCreateLauncher` (src/components/shared/UnifiedCreateLauncher.tsx),
 * a single entry point that lets the user pick Insight / Initiative / Decision and
 * delegates to the existing, UNCHANGED generators (InsightCreatorModal,
 * InitiativeCharterWizard, NewDecisionModal). See
 * Harvard/wdrozenie-100/_PLAN_I1-I3_UNIFIKACJA_KREATOROW.md §6 Faza 0.
 *
 * Resolution order (first wins): URL query → localStorage → Vite build env →
 * default false. Mirrors src/components/Results/resultsFeatureFlags.ts (one
 * system), MINUS the "default ON outside prod" override — this flag stays
 * default OFF everywhere until Piotr accepts the screenshots (reguła #7).
 */

const QUERY_KEY = 'ff_unifiedCreateLauncher';
const LOCAL_STORAGE_KEY = 'ff.unified_create_launcher';
const ENV_KEY = 'VITE_UNIFIED_CREATE_LAUNCHER_ENABLED';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return null;
}

function readQuery(): boolean | null {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorage(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(LOCAL_STORAGE_KEY));
  } catch {
    return null;
  }
}

function readEnv(): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    return parseFlag(env?.[ENV_KEY]) === true;
  } catch {
    return false;
  }
}

/** True when the unified "+ Nowy" create launcher is enabled (default OFF). */
export function isUnifiedCreateLauncherEnabled(): boolean {
  const fromQuery = readQuery();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnv();
}

export const UNIFIED_CREATE_LAUNCHER_FLAG_KEYS = {
  query: QUERY_KEY,
  localStorage: LOCAL_STORAGE_KEY,
  env: ENV_KEY,
};
