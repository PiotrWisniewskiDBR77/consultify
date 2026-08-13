import { describe, expect, it } from 'vitest';

import { GridViewState } from '../../../server/src/services/finance/grid/GridViewState.ts';

describe('GridViewState', () => {
  it('setFreeze clamps negative values to 0', () => {
    const state = new GridViewState();
    state.setFreeze(-3, 2);
    expect(state.freezeRowsCount).toBe(0);
    expect(state.freezeColumnsCount).toBe(2);
  });

  it('setColumnHidden removes a column from visibleColumnOrder', () => {
    const state = new GridViewState();
    state.setColumnHidden('p2', true);
    expect(state.visibleColumnOrder(['p1', 'p2', 'p3'])).toEqual(['p1', 'p3']);
  });

  it('setColumnPinned orders left-pinned, unpinned, right-pinned', () => {
    const state = new GridViewState();
    state.setColumnPinned('p3', 'RIGHT');
    state.setColumnPinned('p1', 'LEFT');
    expect(state.visibleColumnOrder(['p1', 'p2', 'p3'])).toEqual(['p1', 'p2', 'p3']);
    // Reorder input to prove pin order wins over input order.
    expect(state.visibleColumnOrder(['p2', 'p3', 'p1'])).toEqual(['p1', 'p2', 'p3']);
  });

  it('collapsed group hides every member except the first', () => {
    const state = new GridViewState();
    state.createGroup({ groupId: 'g1', label: 'Q1', axis: 'COLUMN', memberIds: ['jan', 'feb', 'mar'], collapsed: true });
    expect(state.visibleColumnOrder(['jan', 'feb', 'mar', 'apr'])).toEqual(['jan', 'apr']);
    state.toggleGroupCollapsed('g1', false);
    expect(state.visibleColumnOrder(['jan', 'feb', 'mar', 'apr'])).toEqual(['jan', 'feb', 'mar', 'apr']);
  });

  it('removeGroup clears membership without deleting the column/row state', () => {
    const state = new GridViewState();
    state.createGroup({ groupId: 'g1', label: 'Q1', axis: 'ROW', memberIds: ['r1', 'r2'], collapsed: true });
    expect(state.visibleRowOrder(['r1', 'r2', 'r3'])).toEqual(['r1', 'r3']);
    state.removeGroup('g1');
    expect(state.visibleRowOrder(['r1', 'r2', 'r3'])).toEqual(['r1', 'r2', 'r3']);
    expect(state.getGroup('g1')).toBeNull();
  });

  it('round-trips through toJSON/fromJSON', () => {
    const state = new GridViewState();
    state.setFreeze(2, 1);
    state.setColumnHidden('p2', true);
    state.setColumnPinned('p1', 'LEFT');
    state.createGroup({ groupId: 'g1', label: 'H1', axis: 'COLUMN', memberIds: ['p1', 'p2'], collapsed: true });

    const restored = GridViewState.fromJSON(state.toJSON());
    expect(restored.freezeRowsCount).toBe(2);
    expect(restored.freezeColumnsCount).toBe(1);
    expect(restored.isColumnVisible('p2')).toBe(false);
    expect(restored.getColumn('p1').pinned).toBe('LEFT');
    expect(restored.getGroup('g1')?.collapsed).toBe(true);
  });
});
