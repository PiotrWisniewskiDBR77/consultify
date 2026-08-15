/**
 * Behavior-based tests for useTableSchema hook.
 * Tests: column add, rename, delete, config update, toggle visibility, resize, reorder.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useTableSchema } from '@/components/MyWork/table/useTableSchema';
import type { ColumnDef } from '@/components/MyWork/table/tableTypes';

function renderSchema(isPl = false, ideaId = 'test-idea') {
  const t = (_key: string, fallback?: string) => fallback || _key;
  return renderHook(() => useTableSchema(t, ideaId));
}

describe('useTableSchema', () => {
  it('initializes with default columns', () => {
    const { result } = renderSchema();
    expect(result.current.columns.length).toBeGreaterThanOrEqual(5);
    expect(result.current.columns.find((c) => c.key === 'label')).toBeDefined();
    expect(result.current.columns.find((c) => c.key === 'status')).toBeDefined();
  });

  it('default status column uses "status" type', () => {
    const { result } = renderSchema();
    const statusCol = result.current.columns.find((c) => c.key === 'status');
    expect(statusCol?.type).toBe('status');
  });

  it('adds a new column', () => {
    const { result } = renderSchema();
    const initialCount = result.current.columns.length;
    const newCol: ColumnDef = {
      key: 'test_col',
      header: 'Test',
      type: 'text',
      visible: true,
      width: 160,
    };
    act(() => result.current.handleAddColumn(newCol));
    expect(result.current.columns.length).toBe(initialCount + 1);
    expect(result.current.columns.find((c) => c.key === 'test_col')).toBeDefined();
  });

  it('renames a column', () => {
    const { result } = renderSchema();
    act(() => result.current.renameColumn('label', 'New Label'));
    const col = result.current.columns.find((c) => c.key === 'label');
    expect(col?.header).toBe('New Label');
  });

  it('ignores empty rename', () => {
    const { result } = renderSchema();
    const original = result.current.columns.find((c) => c.key === 'label')?.header;
    act(() => result.current.renameColumn('label', '   '));
    expect(result.current.columns.find((c) => c.key === 'label')?.header).toBe(original);
  });

  it('updates column config', () => {
    const { result } = renderSchema();
    act(() =>
      result.current.updateColumnConfig('status', {
        options: ['todo', 'in_progress', 'done', 'blocked', 'review'],
      })
    );
    const col = result.current.columns.find((c) => c.key === 'status');
    expect(col?.options).toContain('review');
  });

  it('deletes a column', () => {
    const { result } = renderSchema();
    const initialCount = result.current.columns.length;
    act(() => result.current.deleteColumn('impact'));
    expect(result.current.columns.length).toBe(initialCount - 1);
    expect(result.current.columns.find((c) => c.key === 'impact')).toBeUndefined();
  });

  it('toggles column visibility', () => {
    const { result } = renderSchema();
    const ownerCol = result.current.columns.find((c) => c.key === 'owner');
    const initialVisible = ownerCol?.visible;
    act(() => result.current.toggleColumn('owner'));
    expect(result.current.columns.find((c) => c.key === 'owner')?.visible).toBe(!initialVisible);
  });

  it('visibleColumns only includes visible columns', () => {
    const { result } = renderSchema();
    const allVisible = result.current.visibleColumns.every((c) => c.visible);
    expect(allVisible).toBe(true);
    expect(result.current.visibleColumns.length).toBeLessThanOrEqual(
      result.current.columns.length
    );
  });

  it('merges persisted columns', () => {
    const { result } = renderSchema();
    act(() =>
      result.current.mergePersistedColumns([
        { key: 'label', header: 'Saved Label', type: 'text', visible: true, width: 300 },
        { key: 'new_saved', header: 'New Saved', type: 'number', visible: true, width: 120 },
      ])
    );
    expect(result.current.columns.find((c) => c.key === 'label')?.width).toBe(300);
    expect(result.current.columns.find((c) => c.key === 'new_saved')).toBeDefined();
  });
});
