/**
 * useTablePlatformViews — server-backed view management for the Table Platform.
 * Drop-in replacement for useTableViews when the metadata-first flag is on.
 */

import { useCallback, useEffect, useState } from 'react';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import type { TablePlatformField, TablePlatformView } from '@/types/tablePlatform';

import { legacyViewToTP, tpViewToLegacy } from './tablePlatformMappers';
import type { ColumnDef, FilterGroup, SavedView, SortConfig } from './tableTypes';
import type { ViewLayout } from './useTableViews';

export interface UseTablePlatformViewsOpts {
  tableId: string | null;
  fields: TablePlatformField[];
  enabled: boolean;
}

export interface UseTablePlatformViewsReturn {
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
  loading: boolean;
}

function normalizeView(raw: Record<string, unknown>): TablePlatformView {
  return {
    id: String(raw.id ?? ''),
    tableId: String(raw.table_id ?? raw.tableId ?? ''),
    name: String(raw.name ?? ''),
    viewType: (raw.view_type ?? raw.viewType ?? 'grid') as TablePlatformView['viewType'],
    visibleFieldIds: Array.isArray(raw.visible_field_ids ?? raw.visibleFieldIds)
      ? ((raw.visible_field_ids ?? raw.visibleFieldIds) as string[])
      : [],
    config: (raw.config ?? {}) as TablePlatformView['config'],
    createdAt: String(raw.created_at ?? raw.createdAt ?? ''),
    updatedAt: String(raw.updated_at ?? raw.updatedAt ?? ''),
  };
}

export function useTablePlatformViews(
  opts: UseTablePlatformViewsOpts
): UseTablePlatformViewsReturn {
  const { tableId, fields, enabled } = opts;

  const [loading, setLoading] = useState(false);
  const [viewLayout, setViewLayout] = useState<ViewLayout>('table');
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState('');
  const [sort, setSort] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<FilterGroup>({ logic: 'and', rules: [] });
  const [groupBy, setGroupBy] = useState<string | null>(null);

  const fetchViews = useCallback(async () => {
    if (!tableId || !enabled) return;
    setLoading(true);
    try {
      const tableRes = await TablePlatformApi.getTable(tableId);
      const tableData = tableRes as Record<string, unknown>;
      const rawViews = (tableData?.views ?? []) as Record<string, unknown>[];
      const tpViews = rawViews.map(normalizeView);
      const legacy = tpViews.map((v) => tpViewToLegacy(v, fields));
      setSavedViews(legacy);
      setActiveViewId((prev) => prev || (legacy[0]?.id ?? ''));
    } catch {
      setSavedViews([]);
    } finally {
      setLoading(false);
    }
  }, [tableId, enabled, fields]);

  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  const applyView = useCallback((view: SavedView) => {
    setActiveViewId(view.id);
    setSort(view.sort?.[0] ?? null);
    setFilters(view.filters ?? { logic: 'and', rules: [] });
    setGroupBy(view.groupBy ?? null);
    // Same fix as the legacy useTableViews.applyView: always resolve
    // viewLayout so switching to a view without its own layout doesn't leave
    // the previous view's layout (e.g. 'timeline') stuck.
    setViewLayout(view.layout ?? 'table');
  }, []);

  const saveCurrentView = useCallback(
    async (name: string, columns: ColumnDef[]): Promise<void> => {
      if (!tableId || !enabled) return;
      setLoading(true);
      try {
        const legacyView: SavedView = {
          id: '',
          name,
          sort: sort ? [sort] : undefined,
          filters: filters.rules.length > 0 ? filters : undefined,
          groupBy: groupBy ?? undefined,
          layout: viewLayout,
          columns: columns.map((c) => ({ key: c.key, visible: c.visible, width: c.width })),
        };
        const config = legacyViewToTP(legacyView);
        const viewType = viewLayout === 'table' ? 'grid' : viewLayout;
        const created = await TablePlatformApi.createView(tableId, name, viewType, config);
        const createdId = String((created as Record<string, unknown>)?.id ?? '');
        const visibleFieldIds = columns.map((c) => c.key);
        if (createdId && visibleFieldIds.length > 0) {
          await TablePlatformApi.updateView(createdId, {
            visibleFieldIds,
          });
        }
        await fetchViews();
        if (createdId) setActiveViewId(createdId);
      } finally {
        setLoading(false);
      }
    },
    [tableId, enabled, sort, filters, groupBy, viewLayout, fetchViews]
  );

  const updateSavedView = useCallback(
    async (viewId: string, patch: Partial<SavedView>): Promise<void> => {
      if (!enabled) return;
      setLoading(true);
      try {
        const updates: {
          name?: string;
          config?: Record<string, unknown>;
          visibleFieldIds?: string[];
        } = {};
        if (patch.name !== undefined) updates.name = patch.name;
        if (
          patch.sort !== undefined ||
          patch.filters !== undefined ||
          patch.groupBy !== undefined ||
          patch.layout !== undefined
        ) {
          const existing = savedViews.find((v) => v.id === viewId);
          const merged: SavedView = {
            id: viewId,
            name: patch.name ?? existing?.name ?? '',
            sort: patch.sort ?? existing?.sort,
            filters: patch.filters ?? existing?.filters,
            groupBy: patch.groupBy ?? existing?.groupBy,
            layout: patch.layout ?? existing?.layout,
          };
          updates.config = legacyViewToTP(merged);
        }
        if (patch.columns !== undefined) {
          updates.visibleFieldIds = patch.columns.map((c) => c.key);
        }
        if (Object.keys(updates).length > 0) {
          await TablePlatformApi.updateView(viewId, updates);
          await fetchViews();
        }
      } finally {
        setLoading(false);
      }
    },
    [enabled, fetchViews, savedViews]
  );

  const deleteSavedView = useCallback(
    async (viewId: string): Promise<void> => {
      if (!enabled) return;
      setLoading(true);
      try {
        await TablePlatformApi.deleteView(viewId);
        setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
        if (activeViewId === viewId) {
          const remaining = savedViews.filter((v) => v.id !== viewId);
          setActiveViewId(remaining[0]?.id ?? '');
        }
      } finally {
        setLoading(false);
      }
    },
    [enabled, activeViewId, savedViews]
  );

  return {
    viewLayout,
    setViewLayout,
    savedViews,
    activeViewId,
    setActiveViewId,
    sort,
    setSort,
    filters,
    setFilters,
    groupBy,
    setGroupBy,
    applyView,
    saveCurrentView,
    updateSavedView,
    deleteSavedView,
    loading,
  };
}
