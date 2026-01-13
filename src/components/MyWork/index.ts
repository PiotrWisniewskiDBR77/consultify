/**
 * My Work Module - Barrel Exports
 * Unified Dashboard + My Work - 65/35 Layout
 */

// ============================================================================
// UNIFIED MYWORK COMPONENTS (NEW)
// ============================================================================

// Main orchestrators
export type { NotificationMode } from './NotificationsHub';
export { NotificationsHub } from './NotificationsHub';
export { WorkCenter } from './WorkCenter';

// Navigation components
export type { WorkTab } from './PillNavigation';
export { PillNavigation } from './PillNavigation';
export type { QuickFilter } from './QuickFilterBar';
export { QuickFilterBar } from './QuickFilterBar';

// ============================================================================
// CORE COMPONENTS (ClickUp-style redesign)
// ============================================================================

// Main navigation (sidebar)
export type { DecisionGroup, TaskTimeGroup, WorkSection } from './WorkSidebar';
export { WorkSidebar } from './WorkSidebar';

// Task management
export { MyTasksList } from './MyTasksList';
export { TaskRow } from './TaskRow';

// Decision management
export { DecisionBottleneckPanel } from './DecisionBottleneckPanel';
export { DecisionDetailModal } from './DecisionDetailModal';
export type { Decision } from './DecisionsList';
export { DecisionsList } from './DecisionsList';
export { RelatedObjectPreview } from './RelatedObjectPreview';

// Projects placeholder
export { MyProjects } from './MyProjects';

// Task detail modal (reused)
export { TaskDetailModal } from './TaskDetailModal';

// ============================================================================
// SHARED COMPONENTS
// ============================================================================
export { DueDateIndicator, DueDateText } from './shared/DueDateIndicator';
export { EmptyState, EmptyStateInline } from './shared/EmptyState';
export {
  getPMOCategory,
  PMO_CATEGORY_CONFIG,
  PMOCategoryDot,
  PMOPriorityBadge,
} from './shared/PMOPriorityBadge';
export type { QuickActionType } from './shared/QuickActions';
export { MoreActionsButton, QuickActionButton, QuickActions } from './shared/QuickActions';

// ============================================================================
// LEGACY COMPONENTS (kept for backward compatibility)
// ============================================================================
export { DecisionsPanel } from './DecisionsPanel';
export { FocusBoard } from './Focus/FocusBoard';
export { InboxTriage } from './Inbox/InboxTriage';
export { NotificationSettings } from './NotificationSettings';
export { PersonalExecutionBar } from './PersonalExecutionBar';
export { ProgressView } from './ProgressView';
export { TaskInbox } from './TaskInbox';
export type { FilterPreset, TaskFilters, ViewMode } from './Tasks/TaskFiltersBar';
export { TaskFiltersBar } from './Tasks/TaskFiltersBar';
export { TodayDashboard } from './TodayDashboard';
export { WorkloadView } from './WorkloadView';
