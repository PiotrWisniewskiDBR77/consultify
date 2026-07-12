/**
 * Results Light shell — feature flag for the Results/Rezultaty module
 * redesign (`<ResultsLightShell>`). Gates the Results hub between the
 * current 7-tab `<ResultsHub>` (Initiatives / KPI / Reports / Incoming
 * benefits / ROI / ROI Analysis / AI+Portfolio) and the new lightweight,
 * dense single-surface shell — 3 panes only: KPI · ROI · OKR.
 *
 * Mirrors `assessmentLightFlag.ts` (`<DRDLightShell>`) 1:1 — same
 * resolution order, same OFF-by-default posture (CLAUDE.md #7: no visual
 * surface reaches Piotr except behind a flag, until he signs off on
 * dev-render screenshots).
 *
 * Where this flag gates
 * ---------------------
 *   * The Results module route branches between the legacy `<ResultsHub>`
 *     (unchanged) and `<ResultsLightShell>` when ON.
 *   * `<ResultsLightShell>` is a NEW component (zero edits to ResultsHub)
 *     that reuses the same engines: KPI (`kpiDomain.ts` derive/filter
 *     helpers), ROI (`/api/results*` portfolio summary, net of opex), OKR
 *     (`/api/results-strategic/:projectId/okr` — CRUD/cycles/check-ins via
 *     `okrService.ts`). No data-path change — flipping the flag never
 *     touches persistence.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_resultsLight=0|1` — operator bypass for staging /
 *      visual-review smoke runs.
 *   2. `localStorage["ff.results_light"]` — user / org override.
 *   3. `import.meta.env.VITE_RESULTS_LIGHT` — build-time override.
 *   4. Default: OFF. Ships behind an OFF flag so the proven legacy
 *      `<ResultsHub>` stays the default surface until Piotr signs off on
 *      the redesign on demo. Set any override to `1` to preview.
 */

const LS_KEY = 'ff.results_light';
const QUERY_KEY = 'ff_resultsLight';
const ENV_KEY = 'VITE_RESULTS_LIGHT';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  // Default OFF: when no build-time override is set, the legacy Results hub
  // is the default surface. An explicit `1`/`true` env value opts in.
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

export function isResultsLightEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  // 2026-07-12: default flipped ON per Piotr's explicit request to review
  // everything live on demo.consultify.ai. Explicit ?ff_x=0 or localStorage
  // override still works to force it back OFF.
  return true;
}

export const RESULTS_LIGHT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
