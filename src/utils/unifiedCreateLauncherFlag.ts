/**
 * I1-I3 Faza 0 — unified "+ Nowy" launcher feature flag (default ON od 2026-07-14, akcept Piotra).
 *
 * Gates `UnifiedCreateLauncher` (src/components/shared/UnifiedCreateLauncher.tsx),
 * a single entry point that lets the user pick Insight / Initiative / Decision and
 * delegates to the existing, UNCHANGED generators (InsightCreatorModal,
 * InitiativeCharterWizard, NewDecisionModal). See
 * Harvard/wdrozenie-100/_PLAN_I1-I3_UNIFIKACJA_KREATOROW.md §6 Faza 0.
 *
 * Resolution order (first wins): URL query → localStorage → Vite build env →
 * default true. Same system as `assessmentOutputArtifactsFlag.ts` and
 * `MyWork/mindmap/mindmapExportFlags.ts`. (Do 2026-09-02 wskazywalo tu
 * `src/components/Results/resultsFeatureFlags.ts` — plik usuniety razem
 * z wygaszonym poddrzewem ResultsHub.)
 * Opt-out: `?ff_unifiedCreateLauncher=0` / localStorage `ff.unified_create_launcher=0`.
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

function readEnv(): boolean | null {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    return parseFlag(env?.[ENV_KEY]);
  } catch {
    return null;
  }
}

/**
 * True when the unified "+ Nowy" create launcher is enabled.
 * Default ON od 2026-07-14 (akcept Piotra, galeria v2 poz. 2); opt-out:
 * `?ff_unifiedCreateLauncher=0` lub localStorage `ff.unified_create_launcher=0`.
 */
export function isUnifiedCreateLauncherEnabled(): boolean {
  const fromQuery = readQuery();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  const fromEnv = readEnv();
  if (fromEnv !== null) return fromEnv;
  return true;
}

export const UNIFIED_CREATE_LAUNCHER_FLAG_KEYS = {
  query: QUERY_KEY,
  localStorage: LOCAL_STORAGE_KEY,
  env: ENV_KEY,
};
