/**
 * IdeaTableTool — V3 Pro Table canvas for Idea Workspace.
 *
 * Rich column types, inline edit, multi-sort, advanced filters, grouping,
 * column config (show/hide/reorder/resize), saved views, selection contract,
 * undo/redo, keyboard navigation, bulk actions, row detail panel, footer aggregations.
 * Data lives in shared IdeaWorkspaceGraph (nodes/edges/extensions.table).
 */
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Brain,
  Calendar,
  Camera,
  ChevronDown,
  ClipboardCopy,
  Columns3,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Flame,
  GanttChart,
  Grid3X3,
  GripVertical,
  Group,
  History,
  KanbanSquare,
  Keyboard,
  Layers,
  Layout,
  LayoutGrid,
  LayoutTemplate,
  Link2,
  Loader2,
  Maximize2,
  Mic,
  Network,
  Paintbrush,
  Palette,
  Plus,
  Presentation,
  Redo2,
  Rocket,
  Save,
  Send,
  Sparkles,
  StickyNote,
  Table2,
  Trash2,
  Trophy,
  Undo2,
  Upload,
  Webhook,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useV8FeatureFlag } from '@/hooks/useV8FeatureFlag';
import { Api } from '@/services/api';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';

import { EmptyStateInline } from '../shared/NModeBlocks/EmptyStateInline';
import {
  EMPTY_SELECTION,
  IDEA_GRAPH_UPDATE_EVENT,
  IDEA_WORKSPACE_INSERT_EVENT,
  type IdeaWorkspaceInsertDetail,
  type IdeaWorkspaceSelection,
} from './ideaSelectionTypes';
import { ActivityFeed } from './table/ActivityFeed';
import { AddColumnDialog } from './table/AddColumnDialog';
import { AICategorizeTool } from './table/AICategorizeTool';
import { AICopilotMode } from './table/AICopilotMode';
import { AITableAssistant } from './table/AITableAssistant';
import { AITableProposal, type TableProposal } from './table/AITableProposal';
import { AuditTrailPanel } from './table/AuditTrailPanel';
import { AutomationsManager } from './table/automations/AutomationsManager';
// Stage 3: Extracted view components
import { CalendarView } from './table/CalendarView';
import { CellExpandPopover } from './table/CellExpandPopover';
import { CellRenderer } from './table/CellRenderer';
import {
  CellCursor,
  CollaborationPresence,
  type PresenceUser,
  WorkspaceLockIndicator,
  WorkspacePresenceIndicator,
} from './table/CollaborationPresence';
import { autoAssignColors, ColorPalette } from './table/ColorPalette';
import {
  ConditionalFormatting,
  type FormatRule,
  getConditionalStyle,
} from './table/ConditionalFormatting';
import { ConnectionLines } from './table/ConnectionLines';
import { ConnectorList } from './table/connectors/ConnectorList';
import { ConnectorWizard } from './table/connectors/ConnectorWizard';
import { RunHistoryPanel } from './table/connectors/RunHistoryPanel';
import { type Connector, useConnectors } from './table/connectors/useConnectors';
import { WebhookRelayPanel } from './table/connectors/WebhookRelayPanel';
import { CrossTableRelations } from './table/CrossTableRelations';
import {
  copyTableToClipboard,
  csvToNodes,
  downloadCSV,
  exportToCSV,
  parseCSV,
} from './table/csvUtils';
import { DistributionManager } from './table/distribution/DistributionManager';
import { DistributionBuilder } from './table/DistributionBuilder';
import { computeHeatmapStyles, HeatmapControls } from './table/EmbeddedAnalytics';
import { ExportToPresentation } from './table/ExportToPresentation';
import { FilterBuilder } from './table/FilterBuilder';
import { FilterPanel } from './table/FilterPanel';
import FormBuilder from './table/FormBuilder';
import { FormsIndex } from './table/forms/FormsIndex';
import { batchEvaluateFormulas } from './table/FormulaEngineV2';
import { FrameworkGenerator } from './table/FrameworkGenerator';
import { GovernedModelsDashboard } from './table/governed/GovernedModelsDashboard';
import { GridView } from './table/GridView';
import { IdeaPipeline } from './table/IdeaPipeline';
import { IdeaScoringModel } from './table/IdeaScoringModel';
import { BatchAIFillButton, InlineAIFill } from './table/InlineAIFill';
import { ConsultifyLinkPanel } from './table/integration/ConsultifyLinkPanel';
import { InterfaceDesigner } from './table/InterfaceDesigner';
import { InterfacesIndex } from './table/interfaces/InterfacesIndex';
import { KanbanView } from './table/KanbanView';
import { KeyboardShortcutsPanel } from './table/KeyboardShortcutsPanel';
import { MatrixView } from './table/MatrixView';
import { MobileToolbarMenu } from './table/MobileToolbarMenu';
import { PresenceIndicators } from './table/PresenceIndicators';
import { RecordExpandModal } from './table/RecordExpandModal';
import { RowDetailPanel } from './table/RowDetailPanel';
import { type RowTemplate, RowTemplatePicker } from './table/RowTemplatePicker';
import { SharingManager } from './table/sharing/SharingManager';
import { StatusBar } from './table/StatusBar';
import { StickyNoteView } from './table/StickyNoteView';
import { SyncManager } from './table/sync/SyncManager';
// P15 Table Platform – extracted components
import { TableDataProvider } from './table/TableDataProvider';
import { TableTabStrip } from './table/TableTabStrip';
import { TableToolbar as P15TableToolbar } from './table/TableToolbar';
import type {
  ColumnDef,
  FilterGroup,
  SavedView,
  SortConfig,
  TableEdge,
  TableNode,
} from './table/tableTypes';
import { computeAggregation } from './table/tableTypes';
import { TemplateGallery } from './table/TemplateGallery';
import { TimelineView } from './table/TimelineView';
// Domain hooks extracted from this file (Stage 1 refactor)
import { useRollupComputation } from './table/useRollupComputation';
import { useTableKeyboard } from './table/useTableKeyboard';
import { useTablePersistence } from './table/useTablePersistence';
import { useTablePlatformIntegration } from './table/useTablePlatformIntegration';
import { useTableQuickActions } from './table/useTableQuickActions';
import { useTableRealtime } from './table/useTableRealtime';
import { useTableRows } from './table/useTableRows';
import { useTableSchema } from './table/useTableSchema';
import { useTableViews } from './table/useTableViews';
import { useUndoRedo } from './table/useUndoRedo';
import { ViewRouter as P15ViewRouter } from './table/ViewRouter';
import type { ViewConfigState } from './table/views/ViewConfigPanel';
import { ViewRouter as LegacyViewRouter } from './table/views/ViewRouter';
import { VoiceImageInput } from './table/VoiceImageInput';
import { WorkflowDashboard } from './table/WorkflowDashboard';

interface IdeaTableToolProps {
  open: boolean;
  ideaId: string;
  /** When set (e.g. `?tpTable=` deep link), load this table-platform table if it belongs to `ideaId`. */
  preferredPlatformTableId?: string | null;
  /** When set (e.g. `?tpView=` deep link), activate this view after the table loads. */
  preferredViewId?: string | null;
  locked?: boolean;
  refreshToken?: number;
  focusMode?: 'system' | 'object' | null;
  focusObjectId?: string | null;
  onSaved?: () => void;
  onSelectionChange?: (sel: IdeaWorkspaceSelection) => void;
  onConvert?: (target: string) => void;
  onGraphChange?: (graph: {
    nodes: any[];
    edges: any[];
    extensions?: Record<string, unknown>;
  }) => void;
  onTableContextChange?: (ctx: {
    baseId?: string;
    tableId: string;
    tableName: string;
    activeViewId?: string;
    fieldCount: number;
    recordCount: number;
  }) => void;
}

// DEFAULT_COLUMNS now lives in useTableSchema.ts

export const IdeaTableTool: React.FC<IdeaTableToolProps> = ({
  open,
  ideaId,
  preferredPlatformTableId = null,
  preferredViewId = null,
  locked = false,
  refreshToken,
  focusMode,
  focusObjectId,
  onSaved,
  onSelectionChange,
  onConvert: onConvertProp,
  onGraphChange,
  onTableContextChange,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const currentUser = useAppStore((state) => state.currentUser);
  const currentOrganization = useAppStore((state) => state.currentOrganization);
  const currentUserId = currentUser?.id || 'current-user';
  const currentUserName =
    currentUser?.displayName ||
    [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ').trim() ||
    currentUser?.email ||
    'Me';
  const workspaceId = currentOrganization?.id || currentUser?.organizationId || null;
  const { isEnabled: isV8MultiplayerEnabled } = useV8FeatureFlag(
    'v8_multiplayer_enabled',
    currentUser?.isAuthenticated === true
  );

  // ── Data connectors ────────────────────────────────────────────────────────
  const connectors = useConnectors(ideaId);

  /** User-selected table from the bottom tab strip; overrides `preferredPlatformTableId` until cleared. */
  const [platformTableOverrideId, setPlatformTableOverrideId] = useState<string | null>(null);

  // ── Table Platform integration (metadata-first) ──────────────────────────
  const platformIntegration = useTablePlatformIntegration({
    ideaId,
    locked,
    isPl,
    open,
    onSelectionChange: onSelectionChange as (sel: unknown) => void | undefined,
    preferredTableId: platformTableOverrideId ?? preferredPlatformTableId,
  });

  // Platform may be active via feature flags, but we can still fall back to
  // legacy graph persistence if the new backend is effectively empty.
  const platformActive = platformIntegration.active;

  useEffect(() => {
    setPlatformTableOverrideId(null);
  }, [ideaId, preferredPlatformTableId]);

  useEffect(() => {
    if (preferredViewId && platformActive && platformIntegration.setActiveViewId) {
      platformIntegration.setActiveViewId(preferredViewId);
    }
  }, [preferredViewId, platformActive, platformIntegration.setActiveViewId]);

  // ── Table Platform real-time collaboration ─────────────────────────────────
  const realtime = useTableRealtime({
    tableId: platformActive ? ideaId : null,
    userId: currentUserId,
    userName: currentUserName,
  });

  // ── Domain hooks (Stage 1 extraction) ───────────────────────────────────────
  const schema = useTableSchema(isPl, ideaId);
  const {
    columns,
    setColumns,
    visibleColumns,
    toggleColumn,
    handleAddColumn,
    renameColumn,
    updateColumnConfig,
    deleteColumn,
    handleResizeStart,
    handleColDragStart,
    handleColDragOver,
    handleColDragEnd,
    resizingCol,
    dragColKey,
    mergePersistedColumns,
  } = schema;

  // Platform override: columns
  const effectiveColumns = platformActive ? platformIntegration.columns : columns;
  const effectiveVisibleColumns = platformActive
    ? platformIntegration.visibleColumns
    : visibleColumns;

  const applyViewColumns = useCallback(
    (viewCols: { key: string; visible: boolean; width: number }[]) => {
      setColumns((prev) => {
        const viewMap = new Map(viewCols.map((vc) => [vc.key, vc]));
        return prev.map((c) => {
          const vc = viewMap.get(c.key);
          return vc ? { ...c, visible: vc.visible, width: vc.width } : c;
        });
      });
    },
    []
  );

  const views = useTableViews({
    isPl,
    ideaId,
    onApplyColumns: applyViewColumns,
  });
  const {
    viewLayout,
    setViewLayout,
    savedViews,
    setSavedViews,
    activeViewId,
    setActiveViewId,
    sort,
    setSort,
    filters,
    setFilters,
    groupBy,
    setGroupBy,
    filterInput,
    setFilterInput,
    applyView,
    saveCurrentView,
    updateSavedView,
    deleteSavedView,
    cycleSort,
  } = views;

  // Platform override: views
  const effectiveViewLayout = platformActive ? platformIntegration.viewLayout : viewLayout;
  const effectiveSetViewLayout = platformActive ? platformIntegration.setViewLayout : setViewLayout;
  const effectiveSavedViews = platformActive ? platformIntegration.savedViews : savedViews;
  const effectiveActiveViewId = platformActive ? platformIntegration.activeViewId : activeViewId;
  const effectiveSort = platformActive ? platformIntegration.sort : sort;
  const effectiveSetSort = platformActive ? platformIntegration.setSort : setSort;
  const effectiveFilters = platformActive ? platformIntegration.filters : filters;
  const effectiveSetFilters = platformActive ? platformIntegration.setFilters : setFilters;
  const effectiveGroupBy = platformActive ? platformIntegration.groupBy : groupBy;
  const effectiveSetGroupBy = platformActive ? platformIntegration.setGroupBy : setGroupBy;

  // ── Core data state ──────────────────────────────────────────────────────────
  const [edges, setEdges] = useState<TableEdge[]>([]);
  const [extensions, setExtensions] = useState<Record<string, unknown>>({});
  const nodesUndo = useUndoRedo<TableNode[]>([]);
  // Bridge for the canvas rail undo (CanvasLeftToolbar emits tbl_undo before handlePlatformUndo is defined).
  const platformUndoRef = useRef<() => void | Promise<void>>(() => nodesUndo.undo());
  const [formatRules, setFormatRules] = useState<FormatRule[]>([]);
  const [matrixAxisXKey, setMatrixAxisXKey] = useState<string | null>(null);
  const [matrixAxisYKey, setMatrixAxisYKey] = useState<string | null>(null);

  // ── Row operations hook ─────────────────────────────────────────────────────
  const rowOps = useTableRows({
    ideaId,
    locked,
    isPl,
    currentUserName,
    nodesUndo,
    sort,
    filters,
    filterInput,
    groupBy,
    focusMode,
    focusObjectId,
    onSelectionChange,
  });
  const {
    nodes,
    processedRows,
    groupedRows,
    selectedRowIds,
    setSelectedRowIds,
    toggleRowSelection,
    handleFieldChange,
    handleAddRow,
    handleAddRowWithTemplate,
    handleTemplateSelect,
    handleBulkDelete,
    handleReorderNode,
    handleAddSubItem,
    showRowTemplatePicker,
    setShowRowTemplatePicker,
    addRowBtnRect,
    setAddRowBtnRect,
  } = rowOps;

  // Fall back to legacy graph data when the metadata-first table is effectively
  // empty but the legacy workspace graph already contains richer seeded content.
  const platformLooksEmpty =
    platformActive &&
    !platformIntegration.loading &&
    platformIntegration.nodes.length === 0 &&
    platformIntegration.columns.length <= 1;
  const legacyLooksPopulated = nodes.length > 0 || columns.length > 1;
  const usePlatform = platformActive && !(platformLooksEmpty && legacyLooksPopulated);

  useEffect(() => {
    if (!usePlatform || !platformIntegration.table) return;
    onTableContextChange?.({
      baseId: platformIntegration.base?.id,
      tableId: platformIntegration.table.id,
      tableName: platformIntegration.table.name,
      activeViewId: platformIntegration.activeViewId || undefined,
      fieldCount: platformIntegration.platformFields?.length || 0,
      recordCount: platformIntegration.totalRecords || 0,
    });
  }, [
    usePlatform,
    platformIntegration.table?.id,
    platformIntegration.activeViewId,
    onTableContextChange,
  ]);

  // Platform override: rows
  const effectiveNodes = (usePlatform ? platformIntegration.nodes : nodes) ?? [];
  const effectiveProcessedRows =
    (usePlatform ? platformIntegration.processedRows : processedRows) ?? [];
  const effectiveGroupedRows = usePlatform ? platformIntegration.groupedRows : groupedRows;
  const effectiveSelectedRowIds = usePlatform ? platformIntegration.selectedRowIds : selectedRowIds;
  const effectiveSetSelectedRowIds = usePlatform
    ? platformIntegration.setSelectedRowIds
    : setSelectedRowIds;
  const effectiveHandleFieldChange = usePlatform
    ? platformIntegration.handleFieldChange
    : handleFieldChange;
  const effectiveHandleAddRow = usePlatform ? platformIntegration.handleAddRow : handleAddRow;
  const effectiveHandleBulkDelete = usePlatform
    ? platformIntegration.handleBulkDelete
    : handleBulkDelete;

  const effectiveCycleSort = useCallback(
    (key: string) => {
      const setter = usePlatform ? effectiveSetSort : setSort;
      const current = usePlatform ? effectiveSort : sort;
      if (!current || current.key !== key) setter({ key, direction: 'asc' });
      else if (current.direction === 'asc') setter({ key, direction: 'desc' });
      else setter(null);
    },
    [usePlatform, effectiveSetSort, setSort, effectiveSort, sort]
  );

  useEffect(() => {
    onGraphChange?.({
      nodes: nodes as any[],
      edges: edges as any[],
      extensions,
    });
  }, [edges, extensions, nodes, onGraphChange]);

  useEffect(() => {
    if (!open || locked) return;
    const handleInsert = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as IdeaWorkspaceInsertDetail;
      if (detail.ideaId && detail.ideaId !== ideaId) return;

      const items = Array.isArray(detail.items)
        ? detail.items
        : [
            {
              label: detail.label,
              text: detail.text,
              data: {},
              position: detail.position,
            },
          ];
      const validItems = items.filter(
        (item) =>
          (item.label && String(item.label).trim()) || (item.text && String(item.text).trim())
      );
      if (!validItems.length) return;

      const now = new Date().toISOString();
      const nextRows = validItems.map((item) => ({
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'idea' as const,
        data: {
          label: String(item.label || item.text || '').trim(),
          status: 'todo',
          created_time: now,
          created_by: currentUserId,
          last_edited_time: now,
          last_edited_by: currentUserId,
          ...(item.data && typeof item.data === 'object' ? item.data : {}),
        },
        position: item.position || { x: 0, y: 0 },
      }));

      nodesUndo.push([...(nodes || []), ...nextRows]);
      const insertedIds = nextRows.map((row) => row.id);
      setSelectedRowIds(new Set(insertedIds));
      onSelectionChange?.({
        type: 'row',
        count: insertedIds.length,
        ids: insertedIds,
        primaryId: insertedIds[0],
      });
    };

    window.addEventListener(IDEA_WORKSPACE_INSERT_EVENT, handleInsert);
    return () => window.removeEventListener(IDEA_WORKSPACE_INSERT_EVENT, handleInsert);
  }, [currentUserId, ideaId, locked, nodes, nodesUndo, onSelectionChange, open, setSelectedRowIds]);

  // ── Rollup computation (inject aggregated values for rollup columns) ───────
  const processedRowsWithRollups = useRollupComputation(
    usePlatform ? effectiveProcessedRows : processedRows,
    usePlatform ? effectiveColumns : columns,
    usePlatform ? effectiveNodes : nodes,
    edges
  );

  // ── Persistence hook ────────────────────────────────────────────────────────
  const { loading, saving, saveStatusLabel, handleSave, loadError, refresh } = useTablePersistence({
    open,
    ideaId,
    isPl,
    locked,
    refreshToken,
    language: i18n.language,
    onSaved,
    nodes,
    edges,
    extensions,
    columns,
    savedViews,
    activeViewId,
    sort,
    filters,
    groupBy,
    formatRules,
    viewLayout,
    setNodes: nodesUndo.set,
    setEdges,
    setExtensions,
    mergePersistedColumns,
    setSavedViews,
    setActiveViewId,
    setFormatRules,
    setViewLayout,
  });

  // Platform override: persistence
  const effectiveLoading = usePlatform ? platformIntegration.loading : loading;
  const effectiveSaving = usePlatform ? platformIntegration.saving : saving;
  const effectiveSaveStatusLabel = usePlatform
    ? platformIntegration.saveStatusLabel
    : saveStatusLabel;
  const effectiveHandleSave = usePlatform ? platformIntegration.handleSave : handleSave;
  const effectiveLoadError = usePlatform ? platformIntegration.error : loadError;
  const effectiveRefresh = usePlatform ? platformIntegration.refresh : refresh;

  useEffect(() => {
    if (!open) return;
    const handleGraphRefresh = (event: Event) => {
      const detail = (event as CustomEvent).detail as { ideaId?: string } | undefined;
      if (detail?.ideaId && detail.ideaId !== ideaId) return;
      effectiveRefresh().catch(() => {});
    };
    window.addEventListener(IDEA_GRAPH_UPDATE_EVENT, handleGraphRefresh);
    return () => window.removeEventListener(IDEA_GRAPH_UPDATE_EVENT, handleGraphRefresh);
  }, [ideaId, open, effectiveRefresh]);

  // ── Platform switch: alias effective values for JSX consumption ────────────
  // When platform is active, these shadow the legacy values so the entire
  // render tree uses the new backend without touching 1500+ lines of JSX.
  const _cols = (usePlatform ? effectiveColumns : columns) ?? [];
  const _visCols = (usePlatform ? effectiveVisibleColumns : visibleColumns) ?? [];
  const _vl = usePlatform ? effectiveViewLayout : viewLayout;
  const _sort = usePlatform ? effectiveSort : sort;
  const _filters = (usePlatform ? effectiveFilters : filters) ?? {
    logic: 'and' as const,
    rules: [],
  };
  const _groupBy = usePlatform ? effectiveGroupBy : groupBy;
  const _savedViews = (usePlatform ? effectiveSavedViews : savedViews) ?? [];
  const _activeViewId = usePlatform ? effectiveActiveViewId : activeViewId;
  const _selIds = usePlatform ? effectiveSelectedRowIds : selectedRowIds;
  const _fieldChange = usePlatform ? effectiveHandleFieldChange : handleFieldChange;
  const _addRow = usePlatform ? effectiveHandleAddRow : handleAddRow;
  const _bulkDel = usePlatform ? effectiveHandleBulkDelete : handleBulkDelete;
  const _loading = usePlatform ? effectiveLoading : loading;
  const _saving = usePlatform ? effectiveSaving : saving;
  const _saveLabel = usePlatform ? effectiveSaveStatusLabel : saveStatusLabel;
  const _save = usePlatform ? effectiveHandleSave : handleSave;

  // ── UI overlay state ────────────────────────────────────────────────────────
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showFrameworkGen, setShowFrameworkGen] = useState(false);
  const [showConditionalFmt, setShowConditionalFmt] = useState(false);
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<'preview' | 'full'>('preview');
  const [aiProposal, setAiProposal] = useState<TableProposal | null>(null);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [activePalette, setActivePalette] = useState('vibrant');
  const [, setShowSummaryDashboard] = useState(false);
  const [cellExpandState, setCellExpandState] = useState<{
    nodeId: string;
    colKey: string;
    rect: DOMRect;
  } | null>(null);
  const [selectedNodeForLines, setSelectedNodeForLines] = useState<string | null>(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showAICategorize, setShowAICategorize] = useState(false);
  const [showScoringModel, setShowScoringModel] = useState(false);
  const [showExportPresentation, setShowExportPresentation] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [showCrossRelations, setShowCrossRelations] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapColumns, setHeatmapColumns] = useState<Set<string>>(new Set());
  const [heatmapPalette, setHeatmapPalette] = useState<'warm' | 'cool' | 'diverging'>('warm');
  const [remotePresenceUsers, setRemotePresenceUsers] = useState<PresenceUser[]>([]);
  const [editingHeaderKey, setEditingHeaderKey] = useState<string | null>(null);
  const [showSaveViewDialog, setShowSaveViewDialog] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [viewContextMenu, setViewContextMenu] = useState<{
    viewId: string;
    x: number;
    y: number;
  } | null>(null);
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const [renamingViewName, setRenamingViewName] = useState('');
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const [showConnectorWizard, setShowConnectorWizard] = useState(false);
  const [showConnectorList, setShowConnectorList] = useState(false);
  const [showWebhookRelays, setShowWebhookRelays] = useState(false);
  const [platformTab, setPlatformTab] = useState<
    'data' | 'forms' | 'interfaces' | 'models' | 'workflow'
  >('data');
  const [showInterfaceDesigner, setShowInterfaceDesigner] = useState(false);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [showDistributionBuilder, setShowDistributionBuilder] = useState(false);
  const [showAutomationsManager, setShowAutomationsManager] = useState(false);
  const [showSyncManager, setShowSyncManager] = useState(false);
  const [showSharingManager, setShowSharingManager] = useState(false);
  const [showDistributionManager, setShowDistributionManager] = useState(false);
  const [showConsultifyLink, setShowConsultifyLink] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [connectorHistoryTarget, setConnectorHistoryTarget] = useState<Connector | null>(null);
  const [colContextMenu, setColContextMenu] = useState<{
    colKey: string;
    x: number;
    y: number;
  } | null>(null);
  const [platformViewConfig, setPlatformViewConfig] = useState<ViewConfigState>({
    viewType: 'grid',
    visibleFieldIds: [],
    galleryCardSize: 'medium',
  });
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [baseTables, setBaseTables] = useState<{ id: string; name: string }[]>([]);
  const [statusBarAggConfig, setStatusBarAggConfig] = useState<Record<string, string>>({});
  const csvInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [tableViewportWidth, setTableViewportWidth] = useState(0);

  useEffect(() => {
    if (_loading || _vl !== 'table') return;
    const el = tableContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const updateWidth = () => setTableViewportWidth(el.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(el);
    return () => observer.disconnect();
  }, [_loading, _vl]);
  const stretchedVisibleCols = useMemo(() => {
    if (_visCols.length === 0) return _visCols;

    const fixedChromeWidth = 72;
    const preferredWidth = _visCols.reduce((sum, col) => sum + col.width, 0);
    const availableWidth = Math.max(0, tableViewportWidth - fixedChromeWidth);
    if (availableWidth <= preferredWidth) return _visCols;

    const extraWidth = availableWidth - preferredWidth;
    const extraPerColumn = Math.floor(extraWidth / _visCols.length);
    let remainder = extraWidth % _visCols.length;

    return _visCols.map((col) => {
      const width = col.width + extraPerColumn + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      return { ...col, width };
    });
  }, [_visCols, tableViewportWidth]);
  const tableWidth = Math.max(
    tableViewportWidth,
    stretchedVisibleCols.reduce((sum, col) => sum + col.width, 72)
  );

  // ── Multi-table tab strip: load tables list ─────────────────────────────────
  const platformTableId = usePlatform
    ? ((platformIntegration as any).platformFields?.[0]?.tableId ?? ideaId)
    : null;

  const primaryPlatformInterfaceView = useMemo(() => {
    const views = platformIntegration.platformViews ?? [];
    return views.find(
      (v: { viewType?: string; name?: string }) =>
        v.viewType === 'interface' ||
        String(v.name ?? '')
          .toLowerCase()
          .includes('interface')
    ) as
      | {
          id?: string;
          config?: { blocks?: unknown[]; theme?: Record<string, unknown> };
        }
      | undefined;
  }, [platformIntegration.platformViews]);

  useEffect(() => {
    if (!usePlatform) return;
    let cancelled = false;
    (async () => {
      try {
        const bases = await TablePlatformApi.listBases(ideaId);
        const baseRow = Array.isArray(bases) ? bases[0] : null;
        if (!baseRow || cancelled) return;
        const baseId = String((baseRow as Record<string, unknown>).id ?? '');
        const fullBase = await TablePlatformApi.getBase(baseId);
        const tables = ((fullBase as Record<string, unknown>)?.tables ?? []) as {
          id: string;
          name: string;
        }[];
        if (!cancelled) {
          setBaseTables(
            tables.map((t: any) => ({ id: String(t.id), name: String(t.name ?? 'Untitled') }))
          );
        }
      } catch {
        // silently fail
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [usePlatform, ideaId]);

  const handleTabSelectTable = useCallback(
    (tableId: string) => {
      if (!usePlatform) return;
      setPlatformTableOverrideId(tableId);
      setExpandedRecordId(null);
      toast(isPl ? 'Przełączono tabelę' : 'Switched table');
    },
    [usePlatform, isPl]
  );

  const handleTabCreateTable = useCallback(async () => {
    if (!usePlatform) return;
    const name = window.prompt(isPl ? 'Nazwa nowej tabeli:' : 'New table name:');
    if (!name?.trim()) return;
    try {
      const bases = await TablePlatformApi.listBases(ideaId);
      const baseRow = Array.isArray(bases) ? bases[0] : null;
      if (!baseRow) return;
      const baseId = String((baseRow as Record<string, unknown>).id ?? '');
      const created = await TablePlatformApi.createTable(baseId, name.trim());
      if (created) {
        setBaseTables((prev) => [...prev, { id: String((created as any).id), name: name.trim() }]);
        toast.success(isPl ? 'Tabela utworzona' : 'Table created');
      }
    } catch {
      toast.error(isPl ? 'Nie udało się utworzyć tabeli' : 'Failed to create table');
    }
  }, [usePlatform, ideaId, isPl]);

  const handleTabRenameTable = useCallback(
    (_tableId: string, _newName: string) => {
      // M08 L-02: optimistic, session-only. Persisting the rename needs a M20
      // backend endpoint (PATCH /table-platform/tables/:id) that does not exist
      // yet — owned by Harvard 5 (table-platform.routes.ts). Wire the API call
      // here once that endpoint lands; until then the new name resets on reload.
      setBaseTables((prev) => prev.map((t) => (t.id === _tableId ? { ...t, name: _newName } : t)));
      toast.success(isPl ? 'Nazwa zmieniona' : 'Renamed');
    },
    [isPl]
  );

  const handleTabDuplicateTable = useCallback(
    async (tableId: string) => {
      const sourceTable = baseTables.find((t) => t.id === tableId);
      const suggestedName = sourceTable?.name
        ? `${sourceTable.name} ${isPl ? 'Kopia' : 'Copy'}`
        : isPl
          ? 'Nowa kopia'
          : 'New copy';
      const name = window.prompt(
        isPl ? 'Nazwa duplikatu tabeli:' : 'Duplicate table name:',
        suggestedName
      );
      if (!name?.trim()) return;
      try {
        const duplicated = await Api.post(`/table-platform/tables/${tableId}/duplicate`, {
          name: name.trim(),
        });
        const duplicatedId = String((duplicated as any)?.id || '').trim();
        const duplicatedName = String((duplicated as any)?.name || name.trim()).trim();
        if (!duplicatedId) throw new Error('missing duplicated table id');
        setBaseTables((prev) => [...prev, { id: duplicatedId, name: duplicatedName }]);
        setPlatformTableOverrideId(duplicatedId);
        setExpandedRecordId(null);
        toast.success(isPl ? 'Tabela zduplikowana' : 'Table duplicated');
      } catch {
        toast.error(isPl ? 'Nie udało się zduplikować tabeli' : 'Failed to duplicate table');
      }
    },
    [baseTables, isPl]
  );

  const handleTabDeleteTable = useCallback(
    async (tableId: string) => {
      if (
        !window.confirm(
          isPl
            ? 'Czy na pewno chcesz usunąć tę tabelę?'
            : 'Are you sure you want to delete this table?'
        )
      )
        return;
      try {
        await TablePlatformApi.deleteTable(tableId);
        setBaseTables((prev) => prev.filter((t) => t.id !== tableId));
        toast.success(isPl ? 'Tabela usunięta' : 'Table deleted');
      } catch {
        toast.error(isPl ? 'Nie udało się usunąć tabeli' : 'Failed to delete table');
      }
    },
    [isPl]
  );

  // ── Quick action listener (extracted to hook) ────────────────────────────────
  useTableQuickActions({
    ideaId,
    isPl,
    columns,
    nodes,
    nodesUndo,
    selectedRowIds,
    handlers: {
      handleAddRow,
      setShowRowTemplatePicker,
      setAddRowBtnRect,
      setShowAddColumn,
      setSort,
      setShowFilterPanel,
      setShowAIAssistant,
      setShowFrameworkGen,
      setViewLayout,
      setShowSummaryDashboard,
      setShowColorPalette,
      setShowAICategorize,
      setShowScoringModel,
      setShowExportPresentation,
      setShowPipeline,
      setShowCopilot,
      setShowVoiceInput,
      setShowCrossRelations,
      setShowHeatmap,
      onUndo: () => platformUndoRef.current(),
      onRedo: () => nodesUndo.redo(),
    },
  });

  // ── Framework apply ────────────────────────────────────────────────────────
  const handleFrameworkApply = useCallback(
    (fwColumns: ColumnDef[], fwRows: TableNode[]) => {
      setColumns((prev) => {
        const existingKeys = new Set(prev.map((c) => c.key));
        const newCols = fwColumns.filter((c) => !existingKeys.has(c.key));
        return [...prev, ...newCols];
      });
      nodesUndo.push([...nodes, ...fwRows]);
      trackFunnelEvent('ideas_table_framework_applied', { ideaId, rowCount: fwRows.length });
    },
    [ideaId, nodes, nodesUndo]
  );

  // ── AI add rows ────────────────────────────────────────────────────────────
  const handleAIAddRows = useCallback(
    (newRows: TableNode[]) => {
      nodesUndo.push([...nodes, ...newRows]);
    },
    [nodes, nodesUndo]
  );

  // ── Color palette auto-assign ─────────────────────────────────────────────
  const handleAutoAssignColors = useCallback(() => {
    const colorMap = autoAssignColors(nodes, activePalette, groupBy || undefined);
    const next = nodes.map((n) => ({
      ...n,
      data: { ...(n.data || {}), color: colorMap.get(n.id) || n.data?.color },
    }));
    nodesUndo.push(next);
  }, [activePalette, groupBy, nodes, nodesUndo]);

  // ── AI Categorize handlers ─────────────────────────────────────────────────
  const handleApplyTags = useCallback(
    (nodeId: string, tags: string[]) => {
      const next = nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const existing = Array.isArray(n.data?.tags) ? n.data.tags : [];
        const merged = [...new Set([...existing, ...tags])];
        return { ...n, data: { ...(n.data || {}), tags: merged } };
      });
      nodesUndo.push(next);
    },
    [nodes, nodesUndo]
  );

  const handleApplyCluster = useCallback(
    (nodeId: string, cluster: string, color: string) => {
      const next = nodes.map((n) => {
        if (n.id !== nodeId) return n;
        return { ...n, data: { ...(n.data || {}), cluster, color } };
      });
      nodesUndo.push(next);
    },
    [nodes, nodesUndo]
  );

  const handleMergeNodes = useCallback(
    (keepId: string, removeId: string) => {
      const keepNode = nodes.find((n) => n.id === keepId);
      const removeNode = nodes.find((n) => n.id === removeId);
      if (!keepNode || !removeNode) return;
      const mergedData = {
        ...removeNode.data,
        ...keepNode.data,
        label: `${keepNode.data?.label || ''} + ${removeNode.data?.label || ''}`,
      };
      const next = nodes
        .filter((n) => n.id !== removeId)
        .map((n) => (n.id === keepId ? { ...n, data: mergedData } : n));
      nodesUndo.push(next);
      toast.success(isPl ? 'Pomysły scalone' : 'Ideas merged');
    },
    [isPl, nodes, nodesUndo]
  );

  // ── Scoring model handler ──────────────────────────────────────────────────
  const handleApplyScores = useCallback(
    (scores: { nodeId: string; score: number; rank: number }[]) => {
      const scoreMap = new Map(scores.map((s) => [s.nodeId, s]));
      const next = nodes.map((n) => {
        const s = scoreMap.get(n.id);
        if (!s) return n;
        return { ...n, data: { ...(n.data || {}), score: s.score, rank: s.rank } };
      });
      nodesUndo.push(next);
      toast.success(isPl ? 'Ranking zastosowany' : 'Ranking applied');
    },
    [isPl, nodes, nodesUndo]
  );

  // ── Formula V2 evaluation ──────────────────────────────────────────────────
  const formulaColumns = useMemo(
    () =>
      columns
        .filter((c) => c.type === 'formula' && c.formula)
        .map((c) => ({ key: c.key, formula: c.formula! })),
    [columns]
  );

  const formulaResults = useMemo(() => {
    if (formulaColumns.length === 0) return null;
    return batchEvaluateFormulas(nodes, edges, formulaColumns);
  }, [edges, formulaColumns, nodes]);

  // ── Pipeline stage change ────────────────────────────────────────────────
  const handlePipelineStageChange = useCallback(
    (nodeId: string, stage: string) => {
      const next = nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...(n.data || {}), pipelineStage: stage } } : n
      );
      nodesUndo.push(next);
    },
    [nodes, nodesUndo]
  );

  // ── Cross-table edge add ───────────────────────────────────────────────
  const handleAddCrossEdge = useCallback((edge: TableEdge) => {
    setEdges((prev) => [...prev, edge]);
  }, []);

  // ── Heatmap toggle column ──────────────────────────────────────────────
  const toggleHeatmapColumn = useCallback((key: string) => {
    setHeatmapColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const heatmapStyles = useMemo(() => {
    if (heatmapColumns.size === 0) return null;
    return computeHeatmapStyles(effectiveNodes, _cols, heatmapColumns, heatmapPalette);
  }, [_cols, effectiveNodes, heatmapColumns, heatmapPalette]);

  // ── Cell expand ───────────────────────────────────────────────────────────
  const handleCellExpand = useCallback((nodeId: string, colKey: string, rect: DOMRect) => {
    setCellExpandState({ nodeId, colKey, rect });
  }, []);

  const cellExpandNode = cellExpandState
    ? effectiveNodes.find((n) => n.id === cellExpandState.nodeId)
    : null;
  const cellExpandCol = cellExpandState
    ? _cols.find((c) => c.key === cellExpandState.colKey)
    : null;

  // handleReorderNode, handleAddSubItem now from useTableRows

  // ── CSV import ─────────────────────────────────────────────────────────────
  const handleCSVImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = String(ev.target?.result || '');
        const { headers, rows } = parseCSV(text);
        if (headers.length === 0) {
          toast.error(isPl ? 'Pusty plik CSV' : 'Empty CSV file');
          return;
        }
        const { nodes: newNodes, newColumns } = csvToNodes(headers, rows, columns);
        if (newColumns.length > 0) {
          setColumns((prev) => [...prev, ...newColumns]);
        }
        nodesUndo.push([...nodes, ...newNodes]);
        toast.success(
          isPl ? `Zaimportowano ${newNodes.length} wierszy` : `Imported ${newNodes.length} rows`
        );
        trackFunnelEvent('ideas_table_csv_imported', { ideaId, rowCount: newNodes.length });
      };
      reader.readAsText(file);
      if (csvInputRef.current) csvInputRef.current.value = '';
    },
    [columns, ideaId, isPl, nodes, nodesUndo]
  );

  // ── Bulk conversion with source traceability ───────────────────────────────
  const [showBulkConvertMenu, setShowBulkConvertMenu] = useState(false);

  const handleBulkConvert = useCallback(
    (target: 'initiative' | 'task' | 'decision') => {
      if (selectedRowIds.size === 0) return;
      const now = new Date().toISOString();
      const next = nodes.map((n) => {
        if (!selectedRowIds.has(n.id)) return n;
        return {
          ...n,
          data: {
            ...(n.data || {}),
            _convertedTo: target,
            _convertedAt: now,
            _sourceRowId: n.id,
            _sourceTable: ideaId,
            last_edited_time: now,
          },
        };
      });
      nodesUndo.push(next);

      if (onConvertProp) {
        onConvertProp(target);
      }

      const msg = isPl
        ? `Konwertowano ${selectedRowIds.size} wierszy do: ${target}`
        : `Converted ${selectedRowIds.size} rows to: ${target}`;
      toast.success(msg);
      trackFunnelEvent('ideas_table_bulk_convert', {
        ideaId,
        target,
        count: selectedRowIds.size,
      });
      setSelectedRowIds(new Set());
      setShowBulkConvertMenu(false);
    },
    [ideaId, isPl, nodes, nodesUndo, onConvertProp, selectedRowIds]
  );

  // ── Calendar: add event at date ────────────────────────────────────────────
  const handleAddEventAtDate = useCallback(
    (dateStr: string) => {
      if (locked) return;
      const dateCol = columns.find((c) => c.type === 'date');
      if (!dateCol) return;
      const id = `node-${Date.now()}`;
      const now = new Date().toISOString();
      const newNode: TableNode = {
        id,
        type: 'idea',
        data: {
          label: '',
          status: 'todo',
          [dateCol.key]: dateStr,
          created_time: now,
          created_by: currentUserId,
          last_edited_time: now,
          last_edited_by: currentUserId,
        },
        position: { x: 0, y: 0 },
      };
      nodesUndo.push([...nodes, newNode]);
      trackFunnelEvent('ideas_table_row_added', { ideaId });
    },
    [columns, ideaId, locked, nodes, nodesUndo]
  );

  // ── "/" key for AI assistant ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !showAIAssistant &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setShowAIAssistant(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showAIAssistant]);

  // Save, toggleColumn, cycleSort, applyView now handled by hooks

  const handlePlatformUndo = useCallback(async () => {
    if (!usePlatform) {
      nodesUndo.undo();
      return;
    }
    try {
      const result = await TablePlatformApi.undoRecordEdit(ideaId);
      if (result) {
        toast.success(isPl ? 'Cofnięto zmianę' : 'Undo successful');
        platformIntegration.refresh?.();
      } else {
        toast(isPl ? 'Brak zmian do cofnięcia' : 'Nothing to undo');
      }
    } catch {
      toast.error(isPl ? 'Nie udało się cofnąć' : 'Undo failed');
    }
  }, [usePlatform, ideaId, isPl, nodesUndo, platformIntegration]);

  // Keep the rail-undo bridge pointed at the live platform-aware undo handler.
  platformUndoRef.current = handlePlatformUndo;

  // Feed the canvas rail's Undo/Redo enabled state (CanvasLeftToolbar reads it via
  // IdeaMapWorkspace). Platform mode has no client stack, so Undo stays enabled there.
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(
      new CustomEvent('tbl-undo-state', {
        detail: {
          canUndo: usePlatform || nodesUndo.canUndo,
          canRedo: nodesUndo.canRedo,
        },
      })
    );
  }, [open, usePlatform, nodesUndo.canUndo, nodesUndo.canRedo]);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useTableKeyboard({
    rowCount: processedRowsWithRollups.length,
    colCount: _visCols.length,
    onUndo: handlePlatformUndo,
    onRedo: nodesUndo.redo,
    onDelete: _bulkDel,
    onEscape: () => {
      setDetailNodeId(null);
      (usePlatform ? effectiveSetSelectedRowIds : setSelectedRowIds)(new Set());
      onSelectionChange?.(EMPTY_SELECTION);
      setShowKeyboardShortcuts(false);
    },
    onSave: _save,
    onAddRow: _addRow,
    onOpenAI: () => setShowAIAssistant(true),
    onShowShortcuts: () => setShowKeyboardShortcuts(true),
    onSwitchView: (v) => (usePlatform ? effectiveSetViewLayout : setViewLayout)(v as any),
    onToggleFilters: () => setShowFilterPanel((p) => !p),
    onToggleSummary: () => setShowSummaryDashboard((p) => !p),
    containerRef: tableRef,
  });

  const detailNode = useMemo(
    () => (detailNodeId ? effectiveNodes.find((n) => n.id === detailNodeId) || null : null),
    [detailNodeId, effectiveNodes]
  );

  if (!open) return null;

  // ── Render row ─────────────────────────────────────────────────────────────
  const renderRow = (row: TableNode, rowIdx: number) => {
    const isSelected = _selIds.has(row.id);
    const rowColor = row.data?.color;
    return (
      <tr
        key={row.id}
        data-node-id={row.id}
        className={`border-b border-slate-200/30 dark:border-white/[0.04] cursor-pointer transition-colors group/row touch-manipulation ${
          isSelected
            ? 'bg-slate-50 dark:bg-white/[0.06]'
            : detailNodeId === row.id
              ? 'bg-slate-50 dark:bg-white/[0.06]'
              : selectedNodeForLines === row.id
                ? 'bg-indigo-500/5'
                : 'hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'
        }`}
        style={rowColor ? { borderLeftWidth: 3, borderLeftColor: rowColor } : undefined}
        onClick={() => setSelectedNodeForLines(selectedNodeForLines === row.id ? null : row.id)}
        onDoubleClick={() => {
          if (usePlatform) {
            setExpandedRecordId(row.id);
          } else {
            setDetailNodeId(row.id);
            setDetailMode('full');
          }
        }}
      >
        <td className="w-8 px-2 py-1.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() =>
              (usePlatform ? platformIntegration.toggleRowSelection : toggleRowSelection)(row.id)
            }
            onClick={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 rounded border-slate-300 dark:border-navy-600 text-slate-600 focus:ring-slate-400/30"
          />
        </td>
        <td className="w-10 px-1 py-1.5 text-[10px] text-slate-600 dark:text-slate-500 text-right select-none tabular-nums">
          {rowIdx + 1}
        </td>
        {stretchedVisibleCols.map((col, colIdx) => {
          const condStyle =
            formatRules.length > 0
              ? getConditionalStyle(formatRules, col.key, row?.data?.[col.key])
              : undefined;
          return (
            <td
              key={col.key}
              data-row={rowIdx}
              data-col={colIdx}
              style={{
                width: col.width,
                minWidth: col.width,
                maxWidth: col.width,
                ...condStyle,
                ...(heatmapStyles?.get(row.id)?.get(col.key) || {}),
              }}
              className="px-2 py-1.5 md:py-1.5 relative group/cell min-h-[44px] md:min-h-0"
            >
              <CellCursor remoteUsers={remotePresenceUsers} nodeId={row.id} colKey={col.key} />
              <div className="flex items-center gap-0.5">
                <div
                  className="flex-1 min-w-0"
                  onClick={() => {
                    setDetailNodeId(row.id);
                    setDetailMode('preview');
                  }}
                >
                  {col.key === 'type' ? (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                      {(row.data?.nodeType || row.type || 'idea').replace(/_/g, ' ')}
                    </span>
                  ) : (
                    <CellRenderer
                      column={col}
                      value={
                        col.type === 'formula' && formulaResults
                          ? (formulaResults.get(row.id)?.[col.key] ?? row?.data?.[col.key])
                          : row?.data?.[col.key]
                      }
                      rowData={row.data || {}}
                      onChange={(val) => _fieldChange(row.id, col.key, val)}
                      locked={locked}
                      allNodes={effectiveNodes.map((n) => ({ id: n.id, label: n.data?.label }))}
                    />
                  )}
                </div>
                {col.key !== 'type' &&
                  !locked &&
                  (row?.data?.[col.key] == null || row.data[col.key] === '') && (
                    <InlineAIFill node={row} column={col} ideaId={ideaId} onFill={_fieldChange} />
                  )}
                {col.key !== 'type' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      handleCellExpand(row.id, col.key, rect);
                    }}
                    className="opacity-0 group-hover/cell:opacity-60 hover:!opacity-100 p-0.5 rounded transition-opacity flex-shrink-0"
                    title={isPl ? 'Rozwiń' : 'Expand'}
                  >
                    <Maximize2 size={9} className="text-slate-600" />
                  </button>
                )}
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div
      className="w-full h-full flex overflow-hidden"
      ref={tableRef}
      role="region"
      aria-label={
        isPl ? 'Tabela pomysłów z operacjami zbiorczymi' : 'Ideas table with bulk operations'
      }
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        <TableDataProvider
          integration={platformIntegration}
          base={null}
          table={null}
          locked={locked}
          isPl={!!isPl}
        >
          {/* Toolbar */}
          {usePlatform ? (
            <P15TableToolbar
              ideaId={ideaId}
              nodesUndo={nodesUndo}
              onPlatformUndo={handlePlatformUndo}
              onCSVImport={handleCSVImport}
              onExportCSV={() => {
                const csv = exportToCSV(_cols, effectiveNodes);
                downloadCSV(csv, `idea-${ideaId}.csv`);
              }}
              onCopyToClipboard={() => {
                copyTableToClipboard(_cols, effectiveNodes);
                toast.success(isPl ? 'Skopiowano' : 'Copied');
              }}
              onAddRowWithTemplate={() => handleAddRowWithTemplate()}
              onBulkConvert={handleBulkConvert}
              onShowAIAssistant={() => setShowAIAssistant(true)}
              onShowAICategorize={() => setShowAICategorize(true)}
              onShowScoringModel={() => setShowScoringModel(true)}
              onShowExportPresentation={() => setShowExportPresentation(true)}
              onShowPipeline={() => setShowPipeline(true)}
              onShowCopilot={() => setShowCopilot(true)}
              onShowVoiceInput={() => setShowVoiceInput(true)}
              onShowCrossRelations={() => setShowCrossRelations(true)}
              onShowFrameworkGen={() => setShowFrameworkGen(true)}
              onShowConditionalFmt={() => setShowConditionalFmt(true)}
              onShowKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
              connectors={connectors}
              onShowConnectorWizard={() => setShowConnectorWizard(true)}
              onShowConnectorList={() => setShowConnectorList(true)}
              onShowWebhookRelays={() => setShowWebhookRelays(true)}
              onShowAutomationsManager={() => setShowAutomationsManager(true)}
              onShowSyncManager={() => setShowSyncManager(true)}
              onShowSharingManager={() => setShowSharingManager(true)}
              onShowDistributionManager={() => setShowDistributionManager(true)}
              onShowConsultifyLink={() => setShowConsultifyLink(true)}
              heatmapColumns={heatmapColumns}
              showHeatmap={showHeatmap}
              onToggleHeatmap={() => setShowHeatmap((p) => !p)}
              onToggleHeatmapColumn={toggleHeatmapColumn}
              heatmapPalette={heatmapPalette}
              onHeatmapPaletteChange={(id) => setHeatmapPalette(id as typeof heatmapPalette)}
              activePalette={activePalette}
              onAutoAssignColors={handleAutoAssignColors}
              onPaletteChange={(id) => setActivePalette(id)}
              formatRules={formatRules}
              realtime={realtime}
              isV8MultiplayerEnabled={isV8MultiplayerEnabled}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              workspaceId={workspaceId || ''}
              remotePresenceUsers={remotePresenceUsers}
              onPresenceUpdate={(users) => setRemotePresenceUsers(users as PresenceUser[])}
              filterInput={filterInput}
              onFilterInputChange={setFilterInput}
              FilterBuilderComponent={FilterBuilder}
              FilterPanelComponent={FilterPanel}
              HeatmapControlsComponent={HeatmapControls}
              ColorPaletteComponent={ColorPalette}
              MobileToolbarMenuComponent={MobileToolbarMenu}
              BatchAIFillButtonComponent={BatchAIFillButton}
              WorkspacePresenceIndicatorComponent={WorkspacePresenceIndicator}
              WorkspaceLockIndicatorComponent={WorkspaceLockIndicator}
              CollaborationPresenceComponent={CollaborationPresence}
              PresenceIndicatorsComponent={PresenceIndicators}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-1 md:gap-2 px-2 md:px-4 py-2 border-b border-slate-200/60 dark:border-navy-700/60 bg-slate-50/80 dark:bg-navy-900/80 flex-shrink-0">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mr-2">
                {isPl ? 'Tabela' : 'Table'}
              </div>

              {/* Collaboration Presence */}
              <WorkspacePresenceIndicator
                workspaceId={workspaceId}
                currentUserId={currentUserId}
                enabled={isV8MultiplayerEnabled}
              />
              <WorkspaceLockIndicator
                workspaceId={workspaceId}
                currentUserId={currentUserId}
                enabled={isV8MultiplayerEnabled}
              />
              <CollaborationPresence
                ideaId={ideaId}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                enabled={true}
                renderIndicator={!isV8MultiplayerEnabled}
                onPresenceUpdate={(users) => setRemotePresenceUsers(users)}
              />
              {usePlatform && (
                <PresenceIndicators
                  presence={realtime.presence}
                  currentUserId={currentUserId}
                  connectionState={realtime.connectionState}
                  enabled={usePlatform}
                />
              )}

              {/* View tabs */}
              <div className="flex items-center gap-0.5 mr-2">
                {savedViews.map((v) => (
                  <div key={v.id} className="relative">
                    {renamingViewId === v.id ? (
                      <input
                        autoFocus
                        value={renamingViewName}
                        onChange={(e) => setRenamingViewName(e.target.value)}
                        onBlur={() => {
                          if (renamingViewName.trim())
                            updateSavedView(v.id, { name: renamingViewName.trim() });
                          setRenamingViewId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (renamingViewName.trim())
                              updateSavedView(v.id, { name: renamingViewName.trim() });
                            setRenamingViewId(null);
                          } else if (e.key === 'Escape') {
                            setRenamingViewId(null);
                          }
                        }}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-navy-800 border border-slate-400 dark:border-navy-500 outline-none w-20"
                      />
                    ) : (
                      <button
                        onClick={() => applyView(v)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (v.id !== 'default')
                            setViewContextMenu({ viewId: v.id, x: e.clientX, y: e.clientY });
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                          activeViewId === v.id
                            ? 'bg-slate-200/70 dark:bg-white/[0.08] text-slate-900 dark:text-white'
                            : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                      >
                        {v.name}
                      </button>
                    )}
                  </div>
                ))}
                {!locked && (
                  <button
                    onClick={() => {
                      setSaveViewName('');
                      setShowSaveViewDialog(true);
                    }}
                    className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                    title={isPl ? 'Zapisz widok' : 'Save view'}
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>

              {/* Save view dialog */}
              {showSaveViewDialog && (
                <div
                  className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20"
                  onClick={() => setShowSaveViewDialog(false)}
                >
                  <div
                    className="bg-white dark:bg-navy-900 rounded-xl shadow-xl border border-slate-200 dark:border-navy-700 p-4 w-72"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="text-sm font-semibold mb-2 text-slate-800 dark:text-slate-200">
                      {isPl ? 'Zapisz widok' : 'Save view'}
                    </h3>
                    <input
                      autoFocus
                      value={saveViewName}
                      onChange={(e) => setSaveViewName(e.target.value)}
                      placeholder={isPl ? 'Nazwa widoku…' : 'View name…'}
                      className="w-full h-8 px-3 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 outline-none focus:ring-2 focus:ring-blue-500/30 mb-3"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && saveViewName.trim()) {
                          saveCurrentView(saveViewName.trim(), columns);
                          setShowSaveViewDialog(false);
                        }
                      }}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setShowSaveViewDialog(false)}
                        className="px-3 py-1.5 text-xs rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800"
                      >
                        {isPl ? 'Anuluj' : 'Cancel'}
                      </button>
                      <button
                        disabled={!saveViewName.trim()}
                        onClick={() => {
                          saveCurrentView(saveViewName.trim(), columns);
                          setShowSaveViewDialog(false);
                        }}
                        className="px-3 py-1.5 text-xs rounded-lg bg-slate-900 dark:bg-white text-white dark:text-navy-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-40"
                      >
                        {isPl ? 'Zapisz' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* View context menu */}
              {viewContextMenu && (
                <div className="fixed inset-0 z-[60]" onClick={() => setViewContextMenu(null)}>
                  <div
                    className="absolute bg-white dark:bg-navy-900 rounded-lg shadow-xl border border-slate-200 dark:border-navy-700 py-1 min-w-[140px]"
                    style={{ left: viewContextMenu.x, top: viewContextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                      onClick={() => {
                        const v = savedViews.find((sv) => sv.id === viewContextMenu.viewId);
                        if (v) {
                          setRenamingViewId(v.id);
                          setRenamingViewName(v.name);
                        }
                        setViewContextMenu(null);
                      }}
                    >
                      {isPl ? 'Zmień nazwę' : 'Rename'}
                    </button>
                    <button
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                      onClick={() => {
                        updateSavedView(viewContextMenu.viewId, {
                          sort: sort ? [sort] : undefined,
                          filters,
                          groupBy: groupBy ?? undefined,
                          layout: viewLayout,
                          columns: columns.map((c) => ({
                            key: c.key,
                            visible: c.visible !== false,
                            width: c.width,
                          })),
                        });
                        toast.success(isPl ? 'Widok zaktualizowany' : 'View updated');
                        setViewContextMenu(null);
                      }}
                    >
                      {isPl ? 'Aktualizuj' : 'Update'}
                    </button>
                    <button
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-danger-50 dark:hover:bg-danger-900/20 text-danger-600"
                      onClick={() => {
                        deleteSavedView(viewContextMenu.viewId);
                        toast.success(isPl ? 'Widok usunięty' : 'View deleted');
                        setViewContextMenu(null);
                      }}
                    >
                      {isPl ? 'Usuń' : 'Delete'}
                    </button>
                  </div>
                </div>
              )}

              <div className="w-px h-5 bg-slate-200 dark:bg-navy-700" />

              {/* Quick filter */}
              <div className="relative flex-1 max-w-[200px]">
                <Filter
                  size={12}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600"
                />
                <input
                  value={filterInput}
                  onChange={(e) => setFilterInput(e.target.value)}
                  placeholder={isPl ? 'Filtruj…' : 'Filter…'}
                  className="w-full h-7 pl-7 pr-2 rounded-lg text-[11px] bg-white dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                {filterInput && (
                  <button
                    onClick={() => setFilterInput('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-600"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>

              {/* Advanced filter */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterPanel(!showFilterPanel)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    _filters.rules.length > 0
                      ? 'bg-slate-200/70 dark:bg-white/[0.08] text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
                  }`}
                >
                  <Filter size={12} />
                  {_filters.rules.length > 0 && (
                    <span className="text-[9px]">({_filters.rules.length})</span>
                  )}
                </button>
                {usePlatform ? (
                  <FilterBuilder
                    open={showFilterPanel}
                    onClose={() => setShowFilterPanel(false)}
                    filters={{
                      logic: _filters.logic,
                      rules: _filters.rules.map((r) => ({
                        fieldId: (r as any).fieldId ?? (r as any).column,
                        operator: (r as any).operator,
                        value: (r as any).value,
                      })),
                    }}
                    onChange={(pf) => {
                      effectiveSetFilters({
                        logic: pf.logic,
                        rules: pf.rules.map((r) => ({
                          id: `${r.fieldId}-${r.operator}`,
                          column: r.fieldId,
                          operator: r.operator as any,
                          value: (r.value ?? '') as any,
                        })),
                      });
                      void platformIntegration.applyPlatformFilters(pf);
                    }}
                    fields={platformIntegration.platformFields}
                  />
                ) : (
                  <FilterPanel
                    open={showFilterPanel}
                    onClose={() => setShowFilterPanel(false)}
                    filters={_filters}
                    onChange={setFilters}
                    columns={_visCols}
                  />
                )}
              </div>

              {/* Group by */}
              <button
                onClick={() =>
                  (usePlatform ? effectiveSetGroupBy : setGroupBy)(_groupBy ? null : 'status')
                }
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  _groupBy
                    ? 'bg-slate-200/70 dark:bg-white/[0.08] text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
                }`}
                title={isPl ? 'Grupuj' : 'Group'}
              >
                <Group size={12} />
                <span className="hidden sm:inline">{isPl ? 'Grupuj' : 'Group'}</span>
              </button>

              {/* V5-IDEA-24: View layout switcher — FROZEN order: table → kanban → timeline → calendar → matrix → grid */}
              <div className="flex items-center rounded-lg border border-slate-200/60 dark:border-navy-700/60 overflow-hidden">
                {(
                  [
                    { id: 'table', icon: Table2, label: isPl ? 'Tabela' : 'Table' },
                    { id: 'kanban', icon: KanbanSquare, label: 'Kanban' },
                    { id: 'timeline', icon: GanttChart, label: 'Timeline / Gantt' },
                    { id: 'calendar', icon: Calendar, label: isPl ? 'Kalendarz' : 'Calendar' },
                    { id: 'matrix', icon: LayoutGrid, label: 'Matrix' },
                    { id: 'grid', icon: Grid3X3, label: isPl ? 'Galeria' : 'Gallery' },
                  ] as const
                ).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => (usePlatform ? effectiveSetViewLayout : setViewLayout)(v.id)}
                    className={`relative p-1.5 transition-colors ${_vl === v.id ? 'bg-slate-200/70 dark:bg-white/[0.08] text-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    title={v.label}
                  >
                    <v.icon size={12} />
                    {_vl === v.id && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-navy-900 dark:bg-white" />
                    )}
                  </button>
                ))}
              </div>

              {/* AI Assistant */}
              <button
                onClick={() => setShowAIAssistant(true)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                title={isPl ? 'Asystent AI (/)' : 'AI Assistant (/)'}
              >
                <Sparkles size={12} />
              </button>

              {/* Batch AI Fill */}
              {!locked && (
                <BatchAIFillButton
                  nodes={processedRowsWithRollups}
                  columns={_cols}
                  ideaId={ideaId}
                  onFill={_fieldChange}
                  selectedIds={_selIds}
                />
              )}

              {/* Secondary actions — hidden on mobile, shown in overflow menu */}
              <div className="hidden md:contents">
                {/* AI Categorize */}
                {!locked && (
                  <button
                    onClick={() => setShowAICategorize(true)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title={isPl ? 'AI Kategoryzacja' : 'AI Categorize'}
                  >
                    <Layers size={12} />
                  </button>
                )}

                {/* Scoring Model */}
                <button
                  onClick={() => setShowScoringModel(true)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  title={isPl ? 'Model scoringowy' : 'Scoring Model'}
                >
                  <Trophy size={12} />
                </button>

                {/* Export to Presentation */}
                <button
                  onClick={() => setShowExportPresentation(true)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  title={isPl ? 'Eksport do prezentacji' : 'Export to Presentation'}
                >
                  <Presentation size={12} />
                </button>

                {/* Pipeline */}
                <button
                  onClick={() => setShowPipeline(true)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  title={isPl ? 'Pipeline pomysłów' : 'Idea Pipeline'}
                >
                  <Rocket size={12} />
                </button>

                {/* AI Copilot */}
                <button
                  onClick={() => setShowCopilot(true)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  title={isPl ? 'AI Copilot' : 'AI Copilot'}
                >
                  <Brain size={12} />
                </button>

                {/* Voice / Image Input */}
                <button
                  onClick={() => setShowVoiceInput(true)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  title={isPl ? 'Głos / Obraz' : 'Voice / Image'}
                >
                  <Mic size={12} />
                </button>

                {/* Cross-table Relations */}
                <button
                  onClick={() => setShowCrossRelations(true)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  title={isPl ? 'Relacje między tabelami' : 'Cross-table Relations'}
                >
                  <Network size={12} />
                </button>

                {/* Heatmap */}
                <div className="relative">
                  <button
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    className={`p-1.5 rounded-lg transition-colors ${heatmapColumns.size > 0 ? 'text-amber-500 bg-amber-500/10' : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    title={isPl ? 'Heatmapa' : 'Heatmap'}
                  >
                    <Flame size={12} />
                  </button>
                  <HeatmapControls
                    open={showHeatmap}
                    onClose={() => setShowHeatmap(false)}
                    columns={_cols}
                    enabledColumns={heatmapColumns}
                    onToggleColumn={toggleHeatmapColumn}
                    palette={heatmapPalette}
                    onPaletteChange={setHeatmapPalette}
                  />
                </div>

                {/* History / Audit */}
                <button
                  onClick={() => setShowAuditTrail((p) => !p)}
                  className={`p-1.5 rounded-lg transition-colors ${showAuditTrail ? 'bg-slate-200/70 dark:bg-white/[0.08] text-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title={isPl ? 'Historia zmian' : 'History'}
                >
                  <History size={12} />
                </button>

                {/* Activity Feed */}
                <button
                  onClick={() => setShowActivityFeed((p) => !p)}
                  className={`p-1.5 rounded-lg transition-colors ${showActivityFeed ? 'bg-slate-200/70 dark:bg-white/[0.08] text-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title={isPl ? 'Aktywność' : 'Activity'}
                >
                  <Activity size={12} />
                </button>

                {/* Keyboard shortcuts */}
                <button
                  onClick={() => setShowKeyboardShortcuts(true)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  title={isPl ? 'Skróty klawiszowe (?)' : 'Keyboard shortcuts (?)'}
                >
                  <Keyboard size={12} />
                </button>

                {/* Templates */}
                {!locked && (
                  <button
                    onClick={() => setShowTemplateGallery(true)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title={isPl ? 'Szablony' : 'Templates'}
                  >
                    <LayoutTemplate size={12} />
                  </button>
                )}

                {/* Distribute */}
                {!locked && (
                  <button
                    onClick={() => setShowDistributionBuilder(true)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title={isPl ? 'Dystrybucja' : 'Distribute'}
                  >
                    <Send size={12} />
                  </button>
                )}

                {/* Framework generator */}
                {!locked && (
                  <button
                    onClick={() => setShowFrameworkGen(true)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                    title={isPl ? 'Generator frameworków' : 'Framework Generator'}
                  >
                    <LayoutGrid size={12} />
                    <span className="hidden lg:inline">{isPl ? 'Framework' : 'Framework'}</span>
                  </button>
                )}

                {/* Conditional formatting */}
                <button
                  onClick={() => setShowConditionalFmt(true)}
                  className={`p-1.5 rounded-lg transition-colors ${formatRules.length > 0 ? 'bg-slate-200/70 dark:bg-white/[0.08] text-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title={isPl ? 'Formatowanie warunkowe' : 'Conditional Formatting'}
                >
                  <Paintbrush size={12} />
                </button>

                {/* Color palette */}
                <div className="relative">
                  <button
                    onClick={() => setShowColorPalette(!showColorPalette)}
                    className={`p-1.5 rounded-lg transition-colors ${showColorPalette ? 'bg-slate-200/70 dark:bg-white/[0.08] text-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    title={isPl ? 'Paleta kolorów' : 'Color Palette'}
                  >
                    <Palette size={12} />
                  </button>
                  <ColorPalette
                    open={showColorPalette}
                    onClose={() => setShowColorPalette(false)}
                    activePalette={activePalette}
                    onPaletteChange={(id) => {
                      setActivePalette(id);
                      setShowColorPalette(false);
                    }}
                    onAutoAssign={handleAutoAssignColors}
                  />
                </div>

                {/* Platform tab switcher: Data / Forms / Interfaces */}
                {usePlatform && (
                  <div className="flex items-center rounded-lg bg-slate-100 dark:bg-navy-800 p-0.5">
                    <button
                      onClick={() => setPlatformTab('data')}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        platformTab === 'data'
                          ? 'bg-white text-slate-800 shadow-sm dark:bg-navy-700 dark:text-white'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                      }`}
                    >
                      {isPl ? 'Dane' : 'Data'}
                    </button>
                    <button
                      onClick={() => setPlatformTab('forms')}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        platformTab === 'forms'
                          ? 'bg-white text-slate-800 shadow-sm dark:bg-navy-700 dark:text-white'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                      }`}
                    >
                      {isPl ? 'Formularze' : 'Forms'}
                    </button>
                    <button
                      onClick={() => setPlatformTab('interfaces')}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        platformTab === 'interfaces'
                          ? 'bg-white text-slate-800 shadow-sm dark:bg-navy-700 dark:text-white'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                      }`}
                    >
                      {isPl ? 'Interfejsy' : 'Interfaces'}
                    </button>
                    <button
                      onClick={() => setPlatformTab('models')}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        platformTab === 'models'
                          ? 'bg-white text-slate-800 shadow-sm dark:bg-navy-700 dark:text-white'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                      }`}
                    >
                      {isPl ? 'Modele' : 'Models'}
                    </button>
                    <button
                      onClick={() => setPlatformTab('workflow')}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        platformTab === 'workflow'
                          ? 'bg-white text-slate-800 shadow-sm dark:bg-navy-700 dark:text-white'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                      }`}
                    >
                      {isPl ? 'Workflow' : 'Workflow'}
                    </button>
                  </div>
                )}

                {/* Interface Designer (direct open) */}
                {usePlatform && (
                  <button
                    onClick={() => setShowInterfaceDesigner(true)}
                    className={`p-1.5 rounded-lg transition-colors ${showInterfaceDesigner ? 'bg-slate-200/70 dark:bg-white/[0.08] text-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    title={isPl ? 'Projektant interfejsu' : 'Interface Designer'}
                  >
                    <Layout size={12} />
                  </button>
                )}

                {/* Form Builder (direct open) */}
                {usePlatform && !locked && (
                  <button
                    onClick={() => setShowFormBuilder(true)}
                    className="p-1.5 rounded-lg transition-colors text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
                    title={isPl ? 'Kreator formularzy' : 'Form Builder'}
                  >
                    <FileText size={12} />
                  </button>
                )}

                {/* Tools dropdown — quick access to platform features */}
                {usePlatform && (
                  <div className="relative">
                    <button
                      onClick={() => setShowToolsMenu((p) => !p)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                        showToolsMenu
                          ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
                      }`}
                      title={isPl ? 'Narzędzia' : 'Tools'}
                    >
                      <Grid3X3 size={12} />
                      <span className="hidden lg:inline">{isPl ? 'Narzędzia' : 'Tools'}</span>
                      <ChevronDown size={10} />
                    </button>
                    {showToolsMenu && (
                      <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-xl py-1 max-h-[70vh] overflow-y-auto">
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                          {isPl ? 'Workflow' : 'Workflow'}
                        </div>
                        <button
                          onClick={() => {
                            setShowAutomationsManager(true);
                            setShowToolsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                        >
                          <Rocket size={14} className="text-amber-500" />
                          {isPl ? 'Automatyzacje' : 'Automations'}
                        </button>
                        <button
                          onClick={() => {
                            setShowSyncManager(true);
                            setShowToolsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                        >
                          <Link2 size={14} className="text-blue-500" />
                          {isPl ? 'Synchronizacja danych' : 'Data Sync'}
                        </button>
                        <button
                          onClick={() => {
                            setShowWebhookRelays(true);
                            setShowToolsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                        >
                          <Webhook size={14} className="text-indigo-500" />
                          {isPl ? 'Webhook Relay' : 'Webhook Relays'}
                        </button>
                        <button
                          onClick={() => {
                            setShowSharingManager(true);
                            setShowToolsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                        >
                          <Network size={14} className="text-green-500" />
                          {isPl ? 'Udostępnianie' : 'Sharing & Permissions'}
                        </button>
                        <button
                          onClick={() => {
                            setShowDistributionManager(true);
                            setShowToolsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                        >
                          <Send size={14} className="text-pink-500" />
                          {isPl ? 'Dystrybucja' : 'Distribution'}
                        </button>
                        <div className="border-t border-slate-200 dark:border-navy-700 my-1" />
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                          {isPl ? 'Budowanie' : 'Build'}
                        </div>
                        <button
                          onClick={() => {
                            setShowFormBuilder(true);
                            setShowToolsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                        >
                          <FileText size={14} className="text-blue-500" />
                          {isPl ? 'Formularze' : 'Forms'}
                        </button>
                        <button
                          onClick={() => {
                            setShowInterfaceDesigner(true);
                            setShowToolsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                        >
                          <Layout size={14} className="text-slate-500" />
                          {isPl ? 'Interfejsy' : 'Interfaces'}
                        </button>
                        <button
                          onClick={() => {
                            setShowTemplateGallery(true);
                            setShowToolsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                        >
                          <LayoutTemplate size={14} className="text-emerald-500" />
                          {isPl ? 'Szablony' : 'Templates'}
                        </button>
                        <button
                          onClick={() => {
                            setShowConnectorWizard(true);
                            setShowToolsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                        >
                          <Download size={14} className="text-blue-500" />
                          {isPl ? 'Konektory' : 'Connectors'}
                        </button>
                        <div className="border-t border-slate-200 dark:border-navy-700 my-1" />
                        <button
                          onClick={() => {
                            setShowConsultifyLink(true);
                            setShowToolsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                        >
                          <Layers size={14} className="text-indigo-500" />
                          {isPl ? 'Połączenie z Consultify' : 'Consultify Link'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Mobile overflow menu for secondary actions */}
              <MobileToolbarMenu>
                {!locked && (
                  <button
                    onClick={() => setShowAICategorize(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 min-h-[44px]"
                  >
                    <Layers size={14} /> {isPl ? 'AI Kategoryzacja' : 'AI Categorize'}
                  </button>
                )}
                <button
                  onClick={() => setShowScoringModel(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 min-h-[44px]"
                >
                  <Trophy size={14} /> {isPl ? 'Scoring' : 'Scoring'}
                </button>
                <button
                  onClick={() => setShowExportPresentation(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 min-h-[44px]"
                >
                  <Presentation size={14} /> {isPl ? 'Prezentacja' : 'Presentation'}
                </button>
                <button
                  onClick={() => setShowPipeline(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 min-h-[44px]"
                >
                  <Rocket size={14} /> {isPl ? 'Pipeline' : 'Pipeline'}
                </button>
                <button
                  onClick={() => setShowCopilot(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 min-h-[44px]"
                >
                  <Brain size={14} /> AI Copilot
                </button>
                <button
                  onClick={() => setShowVoiceInput(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 min-h-[44px]"
                >
                  <Mic size={14} /> {isPl ? 'Głos / Obraz' : 'Voice / Image'}
                </button>
                <button
                  onClick={() => setShowCrossRelations(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 min-h-[44px]"
                >
                  <Network size={14} /> {isPl ? 'Relacje' : 'Relations'}
                </button>
                <button
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 min-h-[44px]"
                >
                  <Flame size={14} /> {isPl ? 'Heatmapa' : 'Heatmap'}
                </button>
                <button
                  onClick={() => setShowAuditTrail((p) => !p)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 min-h-[44px]"
                >
                  <History size={14} /> {isPl ? 'Historia' : 'History'}
                </button>
                <button
                  onClick={() => setShowActivityFeed((p) => !p)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 min-h-[44px]"
                >
                  <Activity size={14} /> {isPl ? 'Aktywność' : 'Activity'}
                </button>
                <button
                  onClick={() => setShowConditionalFmt(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 min-h-[44px]"
                >
                  <Paintbrush size={14} /> {isPl ? 'Formatowanie' : 'Formatting'}
                </button>
                {!locked && (
                  <button
                    onClick={() => setShowFrameworkGen(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 min-h-[44px]"
                  >
                    <LayoutGrid size={14} /> Framework
                  </button>
                )}
                {!locked && (
                  <button
                    onClick={() => setShowTemplateGallery(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 min-h-[44px]"
                  >
                    <LayoutTemplate size={14} /> {isPl ? 'Szablony' : 'Templates'}
                  </button>
                )}
              </MobileToolbarMenu>

              {/* CSV import/export + Connectors */}
              <div className="flex items-center gap-0.5">
                {!locked && (
                  <button
                    onClick={() => setShowConnectorWizard(true)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-200/70 dark:bg-navy-800 hover:bg-slate-300/70 dark:hover:bg-navy-700 transition-colors"
                    title={isPl ? 'Importuj dane' : 'Import data'}
                  >
                    <Network size={12} />
                    {isPl ? 'Import' : 'Import'}
                  </button>
                )}
                {connectors.connectors.length > 0 && (
                  <button
                    onClick={() => setShowConnectorList((v) => !v)}
                    className="relative p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title={isPl ? 'Konektory' : 'Connectors'}
                  >
                    <Layers size={12} />
                    {connectors.connectors.some((c) => c.lastRunStatus === 'running') && (
                      <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                    )}
                    {connectors.connectors.some((c) => c.lastRunStatus === 'failed') && (
                      <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-danger-500" />
                    )}
                  </button>
                )}
                {usePlatform && (
                  <button
                    onClick={() => setShowWebhookRelays(true)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                    title={isPl ? 'Webhook Relay (Zapier/Make)' : 'Webhook Relays (Zapier/Make)'}
                  >
                    <Webhook size={12} />
                  </button>
                )}
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  className="hidden"
                  onChange={handleCSVImport}
                />
                {!locked && (
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title={isPl ? 'Importuj CSV' : 'Import CSV'}
                  >
                    <Upload size={12} />
                  </button>
                )}
                <button
                  onClick={() => {
                    const csv = exportToCSV(_cols, effectiveNodes);
                    downloadCSV(csv, `idea-${ideaId}.csv`);
                  }}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  title={isPl ? 'Eksportuj CSV' : 'Export CSV'}
                >
                  <Download size={12} />
                </button>
                <button
                  onClick={() => {
                    copyTableToClipboard(_cols, effectiveNodes);
                    toast.success(isPl ? 'Skopiowano' : 'Copied');
                  }}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  title={isPl ? 'Kopiuj do schowka' : 'Copy to clipboard'}
                >
                  <ClipboardCopy size={12} />
                </button>
              </div>

              {/* Column config */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnConfig(!showColumnConfig)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                  title={isPl ? 'Kolumny' : 'Columns'}
                >
                  <Columns3 size={12} />
                </button>
                {showColumnConfig && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-xl p-2">
                    {_cols.map((col) => (
                      <button
                        key={col.key}
                        onClick={() => toggleColumn(col.key)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                      >
                        {col.visible ? (
                          <Eye size={12} className="text-slate-500" />
                        ) : (
                          <EyeOff size={12} className="text-slate-600" />
                        )}
                        {col.header}
                        <span className="ml-auto text-[9px] text-slate-600">{col.type}</span>
                      </button>
                    ))}
                    <div className="border-t border-slate-200/60 dark:border-navy-700/60 mt-1 pt-1">
                      <button
                        onClick={() => {
                          setShowColumnConfig(false);
                          setShowAddColumn(true);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                      >
                        <Plus size={12} />
                        {isPl ? 'Nowa kolumna' : 'New column'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Undo / Redo */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handlePlatformUndo}
                  disabled={!usePlatform && !nodesUndo.canUndo}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 size={13} />
                </button>
                <button
                  onClick={nodesUndo.redo}
                  disabled={!nodesUndo.canRedo}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 size={13} />
                </button>
              </div>

              <div className="flex-1" />

              {/* Bulk actions */}
              {_selIds.size > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 bg-slate-900/[0.06] dark:bg-white/[0.10] px-2 py-0.5 rounded-lg">
                    {_selIds.size} {isPl ? 'zaznaczonych' : 'selected'}
                  </span>
                  {!locked && (
                    <>
                      <div className="relative">
                        <button
                          onClick={() => setShowBulkConvertMenu((p) => !p)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                        >
                          <ArrowRight size={11} />
                          {isPl ? 'Konwertuj' : 'Convert'}
                          <ChevronDown size={9} />
                        </button>
                        {showBulkConvertMenu && (
                          <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-xl p-1">
                            {(['initiative', 'task', 'decision'] as const).map((t) => (
                              <button
                                key={t}
                                onClick={() => handleBulkConvert(t)}
                                className="w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors capitalize"
                              >
                                →{' '}
                                {t === 'initiative'
                                  ? isPl
                                    ? 'Inicjatywa'
                                    : 'Initiative'
                                  : t === 'task'
                                    ? isPl
                                      ? 'Zadanie'
                                      : 'Task'
                                    : isPl
                                      ? 'Decyzja'
                                      : 'Decision'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={_bulkDel}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-danger-600 bg-danger-500/10 hover:bg-danger-500/20 transition-colors"
                      >
                        <Trash2 size={11} />
                        {isPl ? 'Usuń' : 'Delete'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Add row (click = blank, dropdown = templates) */}
              {!locked && (
                <div className="flex items-center rounded-lg border border-slate-200/60 dark:border-navy-700/60 overflow-hidden">
                  <button
                    onClick={_addRow}
                    className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                    title={isPl ? 'Dodaj pusty wiersz' : 'Add blank row'}
                  >
                    <Plus size={12} />
                    {isPl ? 'Wiersz' : 'Row'}
                  </button>
                  <button
                    onClick={handleAddRowWithTemplate}
                    className="px-1 py-1.5 text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors border-l border-slate-200/60 dark:border-navy-700/60"
                    title={isPl ? 'Dodaj z szablonu' : 'Add from template'}
                  >
                    <ChevronDown size={10} />
                  </button>
                </div>
              )}

              <span className="text-[11px] text-slate-500 dark:text-slate-400">{_saveLabel}</span>
              <button
                type="button"
                onClick={_save}
                disabled={_saving || _loading || locked}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  _saving || _loading || locked
                    ? 'bg-slate-200/60 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
                    : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                }`}
              >
                {_saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {_saving ? (isPl ? 'Zapisuję…' : 'Saving…') : isPl ? 'Zapisz' : 'Save'}
              </button>
            </div>
          )}

          {/* AI Table Assistant overlay */}
          <AITableAssistant
            open={showAIAssistant}
            onClose={() => setShowAIAssistant(false)}
            ideaId={ideaId}
            columns={_cols}
            artifactContext={effectiveNodes
              .filter((n) => n.data?.label)
              .slice(0, 20)
              .map((n) => ({
                id: n.id,
                type: String(n.type || 'idea'),
                title: String(n.data?.label || ''),
                snippet: String(n.data?.description || n.data?.bodyMarkdown || '').slice(0, 200),
              }))}
            onSort={(s) => (usePlatform ? effectiveSetSort : setSort)(s)}
            onFilter={(f) => (usePlatform ? effectiveSetFilters : setFilters)(f)}
            onGroup={(g) => (usePlatform ? effectiveSetGroupBy : setGroupBy)(g)}
            onAddColumn={handleAddColumn}
            onAddRows={handleAIAddRows}
            onProposal={(p) => {
              setAiProposal(p);
              setShowAIAssistant(false);
            }}
            usePlatform={usePlatform}
            workspaceId={ideaId}
          />

          {/* AI Table Proposal overlay */}
          {aiProposal && (
            <div className="absolute left-4 right-4 top-14 z-50">
              <AITableProposal
                proposal={aiProposal}
                onAccept={(accepted) => {
                  if (accepted.columns) {
                    for (const col of accepted.columns) handleAddColumn(col);
                  }
                  if (accepted.views) {
                    setSavedViews((prev) => [...prev, ...accepted.views!]);
                  }
                  if (accepted.rows) {
                    handleAIAddRows(accepted.rows);
                  }
                  setAiProposal(null);
                }}
                onReject={() => setAiProposal(null)}
              />
            </div>
          )}

          {locked && (
            <div className="px-3 md:px-4 pt-3">
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-slate-300">
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {isPl ? 'Tryb tylko do odczytu' : 'Read-only mode'}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {isPl
                    ? 'Możesz przeglądać tabelę, ale edycja i zapis są obecnie zablokowane.'
                    : 'You can review the table, but editing and saving are currently disabled.'}
                </div>
              </div>
            </div>
          )}

          {effectiveLoadError && !_loading && effectiveNodes.length === 0 && (
            <div className="px-3 md:px-4 pt-3">
              <EmptyStateInline
                icon={Table2}
                dashed={false}
                message={
                  isPl
                    ? 'Widok tabeli jest chwilowo niedostępny.'
                    : 'Table view is temporarily unavailable.'
                }
                hint={
                  isPl
                    ? 'To nie oznacza, że tabela jest pusta. Spróbuj ponownie wczytać dane i sprawdź jeszcze raz.'
                    : 'This does not mean the table is empty. Retry loading the data and check again.'
                }
                action={{
                  label: isPl ? 'Ponów' : 'Retry',
                  onClick: () => {
                    void effectiveRefresh();
                  },
                }}
                className="mb-2"
              />
            </div>
          )}

          {/* Content area — switchable between Data / Forms / Interfaces + optional AI Panel */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            <div className="flex-1 overflow-hidden min-w-0">
              {usePlatform && platformTab === 'forms' ? (
                <div className="flex-1 overflow-y-auto">
                  <FormsIndex
                    tableId={platformTableId ?? ideaId}
                    tableFields={
                      platformIntegration.platformFields.length > 0
                        ? platformIntegration.platformFields
                        : effectiveColumns.map((c) => ({
                            id: c.key,
                            tableId: platformTableId ?? ideaId,
                            name: c.header,
                            fieldType: (c.type ??
                              'singleLineText') as import('@/types/tablePlatform').FieldType,
                            options: {},
                            isComputed: false,
                            order: 0,
                            createdAt: '',
                            updatedAt: '',
                          }))
                    }
                    locked={locked}
                  />
                </div>
              ) : usePlatform && platformTab === 'interfaces' ? (
                <div className="flex-1 overflow-y-auto">
                  <InterfacesIndex
                    baseId={ideaId}
                    tableId={platformTableId ?? ideaId}
                    tables={[
                      {
                        id: platformTableId ?? ideaId,
                        name: isPl ? 'Bieżąca tabela' : 'Current table',
                        fields: _cols.map((c) => ({ id: c.key, name: c.header })),
                      },
                    ]}
                    platformViews={platformIntegration.platformViews}
                    onCreateView={platformIntegration.createPlatformView}
                    locked={locked}
                  />
                </div>
              ) : usePlatform && platformTab === 'models' ? (
                <div className="flex-1 overflow-y-auto">
                  <GovernedModelsDashboard
                    baseId={ideaId}
                    tables={baseTables.map((t) => ({
                      id: t.id,
                      name: t.name,
                      fields:
                        t.id === (platformTableId ?? ideaId)
                          ? _cols.map((c) => ({ id: c.key, name: c.header }))
                          : [],
                    }))}
                    locked={locked}
                    onOpenTable={(tableId) => {
                      const tab = baseTables.find((bt) => bt.id === tableId);
                      if (tab) handleTabSelectTable(tab.id);
                    }}
                  />
                </div>
              ) : usePlatform && platformTab === 'workflow' ? (
                <div className="flex-1 overflow-hidden">
                  <WorkflowDashboard
                    tableId={platformTableId ?? ideaId}
                    baseId={ideaId}
                    workspaceId={ideaId}
                    tables={baseTables.map((t) => ({
                      id: t.id,
                      name: t.name,
                      fields:
                        t.id === (platformTableId ?? ideaId)
                          ? _cols.map((c) => ({
                              id: c.key,
                              name: c.header,
                              fieldType: c.type ?? 'singleLineText',
                            }))
                          : [],
                    }))}
                    fields={_cols.map((c) => ({
                      id: c.key,
                      name: c.header,
                      fieldType: c.type ?? 'singleLineText',
                    }))}
                    views={platformIntegration.platformViews.map((v: any) => ({
                      id: v.id,
                      name: v.name,
                      shareToken: v.shareToken,
                    }))}
                    locked={locked}
                  />
                </div>
              ) : usePlatform ? (
                <P15ViewRouter onCSVImport={handleCSVImport} />
              ) : _loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="animate-spin text-slate-600" size={24} />
                </div>
              ) : usePlatform && (_vl === 'kanban' || _vl === 'calendar' || _vl === 'grid') ? (
                <LegacyViewRouter
                  viewType={_vl === 'grid' ? 'gallery' : (_vl as 'kanban' | 'calendar')}
                  records={processedRowsWithRollups}
                  columns={_cols}
                  viewConfig={{
                    ...platformViewConfig,
                    viewType: _vl === 'grid' ? 'gallery' : (_vl as 'kanban' | 'calendar'),
                    visibleFieldIds:
                      platformViewConfig.visibleFieldIds.length > 0
                        ? platformViewConfig.visibleFieldIds
                        : _visCols.map((c) => c.key),
                    groupByFieldId: platformViewConfig.groupByFieldId || _groupBy || undefined,
                    dateFieldId:
                      platformViewConfig.dateFieldId || _cols.find((c) => c.type === 'date')?.key,
                  }}
                  onRecordUpdate={_fieldChange}
                  onRecordClick={(id) => setDetailNodeId(id)}
                  onAddRecord={(defaults) => {
                    if (defaults) {
                      const id = `node-${Date.now()}`;
                      const now = new Date().toISOString();
                      const newNode = {
                        id,
                        type: 'idea',
                        data: {
                          label: '',
                          status: 'todo',
                          ...defaults,
                          created_time: now,
                          created_by: currentUserId,
                          last_edited_time: now,
                          last_edited_by: currentUserId,
                        },
                        position: { x: 0, y: 0 },
                      };
                      nodesUndo.push([...nodes, newNode]);
                    } else {
                      _addRow();
                    }
                  }}
                />
              ) : _vl === 'timeline' ? (
                <TimelineView
                  nodes={processedRowsWithRollups}
                  edges={edges}
                  columns={_cols}
                  locked={locked}
                  onFieldChange={_fieldChange}
                  onNodeClick={(id) => setDetailNodeId(id)}
                />
              ) : _vl === 'sticky' ? (
                <StickyNoteView
                  nodes={processedRowsWithRollups}
                  columns={_cols}
                  onNodeClick={(id) => setDetailNodeId(id)}
                  onReorder={handleReorderNode}
                  onFieldChange={_fieldChange}
                  groupBy={_groupBy}
                />
              ) : _vl === 'kanban' ? (
                <KanbanView
                  nodes={processedRowsWithRollups}
                  groupByColumn={
                    _cols.find(
                      (c) =>
                        c.key === (_groupBy || 'status') &&
                        (c.type === 'select' || c.type === 'multiselect' || c.type === 'status')
                    ) ||
                    _cols.find((c) => c.type === 'status' || c.type === 'select') ||
                    _cols[0]
                  }
                  columns={_cols}
                  locked={locked}
                  onFieldChange={_fieldChange}
                  onAddRow={_addRow}
                  onNodeClick={(id) => setDetailNodeId(id)}
                />
              ) : _vl === 'calendar' ? (
                <CalendarView
                  rows={processedRowsWithRollups}
                  columns={_cols}
                  locked={locked}
                  onNodeClick={(id) => setDetailNodeId(id)}
                  onFieldChange={_fieldChange}
                  onAddEventAtDate={handleAddEventAtDate}
                />
              ) : _vl === 'grid' ? (
                <GridView
                  rows={processedRowsWithRollups}
                  columns={_cols}
                  locked={locked}
                  onNodeClick={(id) => setDetailNodeId(id)}
                  onFieldChange={_fieldChange}
                />
              ) : _vl === 'matrix' ? (
                <MatrixView
                  nodes={processedRowsWithRollups}
                  columns={_cols}
                  xAxis={
                    (matrixAxisXKey && _cols.find((c) => c.key === matrixAxisXKey)) ||
                    _cols.find(
                      (c) => c.key === 'impact' && (c.type === 'number' || c.type === 'rating')
                    ) ||
                    _cols.find((c) => c.type === 'rating') ||
                    _cols[0]!
                  }
                  yAxis={
                    (matrixAxisYKey && _cols.find((c) => c.key === matrixAxisYKey)) ||
                    _cols.find(
                      (c) => c.key === 'effort' && (c.type === 'number' || c.type === 'rating')
                    ) ||
                    _cols.filter((c) => c.type === 'rating')[1] ||
                    _cols[1] ||
                    _cols[0]!
                  }
                  locked={locked}
                  onNodeClick={(id) => setDetailNodeId(id)}
                  onFieldChange={_fieldChange}
                  onAxisChange={(axis, col) => {
                    if (axis === 'x') setMatrixAxisXKey(col.key);
                    else setMatrixAxisYKey(col.key);
                  }}
                />
              ) : (
                <div
                  ref={tableContainerRef}
                  className="flex-1 overflow-x-auto overflow-y-auto relative -webkit-overflow-scrolling-touch"
                >
                  <ConnectionLines
                    selectedNodeId={selectedNodeForLines}
                    edges={edges}
                    allNodes={effectiveNodes}
                    containerRef={tableContainerRef}
                  />
                  <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ 
                    className="w-full text-left"
                    style={{ width: tableWidth, minWidth: tableWidth, tableLayout: 'fixed' }}
                  >
                    <thead className="sticky top-0 bg-slate-50/95 dark:bg-navy-900/95 backdrop-blur-sm border-b border-slate-200/60 dark:border-navy-700/60 z-10">
                      <tr>
                        <th className="w-8 px-2 py-2">
                          <input
                            type="checkbox"
                            checked={
                              _selIds.size === processedRowsWithRollups.length &&
                              processedRowsWithRollups.length > 0
                            }
                            onChange={() => {
                              const setSelFn = usePlatform
                                ? effectiveSetSelectedRowIds
                                : setSelectedRowIds;
                              if (_selIds.size === processedRowsWithRollups.length) {
                                setSelFn(new Set());
                                onSelectionChange?.(EMPTY_SELECTION);
                              } else {
                                const all = new Set(processedRowsWithRollups.map((r) => r.id));
                                setSelFn(all);
                                onSelectionChange?.({
                                  type: 'row',
                                  count: all.size,
                                  ids: Array.from(all),
                                });
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-300 dark:border-navy-600 text-slate-600 focus:ring-slate-400/30"
                          />
                        </th>
                        <th className="w-10 px-1 py-2 text-[10px] font-normal text-slate-600 dark:text-slate-500 text-right select-none">
                          #
                        </th>
                        {stretchedVisibleCols.map((col) => (
                          <th
                            key={col.key}
                            style={{ width: col.width, minWidth: col.width, maxWidth: col.width }}
                            className="relative px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none group"
                            draggable={editingHeaderKey !== col.key}
                            onDragStart={() => handleColDragStart(col.key)}
                            onDragOver={(e) => handleColDragOver(e, col.key)}
                            onDragEnd={handleColDragEnd}
                          >
                            {editingHeaderKey === col.key ? (
                              <input
                                autoFocus
                                defaultValue={col.header}
                                className="w-full bg-white dark:bg-navy-800 border border-slate-400/40 dark:border-navy-500/40 rounded px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 outline-none"
                                onBlur={(e) => {
                                  renameColumn(col.key, e.target.value);
                                  setEditingHeaderKey(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    renameColumn(col.key, (e.target as HTMLInputElement).value);
                                    setEditingHeaderKey(null);
                                  }
                                  if (e.key === 'Escape') setEditingHeaderKey(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <div
                                className="flex items-center gap-1 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
                                onClick={() => effectiveCycleSort(col.key)}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  if (!locked) setEditingHeaderKey(col.key);
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  if (!locked)
                                    setColContextMenu({
                                      colKey: col.key,
                                      x: e.clientX,
                                      y: e.clientY,
                                    });
                                }}
                              >
                                <GripVertical
                                  size={10}
                                  className="opacity-0 group-hover:opacity-40 cursor-grab"
                                />
                                {col.header}
                                {_sort?.key === col.key ? (
                                  _sort.direction === 'asc' ? (
                                    <ArrowUp size={10} />
                                  ) : (
                                    <ArrowDown size={10} />
                                  )
                                ) : (
                                  <ArrowUpDown size={10} className="opacity-30" />
                                )}
                              </div>
                            )}
                            {/* Resize handle */}
                            <div
                              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-slate-400/30 transition-colors"
                              onMouseDown={(e) => handleResizeStart(col.key, e)}
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {effectiveGroupedRows ? (
                        Object.entries(effectiveGroupedRows).map(([groupKey, rows]) => (
                          <React.Fragment key={groupKey}>
                            <tr className="bg-slate-100/50 dark:bg-navy-800/50">
                              <td
                                colSpan={_visCols.length + 2}
                                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                              >
                                {groupKey || (isPl ? '(brak wartości)' : '(empty)')}{' '}
                                <span className="text-slate-600 font-normal ml-1">
                                  ({rows.length})
                                </span>
                              </td>
                            </tr>
                            {rows.map((row, idx) => renderRow(row, idx))}
                          </React.Fragment>
                        ))
                      ) : processedRowsWithRollups.length === 0 ? (
                        <tr>
                          <td colSpan={_visCols.length + 2} className="px-4 py-12 text-center">
                            <div className="mx-auto max-w-xl text-slate-600 dark:text-slate-500">
                              <div className="text-sm font-semibold mb-1">
                                {isPl ? 'Tabela jest jeszcze pusta' : 'This table is still empty'}
                              </div>
                              <div className="text-[11px] leading-relaxed">
                                {isPl
                                  ? 'Zacznij od struktury: wybierz framework, dodaj pierwszy wiersz lub użyj szablonu. AI zostaw na moment, gdy model tabeli będzie już wiarygodny.'
                                  : 'Start with structure: choose a framework, add the first row, or use a template. Save AI for the moment when the table model is already trustworthy.'}
                              </div>
                              {!locked && (
                                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                                  <button
                                    onClick={_addRow}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900/[0.06] dark:bg-white/[0.10] text-slate-700 dark:text-slate-200 hover:bg-slate-900/[0.10] dark:hover:bg-white/[0.14] transition-colors"
                                  >
                                    <Plus size={14} />
                                    {isPl ? 'Dodaj pusty wiersz' : 'Add blank row'}
                                  </button>
                                  <button
                                    onClick={handleAddRowWithTemplate}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-white/[0.05] dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors"
                                  >
                                    <Layers size={14} />
                                    {isPl ? 'Użyj szablonu wiersza' : 'Use row template'}
                                  </button>
                                  <button
                                    onClick={() => setShowFrameworkGen(true)}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
                                  >
                                    <LayoutGrid size={14} />
                                    {isPl ? 'Zbuduj framework' : 'Build framework'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        processedRowsWithRollups.map((row, idx) => renderRow(row, idx))
                      )}
                    </tbody>
                    {/* Footer aggregations */}
                    {processedRowsWithRollups.length > 0 &&
                      _visCols.some((c) => c.aggregation && c.aggregation !== 'none') && (
                        <tfoot className="border-t-2 border-slate-200/60 dark:border-navy-700/60">
                          <tr className="bg-slate-50/50 dark:bg-navy-900/50">
                            <td className="px-2 py-1.5" />
                            <td className="w-10 px-1 py-1.5" />
                            {stretchedVisibleCols.map((col) => {
                              const agg = col.aggregation;
                              if (!agg || agg === 'none')
                                return <td key={col.key} className="px-2 py-1.5" />;
                              const values = processedRowsWithRollups.map((r) => r.data?.[col.key]);
                              return (
                                <td
                                  key={col.key}
                                  className="px-2 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 tabular-nums"
                                >
                                  <span className="text-[8px] text-slate-600 uppercase mr-1">
                                    {agg}
                                  </span>
                                  {computeAggregation(agg, values)}
                                </td>
                              );
                            })}
                          </tr>
                        </tfoot>
                      )}
                  </table>

                  {/* Edges table */}
                  {edges.length > 0 && (
                    <div className="border-t border-slate-200/60 dark:border-navy-700/60 mt-4">
                      <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {isPl ? 'Połączenia' : 'Edges'} ({edges.length})
                      </div>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-200/40 dark:border-navy-700/40">
                            <th className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                              {isPl ? 'Źródło' : 'Source'}
                            </th>
                            <th className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                              {isPl ? 'Cel' : 'Target'}
                            </th>
                            <th className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 w-28">
                              Kind
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {edges.map((e) => (
                            <tr
                              key={e.id}
                              className="border-b border-slate-200/20 dark:border-white/[0.02]"
                            >
                              <td className="px-3 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                                {e.source}
                              </td>
                              <td className="px-3 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                                {e.target}
                              </td>
                              <td className="px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                {e?.data?.kind ? String(e.data.kind) : e.type || 'edge'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Status Bar — record count + aggregates */}
              {usePlatform && (
                <StatusBar
                  totalRecords={platformIntegration.totalRecords}
                  selectedCount={_selIds.size}
                  columns={platformIntegration.platformFields.map((f) => ({
                    id: f.id,
                    name: f.name,
                    fieldType: f.fieldType,
                  }))}
                  records={platformIntegration.nodes.map((n) => n.data ?? {})}
                  aggregateConfig={
                    statusBarAggConfig as Record<
                      string,
                      'none' | 'sum' | 'avg' | 'min' | 'max' | 'count'
                    >
                  }
                  onAggregateChange={(fieldId, mode) =>
                    setStatusBarAggConfig((prev) => ({ ...prev, [fieldId]: mode }))
                  }
                />
              )}

              {/* Table Tab Strip — multi-table navigation */}
              {usePlatform && baseTables.length > 0 && (
                <TableTabStrip
                  baseId={ideaId}
                  tables={baseTables}
                  activeTableId={
                    platformTableOverrideId ?? platformTableId ?? baseTables[0]?.id ?? ''
                  }
                  onSelectTable={handleTabSelectTable}
                  onCreateTable={handleTabCreateTable}
                  onRenameTable={handleTabRenameTable}
                  onDuplicateTable={handleTabDuplicateTable}
                  onDeleteTable={handleTabDeleteTable}
                />
              )}
            </div>
          </div>

          {/* Column context menu */}
          {colContextMenu && (
            <div className="fixed inset-0 z-[60]" onClick={() => setColContextMenu(null)}>
              <div
                className="absolute bg-white dark:bg-navy-900 rounded-lg shadow-xl border border-slate-200 dark:border-navy-700 py-1 min-w-[160px]"
                style={{ left: colContextMenu.x, top: colContextMenu.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                  onClick={() => {
                    setEditingHeaderKey(colContextMenu.colKey);
                    setColContextMenu(null);
                  }}
                >
                  {isPl ? 'Zmień nazwę' : 'Rename'}
                </button>
                <button
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                  onClick={() => {
                    effectiveCycleSort(colContextMenu.colKey);
                    setColContextMenu(null);
                  }}
                >
                  {isPl ? 'Sortuj' : 'Sort'}
                </button>
                <button
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                  onClick={() => {
                    toggleColumn(colContextMenu.colKey);
                    setColContextMenu(null);
                  }}
                >
                  {isPl ? 'Ukryj kolumnę' : 'Hide column'}
                </button>
                <div className="h-px bg-slate-200 dark:bg-navy-700 my-1" />
                <button
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-danger-50 dark:hover:bg-danger-900/20 text-danger-600"
                  onClick={() => {
                    deleteColumn(colContextMenu.colKey);
                    toast.success(isPl ? 'Kolumna usunięta' : 'Column deleted');
                    setColContextMenu(null);
                  }}
                >
                  {isPl ? 'Usuń kolumnę' : 'Delete column'}
                </button>
              </div>
            </div>
          )}
        </TableDataProvider>
      </div>

      {/* Row Detail Panel */}
      <RowDetailPanel
        open={!!detailNodeId}
        onClose={() => setDetailNodeId(null)}
        node={detailNode}
        columns={_visCols}
        edges={edges}
        allNodes={effectiveNodes}
        locked={locked}
        mode={detailMode}
        onExpand={() => setDetailMode('full')}
        onFieldChange={_fieldChange}
        onConvert={(target) => {
          if (detailNodeId) {
            const now = new Date().toISOString();
            const next = nodes.map((n) =>
              n.id === detailNodeId
                ? {
                    ...n,
                    data: {
                      ...(n.data || {}),
                      _convertedTo: target,
                      _convertedAt: now,
                      _sourceRowId: n.id,
                      _sourceTable: ideaId,
                      last_edited_time: now,
                    },
                  }
                : n
            );
            nodesUndo.push(next);
          }
          if (onConvertProp) {
            onConvertProp(target);
          } else {
            toast.success(isPl ? `Konwersja do: ${target}` : `Convert to: ${target}`);
          }
          setDetailNodeId(null);
        }}
        onAddSubItem={handleAddSubItem}
        onNodeClick={(id) => setDetailNodeId(id)}
        onAddRelation={(sourceId, targetId) => {
          setEdges((prev) => [
            ...prev,
            { id: `edge_${Date.now()}`, source: sourceId, target: targetId, kind: 'relation' },
          ]);
          trackFunnelEvent('ideas_table_relation_created' as any, { ideaId, sourceId, targetId });
        }}
        onLinkArtifact={(nodeId) => {
          trackFunnelEvent('ideas_table_artifact_linked' as any, { ideaId, nodeId });
        }}
        ideaId={ideaId}
        fields={usePlatform ? platformIntegration.platformFields : undefined}
        platformTableId={usePlatform ? (platformTableId ?? ideaId) : undefined}
      />

      {/* Add Column Dialog */}
      <AddColumnDialog
        open={showAddColumn}
        onClose={() => setShowAddColumn(false)}
        onAdd={handleAddColumn}
        existingKeys={_cols.map((c) => c.key)}
      />

      {/* Framework Generator */}
      <FrameworkGenerator
        open={showFrameworkGen}
        onClose={() => setShowFrameworkGen(false)}
        onApply={handleFrameworkApply}
      />

      {/* Conditional Formatting */}
      <ConditionalFormatting
        open={showConditionalFmt}
        onClose={() => setShowConditionalFmt(false)}
        rules={formatRules}
        onChange={setFormatRules}
        fields={_cols}
      />

      {/* Cell Expand Popover */}
      {cellExpandState && cellExpandCol && cellExpandNode && (
        <CellExpandPopover
          open={true}
          onClose={() => setCellExpandState(null)}
          column={cellExpandCol}
          value={cellExpandNode.data?.[cellExpandCol.key]}
          rowData={cellExpandNode.data || {}}
          onChange={(val) => {
            if (val && typeof val === 'object' && val._noteUpdate) {
              _fieldChange(cellExpandNode.id, val._noteUpdate.key, val._noteUpdate.value);
            } else if (val && typeof val === 'object' && val._optionsUpdate) {
              setColumns((prev) =>
                prev.map((c) =>
                  c.key === cellExpandCol.key ? { ...c, options: val._optionsUpdate } : c
                )
              );
            } else {
              _fieldChange(cellExpandNode.id, cellExpandCol.key, val);
            }
          }}
          locked={locked}
          anchorRect={cellExpandState.rect}
          onAIRegenerate={async (prompt) => {
            try {
              const result = await Api.getIdeaAIFill(ideaId, {
                prompt,
                rows: [{ id: cellExpandNode.id, data: cellExpandNode.data || {} }],
                language: i18n.language,
              });
              return result?.[0]?.value || '';
            } catch {
              return '';
            }
          }}
        />
      )}

      {/* Keyboard Shortcuts Panel */}
      <KeyboardShortcutsPanel
        open={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />

      {/* Row Template Picker */}
      <RowTemplatePicker
        open={showRowTemplatePicker}
        onClose={() => setShowRowTemplatePicker(false)}
        onSelect={handleTemplateSelect}
        anchorRect={addRowBtnRect}
      />

      {/* AI Categorize Tool */}
      <AICategorizeTool
        open={showAICategorize}
        onClose={() => setShowAICategorize(false)}
        nodes={processedRowsWithRollups}
        ideaId={ideaId}
        onApplyTags={handleApplyTags}
        onApplyCluster={handleApplyCluster}
        onMergeNodes={handleMergeNodes}
      />

      {/* Idea Scoring Model */}
      <IdeaScoringModel
        open={showScoringModel}
        onClose={() => setShowScoringModel(false)}
        nodes={processedRowsWithRollups}
        columns={_cols}
        ideaId={ideaId}
        onApplyScores={handleApplyScores}
      />

      {/* Export to Presentation */}
      <ExportToPresentation
        open={showExportPresentation}
        onClose={() => setShowExportPresentation(false)}
        nodes={processedRowsWithRollups}
        columns={_cols}
        ideaTitle={extensions?.title ? String(extensions.title) : isPl ? 'Pomysły' : 'Ideas'}
        viewLayout={_vl}
      />

      {/* Idea Pipeline */}
      <IdeaPipeline
        open={showPipeline}
        onClose={() => setShowPipeline(false)}
        nodes={processedRowsWithRollups}
        ideaId={ideaId}
        onStageChange={handlePipelineStageChange}
        onConvertToInitiative={(nodeId) => {
          if (onConvertProp) onConvertProp('initiative');
          else
            toast.success(
              isPl ? `Konwersja pomysłu do inicjatywy` : `Converting idea to initiative`
            );
        }}
      />

      {/* AI Copilot */}
      <AICopilotMode
        open={showCopilot}
        onClose={() => setShowCopilot(false)}
        nodes={processedRowsWithRollups}
        ideaId={ideaId}
        onAddRows={handleAIAddRows}
        onUpdateNode={(nodeId, data) => {
          const next = nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...(n.data || {}), ...data } } : n
          );
          nodesUndo.push(next);
        }}
      />

      {/* Voice / Image Input */}
      <VoiceImageInput
        open={showVoiceInput}
        onClose={() => setShowVoiceInput(false)}
        ideaId={ideaId}
        onAddRows={handleAIAddRows}
      />

      {/* Cross-table Relations */}
      <CrossTableRelations
        open={showCrossRelations}
        onClose={() => setShowCrossRelations(false)}
        ideaId={ideaId}
        currentNodes={processedRowsWithRollups}
        currentEdges={edges}
        onAddEdge={handleAddCrossEdge}
      />

      {/* Audit Trail Panel (record history sidebar) */}
      <AuditTrailPanel
        open={showAuditTrail}
        onClose={() => setShowAuditTrail(false)}
        recordId={detailNodeId}
        tableId={ideaId}
      />

      {/* Activity Feed (table-level) */}
      <ActivityFeed
        open={showActivityFeed}
        onClose={() => setShowActivityFeed(false)}
        tableId={ideaId}
        onEventClick={(entityId) => {
          setDetailNodeId(entityId);
          setDetailMode('preview');
        }}
      />

      {/* Data Connector Wizard */}
      <ConnectorWizard
        open={showConnectorWizard}
        onClose={() => setShowConnectorWizard(false)}
        workspaceId={ideaId}
        tableId={ideaId}
        targetFields={effectiveVisibleColumns.map((c) => c.key)}
        onCreated={() => connectors.refetch()}
        testConnection={connectors.testConnection}
        autoMap={connectors.autoMap}
        create={connectors.create}
        isCreating={connectors.isCreating}
      />

      {/* Interface Designer */}
      {showInterfaceDesigner && (
        <div
          className="fixed inset-0 z-[160] flex items-stretch bg-black/20 backdrop-blur-[2px]"
          onClick={() => setShowInterfaceDesigner(false)}
        >
          <div
            className="flex-1 m-4 bg-white dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {isPl ? 'Projektant interfejsu' : 'Interface Designer'}
              </h3>
              <button
                onClick={() => setShowInterfaceDesigner(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800"
              >
                <X size={14} className="text-slate-600" />
              </button>
            </div>
            <InterfaceDesigner
              key={primaryPlatformInterfaceView?.id ?? `iface-${ideaId}`}
              interfaceId={primaryPlatformInterfaceView?.id ?? `iface-${ideaId}`}
              baseId={ideaId}
              layout={{
                blocks: (primaryPlatformInterfaceView?.config?.blocks as any[]) ?? [],
                ...(primaryPlatformInterfaceView?.config?.theme
                  ? { theme: primaryPlatformInterfaceView.config.theme }
                  : {}),
              }}
              tables={[
                {
                  id: platformTableId ?? ideaId,
                  name: isPl ? 'Bieżąca tabela' : 'Current table',
                  fields: _cols.map((c) => ({ id: c.key, name: c.header })),
                },
              ]}
              onSave={() => {
                setShowInterfaceDesigner(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Form Builder */}
      {showFormBuilder && usePlatform && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          onClick={() => setShowFormBuilder(false)}
        >
          <div
            className="w-[800px] max-w-[95vw] max-h-[85vh] overflow-y-auto bg-white dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <FormBuilder
              form={{
                id: `form-${ideaId}`,
                table_id: ideaId,
                name: isPl ? 'Nowy formularz' : 'New Form',
                description: null,
                slug: `form-${ideaId}`,
                is_published: false,
                config: { fields: [] },
                submit_count: 0,
              }}
              tableFields={effectiveColumns.map((c) => ({
                id: c.key,
                tableId: ideaId,
                name: c.header,
                fieldType: (c.type ??
                  'singleLineText') as import('@/types/tablePlatform').FieldType,
                options: {},
                isComputed: false,
                order: 0,
                createdAt: '',
                updatedAt: '',
              }))}
              onSave={async () => {
                toast.success(isPl ? 'Formularz zapisany' : 'Form saved');
                setShowFormBuilder(false);
              }}
              onDelete={async () => {
                setShowFormBuilder(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Record Expand Modal (double-click on row) */}
      {expandedRecordId && usePlatform && (
        <RecordExpandModal
          open={!!expandedRecordId}
          onClose={() => setExpandedRecordId(null)}
          recordId={expandedRecordId}
          tableId={platformTableId ?? ideaId}
          tableName={isPl ? 'Bieżąca tabela' : 'Current table'}
          onOpenAuditTrail={(recId) => {
            setDetailNodeId(recId);
            setShowAuditTrail(true);
          }}
          locked={locked}
        />
      )}

      {/* Template Gallery */}
      {showTemplateGallery && (
        <TemplateGallery
          workspaceId={ideaId}
          onClose={() => setShowTemplateGallery(false)}
          onTemplateUsed={() => {
            toast.success(isPl ? 'Szablon zastosowany' : 'Template applied');
          }}
        />
      )}

      {/* Distribution Builder */}
      {showDistributionBuilder && (
        <DistributionBuilder baseId={ideaId} onClose={() => setShowDistributionBuilder(false)} />
      )}

      {/* Consultify Link Panel */}
      {showConsultifyLink && (
        <div
          className="fixed inset-0 z-[150] flex items-stretch justify-end bg-black/20 backdrop-blur-[2px]"
          onClick={() => setShowConsultifyLink(false)}
        >
          <div
            className="w-[460px] max-w-[90vw] h-full bg-white dark:bg-navy-950 border-l border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <ConsultifyLinkPanel
              baseId={ideaId}
              tables={baseTables.map((t) => ({
                id: t.id,
                name: t.name,
                fields:
                  t.id === (platformTableId ?? ideaId)
                    ? _cols.map((c) => ({ id: c.key, name: c.header }))
                    : [],
              }))}
              models={[]}
              onClose={() => setShowConsultifyLink(false)}
            />
          </div>
        </div>
      )}

      {/* Webhook Relay Panel */}
      {showWebhookRelays && (
        <div
          className="fixed inset-0 z-[150] flex items-stretch justify-end bg-black/20 backdrop-blur-[2px]"
          onClick={() => setShowWebhookRelays(false)}
        >
          <div
            className="w-[420px] max-w-[90vw] h-full bg-white dark:bg-navy-950 border-l border-slate-200 dark:border-navy-700 shadow-2xl overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <WebhookRelayPanel workspaceId={ideaId} onClose={() => setShowWebhookRelays(false)} />
          </div>
        </div>
      )}

      {/* Automations Manager */}
      {showAutomationsManager && (
        <div
          className="fixed inset-0 z-[150] flex items-stretch justify-end bg-black/20 backdrop-blur-[2px]"
          onClick={() => setShowAutomationsManager(false)}
        >
          <div
            className="w-[480px] max-w-[90vw] h-full bg-white dark:bg-navy-950 border-l border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <AutomationsManager
              tableId={platformTableId ?? ideaId}
              baseId={ideaId}
              fields={
                usePlatform && platformIntegration.platformFields
                  ? platformIntegration.platformFields.map((f: any) => ({
                      id: f.id,
                      name: f.name,
                      fieldType: f.fieldType,
                    }))
                  : _cols.map((c) => ({
                      id: c.key,
                      name: c.header,
                      fieldType: c.type ?? 'singleLineText',
                    }))
              }
              onClose={() => setShowAutomationsManager(false)}
            />
          </div>
        </div>
      )}

      {/* Sync Manager */}
      {showSyncManager && (
        <div
          className="fixed inset-0 z-[150] flex items-stretch justify-end bg-black/20 backdrop-blur-[2px]"
          onClick={() => setShowSyncManager(false)}
        >
          <div
            className="w-[480px] max-w-[90vw] h-full bg-white dark:bg-navy-950 border-l border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <SyncManager
              tableId={platformTableId ?? ideaId}
              baseId={ideaId}
              tables={baseTables}
              fields={
                usePlatform && platformIntegration.platformFields
                  ? platformIntegration.platformFields.map((f: any) => ({
                      id: f.id,
                      name: f.name,
                      fieldType: f.fieldType,
                    }))
                  : _cols.map((c) => ({
                      id: c.key,
                      name: c.header,
                      fieldType: c.type ?? 'singleLineText',
                    }))
              }
              onClose={() => setShowSyncManager(false)}
            />
          </div>
        </div>
      )}

      {/* Sharing Manager */}
      {showSharingManager && (
        <div
          className="fixed inset-0 z-[150] flex items-stretch justify-end bg-black/20 backdrop-blur-[2px]"
          onClick={() => setShowSharingManager(false)}
        >
          <div
            className="w-[480px] max-w-[90vw] h-full bg-white dark:bg-navy-950 border-l border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <SharingManager
              baseId={ideaId}
              views={
                effectiveSavedViews?.map((v: any) => ({
                  id: v.id,
                  name: v.name,
                  shareToken: v.shareToken,
                })) ?? []
              }
              onClose={() => setShowSharingManager(false)}
            />
          </div>
        </div>
      )}

      {/* Distribution Manager */}
      {showDistributionManager && (
        <div
          className="fixed inset-0 z-[150] flex items-stretch justify-end bg-black/20 backdrop-blur-[2px]"
          onClick={() => setShowDistributionManager(false)}
        >
          <div
            className="w-[480px] max-w-[90vw] h-full bg-white dark:bg-navy-950 border-l border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <DistributionManager
              baseId={ideaId}
              tableId={platformTableId ?? ideaId}
              views={effectiveSavedViews?.map((v: any) => ({ id: v.id, name: v.name })) ?? []}
              onClose={() => setShowDistributionManager(false)}
            />
          </div>
        </div>
      )}

      {/* Connector List Panel */}
      {showConnectorList && (
        <div
          className="fixed inset-0 z-[150] flex items-stretch justify-end bg-black/20 backdrop-blur-[2px]"
          onClick={() => setShowConnectorList(false)}
        >
          <div
            className="w-[420px] max-w-[90vw] h-full bg-white dark:bg-navy-950 border-l border-slate-200 dark:border-navy-700 shadow-2xl overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {connectorHistoryTarget ? (
              <RunHistoryPanel
                connector={connectorHistoryTarget}
                onBack={() => setConnectorHistoryTarget(null)}
                runHistoryQueryOpts={connectors.useRunHistory(connectorHistoryTarget.id)}
              />
            ) : (
              <ConnectorList
                connectors={connectors.connectors}
                isLoading={connectors.isLoading}
                onAdd={() => {
                  setShowConnectorList(false);
                  setShowConnectorWizard(true);
                }}
                onEdit={() => {
                  toast(isPl ? 'Edycja konektora — wkrótce' : 'Edit connector — coming soon');
                }}
                onDelete={async (c) => {
                  try {
                    await connectors.remove(c.id);
                    toast.success(isPl ? 'Konektor usunięty' : 'Connector deleted');
                  } catch {
                    toast.error(isPl ? 'Nie udało się usunąć' : 'Failed to delete');
                  }
                }}
                onRun={async (c) => {
                  try {
                    await connectors.run(c.id);
                    toast.success(isPl ? 'Import uruchomiony' : 'Import started');
                  } catch {
                    toast.error(isPl ? 'Nie udało się uruchomić' : 'Failed to start');
                  }
                }}
                onViewHistory={(c) => setConnectorHistoryTarget(c)}
                isRunning={connectors.isRunning}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IdeaTableTool;
