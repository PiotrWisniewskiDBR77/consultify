/**
 * RN-G2 — Results Next registry feature flags (default OFF, live-safe).
 *
 * Deliberately a SEPARATE file from `src/components/Results/resultsFeatureFlags.ts`
 * (that file's flags are about the legacy V8 cockpit — m14Handoff/valueDriverTree/
 * threePairs/...; mixing brand-new registry flags into that enum would invite the
 * exact "conflate old and new" risk the master plan's §12 cutover plan is designed
 * to avoid — see docs/product/results-vnext/RN_G2_UI_SCOPE.md §F). A separate file
 * also makes the eventual flag-removal-at-cutover a clean deletion.
 *
 * Resolution order (first wins): URL query (`?ff_x=1`) → localStorage
 * (`ff.results_vnext_x`) → Vite build env (`VITE_RESULTS_VNEXT_X_ENABLED`) →
 * default false. Mirrors `resultsFeatureFlags.ts` / `executionFeatureFlags.ts`.
 *
 * One flag PER DOMAIN (kpi/roi/okr), not per screen — a domain's
 * registry/preview/full-tool ship and are reviewed together as one vertical
 * slice (master plan §9 Etap 5, "trzy równoległe gold flows"). All three
 * default OFF. Promotion to default-ON-outside-prod happens only per-domain,
 * only after that domain's dev-render screenshot round + Piotr's odbiór
 * (CLAUDE.md rule #7) — do NOT flip any of these without a dated comment
 * citing the specific approval, mirroring `resultsFeatureFlags.ts`.
 */

import { isPublicProductionHost } from '@/utils/publicProduction';

type FlagKeys = { query: string; localStorage: string; env: string };

const FLAGS = {
  kpiRegistry: {
    query: 'ff_resultsVNextKpi',
    localStorage: 'ff.results_vnext_kpi_registry',
    env: 'VITE_RESULTS_VNEXT_KPI_ENABLED',
  },
  roiRegistry: {
    query: 'ff_resultsVNextRoi',
    localStorage: 'ff.results_vnext_roi_registry',
    env: 'VITE_RESULTS_VNEXT_ROI_ENABLED',
  },
  okrRegistry: {
    query: 'ff_resultsVNextOkr',
    localStorage: 'ff.results_vnext_okr_registry',
    env: 'VITE_RESULTS_VNEXT_OKR_ENABLED',
  },
} as const satisfies Record<string, FlagKeys>;

export type ResultsVNextFlag = keyof typeof FLAGS;

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return null;
}

function readQuery(key: string): boolean | null {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(key));
  } catch {
    return null;
  }
}

function readLocalStorage(key: string): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function readEnv(key: string): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    return parseFlag(env?.[key]) === true;
  } catch {
    return false;
  }
}

/** True when the given Results Next registry is enabled (default OFF everywhere). */
export function isResultsVNextFlagEnabled(flag: ResultsVNextFlag): boolean {
  const keys = FLAGS[flag];
  const fromQuery = readQuery(keys.query);
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage(keys.localStorage);
  if (fromLs !== null) return fromLs;
  if (readEnv(keys.env)) return true;
  // No D-D default-on set yet (unlike resultsFeatureFlags.ts) — none of these
  // three domains has had a dev-render screenshot round + Piotr's odbiór.
  // Every host (prod, demo, stage, dev) reads OFF until an explicit opt-in.
  return false;
}

/**
 * Guard used by `isPublicProductionHost` callers that want the same shape as
 * `resultsFeatureFlags.ts`'s D-D block, kept here as a documented no-op so a
 * future per-domain promotion has a single, obvious place to add the
 * `!isPublicProductionHost(...)` line (see that file for the pattern).
 */
export function resultsVNextHostAllowsDefaultOn(hostname: string): boolean {
  return !isPublicProductionHost(hostname);
}

export const RESULTS_VNEXT_FLAG_KEYS = FLAGS;
