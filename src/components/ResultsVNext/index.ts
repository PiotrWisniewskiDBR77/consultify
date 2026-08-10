/**
 * RN-G2 — Results Next registry shell (P0). See RN_G2_UI_SCOPE.md and
 * `ResultsVNextRegistryShell.tsx` for the contract. Future P1/P2/P3 domain
 * screens live in this same folder alongside the shell.
 */
export { HonestValueCell, type HonestValueCellProps } from './HonestValue';
export {
  LifecycleLockBadge,
  type LifecycleLockBadgeProps,
  lockedRowMenuAction,
} from './LifecycleLockBadge';
export { ResultsKpiRegistryPage } from './ResultsKpiRegistryPage';
export { ResultsOkrRegistryPage } from './ResultsOkrRegistryPage';
export {
  ResultsVNextForbiddenState,
  type ResultsVNextForbiddenStateProps,
} from './ResultsVNextForbiddenState';
export {
  ResultsVNextRegistryRouteBase,
  type ResultsVNextRegistryRouteBaseProps,
} from './ResultsVNextRegistryRouteBase';
export {
  ResultsVNextRegistryShell,
  type ResultsVNextRegistryShellProps,
  type ResultsVNextTableProps,
} from './ResultsVNextRegistryShell';
export { ResultsRoiRegistryPage } from './ResultsRoiRegistryPage';
// R09-3 (2026-08-10) — shared, read-only legacy-archive registry (kpi/roi/okr
// `.../legacy` index). Exported for the NEXT wave to wire in as a hub tab —
// deliberately NOT mounted into any existing KPI/ROI/OKR hub here (those
// belong to other in-flight lanes; see the component's own header comment).
export {
  ResultsVNextLegacyArchivePanel,
  type ResultsVNextLegacyArchivePanelProps,
} from './legacy/ResultsVNextLegacyArchivePanel';
export {
  type LegacyArchiveIndexRow,
  type LegacyArchiveIndexMeta,
  type LegacyArchiveIndexResponse,
  type LegacyArchiveOriginDomain,
  LegacyArchiveApiError,
  listLegacyArchiveIndex,
  type ResultsVNextLegacyDomain,
} from './legacy/legacyArchiveApi';
// RN-G2 P2 — ROI vertical (registry list + preview). See `roi/` subfolder:
// `roiApi.ts` (fetch client), `roiRegistryMappers.ts` (status/lock/honest-
// value pure helpers), `roiRegistryPresenters.tsx` (StandardTable/Preview
// builders shared by the live Hub and the dev-render QA harness).
export { ResultsRoiHub } from './roi/ResultsRoiHub';
// RN-G2 P3 #23 — OKR vertical (Sets registry list + preview). See `okr/`
// subfolder: `okrApi.ts` (fetch client), `okrRegistryMappers.ts` (status/
// lock/honest-value pure helpers), `okrRegistryPresenters.tsx`
// (StandardTable/Preview builders shared by the live Hub and the dev-render
// QA harness). Mirrors the `roi/` subfolder exactly.
export { ResultsOkrHub } from './okr/ResultsOkrHub';
// RN-G2 P1 #8 — KPI Scorecards (registry tab on ResultsKpiRegistryPage +
// its own `/results/kpi/scorecards/:scorecardId` detail route). See
// `kpiScorecards/` subfolder: `kpiScorecardApi.ts` (fetch client),
// `kpiScorecardMappers.ts` (status/lock/label pure helpers),
// `kpiScorecardPresenters.tsx` (StandardTable/Preview builders shared by the
// live screens and the dev-render QA harness).
export { ResultsKpiScorecardDetailPage } from './kpiScorecards/ResultsKpiScorecardDetailPage';
export {
  isResultsVNextFlagEnabled,
  RESULTS_VNEXT_FLAG_KEYS,
  resultsVNextHostAllowsDefaultOn,
  type ResultsVNextFlag,
} from './resultsVNextFeatureFlags';
export type {
  HonestValue,
  ResultsVNextDenyReason,
  ResultsVNextDomain,
  ResultsVNextForbiddenDetail,
} from './types';
