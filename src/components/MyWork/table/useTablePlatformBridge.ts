/**
 * useTablePlatformBridge — adapter that routes table persistence
 * to either the legacy graph-based system or the new metadata-first
 * Table Platform API, based on the tablePlatformMetadataFirst feature flag.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import i18n from '@/i18n';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import type {
  FilterGroup as TPFilterGroup,
  SortRule as TPSortRule,
  TablePlatformBase,
  TablePlatformField,
  TablePlatformRecord,
  TablePlatformTable,
  TablePlatformView,
} from '@/types/tablePlatform';

import { fieldToColumn, recordToNode } from './tablePlatformMappers';
import type { ColumnDef, TableNode } from './tableTypes';

const PAGE_SIZE = 50;
/** When false, `tablePlatformMetadataFirst` feature flag controls metadata-first mode. */
const HARD_DISABLE_METADATA_FIRST = false;

/** Normalize API response: backend may return snake_case */
function normalizeField(raw: Record<string, unknown>): TablePlatformField {
  return {
    id: String(raw.id ?? ''),
    tableId: String(raw.table_id ?? raw.tableId ?? ''),
    name: String(raw.name ?? ''),
    fieldType: String(raw.field_type ?? raw.fieldType ?? 'singleLineText').replace(
      /_/g,
      ''
    ) as TablePlatformField['fieldType'],
    options: (raw.options ?? {}) as TablePlatformField['options'],
    isComputed: Boolean(raw.is_computed ?? raw.isComputed ?? false),
    order: Number(raw.field_order ?? raw.order ?? 0),
    createdAt: String(raw.created_at ?? raw.createdAt ?? ''),
    updatedAt: String(raw.updated_at ?? raw.updatedAt ?? ''),
  };
}

function normalizeRecord(raw: Record<string, unknown>): TablePlatformRecord {
  const rawVersion = raw.version ?? (raw as Record<string, unknown>).record_version;
  const version = rawVersion == null || rawVersion === '' ? null : Number(rawVersion);
  return {
    id: String(raw.id ?? ''),
    tableId: String(raw.table_id ?? raw.tableId ?? ''),
    data: (raw.data ?? {}) as Record<string, unknown>,
    createdAt: String(raw.created_at ?? raw.createdAt ?? ''),
    updatedAt: String(raw.updated_at ?? raw.updatedAt ?? ''),
    version: Number.isFinite(version as number) ? (version as number) : null,
  };
}

/** Convert TP filters/sorts to backend API format */
function toBackendFilters(
  tp: TPFilterGroup
): Array<{ field: string; op: string; value?: unknown }> {
  return tp.rules.map((r) => ({ field: r.fieldId, op: r.operator, value: r.value }));
}

function toBackendSorts(
  sorts: TPSortRule[]
): Array<{ fieldId: string; direction: 'asc' | 'desc' }> {
  return sorts.map((s) => ({ fieldId: s.fieldId, direction: s.direction }));
}

export interface UseTablePlatformBridgeOpts {
  ideaId: string;
  enabled: boolean;
  /** When set, load this `tp_tables` row if it belongs to `ideaId` (via base.workspace_id). */
  preferredTableId?: string | null;
}

export interface UseTablePlatformBridgeReturn {
  isNewPlatform: boolean;
  loading: boolean;
  error: string | null;
  platformFailed: boolean;

  base: TablePlatformBase | null;
  table: TablePlatformTable | null;
  fields: TablePlatformField[];
  views: TablePlatformView[];

  records: TablePlatformRecord[];
  totalRecords: number;
  hasMore: boolean;

  columns: ColumnDef[];
  nodes: TableNode[];

  createRecord: (data: Record<string, unknown>) => Promise<TablePlatformRecord | null>;
  updateRecord: (
    recordId: string,
    data: Record<string, unknown>
  ) => Promise<TablePlatformRecord | null>;
  deleteRecord: (recordId: string) => Promise<boolean>;
  addField: (
    name: string,
    fieldType: string,
    options?: Record<string, unknown>
  ) => Promise<TablePlatformField | null>;
  updateField: (
    fieldId: string,
    updates: { name?: string; options?: Record<string, unknown> }
  ) => Promise<void>;
  createView: (
    name: string,
    viewType?: string,
    config?: Record<string, unknown>
  ) => Promise<TablePlatformView | null>;
  updateView: (viewId: string, updates: Record<string, unknown>) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  applyFilters: (filters: TPFilterGroup) => Promise<void>;
  applySorts: (sorts: TPSortRule[]) => Promise<void>;

  /** Canonical `tp_tables.id` currently loaded (realtime room id). Null until first load. */
  loadedTableId: string | null;
  /** Apply a `record:created` broadcast to local state (echo-safe, table-scoped). */
  applyRealtimeCreated: (payload: unknown) => void;
  /** Apply a `record:updated` broadcast to local state (version-gated echo protection). */
  applyRealtimeUpdated: (recordId: string, payload: unknown) => void;
  /** Apply a `record:deleted` broadcast to local state (no-op if absent locally). */
  applyRealtimeDeleted: (recordId: string) => void;
  /** Re-fetch fields/views/records after a peer's `schema:changed` broadcast. */
  applyRealtimeSchemaChanged: () => void;
}

async function resolveTargetTableForIdea(
  ideaId: string,
  preferredTableId: string | null | undefined,
  ensured: { baseId: string; tableId: string }
): Promise<{ baseId: string; tableId: string }> {
  const fallback = { baseId: ensured.baseId, tableId: ensured.tableId };
  const raw = preferredTableId?.trim();
  if (!raw) return fallback;
  try {
    const tableRes = (await TablePlatformApi.getTable(raw)) as Record<string, unknown>;
    const tableBaseId = String(tableRes.base_id ?? tableRes.baseId ?? '');
    if (!tableBaseId) return fallback;
    const baseRes = (await TablePlatformApi.getBase(tableBaseId)) as Record<string, unknown>;
    const workspaceId = String(baseRes.workspace_id ?? baseRes.workspaceId ?? '');
    if (workspaceId !== ideaId) return fallback;
    return { baseId: tableBaseId, tableId: raw };
  } catch {
    return fallback;
  }
}

export function useTablePlatformBridge(
  opts: UseTablePlatformBridgeOpts
): UseTablePlatformBridgeReturn {
  const { ideaId, enabled, preferredTableId } = opts;
  const { isEnabled } = useFeatureFlagsContext();
  const isNewPlatform =
    enabled && isEnabled('tablePlatformMetadataFirst') && !HARD_DISABLE_METADATA_FIRST;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platformFailed, setPlatformFailed] = useState(false);
  const [base, setBase] = useState<TablePlatformBase | null>(null);
  const [table, setTable] = useState<TablePlatformTable | null>(null);
  const [fields, setFields] = useState<TablePlatformField[]>([]);
  const [views, setViews] = useState<TablePlatformView[]>([]);
  const [records, setRecords] = useState<TablePlatformRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState<TPFilterGroup>({ logic: 'and', rules: [] });
  const [sorts, setSorts] = useState<TPSortRule[]>([]);

  const cursorRef = useRef<string | undefined>(undefined);
  const tableIdRef = useRef<string | null>(null);
  const [loadedTableId, setLoadedTableId] = useState<string | null>(null);
  /**
   * Last known `version` per recordId. Own mutations (create/update) advance
   * this from the server response; a realtime echo whose version is not
   * strictly newer is dropped — this is the echo-protection contract.
   */
  const recordVersionsRef = useRef<Map<string, number>>(new Map());

  const rememberVersion = useCallback((rec: TablePlatformRecord | null | undefined) => {
    if (!rec?.id || rec.version == null) return;
    recordVersionsRef.current.set(rec.id, rec.version);
  }, []);

  const columns = fields.map(fieldToColumn);
  const nodes = records.map((r) => recordToNode(r, fields));

  const ensureBaseAndTable = useCallback(async (): Promise<{
    baseId: string;
    tableId: string;
    base?: Record<string, unknown>;
  } | null> => {
    try {
      const bases = await TablePlatformApi.listBases(ideaId);
      let baseRow = Array.isArray(bases) ? bases[0] : null;

      if (!baseRow) {
        baseRow = await TablePlatformApi.createBase(ideaId, 'Default');
        if (!baseRow) return null;
      }

      const baseId = String((baseRow as Record<string, unknown>).id ?? '');
      const fullBase = await TablePlatformApi.getBase(baseId);
      const baseData = fullBase as Record<string, unknown>;
      const tables = (baseData?.tables ?? []) as Record<string, unknown>[];
      let tableRow = tables[0] ?? null;

      if (!tableRow) {
        tableRow = await TablePlatformApi.createTable(baseId, 'Table', undefined);
        if (!tableRow) return null;
      }

      const tableId = String((tableRow as Record<string, unknown>).id ?? '');
      return { baseId, tableId, base: baseData };
    } catch (err) {
      console.error(
        '[TablePlatformBridge] ensureBaseAndTable failed, falling back to legacy:',
        err
      );
      setPlatformFailed(true);
      return null;
    }
  }, [ideaId]);

  const loadData = useCallback(
    async (filtersOverride?: TPFilterGroup, sortsOverride?: TPSortRule[]) => {
      if (!isNewPlatform || !enabled) return;

      const effectiveFilters = filtersOverride ?? filters;
      const effectiveSorts = sortsOverride ?? sorts;

      setLoading(true);
      setError(null);
      try {
        const result = await ensureBaseAndTable();
        if (!result) {
          setError(
            i18n.t(
              'ideas.table.tablePlatformBridge.failedToInitializeBaseOrTable',
              'Failed to initialize base or table'
            )
          );
          setLoading(false);
          return;
        }

        const { baseId: ensuredBaseId, tableId: ensuredTableId } = result;
        const { baseId, tableId } = await resolveTargetTableForIdea(ideaId, preferredTableId, {
          baseId: ensuredBaseId,
          tableId: ensuredTableId,
        });
        tableIdRef.current = tableId;
        setLoadedTableId(tableId);
        cursorRef.current = undefined;

        const [baseRes, tableRes] = await Promise.all([
          TablePlatformApi.getBase(baseId),
          TablePlatformApi.getTable(tableId),
        ]);

        const baseData = baseRes as Record<string, unknown>;
        const tableData = tableRes as Record<string, unknown>;
        const rawFields = (tableData.fields ?? []) as Record<string, unknown>[];
        const rawViews = (tableData.views ?? []) as Record<string, unknown>[];

        const normFields = rawFields.map(normalizeField);
        const normViews = rawViews.map((v) => ({
          id: String(v.id ?? ''),
          tableId: String(v.table_id ?? v.tableId ?? ''),
          name: String(v.name ?? ''),
          viewType: (v.view_type ?? v.viewType ?? 'grid') as TablePlatformView['viewType'],
          visibleFieldIds: Array.isArray(v.visible_field_ids ?? v.visibleFieldIds)
            ? (v.visible_field_ids ?? v.visibleFieldIds)
            : [],
          config: (v.config ?? {}) as TablePlatformView['config'],
          createdAt: String(v.created_at ?? v.createdAt ?? ''),
          updatedAt: String(v.updated_at ?? v.updatedAt ?? ''),
        })) as TablePlatformView[];

        setBase(baseData as unknown as TablePlatformBase);
        setTable(tableData as unknown as TablePlatformTable);
        setFields(normFields);
        setViews(normViews);

        const listRes = await TablePlatformApi.listRecords(tableId, {
          pageSize: PAGE_SIZE,
          filters: toBackendFilters(effectiveFilters),
          sorts: toBackendSorts(effectiveSorts),
        });

        const listData = listRes as {
          records?: unknown[];
          total?: number;
          cursor?: string;
          hasMore?: boolean;
        };
        const rawRecords = (listData.records ?? []) as Record<string, unknown>[];
        const normRecords = rawRecords.map(normalizeRecord);
        recordVersionsRef.current = new Map();
        normRecords.forEach(rememberVersion);
        setRecords(normRecords);
        setTotalRecords(Number(listData.total ?? rawRecords.length));
        setHasMore(Boolean(listData.hasMore ?? false));
        cursorRef.current = listData.cursor;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : i18n.t(
                'ideas.table.tablePlatformBridge.failedToLoadTableData',
                'Failed to load table data'
              )
        );
        setRecords([]);
        setTotalRecords(0);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [
      isNewPlatform,
      enabled,
      ensureBaseAndTable,
      filters,
      sorts,
      ideaId,
      preferredTableId,
      rememberVersion,
    ]
  );

  const loadMore = useCallback(async () => {
    const tableId = tableIdRef.current;
    if (!tableId || !cursorRef.current || !hasMore) return;

    setLoading(true);
    setError(null);
    try {
      const listRes = await TablePlatformApi.listRecords(tableId, {
        pageSize: PAGE_SIZE,
        cursor: cursorRef.current,
        filters: toBackendFilters(filters),
        sorts: toBackendSorts(sorts),
      });

      const listData = listRes as {
        records?: unknown[];
        total?: number;
        cursor?: string;
        hasMore?: boolean;
      };
      const rawRecords = (listData.records ?? []) as Record<string, unknown>[];
      const newRecords = rawRecords.map(normalizeRecord);
      newRecords.forEach(rememberVersion);
      setRecords((prev) => [...prev, ...newRecords]);
      setHasMore(Boolean(listData.hasMore ?? false));
      cursorRef.current = listData.cursor;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : i18n.t(
              'ideas.table.tablePlatformBridge.failedToLoadMoreRecords',
              'Failed to load more records'
            )
      );
    } finally {
      setLoading(false);
    }
  }, [hasMore, filters, sorts, rememberVersion]);

  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const createRecord = useCallback(
    async (data: Record<string, unknown>): Promise<TablePlatformRecord | null> => {
      const tableId = tableIdRef.current;
      if (!tableId) return null;

      try {
        const created = await TablePlatformApi.createRecord(tableId, data);
        const norm = normalizeRecord(created as Record<string, unknown>);
        rememberVersion(norm);
        setRecords((prev) => [norm, ...prev]);
        setTotalRecords((t) => t + 1);
        return norm;
      } catch {
        return null;
      }
    },
    [rememberVersion]
  );

  const updateRecord = useCallback(
    async (
      recordId: string,
      data: Record<string, unknown>
    ): Promise<TablePlatformRecord | null> => {
      try {
        const updated = await TablePlatformApi.updateRecord(recordId, data);
        const norm = normalizeRecord(updated as Record<string, unknown>);
        rememberVersion(norm);
        setRecords((prev) => prev.map((r) => (r.id === recordId ? norm : r)));
        return norm;
      } catch {
        return null;
      }
    },
    [rememberVersion]
  );

  const deleteRecord = useCallback(async (recordId: string): Promise<boolean> => {
    try {
      await TablePlatformApi.deleteRecord(recordId);
      recordVersionsRef.current.delete(recordId);
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
      setTotalRecords((t) => Math.max(0, t - 1));
      return true;
    } catch {
      return false;
    }
  }, []);

  const addField = useCallback(
    async (
      name: string,
      fieldType: string,
      options?: Record<string, unknown>
    ): Promise<TablePlatformField | null> => {
      const tableId = tableIdRef.current;
      if (!tableId) return null;

      try {
        const created = await TablePlatformApi.createField(tableId, name, fieldType, options);
        const norm = normalizeField(created as Record<string, unknown>);
        setFields((prev) => [...prev, norm]);
        return norm;
      } catch {
        return null;
      }
    },
    []
  );

  const updateField = useCallback(
    async (
      fieldId: string,
      updates: { name?: string; options?: Record<string, unknown> }
    ): Promise<void> => {
      try {
        await TablePlatformApi.updateField(fieldId, updates);
        setFields((prev) =>
          prev.map((f) =>
            f.id === fieldId
              ? {
                  ...f,
                  ...(updates.name && { name: updates.name }),
                  ...(updates.options && { options: updates.options }),
                }
              : f
          )
        );
      } catch {
        // ignore
      }
    },
    []
  );

  const createView = useCallback(
    async (
      name: string,
      viewType?: string,
      config?: Record<string, unknown>
    ): Promise<TablePlatformView | null> => {
      const tableId = tableIdRef.current;
      if (!tableId) return null;

      try {
        const created = await TablePlatformApi.createView(
          tableId,
          name,
          viewType ?? 'grid',
          config
        );
        setViews((prev) => [...prev, created as TablePlatformView]);
        return created as TablePlatformView;
      } catch {
        return null;
      }
    },
    []
  );

  const updateView = useCallback(
    async (viewId: string, updates: Record<string, unknown>): Promise<void> => {
      try {
        await TablePlatformApi.updateView(viewId, updates);
        setViews((prev) => prev.map((v) => (v.id === viewId ? { ...v, ...updates } : v)));
      } catch {
        // ignore
      }
    },
    []
  );

  const applyFilters = useCallback(
    async (newFilters: TPFilterGroup) => {
      setFilters(newFilters);
      cursorRef.current = undefined;
      await loadData(newFilters, sorts);
    },
    [loadData, sorts]
  );

  const applySorts = useCallback(
    async (newSorts: TPSortRule[]) => {
      setSorts(newSorts);
      cursorRef.current = undefined;
      await loadData(filters, newSorts);
    },
    [loadData, filters]
  );

  // ── Realtime broadcast appliers ────────────────────────────────────────────
  // Peers' record mutations arrive over Socket.IO (see useTableRealtime). We
  // fold them into `records` (the source of truth); `nodes` and the
  // integration hook's `localNodes` re-derive automatically. All appliers are
  // table-scoped (a broadcast whose table_id ≠ the loaded table is ignored) and
  // defensive (missing records never throw).

  /** True when the payload targets the currently loaded table (or carries no id). */
  const isForLoadedTable = useCallback((payloadTableId: unknown): boolean => {
    const loaded = tableIdRef.current;
    if (!loaded) return false;
    const pid =
      typeof payloadTableId === 'string' && payloadTableId.trim() ? payloadTableId.trim() : null;
    // Row-shaped payloads carry table_id/tableId; when absent (already
    // room-scoped server-side) we trust room membership and accept.
    return pid == null || pid === loaded;
  }, []);

  const applyRealtimeCreated = useCallback(
    (payload: unknown) => {
      const raw = (payload ?? {}) as Record<string, unknown>;
      const rawTableId = raw.table_id ?? raw.tableId;
      if (!isForLoadedTable(rawTableId)) return;
      const norm = normalizeRecord(raw);
      if (!norm.id) return;
      // Echo of our own create (or a duplicate broadcast): merge, don't dupe.
      const known = recordVersionsRef.current.get(norm.id);
      if (known != null && norm.version != null && norm.version <= known) return;
      rememberVersion(norm);
      setRecords((prev) => {
        const idx = prev.findIndex((r) => r.id === norm.id);
        if (idx === -1) {
          setTotalRecords((t) => t + 1);
          return [norm, ...prev];
        }
        const next = [...prev];
        next[idx] = norm;
        return next;
      });
    },
    [isForLoadedTable, rememberVersion]
  );

  const applyRealtimeUpdated = useCallback(
    (recordId: string, payload: unknown) => {
      const id = String(recordId ?? '').trim();
      if (!id) return;
      // `record:updated` payload `data` is the full tp_records row (id, data,
      // version, table_id, updated_at) — NOT the bare cell-values object.
      const raw = (payload ?? {}) as Record<string, unknown>;
      const rawTableId = raw.table_id ?? raw.tableId;
      if (!isForLoadedTable(rawTableId)) return;
      const norm = normalizeRecord({ ...raw, id: raw.id ?? id });
      // Echo protection: drop broadcasts that are not strictly newer than the
      // version we already hold (our own optimistic update already advanced it).
      const known = recordVersionsRef.current.get(id);
      if (known != null && norm.version != null && norm.version <= known) return;
      if (norm.version != null) rememberVersion({ ...norm, id });
      setRecords((prev) => {
        const idx = prev.findIndex((r) => r.id === id);
        // Defensive: an update for a record we don't have locally → adopt it
        // (it may have been created by a peer before we joined) rather than crash.
        if (idx === -1) {
          setTotalRecords((t) => t + 1);
          return [{ ...norm, id }, ...prev];
        }
        const next = [...prev];
        next[idx] = { ...next[idx], data: norm.data, version: norm.version ?? next[idx].version };
        return next;
      });
    },
    [isForLoadedTable, rememberVersion]
  );

  const applyRealtimeDeleted = useCallback((recordId: string) => {
    const id = String(recordId ?? '').trim();
    if (!id) return;
    recordVersionsRef.current.delete(id);
    setRecords((prev) => {
      if (!prev.some((r) => r.id === id)) return prev; // no-op if absent
      setTotalRecords((t) => Math.max(0, t - 1));
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const applyRealtimeSchemaChanged = useCallback(() => {
    // Re-fetch fields/views/records without remounting the component (lesson:
    // remount-on-edit once made this tool unusable). loadData swaps state in place.
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isNewPlatform || !enabled) return;
    void loadData();
  }, [isNewPlatform, enabled, loadData]);

  const noopReturn: UseTablePlatformBridgeReturn = {
    isNewPlatform: false,
    loading: false,
    error: null,
    platformFailed: false,
    base: null,
    table: null,
    fields: [],
    views: [],
    records: [],
    totalRecords: 0,
    hasMore: false,
    columns: [],
    nodes: [],
    createRecord: async () => null,
    updateRecord: async () => null,
    deleteRecord: async () => false,
    addField: async () => null,
    updateField: async () => {},
    createView: async () => null,
    updateView: async () => {},
    loadMore: async () => {},
    refresh: async () => {},
    applyFilters: async () => {},
    applySorts: async () => {},
    loadedTableId: null,
    applyRealtimeCreated: () => {},
    applyRealtimeUpdated: () => {},
    applyRealtimeDeleted: () => {},
    applyRealtimeSchemaChanged: () => {},
  };

  if (!isNewPlatform) return noopReturn;

  if (platformFailed) {
    return { ...noopReturn, platformFailed: true };
  }

  return {
    isNewPlatform: true,
    loading,
    error,
    platformFailed: false,
    base,
    table,
    fields,
    views,
    records,
    totalRecords,
    hasMore,
    columns,
    nodes,
    createRecord,
    updateRecord,
    deleteRecord,
    addField,
    updateField,
    createView,
    updateView,
    loadMore,
    refresh,
    applyFilters,
    applySorts,
    loadedTableId,
    applyRealtimeCreated,
    applyRealtimeUpdated,
    applyRealtimeDeleted,
    applyRealtimeSchemaChanged,
  };
}
