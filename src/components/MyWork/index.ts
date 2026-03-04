/**
 * My Work Module - Barrel Exports
 * Unified My Work with ModuleHub pattern (Golden Standard)
 */

// ============================================================================
// MODULEHUB PATTERN (GOLDEN STANDARD)
// ============================================================================

// Main Hub component (unified navigation)
export { MyWorkHub } from './MyWorkHub';

// Content components (used by MyWorkHub)
export { DecisionsPanelContent } from './DecisionsPanelContent';
export { type CanvasToolType } from './ideaSelectionTypes';
export {
  IdeaCanvasToolSelector,
  type IdeaEdge,
  type IdeaNode,
  type IdeaWorkspaceGraph,
} from './IdeaCanvasToolSelector';
export { IdeaAINudgeStrip } from './IdeaAINudgeStrip';
export { IdeaCanvasContextMenu } from './IdeaCanvasContextMenu';
export { IdeaExportMenu } from './IdeaExportMenu';
export { IdeaMapWorkspace } from './IdeaMapWorkspace';
export { IdeaDrawingLayer, type DrawingPath } from './IdeaDrawingLayer';
export { IdeaGhostCards } from './IdeaGhostCards';
export { KPIBadgeNode, ScoreNode, ProgressNode } from './IdeaMetricNodes';
export { IdeaNodeDetailDrawer, type ExtendedNodeData } from './IdeaNodeDetailDrawer';
export type { NodeAttachment as IdeaNodeAttachment, NodeComment as IdeaNodeComment, NodeStatus as IdeaNodeStatus } from './IdeaNodeDetailDrawer';
export { IdeaScenesManager, type Scene } from './IdeaScenesManager';
export { SummaryCardNode } from './IdeaSummaryCardNode';
export { IdeaVotingMode, EmojiReactions } from './IdeaVotingMode';
export { applySmartLayout, equalizeSpacing, snapNodesToGrid, type LayoutAlgorithm } from './layout/IdeaSmartLayout';
export { IdeaSlashCommandMenu } from './IdeaSlashCommandMenu';
export { IdeaWorkspaceToolbar, type IdeaWorkspaceToolbarProps } from './IdeaWorkspaceToolbar';
export { IdeaWorkspaceTools } from './IdeaWorkspaceTools';
export { MyIdeasListContent } from './MyIdeasListContent';
export { ProcessKPIDashboard } from './ProcessKPIDashboard';
export { VSMNodeComponent, VSMProcessNode, VSMInventoryNode, VSMSupplierNode, VSMCustomerNode, VSMPushArrowNode, VSMPullArrowNode, VSMSupermarketNode, VSMFifoNode, VSMKaizenNode, vsmNodeTypes } from './VSMNodeComponent';
export type { VSMShape, VSMDataFields, VSMFieldKey } from './VSMNodeComponent';
export { VSMTimelineBar } from './VSMTimelineBar';
export { IdeaUnifiedSearch, type IdeaUnifiedSearchProps } from './IdeaUnifiedSearch';
export { MyTasksListContent } from './MyTasksListContent';
export { NotificationsContent } from './NotificationsContent';

// Detail view components (for dynamic tabs)
export { DecisionDetailView } from './DecisionDetailView';
export { NotificationDetailView } from './NotificationDetailView';
export { TaskDetailView } from './TaskDetailView';

// ============================================================================
// LEGACY COMPONENTS (kept for backward compatibility)
// ============================================================================

// Main orchestrators (OLD - kept for reference)
export type { NotificationMode } from './NotificationsHub';
export { NotificationsHub } from './NotificationsHub';
export { WorkCenter } from './WorkCenter';

// Navigation components (OLD - kept for reference)
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
// TABLE SUBSYSTEM (V3 Pro)
// ============================================================================
export { AddColumnDialog } from './table/AddColumnDialog';
export { AITableAssistant } from './table/AITableAssistant';
export { CellExpandPopover } from './table/CellExpandPopover';
export { CellRenderer } from './table/CellRenderer';
export { ColorPalette, autoAssignColors } from './table/ColorPalette';
export { ConditionalFormatting, getConditionalStyle } from './table/ConditionalFormatting';
export type { FormatRule } from './table/ConditionalFormatting';
export { ConnectionLines } from './table/ConnectionLines';
export { copyTableToClipboard, csvToNodes, downloadCSV, exportToCSV, parseCSV } from './table/csvUtils';
export { FilterPanel } from './table/FilterPanel';
export { FrameworkGenerator } from './table/FrameworkGenerator';
export { IdeaCompletenessWidget } from './table/IdeaCompletenessWidget';
export { InlineAIFill, BatchAIFillButton } from './table/InlineAIFill';
export { KeyboardShortcutsPanel } from './table/KeyboardShortcutsPanel';
export { RowTemplatePicker, createNodeFromTemplate, ROW_TEMPLATES } from './table/RowTemplatePicker';
export type { RowTemplate } from './table/RowTemplatePicker';
export { IdeaStartupTemplates } from './table/IdeaStartupTemplates';
export { KanbanView } from './table/KanbanView';
export { MatrixView } from './table/MatrixView';
export { MiniCanvas } from './table/MiniCanvas';
export { FileCell, RelationCell, RollupCell, EmojiCell, ColorCell, CurrencyCell, PhoneCell, EmailCell } from './table/NewColumnRenderers';
export { RowDetailPanel } from './table/RowDetailPanel';
export { SmartSuggestionsBar } from './table/SmartSuggestionsBar';
export type { SmartSuggestion } from './table/SmartSuggestionsBar';
export { StickyNoteView } from './table/StickyNoteView';
export { TableSummaryDashboard } from './table/TableSummaryDashboard';
export type { ColumnDef, ColumnType, FilterGroup, FilterRule, NodeAttachment, NodeComment, NodeActivity, SavedView, SortConfig, TableEdge, TableNode } from './table/tableTypes';
export { useIdeaGraphStore, clearIdeaGraphCache } from './table/useIdeaGraphStore';
export { TimelineView } from './table/TimelineView';
export { AICategorizeTool } from './table/AICategorizeTool';
export { IdeaScoringModel } from './table/IdeaScoringModel';
export { ExportToPresentation } from './table/ExportToPresentation';
export { evaluateFormulaV2, batchEvaluateFormulas } from './table/FormulaEngineV2';
export { CollaborationPresence, CellCursor } from './table/CollaborationPresence';
export type { PresenceUser } from './table/CollaborationPresence';
export { IdeaPipeline } from './table/IdeaPipeline';
export type { PipelineStage } from './table/IdeaPipeline';
export { AICopilotMode } from './table/AICopilotMode';
export { VoiceImageInput } from './table/VoiceImageInput';
export { CrossTableRelations } from './table/CrossTableRelations';
export { Sparkline, TrendIndicator, AnalyticsSummaryStrip, HeatmapControls, computeHeatmapStyles } from './table/EmbeddedAnalytics';
export { useTableKeyboard } from './table/useTableKeyboard';
export { useUndoRedo } from './table/useUndoRedo';

// ============================================================================
// SHARED COMPONENTS
// ============================================================================
export { ConvertToConfirmation } from './ConvertToConfirmation';
export {
  type ConvertTargetType,
  ConvertToDialog,
  type ConvertToDialogProps,
} from './ConvertToDialog';
export { ConvertToMenu } from './ConvertToMenu';
export { ConvertToOutputMenu, type ConvertToOutputMenuProps } from './ConvertToOutputMenu';
export { DueDateIndicator, DueDateText } from './shared/DueDateIndicator';
export { EmptyState, EmptyStateInline } from './shared/EmptyState';
export {
  getPMOCategory,
  PMO_CATEGORY_CONFIG,
  PMOCategoryDot,
  PMOPriorityBadge,
} from './shared/PMOPriorityBadge';
export { QuickActions } from './shared/QuickActions';

// ============================================================================
// LEGACY COMPONENTS (kept for backward compatibility)
// ============================================================================
export { DecisionsPanel } from './DecisionsPanel';
export { FocusBoard } from './Focus/FocusBoard';
export type { FocusColumn, FocusItem, FocusItemType } from './Focus/FocusView';
export { FocusView } from './Focus/FocusView';
export type { FocusCockpitProps, FocusLane, FocusTask } from './FocusCockpit';
export { FocusCockpit } from './FocusCockpit';
export { InboxTriage } from './Inbox/InboxTriage';
export { NotificationSettings } from './NotificationSettings';
export { PersonalExecutionBar } from './PersonalExecutionBar';
export { ProgressView } from './ProgressView';
export { TaskInbox } from './TaskInbox';
export type { FilterPreset, TaskFilters, ViewMode } from './Tasks/TaskFiltersBar';
export { TaskFiltersBar } from './Tasks/TaskFiltersBar';
export { TodayDashboard } from './TodayDashboard';
export { WorkloadView } from './WorkloadView';
