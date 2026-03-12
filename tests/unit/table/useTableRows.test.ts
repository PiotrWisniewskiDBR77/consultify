/**
 * Behavior-based tests for useTableRows hook.
 * Tests: add row, field change with system fields, bulk delete, selection, filtering, sorting.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTableRows } from '@/components/MyWork/table/useTableRows';
import type { TableNode } from '@/components/MyWork/table/tableTypes';
import { useUndoRedo } from '@/components/MyWork/table/useUndoRedo';

function makeNode(id: string, data: Record<string, any> = {}): TableNode {
  return { id, type: 'idea', data: { label: id, ...data }, position: { x: 0, y: 0 } };
}

function renderRows(
  initialNodes: TableNode[] = [],
  overrides: Partial<Parameters<typeof useTableRows>[0]> = {}
) {
  return renderHook(() => {
    const nodesUndo = useUndoRedo<TableNode[]>(initialNodes);
    return {
      rows: useTableRows({
        ideaId: 'test-idea',
        locked: false,
        isPl: false,
        nodesUndo,
        sort: null,
        filters: { logic: 'and', rules: [] },
        filterInput: '',
        groupBy: null,
        ...overrides,
      }),
      nodesUndo,
    };
  });
}

describe('useTableRows', () => {
  it('adds a row with system-managed fields', () => {
    const { result } = renderRows();
    act(() => result.current.rows.handleAddRow());
    expect(result.current.rows.nodes.length).toBe(1);
    const newNode = result.current.rows.nodes[0];
    expect(newNode.data?.created_time).toBeDefined();
    expect(newNode.data?.created_by).toBe('current-user');
    expect(newNode.data?.status).toBe('todo');
  });

  it('field change stamps last_edited_time', () => {
    const initial = [makeNode('n1')];
    const { result } = renderRows(initial);
    act(() => result.current.rows.handleFieldChange('n1', 'label', 'Updated'));
    const node = result.current.rows.nodes.find((n) => n.id === 'n1');
    expect(node?.data?.label).toBe('Updated');
    expect(node?.data?.last_edited_time).toBeDefined();
  });

  it('bulk deletes selected rows', () => {
    const initial = [makeNode('n1'), makeNode('n2'), makeNode('n3')];
    const { result } = renderRows(initial);
    act(() => {
      result.current.rows.toggleRowSelection('n1');
      result.current.rows.toggleRowSelection('n3');
    });
    expect(result.current.rows.selectedRowIds.size).toBe(2);
    act(() => result.current.rows.handleBulkDelete());
    expect(result.current.rows.nodes.length).toBe(1);
    expect(result.current.rows.nodes[0].id).toBe('n2');
  });

  it('filters rows by text input', () => {
    const initial = [
      makeNode('n1', { label: 'Alpha feature' }),
      makeNode('n2', { label: 'Beta bug' }),
      makeNode('n3', { label: 'Alpha bug' }),
    ];
    const { result } = renderRows(initial, { filterInput: 'Alpha' });
    expect(result.current.rows.processedRows.length).toBe(2);
  });

  it('sorts rows by field', () => {
    const initial = [
      makeNode('n1', { label: 'C item', priority: 'Low' }),
      makeNode('n2', { label: 'A item', priority: 'High' }),
      makeNode('n3', { label: 'B item', priority: 'Medium' }),
    ];
    const { result } = renderRows(initial, {
      sort: { key: 'label', direction: 'asc' },
    });
    expect(result.current.rows.processedRows[0].data?.label).toBe('A item');
    expect(result.current.rows.processedRows[2].data?.label).toBe('C item');
  });

  it('groups rows by field', () => {
    const initial = [
      makeNode('n1', { status: 'todo' }),
      makeNode('n2', { status: 'done' }),
      makeNode('n3', { status: 'todo' }),
    ];
    const { result } = renderRows(initial, { groupBy: 'status' });
    expect(result.current.rows.groupedRows).not.toBeNull();
    expect(result.current.rows.groupedRows?.['todo']?.length).toBe(2);
    expect(result.current.rows.groupedRows?.['done']?.length).toBe(1);
  });

  it('does not add row when locked', () => {
    const { result } = renderRows([], { locked: true });
    act(() => result.current.rows.handleAddRow());
    expect(result.current.rows.nodes.length).toBe(0);
  });
});
