/**
 * AP-01 — GridSelectionModel: multi-range selection over the Finance Data
 * Grid's integer coordinate space (see `gridCoordinates.ts` for why this
 * package works in `{row, col}` space rather than directly in `CellRef`
 * space).
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 10 ("multi-range selection"). ADR:
 * `docs/validation/finance-v3/generated/gate-d/AP-01_finance_data_grid_ADR.md`.
 *
 * INVARIANT: `ranges` is always kept pairwise-disjoint. Every mutating method
 * re-establishes this by subtracting the incoming rect from every existing
 * range before adding it back (add) or by subtracting outright (subtract).
 * This is what lets `selectedCellCount()` and `iterateCells()` be a simple,
 * correct sum/concat with no per-cell dedup pass — the alternative (allowing
 * overlapping ranges and deduping on read) would make every read O(cells)
 * instead of O(ranges), which matters at the 10k x 120 = up to 1.2M logical
 * cell target.
 */

import type { FinanceGridRangeSelection } from '../../../types/finance/WorkspaceState.js';
import {
  type GridAddressResolver,
  type GridCoordinate,
  type GridRect,
  coordEquals,
  iterateRect,
  rectCellCount,
  rectFromCorners,
  rectIsEmpty,
  rectsEqual,
  subtractRect,
} from './gridCoordinates.js';

export class GridSelectionModel {
  private ranges_: GridRect[] = [];
  private activeCell_: GridCoordinate | null = null;
  /** The gesture anchor for shift+click / shift+arrow range extension — distinct from `activeCell` (Excel: anchor stays put, active cell moves, the range is always `rectFromCorners(anchor, active)`). */
  private anchorCell_: GridCoordinate | null = null;

  get ranges(): readonly GridRect[] {
    return this.ranges_;
  }

  get activeCell(): GridCoordinate | null {
    return this.activeCell_;
  }

  get anchorCell(): GridCoordinate | null {
    return this.anchorCell_;
  }

  /** Replaces the whole selection with a single 1x1 range at `coord` (plain click, arrow-key navigation without shift). */
  selectSingle(coord: GridCoordinate): void {
    this.ranges_ = [{ top: coord.row, bottom: coord.row, left: coord.col, right: coord.col }];
    this.activeCell_ = coord;
    this.anchorCell_ = coord;
  }

  /** Sets the active cell / gesture anchor without touching `ranges` (used to seed a drag before the first `addRange`/`toggleRange` call). */
  setAnchor(coord: GridCoordinate): void {
    this.activeCell_ = coord;
    this.anchorCell_ = coord;
  }

  /** Extends the current gesture from `anchorCell` to `coord` (shift+click, shift+arrow) — replaces the LAST range added by this gesture rather than accumulating a new disjoint piece per keystroke. Call `setAnchor`/`selectSingle` first to start a fresh gesture. */
  extendTo(coord: GridCoordinate): void {
    const anchor = this.anchorCell_ ?? coord;
    const rect = rectFromCorners(anchor, coord);
    if (this.ranges_.length > 0) {
      // Drop the in-progress range from this gesture, then re-add the extended one — keeps the disjoint invariant even mid-drag.
      const withoutLast = this.ranges_.slice(0, -1);
      this.ranges_ = withoutLast.flatMap((r) => subtractRect(r, rect));
      this.ranges_.push(rect);
    } else {
      this.ranges_ = [rect];
    }
    this.activeCell_ = coord;
    this.anchorCell_ = anchor;
  }

  /** Adds `rect` to the selection (ctrl/cmd-click-drag a new range). Re-clips every existing range against it first so the disjoint invariant holds even if `rect` partially overlaps a prior range. */
  addRange(rect: GridRect): void {
    if (rectIsEmpty(rect)) return;
    this.ranges_ = this.ranges_.flatMap((r) => subtractRect(r, rect));
    this.ranges_.push(rect);
    this.activeCell_ = { row: rect.bottom, col: rect.right };
    this.anchorCell_ = { row: rect.top, col: rect.left };
  }

  /** Removes every cell of `rect` from the selection, splitting any range it partially overlaps. */
  subtractRange(rect: GridRect): void {
    if (rectIsEmpty(rect)) return;
    this.ranges_ = this.ranges_.flatMap((r) => subtractRect(r, rect)).filter((r) => !rectIsEmpty(r));
  }

  /**
   * Ctrl/cmd-click toggle semantics: if `rect` is currently ENTIRELY selected
   * already, remove it; otherwise add it. (This is whole-rect toggle, not a
   * per-cell XOR — matches how Excel/Sheets treat a ctrl-click-drag of a
   * range that partially overlaps existing selection: it extends rather than
   * XORs. A per-cell XOR is not meaningfully different for the common case
   * — single-cell ctrl-click — but would be a materially more complex
   * "fragmenting" operation for a dragged rectangle for no product benefit;
   * documented in the AP-01 ADR as a deliberate simplification.)
   */
  toggleRange(rect: GridRect): void {
    if (rectIsEmpty(rect)) return;
    if (this.isFullyCovered(rect)) {
      this.subtractRange(rect);
    } else {
      this.addRange(rect);
    }
  }

  clear(): void {
    this.ranges_ = [];
    this.activeCell_ = null;
    this.anchorCell_ = null;
  }

  isEmpty(): boolean {
    return this.ranges_.length === 0;
  }

  /** True iff `coord` falls inside at least one range. */
  contains(coord: GridCoordinate): boolean {
    return this.ranges_.some((r) => coord.row >= r.top && coord.row <= r.bottom && coord.col >= r.left && coord.col <= r.right);
  }

  /** O(ranges), not O(cells): the disjoint invariant makes this a plain sum. */
  selectedCellCount(): number {
    return this.ranges_.reduce((total, r) => total + rectCellCount(r), 0);
  }

  /** Lazy row-major iteration over every selected coordinate, range by range. Safe to use on a full 10k x 120 selection without materializing 1.2M coordinates up front — see AP-01 ADR section 5 for the measured cost of fully draining this generator at that scale. */
  *iterateCells(): Generator<GridCoordinate> {
    for (const range of this.ranges_) {
      yield* iterateRect(range);
    }
  }

  /** True iff every cell of `rect` is already covered by the existing (disjoint) ranges. */
  private isFullyCovered(rect: GridRect): boolean {
    let remaining: GridRect[] = [rect];
    for (const range of this.ranges_) {
      remaining = remaining.flatMap((r) => subtractRect(r, range));
      if (remaining.length === 0) return true;
    }
    return remaining.length === 0;
  }

  // -------------------------------------------------------------------------
  // WorkspaceState interop — AP-00's `FinanceGridRangeSelection` stores
  // range corners as `CellRef`, not `{row, col}` (see file header). These two
  // methods are the ONLY place that boundary is crossed, via a caller-owned
  // `GridAddressResolver`.
  // -------------------------------------------------------------------------

  /** Projects the current selection into AP-00's crash-recovery shape (`WorkspaceState.selection.ranges`). */
  toCellRefRanges(resolver: GridAddressResolver): FinanceGridRangeSelection[] {
    return this.ranges_.map((rect) => ({
      topLeft: resolver.cellRefAt({ row: rect.top, col: rect.left }),
      bottomRight: resolver.cellRefAt({ row: rect.bottom, col: rect.right }),
    }));
  }

  /**
   * Reconstructs a selection from a persisted `WorkspaceState` blob after
   * crash recovery. Ranges whose corners no longer resolve to a coordinate
   * in the CURRENT layout (e.g. a filter removed that row/column since the
   * crash) are silently dropped — `unresolved` reports how many so the
   * caller can surface a "selection partially restored" notice if it wants
   * to; this is not treated as a hard error because a stale selection corner
   * is an expected consequence of the grid's own filter/sort state changing
   * between sessions, not a corrupt blob.
   */
  static fromCellRefRanges(
    ranges: readonly FinanceGridRangeSelection[],
    resolver: GridAddressResolver
  ): { model: GridSelectionModel; unresolved: number } {
    const model = new GridSelectionModel();
    let unresolved = 0;
    for (const range of ranges) {
      const topLeft = resolver.coordinateOf(range.topLeft);
      const bottomRight = resolver.coordinateOf(range.bottomRight);
      if (!topLeft || !bottomRight) {
        unresolved += 1;
        continue;
      }
      model.addRange(rectFromCorners(topLeft, bottomRight));
    }
    return { model, unresolved };
  }
}

export function rangesEqual(a: readonly GridRect[], b: readonly GridRect[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((rect, i) => rectsEqual(rect, b[i]!));
}

export function coordinatesEqual(a: GridCoordinate | null, b: GridCoordinate | null): boolean {
  if (a === null || b === null) return a === b;
  return coordEquals(a, b);
}
