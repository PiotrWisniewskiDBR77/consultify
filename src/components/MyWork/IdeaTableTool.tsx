/**
 * IdeaTableTool — V3 Pro Table canvas for Idea Workspace.
 *
 * Rich column types, inline edit, multi-sort, advanced filters, grouping,
 * column config (show/hide/reorder/resize), saved views, selection contract,
 * undo/redo, keyboard navigation, bulk actions, row detail panel, footer aggregations.
 * Data lives in shared IdeaWorkspaceGraph (nodes/edges/extensions.table).
 */
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Brain,
  Calendar,
  ChevronDown,
  ClipboardCopy,
  Columns3,
  Download,
  Eye,
  EyeOff,
  Filter,
  Flame,
  GanttChart,
  Grid3X3,
  GripVertical,
  Group,
  KanbanSquare,
  Keyboard,
  Layers,
  LayoutGrid,
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
  Sparkles,
  StickyNote,
  Table2,
  Trash2,
  Trophy,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { EMPTY_SELECTION, type IdeaWorkspaceSelection } from './ideaSelectionTypes';
import { AddColumnDialog } from './table/AddColumnDialog';
import { AICategorizeTool } from './table/AICategorizeTool';
import { AICopilotMode } from './table/AICopilotMode';
import { AITableAssistant } from './table/AITableAssistant';
import { AITableProposal, type TableProposal } from './table/AITableProposal';
// Stage 3: Extracted view components
import { CalendarView } from './table/CalendarView';
import { CellExpandPopover } from './table/CellExpandPopover';
import { CellRenderer } from './table/CellRenderer';
import {
  CellCursor,
  CollaborationPresence,
  type PresenceUser,
} from './table/CollaborationPresence';
import { autoAssignColors, ColorPalette } from './table/ColorPalette';
import {
  ConditionalFormatting,
  type FormatRule,
  getConditionalStyle,
} from './table/ConditionalFormatting';
import { ConnectionLines } from './table/ConnectionLines';
import { CrossTableRelations } from './table/CrossTableRelations';
import {
  copyTableToClipboard,
  csvToNodes,
  downloadCSV,
  exportToCSV,
  parseCSV,
} from './table/csvUtils';
import {
  AnalyticsSummaryStrip,
  computeHeatmapStyles,
  HeatmapControls,
} from './table/EmbeddedAnalytics';
import { ExportToPresentation } from './table/ExportToPresentation';
import { FilterPanel } from './table/FilterPanel';
import { batchEvaluateFormulas } from './table/FormulaEngineV2';
import { FrameworkGenerator } from './table/FrameworkGenerator';
import { GridView } from './table/GridView';
import { IdeaPipeline } from './table/IdeaPipeline';
import { IdeaScoringModel } from './table/IdeaScoringModel';
import { BatchAIFillButton, InlineAIFill } from './table/InlineAIFill';
import { KanbanView } from './table/KanbanView';
import { KeyboardShortcutsPanel } from './table/KeyboardShortcutsPanel';
import { MatrixView } from './table/MatrixView';
import { RowDetailPanel } from './table/RowDetailPanel';
import { type RowTemplate, RowTemplatePicker } from './table/RowTemplatePicker';
import { type SmartSuggestion, SmartSuggestionsBar } from './table/SmartSuggestionsBar';
import { StickyNoteView } from './table/StickyNoteView';
import { TableSummaryDashboard } from './table/TableSummaryDashboard';
import type {
  ColumnDef,
  FilterGroup,
  SavedView,
  SortConfig,
  TableEdge,
  TableNode,
} from './table/tableTypes';
import { computeAggregation } from './table/tableTypes';
import { TimelineView } from './table/TimelineView';
import { useTableKeyboard } from './table/useTableKeyboard';
// Domain hooks extracted from this file (Stage 1 refactor)
import { useRollupComputation } from './table/useRollupComputation';
import { useTablePersistence } from './table/useTablePersistence';
import { useTableQuickActions } from './table/useTableQuickActions';
import { useTableRows } from './table/useTableRows';
import { useTableSchema } from './table/useTableSchema';
import { useTableViews } from './table/useTableViews';
import { useUndoRedo } from './table/useUndoRedo';
import { VoiceImageInput } from './table/VoiceImageInput';

interface IdeaTableToolProps {
  open: boolean;
  ideaId: string;
  locked?: boolean;
  refreshToken?: number;
  focusMode?: 'system' | 'object' | null;
  focusObjectId?: string | null;
  onSaved?: () => void;
  onSelectionChange?: (sel: IdeaWorkspaceSelection) => void;
  onConvert?: (target: string) => void;
}

// DEFAULT_COLUMNS now lives in useTableSchema.ts

export const IdeaTableTool: React.FC<IdeaTableToolProps> = ({
  open,
  ideaId,
  locked = false,
  refreshToken,
  focusMode,
  focusObjectId,
  onSaved,
  onSelectionChange,
  onConvert: onConvertProp,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

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

  // ── Core data state ──────────────────────────────────────────────────────────
  const [edges, setEdges] = useState<TableEdge[]>([]);
  const [extensions, setExtensions] = useState<Record<string, unknown>>({});
  const nodesUndo = useUndoRedo<TableNode[]>([]);
  const [formatRules, setFormatRules] = useState<FormatRule[]>([]);
  const [matrixAxisXKey, setMatrixAxisXKey] = useState<string | null>(null);
  const [matrixAxisYKey, setMatrixAxisYKey] = useState<string | null>(null);

  // ── Row operations hook ─────────────────────────────────────────────────────
  const rowOps = useTableRows({
    ideaId,
    locked,
    isPl,
    currentUserName: 'Me',
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

  // ── Rollup computation (inject aggregated values for rollup columns) ───────
  const processedRowsWithRollups = useRollupComputation(processedRows, columns, nodes, edges);

  // ── Persistence hook ────────────────────────────────────────────────────────
  const { loading, saving, handleSave } = useTablePersistence({
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
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(true);
  const [showSummaryDashboard, setShowSummaryDashboard] = useState(false);
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
  const [colContextMenu, setColContextMenu] = useState<{
    colKey: string;
    x: number;
    y: number;
  } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

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

  // ── Smart suggestion apply ────────────────────────────────────────────────
  const handleApplySuggestion = useCallback(
    (suggestion: SmartSuggestion) => {
      const payload = suggestion.action?.payload;
      if (!payload) return;
      if (payload.type === 'switch_view') setViewLayout(payload.view);
      if (payload.type === 'add_column' && payload.columnType) {
        const col: ColumnDef = {
          key: `col_${Date.now()}`,
          header:
            payload.columnType === 'rating' ? (isPl ? 'Ocena' : 'Rating') : payload.columnType,
          type: payload.columnType,
          visible: true,
          width: 120,
        };
        setColumns((prev) => [...prev, col]);
      }
      trackFunnelEvent('ideas_table_suggestion_applied', { type: suggestion.type, ideaId });
    },
    [ideaId, isPl]
  );

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
    return computeHeatmapStyles(nodes, columns, heatmapColumns, heatmapPalette);
  }, [columns, heatmapColumns, heatmapPalette, nodes]);

  // ── Cell expand ───────────────────────────────────────────────────────────
  const handleCellExpand = useCallback((nodeId: string, colKey: string, rect: DOMRect) => {
    setCellExpandState({ nodeId, colKey, rect });
  }, []);

  const cellExpandNode = cellExpandState
    ? nodes.find((n) => n.id === cellExpandState.nodeId)
    : null;
  const cellExpandCol = cellExpandState
    ? columns.find((c) => c.key === cellExpandState.colKey)
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
          created_by: 'current-user',
          last_edited_time: now,
          last_edited_by: 'current-user',
        },
        position: { x: 0, y: 0 },
      };
      nodesUndo.push([...nodes, newNode]);
      trackFunnelEvent('ideas_table_row_added', { ideaId });
    },
    [columns, ideaId, locked, nodes, nodesUndo]
  );

  // ── "/" key for AI assistant ───────────────────────────────────────────────
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

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useTableKeyboard({
    rowCount: processedRowsWithRollups.length,
    colCount: visibleColumns.length,
    onUndo: nodesUndo.undo,
    onRedo: nodesUndo.redo,
    onDelete: handleBulkDelete,
    onEscape: () => {
      setDetailNodeId(null);
      setSelectedRowIds(new Set());
      onSelectionChange?.(EMPTY_SELECTION);
      setShowKeyboardShortcuts(false);
    },
    onSave: handleSave,
    onAddRow: handleAddRow,
    onOpenAI: () => setShowAIAssistant(true),
    onShowShortcuts: () => setShowKeyboardShortcuts(true),
    onSwitchView: (v) => setViewLayout(v as any),
    onToggleFilters: () => setShowFilterPanel((p) => !p),
    onToggleSummary: () => setShowSummaryDashboard((p) => !p),
    containerRef: tableRef,
  });

  const detailNode = useMemo(
    () => (detailNodeId ? nodes.find((n) => n.id === detailNodeId) || null : null),
    [detailNodeId, nodes]
  );

  if (!open) return null;

  // ── Render row ─────────────────────────────────────────────────────────────
  const renderRow = (row: TableNode, rowIdx: number) => {
    const isSelected = selectedRowIds.has(row.id);
    const rowColor = row.data?.color;
    return (
      <tr
        key={row.id}
        data-node-id={row.id}
        className={`border-b border-slate-200/30 dark:border-white/[0.04] cursor-pointer transition-colors group/row ${
          isSelected
            ? 'bg-primary-500/5'
            : detailNodeId === row.id
              ? 'bg-violet-500/5'
              : selectedNodeForLines === row.id
                ? 'bg-indigo-500/5'
                : 'hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'
        }`}
        style={rowColor ? { borderLeftWidth: 3, borderLeftColor: rowColor } : undefined}
        onClick={() => setSelectedNodeForLines(selectedNodeForLines === row.id ? null : row.id)}
        onDoubleClick={() => {
          setDetailNodeId(row.id);
          setDetailMode('full');
        }}
      >
        <td className="w-8 px-2 py-1.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleRowSelection(row.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 rounded border-slate-300 dark:border-navy-600 text-primary-500 focus:ring-primary-500/30"
          />
        </td>
        {visibleColumns.map((col, colIdx) => {
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
              className="px-2 py-1.5 relative group/cell"
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
                      onChange={(val) => handleFieldChange(row.id, col.key, val)}
                      locked={locked}
                      allNodes={nodes.map((n) => ({ id: n.id, label: n.data?.label }))}
                    />
                  )}
                </div>
                {col.key !== 'type' &&
                  !locked &&
                  (row?.data?.[col.key] == null || row.data[col.key] === '') && (
                    <InlineAIFill
                      node={row}
                      column={col}
                      ideaId={ideaId}
                      onFill={handleFieldChange}
                    />
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
                    <Maximize2 size={9} className="text-slate-400" />
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
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200/60 dark:border-navy-700/60 bg-slate-50/80 dark:bg-navy-900/80 flex-shrink-0">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mr-2">
            {isPl ? 'Tabela' : 'Table'}
          </div>

          {/* Collaboration Presence */}
          <CollaborationPresence
            ideaId={ideaId}
            currentUserId="current-user"
            currentUserName="Me"
            enabled={true}
            onPresenceUpdate={setRemotePresenceUsers}
          />

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
                      if (renamingViewName.trim()) updateSavedView(v.id, { name: renamingViewName.trim() });
                      setRenamingViewId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (renamingViewName.trim()) updateSavedView(v.id, { name: renamingViewName.trim() });
                        setRenamingViewId(null);
                      } else if (e.key === 'Escape') {
                        setRenamingViewId(null);
                      }
                    }}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-navy-800 border border-primary-400 outline-none w-20"
                  />
                ) : (
                  <button
                    onClick={() => applyView(v)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (v.id !== 'default') setViewContextMenu({ viewId: v.id, x: e.clientX, y: e.clientY });
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                      activeViewId === v.id
                        ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    {v.name}
                  </button>
                )}
              </div>
            ))}
            {!locked && (
              <button
                onClick={() => { setSaveViewName(''); setShowSaveViewDialog(true); }}
                className="p-1 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-primary-500/10 transition-colors"
                title={isPl ? 'Zapisz widok' : 'Save view'}
              >
                <Plus size={12} />
              </button>
            )}
          </div>

          {/* Save view dialog */}
          {showSaveViewDialog && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20" onClick={() => setShowSaveViewDialog(false)}>
              <div className="bg-white dark:bg-navy-900 rounded-xl shadow-xl border border-slate-200 dark:border-navy-700 p-4 w-72" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-sm font-semibold mb-2 text-slate-800 dark:text-slate-200">{isPl ? 'Zapisz widok' : 'Save view'}</h3>
                <input
                  autoFocus
                  value={saveViewName}
                  onChange={(e) => setSaveViewName(e.target.value)}
                  placeholder={isPl ? 'Nazwa widoku…' : 'View name…'}
                  className="w-full h-8 px-3 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 outline-none focus:ring-2 focus:ring-primary-500/30 mb-3"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && saveViewName.trim()) {
                      saveCurrentView(saveViewName.trim(), columns);
                      setShowSaveViewDialog(false);
                    }
                  }}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowSaveViewDialog(false)} className="px-3 py-1.5 text-xs rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800">{isPl ? 'Anuluj' : 'Cancel'}</button>
                  <button
                    disabled={!saveViewName.trim()}
                    onClick={() => { saveCurrentView(saveViewName.trim(), columns); setShowSaveViewDialog(false); }}
                    className="px-3 py-1.5 text-xs rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40"
                  >{isPl ? 'Zapisz' : 'Save'}</button>
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
                    if (v) { setRenamingViewId(v.id); setRenamingViewName(v.name); }
                    setViewContextMenu(null);
                  }}
                >{isPl ? 'Zmień nazwę' : 'Rename'}</button>
                <button
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
                  onClick={() => {
                    updateSavedView(viewContextMenu.viewId, {
                      sort: sort ? [sort] : undefined,
                      filters,
                      groupBy: groupBy ?? undefined,
                      layout: viewLayout,
                      columns: columns.map((c) => ({ key: c.key, visible: c.visible !== false, width: c.width })),
                    });
                    toast.success(isPl ? 'Widok zaktualizowany' : 'View updated');
                    setViewContextMenu(null);
                  }}
                >{isPl ? 'Aktualizuj' : 'Update'}</button>
                <button
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
                  onClick={() => {
                    deleteSavedView(viewContextMenu.viewId);
                    toast.success(isPl ? 'Widok usunięty' : 'View deleted');
                    setViewContextMenu(null);
                  }}
                >{isPl ? 'Usuń' : 'Delete'}</button>
              </div>
            </div>
          )}

          <div className="w-px h-5 bg-slate-200 dark:bg-navy-700" />

          {/* Quick filter */}
          <div className="relative flex-1 max-w-[200px]">
            <Filter size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              placeholder={isPl ? 'Filtruj…' : 'Filter…'}
              className="w-full h-7 pl-7 pr-2 rounded-lg text-[11px] bg-white dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary-500/30"
            />
            {filterInput && (
              <button
                onClick={() => setFilterInput('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                filters.rules.length > 0
                  ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
              }`}
            >
              <Filter size={12} />
              {filters.rules.length > 0 && (
                <span className="text-[9px]">({filters.rules.length})</span>
              )}
            </button>
            <FilterPanel
              open={showFilterPanel}
              onClose={() => setShowFilterPanel(false)}
              filters={filters}
              onChange={setFilters}
              columns={visibleColumns}
            />
          </div>

          {/* Group by */}
          <button
            onClick={() => setGroupBy(groupBy ? null : 'status')}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
              groupBy
                ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
            }`}
            title={isPl ? 'Grupuj' : 'Group'}
          >
            <Group size={12} />
            {isPl ? 'Grupuj' : 'Group'}
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
                onClick={() => setViewLayout(v.id)}
                className={`relative p-1.5 transition-colors ${viewLayout === v.id ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                title={v.label}
              >
                <v.icon size={12} />
                {viewLayout === v.id && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-primary-500" />
                )}
              </button>
            ))}
          </div>

          {/* AI Assistant */}
          <button
            onClick={() => setShowAIAssistant(true)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors"
            title={isPl ? 'Asystent AI (/)' : 'AI Assistant (/)'}
          >
            <Sparkles size={12} />
          </button>

          {/* Batch AI Fill */}
          {!locked && (
            <BatchAIFillButton
              nodes={processedRowsWithRollups}
              columns={columns}
              ideaId={ideaId}
              onFill={handleFieldChange}
              selectedIds={selectedRowIds}
            />
          )}

          {/* AI Categorize */}
          {!locked && (
            <button
              onClick={() => setShowAICategorize(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title={isPl ? 'AI Kategoryzacja' : 'AI Categorize'}
            >
              <Layers size={12} />
            </button>
          )}

          {/* Scoring Model */}
          <button
            onClick={() => setShowScoringModel(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title={isPl ? 'Model scoringowy' : 'Scoring Model'}
          >
            <Trophy size={12} />
          </button>

          {/* Export to Presentation */}
          <button
            onClick={() => setShowExportPresentation(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title={isPl ? 'Eksport do prezentacji' : 'Export to Presentation'}
          >
            <Presentation size={12} />
          </button>

          {/* Pipeline */}
          <button
            onClick={() => setShowPipeline(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title={isPl ? 'Pipeline pomysłów' : 'Idea Pipeline'}
          >
            <Rocket size={12} />
          </button>

          {/* AI Copilot */}
          <button
            onClick={() => setShowCopilot(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title={isPl ? 'AI Copilot' : 'AI Copilot'}
          >
            <Brain size={12} />
          </button>

          {/* Voice / Image Input */}
          <button
            onClick={() => setShowVoiceInput(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title={isPl ? 'Głos / Obraz' : 'Voice / Image'}
          >
            <Mic size={12} />
          </button>

          {/* Cross-table Relations */}
          <button
            onClick={() => setShowCrossRelations(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title={isPl ? 'Relacje między tabelami' : 'Cross-table Relations'}
          >
            <Network size={12} />
          </button>

          {/* Heatmap */}
          <div className="relative">
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`p-1.5 rounded-lg transition-colors ${heatmapColumns.size > 0 ? 'text-amber-500 bg-amber-500/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              title={isPl ? 'Heatmapa' : 'Heatmap'}
            >
              <Flame size={12} />
            </button>
            <HeatmapControls
              open={showHeatmap}
              onClose={() => setShowHeatmap(false)}
              columns={columns}
              enabledColumns={heatmapColumns}
              onToggleColumn={toggleHeatmapColumn}
              palette={heatmapPalette}
              onPaletteChange={setHeatmapPalette}
            />
          </div>

          {/* Keyboard shortcuts */}
          <button
            onClick={() => setShowKeyboardShortcuts(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title={isPl ? 'Skróty klawiszowe (?)' : 'Keyboard shortcuts (?)'}
          >
            <Keyboard size={12} />
          </button>

          {/* Framework generator */}
          {!locked && (
            <button
              onClick={() => setShowFrameworkGen(true)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              title={isPl ? 'Generator frameworków' : 'Framework Generator'}
            >
              <LayoutGrid size={12} />
              {isPl ? 'Framework' : 'Framework'}
            </button>
          )}

          {/* Conditional formatting */}
          <button
            onClick={() => setShowConditionalFmt(true)}
            className={`p-1.5 rounded-lg transition-colors ${formatRules.length > 0 ? 'text-violet-600 dark:text-violet-400 bg-violet-500/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            title={isPl ? 'Formatowanie warunkowe' : 'Conditional Formatting'}
          >
            <Paintbrush size={12} />
          </button>

          {/* Color palette */}
          <div className="relative">
            <button
              onClick={() => setShowColorPalette(!showColorPalette)}
              className={`p-1.5 rounded-lg transition-colors ${showColorPalette ? 'text-violet-600 dark:text-violet-400 bg-violet-500/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
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

          {/* Summary dashboard */}
          <button
            onClick={() => setShowSummaryDashboard(!showSummaryDashboard)}
            className={`p-1.5 rounded-lg transition-colors ${showSummaryDashboard ? 'text-violet-600 dark:text-violet-400 bg-violet-500/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            title={isPl ? 'Podsumowanie' : 'Summary'}
          >
            <BarChart3 size={12} />
          </button>

          {/* CSV import/export */}
          <div className="flex items-center gap-0.5">
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
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                title={isPl ? 'Importuj CSV' : 'Import CSV'}
              >
                <Upload size={12} />
              </button>
            )}
            <button
              onClick={() => {
                const csv = exportToCSV(columns, nodes);
                downloadCSV(csv, `idea-${ideaId}.csv`);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title={isPl ? 'Eksportuj CSV' : 'Export CSV'}
            >
              <Download size={12} />
            </button>
            <button
              onClick={() => {
                copyTableToClipboard(columns, nodes);
                toast.success(isPl ? 'Skopiowano' : 'Copied');
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
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
                {columns.map((col) => (
                  <button
                    key={col.key}
                    onClick={() => toggleColumn(col.key)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                  >
                    {col.visible ? (
                      <Eye size={12} className="text-primary-500" />
                    ) : (
                      <EyeOff size={12} className="text-slate-400" />
                    )}
                    {col.header}
                    <span className="ml-auto text-[9px] text-slate-400">{col.type}</span>
                  </button>
                ))}
                <div className="border-t border-slate-200/60 dark:border-navy-700/60 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setShowColumnConfig(false);
                      setShowAddColumn(true);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors"
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
              onClick={nodesUndo.undo}
              disabled={!nodesUndo.canUndo}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={13} />
            </button>
            <button
              onClick={nodesUndo.redo}
              disabled={!nodesUndo.canRedo}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={13} />
            </button>
          </div>

          <div className="flex-1" />

          {/* Bulk actions */}
          {selectedRowIds.size > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-lg">
                {selectedRowIds.size} {isPl ? 'zaznaczonych' : 'selected'}
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
                            → {t === 'initiative' ? (isPl ? 'Inicjatywa' : 'Initiative') : t === 'task' ? (isPl ? 'Zadanie' : 'Task') : (isPl ? 'Decyzja' : 'Decision')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleBulkDelete}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-red-600 bg-red-500/10 hover:bg-red-500/20 transition-colors"
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
                onClick={handleAddRow}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                title={isPl ? 'Dodaj pusty wiersz' : 'Add blank row'}
              >
                <Plus size={12} />
                {isPl ? 'Wiersz' : 'Row'}
              </button>
              <button
                onClick={handleAddRowWithTemplate}
                className="px-1 py-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors border-l border-slate-200/60 dark:border-navy-700/60"
                title={isPl ? 'Dodaj z szablonu' : 'Add from template'}
              >
                <ChevronDown size={10} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || locked}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              saving || loading || locked
                ? 'bg-slate-200/60 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
                : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? (isPl ? 'Zapisuję…' : 'Saving…') : isPl ? 'Zapisz' : 'Save'}
          </button>
        </div>

        {/* AI Table Assistant overlay */}
        <AITableAssistant
          open={showAIAssistant}
          onClose={() => setShowAIAssistant(false)}
          ideaId={ideaId}
          columns={columns}
          artifactContext={nodes
            .filter((n) => n.data?.label)
            .slice(0, 20)
            .map((n) => ({
              id: n.id,
              type: String(n.type || 'idea'),
              title: String(n.data?.label || ''),
              snippet: String(n.data?.description || n.data?.bodyMarkdown || '').slice(0, 200),
            }))}
          onSort={(s) => setSort(s)}
          onFilter={(f) => setFilters(f)}
          onGroup={(g) => setGroupBy(g)}
          onAddColumn={handleAddColumn}
          onAddRows={handleAIAddRows}
          onProposal={(p) => {
            setAiProposal(p);
            setShowAIAssistant(false);
          }}
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

        {/* Content area */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-slate-400" size={24} />
          </div>
        ) : viewLayout === 'timeline' ? (
          <TimelineView
            nodes={processedRowsWithRollups}
            edges={edges}
            columns={columns}
            locked={locked}
            onFieldChange={handleFieldChange}
            onNodeClick={(id) => setDetailNodeId(id)}
          />
        ) : viewLayout === 'sticky' ? (
          <StickyNoteView
            nodes={processedRowsWithRollups}
            columns={columns}
            onNodeClick={(id) => setDetailNodeId(id)}
            onReorder={handleReorderNode}
            onFieldChange={handleFieldChange}
            groupBy={groupBy}
          />
        ) : viewLayout === 'kanban' ? (
          <KanbanView
            nodes={processedRowsWithRollups}
            groupByColumn={
              columns.find(
                (c) =>
                  c.key === (groupBy || 'status') &&
                  (c.type === 'select' || c.type === 'multiselect' || c.type === 'status')
              ) ||
              columns.find((c) => c.type === 'status' || c.type === 'select') ||
              columns[0]
            }
            columns={columns}
            locked={locked}
            onFieldChange={handleFieldChange}
            onAddRow={handleAddRow}
            onNodeClick={(id) => setDetailNodeId(id)}
          />
        ) : viewLayout === 'calendar' ? (
          <CalendarView
            rows={processedRowsWithRollups}
            columns={columns}
            locked={locked}
            onNodeClick={(id) => setDetailNodeId(id)}
            onFieldChange={handleFieldChange}
            onAddEventAtDate={handleAddEventAtDate}
          />
        ) : viewLayout === 'grid' ? (
          <GridView
            rows={processedRowsWithRollups}
            columns={columns}
            onNodeClick={(id) => setDetailNodeId(id)}
          />
        ) : viewLayout === 'matrix' ? (
          <MatrixView
            nodes={processedRowsWithRollups}
            columns={columns}
            xAxis={
              (matrixAxisXKey && columns.find((c) => c.key === matrixAxisXKey)) ||
              columns.find(
                (c) => c.key === 'impact' && (c.type === 'number' || c.type === 'rating')
              ) ||
              columns.find((c) => c.type === 'rating') ||
              columns[0]!
            }
            yAxis={
              (matrixAxisYKey && columns.find((c) => c.key === matrixAxisYKey)) ||
              columns.find(
                (c) => c.key === 'effort' && (c.type === 'number' || c.type === 'rating')
              ) ||
              columns.filter((c) => c.type === 'rating')[1] ||
              columns[1] ||
              columns[0]!
            }
            locked={locked}
            onNodeClick={(id) => setDetailNodeId(id)}
            onFieldChange={handleFieldChange}
            onAxisChange={(axis, col) => {
              if (axis === 'x') setMatrixAxisXKey(col.key);
              else setMatrixAxisYKey(col.key);
            }}
          />
        ) : (
          <div ref={tableContainerRef} className="flex-1 overflow-auto relative">
            <ConnectionLines
              selectedNodeId={selectedNodeForLines}
              edges={edges}
              allNodes={nodes}
              containerRef={tableContainerRef}
            />
            <table
              className="w-full text-left"
              style={{ minWidth: visibleColumns.reduce((s, c) => s + c.width, 40) }}
            >
              <thead className="sticky top-0 bg-slate-50/95 dark:bg-navy-900/95 backdrop-blur-sm border-b border-slate-200/60 dark:border-navy-700/60 z-10">
                <tr>
                  <th className="w-8 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={
                        selectedRowIds.size === processedRowsWithRollups.length && processedRowsWithRollups.length > 0
                      }
                      onChange={() => {
                        if (selectedRowIds.size === processedRowsWithRollups.length) {
                          setSelectedRowIds(new Set());
                          onSelectionChange?.(EMPTY_SELECTION);
                        } else {
                          const all = new Set(processedRowsWithRollups.map((r) => r.id));
                          setSelectedRowIds(all);
                          onSelectionChange?.({
                            type: 'row',
                            count: all.size,
                            ids: Array.from(all),
                          });
                        }
                      }}
                      className="w-3.5 h-3.5 rounded border-slate-300 dark:border-navy-600 text-primary-500 focus:ring-primary-500/30"
                    />
                  </th>
                  {visibleColumns.map((col) => (
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
                          className="w-full bg-white dark:bg-navy-800 border border-primary-500/40 rounded px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 outline-none"
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
                          onClick={() => cycleSort(col.key)}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (!locked) setEditingHeaderKey(col.key);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (!locked) setColContextMenu({ colKey: col.key, x: e.clientX, y: e.clientY });
                          }}
                        >
                          <GripVertical
                            size={10}
                            className="opacity-0 group-hover:opacity-40 cursor-grab"
                          />
                          {col.header}
                          {sort?.key === col.key ? (
                            sort.direction === 'asc' ? (
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
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-violet-500/30 transition-colors"
                        onMouseDown={(e) => handleResizeStart(col.key, e)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupedRows ? (
                  Object.entries(groupedRows).map(([groupKey, rows]) => (
                    <React.Fragment key={groupKey}>
                      <tr className="bg-slate-100/50 dark:bg-navy-800/50">
                        <td
                          colSpan={visibleColumns.length + 1}
                          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                        >
                          {groupKey} ({rows.length})
                        </td>
                      </tr>
                      {rows.map((row, idx) => renderRow(row, idx))}
                    </React.Fragment>
                  ))
                ) : processedRowsWithRollups.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 1} className="px-4 py-12 text-center">
                      <div className="mx-auto max-w-xl text-slate-400 dark:text-slate-500">
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
                              onClick={handleAddRow}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-colors"
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
                visibleColumns.some((c) => c.aggregation && c.aggregation !== 'none') && (
                  <tfoot className="border-t-2 border-slate-200/60 dark:border-navy-700/60">
                    <tr className="bg-slate-50/50 dark:bg-navy-900/50">
                      <td className="px-2 py-1.5" />
                      {visibleColumns.map((col) => {
                        const agg = col.aggregation;
                        if (!agg || agg === 'none')
                          return <td key={col.key} className="px-2 py-1.5" />;
                        const values = processedRowsWithRollups.map((r) => r.data?.[col.key]);
                        return (
                          <td
                            key={col.key}
                            className="px-2 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 tabular-nums"
                          >
                            <span className="text-[8px] text-slate-400 uppercase mr-1">{agg}</span>
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
      </div>

      {/* Analytics Summary Strip */}
      <AnalyticsSummaryStrip
        nodes={processedRowsWithRollups}
        columns={columns}
        visible={processedRowsWithRollups.length > 0}
      />

      {/* Smart Suggestions Bar */}
      <SmartSuggestionsBar
        nodes={processedRowsWithRollups}
        columns={columns}
        visible={showSmartSuggestions && processedRowsWithRollups.length > 0}
        onDismiss={() => setShowSmartSuggestions(false)}
        onApplySuggestion={handleApplySuggestion}
        ideaId={ideaId}
      />

      {/* Table Summary Dashboard */}
      <TableSummaryDashboard
        open={showSummaryDashboard}
        onClose={() => setShowSummaryDashboard(false)}
        nodes={processedRowsWithRollups}
        columns={columns}
        ideaId={ideaId}
      />

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
              onClick={() => { setEditingHeaderKey(colContextMenu.colKey); setColContextMenu(null); }}
            >{isPl ? 'Zmień nazwę' : 'Rename'}</button>
            <button
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
              onClick={() => { cycleSort(colContextMenu.colKey); setColContextMenu(null); }}
            >{isPl ? 'Sortuj' : 'Sort'}</button>
            <button
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300"
              onClick={() => { toggleColumn(colContextMenu.colKey); setColContextMenu(null); }}
            >{isPl ? 'Ukryj kolumnę' : 'Hide column'}</button>
            <div className="h-px bg-slate-200 dark:bg-navy-700 my-1" />
            <button
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
              onClick={() => {
                deleteColumn(colContextMenu.colKey);
                toast.success(isPl ? 'Kolumna usunięta' : 'Column deleted');
                setColContextMenu(null);
              }}
            >{isPl ? 'Usuń kolumnę' : 'Delete column'}</button>
          </div>
        </div>
      )}

      {/* Row Detail Panel */}
      <RowDetailPanel
        open={!!detailNodeId}
        onClose={() => setDetailNodeId(null)}
        node={detailNode}
        columns={visibleColumns}
        edges={edges}
        allNodes={nodes}
        locked={locked}
        mode={detailMode}
        onExpand={() => setDetailMode('full')}
        onFieldChange={handleFieldChange}
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
      />

      {/* Add Column Dialog */}
      <AddColumnDialog
        open={showAddColumn}
        onClose={() => setShowAddColumn(false)}
        onAdd={handleAddColumn}
        existingKeys={columns.map((c) => c.key)}
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
        columns={columns}
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
              handleFieldChange(cellExpandNode.id, val._noteUpdate.key, val._noteUpdate.value);
            } else if (val && typeof val === 'object' && val._optionsUpdate) {
              setColumns((prev) =>
                prev.map((c) =>
                  c.key === cellExpandCol.key ? { ...c, options: val._optionsUpdate } : c
                )
              );
            } else {
              handleFieldChange(cellExpandNode.id, cellExpandCol.key, val);
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
        columns={columns}
        ideaId={ideaId}
        onApplyScores={handleApplyScores}
      />

      {/* Export to Presentation */}
      <ExportToPresentation
        open={showExportPresentation}
        onClose={() => setShowExportPresentation(false)}
        nodes={processedRowsWithRollups}
        columns={columns}
        ideaTitle={extensions?.title ? String(extensions.title) : isPl ? 'Pomysły' : 'Ideas'}
        viewLayout={viewLayout}
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
    </div>
  );
};

export default IdeaTableTool;
