/**
 * COORD-11 · DRD scoring — kill switch for the `drd_scoring_v2` calculation
 * engine (`src/services/drdStructure.ts` — `calculateOverallScoreV2` /
 * `calculateAxisScoreV2` / `calculateOverallScoreVersioned` /
 * `calculateAxisScoreVersioned`).
 *
 * Mirrors `siriPmV2Flag.ts` / `tabeleQaFlag.ts` / `recordProvenanceFlag.ts`
 * so operator overrides work consistently across rollouts.
 *
 * Where this flag gates
 * ----------------------
 *   - `buildDrdReportModel()` (`src/services/report/drdReportModel.ts`) reads
 *     this flag to decide `legacy_v1` vs `drd_scoring_v2` WHEN the caller did
 *     not pass an explicit `options.calculationVersion`. An explicit
 *     `calculationVersion` always wins over the flag.
 *   - Default is OFF: `legacy_v1` remains the default calculation path until
 *     Piotr accepts `drd_scoring_v2` on real fixtures — see
 *     `docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/DRD_SCORING_V1_VS_V2.md`.
 *   - ★ Existing approved Outputs/Reports are NEVER recalculated by flipping
 *     this flag — a historical `AssessmentOutput`/`ReportSnapshot`/report row
 *     is immutable once frozen (see `DRD_SCORING_V2_BACKFILL_PLAN.md`). This
 *     flag only ever affects a NEW calculation run, never a stored one.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_drdScoringV2=0|1` — operator bypass.
 *   2. `localStorage["ff.drd_scoring_v2"]` — user / org override.
 *   3. `import.meta.env.VITE_DRD_SCORING_V2` — build-time default.
 *   4. Default: OFF.
 */

const LS_KEY = 'ff.drd_scoring_v2';
const QUERY_KEY = 'ff_drdScoringV2';
const ENV_KEY = 'VITE_DRD_SCORING_V2';

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

export function isDrdScoringV2Enabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const DRD_SCORING_V2_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
