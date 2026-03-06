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
  GripVertical,
  Group,
  Keyboard,
  KanbanSquare,
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
  Users,
  Wand2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { EMPTY_SELECTION, type CanvasToolType, type IdeaWorkspaceSelection } from './ideaSelectionTypes';
import { AddColumnDialog } from './table/AddColumnDialog';
import { AITableAssistant } from './table/AITableAssistant';
import { CellExpandPopover } from './table/CellExpandPopover';
import { CellRenderer } from './table/CellRenderer';
import { ColorPalette, autoAssignColors } from './table/ColorPalette';
import { ConditionalFormatting, getConditionalStyle, type FormatRule } from './table/ConditionalFormatting';
import { ConnectionLines } from './table/ConnectionLines';
import { copyTableToClipboard, csvToNodes, downloadCSV, exportToCSV, parseCSV } from './table/csvUtils';
import { FilterPanel } from './table/FilterPanel';
import { FrameworkGenerator } from './table/FrameworkGenerator';
import { KanbanView } from './table/KanbanView';
import { MatrixView } from './table/MatrixView';
import { RowDetailPanel } from './table/RowDetailPanel';
import { InlineAIFill, BatchAIFillButton } from './table/InlineAIFill';
import { KeyboardShortcutsPanel } from './table/KeyboardShortcutsPanel';
import { RowTemplatePicker, createNodeFromTemplate, type RowTemplate } from './table/RowTemplatePicker';
import { SmartSuggestionsBar, type SmartSuggestion } from './table/SmartSuggestionsBar';
import { StickyNoteView } from './table/StickyNoteView';
import { TableSummaryDashboard } from './table/TableSummaryDashboard';
import { TimelineView } from './table/TimelineView';
import { AICategorizeTool } from './table/AICategorizeTool';
import { IdeaScoringModel } from './table/IdeaScoringModel';
import { ExportToPresentation } from './table/ExportToPresentation';
import { batchEvaluateFormulas } from './table/FormulaEngineV2';
import { CollaborationPresence, CellCursor, type PresenceUser } from './table/CollaborationPresence';
import { IdeaPipeline } from './table/IdeaPipeline';
import { AICopilotMode } from './table/AICopilotMode';
import { VoiceImageInput } from './table/VoiceImageInput';
import { CrossTableRelations } from './table/CrossTableRelations';
import { AnalyticsSummaryStrip, HeatmapControls, computeHeatmapStyles } from './table/EmbeddedAnalytics';
import { useTableKeyboard } from './table/useTableKeyboard';
import { useUndoRedo } from './table/useUndoRedo';
import type {
  ColumnDef,
  FilterGroup,
  SavedView,
  SortConfig,
  TableEdge,
  TableNode,
} from './table/tableTypes';
import {
  computeAggregation,
  DEFAULT_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
} from './table/tableTypes';

interface IdeaTableToolProps {
  open: boolean;
  ideaId: string;
  locked?: boolean;
  refreshToken?: number;
  onSaved?: () => void;
  onSelectionChange?: (sel: IdeaWorkspaceSelection) => void;
  onConvert?: (target: string) => void;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'type', header: 'Type', type: 'text', visible: true, width: 100 },
  { key: 'label', header: 'Label', type: 'text', visible: true, width: 240 },
  { key: 'status', header: 'Status', type: 'select', visible: true, width: 120, options: ['To Do', 'In Progress', 'Done', 'Blocked'], optionColors: { 'To Do': '#e0e7ff', 'In Progress': '#fef3c7', Done: '#d1fae5', Blocked: '#fee2e2' } },
  { key: 'priority', header: 'Priority', type: 'select', visible: true, width: 110, options: ['Low', 'Medium', 'High', 'Critical'], optionColors: { Low: '#d1fae5', Medium: '#fef3c7', High: '#fce7f3', Critical: '#fee2e2' } },
  { key: 'owner', header: 'Owner', type: 'person', visible: false, width: 140 },
  { key: 'impact', header: 'Impact', type: 'rating', visible: false, width: 120 },
  { key: 'effort', header: 'Effort', type: 'rating', visible: false, width: 120 },
];

export const IdeaTableTool: React.FC<IdeaTableToolProps> = ({
  open,
  ideaId,
  locked = false,
  refreshToken,
  onSaved,
  onSelectionChange,
  onConvert: onConvertProp,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edges, setEdges] = useState<TableEdge[]>([]);
  const [extensions, setExtensions] = useState<Record<string, unknown>>({});

  const nodesUndo = useUndoRedo<TableNode[]>([]);
  const nodes = nodesUndo.state;

  const [sort, setSort] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<FilterGroup>({ logic: 'and', rules: [] });
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showFrameworkGen, setShowFrameworkGen] = useState(false);
  const [showConditionalFmt, setShowConditionalFmt] = useState(false);
  const [formatRules, setFormatRules] = useState<FormatRule[]>([]);
  const [viewLayout, setViewLayout] = useState<'table' | 'kanban' | 'matrix' | 'sticky' | 'timeline'>('table');
  const [filterInput, setFilterInput] = useState('');
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [activePalette, setActivePalette] = useState('vibrant');
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(true);
  const [showSummaryDashboard, setShowSummaryDashboard] = useState(false);
  const [cellExpandState, setCellExpandState] = useState<{ nodeId: string; colKey: string; rect: DOMRect } | null>(null);
  const [selectedNodeForLines, setSelectedNodeForLines] = useState<string | null>(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showRowTemplatePicker, setShowRowTemplatePicker] = useState(false);
  const [addRowBtnRect, setAddRowBtnRect] = useState<DOMRect | null>(null);
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
  const csvInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const [columns, setColumns] = useState<ColumnDef[]>(
    DEFAULT_COLUMNS.map((c) => ({
      ...c,
      header: isPl && c.key === 'type' ? 'Typ' : isPl && c.key === 'label' ? 'Etykieta' : isPl && c.key === 'priority' ? 'Priorytet' : isPl && c.key === 'owner' ? 'Właściciel' : isPl && c.key === 'impact' ? 'Wpływ' : isPl && c.key === 'effort' ? 'Wysiłek' : c.header,
    }))
  );

  const [savedViews, setSavedViews] = useState<SavedView[]>([
    { id: 'default', name: isPl ? 'Domyślny' : 'Default' },
  ]);
  const [activeViewId, setActiveViewId] = useState('default');

  const tableRef = useRef<HTMLDivElement>(null);
  const didPersistPreferredRef = useRef(false);

  // ── Column resize state ────────────────────────────────────────────────────
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);

  const handleResizeStart = useCallback((colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(colKey);
    resizeStartXRef.current = e.clientX;
    const col = columns.find((c) => c.key === colKey);
    resizeStartWidthRef.current = col?.width || DEFAULT_COLUMN_WIDTH;
  }, [columns]);

  useEffect(() => {
    if (!resizingCol) return;
    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartXRef.current;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, resizeStartWidthRef.current + delta));
      setColumns((prev) => prev.map((c) => (c.key === resizingCol ? { ...c, width: newWidth } : c)));
    };
    const handleUp = () => setResizingCol(null);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [resizingCol]);

  // ── Column reorder via DnD ─────────────────────────────────────────────────
  const [dragColKey, setDragColKey] = useState<string | null>(null);

  const handleColDragStart = useCallback((key: string) => setDragColKey(key), []);
  const handleColDragOver = useCallback((e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    if (!dragColKey || dragColKey === targetKey) return;
    setColumns((prev) => {
      const fromIdx = prev.findIndex((c) => c.key === dragColKey);
      const toIdx = prev.findIndex((c) => c.key === targetKey);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, [dragColKey]);
  const handleColDragEnd = useCallback(() => setDragColKey(null), []);

  // ── Quick action listener ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.action === 'tbl_add_column') setShowAddColumn(true);
      if (detail?.action === 'tbl_sort') {
        setSort((prev) => prev ? { ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key: 'label', direction: 'asc' });
        trackFunnelEvent('ideas_table_sort_applied', { ideaId });
      }
      if (detail?.action === 'tbl_filter') {
        setShowFilterPanel(true);
        trackFunnelEvent('ideas_table_filter_applied', { ideaId });
      }
      if (detail?.action === 'tbl_ai_assistant') setShowAIAssistant(true);
      if (detail?.action === 'tbl_framework') setShowFrameworkGen(true);
      if (detail?.action === 'tbl_kanban') setViewLayout('kanban');
      if (detail?.action === 'tbl_matrix') setViewLayout('matrix');
      if (detail?.action === 'tbl_export_csv') {
        const csv = exportToCSV(columns, nodes);
        downloadCSV(csv, `idea-${ideaId}.csv`);
      }
      if (detail?.action === 'tbl_sticky') setViewLayout('sticky');
      if (detail?.action === 'tbl_timeline') setViewLayout('timeline');
      if (detail?.action === 'tbl_summary') setShowSummaryDashboard(true);
      if (detail?.action === 'tbl_color_palette') setShowColorPalette(true);
      if (detail?.action === 'tbl_categorize') setShowAICategorize(true);
      if (detail?.action === 'tbl_scoring') setShowScoringModel(true);
      if (detail?.action === 'tbl_export_pptx') setShowExportPresentation(true);
      if (detail?.action === 'tbl_pipeline') setShowPipeline(true);
      if (detail?.action === 'tbl_copilot') setShowCopilot(true);
      if (detail?.action === 'tbl_voice') setShowVoiceInput(true);
      if (detail?.action === 'tbl_cross_relations') setShowCrossRelations(true);
      if (detail?.action === 'tbl_heatmap') setShowHeatmap(true);
    };
    window.addEventListener('idea-workspace-quick-action', handler);
    return () => window.removeEventListener('idea-workspace-quick-action', handler);
  }, [ideaId]);

  // ── Hydrate ────────────────────────────────────────────────────────────────
  const hydrate = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await Api.getMyIdeaMap(ideaId, { language: i18n.language });
      const map = res?.map || {};
      const nextNodes = Array.isArray(map.nodes) ? (map.nodes as any[]) : [];
      const nextEdges = Array.isArray(map.edges) ? (map.edges as any[]) : [];
      const nextExtensions =
        map?.extensions && typeof map.extensions === 'object' && !Array.isArray(map.extensions)
          ? (map.extensions as Record<string, unknown>)
          : {};

      const parsedNodes: TableNode[] = nextNodes
        .map((n: any) => ({
          id: String(n?.id || ''),
          type: n?.type ? String(n.type) : undefined,
          data: n?.data && typeof n.data === 'object' ? n.data : {},
          position: n?.position || undefined,
        }))
        .filter((n) => n.id);

      const parsedEdges: TableEdge[] = nextEdges
        .map((e: any) => ({
          id: String(e?.id || ''),
          source: String(e?.source || ''),
          target: String(e?.target || ''),
          type: e?.type ? String(e.type) : undefined,
          data: e?.data && typeof e.data === 'object' ? e.data : {},
        }))
        .filter((e) => e.id && e.source && e.target);

      nodesUndo.set(parsedNodes);
      setEdges(parsedEdges);
      setExtensions(nextExtensions);

      const tblExt = (nextExtensions?.table || {}) as Record<string, unknown>;
      if (Array.isArray(tblExt?.views)) setSavedViews(tblExt.views as SavedView[]);
      if (tblExt?.activeViewId) setActiveViewId(String(tblExt.activeViewId));
      if (Array.isArray(tblExt?.formatting)) setFormatRules(tblExt.formatting as FormatRule[]);
      if (tblExt?.viewLayout && ['table', 'kanban', 'matrix', 'sticky', 'timeline'].includes(String(tblExt.viewLayout))) {
        setViewLayout(tblExt.viewLayout as 'table' | 'kanban' | 'matrix' | 'sticky' | 'timeline');
      }
      if (Array.isArray(tblExt?.columns)) {
        const saved = tblExt.columns as ColumnDef[];
        setColumns((prev) => {
          const savedMap = new Map(saved.map((s) => [s.key, s]));
          const merged = prev.map((col) => {
            const match = savedMap.get(col.key);
            return match ? { ...col, ...match } : col;
          });
          const newCols = saved.filter((s) => !prev.some((p) => p.key === s.key));
          return [...merged, ...newCols];
        });
      }

      if (!didPersistPreferredRef.current) {
        didPersistPreferredRef.current = true;
        const preferred = map?.preferredTool ? String(map.preferredTool) : null;
        if (preferred !== 'table') {
          Api.saveMyIdeaMap(ideaId, {
            nodes: nextNodes as any,
            edges: nextEdges as any,
            preferredTool: 'table',
            extensions: nextExtensions,
          }).catch(() => undefined);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || (isPl ? 'Nie udało się wczytać mapy' : 'Failed to load map'));
      nodesUndo.set([]);
      setEdges([]);
      setExtensions({});
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language, ideaId, isPl, open]);

  useEffect(() => {
    if (!open) return;
    didPersistPreferredRef.current = false;
    hydrate();
  }, [hydrate, open, refreshToken]);

  // ── Processed rows ─────────────────────────────────────────────────────────
  const processedRows = useMemo(() => {
    let rows = (nodes || []).filter((n) => String(n?.type || '') !== 'frame');

    // Advanced filters
    if (filters.rules.length > 0) {
      rows = rows.filter((r) => {
        const results = filters.rules.map((rule) => {
          const val = String(r?.data?.[rule.column] || r?.data?.label || '').toLowerCase();
          const ruleVal = String(rule.value || '').toLowerCase();
          switch (rule.operator) {
            case 'contains': return val.includes(ruleVal);
            case 'equals': return val === ruleVal;
            case 'not_empty': return val.trim().length > 0;
            case 'is_empty': return val.trim().length === 0;
            case 'gt': return Number(r?.data?.[rule.column]) > Number(rule.value);
            case 'lt': return Number(r?.data?.[rule.column]) < Number(rule.value);
            default: return true;
          }
        });
        return filters.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
      });
    }

    if (filterInput.trim()) {
      const q = filterInput.toLowerCase();
      rows = rows.filter((r) => {
        const label = String(r?.data?.label || '').toLowerCase();
        const type = String(r?.type || '').toLowerCase();
        return label.includes(q) || type.includes(q) || r.id.toLowerCase().includes(q);
      });
    }

    if (sort) {
      rows = [...rows].sort((a, b) => {
        const aVal = String(a?.data?.[sort.key] || a?.data?.label || a.id).toLowerCase();
        const bVal = String(b?.data?.[sort.key] || b?.data?.label || b.id).toLowerCase();
        const aNum = Number(a?.data?.[sort.key]);
        const bNum = Number(b?.data?.[sort.key]);
        if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
          return sort.direction === 'asc' ? aNum - bNum : bNum - aNum;
        }
        const cmp = aVal.localeCompare(bVal);
        return sort.direction === 'asc' ? cmp : -cmp;
      });
    } else {
      const score = (n: TableNode) => {
        if (n.id === 'root') return 0;
        if (String(n.type) === 'branch') return 1;
        return 2;
      };
      rows = [...rows].sort((a, b) => score(a) - score(b));
    }

    return rows;
  }, [filters, filterInput, nodes, sort]);

  const groupedRows = useMemo(() => {
    if (!groupBy) return null;
    const groups: Record<string, TableNode[]> = {};
    for (const row of processedRows) {
      const key = String(row?.data?.[groupBy] || row?.type || 'other');
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    return groups;
  }, [groupBy, processedRows]);

  // ── Selection ──────────────────────────────────────────────────────────────
  const toggleRowSelection = useCallback(
    (id: string) => {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        const sel: IdeaWorkspaceSelection = next.size > 0
          ? { type: 'row', count: next.size, ids: Array.from(next), primaryId: id }
          : EMPTY_SELECTION;
        onSelectionChange?.(sel);
        return next;
      });
    },
    [onSelectionChange]
  );

  // ── Edit ───────────────────────────────────────────────────────────────────
  const handleFieldChange = useCallback((id: string, field: string, value: any) => {
    const next = nodes.map((n) => {
      if (n.id !== id) return n;
      return { ...n, data: { ...(n.data || {}), [field]: value } };
    });
    nodesUndo.push(next);
  }, [nodes, nodesUndo]);

  // ── Add row (with optional template picker) ────────────────────────────────
  const handleAddRow = useCallback(() => {
    if (locked) return;
    const id = `node-${Date.now()}`;
    const newNode: TableNode = {
      id,
      type: 'idea',
      data: { label: '' },
      position: { x: 0, y: 0 },
    };
    nodesUndo.push([...nodes, newNode]);
    trackFunnelEvent('ideas_table_row_added', { ideaId });
  }, [ideaId, locked, nodes, nodesUndo]);

  const handleAddRowWithTemplate = useCallback((e: React.MouseEvent) => {
    if (locked) return;
    setAddRowBtnRect((e.currentTarget as HTMLElement).getBoundingClientRect());
    setShowRowTemplatePicker(true);
  }, [locked]);

  const handleTemplateSelect = useCallback((template: RowTemplate) => {
    if (locked) return;
    const newNode = createNodeFromTemplate(template);
    nodesUndo.push([...nodes, newNode]);
    trackFunnelEvent('ideas_table_row_added', { ideaId, template: template.id });
  }, [ideaId, locked, nodes, nodesUndo]);

  // ── Bulk delete ────────────────────────────────────────────────────────────
  const handleBulkDelete = useCallback(() => {
    if (locked || selectedRowIds.size === 0) return;
    const next = nodes.filter((n) => !selectedRowIds.has(n.id));
    nodesUndo.push(next);
    setSelectedRowIds(new Set());
    onSelectionChange?.(EMPTY_SELECTION);
  }, [locked, nodes, nodesUndo, onSelectionChange, selectedRowIds]);

  // ── Add column ─────────────────────────────────────────────────────────────
  const handleAddColumn = useCallback((col: ColumnDef) => {
    setColumns((prev) => [...prev, col]);
    trackFunnelEvent('ideas_table_column_added', { key: col.key, type: col.type, ideaId });
  }, [ideaId]);

  // ── Framework apply ────────────────────────────────────────────────────────
  const handleFrameworkApply = useCallback((fwColumns: ColumnDef[], fwRows: TableNode[]) => {
    setColumns((prev) => {
      const existingKeys = new Set(prev.map((c) => c.key));
      const newCols = fwColumns.filter((c) => !existingKeys.has(c.key));
      return [...prev, ...newCols];
    });
    nodesUndo.push([...nodes, ...fwRows]);
    trackFunnelEvent('ideas_table_framework_applied', { ideaId, rowCount: fwRows.length });
  }, [ideaId, nodes, nodesUndo]);

  // ── AI add rows ────────────────────────────────────────────────────────────
  const handleAIAddRows = useCallback((newRows: TableNode[]) => {
    nodesUndo.push([...nodes, ...newRows]);
  }, [nodes, nodesUndo]);

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
  const handleApplySuggestion = useCallback((suggestion: SmartSuggestion) => {
    const payload = suggestion.action?.payload;
    if (!payload) return;
    if (payload.type === 'switch_view') setViewLayout(payload.view);
    if (payload.type === 'add_column' && payload.columnType) {
      const col: ColumnDef = {
        key: `col_${Date.now()}`,
        header: payload.columnType === 'rating' ? (isPl ? 'Ocena' : 'Rating') : payload.columnType,
        type: payload.columnType,
        visible: true,
        width: 120,
      };
      setColumns((prev) => [...prev, col]);
    }
    trackFunnelEvent('ideas_table_suggestion_applied', { type: suggestion.type, ideaId });
  }, [ideaId, isPl]);

  // ── AI Categorize handlers ─────────────────────────────────────────────────
  const handleApplyTags = useCallback((nodeId: string, tags: string[]) => {
    const next = nodes.map((n) => {
      if (n.id !== nodeId) return n;
      const existing = Array.isArray(n.data?.tags) ? n.data.tags : [];
      const merged = [...new Set([...existing, ...tags])];
      return { ...n, data: { ...(n.data || {}), tags: merged } };
    });
    nodesUndo.push(next);
  }, [nodes, nodesUndo]);

  const handleApplyCluster = useCallback((nodeId: string, cluster: string, color: string) => {
    const next = nodes.map((n) => {
      if (n.id !== nodeId) return n;
      return { ...n, data: { ...(n.data || {}), cluster, color } };
    });
    nodesUndo.push(next);
  }, [nodes, nodesUndo]);

  const handleMergeNodes = useCallback((keepId: string, removeId: string) => {
    const keepNode = nodes.find((n) => n.id === keepId);
    const removeNode = nodes.find((n) => n.id === removeId);
    if (!keepNode || !removeNode) return;
    const mergedData = { ...removeNode.data, ...keepNode.data, label: `${keepNode.data?.label || ''} + ${removeNode.data?.label || ''}` };
    const next = nodes.filter((n) => n.id !== removeId).map((n) => n.id === keepId ? { ...n, data: mergedData } : n);
    nodesUndo.push(next);
    toast.success(isPl ? 'Pomysły scalone' : 'Ideas merged');
  }, [isPl, nodes, nodesUndo]);

  // ── Scoring model handler ──────────────────────────────────────────────────
  const handleApplyScores = useCallback((scores: { nodeId: string; score: number; rank: number }[]) => {
    const scoreMap = new Map(scores.map((s) => [s.nodeId, s]));
    const next = nodes.map((n) => {
      const s = scoreMap.get(n.id);
      if (!s) return n;
      return { ...n, data: { ...(n.data || {}), score: s.score, rank: s.rank } };
    });
    nodesUndo.push(next);
    toast.success(isPl ? 'Ranking zastosowany' : 'Ranking applied');
  }, [isPl, nodes, nodesUndo]);

  // ── Formula V2 evaluation ──────────────────────────────────────────────────
  const formulaColumns = useMemo(
    () => columns.filter((c) => c.type === 'formula' && c.formula).map((c) => ({ key: c.key, formula: c.formula! })),
    [columns]
  );

  const formulaResults = useMemo(() => {
    if (formulaColumns.length === 0) return null;
    return batchEvaluateFormulas(nodes, edges, formulaColumns);
  }, [edges, formulaColumns, nodes]);

  // ── Pipeline stage change ────────────────────────────────────────────────
  const handlePipelineStageChange = useCallback((nodeId: string, stage: string) => {
    const next = nodes.map((n) => n.id === nodeId ? { ...n, data: { ...(n.data || {}), pipelineStage: stage } } : n);
    nodesUndo.push(next);
  }, [nodes, nodesUndo]);

  // ── Cross-table edge add ───────────────────────────────────────────────
  const handleAddCrossEdge = useCallback((edge: TableEdge) => {
    setEdges((prev) => [...prev, edge]);
  }, []);

  // ── Heatmap toggle column ──────────────────────────────────────────────
  const toggleHeatmapColumn = useCallback((key: string) => {
    setHeatmapColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
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

  const cellExpandNode = cellExpandState ? nodes.find((n) => n.id === cellExpandState.nodeId) : null;
  const cellExpandCol = cellExpandState ? columns.find((c) => c.key === cellExpandState.colKey) : null;

  // ── Add sub-item ──────────────────────────────────────────────────────────
  // ── Reorder nodes (DnD) ────────────────────────────────────────────────────
  const handleReorderNode = useCallback((nodeId: string, targetIdx: number) => {
    const fromIdx = nodes.findIndex((n) => n.id === nodeId);
    if (fromIdx < 0 || fromIdx === targetIdx) return;
    const next = [...nodes];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(targetIdx, 0, moved);
    nodesUndo.push(next);
  }, [nodes, nodesUndo]);

  const handleAddSubItem = useCallback((parentId: string) => {
    if (locked) return;
    const childId = `node-${Date.now()}`;
    const childNode: TableNode = { id: childId, type: 'idea', data: { label: '' }, position: { x: 0, y: 0 } };
    const parent = nodes.find((n) => n.id === parentId);
    const updatedNodes = nodes.map((n) => {
      if (n.id !== parentId) return n;
      return { ...n, data: { ...(n.data || {}), children: [...(n.data?.children || []), childId] } };
    });
    nodesUndo.push([...updatedNodes, childNode]);
  }, [locked, nodes, nodesUndo]);

  // ── CSV import ─────────────────────────────────────────────────────────────
  const handleCSVImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
      toast.success(isPl ? `Zaimportowano ${newNodes.length} wierszy` : `Imported ${newNodes.length} rows`);
      trackFunnelEvent('ideas_table_csv_imported', { ideaId, rowCount: newNodes.length });
    };
    reader.readAsText(file);
    if (csvInputRef.current) csvInputRef.current.value = '';
  }, [columns, ideaId, isPl, nodes, nodesUndo]);

  // ── "/" key for AI assistant ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !showAIAssistant && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setShowAIAssistant(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showAIAssistant]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (locked) return;
    setSaving(true);
    try {
      const nextExt = {
        ...extensions,
        table: {
          columns: columns.map((c) => ({ key: c.key, header: c.header, type: c.type, visible: c.visible, width: c.width, options: c.options, optionColors: c.optionColors, formula: c.formula, aiPrompt: c.aiPrompt, aggregation: c.aggregation })),
          views: savedViews,
          activeViewId,
          viewState: { sort, filters, groupBy },
          formatting: formatRules,
          viewLayout,
        },
      };
      await Api.saveMyIdeaMap(ideaId, {
        nodes: nodes as any,
        edges: edges as any,
        preferredTool: 'table' as CanvasToolType,
        extensions: nextExt,
      });
      toast.success(isPl ? 'Zapisano' : 'Saved', { duration: 900 });
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message || (isPl ? 'Nie udało się zapisać' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }, [activeViewId, columns, edges, extensions, filters, groupBy, ideaId, isPl, locked, nodes, onSaved, savedViews, sort]);

  // ── Toggle column ──────────────────────────────────────────────────────────
  const toggleColumn = (key: string) => {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  };

  // ── Cycle sort ─────────────────────────────────────────────────────────────
  const cycleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
    trackFunnelEvent('ideas_table_sort_applied', { key, ideaId });
  };

  // ── Apply view ─────────────────────────────────────────────────────────────
  const applyView = (view: SavedView) => {
    setActiveViewId(view.id);
    if (view.sort?.[0]) setSort(view.sort[0]);
    if (view.filters) setFilters(view.filters);
    if (view.groupBy) setGroupBy(view.groupBy);
    trackFunnelEvent('ideas_table_view_changed', { viewId: view.id, ideaId });
  };

  // ── Keyboard ───────────────────────────────────────────────────────────────
  const visibleColumns = columns.filter((c) => c.visible);

  useTableKeyboard({
    rowCount: processedRows.length,
    colCount: visibleColumns.length,
    onUndo: nodesUndo.undo,
    onRedo: nodesUndo.redo,
    onDelete: handleBulkDelete,
    onEscape: () => { setDetailNodeId(null); setSelectedRowIds(new Set()); onSelectionChange?.(EMPTY_SELECTION); setShowKeyboardShortcuts(false); },
    onSave: handleSave,
    onAddRow: handleAddRow,
    onOpenAI: () => setShowAIAssistant(true),
    onShowShortcuts: () => setShowKeyboardShortcuts(true),
    onSwitchView: (v) => setViewLayout(v as any),
    onToggleFilters: () => setShowFilterPanel((p) => !p),
    onToggleSummary: () => setShowSummaryDashboard((p) => !p),
    containerRef: tableRef,
  });

  const detailNode = useMemo(() => detailNodeId ? nodes.find((n) => n.id === detailNodeId) || null : null, [detailNodeId, nodes]);

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
          isSelected ? 'bg-primary-500/5' : detailNodeId === row.id ? 'bg-violet-500/5' : selectedNodeForLines === row.id ? 'bg-indigo-500/5' : 'hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'
        }`}
        style={rowColor ? { borderLeftWidth: 3, borderLeftColor: rowColor } : undefined}
        onClick={() => setSelectedNodeForLines(selectedNodeForLines === row.id ? null : row.id)}
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
          const condStyle = formatRules.length > 0 ? getConditionalStyle(formatRules, col.key, row?.data?.[col.key]) : undefined;
          return (
            <td
              key={col.key}
              data-row={rowIdx}
              data-col={colIdx}
              style={{ width: col.width, minWidth: col.width, maxWidth: col.width, ...condStyle, ...(heatmapStyles?.get(row.id)?.get(col.key) || {}) }}
              className="px-2 py-1.5 relative group/cell"
            >
              <CellCursor remoteUsers={remotePresenceUsers} nodeId={row.id} colKey={col.key} />
              <div className="flex items-center gap-0.5">
                <div className="flex-1 min-w-0" onClick={() => setDetailNodeId(row.id)}>
                  {col.key === 'type' ? (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{row.type || 'node'}</span>
                  ) : (
                    <CellRenderer
                      column={col}
                      value={col.type === 'formula' && formulaResults ? (formulaResults.get(row.id)?.[col.key] ?? row?.data?.[col.key]) : row?.data?.[col.key]}
                      rowData={row.data || {}}
                      onChange={(val) => handleFieldChange(row.id, col.key, val)}
                      locked={locked}
                      allNodes={nodes.map((n) => ({ id: n.id, label: n.data?.label }))}
                    />
                  )}
                </div>
                {col.key !== 'type' && !locked && (row?.data?.[col.key] == null || row.data[col.key] === '') && (
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
      aria-label={isPl ? 'Tabela pomysłów z operacjami zbiorczymi' : 'Ideas table with bulk operations'}
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
              <button
                key={v.id}
                onClick={() => applyView(v)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                  activeViewId === v.id
                    ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>

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
              <button onClick={() => setFilterInput('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={10} />
              </button>
            )}
          </div>

          {/* Advanced filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                filters.rules.length > 0 ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
              }`}
            >
              <Filter size={12} />
              {filters.rules.length > 0 && <span className="text-[9px]">({filters.rules.length})</span>}
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
              groupBy ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
            }`}
            title={isPl ? 'Grupuj' : 'Group'}
          >
            <Group size={12} />
            {isPl ? 'Grupuj' : 'Group'}
          </button>

          {/* View layout switcher */}
          <div className="flex items-center rounded-lg border border-slate-200/60 dark:border-navy-700/60 overflow-hidden">
            <button
              onClick={() => setViewLayout('table')}
              className={`p-1.5 transition-colors ${viewLayout === 'table' ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              title={isPl ? 'Tabela' : 'Table'}
            >
              <Table2 size={12} />
            </button>
            <button
              onClick={() => setViewLayout('kanban')}
              className={`p-1.5 transition-colors ${viewLayout === 'kanban' ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              title="Kanban"
            >
              <KanbanSquare size={12} />
            </button>
            <button
              onClick={() => setViewLayout('matrix')}
              className={`p-1.5 transition-colors ${viewLayout === 'matrix' ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              title="Matrix"
            >
              <LayoutGrid size={12} />
            </button>
            <button
              onClick={() => setViewLayout('sticky')}
              className={`p-1.5 transition-colors ${viewLayout === 'sticky' ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              title={isPl ? 'Karteczki' : 'Sticky Notes'}
            >
              <StickyNote size={12} />
            </button>
            <button
              onClick={() => setViewLayout('timeline')}
              className={`p-1.5 transition-colors ${viewLayout === 'timeline' ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              title="Timeline / Gantt"
            >
              <GanttChart size={12} />
            </button>
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
              nodes={processedRows}
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
              onPaletteChange={(id) => { setActivePalette(id); setShowColorPalette(false); }}
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
            <input ref={csvInputRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleCSVImport} />
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
              onClick={() => { const csv = exportToCSV(columns, nodes); downloadCSV(csv, `idea-${ideaId}.csv`); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title={isPl ? 'Eksportuj CSV' : 'Export CSV'}
            >
              <Download size={12} />
            </button>
            <button
              onClick={() => { copyTableToClipboard(columns, nodes); toast.success(isPl ? 'Skopiowano' : 'Copied'); }}
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
                    {col.visible ? <Eye size={12} className="text-primary-500" /> : <EyeOff size={12} className="text-slate-400" />}
                    {col.header}
                    <span className="ml-auto text-[9px] text-slate-400">{col.type}</span>
                  </button>
                ))}
                <div className="border-t border-slate-200/60 dark:border-navy-700/60 mt-1 pt-1">
                  <button
                    onClick={() => { setShowColumnConfig(false); setShowAddColumn(true); }}
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
                <button
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-red-600 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={11} />
                  {isPl ? 'Usuń' : 'Delete'}
                </button>
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
          onSort={(s) => setSort(s)}
          onFilter={(f) => setFilters(f)}
          onGroup={(g) => setGroupBy(g)}
          onAddColumn={handleAddColumn}
          onAddRows={handleAIAddRows}
        />

        {/* Content area */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-slate-400" size={24} />
          </div>
        ) : viewLayout === 'timeline' ? (
          <TimelineView
            nodes={processedRows}
            edges={edges}
            columns={columns}
            locked={locked}
            onFieldChange={handleFieldChange}
            onNodeClick={(id) => setDetailNodeId(id)}
          />
        ) : viewLayout === 'sticky' ? (
          <StickyNoteView
            nodes={processedRows}
            columns={columns}
            onNodeClick={(id) => setDetailNodeId(id)}
            onReorder={handleReorderNode}
            onFieldChange={handleFieldChange}
            groupBy={groupBy}
          />
        ) : viewLayout === 'kanban' ? (
          <KanbanView
            nodes={processedRows}
            groupByColumn={columns.find((c) => c.key === (groupBy || 'status') && (c.type === 'select' || c.type === 'multiselect')) || columns.find((c) => c.type === 'select') || columns[0]}
            columns={columns}
            locked={locked}
            onFieldChange={handleFieldChange}
            onAddRow={handleAddRow}
            onNodeClick={(id) => setDetailNodeId(id)}
          />
        ) : viewLayout === 'matrix' ? (
          <MatrixView
            nodes={processedRows}
            xAxis={columns.find((c) => c.key === 'impact' && (c.type === 'number' || c.type === 'rating')) || columns.find((c) => c.type === 'rating') || columns[0]}
            yAxis={columns.find((c) => c.key === 'effort' && (c.type === 'number' || c.type === 'rating')) || columns.filter((c) => c.type === 'rating')[1] || columns[1] || columns[0]}
            onNodeClick={(id) => setDetailNodeId(id)}
          />
        ) : (
          <div ref={tableContainerRef} className="flex-1 overflow-auto relative">
            <ConnectionLines
              selectedNodeId={selectedNodeForLines}
              edges={edges}
              allNodes={nodes}
              containerRef={tableContainerRef}
            />
            <table className="w-full text-left" style={{ minWidth: visibleColumns.reduce((s, c) => s + c.width, 40) }}>
              <thead className="sticky top-0 bg-slate-50/95 dark:bg-navy-900/95 backdrop-blur-sm border-b border-slate-200/60 dark:border-navy-700/60 z-10">
                <tr>
                  <th className="w-8 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selectedRowIds.size === processedRows.length && processedRows.length > 0}
                      onChange={() => {
                        if (selectedRowIds.size === processedRows.length) {
                          setSelectedRowIds(new Set());
                          onSelectionChange?.(EMPTY_SELECTION);
                        } else {
                          const all = new Set(processedRows.map((r) => r.id));
                          setSelectedRowIds(all);
                          onSelectionChange?.({ type: 'row', count: all.size, ids: Array.from(all) });
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
                      draggable
                      onDragStart={() => handleColDragStart(col.key)}
                      onDragOver={(e) => handleColDragOver(e, col.key)}
                      onDragEnd={handleColDragEnd}
                    >
                      <div
                        className="flex items-center gap-1 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
                        onClick={() => cycleSort(col.key)}
                      >
                        <GripVertical size={10} className="opacity-0 group-hover:opacity-40 cursor-grab" />
                        {col.header}
                        {sort?.key === col.key ? (
                          sort.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                        ) : (
                          <ArrowUpDown size={10} className="opacity-30" />
                        )}
                      </div>
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
                        <td colSpan={visibleColumns.length + 1} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          {groupKey} ({rows.length})
                        </td>
                      </tr>
                      {rows.map((row, idx) => renderRow(row, idx))}
                    </React.Fragment>
                  ))
                ) : processedRows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 1} className="px-4 py-12 text-center">
                      <div className="text-slate-400 dark:text-slate-500">
                        <div className="text-sm font-semibold mb-1">{isPl ? 'Brak wierszy' : 'No rows yet'}</div>
                        <div className="text-[11px]">{isPl ? 'Dodaj pierwszy wiersz lub użyj AI' : 'Add a row or use AI to generate content'}</div>
                        {!locked && (
                          <button
                            onClick={handleAddRow}
                            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-colors"
                          >
                            <Plus size={14} />
                            {isPl ? 'Dodaj wiersz' : 'Add row'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  processedRows.map((row, idx) => renderRow(row, idx))
                )}
              </tbody>
              {/* Footer aggregations */}
              {processedRows.length > 0 && visibleColumns.some((c) => c.aggregation && c.aggregation !== 'none') && (
                <tfoot className="border-t-2 border-slate-200/60 dark:border-navy-700/60">
                  <tr className="bg-slate-50/50 dark:bg-navy-900/50">
                    <td className="px-2 py-1.5" />
                    {visibleColumns.map((col) => {
                      const agg = col.aggregation;
                      if (!agg || agg === 'none') return <td key={col.key} className="px-2 py-1.5" />;
                      const values = processedRows.map((r) => r.data?.[col.key]);
                      return (
                        <td key={col.key} className="px-2 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">
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
                      <th className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">{isPl ? 'Źródło' : 'Source'}</th>
                      <th className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">{isPl ? 'Cel' : 'Target'}</th>
                      <th className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 w-28">Kind</th>
                    </tr>
                  </thead>
                  <tbody>
                    {edges.map((e) => (
                      <tr key={e.id} className="border-b border-slate-200/20 dark:border-white/[0.02]">
                        <td className="px-3 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">{e.source}</td>
                        <td className="px-3 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">{e.target}</td>
                        <td className="px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">{e?.data?.kind ? String(e.data.kind) : e.type || 'edge'}</td>
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
        nodes={processedRows}
        columns={columns}
        visible={processedRows.length > 0}
      />

      {/* Smart Suggestions Bar */}
      <SmartSuggestionsBar
        nodes={processedRows}
        columns={columns}
        visible={showSmartSuggestions && processedRows.length > 0}
        onDismiss={() => setShowSmartSuggestions(false)}
        onApplySuggestion={handleApplySuggestion}
        ideaId={ideaId}
      />

      {/* Table Summary Dashboard */}
      <TableSummaryDashboard
        open={showSummaryDashboard}
        onClose={() => setShowSummaryDashboard(false)}
        nodes={processedRows}
        columns={columns}
        ideaId={ideaId}
      />

      {/* Row Detail Panel */}
      <RowDetailPanel
        open={!!detailNodeId}
        onClose={() => setDetailNodeId(null)}
        node={detailNode}
        columns={visibleColumns}
        edges={edges}
        allNodes={nodes}
        locked={locked}
        onFieldChange={handleFieldChange}
        onConvert={(target) => {
          if (onConvertProp) {
            onConvertProp(target);
          } else {
            toast.success(isPl ? `Konwersja do: ${target}` : `Convert to: ${target}`);
          }
          setDetailNodeId(null);
        }}
        onAddSubItem={handleAddSubItem}
        onNodeClick={(id) => setDetailNodeId(id)}
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
              setColumns((prev) => prev.map((c) => c.key === cellExpandCol.key ? { ...c, options: val._optionsUpdate } : c));
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
            } catch { return ''; }
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
        nodes={processedRows}
        ideaId={ideaId}
        onApplyTags={handleApplyTags}
        onApplyCluster={handleApplyCluster}
        onMergeNodes={handleMergeNodes}
      />

      {/* Idea Scoring Model */}
      <IdeaScoringModel
        open={showScoringModel}
        onClose={() => setShowScoringModel(false)}
        nodes={processedRows}
        columns={columns}
        ideaId={ideaId}
        onApplyScores={handleApplyScores}
      />

      {/* Export to Presentation */}
      <ExportToPresentation
        open={showExportPresentation}
        onClose={() => setShowExportPresentation(false)}
        nodes={processedRows}
        columns={columns}
        ideaTitle={extensions?.title ? String(extensions.title) : (isPl ? 'Pomysły' : 'Ideas')}
        viewLayout={viewLayout}
      />

      {/* Idea Pipeline */}
      <IdeaPipeline
        open={showPipeline}
        onClose={() => setShowPipeline(false)}
        nodes={processedRows}
        ideaId={ideaId}
        onStageChange={handlePipelineStageChange}
        onConvertToInitiative={(nodeId) => {
          if (onConvertProp) onConvertProp('initiative');
          else toast.success(isPl ? `Konwersja pomysłu do inicjatywy` : `Converting idea to initiative`);
        }}
      />

      {/* AI Copilot */}
      <AICopilotMode
        open={showCopilot}
        onClose={() => setShowCopilot(false)}
        nodes={processedRows}
        ideaId={ideaId}
        onAddRows={handleAIAddRows}
        onUpdateNode={(nodeId, data) => {
          const next = nodes.map((n) => n.id === nodeId ? { ...n, data: { ...(n.data || {}), ...data } } : n);
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
        currentNodes={processedRows}
        currentEdges={edges}
        onAddEdge={handleAddCrossEdge}
      />
    </div>
  );
};

export default IdeaTableTool;
