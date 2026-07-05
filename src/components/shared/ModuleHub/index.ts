/**
 * ModuleHub - Shared components for Assessment and Discovery Tools modules
 */

export type { FilterChip } from './ActiveFilters';
export { ActiveFilters } from './ActiveFilters';
export { type BulkAction, BulkActionBar } from './BulkActionBar';
export { DynamicTabs } from './DynamicTabs';
export type { TableColumn, TableRow } from './FilterableTable';
export { FilterableTable } from './FilterableTable';
export type { GridItem } from './GridView';
export { GridView } from './GridView';
// Menu 3 JSX shell + canonical table settings popover — design-system pass 2026-06-03
export { HubWorkAreaLoadError } from './HubWorkAreaLoadError';
export { HubWorkAreaLoading } from './HubWorkAreaLoading';
export { Menu3Row, type Menu3RowProps } from './Menu3Row';
export { ModuleHub } from './ModuleHub';
export type { StatusFilter } from './ModuleNavBar';
export { ModuleNavBar } from './ModuleNavBar';
export type {
  AssessmentStatus,
  InitiativeStatus,
  ModuleContext,
  ReportStatus,
  StatusOption,
} from './StatusDropdown';
export {
  ALL_OPTION,
  ALL_STATUSES,
  ASSESSMENT_STATUSES,
  getStatusesForModule,
  REPORT_STATUSES,
  StatusDropdown,
} from './StatusDropdown';
export {
  type TableSettingsColumn,
  TableSettingsPopover,
  type TableSettingsPopoverProps,
} from './TableSettingsPopover';
export * from './types';
export { useModuleOpenDocuments } from './useModuleOpenDocuments';
export { type TableSelectionApi, useTableSelection } from './useTableSelection';
