/**
 * Results Next registry cutover flags.
 *
 * Deliberately a SEPARATE file from `src/components/Results/resultsFeatureFlags.ts`
 * (that file's flags are about the legacy V8 cockpit — m14Handoff/valueDriverTree/
 * threePairs/...; mixing brand-new registry flags into that enum would invite the
 * exact "conflate old and new" risk the master plan's §12 cutover plan is designed
 * to avoid — see docs/product/results-vnext/RN_G2_UI_SCOPE.md §F). A separate file
 * also makes the eventual flag-removal-at-cutover a clean deletion.
 *
 * One flag PER DOMAIN (kpi/roi/okr), not per screen — a domain's
 * registry/preview/full-tool ship together. Ordinary builds default ON.
 * An explicit build-time `false` is the controlled rollback mechanism.
 * URL and localStorage overrides are intentionally ignored after cutover.
 */

import { isPublicProductionHost } from '@/utils/publicProduction';
import type { DemoAcceptanceProfileSource } from '@/utils/demoAcceptanceProfile';

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

function readEnv(key: string): boolean | null {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    return parseFlag(env?.[key]);
  } catch {
    return null;
  }
}

/**
 * RES-001 cutover: all three canonical domains are ON for an ordinary build.
 * Query strings and browser storage are deliberately ignored, so a signed-in
 * user cannot accidentally select a stale shell. An operator can roll back a
 * domain only through its build-time env flag set explicitly to false.
 */
export function isResultsVNextFlagEnabled(
  flag: ResultsVNextFlag,
  _profileSource?: DemoAcceptanceProfileSource
): boolean {
  const keys = FLAGS[flag];
  return readEnv(keys.env) ?? true;
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
