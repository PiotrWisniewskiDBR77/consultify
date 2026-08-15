/**
 * Behavior-based tests for useTableViews hook.
 * Tests: view switching, saved-view governance, per-view filters/sort/groupBy persistence.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTableViews } from '@/components/MyWork/table/useTableViews';
import type { ColumnDef, SavedView } from '@/components/MyWork/table/tableTypes';

function renderViews(isPl = false) {
  const t = (_key: string, fallback?: string) => fallback || _key;
  return renderHook(() => useTableViews({ t, ideaId: 'test-idea' }));
}

describe('useTableViews', () => {
  it('initializes with default views', () => {
    const { result } = renderViews();
    expect(result.current.savedViews.length).toBeGreaterThanOrEqual(5);
    expect(result.current.activeViewId).toBe('default');
    expect(result.current.viewLayout).toBe('table');
  });

  it('applies a view with sort', () => {
    const { result } = renderViews();
    const scoringView = result.current.savedViews.find((v) => v.id === 'scoring');
    expect(scoringView).toBeDefined();
    act(() => result.current.applyView(scoringView!));
    expect(result.current.activeViewId).toBe('scoring');
    expect(result.current.sort).toEqual({ key: 'score', direction: 'desc' });
  });

  it('applies a view with groupBy', () => {
    const { result } = renderViews();
    const triageView = result.current.savedViews.find((v) => v.id === 'triage');
    act(() => result.current.applyView(triageView!));
    expect(result.current.groupBy).toBe('status');
  });

  it('applies a view with layout', () => {
    const { result } = renderViews();
    const timelineView = result.current.savedViews.find((v) => v.id === 'timeline_view');
    act(() => result.current.applyView(timelineView!));
    expect(result.current.viewLayout).toBe('timeline');
  });

  it('resets viewLayout to table when applying a view without its own layout', () => {
    const { result } = renderViews();
    const timelineView = result.current.savedViews.find((v) => v.id === 'timeline_view');
    act(() => result.current.applyView(timelineView!));
    expect(result.current.viewLayout).toBe('timeline');
    const defaultView = result.current.savedViews.find((v) => v.id === 'default');
    act(() => result.current.applyView(defaultView!));
    expect(result.current.viewLayout).toBe('table');
  });

  it('resets sort when applying a view without sort', () => {
    const { result } = renderViews();
    act(() => result.current.setSort({ key: 'label', direction: 'asc' }));
    expect(result.current.sort).not.toBeNull();
    const defaultView = result.current.savedViews.find((v) => v.id === 'default');
    act(() => result.current.applyView(defaultView!));
    expect(result.current.sort).toBeNull();
  });

  it('cycles sort: null → asc → desc → null', () => {
    const { result } = renderViews();
    expect(result.current.sort).toBeNull();
    act(() => result.current.cycleSort('label'));
    expect(result.current.sort).toEqual({ key: 'label', direction: 'asc' });
    act(() => result.current.cycleSort('label'));
    expect(result.current.sort).toEqual({ key: 'label', direction: 'desc' });
    act(() => result.current.cycleSort('label'));
    expect(result.current.sort).toBeNull();
  });

  it('saves a new view with current state', () => {
    const { result } = renderViews();
    act(() => result.current.setSort({ key: 'priority', direction: 'desc' }));
    act(() => result.current.setGroupBy('status'));
    const cols: ColumnDef[] = [
      { key: 'label', header: 'Label', type: 'text', visible: true, width: 240 },
      { key: 'status', header: 'Status', type: 'status', visible: false, width: 130 },
    ];
    act(() => result.current.saveCurrentView('My View', cols));
    const saved = result.current.savedViews.find((v) => v.name === 'My View');
    expect(saved).toBeDefined();
    expect(saved?.sort?.[0]).toEqual({ key: 'priority', direction: 'desc' });
    expect(saved?.groupBy).toBe('status');
    expect(saved?.columns?.find((c) => c.key === 'status')?.visible).toBe(false);
  });

  it('deletes a saved view', () => {
    const { result } = renderViews();
    const initialCount = result.current.savedViews.length;
    act(() => result.current.deleteSavedView('scoring'));
    expect(result.current.savedViews.length).toBe(initialCount - 1);
    expect(result.current.savedViews.find((v) => v.id === 'scoring')).toBeUndefined();
  });

  it('updates a saved view', () => {
    const { result } = renderViews();
    act(() => result.current.updateSavedView('triage', { name: 'Updated Triage' }));
    expect(result.current.savedViews.find((v) => v.id === 'triage')?.name).toBe('Updated Triage');
  });

  it('calls onApplyColumns when view has columns', () => {
    const onApplyColumns = vi.fn();
    const t = (_key: string, fallback?: string) => fallback || _key;
    const { result } = renderHook(() =>
      useTableViews({ t, ideaId: 'test', onApplyColumns })
    );
    const viewWithCols: SavedView = {
      id: 'custom',
      name: 'Custom',
      columns: [{ key: 'label', visible: true, width: 200 }],
    };
    act(() => result.current.setSavedViews((prev) => [...prev, viewWithCols]));
    act(() => result.current.applyView(viewWithCols));
    expect(onApplyColumns).toHaveBeenCalledWith([{ key: 'label', visible: true, width: 200 }]);
  });
});
