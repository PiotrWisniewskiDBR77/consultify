/**
 * AP-00 — shared missing/value/freshness semantics (Finance v3, Gate D).
 *
 * Program: `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`
 * section 5 (AP-00 Shared productivity contracts), section 2.4 (Wartości finansowe).
 * ADR: `docs/validation/finance-v3/generated/gate-d/AP-00_shared_contracts_ADR.md`.
 *
 * This module is the TypeScript mirror of the `finance_value_status` Postgres
 * ENUM and the mandatory value-cell column bundle defined by
 * `docs/validation/finance-v3/generated/gate-b/WP-B01_artifact_schema_ADR.md`
 * section 2.7, and adopted verbatim by `finance_stmt_lines`
 * (`docs/validation/finance-v3/generated/gate-d/WP-D01_statements_schema_ADR.md`
 * section 4.5). It is intentionally the FIRST file in this directory other
 * modules (`CellRef.ts`, `Operation.ts`) depend on, since every domain table
 * this program will ever add (Statements today; Analysis/Baseline/Prediction/
 * Valuation later) is required to reuse this exact status vocabulary rather
 * than invent its own.
 *
 * `value_decimal` is represented here as a **decimal string, never a JS
 * `number`.** Postgres `NUMERIC` stores full source precision on purpose
 * (master plan section 2.4: "Rounding odbywa się wyłącznie na granicy
 * prezentacji"); round-tripping that through a JS `number` risks silent
 * precision loss on large financial figures (IEEE-754 double has ~15-17
 * significant decimal digits — insufficient for some consolidated multi-entity
 * sums). Every FinanceValue-carrying contract in this AP-00 package (CellRef,
 * Operation, capability responses) follows this same string convention.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// finance_value_status ENUM mirror (WP-B01 section 2.7)
// ---------------------------------------------------------------------------

export const FinanceValueStatusValues = [
  'PRESENT_ZERO',
  'PRESENT_NONZERO',
  'MISSING',
  'NA',
  'NOT_APPLICABLE',
] as const;
export type FinanceValueStatus = (typeof FinanceValueStatusValues)[number];
export const FinanceValueStatusSchema = z.enum(FinanceValueStatusValues);

/**
 * WP-B01 section 2.7 / WP-D01 section 5.6 — the three-way distinction that
 * must never silently collapse to zero:
 *   - MISSING = the data should exist but we don't have it (source gap/error).
 *   - NA = the analyst explicitly confirmed "not applicable this period/scenario".
 *   - NOT_APPLICABLE = the field structurally does not exist for this
 *     line/industry (e.g. Inventory Days for a services company).
 */
export const FINANCE_VALUE_STATUS_MEANING: Readonly<Record<FinanceValueStatus, string>> = {
  PRESENT_ZERO: 'A real, confirmed value of exactly zero.',
  PRESENT_NONZERO: 'A real, confirmed non-zero value.',
  MISSING: 'The data should exist but is not yet known (source gap or pending mapping). Never treated as zero.',
  NA: 'The analyst explicitly marked this cell as not applicable for this period/scenario. Never treated as zero without this explicit flag.',
  NOT_APPLICABLE: 'The field is structurally undefined for this line/industry/entity. Never treated as zero.',
};

// ---------------------------------------------------------------------------
// finance_stmt_lines.unit CHECK mirror (WP-D01 section 4.5)
// ---------------------------------------------------------------------------

export const FinanceUnitValues = ['UNITS', 'THOUSANDS', 'MILLIONS', 'BILLIONS'] as const;
export type FinanceUnit = (typeof FinanceUnitValues)[number];
export const FinanceUnitSchema = z.enum(FinanceUnitValues);

/** WP-D01 section 5.0 — the multiplier used by `finance_stmt_balance_tolerance()`'s `rounding_tolerance`. */
export const FINANCE_UNIT_MULTIPLIER: Readonly<Record<FinanceUnit, number>> = {
  UNITS: 1,
  THOUSANDS: 1_000,
  MILLIONS: 1_000_000,
  BILLIONS: 1_000_000_000,
};

// ---------------------------------------------------------------------------
// Artifact-version freshness (master plan section 2.4 — independent axis from
// business lifecycle status). Mirrors compute_job_status-adjacent freshness
// values already used by `computeJobService.ts`'s `ComputeJobFreshness`, kept
// as an independent literal union here (not imported) because this file must
// stay free of any service-layer dependency — it is the base every other
// AP-00 module (including capability responses) imports FROM.
// ---------------------------------------------------------------------------

export const FinanceArtifactFreshnessValues = [
  'NEVER_COMPUTED',
  'CURRENT',
  'STALE_SOURCE',
  'STALE_ASSUMPTIONS',
  'COMPUTE_FAILED',
] as const;
export type FinanceArtifactFreshness = (typeof FinanceArtifactFreshnessValues)[number];
export const FinanceArtifactFreshnessSchema = z.enum(FinanceArtifactFreshnessValues);

// ---------------------------------------------------------------------------
// FinanceValue — the mandatory value-cell bundle (WP-B01 section 2.7 columns,
// camelCased; `finance_stmt_lines` adopts the snake_case DB form verbatim).
// ---------------------------------------------------------------------------

export interface FinanceValue {
  status: FinanceValueStatus;
  /** Decimal string, full source precision. Null iff status is MISSING/NA/NOT_APPLICABLE. */
  valueDecimal: string | null;
  /** ISO 4217. The currency the source figure was denominated in. */
  nativeCurrency: string;
  /** ISO 4217. The currency after translation for group reporting. */
  presentationCurrency: string;
  unit: FinanceUnit;
  /** Scale factor applied on top of `unit`. Decimal string, same precision reasoning as `valueDecimal`. Defaults to "1" at the DB layer. */
  multiplier: string;
  /** `{source_document_ref, page, row, raw_label}` superset — feeds `finance_stmt_source_evidence` (WP-D01 section 4.7). Opaque here by design; that table owns the real shape. */
  sourceRef: Record<string, unknown> | null;
  isAdjustment: boolean;
  /** Required iff `isAdjustment` is true (`chk_finance_stmt_lines_adjustment_reason`). */
  adjustmentReason: string | null;
}

/**
 * Base object shape, exported UNREFINED (no `.superRefine`) so sibling
 * modules (`Operation.ts`'s `FinanceValueInputSchema`) can derive a partial
 * schema from `.shape` — `z.object(...).superRefine(...)` (see
 * `FinanceValueSchema` below) returns a `ZodEffects`/refined wrapper that no
 * longer exposes `.shape`.
 */
export const FinanceValueObjectSchema = z.object({
  status: FinanceValueStatusSchema,
  valueDecimal: z.string().nullable(),
  nativeCurrency: z.string().length(3),
  presentationCurrency: z.string().length(3),
  unit: FinanceUnitSchema,
  multiplier: z.string().min(1),
  sourceRef: z.record(z.string(), z.unknown()).nullable(),
  isAdjustment: z.boolean(),
  adjustmentReason: z.string().min(1).nullable(),
});

/** `value_status`/`value_decimal` shape rule, mirrored from `chk_finance_stmt_lines_value_shape` (WP-D01 section 4.5) so a malformed FinanceValue is rejected client-side before it ever reaches a batch mutation request. */
export const FinanceValueSchema = FinanceValueObjectSchema.superRefine((value, ctx) => {
    if (value.status === 'PRESENT_NONZERO' && (value.valueDecimal === null || value.valueDecimal === '0')) {
      ctx.addIssue({ code: 'custom', message: 'PRESENT_NONZERO requires a non-null, non-zero valueDecimal', path: ['valueDecimal'] });
    }
    if (value.status === 'PRESENT_ZERO' && value.valueDecimal !== '0') {
      ctx.addIssue({ code: 'custom', message: 'PRESENT_ZERO requires valueDecimal === "0"', path: ['valueDecimal'] });
    }
    if (['MISSING', 'NA', 'NOT_APPLICABLE'].includes(value.status) && value.valueDecimal !== null) {
      ctx.addIssue({ code: 'custom', message: `${value.status} requires valueDecimal to be null`, path: ['valueDecimal'] });
    }
    if (value.isAdjustment && !value.adjustmentReason) {
      ctx.addIssue({ code: 'custom', message: 'isAdjustment=true requires a non-empty adjustmentReason', path: ['adjustmentReason'] });
    }
  });

// ---------------------------------------------------------------------------
// Guards / helpers
// ---------------------------------------------------------------------------

export function isPresentValue(value: Pick<FinanceValue, 'status'>): boolean {
  return value.status === 'PRESENT_ZERO' || value.status === 'PRESENT_NONZERO';
}

export function isMissingValue(value: Pick<FinanceValue, 'status'>): boolean {
  return value.status === 'MISSING';
}

/**
 * WP-D01 section 5.6, "Missing nigdy nie staje się zero" — the TS-layer
 * enforcement point for AP-01's grid arithmetic (formula bar, roll-forward
 * previews, fill) and AP-05's Compare deltas. `MISSING` always yields `null`
 * (never `0`) so a caller is FORCED to handle the gap explicitly instead of
 * it silently entering a sum — the exact `firstNonZero` failure class the
 * master plan section 3 problem #2 documents against legacy
 * `financialModelingService.ts`.
 *
 * `NA`/`NOT_APPLICABLE` default to `null` too (same "don't silently zero"
 * discipline), but a caller that has already decided, in its own domain
 * logic, that NA should count as zero for one specific roll-forward (exactly
 * the choice `finance_stmt_check_retained_earnings_rollforward()` makes for
 * `DIVIDENDS_DECLARED` — WP-D01 section 5.3) may opt in via
 * `treatNaAsZero`/`treatNotApplicableAsZero`. There is no equivalent opt-in
 * for `MISSING` — that status can never become zero through this function,
 * by design.
 */
export function toArithmeticOperand(
  value: Pick<FinanceValue, 'status' | 'valueDecimal'>,
  opts: { treatNaAsZero?: boolean; treatNotApplicableAsZero?: boolean } = {}
): number | null {
  switch (value.status) {
    case 'PRESENT_ZERO':
      return 0;
    case 'PRESENT_NONZERO':
      return value.valueDecimal === null ? null : Number(value.valueDecimal);
    case 'NA':
      return opts.treatNaAsZero ? 0 : null;
    case 'NOT_APPLICABLE':
      return opts.treatNotApplicableAsZero ? 0 : null;
    case 'MISSING':
      return null;
    default: {
      const _exhaustive: never = value.status;
      return _exhaustive;
    }
  }
}
