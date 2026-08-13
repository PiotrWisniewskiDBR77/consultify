/**
 * AP-01 — GridViewState: pure freeze/pin/hide/group state for the Finance
 * Data Grid's columns and rows.
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 10 ("freeze/pin/hide/group"). ADR:
 * `docs/validation/finance-v3/generated/gate-d/AP-01_finance_data_grid_ADR.md`
 * section 8.
 *
 * SCOPE NOTE (task instruction, repeated here so it is not lost on reuse):
 * this is NOT AP-07's "saved views" — nothing in this file is persisted to
 * any database or `finance_*` table by this package. It is the in-memory
 * view-state MODEL a future AP-01 React grid component would hold locally
 * (and, later, AP-07 could serialize into a saved view row — this class's
 * `toJSON`/`fromJSON` exist to make that future integration a plain
 * pass-through, not to declare it in scope now).
 *
 * Column/row identity here is a plain `string` id (e.g. a `CellColumnKey`'s
 * `periodId`, or a `CellRowKey`'s `canonicalLineId`) rather than a `CellRef`
 * or a `GridCoordinate` — view state describes properties of an entire
 * COLUMN or ROW (every period, every line), which is a table-level concept
 * orthogonal to any single cell's address or to the transient integer
 * coordinate space `gridCoordinates.ts` uses for selection math. Which
 * concrete id string a column/row uses is left to the caller (AP-01's
 * resolver already knows this mapping — see `GridAddressResolver`).
 */

export type PinSide = 'LEFT' | 'RIGHT' | null;

export interface GridViewColumnState {
  columnId: string;
  hidden: boolean;
  pinned: PinSide;
  groupId: string | null;
}

export interface GridViewRowState {
  rowId: string;
  hidden: boolean;
  groupId: string | null;
}

export interface GridViewGroupState {
  groupId: string;
  label: string;
  axis: 'ROW' | 'COLUMN';
  collapsed: boolean;
  memberIds: string[];
}

export interface GridViewStateSnapshot {
  schemaVersion: 1;
  freezeRowsCount: number;
  freezeColumnsCount: number;
  columns: GridViewColumnState[];
  rows: GridViewRowState[];
  groups: GridViewGroupState[];
}

function defaultColumn(columnId: string): GridViewColumnState {
  return { columnId, hidden: false, pinned: null, groupId: null };
}

function defaultRow(rowId: string): GridViewRowState {
  return { rowId, hidden: false, groupId: null };
}

export class GridViewState {
  private freezeRowsCount_ = 0;
  private freezeColumnsCount_ = 0;
  private readonly columns_ = new Map<string, GridViewColumnState>();
  private readonly rows_ = new Map<string, GridViewRowState>();
  private readonly groups_ = new Map<string, GridViewGroupState>();

  get freezeRowsCount(): number {
    return this.freezeRowsCount_;
  }

  get freezeColumnsCount(): number {
    return this.freezeColumnsCount_;
  }

  /** Freeze the first `rows`/`cols` (in current visible order) rows/columns — Excel's "Freeze Panes". Negative values are clamped to 0. */
  setFreeze(rows: number, cols: number): void {
    this.freezeRowsCount_ = Math.max(0, Math.trunc(rows));
    this.freezeColumnsCount_ = Math.max(0, Math.trunc(cols));
  }

  private getOrCreateColumn(columnId: string): GridViewColumnState {
    let col = this.columns_.get(columnId);
    if (!col) {
      col = defaultColumn(columnId);
      this.columns_.set(columnId, col);
    }
    return col;
  }

  private getOrCreateRow(rowId: string): GridViewRowState {
    let row = this.rows_.get(rowId);
    if (!row) {
      row = defaultRow(rowId);
      this.rows_.set(rowId, row);
    }
    return row;
  }

  setColumnHidden(columnId: string, hidden: boolean): void {
    this.getOrCreateColumn(columnId).hidden = hidden;
  }

  setColumnPinned(columnId: string, side: PinSide): void {
    this.getOrCreateColumn(columnId).pinned = side;
  }

  setRowHidden(rowId: string, hidden: boolean): void {
    this.getOrCreateRow(rowId).hidden = hidden;
  }

  getColumn(columnId: string): Readonly<GridViewColumnState> {
    return this.columns_.get(columnId) ?? defaultColumn(columnId);
  }

  getRow(rowId: string): Readonly<GridViewRowState> {
    return this.rows_.get(rowId) ?? defaultRow(rowId);
  }

  isColumnVisible(columnId: string): boolean {
    const col = this.columns_.get(columnId);
    if (col?.hidden) return false;
    const groupId = col?.groupId ?? null;
    if (groupId) {
      const group = this.groups_.get(groupId);
      if (group?.collapsed && group.memberIds[0] !== columnId) return false;
    }
    return true;
  }

  isRowVisible(rowId: string): boolean {
    const row = this.rows_.get(rowId);
    if (row?.hidden) return false;
    const groupId = row?.groupId ?? null;
    if (groupId) {
      const group = this.groups_.get(groupId);
      if (group?.collapsed && group.memberIds[0] !== rowId) return false;
    }
    return true;
  }

  /**
   * Creates (or replaces) a collapsible group of columns or rows. Grouping a
   * member into a new group clears any prior group membership on it. When
   * `collapsed` is true, `isColumnVisible`/`isRowVisible` hide every member
   * except the first (the group's summary/header position) — matches
   * Excel's outline-group collapse behavior.
   */
  createGroup(params: { groupId: string; label: string; axis: 'ROW' | 'COLUMN'; memberIds: readonly string[]; collapsed?: boolean }): void {
    if (params.memberIds.length === 0) throw new RangeError('createGroup: memberIds must be non-empty');
    const group: GridViewGroupState = {
      groupId: params.groupId,
      label: params.label,
      axis: params.axis,
      collapsed: params.collapsed ?? false,
      memberIds: [...params.memberIds],
    };
    this.groups_.set(group.groupId, group);
    for (const memberId of group.memberIds) {
      if (params.axis === 'COLUMN') {
        this.getOrCreateColumn(memberId).groupId = group.groupId;
      } else {
        this.getOrCreateRow(memberId).groupId = group.groupId;
      }
    }
  }

  toggleGroupCollapsed(groupId: string, collapsed?: boolean): void {
    const group = this.groups_.get(groupId);
    if (!group) throw new RangeError(`toggleGroupCollapsed: unknown groupId '${groupId}'`);
    group.collapsed = collapsed ?? !group.collapsed;
  }

  removeGroup(groupId: string): void {
    const group = this.groups_.get(groupId);
    if (!group) return;
    for (const memberId of group.memberIds) {
      if (group.axis === 'COLUMN') {
        const col = this.columns_.get(memberId);
        if (col && col.groupId === groupId) col.groupId = null;
      } else {
        const row = this.rows_.get(memberId);
        if (row && row.groupId === groupId) row.groupId = null;
      }
    }
    this.groups_.delete(groupId);
  }

  getGroup(groupId: string): Readonly<GridViewGroupState> | null {
    return this.groups_.get(groupId) ?? null;
  }

  /**
   * Given the FULL underlying column order (unfiltered, e.g. every period in
   * the artifact), returns the order the grid should actually render:
   * left-pinned columns first (in their relative order among themselves),
   * then unpinned visible columns, then right-pinned columns — hidden
   * columns and collapsed non-first group members omitted throughout.
   */
  visibleColumnOrder(allColumnIds: readonly string[]): string[] {
    const left: string[] = [];
    const middle: string[] = [];
    const right: string[] = [];
    for (const columnId of allColumnIds) {
      if (!this.isColumnVisible(columnId)) continue;
      const pinned = this.columns_.get(columnId)?.pinned ?? null;
      if (pinned === 'LEFT') left.push(columnId);
      else if (pinned === 'RIGHT') right.push(columnId);
      else middle.push(columnId);
    }
    return [...left, ...middle, ...right];
  }

  visibleRowOrder(allRowIds: readonly string[]): string[] {
    return allRowIds.filter((rowId) => this.isRowVisible(rowId));
  }

  toJSON(): GridViewStateSnapshot {
    return {
      schemaVersion: 1,
      freezeRowsCount: this.freezeRowsCount_,
      freezeColumnsCount: this.freezeColumnsCount_,
      columns: [...this.columns_.values()].map((c) => ({ ...c })),
      rows: [...this.rows_.values()].map((r) => ({ ...r })),
      groups: [...this.groups_.values()].map((g) => ({ ...g, memberIds: [...g.memberIds] })),
    };
  }

  static fromJSON(snapshot: GridViewStateSnapshot): GridViewState {
    const state = new GridViewState();
    state.setFreeze(snapshot.freezeRowsCount, snapshot.freezeColumnsCount);
    for (const col of snapshot.columns) state.columns_.set(col.columnId, { ...col });
    for (const row of snapshot.rows) state.rows_.set(row.rowId, { ...row });
    for (const group of snapshot.groups) state.groups_.set(group.groupId, { ...group, memberIds: [...group.memberIds] });
    return state;
  }
}
