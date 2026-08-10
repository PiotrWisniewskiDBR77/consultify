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
