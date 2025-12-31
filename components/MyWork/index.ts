/**
 * My Work Module - Barrel Exports
 * Unified Dashboard + My Work - 65/35 Layout
 */

// ============================================================================
// UNIFIED MYWORK COMPONENTS (NEW)
// ============================================================================

// Main orchestrators
export { WorkCenter } from './WorkCenter';
export { NotificationsHub } from './NotificationsHub';
export type { NotificationMode } from './NotificationsHub';

// Navigation components
export { PillNavigation } from './PillNavigation';
export type { WorkTab } from './PillNavigation';

export { QuickFilterBar } from './QuickFilterBar';
export type { QuickFilter } from './QuickFilterBar';

// ============================================================================
// CORE COMPONENTS (ClickUp-style redesign)
// ============================================================================

// Main navigation (sidebar)
export { WorkSidebar } from './WorkSidebar';
export type { WorkSection, TaskTimeGroup, DecisionGroup } from './WorkSidebar';

// Task management
export { MyTasksList } from './MyTasksList';
export { TaskRow } from './TaskRow';

// Decision management
export { DecisionsList } from './DecisionsList';
export type { Decision } from './DecisionsList';
export { DecisionDetailModal } from './DecisionDetailModal';
export { RelatedObjectPreview } from './RelatedObjectPreview';
export { DecisionBottleneckPanel } from './DecisionBottleneckPanel';

// Projects placeholder
export { MyProjects } from './MyProjects';

// Task detail modal (reused)
export { TaskDetailModal } from './TaskDetailModal';

// ============================================================================
// SHARED COMPONENTS
// ============================================================================
export { 
    PMOPriorityBadge, 
    PMOCategoryDot,
    getPMOCategory,
    PMO_CATEGORY_CONFIG 
} from './shared/PMOPriorityBadge';

export { 
    DueDateIndicator, 
    DueDateText 
} from './shared/DueDateIndicator';

export { 
    QuickActions, 
    QuickActionButton, 
    MoreActionsButton 
} from './shared/QuickActions';
export type { QuickActionType } from './shared/QuickActions';

export { 
    EmptyState, 
    EmptyStateInline 
} from './shared/EmptyState';

// ============================================================================
// LEGACY COMPONENTS (kept for backward compatibility)
// ============================================================================
export { FocusBoard } from './Focus/FocusBoard';
export { InboxTriage } from './Inbox/InboxTriage';
export { TaskFiltersBar } from './Tasks/TaskFiltersBar';
export type { TaskFilters, ViewMode, FilterPreset } from './Tasks/TaskFiltersBar';
export { TodayDashboard } from './TodayDashboard';
export { TaskInbox } from './TaskInbox';
export { PersonalExecutionBar } from './PersonalExecutionBar';
export { DecisionsPanel } from './DecisionsPanel';
export { WorkloadView } from './WorkloadView';
export { ProgressView } from './ProgressView';
export { NotificationSettings } from './NotificationSettings';
