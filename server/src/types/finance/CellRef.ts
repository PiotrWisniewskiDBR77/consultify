/**
 * AP-00 — CellRef: addressing a single cell in any Finance domain table.
 *
 * Program: `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`
 * section 5 (AP-00, AP-01 "stable canonical keys"). ADR:
 * `docs/validation/finance-v3/generated/gate-d/AP-00_shared_contracts_ADR.md`.
 *
 * First real consumer: `finance_stmt_lines`
 * (`docs/validation/finance-v3/generated/gate-d/WP-D01_statements_schema_ADR.md`
 * section 4.5), whose `uq_finance_stmt_lines_cell` UNIQUE constraint is:
 *
 *   UNIQUE (business_version_id, entity_id, canonical_line_id, period_id,
 *           accumulation_basis, consolidation_scope)
 *
 * `CellRef` maps onto that constraint EXACTLY:
 *   - `businessVersionId`                              -> business_version_id
 *   - `rowKey`   {entityId, canonicalLineId, consolidationScope} -> entity_id, canonical_line_id, consolidation_scope
 *   - `columnKey` {periodId, accumulationBasis}                  -> period_id, accumulation_basis
 *   - `period` (top-level convenience projection, see below)
 *
 * Extensibility (task requirement: "rozszerzalne dla przyszłych
 * finance_analysis_kpi_values itp. bez zmiany kontraktu"): adding a new
 * domain table (e.g. WP-D02's `finance_analysis_kpi_values`) is additive —
 * append one literal to `FinanceTableNameValues` and one new branch to each
 * of the three discriminated unions below (`CellRowKeySchema`,
 * `CellColumnKeySchema`, and `CellRef` itself stays untouched). No existing
 * branch, and no field of `CellRef`'s own envelope, needs to change.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// table_name enum — one literal per Gate D domain table this contract can
// address. Deliberately a single-element union today (WP-D01 is the only
// domain package with a shipped schema); see file header for the additive
// extension pattern.
// ---------------------------------------------------------------------------

export const FinanceTableNameValues = ['finance_stmt_lines'] as const;
export type FinanceTableName = (typeof FinanceTableNameValues)[number];
export const FinanceTableNameSchema = z.enum(FinanceTableNameValues);

// ---------------------------------------------------------------------------
// finance_stmt_lines row/column key branches (WP-D01 section 4.5 / 4.2 / 4.3)
// ---------------------------------------------------------------------------

export const FinanceConsolidationScopeValues = ['STANDALONE', 'CONSOLIDATED', 'ELIMINATION'] as const;
export type FinanceConsolidationScope = (typeof FinanceConsolidationScopeValues)[number];

export const FinanceAccumulationBasisValues = ['QUARTER_ONLY', 'YTD', 'LTM', 'FULL_YEAR'] as const;
export type FinanceAccumulationBasis = (typeof FinanceAccumulationBasisValues)[number];

export const financeStmtLinesRowKeySchema = z.object({
  tableName: z.literal('finance_stmt_lines'),
  entityId: z.string().min(1),
  canonicalLineId: z.string().min(1),
  consolidationScope: z.enum(FinanceConsolidationScopeValues),
});
export type FinanceStmtLinesRowKey = z.infer<typeof financeStmtLinesRowKeySchema>;

export const financeStmtLinesColumnKeySchema = z.object({
  tableName: z.literal('finance_stmt_lines'),
  periodId: z.string().min(1),
  accumulationBasis: z.enum(FinanceAccumulationBasisValues),
});
export type FinanceStmtLinesColumnKey = z.infer<typeof financeStmtLinesColumnKeySchema>;

// ---------------------------------------------------------------------------
// CellRowKey / CellColumnKey — discriminated unions on `tableName`. Adding a
// table means adding one branch here, per the file header's extension note.
// ---------------------------------------------------------------------------

export const CellRowKeySchema = z.discriminatedUnion('tableName', [financeStmtLinesRowKeySchema]);
export type CellRowKey = z.infer<typeof CellRowKeySchema>;

export const CellColumnKeySchema = z.discriminatedUnion('tableName', [financeStmtLinesColumnKeySchema]);
export type CellColumnKey = z.infer<typeof CellColumnKeySchema>;

// ---------------------------------------------------------------------------
// Period — a denormalized, table-agnostic convenience projection. AP-05
// (Compare) and AP-01's freeze/find-by-period features need to read "what
// period is this cell in" WITHOUT knowing each table's table-specific
// columnKey shape. `null` for a table whose grid has no period axis at all
// (task: "period jeśli dotyczy" — "if applicable"); every table shipped so
// far (finance_stmt_lines) does have one, so `period` is non-null there, but
// the field stays optional-by-type so a future non-periodic domain table
// (e.g. a flat entity-perimeter grid) does not need a fabricated value.
// ---------------------------------------------------------------------------

export const CellPeriodRefSchema = z.object({
  periodId: z.string().min(1),
  accumulationBasis: z.enum(FinanceAccumulationBasisValues),
});
export type CellPeriodRef = z.infer<typeof CellPeriodRefSchema>;

// ---------------------------------------------------------------------------
// CellRef — the envelope. Shape is table-agnostic and does not change when a
// new table is added (see file header).
// ---------------------------------------------------------------------------

export const CellRefSchema = z
  .object({
    organizationId: z.string().min(1),
    businessVersionId: z.string().min(1),
    tableName: FinanceTableNameSchema,
    rowKey: CellRowKeySchema,
    columnKey: CellColumnKeySchema,
    period: CellPeriodRefSchema.nullable(),
  })
  .superRefine((ref, ctx) => {
    if (ref.rowKey.tableName !== ref.tableName) {
      ctx.addIssue({ code: 'custom', message: 'rowKey.tableName must match CellRef.tableName', path: ['rowKey', 'tableName'] });
    }
    if (ref.columnKey.tableName !== ref.tableName) {
      ctx.addIssue({ code: 'custom', message: 'columnKey.tableName must match CellRef.tableName', path: ['columnKey', 'tableName'] });
    }
  });
export type CellRef = z.infer<typeof CellRefSchema>;

// ---------------------------------------------------------------------------
// Constructors — one per known table, so callers never hand-assemble a
// mismatched rowKey/columnKey/tableName triple.
// ---------------------------------------------------------------------------

export function financeStmtLinesCellRef(params: {
  organizationId: string;
  businessVersionId: string;
  entityId: string;
  canonicalLineId: string;
  consolidationScope: FinanceConsolidationScope;
  periodId: string;
  accumulationBasis: FinanceAccumulationBasis;
}): CellRef {
  return {
    organizationId: params.organizationId,
    businessVersionId: params.businessVersionId,
    tableName: 'finance_stmt_lines',
    rowKey: {
      tableName: 'finance_stmt_lines',
      entityId: params.entityId,
      canonicalLineId: params.canonicalLineId,
      consolidationScope: params.consolidationScope,
    },
    columnKey: {
      tableName: 'finance_stmt_lines',
      periodId: params.periodId,
      accumulationBasis: params.accumulationBasis,
    },
    period: { periodId: params.periodId, accumulationBasis: params.accumulationBasis },
  };
}

// ---------------------------------------------------------------------------
// Stable canonical string key — master plan section 10 / WP-D01 section 4.5
// ("stabilny kanoniczny klucz komórki wymagany przez Finance Data Grid").
// Used by AP-01's virtualized grid (target 10k x 120 = up to 1.2M logical
// cells) as an O(1) map key, and by Operation batches to detect duplicate
// targets within one request before it ever reaches the DB. Deterministic
// because every row/column key branch above has a FIXED, explicitly-listed
// field order (no object-key-order ambiguity from `JSON.stringify`).
// ---------------------------------------------------------------------------

function stableStringify(value: Record<string, unknown>): string {
  return Object.keys(value)
    .sort()
    .map((key) => `${key}=${String(value[key as keyof typeof value])}`)
    .join('&');
}

export function cellRefKey(ref: CellRef): string {
  return [ref.organizationId, ref.businessVersionId, ref.tableName, stableStringify(ref.rowKey), stableStringify(ref.columnKey)].join(' ');
}

export function cellRefsEqual(a: CellRef, b: CellRef): boolean {
  return cellRefKey(a) === cellRefKey(b);
}
