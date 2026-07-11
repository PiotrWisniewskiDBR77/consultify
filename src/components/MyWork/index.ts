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
export { IdeaAINudgeStrip } from './IdeaAINudgeStrip';
export { IdeaCanvasContextMenu } from './IdeaCanvasContextMenu';
export { type DrawingPath, IdeaDrawingLayer } from './IdeaDrawingLayer';
export { IdeaExportMenu } from './IdeaExportMenu';
export { IdeaGhostCards } from './IdeaGhostCards';
export { IdeaMapWorkspace } from './IdeaMapWorkspace';
export { KPIBadgeNode, ProgressNode, ScoreNode } from './IdeaMetricNodes';
export type {
  NodeAttachment as IdeaNodeAttachment,
  NodeComment as IdeaNodeComment,
  NodeStatus as IdeaNodeStatus,
} from './IdeaNodeDetailDrawer';
export { type ExtendedNodeData, IdeaNodeDetailDrawer } from './IdeaNodeDetailDrawer';
export { IdeaScenesManager, type Scene } from './IdeaScenesManager';
export { type CanvasToolType } from './ideaSelectionTypes';
export { IdeaSlashCommandMenu } from './IdeaSlashCommandMenu';
export { SummaryCardNode } from './IdeaSummaryCardNode';
export { IdeaUnifiedSearch, type IdeaUnifiedSearchProps } from './IdeaUnifiedSearch';
export { EmojiReactions, IdeaVotingMode } from './IdeaVotingMode';
export { IdeaWorkspaceToolbar, type IdeaWorkspaceToolbarProps } from './IdeaWorkspaceToolbar';
export { IdeaWorkspaceTools } from './IdeaWorkspaceTools';
export {
  applySmartLayout,
  equalizeSpacing,
  type LayoutAlgorithm,
  snapNodesToGrid,
} from './layout/IdeaSmartLayout';
export { MyIdeasListContent } from './MyIdeasListContent';
export { MyTasksListContent } from './MyTasksListContent';
export { ProcessKPIDashboard } from './ProcessKPIDashboard';
export type { VSMDataFields, VSMFieldKey, VSMShape } from './VSMNodeComponent';
export {
  VSMCustomerNode,
  VSMFifoNode,
  VSMInventoryNode,
  VSMKaizenNode,
  VSMNodeComponent,
  vsmNodeTypes,
  VSMProcessNode,
  VSMPullArrowNode,
  VSMPushArrowNode,
  VSMSupermarketNode,
  VSMSupplierNode,
} from './VSMNodeComponent';
export { VSMTimelineBar } from './VSMTimelineBar';

// Detail view components (for dynamic tabs)
export { DecisionDetailView } from './DecisionDetailView';
export { NotificationDetailView } from './NotificationDetailView';
export { TaskDetailView } from './TaskDetailView';

// ============================================================================
// LEGACY COMPONENTS (kept for backward compatibility)
// ============================================================================

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
export { AICategorizeTool } from './table/AICategorizeTool';
export { AICopilotMode } from './table/AICopilotMode';
export { AITableAssistant } from './table/AITableAssistant';
export { CellExpandPopover } from './table/CellExpandPopover';
export { CellRenderer } from './table/CellRenderer';
export { ChatToSchemaPanel } from './table/ChatToSchemaPanel';
export type { PresenceUser } from './table/CollaborationPresence';
export { CellCursor, CollaborationPresence } from './table/CollaborationPresence';
export { autoAssignColors, ColorPalette } from './table/ColorPalette';
export type { FormatRule } from './table/ConditionalFormatting';
export { ConditionalFormatting, getConditionalStyle } from './table/ConditionalFormatting';
export { ConnectionLines } from './table/ConnectionLines';
export { CrossTableRelations } from './table/CrossTableRelations';
export {
  copyTableToClipboard,
  csvToNodes,
  downloadCSV,
  exportToCSV,
  parseCSV,
} from './table/csvUtils';
export {
  AnalyticsSummaryStrip,
  computeHeatmapStyles,
  HeatmapControls,
  Sparkline,
  TrendIndicator,
} from './table/EmbeddedAnalytics';
export { ExportToPresentation } from './table/ExportToPresentation';
export { FilterPanel } from './table/FilterPanel';
export { batchEvaluateFormulas, evaluateFormulaV2 } from './table/FormulaEngineV2';
export { FrameworkGenerator } from './table/FrameworkGenerator';
export { IdeaCompletenessWidget } from './table/IdeaCompletenessWidget';
export type { PipelineStage } from './table/IdeaPipeline';
export { IdeaPipeline } from './table/IdeaPipeline';
export { IdeaScoringModel } from './table/IdeaScoringModel';
export { IdeaStartupTemplates } from './table/IdeaStartupTemplates';
export { BatchAIFillButton, InlineAIFill } from './table/InlineAIFill';
export { KanbanView } from './table/KanbanView';
export { KeyboardShortcutsPanel } from './table/KeyboardShortcutsPanel';
export { MatrixView } from './table/MatrixView';
export { MiniCanvas } from './table/MiniCanvas';
export {
  ColorCell,
  CurrencyCell,
  EmailCell,
  EmojiCell,
  FileCell,
  PhoneCell,
  RelationCell,
  RollupCell,
} from './table/NewColumnRenderers';
export { RowDetailPanel } from './table/RowDetailPanel';
export type { RowTemplate } from './table/RowTemplatePicker';
export {
  createNodeFromTemplate,
  ROW_TEMPLATES,
  RowTemplatePicker,
} from './table/RowTemplatePicker';
export {
  SchemaProposalCard,
  type SchemaProposalCardProposal,
  type SchemaProposalOperation,
  type SchemaProposalWarning,
} from './table/SchemaProposalCard';
export type { SmartSuggestion } from './table/SmartSuggestionsBar';
export { SmartSuggestionsBar } from './table/SmartSuggestionsBar';
export { StickyNoteView } from './table/StickyNoteView';
export { TableSummaryDashboard } from './table/TableSummaryDashboard';
export type {
  ColumnDef,
  ColumnType,
  FilterGroup,
  FilterRule,
  NodeActivity,
  NodeAttachment,
  NodeComment,
  SavedView,
  SortConfig,
  TableEdge,
  TableNode,
} from './table/tableTypes';
export { TimelineView } from './table/TimelineView';
export { clearIdeaGraphCache, useIdeaGraphStore } from './table/useIdeaGraphStore';
export { useTableKeyboard } from './table/useTableKeyboard';
export { useUndoRedo } from './table/useUndoRedo';
export { VoiceImageInput } from './table/VoiceImageInput';

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
export { InboxTriage } from './Inbox/InboxTriage';
export { NotificationSettings } from './NotificationSettings';
export { PersonalExecutionBar } from './PersonalExecutionBar';
export type { FilterPreset, TaskFilters, ViewMode } from './Tasks/TaskFiltersBar';
export { TaskFiltersBar } from './Tasks/TaskFiltersBar';
