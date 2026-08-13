/**
 * G4-TABLE-SCALE — row-scale guardrails for the Idea Table.
 *
 * Pulled out of `IdeaTableTool.tsx` as pure, dependency-free functions so the
 * cap math is unit-testable without mounting hundreds of real `<tr>` DOM
 * nodes (mounting rows is exactly the cost this module exists to bound —
 * see the perf numbers below).
 *
 * ── Why a hard cap, not virtualization ─────────────────────────────────────
 * A measured benchmark (`docs/qa/ideas-complete-transformation-2026-08-09/
 * 17_PERFORMANCE_MEASUREMENT.md`) found the real `IdeaTableTool` mounting
 * N=100 rows in ~880ms, N=1,000 rows in ~6s, and OOM-crashing the process at
 * N=5,000 even with an 8GB heap — with no existing row cap anywhere in the
 * CSV-import or render path (CSV import is genuinely unbounded). Full
 * virtualization is the better long-term product answer, but it is
 * structural here: this table's sticky header, column resize/reorder,
 * inline cell editing, grouping and keyboard navigation are all wired
 * directly to real `<tr>`/`<td>` DOM nodes across a single ~5,000-line
 * component, so windowing it safely is multi-day work, not a same-stream
 * fix. A partial virtualization that breaks editing or selection would be
 * worse than a well-built guard.
 *
 * ── Why 500 ─────────────────────────────────────────────────────────────
 * 500 matches this codebase's own existing precedent for "safe ceiling on a
 * canvas/table-like surface": Whiteboard hard-blocks new elements at 500
 * (`IdeaWhiteboardTool.tsx`) and Mind Map's `LargeMapOptimizer` treats 500
 * as its AUTO_SIMPLIFY threshold. It also sits comfortably below both the
 * measured 5,000-row OOM ceiling and the already-sluggish 1,000-row mount
 * time.
 */
import type { TableNode } from './tableTypes';

export const MAX_TABLE_ROWS = 500;

export interface RowRenderCapResult {
  /** Set when the view is grouped: each group's rows already sliced to its share of the shared budget, in group order. */
  groups: Array<[string, TableNode[]]> | null;
  /** Set when the view is flat (not grouped): the capped row list. */
  rows: TableNode[] | null;
  /** True row count across the whole (uncapped) data set. */
  totalCount: number;
  /** How many rows are actually being rendered (<= cap). */
  shownCount: number;
}

/**
 * Decides which rows the plain-table view is allowed to mount into real DOM.
 * Grouped rendering spends the SAME global budget across groups, in group
 * iteration order, so "showing first N of M" stays literally true instead
 * of silently capping every group independently (which would show more
 * than N rows total).
 *
 * Aggregations, "select all", and footer totals are NOT derived from this
 * result — they intentionally keep operating on the full row set so numbers
 * stay correct even while the DOM is capped.
 */
export function computeRowRenderCap(
  processedRowsWithRollups: TableNode[],
  groupedRows: Record<string, TableNode[]> | null,
  cap: number = MAX_TABLE_ROWS
): RowRenderCapResult {
  if (groupedRows) {
    let budget = cap;
    const groups: Array<[string, TableNode[]]> = [];
    let totalCount = 0;
    for (const [groupKey, groupRows] of Object.entries(groupedRows)) {
      totalCount += groupRows.length;
      const slice = budget > 0 ? groupRows.slice(0, budget) : [];
      groups.push([groupKey, slice]);
      budget -= slice.length;
    }
    const shownCount = groups.reduce((sum, [, rows]) => sum + rows.length, 0);
    return { groups, rows: null, totalCount, shownCount };
  }
  const totalCount = processedRowsWithRollups.length;
  const rows = processedRowsWithRollups.slice(0, cap);
  return { groups: null, rows, totalCount, shownCount: rows.length };
}

export interface RowAddCapDecision<T> {
  /** Incoming rows actually allowed in, truncated to the remaining budget (possibly empty). */
  rowsToAdd: T[];
  /** How many of the incoming rows were NOT added because of the cap. */
  truncatedCount: number;
  /** True when the table was already at/over the cap before this add — nothing was added. */
  blocked: boolean;
}

/**
 * RISK-36 — generic guard for EVERY multi-row entry path (CSV import, AI add
 * rows, framework apply, and any future bulk-add path), not just CSV.
 *
 * Checked against the RESULTING count (`currentRowCount + incomingRows.length`),
 * matching CSV import's existing convention — a batch can never jump straight
 * over the ceiling just because it started under it. Never silently drops
 * rows: callers MUST surface `truncatedCount`/`blocked` to the user (see
 * `IdeaTableTool.handleCSVImport`, `handleAIAddRows`, `handleFrameworkApply`),
 * they are not swallowed here.
 */
export function applyRowAddCap<T>(
  currentRowCount: number,
  incomingRows: T[],
  cap: number = MAX_TABLE_ROWS
): RowAddCapDecision<T> {
  const remainingCapacity = cap - currentRowCount;
  if (remainingCapacity <= 0) {
    return { rowsToAdd: [], truncatedCount: incomingRows.length, blocked: true };
  }
  const rowsToAdd =
    incomingRows.length > remainingCapacity ? incomingRows.slice(0, remainingCapacity) : incomingRows;
  return {
    rowsToAdd,
    truncatedCount: incomingRows.length - rowsToAdd.length,
    blocked: false,
  };
}

export interface CsvImportCapDecision {
  /** Parsed CSV rows actually allowed in, truncated to the remaining budget (possibly empty). */
  rowsToImport: string[][];
  /** How many of the parsed rows were NOT imported because of the cap. */
  truncatedCount: number;
  /** True when the table was already at/over the cap before this import — nothing was imported. */
  blocked: boolean;
}

/**
 * Guards CSV import against pushing the table over MAX_TABLE_ROWS.
 * Never silently drops rows: callers must surface `truncatedCount`/`blocked`
 * to the user (see `IdeaTableTool.handleCSVImport`), they are not swallowed
 * here. Thin CSV-shaped wrapper over `applyRowAddCap` — same cap math, kept
 * as its own named type/function so existing callers/tests are untouched.
 */
export function applyCsvImportCap(
  currentRowCount: number,
  incomingRows: string[][],
  cap: number = MAX_TABLE_ROWS
): CsvImportCapDecision {
  const decision = applyRowAddCap(currentRowCount, incomingRows, cap);
  return {
    rowsToImport: decision.rowsToAdd,
    truncatedCount: decision.truncatedCount,
    blocked: decision.blocked,
  };
}
