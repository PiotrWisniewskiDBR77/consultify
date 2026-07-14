/**
 * useTableViews — domain hook for view state and saved-view governance.
 *
 * Owns: viewLayout, savedViews, activeViewId, sort, filters, groupBy, applyView, cycleSort.
 * Supports per-view column visibility via onApplyColumns callback.
 */
import { useCallback, useState } from 'react';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import type { ColumnDef, FilterGroup, SavedView, SortConfig } from './tableTypes';

export type ViewLayout =
  | 'table'
  | 'kanban'
  | 'timeline'
  | 'calendar'
  | 'matrix'
  | 'grid'
  | 'sticky';

export interface UseTableViewsOpts {
  t: (key: string, fallback?: string) => string;
  ideaId: string;
  onApplyColumns?: (viewColumns: { key: string; visible: boolean; width: number }[]) => void;
}

export interface UseTableViewsReturn {
  viewLayout: ViewLayout;
  setViewLayout: React.Dispatch<React.SetStateAction<ViewLayout>>;
  savedViews: SavedView[];
  setSavedViews: React.Dispatch<React.SetStateAction<SavedView[]>>;
  activeViewId: string;
  setActiveViewId: React.Dispatch<React.SetStateAction<string>>;
  sort: SortConfig | null;
  setSort: React.Dispatch<React.SetStateAction<SortConfig | null>>;
  filters: FilterGroup;
  setFilters: React.Dispatch<React.SetStateAction<FilterGroup>>;
  groupBy: string | null;
  setGroupBy: React.Dispatch<React.SetStateAction<string | null>>;
  filterInput: string;
  setFilterInput: React.Dispatch<React.SetStateAction<string>>;
  applyView: (view: SavedView) => void;
  saveCurrentView: (name: string, columns: ColumnDef[]) => void;
  updateSavedView: (viewId: string, patch: Partial<SavedView>) => void;
  deleteSavedView: (viewId: string) => void;
  cycleSort: (key: string) => void;
}

export function useTableViews(opts: UseTableViewsOpts): UseTableViewsReturn {
  const { t, ideaId, onApplyColumns } = opts;

  const [viewLayout, setViewLayout] = useState<ViewLayout>('table');

  const [savedViews, setSavedViews] = useState<SavedView[]>([
    { id: 'default', name: t('ideas.table.viewPreset.default', 'Default') },
    { id: 'triage', name: t('ideas.table.viewPreset.triage', 'Triage'), groupBy: 'status' },
    {
      id: 'scoring',
      name: t('ideas.table.viewPreset.scoring', 'Scoring'),
      sort: [{ key: 'score', direction: 'desc' as const }],
    },
    {
      id: 'decision_log',
      name: t('ideas.table.viewPreset.decisionLog', 'Decision Log'),
      groupBy: 'decision',
    },
    {
      id: 'timeline_view',
      name: 'Timeline',
      layout: 'timeline' as const,
    },
  ]);
  const [activeViewId, setActiveViewId] = useState('default');

  const [sort, setSort] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<FilterGroup>({ logic: 'and', rules: [] });
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [filterInput, setFilterInput] = useState('');

  const applyView = useCallback(
    (view: SavedView) => {
      setActiveViewId(view.id);
      setSort(view.sort?.[0] ?? null);
      setFilters(view.filters ?? { logic: 'and', rules: [] });
      setGroupBy(view.groupBy ?? null);
      if (view.layout) setViewLayout(view.layout);
      if (view.columns && onApplyColumns) {
        onApplyColumns(view.columns);
      }
      trackFunnelEvent('ideas_table_view_changed', { viewId: view.id, ideaId });
    },
    [ideaId, onApplyColumns]
  );

  const saveCurrentView = useCallback(
    (name: string, columns: ColumnDef[]) => {
      const id = `view_${Date.now()}`;
      const newView: SavedView = {
        id,
        name,
        sort: sort ? [sort] : undefined,
        filters: filters.rules.length > 0 ? filters : undefined,
        groupBy: groupBy ?? undefined,
        layout: viewLayout,
        columns: columns.map((c) => ({ key: c.key, visible: c.visible, width: c.width })),
      };
      setSavedViews((prev) => [...prev, newView]);
      setActiveViewId(id);
      trackFunnelEvent('ideas_table_view_changed', { viewId: id, ideaId });
    },
    [filters, groupBy, ideaId, sort, viewLayout]
  );

  const updateSavedView = useCallback((viewId: string, patch: Partial<SavedView>) => {
    setSavedViews((prev) => prev.map((v) => (v.id === viewId ? { ...v, ...patch } : v)));
  }, []);

  const deleteSavedView = useCallback(
    (viewId: string) => {
      setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
      if (activeViewId === viewId) setActiveViewId('default');
    },
    [activeViewId]
  );

  const cycleSort = useCallback(
    (key: string) => {
      setSort((prev) => {
        if (!prev || prev.key !== key) return { key, direction: 'asc' };
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return null;
      });
      trackFunnelEvent('ideas_table_sort_applied', { key, ideaId });
    },
    [ideaId]
  );

  return {
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
  };
}
