/**
 * My Work Module - Barrel Exports
 * Part of PMO Upgrade to World-Class Standards
 */

// ============================================================================
// FOCUS COMPONENTS
// ============================================================================
export { FocusBoard } from './Focus/FocusBoard';

// ============================================================================
// INBOX COMPONENTS
// ============================================================================
export { InboxTriage } from './Inbox/InboxTriage';

// ============================================================================
// TASKS COMPONENTS
// ============================================================================
export { TaskFiltersBar } from './Tasks/TaskFiltersBar';
export type { TaskFilters, ViewMode, FilterPreset } from './Tasks/TaskFiltersBar';

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
// LEGACY COMPONENTS (to be deprecated)
// ============================================================================
export { TodayDashboard } from './TodayDashboard';
export { TaskInbox } from './TaskInbox';
export { PersonalExecutionBar } from './PersonalExecutionBar';
export { DecisionsPanel } from './DecisionsPanel';
export { WorkloadView } from './WorkloadView';
export { ProgressView } from './ProgressView';
export { NotificationSettings } from './NotificationSettings';

