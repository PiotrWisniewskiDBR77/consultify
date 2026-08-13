import { describe, expect, it } from 'vitest';

import { GridSelectionModel, rangesEqual } from '../../../server/src/services/finance/grid/GridSelectionModel.ts';
import type { CellRef } from '../../../server/src/types/finance/CellRef.ts';
import type { GridAddressResolver, GridCoordinate } from '../../../server/src/services/finance/grid/gridCoordinates.ts';
import type { FinanceGridRangeSelection } from '../../../server/src/types/finance/WorkspaceState.ts';

function testCellRef(row: number, col: number): CellRef {
  return {
    organizationId: 'org-1',
    businessVersionId: 'bv-1',
    tableName: 'finance_stmt_lines',
    rowKey: { tableName: 'finance_stmt_lines', entityId: `entity-${row}`, canonicalLineId: 'REVENUE', consolidationScope: 'STANDALONE' },
    columnKey: { tableName: 'finance_stmt_lines', periodId: `period-${col}`, accumulationBasis: 'QUARTER_ONLY' },
    period: { periodId: `period-${col}`, accumulationBasis: 'QUARTER_ONLY' },
  };
}

function makeResolver(rowCount: number, colCount: number): GridAddressResolver {
  return {
    rowCount,
    colCount,
    cellRefAt: (coord: GridCoordinate) => testCellRef(coord.row, coord.col),
    coordinateOf: (ref: CellRef) => {
      const rowMatch = /entity-(\d+)/.exec(ref.rowKey.tableName === 'finance_stmt_lines' ? (ref.rowKey as { entityId: string }).entityId : '');
      const colMatch = /period-(\d+)/.exec(ref.period?.periodId ?? '');
      if (!rowMatch || !colMatch) return null;
      const row = Number(rowMatch[1]);
      const col = Number(colMatch[1]);
      if (row >= rowCount || col >= colCount) return null;
      return { row, col };
    },
  };
}

describe('GridSelectionModel', () => {
  it('selectSingle replaces the whole selection with a 1x1 range', () => {
    const model = new GridSelectionModel();
    model.addRange({ top: 0, left: 0, bottom: 5, right: 5 });
    model.selectSingle({ row: 2, col: 3 });
    expect(model.ranges).toEqual([{ top: 2, left: 3, bottom: 2, right: 3 }]);
    expect(model.activeCell).toEqual({ row: 2, col: 3 });
    expect(model.selectedCellCount()).toBe(1);
  });

  it('addRange keeps ranges pairwise-disjoint when overlapping', () => {
    const model = new GridSelectionModel();
    model.addRange({ top: 0, left: 0, bottom: 4, right: 4 }); // 25 cells
    model.addRange({ top: 2, left: 2, bottom: 6, right: 6 }); // 25 cells, overlaps 3x3=9 with the first
    // Total distinct cells: 25 + 25 - 9 = 41
    expect(model.selectedCellCount()).toBe(41);
    // No two ranges should overlap.
    const ranges = model.ranges;
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const a = ranges[i]!;
        const b = ranges[j]!;
        const overlaps = a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('subtractRange removes exactly the overlapping cells, splitting a range into pieces', () => {
    const model = new GridSelectionModel();
    model.addRange({ top: 0, left: 0, bottom: 9, right: 9 }); // 100 cells
    model.subtractRange({ top: 3, left: 3, bottom: 6, right: 6 }); // remove 16 cells from the middle
    expect(model.selectedCellCount()).toBe(84);
    expect(model.contains({ row: 4, col: 4 })).toBe(false);
    expect(model.contains({ row: 0, col: 0 })).toBe(true);
    expect(model.contains({ row: 9, col: 9 })).toBe(true);
  });

  it('toggleRange adds when not fully selected, removes when fully selected', () => {
    const model = new GridSelectionModel();
    const rect = { top: 0, left: 0, bottom: 2, right: 2 };
    model.toggleRange(rect);
    expect(model.selectedCellCount()).toBe(9);
    model.toggleRange(rect);
    expect(model.selectedCellCount()).toBe(0);
  });

  it('toggleRange only removes the exact overlap when the rect is partially covered on second call', () => {
    const model = new GridSelectionModel();
    model.addRange({ top: 0, left: 0, bottom: 4, right: 4 }); // 25 cells, fully covers a smaller later rect
    model.toggleRange({ top: 1, left: 1, bottom: 2, right: 2 }); // fully inside -> removed (4 cells)
    expect(model.selectedCellCount()).toBe(21);
  });

  it('clear empties the selection and active/anchor cells', () => {
    const model = new GridSelectionModel();
    model.addRange({ top: 0, left: 0, bottom: 1, right: 1 });
    model.clear();
    expect(model.isEmpty()).toBe(true);
    expect(model.activeCell).toBeNull();
    expect(model.anchorCell).toBeNull();
    expect(model.selectedCellCount()).toBe(0);
  });

  it('extendTo grows the in-progress range from the anchor without leaving stale pieces', () => {
    const model = new GridSelectionModel();
    model.setAnchor({ row: 2, col: 2 });
    model.extendTo({ row: 2, col: 2 });
    expect(model.selectedCellCount()).toBe(1);
    model.extendTo({ row: 4, col: 4 });
    expect(model.selectedCellCount()).toBe(9); // 3x3
    expect(model.ranges).toEqual([{ top: 2, left: 2, bottom: 4, right: 4 }]);
  });

  it('iterateCells yields every selected coordinate exactly once, lazily', () => {
    const model = new GridSelectionModel();
    model.addRange({ top: 0, left: 0, bottom: 2, right: 2 });
    model.addRange({ top: 5, left: 5, bottom: 5, right: 5 });
    const seen = new Set<string>();
    let count = 0;
    for (const coord of model.iterateCells()) {
      seen.add(`${coord.row},${coord.col}`);
      count++;
    }
    expect(count).toBe(10); // 9 + 1
    expect(seen.size).toBe(10);
    expect(seen.has('5,5')).toBe(true);
  });

  it('round-trips through toCellRefRanges / fromCellRefRanges via a resolver', () => {
    const resolver = makeResolver(20, 20);
    const model = new GridSelectionModel();
    model.addRange({ top: 1, left: 1, bottom: 3, right: 3 });
    model.addRange({ top: 10, left: 10, bottom: 10, right: 10 });

    const cellRefRanges: FinanceGridRangeSelection[] = model.toCellRefRanges(resolver);
    expect(cellRefRanges).toHaveLength(2);

    const { model: restored, unresolved } = GridSelectionModel.fromCellRefRanges(cellRefRanges, resolver);
    expect(unresolved).toBe(0);
    expect(restored.selectedCellCount()).toBe(model.selectedCellCount());
    expect(rangesEqual(restored.ranges, model.ranges)).toBe(true);
  });

  it('fromCellRefRanges reports unresolved corners instead of throwing when a resolver cannot place them', () => {
    const resolver = makeResolver(5, 5); // small grid; corners outside this resolve to null
    const staleRanges: FinanceGridRangeSelection[] = [
      { topLeft: testCellRef(50, 50), bottomRight: testCellRef(51, 51) },
    ];
    const { model, unresolved } = GridSelectionModel.fromCellRefRanges(staleRanges, resolver);
    expect(unresolved).toBe(1);
    expect(model.isEmpty()).toBe(true);
  });
});
