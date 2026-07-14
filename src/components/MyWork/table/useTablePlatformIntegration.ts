/**
 * useTablePlatformIntegration — main integration hook that wires the Table Platform
 * into IdeaTableTool. Provides the same interface as the legacy hooks (useTableSchema,
 * useTableViews, useTableRows, useTablePersistence) but backed by the new platform.
 *
 * Sprint 3 deliverable: drop-in replacement when tablePlatformMetadataFirst flag is on.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import type {
  FilterGroup as TPFilterGroup,
  TablePlatformField,
  TablePlatformView,
  ViewConfig,
} from '@/types/tablePlatform';

import { EMPTY_SELECTION } from '../ideaSelectionTypes';
import type { FormatRule } from './ConditionalFormatting';
import { evaluateFilterRule } from './filterEval';
import { columnToField, fieldToColumn, recordToNode } from './tablePlatformMappers';
import type { ColumnDef, FilterGroup, SavedView, SortConfig, TableNode } from './tableTypes';
import { DEFAULT_COLUMN_WIDTH } from './tableTypes';
import { useTablePlatformBridge } from './useTablePlatformBridge';
import { useTablePlatformViews } from './useTablePlatformViews';
import type { ViewLayout } from './useTableViews';

// ---------------------------------------------------------------------------
// Inactive defaults (when platform is not active)
// ---------------------------------------------------------------------------

const EMPTY_COLUMNS: ColumnDef[] = [];
const EMPTY_NODES: TableNode[] = [];
const DEFAULT_FILTERS: FilterGroup = { logic: 'and', rules: [] };
const NOOP_FN = () => {};
const NOOP_ASYNC = async () => {};

function missingPlaceholderColumn(fieldId: string): ColumnDef {
  return {
    key: fieldId,
    header: '[Missing field]',
    type: 'text',
    visible: true,
    width: DEFAULT_COLUMN_WIDTH,
  };
}

/** Build grid columns from schema + active view order; orphan visible field ids become placeholder columns */
function buildPlatformColumns(
  fields: TablePlatformField[],
  activeView: TablePlatformView | undefined
): ColumnDef[] {
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const vf = activeView?.visibleFieldIds;
  if (!vf?.length) {
    return fields.map(fieldToColumn);
  }
  const cols: ColumnDef[] = [];
  const seen = new Set<string>();
  for (const fid of vf) {
    if (seen.has(fid)) continue;
    seen.add(fid);
    const f = fieldById.get(fid);
    if (f) cols.push(fieldToColumn(f));
    else cols.push(missingPlaceholderColumn(fid));
  }
  for (const f of fields) {
    if (!seen.has(f.id)) cols.push(fieldToColumn(f));
  }
  return cols;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseTablePlatformIntegrationOpts {
  ideaId: string;
  locked: boolean;
  t: (key: string, fallback?: string) => string;
  open: boolean;
  onSelectionChange?: (sel: unknown) => void;
  /** Canonical `tp_tables.id` to load when deep-linking from governed sheet artifacts. */
  preferredTableId?: string | null;
}

export interface UseTablePlatformIntegrationReturn {
  active: boolean;
  loading: boolean;
  saving: boolean;
  saveStatusLabel: string;
  error: string | null;

  // Schema
  columns: ColumnDef[];
  setColumns: React.Dispatch<React.SetStateAction<ColumnDef[]>>;
  visibleColumns: ColumnDef[];
  toggleColumn: (key: string) => void;
  handleAddColumn: (col: ColumnDef) => void;
  renameColumn: (key: string, newName: string) => void;
  deleteColumn: (key: string) => void;

  // Rows
  nodes: TableNode[];
  processedRows: TableNode[];
  groupedRows: Record<string, TableNode[]> | null;
  selectedRowIds: Set<string>;
  setSelectedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleRowSelection: (id: string) => void;
  handleFieldChange: (nodeId: string, field: string, value: unknown) => void;
  handleAddRow: () => void;
  handleBulkDelete: () => void;
  handleDeleteRow: (id: string) => void;
  handleDuplicateRow: (id: string) => void;

  // Views
  viewLayout: ViewLayout;
  setViewLayout: (layout: ViewLayout) => void;
  savedViews: SavedView[];
  activeViewId: string;
  setActiveViewId: (id: string) => void;
  sort: SortConfig | null;
  setSort: (sort: SortConfig | null) => void;
  filters: FilterGroup;
  setFilters: (filters: FilterGroup) => void;
  groupBy: string | null;
  setGroupBy: (field: string | null) => void;
  applyView: (view: SavedView) => void;
  saveCurrentView: (name: string, columns: ColumnDef[]) => Promise<void>;
  updateSavedView: (viewId: string, patch: Partial<SavedView>) => Promise<void>;
  deleteSavedView: (viewId: string) => Promise<void>;

  // Persistence
  handleSave: () => Promise<void>;
  refresh: () => Promise<void>;

  // Realtime — canonical table id + broadcast appliers (fold peer mutations
  // into local state; echo-safe + table-scoped inside the bridge).
  realtimeTableId: string | null;
  applyRealtimeCreated: (payload: unknown) => void;
  applyRealtimeUpdated: (recordId: string, payload: unknown) => void;
  applyRealtimeDeleted: (recordId: string) => void;
  applyRealtimeSchemaChanged: () => void;

  // Platform-specific
  loadMore: () => Promise<void>;
  hasMore: boolean;
  totalRecords: number;

  platformFields: TablePlatformField[];
  platformViews: TablePlatformView[];
  base?: { id?: string; name?: string } | null;
  table?: { id: string; name: string; primaryFieldId?: string | null } | null;
  applyPlatformFilters: (filters: TPFilterGroup) => Promise<void>;
  createPlatformView: (
    name: string,
    viewType?: string,
    config?: Record<string, unknown>
  ) => Promise<TablePlatformView | null>;

  /** Config for the active platform view (includes `missing_fields` / `missing_field_names`) */
  activeViewConfig: ViewConfig;
  /** Strip a degraded missing-field column from the view (updates visible_field_ids + config) */
  removeMissingFieldFromView: (fieldId: string) => Promise<void>;

  /** R5: conditional-formatting rules for the active view (from `config.conditional_formatting`) */
  formatRules: FormatRule[];
  /** R5: persist conditional-formatting rules into the active view's `config` JSONB */
  updateConditionalFormatting: (rules: FormatRule[]) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Client-side filter, sort, group (mirrors useTableRows)
// ---------------------------------------------------------------------------

function applyLocalFilterSortGroup(
  rows: TableNode[],
  filters: FilterGroup,
  sort: SortConfig | null,
  groupBy: string | null
): {
  processed: TableNode[];
  grouped: Record<string, TableNode[]> | null;
} {
  let processed = rows.filter((n) => String(n?.type || '') !== 'frame');

  if (filters.rules.length > 0) {
    processed = processed.filter((r) => {
      // M08 L-02: shared evaluator — full FilterBuilder operator set, not just 6.
      const results = filters.rules.map((rule) => evaluateFilterRule(rule, r));
      return filters.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
    });
  }

  if (sort) {
    processed = [...processed].sort((a, b) => {
      const aVal = String(a?.data?.[sort.key] ?? a?.data?.label ?? a.id).toLowerCase();
      const bVal = String(b?.data?.[sort.key] ?? b?.data?.label ?? b.id).toLowerCase();
      const aNum = Number(a?.data?.[sort.key]);
      const bNum = Number(b?.data?.[sort.key]);
      if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
        return sort.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      const cmp = aVal.localeCompare(bVal);
      return sort.direction === 'asc' ? cmp : -cmp;
    });
  }

  let grouped: Record<string, TableNode[]> | null = null;
  if (groupBy) {
    grouped = {};
    for (const row of processed) {
      const key = String(row?.data?.[groupBy] ?? row?.type ?? 'other');
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    }
  }

  return { processed, grouped };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTablePlatformIntegration(
  opts: UseTablePlatformIntegrationOpts
): UseTablePlatformIntegrationReturn {
  const { ideaId, locked, t, open, onSelectionChange, preferredTableId } = opts;

  const bridge = useTablePlatformBridge({ ideaId, enabled: open, preferredTableId });
  const tableId = (bridge.table as { id?: string } | null)?.id ?? null;
  const views = useTablePlatformViews({
    tableId,
    fields: bridge.fields,
    enabled: bridge.isNewPlatform && !!tableId,
  });

  const activePlatformView = useMemo(
    () => bridge.views.find((v) => v.id === views.activeViewId),
    [bridge.views, views.activeViewId]
  );

  const derivedColumns = useMemo(
    () => buildPlatformColumns(bridge.fields, activePlatformView),
    [bridge.fields, activePlatformView]
  );

  const activeViewConfig = useMemo(
    () => (activePlatformView?.config ?? {}) as ViewConfig,
    [activePlatformView]
  );

  // R5: conditional-formatting rules live inside the active view's config JSONB.
  const formatRules = useMemo<FormatRule[]>(
    () => (activeViewConfig.conditional_formatting as FormatRule[] | undefined) ?? [],
    [activeViewConfig]
  );

  const [localColumns, setLocalColumns] = useState<ColumnDef[]>([]);
  const [localNodes, setLocalNodes] = useState<TableNode[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const isActive = bridge.isNewPlatform && open && !bridge.platformFailed;

  // Sync columns from schema + active view when active
  useEffect(() => {
    if (isActive) {
      setLocalColumns(derivedColumns);
    }
  }, [isActive, derivedColumns]);

  // Sync nodes from bridge when active (source of truth)
  useEffect(() => {
    if (isActive) {
      setLocalNodes(bridge.nodes);
    }
  }, [isActive, bridge.nodes]);

  const columns = isActive
    ? localColumns.length > 0
      ? localColumns
      : derivedColumns
    : EMPTY_COLUMNS;
  const nodes = isActive ? (localNodes.length > 0 ? localNodes : bridge.nodes) : EMPTY_NODES;

  const { processed: processedRows, grouped: groupedRows } = useMemo(() => {
    if (!isActive) return { processed: EMPTY_NODES, grouped: null };
    return applyLocalFilterSortGroup(nodes, views.filters, views.sort, views.groupBy);
  }, [isActive, nodes, views.filters, views.sort, views.groupBy]);

  const visibleColumns = useMemo(() => columns.filter((c) => c.visible !== false), [columns]);

  const toggleColumn = useCallback(
    (key: string) => {
      if (!isActive) return;
      setLocalColumns((prev) =>
        prev.map((c) => (c.key === key ? { ...c, visible: c.visible === false } : c))
      );
    },
    [isActive]
  );

  const handleAddColumn = useCallback(
    (col: ColumnDef) => {
      if (!isActive || locked) return;
      void (async () => {
        const { fieldType, options } = columnToField(col);
        const added = await bridge.addField(
          col.header ?? '',
          fieldType ?? 'singleLineText',
          (options ?? {}) as Record<string, unknown>
        );
        if (added) {
          const newCol = fieldToColumn(added);
          setLocalColumns((prev) => [...prev, newCol]);
        }
      })();
    },
    [isActive, locked, bridge]
  );

  const renameColumn = useCallback(
    (key: string, newName: string) => {
      if (!isActive || locked) return;
      void (async () => {
        await bridge.updateField(key, { name: newName });
        setLocalColumns((prev) => prev.map((c) => (c.key === key ? { ...c, header: newName } : c)));
      })();
    },
    [isActive, locked, bridge]
  );

  const deleteColumn = useCallback(
    (key: string) => {
      if (!isActive || locked) return;
      void (async () => {
        try {
          await TablePlatformApi.deleteField(key);
          setLocalColumns((prev) => prev.filter((c) => c.key !== key));
          await bridge.refresh();
        } catch {
          await bridge.refresh();
        }
      })();
    },
    [isActive, locked, bridge]
  );

  const toggleRowSelection = useCallback(
    (id: string) => {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onSelectionChange?.(
          next.size > 0
            ? { type: 'row', count: next.size, ids: Array.from(next), primaryId: id }
            : EMPTY_SELECTION
        );
        return next;
      });
    },
    [onSelectionChange]
  );

  const handleFieldChange = useCallback(
    (nodeId: string, field: string, value: unknown) => {
      if (!isActive || locked) return;
      const prev = nodes.find((n) => n.id === nodeId);
      const prevData = prev?.data ? { ...prev.data } : {};
      setLocalNodes((curr) =>
        curr.map((n) =>
          n.id === nodeId ? { ...n, data: { ...(n.data ?? {}), [field]: value } } : n
        )
      );
      void (async () => {
        const result = await bridge.updateRecord(nodeId, { [field]: value });
        if (!result) {
          setLocalNodes((curr) =>
            curr.map((n) => (n.id === nodeId ? { ...n, data: prevData } : n))
          );
        }
      })();
    },
    [isActive, locked, nodes, bridge]
  );

  const handleAddRow = useCallback(() => {
    if (!isActive || locked) return;
    const tempId = `temp-${Date.now()}`;
    const tempNode: TableNode = {
      id: tempId,
      type: 'idea',
      data: { label: '', status: 'todo', created_time: new Date().toISOString() },
      position: { x: 0, y: 0 },
    };
    setLocalNodes((curr) => [tempNode, ...curr]);
    void (async () => {
      const created = await bridge.createRecord({});
      if (created) {
        const newNode = recordToNode(created, bridge.fields);
        setLocalNodes((curr) => curr.map((n) => (n.id === tempId ? newNode : n)));
      } else {
        setLocalNodes((curr) => curr.filter((n) => n.id !== tempId));
      }
    })();
  }, [isActive, locked, bridge]);

  const handleBulkDelete = useCallback(() => {
    if (!isActive || locked || selectedRowIds.size === 0) return;
    const ids = Array.from(selectedRowIds);
    setLocalNodes((curr) => curr.filter((n) => !selectedRowIds.has(n.id)));
    setSelectedRowIds(new Set());
    onSelectionChange?.(EMPTY_SELECTION);
    void (async () => {
      let anyFailed = false;
      for (const id of ids) {
        const ok = await bridge.deleteRecord(id);
        if (!ok) anyFailed = true;
      }
      if (anyFailed) {
        await bridge.refresh();
        // useEffect will sync localNodes from bridge.nodes
      }
    })();
  }, [isActive, locked, selectedRowIds, bridge, onSelectionChange]);

  // ── Single-row delete (row context menu) ──
  const handleDeleteRow = useCallback(
    (id: string) => {
      if (!isActive || locked) return;
      setLocalNodes((curr) => curr.filter((n) => n.id !== id));
      setSelectedRowIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      void (async () => {
        const ok = await bridge.deleteRecord(id);
        if (!ok) await bridge.refresh();
      })();
    },
    [isActive, locked, bridge]
  );

  // ── Single-row duplicate (row context menu) ──
  const handleDuplicateRow = useCallback(
    (id: string) => {
      if (!isActive || locked) return;
      const source = nodes.find((n) => n.id === id);
      if (!source) return;
      const tempId = `temp-${Date.now()}`;
      const label = String(source.data?.label || '');
      const tempNode: TableNode = {
        id: tempId,
        type: source.type,
        data: {
          ...(source.data || {}),
          label: label ? `${label} ${t('ideas.table.copySuffix', '(copy)')}` : '',
          created_time: new Date().toISOString(),
        },
        position: { x: 0, y: 0 },
      };
      setLocalNodes((curr) => [tempNode, ...curr]);
      void (async () => {
        const created = await bridge.createRecord(source.data || {});
        if (created) {
          const newNode = recordToNode(created, bridge.fields);
          setLocalNodes((curr) => curr.map((n) => (n.id === tempId ? newNode : n)));
        } else {
          setLocalNodes((curr) => curr.filter((n) => n.id !== tempId));
        }
      })();
    },
    [isActive, locked, nodes, t, bridge]
  );

  const handleSave = useCallback(async () => {
    if (!isActive) return;
    // No-op for new platform: data is persisted per-mutation
  }, [isActive]);

  const refresh = useCallback(async () => {
    if (!isActive) return;
    await bridge.refresh();
    // useEffect will sync localNodes/localColumns from bridge
  }, [isActive, bridge]);

  const removeMissingFieldFromView = useCallback(
    async (fieldId: string) => {
      if (!isActive || !views.activeViewId) return;
      const v = bridge.views.find((x) => x.id === views.activeViewId);
      if (!v) return;
      try {
        const cfg: Record<string, unknown> = { ...((v.config ?? {}) as Record<string, unknown>) };
        const prevMissing = Array.isArray(cfg.missing_fields)
          ? (cfg.missing_fields as string[])
          : [];
        cfg.missing_fields = prevMissing.filter((x) => x !== fieldId);
        const mfn = { ...((cfg.missing_field_names as Record<string, string>) ?? {}) };
        delete mfn[fieldId];
        cfg.missing_field_names = mfn;
        const newVisible = (v.visibleFieldIds ?? []).filter((id) => id !== fieldId);
        await TablePlatformApi.updateView(views.activeViewId, {
          visibleFieldIds: newVisible,
          config: cfg,
        });
        await bridge.refresh();
      } catch (e) {
        console.error('Failed to remove missing field', e);
      }
    },
    [isActive, views.activeViewId, bridge]
  );

  // R5: persist conditional-formatting rules into the active view's config JSONB.
  // Reuses MetadataService.updateView (config is free-form JSONB → no migration).
  const updateConditionalFormatting = useCallback(
    async (rules: FormatRule[]) => {
      if (!isActive || !views.activeViewId) return;
      const v = bridge.views.find((x) => x.id === views.activeViewId);
      if (!v) return;
      try {
        const cfg: Record<string, unknown> = { ...((v.config ?? {}) as Record<string, unknown>) };
        cfg.conditional_formatting = rules;
        await TablePlatformApi.updateView(views.activeViewId, { config: cfg });
        await bridge.refresh();
      } catch (e) {
        console.error('Failed to update conditional formatting', e);
      }
    },
    [isActive, views.activeViewId, bridge]
  );

  // Inactive: return defaults
  if (!isActive) {
    return {
      active: false,
      loading: false,
      saving: false,
      saveStatusLabel: '',
      error: null,
      columns: EMPTY_COLUMNS,
      setColumns: NOOP_FN,
      visibleColumns: EMPTY_COLUMNS,
      toggleColumn: NOOP_FN,
      handleAddColumn: NOOP_FN,
      renameColumn: NOOP_FN,
      deleteColumn: NOOP_FN,
      nodes: EMPTY_NODES,
      processedRows: EMPTY_NODES,
      groupedRows: null,
      selectedRowIds: new Set(),
      setSelectedRowIds: NOOP_FN,
      toggleRowSelection: NOOP_FN,
      handleFieldChange: NOOP_FN,
      handleAddRow: NOOP_FN,
      handleBulkDelete: NOOP_FN,
      handleDeleteRow: NOOP_FN,
      handleDuplicateRow: NOOP_FN,
      viewLayout: 'table',
      setViewLayout: NOOP_FN,
      savedViews: [],
      activeViewId: '',
      setActiveViewId: NOOP_FN,
      sort: null,
      setSort: NOOP_FN,
      filters: DEFAULT_FILTERS,
      setFilters: NOOP_FN,
      groupBy: null,
      setGroupBy: NOOP_FN,
      applyView: NOOP_FN,
      saveCurrentView: NOOP_ASYNC,
      updateSavedView: NOOP_ASYNC,
      deleteSavedView: NOOP_ASYNC,
      handleSave: NOOP_ASYNC,
      refresh: NOOP_ASYNC,
      realtimeTableId: null,
      applyRealtimeCreated: NOOP_FN,
      applyRealtimeUpdated: NOOP_FN,
      applyRealtimeDeleted: NOOP_FN,
      applyRealtimeSchemaChanged: NOOP_FN,
      loadMore: NOOP_ASYNC,
      hasMore: false,
      totalRecords: 0,
      platformFields: [],
      platformViews: [],
      applyPlatformFilters: NOOP_ASYNC,
      createPlatformView: async () => null,
      activeViewConfig: {},
      removeMissingFieldFromView: NOOP_ASYNC,
      formatRules: [],
      updateConditionalFormatting: NOOP_ASYNC,
    };
  }

  const loading = bridge.loading || views.loading;
  const saveStatusLabel = t('ideas.table.autoSaved', 'Auto-saved');

  return {
    active: true,
    loading,
    saving,
    saveStatusLabel,
    error: bridge.error,
    columns,
    setColumns: setLocalColumns,
    visibleColumns,
    toggleColumn,
    handleAddColumn,
    renameColumn,
    deleteColumn,
    nodes,
    processedRows,
    groupedRows,
    selectedRowIds,
    setSelectedRowIds,
    toggleRowSelection,
    handleFieldChange,
    handleAddRow,
    handleBulkDelete,
    handleDeleteRow,
    handleDuplicateRow,
    viewLayout: views.viewLayout,
    setViewLayout: views.setViewLayout,
    savedViews: views.savedViews,
    activeViewId: views.activeViewId,
    setActiveViewId: views.setActiveViewId,
    sort: views.sort,
    setSort: views.setSort,
    filters: views.filters,
    setFilters: views.setFilters,
    groupBy: views.groupBy,
    setGroupBy: views.setGroupBy,
    applyView: views.applyView,
    saveCurrentView: views.saveCurrentView,
    updateSavedView: views.updateSavedView,
    deleteSavedView: views.deleteSavedView,
    handleSave,
    refresh,
    realtimeTableId: bridge.loadedTableId,
    applyRealtimeCreated: bridge.applyRealtimeCreated,
    applyRealtimeUpdated: bridge.applyRealtimeUpdated,
    applyRealtimeDeleted: bridge.applyRealtimeDeleted,
    applyRealtimeSchemaChanged: bridge.applyRealtimeSchemaChanged,
    loadMore: bridge.loadMore,
    hasMore: bridge.hasMore,
    totalRecords: bridge.totalRecords,
    platformFields: bridge.fields,
    platformViews: bridge.views,
    applyPlatformFilters: bridge.applyFilters,
    createPlatformView: bridge.createView,
    activeViewConfig,
    removeMissingFieldFromView,
    formatRules,
    updateConditionalFormatting,
  };
}
