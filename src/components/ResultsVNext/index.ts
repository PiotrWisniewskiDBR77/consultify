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
