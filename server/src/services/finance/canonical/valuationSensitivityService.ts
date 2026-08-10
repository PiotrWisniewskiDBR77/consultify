/**
 * Finance v3 canonical — Enterprise Valuation compute, Sensitivity layer (Gate D / Fala 7, WP-D10).
 *
 * Program: handoff section 9 ("Sensitivity: 5×5 i operational sensitivity... terminal share i
 * implied multiple/margin/growth checks"). Schema: `WP-D09_valuation_schema_ADR.md` section 10
 * (`finance_valuation_sensitivity_grids`/`_cells`, 25-cell + exactly-1-base-cell enforced ONLY when
 * `grid_status='COMPLETE'`, via a `DEFERRABLE` constraint trigger — same "validate the whole
 * transaction at COMMIT, not the first intermediate row" idiom the basket weight-sum trigger uses,
 * WP-D09 section 7.3).
 *
 * Monotonicity ("dla rozsądnego zakresu gdzie g<WACC we wszystkich komórkach... EV maleje wraz z
 * rosnącym WACC, rośnie wraz z rosnącym terminal g") is EXPLICITLY out of the DB schema's scope
 * (ADR section 10: "property do przetestowania... w pakiecie kompute") — THIS module is that
 * package; `TEST_25_MONOTONIC_CELLS` in the WP-D10 report is the live proof, not a schema-level
 * guarantee.
 */

import { randomUUID as uuidv4 } from 'node:crypto';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { discountCashFlows, type YearlyFcff } from './valuationDiscountService.js';
import { computeGordonTerminalValue } from './valuationTerminalService.js';

// ---------------------------------------------------------------------------
// Grid math — pure, no DB I/O
// ---------------------------------------------------------------------------

export interface SensitivityAxisValues {
  /** Exactly 5 values, ascending. */
  wacc: readonly [number, number, number, number, number];
  /** Exactly 5 values, ascending. */
  terminalG: readonly [number, number, number, number, number];
}

export interface SensitivityCellValue {
  rowIndex: number; // 1..5, terminal g axis (rows)
  colIndex: number; // 1..5, WACC axis (columns)
  rowAxisValue: number; // g_pct
  columnAxisValue: number; // wacc_pct
  cellValueDecimal: number | null; // EV, or null if g >= wacc for this combination (undefined cell)
  isBaseCell: boolean;
}

export type BuildGridErrorCode = 'AXIS_LENGTH_INVALID' | 'BASE_VALUES_NOT_ON_AXIS';

export type BuildSensitivityGridResult =
  | { ok: true; cells: SensitivityCellValue[]; baseRowIndex: number; baseColIndex: number }
  | { ok: false; code: BuildGridErrorCode; message: string };

/**
 * Rows = terminal growth `g` (ascending), columns = WACC (ascending) — matches the handoff's own
 * "WACC × terminal growth" example. Any cell where `g >= WACC` is left `cellValueDecimal: null`
 * (the same "never a silent wrong number" discipline as `assertGBelowWacc()` — a 5x5 grid spanning a
 * wide WACC/g range can legitimately contain a few structurally-undefined corners; those are
 * reported as `null`, not clamped or hidden). `TEST_25_MONOTONIC_CELLS` deliberately picks axis
 * ranges where every one of the 25 cells has `g < WACC`, per the task's own instruction.
 */
export function buildWaccByTerminalGGrid(params: {
  axes: SensitivityAxisValues;
  years: readonly YearlyFcff[];
  fcffTerminalYear: number;
  baseWaccPct: number;
  baseGPct: number;
}): BuildSensitivityGridResult {
  const { wacc, terminalG } = params.axes;
  if (wacc.length !== 5 || terminalG.length !== 5) {
    return { ok: false, code: 'AXIS_LENGTH_INVALID', message: 'both axes must have exactly 5 values' };
  }
  const baseColIndex = wacc.findIndex((w) => w === params.baseWaccPct);
  const baseRowIndex = terminalG.findIndex((g) => g === params.baseGPct);
  if (baseColIndex === -1 || baseRowIndex === -1) {
    return { ok: false, code: 'BASE_VALUES_NOT_ON_AXIS', message: 'baseWaccPct/baseGPct must be exact members of the corresponding axis so the base cell is unambiguous' };
  }

  const cells: SensitivityCellValue[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const gPct = terminalG[r];
      const waccPct = wacc[c];
      let cellValueDecimal: number | null = null;
      const terminal = computeGordonTerminalValue({ fcffTerminalYear: params.fcffTerminalYear, gPct, waccPct });
      if (terminal.ok) {
        const discounted = discountCashFlows({ years: params.years, waccPct, terminalValue: terminal.terminalValue });
        cellValueDecimal = discounted.enterpriseValue;
      }
      cells.push({
        rowIndex: r + 1,
        colIndex: c + 1,
        rowAxisValue: gPct,
        columnAxisValue: waccPct,
        cellValueDecimal,
        isBaseCell: r === baseRowIndex && c === baseColIndex,
      });
    }
  }
  return { ok: true, cells, baseRowIndex: baseRowIndex + 1, baseColIndex: baseColIndex + 1 };
}

/**
 * Row-wise (fixed column/WACC, varying g ascending) and column-wise (fixed row/g, varying WACC
 * ascending) monotonicity — EV should INCREASE as g increases (holding WACC fixed) and DECREASE as
 * WACC increases (holding g fixed), for any pair of adjacent, defined (non-null) cells. Returns the
 * first violation found, or `null` if the whole grid is monotonic. Pure, no DB I/O — this is exactly
 * the "property do przetestowania w pakiecie kompute" the schema ADR deferred to this module.
 */
export function findMonotonicityViolation(cells: readonly SensitivityCellValue[]): string | null {
  const byRow = new Map<number, SensitivityCellValue[]>();
  const byCol = new Map<number, SensitivityCellValue[]>();
  for (const cell of cells) {
    if (!byRow.has(cell.rowIndex)) byRow.set(cell.rowIndex, []);
    byRow.get(cell.rowIndex)!.push(cell);
    if (!byCol.has(cell.colIndex)) byCol.set(cell.colIndex, []);
    byCol.get(cell.colIndex)!.push(cell);
  }

  for (const [rowIndex, rowCells] of byRow) {
    const sorted = [...rowCells].sort((a, b) => a.colIndex - b.colIndex); // ascending WACC
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (prev.cellValueDecimal === null || cur.cellValueDecimal === null) continue;
      if (cur.cellValueDecimal > prev.cellValueDecimal) {
        return `row ${rowIndex}: EV at col ${cur.colIndex} (WACC=${cur.columnAxisValue}) = ${cur.cellValueDecimal} is greater than EV at col ${prev.colIndex} (WACC=${prev.columnAxisValue}) = ${prev.cellValueDecimal} — EV should be non-increasing as WACC increases`;
      }
    }
  }
  for (const [colIndex, colCells] of byCol) {
    const sorted = [...colCells].sort((a, b) => a.rowIndex - b.rowIndex); // ascending g
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (prev.cellValueDecimal === null || cur.cellValueDecimal === null) continue;
      if (cur.cellValueDecimal < prev.cellValueDecimal) {
        return `col ${colIndex}: EV at row ${cur.rowIndex} (g=${cur.rowAxisValue}) = ${cur.cellValueDecimal} is less than EV at row ${prev.rowIndex} (g=${prev.rowAxisValue}) = ${prev.cellValueDecimal} — EV should be non-decreasing as terminal g increases`;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// DB write — header + 25 cells in one transaction (COMPLETE gate is DEFERRABLE, WP-D09 section 10)
// ---------------------------------------------------------------------------

export interface WriteSensitivityGridParams {
  organizationId: string;
  methodId: string;
  gridLabel: string;
  rowAxisVariable: string;
  columnAxisVariable: string;
  cells: readonly SensitivityCellValue[];
  createdBy: string;
}

/**
 * Typed refusal for the P0 W9-C-4 tenant-boundary guard below — distinguishable
 * from the pre-existing `Error` this function already throws for internal
 * inconsistency (cell-count/base-cell validation), so callers/tests can tell
 * "you don't own this method/grid" apart from "malformed input".
 */
export class SensitivityGridAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SensitivityGridAccessError';
  }
}

export async function writeSensitivityGrid(params: WriteSensitivityGridParams): Promise<{ gridId: string }> {
  if (params.cells.length !== 25) {
    throw new Error(`writeSensitivityGrid: expected exactly 25 cells, got ${params.cells.length}`);
  }
  const baseCells = params.cells.filter((c) => c.isBaseCell);
  if (baseCells.length !== 1) {
    throw new Error(`writeSensitivityGrid: expected exactly 1 base cell, got ${baseCells.length}`);
  }

  const gridId = uuidv4();
  await withPinnedPostgresTransaction(async (tx) => {
    // P0 W9-C-4 fix: verify the method itself belongs to this organization
    // BEFORE touching the grid/cells tables at all. Without this, a caller
    // that already has (or forged) another tenant's methodId — the exact
    // vector W9-C-3 documented — could still reach the upsert/DELETE below.
    // This is the primary defense; the composite FK added by the structural
    // migration (W9-C-7) is the belt-and-suspenders backstop at the DB layer.
    const method = await tx.queryOne<{ id: string }>(
      `SELECT id FROM finance_valuation_methods WHERE id = ? AND organization_id = ?`,
      [params.methodId, params.organizationId]
    );
    if (!method) {
      throw new SensitivityGridAccessError(
        `writeSensitivityGrid: method ${params.methodId} not found for organization ${params.organizationId}`
      );
    }

    // Upsert scoped to (method_id, grid_label) — unchanged conflict target
    // (the unique constraint is on those two columns), but the UPDATE branch
    // now only fires when the existing row's organization_id already matches
    // the caller's. Combined with the method-ownership check above, the
    // conflict target can never legitimately resolve to another tenant's row.
    await tx.queryRun(
      `INSERT INTO finance_valuation_sensitivity_grids (
         id, organization_id, method_id, grid_label, row_axis_variable, column_axis_variable, grid_status, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?)
       ON CONFLICT (method_id, grid_label) DO UPDATE SET
         row_axis_variable = EXCLUDED.row_axis_variable, column_axis_variable = EXCLUDED.column_axis_variable,
         grid_status = 'DRAFT', updated_at = now()
       WHERE finance_valuation_sensitivity_grids.organization_id = ?`,
      [gridId, params.organizationId, params.methodId, params.gridLabel, params.rowAxisVariable, params.columnAxisVariable, params.createdBy, params.organizationId]
    );
    const resolvedGridId = (
      await tx.queryOne<{ id: string }>(
        `SELECT id FROM finance_valuation_sensitivity_grids WHERE method_id = ? AND grid_label = ? AND organization_id = ?`,
        [params.methodId, params.gridLabel, params.organizationId]
      )
    )?.id;
    if (!resolvedGridId) {
      // Either genuinely never inserted (should not happen given the guard
      // above), OR the WHERE clause on the ON CONFLICT UPDATE just refused to
      // touch a row owned by another organization — either way this must
      // fail loudly, never silently proceed against someone else's grid.
      throw new SensitivityGridAccessError('writeSensitivityGrid: grid row not found after upsert (organization mismatch or insert failure)');
    }

    await tx.queryRun(`DELETE FROM finance_valuation_sensitivity_cells WHERE grid_id = ? AND organization_id = ?`, [resolvedGridId, params.organizationId]);
    for (const cell of params.cells) {
      await tx.queryRun(
        `INSERT INTO finance_valuation_sensitivity_cells (
           id, organization_id, grid_id, row_index, col_index, row_axis_value, column_axis_value, cell_value_decimal, is_base_cell, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), params.organizationId, resolvedGridId, cell.rowIndex, cell.colIndex, cell.rowAxisValue, cell.columnAxisValue, cell.cellValueDecimal, cell.isBaseCell, params.createdBy]
      );
    }
    // Flip to COMPLETE in the SAME transaction as the 25 inserts — the DEFERRABLE constraint
    // triggers on both the cells table and this UPDATE are checked once, at COMMIT, per WP-D09
    // section 10 (mirrors the basket weight-sum trigger's own atomic-at-COMMIT semantics).
    await tx.queryRun(`UPDATE finance_valuation_sensitivity_grids SET grid_status = 'COMPLETE' WHERE id = ?`, [resolvedGridId]);
    return resolvedGridId;
  });

  return { gridId };
}
