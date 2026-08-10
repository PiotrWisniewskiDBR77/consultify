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

export const FinanceTableNameValues = [
  'finance_stmt_lines',
  // AP-05 (Compare) additive extension — one literal + one row/column branch
  // per table, exactly as this file's header describes. Real DDL sources:
  //   - finance_analysis_kpi_values: `20260809_finance_v3_d03_analysis_01_tables.sql`
  //     (`uq_finance_analysis_kpi_values_cell UNIQUE (business_version_id,
  //     kpi_catalog_id, entity_id, period_id)` — no consolidation_scope/
  //     accumulation_basis axis, this domain table never had one).
  //   - finance_baseline_outputs: `20260809_finance_v3_d05_baseline_01_tables.sql`
  //     (`uq_finance_baseline_outputs_cell UNIQUE (business_version_id,
  //     entity_id, canonical_line_id, period_id, consolidation_scope)` — has
  //     consolidation_scope but, unlike finance_stmt_lines, no
  //     accumulation_basis column at all: a Baseline Model has exactly one
  //     accumulation convention per period, not four).
  //   - finance_prediction_outputs_effective: the VIEW (not a table) defined
  //     by `20260809_finance_v3_d07_prediction_03_readiness.sql` section 8.3
  //     — "the ONLY place Models/Results reads" (ADR section 8.3). Same
  //     row/column shape as finance_baseline_outputs (it unions
  //     finance_prediction_outputs with a finance_baseline_outputs
  //     passthrough for scenario_mode=STANDARD_BASE) plus a non-key `source`
  //     discriminator column Compare surfaces but never keys on.
  //   - finance_valuation_methods: `20260809_finance_v3_d09_valuation_01_tables.sql`
  //     (`uq_finance_valuation_methods_bv_type UNIQUE (business_version_id,
  //     method_type)`). NOT finance_valuation_variants — that table
  //     (`uq_finance_valuation_variants_bv UNIQUE (business_version_id)`) is
  //     the one-row-per-variant header (case_id/name/description) with no
  //     comparable value column at all; the actual per-method headline
  //     result (`result_ev_decimal`) Compare's compareValuationMethods()
  //     needs to diff (DCF vs comps) lives on finance_valuation_methods. See
  //     `AP-05_compare_report.md` section "Judgment calls" for the full
  //     rationale — same "don't hand-wave a table name, read the real DDL"
  //     discipline ArtifactRef.ts's header documents for its own artifactType
  //     literals. This table has no period axis at all — every table shipped
  //     before it did, so it is the first real user of the `period: null`
  //     escape hatch `CellPeriodRefSchema.nullable()` below was written for.
  'finance_analysis_kpi_values',
  'finance_baseline_outputs',
  'finance_prediction_outputs_effective',
  'finance_valuation_methods',
] as const;
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
// finance_analysis_kpi_values row/column key branches (WP-D03 section 4.3 —
// `uq_finance_analysis_kpi_values_cell`).
// ---------------------------------------------------------------------------

export const financeAnalysisKpiValuesRowKeySchema = z.object({
  tableName: z.literal('finance_analysis_kpi_values'),
  entityId: z.string().min(1),
  kpiCatalogId: z.string().min(1),
});
export type FinanceAnalysisKpiValuesRowKey = z.infer<typeof financeAnalysisKpiValuesRowKeySchema>;

export const financeAnalysisKpiValuesColumnKeySchema = z.object({
  tableName: z.literal('finance_analysis_kpi_values'),
  periodId: z.string().min(1),
});
export type FinanceAnalysisKpiValuesColumnKey = z.infer<typeof financeAnalysisKpiValuesColumnKeySchema>;

// ---------------------------------------------------------------------------
// finance_baseline_outputs row/column key branches (WP-D05 section 4.4 —
// `uq_finance_baseline_outputs_cell`). No accumulation_basis axis.
// ---------------------------------------------------------------------------

export const financeBaselineOutputsRowKeySchema = z.object({
  tableName: z.literal('finance_baseline_outputs'),
  entityId: z.string().min(1),
  canonicalLineId: z.string().min(1),
  consolidationScope: z.enum(FinanceConsolidationScopeValues),
});
export type FinanceBaselineOutputsRowKey = z.infer<typeof financeBaselineOutputsRowKeySchema>;

export const financeBaselineOutputsColumnKeySchema = z.object({
  tableName: z.literal('finance_baseline_outputs'),
  periodId: z.string().min(1),
});
export type FinanceBaselineOutputsColumnKey = z.infer<typeof financeBaselineOutputsColumnKeySchema>;

// ---------------------------------------------------------------------------
// finance_prediction_outputs_effective row/column key branches — same shape
// as finance_baseline_outputs (see FinanceTableNameValues comment above: the
// VIEW unions finance_prediction_outputs with a finance_baseline_outputs
// passthrough, both of which share this row/column shape).
// ---------------------------------------------------------------------------

export const financePredictionOutputsEffectiveRowKeySchema = z.object({
  tableName: z.literal('finance_prediction_outputs_effective'),
  entityId: z.string().min(1),
  canonicalLineId: z.string().min(1),
  consolidationScope: z.enum(FinanceConsolidationScopeValues),
});
export type FinancePredictionOutputsEffectiveRowKey = z.infer<typeof financePredictionOutputsEffectiveRowKeySchema>;

export const financePredictionOutputsEffectiveColumnKeySchema = z.object({
  tableName: z.literal('finance_prediction_outputs_effective'),
  periodId: z.string().min(1),
});
export type FinancePredictionOutputsEffectiveColumnKey = z.infer<typeof financePredictionOutputsEffectiveColumnKeySchema>;

// ---------------------------------------------------------------------------
// finance_valuation_methods row/column key branches (WP-D09 section 4.2 —
// `uq_finance_valuation_methods_bv_type`). No period axis at all — the first
// real user of `CellRef.period === null` (see file header / section below).
// ---------------------------------------------------------------------------

export const FinanceValuationMethodTypeValues = [
  'DCF_FCFF',
  'DCF_FCFE',
  'DIVIDEND_DISCOUNT',
  'TRADING_COMPS',
  'PRECEDENT_TRANSACTIONS',
  'ASSET_BASED',
  'OTHER_WITH_POLICY',
] as const;
export type FinanceValuationMethodType = (typeof FinanceValuationMethodTypeValues)[number];

export const financeValuationMethodsRowKeySchema = z.object({
  tableName: z.literal('finance_valuation_methods'),
  methodType: z.enum(FinanceValuationMethodTypeValues),
});
export type FinanceValuationMethodsRowKey = z.infer<typeof financeValuationMethodsRowKeySchema>;

/** No period column on `finance_valuation_methods` — the column-key branch carries only the table discriminant. */
export const financeValuationMethodsColumnKeySchema = z.object({
  tableName: z.literal('finance_valuation_methods'),
});
export type FinanceValuationMethodsColumnKey = z.infer<typeof financeValuationMethodsColumnKeySchema>;

// ---------------------------------------------------------------------------
// CellRowKey / CellColumnKey — discriminated unions on `tableName`. Adding a
// table means adding one branch here, per the file header's extension note.
// ---------------------------------------------------------------------------

export const CellRowKeySchema = z.discriminatedUnion('tableName', [
  financeStmtLinesRowKeySchema,
  financeAnalysisKpiValuesRowKeySchema,
  financeBaselineOutputsRowKeySchema,
  financePredictionOutputsEffectiveRowKeySchema,
  financeValuationMethodsRowKeySchema,
]);
export type CellRowKey = z.infer<typeof CellRowKeySchema>;

export const CellColumnKeySchema = z.discriminatedUnion('tableName', [
  financeStmtLinesColumnKeySchema,
  financeAnalysisKpiValuesColumnKeySchema,
  financeBaselineOutputsColumnKeySchema,
  financePredictionOutputsEffectiveColumnKeySchema,
  financeValuationMethodsColumnKeySchema,
]);
export type CellColumnKey = z.infer<typeof CellColumnKeySchema>;

// ---------------------------------------------------------------------------
// Period — a denormalized, table-agnostic convenience projection. AP-05
// (Compare) and AP-01's freeze/find-by-period features need to read "what
// period is this cell in" WITHOUT knowing each table's table-specific
// columnKey shape. The whole `period` object is `null` for a table whose
// grid has no period axis at all (task: "period jeśli dotyczy" — "if
// applicable") — `finance_valuation_methods` (added by AP-05) is the first
// real user of that escape hatch. `accumulationBasis` inside `CellPeriodRef`
// is separately nullable: `finance_stmt_lines` is still the only table with
// a real accumulation_basis COLUMN (QUARTER_ONLY/YTD/LTM/FULL_YEAR — one
// period can be sliced four ways); `finance_analysis_kpi_values`,
// `finance_baseline_outputs` and `finance_prediction_outputs_effective` all
// have a real `period_id` but no such column (one row per period, full
// stop), so their constructors below pass `accumulationBasis: null` rather
// than fabricating a basis value the source table cannot actually express.
// ---------------------------------------------------------------------------

export const CellPeriodRefSchema = z.object({
  periodId: z.string().min(1),
  accumulationBasis: z.enum(FinanceAccumulationBasisValues).nullable(),
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

export function financeAnalysisKpiValuesCellRef(params: {
  organizationId: string;
  businessVersionId: string;
  entityId: string;
  kpiCatalogId: string;
  periodId: string;
}): CellRef {
  return {
    organizationId: params.organizationId,
    businessVersionId: params.businessVersionId,
    tableName: 'finance_analysis_kpi_values',
    rowKey: { tableName: 'finance_analysis_kpi_values', entityId: params.entityId, kpiCatalogId: params.kpiCatalogId },
    columnKey: { tableName: 'finance_analysis_kpi_values', periodId: params.periodId },
    period: { periodId: params.periodId, accumulationBasis: null },
  };
}

export function financeBaselineOutputsCellRef(params: {
  organizationId: string;
  businessVersionId: string;
  entityId: string;
  canonicalLineId: string;
  consolidationScope: FinanceConsolidationScope;
  periodId: string;
}): CellRef {
  return {
    organizationId: params.organizationId,
    businessVersionId: params.businessVersionId,
    tableName: 'finance_baseline_outputs',
    rowKey: {
      tableName: 'finance_baseline_outputs',
      entityId: params.entityId,
      canonicalLineId: params.canonicalLineId,
      consolidationScope: params.consolidationScope,
    },
    columnKey: { tableName: 'finance_baseline_outputs', periodId: params.periodId },
    period: { periodId: params.periodId, accumulationBasis: null },
  };
}

export function financePredictionOutputsEffectiveCellRef(params: {
  organizationId: string;
  businessVersionId: string;
  entityId: string;
  canonicalLineId: string;
  consolidationScope: FinanceConsolidationScope;
  periodId: string;
}): CellRef {
  return {
    organizationId: params.organizationId,
    businessVersionId: params.businessVersionId,
    tableName: 'finance_prediction_outputs_effective',
    rowKey: {
      tableName: 'finance_prediction_outputs_effective',
      entityId: params.entityId,
      canonicalLineId: params.canonicalLineId,
      consolidationScope: params.consolidationScope,
    },
    columnKey: { tableName: 'finance_prediction_outputs_effective', periodId: params.periodId },
    period: { periodId: params.periodId, accumulationBasis: null },
  };
}

export function financeValuationMethodsCellRef(params: {
  organizationId: string;
  businessVersionId: string;
  methodType: FinanceValuationMethodType;
}): CellRef {
  return {
    organizationId: params.organizationId,
    businessVersionId: params.businessVersionId,
    tableName: 'finance_valuation_methods',
    rowKey: { tableName: 'finance_valuation_methods', methodType: params.methodType },
    columnKey: { tableName: 'finance_valuation_methods' },
    period: null,
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
