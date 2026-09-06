/**
 * M06 FALA3 3.4 — Mind map native .pptx export flag (default OFF).
 *
 * OFF (default): ExportPowerPoint.tsx keeps generating the legacy HTML blob
 * (unchanged today's behavior).
 * ON: handleExport calls the new backend endpoint
 * `POST /api/my-work/my-ideas/:ideaId/map/export/pptx`, which reuses
 * `PptxPipelineService.generateFromUnifiedJson` for a real BCG-grade .pptx.
 *
 * Resolution order (first wins): URL query → localStorage → Vite build env → default false.
 * Same system as `src/utils/unifiedCreateLauncherFlag.ts`. (Do 2026-09-02
 * wskazywalo tu `src/components/Results/resultsFeatureFlags.ts` — plik
 * usuniety razem z wygaszonym poddrzewem ResultsHub.)
 */

const QUERY_KEY = 'ff_mindmapPptxNative';
const LOCAL_STORAGE_KEY = 'ff.mindmap_pptx_native';
const ENV_KEY = 'VITE_MINDMAP_PPTX_NATIVE_ENABLED';

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
    const env = (import.meta.env as unknown as Record<string, string>);
    return parseFlag(env?.[ENV_KEY]) === true;
  } catch {
    return false;
  }
}

/** True when the native .pptx mind-map export endpoint should be used (default OFF). */
export function isMindmapPptxNativeEnabled(): boolean {
  const fromQuery = readQuery();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnv();
}

export const MINDMAP_PPTX_NATIVE_FLAG_KEYS = {
  query: QUERY_KEY,
  localStorage: LOCAL_STORAGE_KEY,
  env: ENV_KEY,
};
