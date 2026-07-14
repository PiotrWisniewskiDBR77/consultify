/**
 * useTableRows — domain hook for row operations.
 *
 * Owns: processedRows, groupedRows, selection, field change, bulk delete,
 *       add row, add sub-item, reorder, template select.
 */
import { useCallback, useMemo, useState } from 'react';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { EMPTY_SELECTION, type IdeaWorkspaceSelection } from '../ideaSelectionTypes';
import { evaluateFilterRule } from './filterEval';
import { createNodeFromTemplate, type RowTemplate } from './RowTemplatePicker';
import type { FilterGroup, SortConfig, TableNode } from './tableTypes';
import type { UseUndoRedoReturn } from './useUndoRedo';

export interface UseTableRowsOpts {
  ideaId: string;
  locked: boolean;
  t: (key: string, fallback?: string) => string;
  currentUserName?: string;
  nodesUndo: UseUndoRedoReturn<TableNode[]>;
  sort: SortConfig | null;
  filters: FilterGroup;
  filterInput: string;
  groupBy: string | null;
  focusMode?: 'system' | 'object' | null;
  focusObjectId?: string | null;
  onSelectionChange?: (sel: IdeaWorkspaceSelection) => void;
}

export interface UseTableRowsReturn {
  nodes: TableNode[];
  processedRows: TableNode[];
  groupedRows: Record<string, TableNode[]> | null;
  selectedRowIds: Set<string>;
  setSelectedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleRowSelection: (id: string) => void;
  handleFieldChange: (id: string, field: string, value: any) => void;
  handleAddRow: () => void;
  handleAddRowWithTemplate: (e?: React.MouseEvent) => void;
  handleTemplateSelect: (template: RowTemplate) => void;
  handleBulkDelete: () => void;
  handleDeleteRow: (id: string) => void;
  handleDuplicateRow: (id: string) => void;
  handleReorderNode: (nodeId: string, targetIdx: number) => void;
  handleAddSubItem: (parentId: string) => void;
  showRowTemplatePicker: boolean;
  setShowRowTemplatePicker: React.Dispatch<React.SetStateAction<boolean>>;
  addRowBtnRect: DOMRect | null;
  setAddRowBtnRect: React.Dispatch<React.SetStateAction<DOMRect | null>>;
}

export function useTableRows(opts: UseTableRowsOpts): UseTableRowsReturn {
  const {
    ideaId,
    locked,
    t,
    currentUserName = 'current-user',
    nodesUndo,
    sort,
    filters,
    filterInput,
    groupBy,
    focusMode,
    focusObjectId,
    onSelectionChange,
  } = opts;

  const nodes = nodesUndo.state;

  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [showRowTemplatePicker, setShowRowTemplatePicker] = useState(false);
  const [addRowBtnRect, setAddRowBtnRect] = useState<DOMRect | null>(null);

  // ── Processed rows ──
  const processedRows = useMemo(() => {
    let rows = (nodes || []).filter((n) => String(n?.type || '') !== 'frame');

    if (focusMode === 'object' && focusObjectId) {
      rows = rows.filter((r) => r.id === focusObjectId);
    }

    if (filters.rules.length > 0) {
      rows = rows.filter((r) => {
        // M08 L-02: shared evaluator handles the full FilterBuilder operator set
        // (startsWith/notEquals/isEmpty/gte/isAnyOf/between/dates/…), not just 6.
        const results = filters.rules.map((rule) => evaluateFilterRule(rule, r));
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
  }, [filters, filterInput, focusMode, focusObjectId, nodes, sort]);

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

  // ── Selection ──
  const toggleRowSelection = useCallback(
    (id: string) => {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        const sel: IdeaWorkspaceSelection =
          next.size > 0
            ? { type: 'row', count: next.size, ids: Array.from(next), primaryId: id }
            : EMPTY_SELECTION;
        onSelectionChange?.(sel);
        return next;
      });
    },
    [onSelectionChange]
  );

  // ── Field change (auto-stamps last_edited_time/by) ──
  const handleFieldChange = useCallback(
    (id: string, field: string, value: any) => {
      const now = new Date().toISOString();
      const next = nodes.map((n) => {
        if (n.id !== id) return n;
        return {
          ...n,
          data: {
            ...(n.data || {}),
            [field]: value,
            last_edited_time: now,
            last_edited_by: currentUserName,
          },
        };
      });
      nodesUndo.push(next);
    },
    [nodes, nodesUndo]
  );

  // ── Add row (auto-stamps created_time/by) ──
  const handleAddRow = useCallback(() => {
    if (locked) return;
    const id = `node-${Date.now()}`;
    const now = new Date().toISOString();
    const newNode: TableNode = {
      id,
      type: 'idea',
      data: {
        label: '',
        status: 'todo',
        priority: 'Medium',
        created_time: now,
        created_by: currentUserName,
        last_edited_time: now,
        last_edited_by: currentUserName,
      },
      position: { x: 0, y: 0 },
    };
    nodesUndo.push([...nodes, newNode]);
    trackFunnelEvent('ideas_table_row_added', { ideaId });
  }, [ideaId, locked, nodes, nodesUndo]);

  const handleAddRowWithTemplate = useCallback(
    (e?: React.MouseEvent) => {
      if (locked) return;
      if (e) {
        setAddRowBtnRect((e.currentTarget as HTMLElement).getBoundingClientRect());
      }
      setShowRowTemplatePicker(true);
    },
    [locked]
  );

  const handleTemplateSelect = useCallback(
    (template: RowTemplate) => {
      if (locked) return;
      const newNode = createNodeFromTemplate(template);
      nodesUndo.push([...nodes, newNode]);
      trackFunnelEvent('ideas_table_row_added', { ideaId, template: template.id });
    },
    [ideaId, locked, nodes, nodesUndo]
  );

  // ── Bulk delete ──
  const handleBulkDelete = useCallback(() => {
    if (locked || selectedRowIds.size === 0) return;
    const next = nodes.filter((n) => !selectedRowIds.has(n.id));
    nodesUndo.push(next);
    setSelectedRowIds(new Set());
    onSelectionChange?.(EMPTY_SELECTION);
  }, [locked, nodes, nodesUndo, onSelectionChange, selectedRowIds]);

  // ── Single-row delete (row context menu) ──
  const handleDeleteRow = useCallback(
    (id: string) => {
      if (locked) return;
      const next = nodes.filter((n) => n.id !== id);
      nodesUndo.push(next);
      setSelectedRowIds((prev) => {
        if (!prev.has(id)) return prev;
        const nextSel = new Set(prev);
        nextSel.delete(id);
        onSelectionChange?.(
          nextSel.size > 0
            ? { type: 'row', count: nextSel.size, ids: Array.from(nextSel) }
            : EMPTY_SELECTION
        );
        return nextSel;
      });
    },
    [locked, nodes, nodesUndo, onSelectionChange]
  );

  // ── Single-row duplicate (row context menu) ──
  const handleDuplicateRow = useCallback(
    (id: string) => {
      if (locked) return;
      const source = nodes.find((n) => n.id === id);
      if (!source) return;
      const idx = nodes.findIndex((n) => n.id === id);
      const newId = `node-${Date.now()}`;
      const now = new Date().toISOString();
      const label = String(source.data?.label || '');
      const newNode: TableNode = {
        ...source,
        id: newId,
        data: {
          ...(source.data || {}),
          label: label ? `${label} ${t('ideas.table.copySuffix', '(copy)')}` : '',
          created_time: now,
          created_by: currentUserName,
          last_edited_time: now,
          last_edited_by: currentUserName,
        },
        position: { x: 0, y: 0 },
      };
      const next = [...nodes];
      next.splice(idx + 1, 0, newNode);
      nodesUndo.push(next);
      trackFunnelEvent('ideas_table_row_added', { ideaId, duplicatedFrom: id });
    },
    [currentUserName, ideaId, t, locked, nodes, nodesUndo]
  );

  // ── Reorder ──
  const handleReorderNode = useCallback(
    (nodeId: string, targetIdx: number) => {
      const fromIdx = nodes.findIndex((n) => n.id === nodeId);
      if (fromIdx < 0 || fromIdx === targetIdx) return;
      const next = [...nodes];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(targetIdx, 0, moved);
      nodesUndo.push(next);
    },
    [nodes, nodesUndo]
  );

  // ── Sub-items ──
  const handleAddSubItem = useCallback(
    (parentId: string) => {
      if (locked) return;
      const childId = `node-${Date.now()}`;
      const childNode: TableNode = {
        id: childId,
        type: 'idea',
        data: { label: '' },
        position: { x: 0, y: 0 },
      };
      const updatedNodes = nodes.map((n) => {
        if (n.id !== parentId) return n;
        return {
          ...n,
          data: { ...(n.data || {}), children: [...(n.data?.children || []), childId] },
        };
      });
      nodesUndo.push([...updatedNodes, childNode]);
    },
    [locked, nodes, nodesUndo]
  );

  return {
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
    handleDeleteRow,
    handleDuplicateRow,
    handleReorderNode,
    handleAddSubItem,
    showRowTemplatePicker,
    setShowRowTemplatePicker,
    addRowBtnRect,
    setAddRowBtnRect,
  };
}
