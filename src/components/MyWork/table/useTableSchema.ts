/**
 * useTableSchema — domain hook for column/property management.
 *
 * Owns: columns state, add/toggle/resize/reorder columns, default columns init.
 * Does NOT own: persistence (that stays in useTablePersistence).
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import type { ColumnDef } from './tableTypes';
import { DEFAULT_COLUMN_WIDTH, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH } from './tableTypes';

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'type', header: 'Type', type: 'text', visible: true, width: 100 },
  { key: 'label', header: 'Label', type: 'text', visible: true, width: 240 },
  {
    key: 'status',
    header: 'Status',
    type: 'status',
    visible: true,
    width: 130,
    options: ['todo', 'in_progress', 'done', 'blocked'],
    optionColors: {
      todo: '#e0e7ff',
      in_progress: '#fef3c7',
      done: '#d1fae5',
      blocked: '#fee2e2',
    },
  },
  {
    key: 'priority',
    header: 'Priority',
    type: 'select',
    visible: true,
    width: 110,
    options: ['Low', 'Medium', 'High', 'Critical'],
    optionColors: { Low: '#d1fae5', Medium: '#fef3c7', High: '#fce7f3', Critical: '#fee2e2' },
  },
  { key: 'owner', header: 'Owner', type: 'person', visible: false, width: 140 },
  { key: 'impact', header: 'Impact', type: 'rating', visible: false, width: 120 },
  { key: 'effort', header: 'Effort', type: 'rating', visible: false, width: 120 },
  { key: 'created_time', header: 'Created', type: 'created_time', visible: false, width: 150 },
  { key: 'created_by', header: 'Created by', type: 'created_by', visible: false, width: 130 },
  {
    key: 'last_edited_time',
    header: 'Last edited',
    type: 'last_edited_time',
    visible: false,
    width: 150,
  },
  {
    key: 'last_edited_by',
    header: 'Last edited by',
    type: 'last_edited_by',
    visible: false,
    width: 130,
  },
];

export { DEFAULT_COLUMNS };

function localizeHeader(
  key: string,
  header: string,
  t: (key: string, fallback?: string) => string
): string {
  return t(`ideas.table.column.${key}`, header);
}

export interface UseTableSchemaReturn {
  columns: ColumnDef[];
  setColumns: React.Dispatch<React.SetStateAction<ColumnDef[]>>;
  visibleColumns: ColumnDef[];
  toggleColumn: (key: string) => void;
  handleAddColumn: (col: ColumnDef) => void;
  renameColumn: (key: string, newHeader: string) => void;
  updateColumnConfig: (key: string, patch: Partial<ColumnDef>) => void;
  deleteColumn: (key: string) => void;
  handleResizeStart: (colKey: string, e: React.MouseEvent) => void;
  handleColDragStart: (key: string) => void;
  handleColDragOver: (e: React.DragEvent, targetKey: string) => void;
  handleColDragEnd: () => void;
  resizingCol: string | null;
  dragColKey: string | null;
  mergePersistedColumns: (saved: ColumnDef[]) => void;
}

export function useTableSchema(
  t: (key: string, fallback?: string) => string,
  ideaId: string
): UseTableSchemaReturn {
  const [columns, setColumns] = useState<ColumnDef[]>(
    DEFAULT_COLUMNS.map((c) => ({ ...c, header: localizeHeader(c.key, c.header, t) }))
  );

  const visibleColumns = useMemo(() => columns.filter((c) => c.visible), [columns]);

  const toggleColumn = useCallback((key: string) => {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  }, []);

  const handleAddColumn = useCallback(
    (col: ColumnDef) => {
      setColumns((prev) => [...prev, col]);
      trackFunnelEvent('ideas_table_column_added', { key: col.key, type: col.type, ideaId });
    },
    [ideaId]
  );

  const renameColumn = useCallback(
    (key: string, newHeader: string) => {
      if (!newHeader.trim()) return;
      setColumns((prev) =>
        prev.map((c) => (c.key === key ? { ...c, header: newHeader.trim() } : c))
      );
      trackFunnelEvent('ideas_table_column_renamed', { key, ideaId });
    },
    [ideaId]
  );

  const updateColumnConfig = useCallback(
    (key: string, patch: Partial<ColumnDef>) => {
      setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
      trackFunnelEvent('ideas_table_column_config_updated', { key, ideaId });
    },
    [ideaId]
  );

  const deleteColumn = useCallback(
    (key: string) => {
      setColumns((prev) => prev.filter((c) => c.key !== key));
      trackFunnelEvent('ideas_table_column_deleted', { key, ideaId });
    },
    [ideaId]
  );

  // ── Resize ──
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);

  const handleResizeStart = useCallback(
    (colKey: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizingCol(colKey);
      resizeStartXRef.current = e.clientX;
      const col = columns.find((c) => c.key === colKey);
      resizeStartWidthRef.current = col?.width || DEFAULT_COLUMN_WIDTH;

      const handleMove = (ev: MouseEvent) => {
        const delta = ev.clientX - resizeStartXRef.current;
        const newWidth = Math.max(
          MIN_COLUMN_WIDTH,
          Math.min(MAX_COLUMN_WIDTH, resizeStartWidthRef.current + delta)
        );
        setColumns((prev) => prev.map((c) => (c.key === colKey ? { ...c, width: newWidth } : c)));
      };
      const handleUp = () => {
        setResizingCol(null);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [columns]
  );

  // ── Drag reorder ──
  const [dragColKey, setDragColKey] = useState<string | null>(null);

  const handleColDragStart = useCallback((key: string) => setDragColKey(key), []);
  const handleColDragOver = useCallback(
    (e: React.DragEvent, targetKey: string) => {
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
    },
    [dragColKey]
  );
  const handleColDragEnd = useCallback(() => setDragColKey(null), []);

  const mergePersistedColumns = useCallback((saved: ColumnDef[]) => {
    setColumns((prev) => {
      const savedMap = new Map(saved.map((s) => [s.key, s]));
      const merged = prev.map((col) => {
        const match = savedMap.get(col.key);
        return match ? { ...col, ...match } : col;
      });
      const newCols = saved.filter((s) => !prev.some((p) => p.key === s.key));
      return [...merged, ...newCols];
    });
  }, []);

  return {
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
  };
}
