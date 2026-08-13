/**
 * AP-01 — Finance Data Grid core logic: integer grid-coordinate space and
 * rectangle utilities shared by GridSelectionModel/PasteEngine/FillEngine/
 * BulkOpsEngine.
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 10 (Finance Data Grid, target 10k x 120, >=45 FPS). ADR:
 * `docs/validation/finance-v3/generated/gate-d/AP-01_finance_data_grid_ADR.md`.
 *
 * DESIGN NOTE (judgment call, documented in the AP-01 ADR section 3): AP-00's
 * `FinanceGridRangeSelection` (server/src/types/finance/WorkspaceState.ts)
 * stores range corners as full `CellRef` objects, and its own file header
 * says explicitly: "CellRef has no universal 'next cell' ordering AP-00 can
 * define generically ... the corners are an opaque pair whose interpretation
 * belongs to AP-01's own grid layout." This module IS that grid layout: all
 * selection/paste/fill/bulk-op ALGORITHMS in this package work over a plain
 * integer `{ row, col }` coordinate space (the same space every virtualized
 * grid implementation uses — react-window, ag-grid, Excel's own internal
 * model), because `CellRef`'s row/column keys (entityId/canonicalLineId/
 * periodId strings) have no arithmetic ordering to iterate, subtract, or
 * measure a rectangle over. A `GridAddressResolver` (below) is the seam that
 * converts between this coordinate space and domain `CellRef`s; the future
 * AP-01 React component owns one resolver instance per open artifact
 * (built from its own rendered row/column order, sort, freeze, and grouping
 * state) and passes it into every engine call in this package.
 */

import type { CellRef } from '../../../types/finance/CellRef.js';

// ---------------------------------------------------------------------------
// Coordinate / rectangle primitives
// ---------------------------------------------------------------------------

export interface GridCoordinate {
  readonly row: number;
  readonly col: number;
}

/** Inclusive on all four edges: a 1x1 selection has `top === bottom` and `left === right`. */
export interface GridRect {
  readonly top: number;
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
}

export function coordEquals(a: GridCoordinate, b: GridCoordinate): boolean {
  return a.row === b.row && a.col === b.col;
}

/** Builds a normalized (top <= bottom, left <= right) rect from two arbitrary corners — the shape every drag-select/shift-click gesture produces. */
export function rectFromCorners(a: GridCoordinate, b: GridCoordinate): GridRect {
  return {
    top: Math.min(a.row, b.row),
    bottom: Math.max(a.row, b.row),
    left: Math.min(a.col, b.col),
    right: Math.max(a.col, b.col),
  };
}

export function rectCellCount(rect: GridRect): number {
  const rows = rect.bottom - rect.top + 1;
  const cols = rect.right - rect.left + 1;
  return rows > 0 && cols > 0 ? rows * cols : 0;
}

export function rectIsEmpty(rect: GridRect): boolean {
  return rectCellCount(rect) <= 0;
}

export function rectsEqual(a: GridRect, b: GridRect): boolean {
  return a.top === b.top && a.left === b.left && a.bottom === b.bottom && a.right === b.right;
}

export function rectContainsCoord(rect: GridRect, coord: GridCoordinate): boolean {
  return coord.row >= rect.top && coord.row <= rect.bottom && coord.col >= rect.left && coord.col <= rect.right;
}

export function rectIntersects(a: GridRect, b: GridRect): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function rectIntersection(a: GridRect, b: GridRect): GridRect | null {
  if (!rectIntersects(a, b)) return null;
  return {
    top: Math.max(a.top, b.top),
    bottom: Math.min(a.bottom, b.bottom),
    left: Math.max(a.left, b.left),
    right: Math.min(a.right, b.right),
  };
}

/**
 * Rectangle difference `a \ b`: the up-to-4 axis-aligned rectangles covering
 * every cell of `a` not covered by `b`. Standard "clip band" split (top
 * strip, bottom strip, then left/right strips restricted to the
 * intersection's row band) — the pieces are pairwise disjoint by
 * construction, which is what lets `GridSelectionModel` keep its whole range
 * list disjoint (see that file) instead of needing an O(cells) dedup pass on
 * every read.
 */
export function subtractRect(a: GridRect, b: GridRect): GridRect[] {
  const clipped = rectIntersection(a, b);
  if (!clipped) return [a];

  const pieces: GridRect[] = [];
  if (clipped.top > a.top) {
    pieces.push({ top: a.top, bottom: clipped.top - 1, left: a.left, right: a.right });
  }
  if (clipped.bottom < a.bottom) {
    pieces.push({ top: clipped.bottom + 1, bottom: a.bottom, left: a.left, right: a.right });
  }
  if (clipped.left > a.left) {
    pieces.push({ top: clipped.top, bottom: clipped.bottom, left: a.left, right: clipped.left - 1 });
  }
  if (clipped.right < a.right) {
    pieces.push({ top: clipped.top, bottom: clipped.bottom, left: clipped.right + 1, right: a.right });
  }
  return pieces.filter((piece) => !rectIsEmpty(piece));
}

/**
 * Lazy row-major iteration over a rect's coordinates. A generator, not an
 * array: the 10k x 120 target (up to 1.2M coordinates for a full-grid
 * selection) makes eager materialization both a memory and a latency risk;
 * callers that only need a count (`rectCellCount`) or a bounded slice
 * (chunking, see `batching.ts`) never pay for the rest.
 */
export function* iterateRect(rect: GridRect): Generator<GridCoordinate> {
  for (let row = rect.top; row <= rect.bottom; row++) {
    for (let col = rect.left; col <= rect.right; col++) {
      yield { row, col };
    }
  }
}

// ---------------------------------------------------------------------------
// GridAddressResolver — the seam between this integer coordinate space and
// domain CellRef addressing. Implemented by the future AP-01 React layer
// (which owns rendered row/column order, sort, freeze, and grouping); this
// package only consumes the interface.
// ---------------------------------------------------------------------------

export interface GridAddressResolver {
  readonly rowCount: number;
  readonly colCount: number;
  /** Must be a pure, O(1)-ish function of `coord` for the 10k x 120 performance budget (see AP-01 ADR section 5). Throws or returns a CellRef outside the domain table's real key space only if `coord` is out of `[0, rowCount) x [0, colCount)` — callers are expected to bounds-check first (see `isCoordInBounds`). */
  cellRefAt(coord: GridCoordinate): CellRef;
  /** Inverse of `cellRefAt`. Returns `null` if `ref` is not currently addressable in this resolver's rendered layout (e.g. filtered out, or belongs to a different table) — this is expected and not an error condition (WorkspaceState round-trip after a filter change, see `GridSelectionModel.fromCellRefRanges`). */
  coordinateOf(ref: CellRef): GridCoordinate | null;
}

export function isCoordInBounds(coord: GridCoordinate, resolver: Pick<GridAddressResolver, 'rowCount' | 'colCount'>): boolean {
  return coord.row >= 0 && coord.row < resolver.rowCount && coord.col >= 0 && coord.col < resolver.colCount;
}

export function isRectInBounds(rect: GridRect, resolver: Pick<GridAddressResolver, 'rowCount' | 'colCount'>): boolean {
  return rect.top >= 0 && rect.left >= 0 && rect.bottom < resolver.rowCount && rect.right < resolver.colCount && !rectIsEmpty(rect);
}

// ---------------------------------------------------------------------------
// Batch chunking — shared by PasteEngine/FillEngine/BulkOpsEngine/
// FindReplaceEngine. See AP-01 ADR section 4 for the "split, don't reject"
// decision this implements.
// ---------------------------------------------------------------------------

export const MAX_CELLS_PER_OPERATION = 1000;

export function chunkArray<T>(items: readonly T[], size: number = MAX_CELLS_PER_OPERATION): T[][] {
  if (size <= 0) throw new RangeError('chunkArray: size must be > 0');
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
