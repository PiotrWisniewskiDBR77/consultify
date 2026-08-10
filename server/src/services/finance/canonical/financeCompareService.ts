/**
 * AP-05 — FinanceCompareService: the generic Compare engine (period, actual/
 * forecast, version, entity, scenario, valuation method).
 *
 * Program: `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 5 ("Compare jako rdzeń: period, actual/forecast, version,
 * entity, scenario i valuation method; absolute/Δ/%, materiality filters,
 * synchronized scroll i export diff" — synchronized scroll is AP-01 grid UI,
 * out of scope for this service). Report:
 * `docs/validation/finance-v3/generated/gate-d/AP-05_compare_report.md`.
 *
 * ONE generic primitive, `compareValues()`, does all the work: load matching
 * cells from two `{artifactRef, cellSelector}` sources, pair them by a
 * caller-chosen match key, and diff each pair (absolute / % / materiality /
 * MISSING-aware). `comparePeriods`/`compareVersions`/`compareEntities`/
 * `compareScenarios`/`compareValuationMethods` (task ZAKRES point 2) are then
 * thin, named calls into that primitive — each just fixes which artifact/
 * cellSelector axis varies between A and B and which key dimension(s) to
 * `ignoreDimensions` when matching (see that param's doc below).
 * `compareActualVsForecast` is a sixth wrapper covering the "actual/forecast"
 * axis this addendum section explicitly names but the task's own ZAKRES list
 * omits — the underlying primitive already supports it for free (sourceA and
 * sourceB may point at two DIFFERENT tables), so it costs nothing extra to
 * expose it under its own name rather than leaving it as an undocumented side
 * effect of the generic engine.
 *
 * Table coverage (task's five sources — the migration reports named in the
 * work order): `finance_stmt_lines` (WP-D01b), `finance_analysis_kpi_values`
 * (WP-D03b), `finance_baseline_outputs` (WP-D05b),
 * `finance_prediction_outputs_effective` (WP-D07b VIEW — "the ONLY place
 * Models/Results reads", ADR section 8.3), `finance_valuation_methods`, NOT
 * `finance_valuation_variants` (WP-D09b names both; `variants` is the
 * one-row-per-variant header with no comparable value column — see
 * `CellRef.ts`'s `FinanceTableNameValues` comment and the compare report's
 * "Judgment calls" section for the full rationale).
 *
 * MISSING/NA discipline (task: "nigdy fałszywe 0 diff gdy jedna strona
 * MISSING"): every loaded cell keeps its `finance_value_status` all the way
 * through. `absoluteDiff`/`pctDiff` are computed ONLY when both sides are a
 * real `PRESENT_ZERO`/`PRESENT_NONZERO` value (via
 * `financeValueSemantics.ts`'s `toArithmeticOperand`, this program's single
 * source of truth for "MISSING never becomes zero" — see that file's own
 * doc comment, which already anticipates this exact module: "AP-05's Compare
 * deltas"). Any other combination (MISSING/NA/NOT_APPLICABLE/no row at all
 * on either side) yields `absoluteDiff: null, pctDiff: null,
 * diffKind: 'MISSING_...'` plus a human-readable `note` — never a numeric
 * zero standing in for "unknown".
 *
 * Currency discipline: if the two matched cells carry different
 * `presentationCurrency`, this module does NOT attempt an FX conversion (no
 * rate is available to a generic compare primitive) — it flags
 * `currencyMismatch: true` and leaves the diff `null` rather than silently
 * subtracting two different currencies as if they were the same number
 * (`FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` section 2 point 4,
 * "Waluty").
 *
 * Scale discipline: every present value is converted to full
 * presentation-currency units (`value_decimal * FINANCE_UNIT_MULTIPLIER[unit]
 * * multiplier`) before diffing — the same discipline
 * `valuationFcffService.ts`'s `toFullUnitValue` documents (regression guard
 * for the real "Apator ~1000x too small" production incident, memory note
 * `p4-apator-realny-upload-2026-08-06`).
 *
 * Materiality: reuses the SAME provisional placeholder
 * `statementReconciliationService.ts` exports
 * (`PROVISIONAL_MATERIALITY_THRESHOLD_PCT`, 5%,
 * `GATE_B_INTEGRATION_RECONCILIATION.md` section 7, `PROVISIONAL_PENDING_OWNER_DECISION`)
 * — not a second, independently-invented number. Same caller contract: pass
 * `materialityThresholdPct` to override (the "or a lower per-organization
 * threshold" half of that placeholder rule); this module does not compare
 * against the default on the caller's behalf.
 */

import { withPinnedPostgresTransaction, type PinnedTransactionClient } from '../../../database/PostgresDatabase.js';
import type { ArtifactRef } from '../../../types/finance/ArtifactRef.js';
import {
  cellRefKey,
  financeAnalysisKpiValuesCellRef,
  financeBaselineOutputsCellRef,
  financePredictionOutputsEffectiveCellRef,
  financeStmtLinesCellRef,
  financeValuationMethodsCellRef,
  type CellRef,
  type FinanceAccumulationBasis,
  type FinanceConsolidationScope,
  type FinanceTableName,
  type FinanceValuationMethodType,
} from '../../../types/finance/CellRef.js';
import {
  FINANCE_UNIT_MULTIPLIER,
  toArithmeticOperand,
  type FinanceUnit,
  type FinanceValueStatus,
} from '../../../types/finance/financeValueSemantics.js';
import type { BusinessVersionRow } from './artifactVersionService.js';
import type { FinanceArtifactType } from './lifecycleService.js';
import { PROVISIONAL_MATERIALITY_THRESHOLD_PCT } from './statementReconciliationService.js';

// ---------------------------------------------------------------------------
// artifactType -> table mapping (drives which SQL loader `loadCellsForSource`
// dispatches to; keeps `CompareCellFilter` free of a redundant/spoofable
// `tableName` field the caller could set inconsistently with `artifactRef`).
// ---------------------------------------------------------------------------

const ARTIFACT_TYPE_TABLE: Readonly<Record<FinanceArtifactType, FinanceTableName | null>> = {
  STATEMENT_PACK: 'finance_stmt_lines',
  HISTORICAL_ANALYSIS: 'finance_analysis_kpi_values',
  BASELINE_MODEL: 'finance_baseline_outputs',
  PREDICTION_SCENARIO: 'finance_prediction_outputs_effective',
  VALUATION_CASE: 'finance_valuation_methods',
  REPORT_EXPORT: null, // frozen output, not a live comparable value grid
};

// ---------------------------------------------------------------------------
// Cell selector — one shape covers every table; each loader below reads only
// the filter fields relevant to its own table and ignores the rest.
// ---------------------------------------------------------------------------

export interface CompareCellFilter {
  entityId?: string;
  entityIds?: readonly string[];
  periodId?: string;
  periodIds?: readonly string[];
  canonicalLineId?: string;
  canonicalLineIds?: readonly string[];
  kpiCatalogId?: string;
  kpiCatalogIds?: readonly string[];
  consolidationScope?: FinanceConsolidationScope;
  /** `finance_stmt_lines` only — the other four tables have no accumulation_basis column (CellRef.ts). */
  accumulationBasis?: FinanceAccumulationBasis;
  methodType?: FinanceValuationMethodType;
  methodTypes?: readonly FinanceValuationMethodType[];
}

export interface CompareSource {
  artifactRef: ArtifactRef;
  cellSelector: CompareCellFilter;
  /** Human label for reports/export ("Original", "Restated", "Base", "Downside", ...). Defaults to the businessVersionId. */
  label?: string;
}

/** Which rowKey/columnKey dimension(s) are EXPECTED to legitimately differ between sourceA and sourceB and must therefore be excluded from the pairing key. Default `[]` — full-key match, correct for compareVersions/compareScenarios/compareValuationMethods/compareActualVsForecast, where the axis that varies lives OUTSIDE the cell key (businessVersionId, or which table). comparePeriods sets `['periodId']`; compareEntities sets `['entityId']`. */
export type CompareDimensionName =
  | 'entityId'
  | 'periodId'
  | 'canonicalLineId'
  | 'kpiCatalogId'
  | 'consolidationScope'
  | 'accumulationBasis'
  | 'methodType';

export interface CompareValuesParams {
  organizationId: string;
  sourceA: CompareSource;
  sourceB: CompareSource;
  ignoreDimensions?: readonly CompareDimensionName[];
  /** Default `PROVISIONAL_MATERIALITY_THRESHOLD_PCT` (statementReconciliationService.ts). */
  materialityThresholdPct?: number;
  /** Materiality filter (task point 3): when true, `result.rows` keeps only `materialityFlag=true` rows PLUS every non-`BOTH_PRESENT` row (a MISSING-side mismatch is never filtered out as "immaterial noise" — task point 1's "nigdy fałszywe 0 diff" extends to "nigdy cicho odfiltrowane"). `result.summary` always covers the FULL unfiltered set regardless of this flag. */
  onlyMaterial?: boolean;
}

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

export type CompareCellPresence = 'PRESENT' | 'MISSING' | 'NA' | 'NOT_APPLICABLE' | 'NO_ROW';

export interface CompareCellPoint {
  presence: CompareCellPresence;
  valueStatus: FinanceValueStatus | null; // null iff presence === 'NO_ROW' (no matching row at all, not even a MISSING-status one)
  businessVersionId: string;
  cellRef: CellRef | null; // null iff presence === 'NO_ROW'
  /** Full presentation-currency units (`value_decimal * FINANCE_UNIT_MULTIPLIER[unit] * multiplier`). Null unless presence === 'PRESENT'. */
  fullUnitValue: number | null;
  rawValueDecimal: string | null;
  unit: FinanceUnit | null;
  multiplier: string | null;
  nativeCurrency: string | null;
  presentationCurrency: string | null;
}

export type CompareDiffKind = 'BOTH_PRESENT' | 'MISSING_IN_A' | 'MISSING_IN_B' | 'MISSING_IN_BOTH' | 'CURRENCY_MISMATCH';

export interface CompareRow {
  matchKey: string;
  /** The row/column key dimensions that were NOT excluded by `ignoreDimensions`, labeled for display. Note: `dimensions.entityId` (when present) holds `entity_code` (e.g. "PARENT"), not a raw per-version entity UUID — see `LoadedCell.dimensions` doc. The real per-version UUID is on `a.cellRef`/`b.cellRef`. */
  dimensions: Record<string, string>;
  a: CompareCellPoint;
  b: CompareCellPoint;
  diffKind: CompareDiffKind;
  /** `b.fullUnitValue - a.fullUnitValue`. Signed (never `Math.abs`) so callers can read direction, not just magnitude. Null unless diffKind === 'BOTH_PRESENT'. */
  absoluteDiff: number | null;
  /** `absoluteDiff / |a.fullUnitValue|`. Signed. Null when a's base is 0 (percentage undefined, matches `statementReconciliationService.ts`'s own `residualPct` convention) or when absoluteDiff is null. */
  pctDiff: number | null;
  /** `pctDiff !== null && Math.abs(pctDiff) > materialityThresholdPct`, OR (pctDiff is null because base=0 AND absoluteDiff !== 0) — an unmeasurable-percentage change from a zero base is never silently treated as immaterial. Always `false` when diffKind !== 'BOTH_PRESENT' (materiality is a magnitude-of-numeric-change concept; a MISSING-side mismatch is surfaced separately, not conflated with it). */
  materialityFlag: boolean;
  note: string | null;
}

export type CompareComparisonType =
  | 'PERIOD'
  | 'VERSION'
  | 'ENTITY'
  | 'SCENARIO'
  | 'VALUATION_METHOD'
  | 'ACTUAL_VS_FORECAST'
  | 'GENERIC';

export interface CompareSummary {
  totalRows: number;
  bothPresent: number;
  missingInA: number;
  missingInB: number;
  missingInBoth: number;
  currencyMismatch: number;
  materialCount: number;
}

export interface CompareResult {
  comparisonType: CompareComparisonType;
  organizationId: string;
  generatedAt: string;
  sourceA: { artifactType: FinanceArtifactType; businessVersionId: string; label: string };
  sourceB: { artifactType: FinanceArtifactType; businessVersionId: string; label: string };
  ignoreDimensions: readonly CompareDimensionName[];
  materialityThresholdPct: number;
  onlyMaterial: boolean;
  /** Full, unfiltered pair set even when `onlyMaterial` is requested (summary counts always describe reality, not the filtered view). */
  summary: CompareSummary;
  /** Filtered per `onlyMaterial` — see that param's doc. */
  rows: CompareRow[];
}

export type CompareErrorCode =
  | 'ARTIFACT_NOT_FOUND'
  | 'ORGANIZATION_MISMATCH'
  | 'UNSUPPORTED_ARTIFACT_TYPE'
  | 'AMBIGUOUS_MATCH_KEY'
  | 'VERSION_ARTIFACT_MISMATCH'
  | 'ENTITY_CODE_NOT_FOUND';

export type CompareValuesResult = { ok: true; result: CompareResult } | { ok: false; code: CompareErrorCode; message: string };

// ---------------------------------------------------------------------------
// Full-unit value conversion (mirrors valuationFcffService.ts's toFullUnitValue,
// widened to unit=null — finance_valuation_methods carries no unit/multiplier
// bundle at all, its result_ev_decimal is already a full-currency figure).
// ---------------------------------------------------------------------------

export function toFullUnitValue(status: FinanceValueStatus, valueDecimal: string | null, unit: FinanceUnit | null, multiplier: string | null): number | null {
  const operand = toArithmeticOperand({ status, valueDecimal: valueDecimal });
  if (operand === null) return null;
  const unitMultiplier = unit ? FINANCE_UNIT_MULTIPLIER[unit] : 1;
  const mult = multiplier === null || multiplier === undefined ? 1 : Number(multiplier);
  return operand * unitMultiplier * mult;
}

export function presenceForStatus(status: FinanceValueStatus): CompareCellPresence {
  switch (status) {
    case 'PRESENT_ZERO':
    case 'PRESENT_NONZERO':
      return 'PRESENT';
    case 'MISSING':
      return 'MISSING';
    case 'NA':
      return 'NA';
    case 'NOT_APPLICABLE':
      return 'NOT_APPLICABLE';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Loaded cell — table-agnostic normalized shape every loader below produces.
// ---------------------------------------------------------------------------

export interface LoadedCell {
  cellRef: CellRef;
  /**
   * Dimension name -> string value, for match-key building and display. Only
   * the dimensions this table actually has. IMPORTANT: the `entityId` slot
   * here holds `finance_stmt_entities.entity_code` (the stable natural key),
   * NOT the raw per-business_version `entity_id` UUID — see the `RawRow`
   * `entity_code` field doc for why a raw-UUID match would silently produce
   * zero pairs (or wrong pairs) whenever sourceA/sourceB point at different
   * business_version_id (compareVersions/compareScenarios/
   * compareActualVsForecast — i.e. most of this module's named wrappers).
   * The real per-version `entity_id` UUID is still available to callers via
   * `cellRef.rowKey.entityId` on each side's `CompareCellPoint`.
   */
  dimensions: Partial<Record<CompareDimensionName, string>>;
  businessVersionId: string;
  valueStatus: FinanceValueStatus;
  fullUnitValue: number | null;
  rawValueDecimal: string | null;
  unit: FinanceUnit | null;
  multiplier: string | null;
  nativeCurrency: string | null;
  presentationCurrency: string | null;
}

function toPoint(cell: LoadedCell | undefined, businessVersionIdIfAbsent: string): CompareCellPoint {
  if (!cell) {
    return {
      presence: 'NO_ROW',
      valueStatus: null,
      businessVersionId: businessVersionIdIfAbsent,
      cellRef: null,
      fullUnitValue: null,
      rawValueDecimal: null,
      unit: null,
      multiplier: null,
      nativeCurrency: null,
      presentationCurrency: null,
    };
  }
  return {
    presence: presenceForStatus(cell.valueStatus),
    valueStatus: cell.valueStatus,
    businessVersionId: cell.businessVersionId,
    cellRef: cell.cellRef,
    fullUnitValue: cell.fullUnitValue,
    rawValueDecimal: cell.rawValueDecimal,
    unit: cell.unit,
    multiplier: cell.multiplier,
    nativeCurrency: cell.nativeCurrency,
    presentationCurrency: cell.presentationCurrency,
  };
}

// ---------------------------------------------------------------------------
// SQL loaders — one per table. Every SELECT list is aliased to the same
// column set (`value_status`, `value_decimal`, plus whichever dimension
// columns that table has) so the code above them stays table-agnostic.
// ---------------------------------------------------------------------------

interface RawRow {
  entity_id?: string | null;
  /** `finance_stmt_entities.entity_code` — the STABLE natural key across business_version_id boundaries (see that table's DDL comment: "stable natural key across versions/periods for the same legal entity"). `entity_id` itself is a fresh, copy-on-write UUID per business_version_id (`uq_finance_stmt_entities_version_code UNIQUE (business_version_id, entity_code)`), so it CANNOT be used to pair "the same entity" across two different business_version_id — every loader below joins `finance_stmt_entities` to fetch this and uses it, not `entity_id`, as the `dimensions.entityId` match value (see `LoadedCell.dimensions` doc). */
  entity_code?: string | null;
  canonical_line_id?: string | null;
  kpi_catalog_id?: string | null;
  period_id?: string | null;
  consolidation_scope?: FinanceConsolidationScope | null;
  accumulation_basis?: FinanceAccumulationBasis | null;
  method_type?: FinanceValuationMethodType | null;
  value_status: FinanceValueStatus;
  value_decimal: string | null;
  unit: FinanceUnit | null;
  multiplier: string | null;
  native_currency: string | null;
  presentation_currency: string | null;
}

/** Appends `AND col = ?` / `AND col = ANY(?)` clauses for the filters present on `filter`. Mutates `clauses`/`args`. */
function pushFilter(clauses: string[], args: unknown[], column: string, single: string | undefined, many: readonly string[] | undefined): void {
  if (many && many.length > 0) {
    clauses.push(`${column} = ANY(?)`);
    args.push([...many]);
  } else if (single) {
    clauses.push(`${column} = ?`);
    args.push(single);
  }
}

async function loadStmtLines(tx: PinnedTransactionClient, organizationId: string, businessVersionId: string, filter: CompareCellFilter): Promise<LoadedCell[]> {
  const clauses = ['t.business_version_id = ?'];
  const args: unknown[] = [businessVersionId];
  pushFilter(clauses, args, 't.entity_id', filter.entityId, filter.entityIds);
  pushFilter(clauses, args, 't.canonical_line_id', filter.canonicalLineId, filter.canonicalLineIds);
  pushFilter(clauses, args, 't.period_id', filter.periodId, filter.periodIds);
  if (filter.consolidationScope) {
    clauses.push('t.consolidation_scope = ?');
    args.push(filter.consolidationScope);
  }
  if (filter.accumulationBasis) {
    clauses.push('t.accumulation_basis = ?');
    args.push(filter.accumulationBasis);
  }
  const rows = await tx.queryAll<RawRow>(
    `SELECT t.entity_id, e.entity_code, t.canonical_line_id, t.period_id, t.consolidation_scope, t.accumulation_basis,
            t.value_status, t.value_decimal, t.unit, t.multiplier, t.native_currency, t.presentation_currency
       FROM finance_stmt_lines t
       JOIN finance_stmt_entities e ON e.id = t.entity_id
      WHERE ${clauses.join(' AND ')}`,
    args
  );
  return rows.map((r) => {
    const cellRef = financeStmtLinesCellRef({
      organizationId,
      businessVersionId,
      entityId: r.entity_id!,
      canonicalLineId: r.canonical_line_id!,
      consolidationScope: r.consolidation_scope!,
      periodId: r.period_id!,
      accumulationBasis: r.accumulation_basis!,
    });
    return {
      cellRef,
      dimensions: {
        entityId: r.entity_code!,
        canonicalLineId: r.canonical_line_id!,
        consolidationScope: r.consolidation_scope!,
        periodId: r.period_id!,
        accumulationBasis: r.accumulation_basis!,
      },
      businessVersionId,
      valueStatus: r.value_status,
      fullUnitValue: toFullUnitValue(r.value_status, r.value_decimal, r.unit, r.multiplier),
      rawValueDecimal: r.value_decimal,
      unit: r.unit,
      multiplier: r.multiplier,
      nativeCurrency: r.native_currency,
      presentationCurrency: r.presentation_currency,
    };
  });
}

async function loadKpiValues(tx: PinnedTransactionClient, organizationId: string, businessVersionId: string, filter: CompareCellFilter): Promise<LoadedCell[]> {
  const clauses = ['t.business_version_id = ?'];
  const args: unknown[] = [businessVersionId];
  pushFilter(clauses, args, 't.entity_id', filter.entityId, filter.entityIds);
  pushFilter(clauses, args, 't.kpi_catalog_id', filter.kpiCatalogId, filter.kpiCatalogIds);
  pushFilter(clauses, args, 't.period_id', filter.periodId, filter.periodIds);
  const rows = await tx.queryAll<RawRow>(
    `SELECT t.entity_id, e.entity_code, t.kpi_catalog_id, t.period_id, t.value_status, t.value_decimal, t.unit, t.multiplier,
            t.native_currency, t.presentation_currency
       FROM finance_analysis_kpi_values t
       JOIN finance_stmt_entities e ON e.id = t.entity_id
      WHERE ${clauses.join(' AND ')}`,
    args
  );
  return rows.map((r) => {
    const cellRef = financeAnalysisKpiValuesCellRef({
      organizationId,
      businessVersionId,
      entityId: r.entity_id!,
      kpiCatalogId: r.kpi_catalog_id!,
      periodId: r.period_id!,
    });
    return {
      cellRef,
      dimensions: { entityId: r.entity_code!, kpiCatalogId: r.kpi_catalog_id!, periodId: r.period_id! },
      businessVersionId,
      valueStatus: r.value_status,
      fullUnitValue: toFullUnitValue(r.value_status, r.value_decimal, r.unit, r.multiplier),
      rawValueDecimal: r.value_decimal,
      unit: r.unit,
      multiplier: r.multiplier,
      nativeCurrency: r.native_currency,
      presentationCurrency: r.presentation_currency,
    };
  });
}

async function loadBaselineOutputs(tx: PinnedTransactionClient, organizationId: string, businessVersionId: string, filter: CompareCellFilter): Promise<LoadedCell[]> {
  const clauses = ['t.business_version_id = ?'];
  const args: unknown[] = [businessVersionId];
  pushFilter(clauses, args, 't.entity_id', filter.entityId, filter.entityIds);
  pushFilter(clauses, args, 't.canonical_line_id', filter.canonicalLineId, filter.canonicalLineIds);
  pushFilter(clauses, args, 't.period_id', filter.periodId, filter.periodIds);
  if (filter.consolidationScope) {
    clauses.push('t.consolidation_scope = ?');
    args.push(filter.consolidationScope);
  }
  const rows = await tx.queryAll<RawRow>(
    `SELECT t.entity_id, e.entity_code, t.canonical_line_id, t.period_id, t.consolidation_scope,
            t.value_status, t.value_decimal, t.unit, t.multiplier, t.native_currency, t.presentation_currency
       FROM finance_baseline_outputs t
       JOIN finance_stmt_entities e ON e.id = t.entity_id
      WHERE ${clauses.join(' AND ')}`,
    args
  );
  return rows.map((r) => {
    const cellRef = financeBaselineOutputsCellRef({
      organizationId,
      businessVersionId,
      entityId: r.entity_id!,
      canonicalLineId: r.canonical_line_id!,
      consolidationScope: r.consolidation_scope!,
      periodId: r.period_id!,
    });
    return {
      cellRef,
      dimensions: {
        entityId: r.entity_code!,
        canonicalLineId: r.canonical_line_id!,
        consolidationScope: r.consolidation_scope!,
        periodId: r.period_id!,
      },
      businessVersionId,
      valueStatus: r.value_status,
      fullUnitValue: toFullUnitValue(r.value_status, r.value_decimal, r.unit, r.multiplier),
      rawValueDecimal: r.value_decimal,
      unit: r.unit,
      multiplier: r.multiplier,
      nativeCurrency: r.native_currency,
      presentationCurrency: r.presentation_currency,
    };
  });
}

/** `finance_prediction_outputs_effective` — VIEW, no `organization_id` column (WP-D07 ADR section 8.3); the caller's `loadCellsForSource` already validated org ownership of `businessVersionId` via `finance_business_versions` before this is ever called. */
async function loadPredictionOutputsEffective(tx: PinnedTransactionClient, organizationId: string, businessVersionId: string, filter: CompareCellFilter): Promise<LoadedCell[]> {
  const clauses = ['t.business_version_id = ?'];
  const args: unknown[] = [businessVersionId];
  pushFilter(clauses, args, 't.entity_id', filter.entityId, filter.entityIds);
  pushFilter(clauses, args, 't.canonical_line_id', filter.canonicalLineId, filter.canonicalLineIds);
  pushFilter(clauses, args, 't.period_id', filter.periodId, filter.periodIds);
  if (filter.consolidationScope) {
    clauses.push('t.consolidation_scope = ?');
    args.push(filter.consolidationScope);
  }
  const rows = await tx.queryAll<RawRow>(
    `SELECT t.entity_id, e.entity_code, t.canonical_line_id, t.period_id, t.consolidation_scope,
            t.value_status, t.value_decimal, t.unit, t.multiplier, t.native_currency, t.presentation_currency
       FROM finance_prediction_outputs_effective t
       JOIN finance_stmt_entities e ON e.id = t.entity_id
      WHERE ${clauses.join(' AND ')}`,
    args
  );
  return rows.map((r) => {
    const cellRef = financePredictionOutputsEffectiveCellRef({
      organizationId,
      businessVersionId,
      entityId: r.entity_id!,
      canonicalLineId: r.canonical_line_id!,
      consolidationScope: r.consolidation_scope!,
      periodId: r.period_id!,
    });
    return {
      cellRef,
      dimensions: {
        entityId: r.entity_code!,
        canonicalLineId: r.canonical_line_id!,
        consolidationScope: r.consolidation_scope!,
        periodId: r.period_id!,
      },
      businessVersionId,
      valueStatus: r.value_status,
      fullUnitValue: toFullUnitValue(r.value_status, r.value_decimal, r.unit, r.multiplier),
      rawValueDecimal: r.value_decimal,
      unit: r.unit,
      multiplier: r.multiplier,
      nativeCurrency: r.native_currency,
      presentationCurrency: r.presentation_currency,
    };
  });
}

async function loadValuationMethods(tx: PinnedTransactionClient, organizationId: string, businessVersionId: string, filter: CompareCellFilter): Promise<LoadedCell[]> {
  const clauses = ['business_version_id = ?'];
  const args: unknown[] = [businessVersionId];
  pushFilter(clauses, args, 'method_type', filter.methodType, filter.methodTypes);
  const rows = await tx.queryAll<{ method_type: FinanceValuationMethodType; result_value_status: FinanceValueStatus; result_ev_decimal: string | null }>(
    `SELECT method_type, result_value_status, result_ev_decimal
       FROM finance_valuation_methods WHERE ${clauses.join(' AND ')}`,
    args
  );
  return rows.map((r) => {
    const cellRef = financeValuationMethodsCellRef({ organizationId, businessVersionId, methodType: r.method_type });
    return {
      cellRef,
      dimensions: { methodType: r.method_type },
      businessVersionId,
      valueStatus: r.result_value_status,
      fullUnitValue: toFullUnitValue(r.result_value_status, r.result_ev_decimal, null, null),
      rawValueDecimal: r.result_ev_decimal,
      unit: null,
      multiplier: null,
      nativeCurrency: null,
      presentationCurrency: null,
    };
  });
}

const LOADERS: Readonly<Record<FinanceTableName, (tx: PinnedTransactionClient, organizationId: string, businessVersionId: string, filter: CompareCellFilter) => Promise<LoadedCell[]>>> = {
  finance_stmt_lines: loadStmtLines,
  finance_analysis_kpi_values: loadKpiValues,
  finance_baseline_outputs: loadBaselineOutputs,
  finance_prediction_outputs_effective: loadPredictionOutputsEffective,
  finance_valuation_methods: loadValuationMethods,
};

// ---------------------------------------------------------------------------
// Org-scoped resolve + load — every cell read goes through here, never
// straight to a loader, so tenant ownership of businessVersionId is always
// verified against `finance_business_versions` first (the loaders' own
// tables — `finance_prediction_outputs_effective` above all — cannot all be
// trusted to carry `organization_id` directly).
// ---------------------------------------------------------------------------

interface ResolvedSource {
  businessVersion: BusinessVersionRow;
  table: FinanceTableName;
  cells: LoadedCell[];
  label: string;
}

type ResolveSourceResult = { ok: true; resolved: ResolvedSource } | { ok: false; code: CompareErrorCode; message: string };

async function resolveSource(tx: PinnedTransactionClient, organizationId: string, source: CompareSource): Promise<ResolveSourceResult> {
  const { artifactRef } = source;
  if (artifactRef.organizationId !== organizationId) {
    return { ok: false, code: 'ORGANIZATION_MISMATCH', message: `sourceA/B artifactRef.organizationId (${artifactRef.organizationId}) does not match compareValues params.organizationId (${organizationId})` };
  }
  const businessVersion = await getBusinessVersionViaTx(tx, organizationId, artifactRef.businessVersionId);
  if (!businessVersion) {
    return { ok: false, code: 'ARTIFACT_NOT_FOUND', message: `No finance_business_versions row for business_version_id=${artifactRef.businessVersionId} in organization ${organizationId}` };
  }
  const table = ARTIFACT_TYPE_TABLE[artifactRef.artifactType];
  if (!table) {
    return { ok: false, code: 'UNSUPPORTED_ARTIFACT_TYPE', message: `artifactType=${artifactRef.artifactType} has no comparable value table (REPORT_EXPORT is a frozen output, not a live grid)` };
  }
  const cells = await LOADERS[table](tx, organizationId, artifactRef.businessVersionId, source.cellSelector);
  return { ok: true, resolved: { businessVersion, table, cells, label: source.label ?? artifactRef.businessVersionId } };
}

/** Reads one `finance_business_versions` row on the CALLER's already-open `tx` (never opens its own `withPinnedPostgresTransaction`) — `compareVersions` below also calls this directly on its own short-lived transaction before `compareValues` opens its (separate) one for the actual cell diff. */
async function getBusinessVersionViaTx(tx: PinnedTransactionClient, organizationId: string, businessVersionId: string): Promise<BusinessVersionRow | null> {
  return tx.queryOne<BusinessVersionRow>(`SELECT * FROM finance_business_versions WHERE business_version_id = ? AND organization_id = ?`, [businessVersionId, organizationId]);
}

/**
 * `entity_code` -> the real per-`businessVersionId` `finance_stmt_entities.id` UUID. Every wrapper
 * that compares across TWO DIFFERENT business_version_id (`compareVersions`/`compareScenarios`/
 * `compareActualVsForecast`) MUST resolve entity identity through this — a single raw `entityId`
 * filter shared across both sides would silently filter one (or both) sides to zero rows, since
 * `finance_stmt_entities` is copy-on-write per business_version_id (see `RawRow.entity_code` doc).
 */
async function resolveEntityIdByCode(tx: PinnedTransactionClient, organizationId: string, businessVersionId: string, entityCode: string): Promise<string | null> {
  const row = await tx.queryOne<{ id: string }>(
    `SELECT id FROM finance_stmt_entities WHERE organization_id = ? AND business_version_id = ? AND entity_code = ?`,
    [organizationId, businessVersionId, entityCode]
  );
  return row?.id ?? null;
}

// ---------------------------------------------------------------------------
// Match-key building
// ---------------------------------------------------------------------------

export function buildMatchKey(dimensions: Partial<Record<CompareDimensionName, string>>, ignore: readonly CompareDimensionName[]): string {
  const ignoreSet = new Set(ignore);
  const entries = Object.entries(dimensions).filter(([k]) => !ignoreSet.has(k as CompareDimensionName));
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return entries.map(([k, v]) => `${k}=${v}`).join('&');
}

export function dimensionsForDisplay(dimensions: Partial<Record<CompareDimensionName, string>>, ignore: readonly CompareDimensionName[]): Record<string, string> {
  const ignoreSet = new Set(ignore);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(dimensions)) {
    if (!ignoreSet.has(k as CompareDimensionName) && v !== undefined) out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Diff a matched pair
// ---------------------------------------------------------------------------

export function diffPair(a: LoadedCell | undefined, b: LoadedCell | undefined, materialityThresholdPct: number): Pick<CompareRow, 'diffKind' | 'absoluteDiff' | 'pctDiff' | 'materialityFlag' | 'note'> {
  const aPresent = a?.valueStatus === 'PRESENT_ZERO' || a?.valueStatus === 'PRESENT_NONZERO';
  const bPresent = b?.valueStatus === 'PRESENT_ZERO' || b?.valueStatus === 'PRESENT_NONZERO';

  if (aPresent && bPresent) {
    if (a!.presentationCurrency && b!.presentationCurrency && a!.presentationCurrency !== b!.presentationCurrency) {
      return {
        diffKind: 'CURRENCY_MISMATCH',
        absoluteDiff: null,
        pctDiff: null,
        materialityFlag: false,
        note: `Presentation currency differs (${a!.presentationCurrency} vs ${b!.presentationCurrency}) — this generic Compare primitive has no FX rate to convert; diff withheld rather than silently comparing two currencies as the same number.`,
      };
    }
    const va = a!.fullUnitValue!;
    const vb = b!.fullUnitValue!;
    const absoluteDiff = vb - va;
    const pctDiff = va === 0 ? null : absoluteDiff / Math.abs(va);
    const materialityFlag = pctDiff !== null ? Math.abs(pctDiff) > materialityThresholdPct : absoluteDiff !== 0;
    const note = pctDiff === null && absoluteDiff !== 0 ? "Base value (side A) is 0 — percentage change is undefined; flagged material by absolute-change-from-zero, per DEC-FIN-009's 'never silently treat an unmeasurable change as immaterial'." : null;
    return { diffKind: 'BOTH_PRESENT', absoluteDiff, pctDiff, materialityFlag, note };
  }

  if (!aPresent && !bPresent) {
    return { diffKind: 'MISSING_IN_BOTH', absoluteDiff: null, pctDiff: null, materialityFlag: false, note: 'Neither side has a present value — diff is undefined, not 0.' };
  }
  if (!aPresent) {
    return { diffKind: 'MISSING_IN_A', absoluteDiff: null, pctDiff: null, materialityFlag: false, note: `Side A is ${a ? a.valueStatus : 'absent (no row)'} — diff withheld, never a false 0.` };
  }
  return { diffKind: 'MISSING_IN_B', absoluteDiff: null, pctDiff: null, materialityFlag: false, note: `Side B is ${b ? b.valueStatus : 'absent (no row)'} — diff withheld, never a false 0.` };
}

// ---------------------------------------------------------------------------
// compareValues — the generic primitive
// ---------------------------------------------------------------------------

export async function compareValues(params: CompareValuesParams, comparisonType: CompareComparisonType = 'GENERIC'): Promise<CompareValuesResult> {
  const ignoreDimensions = params.ignoreDimensions ?? [];
  const materialityThresholdPct = params.materialityThresholdPct ?? PROVISIONAL_MATERIALITY_THRESHOLD_PCT;

  return withPinnedPostgresTransaction(async (tx) => {
    const resolvedA = await resolveSource(tx, params.organizationId, params.sourceA);
    if (!resolvedA.ok) return resolvedA;
    const resolvedB = await resolveSource(tx, params.organizationId, params.sourceB);
    if (!resolvedB.ok) return resolvedB;

    const mapA = new Map<string, LoadedCell>();
    for (const cell of resolvedA.resolved.cells) {
      const key = buildMatchKey(cell.dimensions, ignoreDimensions);
      if (mapA.has(key)) {
        return {
          ok: false,
          code: 'AMBIGUOUS_MATCH_KEY',
          message: `sourceA: two rows collapse to the same match key "${key}" after ignoreDimensions=[${ignoreDimensions.join(',')}] — cellSelector needs a narrower filter (e.g. pin accumulationBasis) so each side yields at most one row per key.`,
        };
      }
      mapA.set(key, cell);
    }
    const mapB = new Map<string, LoadedCell>();
    for (const cell of resolvedB.resolved.cells) {
      const key = buildMatchKey(cell.dimensions, ignoreDimensions);
      if (mapB.has(key)) {
        return {
          ok: false,
          code: 'AMBIGUOUS_MATCH_KEY',
          message: `sourceB: two rows collapse to the same match key "${key}" after ignoreDimensions=[${ignoreDimensions.join(',')}] — cellSelector needs a narrower filter so each side yields at most one row per key.`,
        };
      }
      mapB.set(key, cell);
    }

    const allKeys = new Set<string>([...mapA.keys(), ...mapB.keys()]);
    const rows: CompareRow[] = [];
    const summary: CompareSummary = { totalRows: 0, bothPresent: 0, missingInA: 0, missingInB: 0, missingInBoth: 0, currencyMismatch: 0, materialCount: 0 };

    for (const key of allKeys) {
      const a = mapA.get(key);
      const b = mapB.get(key);
      const diff = diffPair(a, b, materialityThresholdPct);
      const dimensionsSource = a?.dimensions ?? b?.dimensions ?? {};
      const row: CompareRow = {
        matchKey: key,
        dimensions: dimensionsForDisplay(dimensionsSource, ignoreDimensions),
        a: toPoint(a, resolvedA.resolved.businessVersion.business_version_id),
        b: toPoint(b, resolvedB.resolved.businessVersion.business_version_id),
        ...diff,
      };
      rows.push(row);

      summary.totalRows += 1;
      switch (diff.diffKind) {
        case 'BOTH_PRESENT':
          summary.bothPresent += 1;
          break;
        case 'MISSING_IN_A':
          summary.missingInA += 1;
          break;
        case 'MISSING_IN_B':
          summary.missingInB += 1;
          break;
        case 'MISSING_IN_BOTH':
          summary.missingInBoth += 1;
          break;
        case 'CURRENCY_MISMATCH':
          summary.currencyMismatch += 1;
          break;
        default: {
          const _exhaustive: never = diff.diffKind;
          void _exhaustive;
        }
      }
      if (diff.materialityFlag) summary.materialCount += 1;
    }

    // Deterministic order for display/export (dimensions sorted alphabetically inside the key already; sort rows by key too).
    rows.sort((x, y) => (x.matchKey < y.matchKey ? -1 : x.matchKey > y.matchKey ? 1 : 0));

    const filteredRows = params.onlyMaterial ? rows.filter((r) => r.materialityFlag || r.diffKind !== 'BOTH_PRESENT') : rows;

    const result: CompareResult = {
      comparisonType,
      organizationId: params.organizationId,
      generatedAt: new Date().toISOString(),
      sourceA: { artifactType: params.sourceA.artifactRef.artifactType, businessVersionId: params.sourceA.artifactRef.businessVersionId, label: resolvedA.resolved.label },
      sourceB: { artifactType: params.sourceB.artifactRef.artifactType, businessVersionId: params.sourceB.artifactRef.businessVersionId, label: resolvedB.resolved.label },
      ignoreDimensions,
      materialityThresholdPct,
      onlyMaterial: params.onlyMaterial ?? false,
      summary,
      rows: filteredRows,
    };
    return { ok: true, result };
  });
}

// ---------------------------------------------------------------------------
// Named wrappers (task ZAKRES point 2) — each just fixes the varying axis.
// ---------------------------------------------------------------------------

export interface ComparePeriodsParams {
  organizationId: string;
  artifactRef: ArtifactRef;
  periodIdA: string;
  periodIdB: string;
  entityId?: string;
  canonicalLineIds?: readonly string[];
  kpiCatalogIds?: readonly string[];
  consolidationScope?: FinanceConsolidationScope;
  accumulationBasis?: FinanceAccumulationBasis;
  materialityThresholdPct?: number;
  onlyMaterial?: boolean;
  labelA?: string;
  labelB?: string;
}

/** Same artifact, same business_version_id, two periods. */
export async function comparePeriods(params: ComparePeriodsParams): Promise<CompareValuesResult> {
  const baseSelector: CompareCellFilter = {
    entityId: params.entityId,
    canonicalLineIds: params.canonicalLineIds,
    kpiCatalogIds: params.kpiCatalogIds,
    consolidationScope: params.consolidationScope,
    accumulationBasis: params.accumulationBasis,
  };
  return compareValues(
    {
      organizationId: params.organizationId,
      sourceA: { artifactRef: params.artifactRef, cellSelector: { ...baseSelector, periodId: params.periodIdA }, label: params.labelA ?? `period:${params.periodIdA}` },
      sourceB: { artifactRef: params.artifactRef, cellSelector: { ...baseSelector, periodId: params.periodIdB }, label: params.labelB ?? `period:${params.periodIdB}` },
      ignoreDimensions: ['periodId'],
      materialityThresholdPct: params.materialityThresholdPct,
      onlyMaterial: params.onlyMaterial,
    },
    'PERIOD'
  );
}

export interface CompareVersionsParams {
  organizationId: string;
  artifactType: FinanceArtifactType;
  artifactId: string;
  businessVersionIdA: string;
  businessVersionIdB: string;
  /** `finance_stmt_entities.entity_code` (e.g. "PARENT"), NOT a raw entity_id — `finance_stmt_entities` is copy-on-write per business_version_id, so the same UUID essentially never means "the same entity" on both sides here. Resolved to each side's real per-version entity_id internally (`resolveEntityIdByCode`). Omit to compare across all entities at once. */
  entityCode?: string;
  canonicalLineIds?: readonly string[];
  kpiCatalogIds?: readonly string[];
  consolidationScope?: FinanceConsolidationScope;
  accumulationBasis?: FinanceAccumulationBasis;
  materialityThresholdPct?: number;
  onlyMaterial?: boolean;
  labelA?: string;
  labelB?: string;
}

/** Two business_versions of the SAME artifact_id — reuses `finance_business_versions.parent_version_id` lineage (task point 2: "reużyj lineage/parent_version_id") to confirm they are actually related versions before diffing, and to label the relationship in the result rather than silently diffing two unrelated versions that merely share an artifact_id by coincidence-proof (they can't, artifact_id is the FK, but the parent/child direction is still worth surfacing). */
export async function compareVersions(params: CompareVersionsParams): Promise<CompareValuesResult & { relationship?: string }> {
  const resolved = await withPinnedPostgresTransaction(async (tx) => {
    const [a, b] = await Promise.all([
      getBusinessVersionViaTx(tx, params.organizationId, params.businessVersionIdA),
      getBusinessVersionViaTx(tx, params.organizationId, params.businessVersionIdB),
    ]);
    if (!a || !b) return { ok: false as const, code: 'ARTIFACT_NOT_FOUND' as const, message: `businessVersionIdA and/or businessVersionIdB not found in organization ${params.organizationId}` };
    let entityIdA: string | undefined;
    let entityIdB: string | undefined;
    if (params.entityCode) {
      const [idA, idB] = await Promise.all([
        resolveEntityIdByCode(tx, params.organizationId, params.businessVersionIdA, params.entityCode),
        resolveEntityIdByCode(tx, params.organizationId, params.businessVersionIdB, params.entityCode),
      ]);
      if (!idA || !idB) {
        return {
          ok: false as const,
          code: 'ENTITY_CODE_NOT_FOUND' as const,
          message: `entity_code="${params.entityCode}" not found on ${!idA ? 'businessVersionIdA' : 'businessVersionIdB'}`,
        };
      }
      entityIdA = idA;
      entityIdB = idB;
    }
    return { ok: true as const, a, b, entityIdA, entityIdB };
  });
  if (!resolved.ok) return resolved;
  const { a, b, entityIdA, entityIdB } = resolved;

  if (a.artifact_id !== params.artifactId || b.artifact_id !== params.artifactId || a.artifact_id !== b.artifact_id) {
    return {
      ok: false,
      code: 'VERSION_ARTIFACT_MISMATCH',
      message: `compareVersions requires both business_version_id to belong to artifact_id=${params.artifactId}; got A.artifact_id=${a.artifact_id}, B.artifact_id=${b.artifact_id}`,
    };
  }
  const relationship = b.parent_version_id === a.business_version_id ? 'B_IS_DIRECT_CHILD_OF_A' : a.parent_version_id === b.business_version_id ? 'A_IS_DIRECT_CHILD_OF_B' : 'SAME_ARTIFACT_NOT_DIRECT_PARENT_CHILD';

  const artifactRefA: ArtifactRef = { organizationId: params.organizationId, artifactId: params.artifactId, businessVersionId: params.businessVersionIdA, artifactType: params.artifactType, naturalKey: null } as ArtifactRef;
  const artifactRefB: ArtifactRef = { organizationId: params.organizationId, artifactId: params.artifactId, businessVersionId: params.businessVersionIdB, artifactType: params.artifactType, naturalKey: null } as ArtifactRef;

  const baseSelector: Omit<CompareCellFilter, 'entityId'> = {
    canonicalLineIds: params.canonicalLineIds,
    kpiCatalogIds: params.kpiCatalogIds,
    consolidationScope: params.consolidationScope,
    accumulationBasis: params.accumulationBasis,
  };
  const result = await compareValues(
    {
      organizationId: params.organizationId,
      sourceA: { artifactRef: artifactRefA, cellSelector: { ...baseSelector, entityId: entityIdA }, label: params.labelA ?? `v${a.version_no} (${a.version_kind})` },
      sourceB: { artifactRef: artifactRefB, cellSelector: { ...baseSelector, entityId: entityIdB }, label: params.labelB ?? `v${b.version_no} (${b.version_kind})` },
      ignoreDimensions: [],
      materialityThresholdPct: params.materialityThresholdPct,
      onlyMaterial: params.onlyMaterial,
    },
    'VERSION'
  );
  return { ...result, relationship };
}

export interface CompareEntitiesParams {
  organizationId: string;
  artifactRef: ArtifactRef; // STATEMENT_PACK — task: "ten sam okres, dwie encje w Statement"
  periodId: string;
  entityIdA: string;
  entityIdB: string;
  canonicalLineIds?: readonly string[];
  consolidationScope?: FinanceConsolidationScope;
  accumulationBasis?: FinanceAccumulationBasis;
  materialityThresholdPct?: number;
  onlyMaterial?: boolean;
  labelA?: string;
  labelB?: string;
}

/** Same period, two entities, within a Statement Pack. */
export async function compareEntities(params: CompareEntitiesParams): Promise<CompareValuesResult> {
  const baseSelector: CompareCellFilter = {
    periodId: params.periodId,
    canonicalLineIds: params.canonicalLineIds,
    consolidationScope: params.consolidationScope,
    accumulationBasis: params.accumulationBasis,
  };
  return compareValues(
    {
      organizationId: params.organizationId,
      sourceA: { artifactRef: params.artifactRef, cellSelector: { ...baseSelector, entityId: params.entityIdA }, label: params.labelA ?? `entity:${params.entityIdA}` },
      sourceB: { artifactRef: params.artifactRef, cellSelector: { ...baseSelector, entityId: params.entityIdB }, label: params.labelB ?? `entity:${params.entityIdB}` },
      ignoreDimensions: ['entityId'],
      materialityThresholdPct: params.materialityThresholdPct,
      onlyMaterial: params.onlyMaterial,
    },
    'ENTITY'
  );
}

export interface CompareScenariosParams {
  organizationId: string;
  businessVersionIdBase: string; // e.g. STANDARD_BASE scenario (or any baseline scenario)
  businessVersionIdOther: string; // e.g. STANDARD_UPSIDE / STANDARD_DOWNSIDE
  /** `finance_stmt_entities.entity_code` — see `CompareVersionsParams.entityCode` doc for why this is a code, not a raw entity_id (two DIFFERENT scenario business_version_id are being compared here too). Omit to compare across all entities at once. */
  entityCode?: string;
  canonicalLineIds?: readonly string[];
  consolidationScope?: FinanceConsolidationScope;
  materialityThresholdPct?: number;
  onlyMaterial?: boolean;
  labelBase?: string;
  labelOther?: string;
}

/** Base vs Upside/Downside — each scenario is its own PREDICTION_SCENARIO artifact/business_version_id (WP-D07), read through `finance_prediction_outputs_effective` so a `STANDARD_BASE` scenario transparently compares against the Baseline Model passthrough (WP-D07 ADR section 8.3) exactly like any other scenario would. */
export async function compareScenarios(params: CompareScenariosParams): Promise<CompareValuesResult> {
  const artifactRefFor = (businessVersionId: string): ArtifactRef =>
    ({ organizationId: params.organizationId, artifactId: businessVersionId, businessVersionId, artifactType: 'PREDICTION_SCENARIO', naturalKey: null }) as ArtifactRef;

  let entityIdBase: string | undefined;
  let entityIdOther: string | undefined;
  if (params.entityCode) {
    const resolved = await withPinnedPostgresTransaction(async (tx) => {
      const [idBase, idOther] = await Promise.all([
        resolveEntityIdByCode(tx, params.organizationId, params.businessVersionIdBase, params.entityCode!),
        resolveEntityIdByCode(tx, params.organizationId, params.businessVersionIdOther, params.entityCode!),
      ]);
      return { idBase, idOther };
    });
    if (!resolved.idBase || !resolved.idOther) {
      return {
        ok: false,
        code: 'ENTITY_CODE_NOT_FOUND',
        message: `entity_code="${params.entityCode}" not found on ${!resolved.idBase ? 'businessVersionIdBase' : 'businessVersionIdOther'}`,
      };
    }
    entityIdBase = resolved.idBase;
    entityIdOther = resolved.idOther;
  }

  return compareValues(
    {
      organizationId: params.organizationId,
      sourceA: {
        artifactRef: artifactRefFor(params.businessVersionIdBase),
        cellSelector: { entityId: entityIdBase, canonicalLineIds: params.canonicalLineIds, consolidationScope: params.consolidationScope },
        label: params.labelBase ?? 'Base',
      },
      sourceB: {
        artifactRef: artifactRefFor(params.businessVersionIdOther),
        cellSelector: { entityId: entityIdOther, canonicalLineIds: params.canonicalLineIds, consolidationScope: params.consolidationScope },
        label: params.labelOther ?? 'Other scenario',
      },
      ignoreDimensions: [],
      materialityThresholdPct: params.materialityThresholdPct,
      onlyMaterial: params.onlyMaterial,
    },
    'SCENARIO'
  );
}

export interface CompareValuationMethodsParams {
  organizationId: string;
  businessVersionId: string; // one Valuation Case variant (finance_valuation_variants row)
  methodTypeA: FinanceValuationMethodType;
  methodTypeB: FinanceValuationMethodType;
  materialityThresholdPct?: number;
  labelA?: string;
  labelB?: string;
}

/** DCF vs comps (or any two methods) within the SAME variant — `ignoreDimensions: ['methodType']` collapses each side's single row to one shared match key, since method_type is the very axis that legitimately differs here. */
export async function compareValuationMethods(params: CompareValuationMethodsParams): Promise<CompareValuesResult> {
  const artifactRef: ArtifactRef = { organizationId: params.organizationId, artifactId: params.businessVersionId, businessVersionId: params.businessVersionId, artifactType: 'VALUATION_CASE', naturalKey: null } as ArtifactRef;
  return compareValues(
    {
      organizationId: params.organizationId,
      sourceA: { artifactRef, cellSelector: { methodType: params.methodTypeA }, label: params.labelA ?? params.methodTypeA },
      sourceB: { artifactRef, cellSelector: { methodType: params.methodTypeB }, label: params.labelB ?? params.methodTypeB },
      ignoreDimensions: ['methodType'],
      materialityThresholdPct: params.materialityThresholdPct,
    },
    'VALUATION_METHOD'
  );
}

export interface CompareActualVsForecastParams {
  organizationId: string;
  actualArtifactRef: ArtifactRef; // STATEMENT_PACK
  forecastArtifactRef: ArtifactRef; // BASELINE_MODEL or PREDICTION_SCENARIO
  /** `finance_stmt_entities.entity_code` — see `CompareVersionsParams.entityCode` doc; the actual and forecast sides are, by definition, two different business_version_id (usually two different artifact types entirely), so their `entity_id` UUIDs are never the same row. */
  entityCode: string;
  periodIds: readonly string[];
  /** Required — `finance_stmt_lines` has 4 accumulation_basis rows per cell; the forecast side has none, so this must be pinned to keep the match key 1:1 (see `compareValues`'s `AMBIGUOUS_MATCH_KEY` guard). */
  accumulationBasis: FinanceAccumulationBasis;
  canonicalLineIds?: readonly string[];
  consolidationScope?: FinanceConsolidationScope;
  materialityThresholdPct?: number;
  onlyMaterial?: boolean;
}

/** Actual (Statement Pack) vs Forecast (Baseline Model or Prediction Scenario) — the addendum's "actual/forecast" Compare axis (section 3 point 5), not separately named in the task's own ZAKRES list but free to expose since `compareValues` already supports cross-table sources. */
export async function compareActualVsForecast(params: CompareActualVsForecastParams): Promise<CompareValuesResult> {
  const resolved = await withPinnedPostgresTransaction(async (tx) => {
    const [entityIdActual, entityIdForecast] = await Promise.all([
      resolveEntityIdByCode(tx, params.organizationId, params.actualArtifactRef.businessVersionId, params.entityCode),
      resolveEntityIdByCode(tx, params.organizationId, params.forecastArtifactRef.businessVersionId, params.entityCode),
    ]);
    return { entityIdActual, entityIdForecast };
  });
  if (!resolved.entityIdActual || !resolved.entityIdForecast) {
    return {
      ok: false,
      code: 'ENTITY_CODE_NOT_FOUND',
      message: `entity_code="${params.entityCode}" not found on ${!resolved.entityIdActual ? 'actualArtifactRef.businessVersionId' : 'forecastArtifactRef.businessVersionId'}`,
    };
  }

  return compareValues(
    {
      organizationId: params.organizationId,
      sourceA: {
        artifactRef: params.actualArtifactRef,
        cellSelector: { entityId: resolved.entityIdActual, periodIds: params.periodIds, canonicalLineIds: params.canonicalLineIds, consolidationScope: params.consolidationScope, accumulationBasis: params.accumulationBasis },
        label: 'Actual',
      },
      sourceB: {
        artifactRef: params.forecastArtifactRef,
        cellSelector: { entityId: resolved.entityIdForecast, periodIds: params.periodIds, canonicalLineIds: params.canonicalLineIds, consolidationScope: params.consolidationScope },
        label: 'Forecast',
      },
      ignoreDimensions: ['accumulationBasis'],
      materialityThresholdPct: params.materialityThresholdPct,
      onlyMaterial: params.onlyMaterial,
    },
    'ACTUAL_VS_FORECAST'
  );
}

// ---------------------------------------------------------------------------
// Export-ready payload (task point 4: "structural result (JSON) gotowy do
// dalszego eksportu"). Deliberately NOT a file writer — `financeExportService.ts`
// (AP-02) already owns `.xlsx` generation; duplicating that here would be
// exactly the "two sources of truth" risk the review addendum's own section 1
// point 2 warns against. `CompareResult` is already plain, JSON-serializable
// data (no functions, no `undefined`) — this helper only adds a small,
// self-describing manifest wrapper so a future AP-02 "Compare" sheet (or any
// other export target) has a stable, versioned envelope to build from without
// this module needing to know anything about `.xlsx`/ExcelJS.
// ---------------------------------------------------------------------------

export interface CompareExportPayload {
  exportPayloadVersion: 1;
  generatedAt: string;
  comparison: CompareResult;
}

export function toCompareExportPayload(result: CompareResult): CompareExportPayload {
  return { exportPayloadVersion: 1, generatedAt: result.generatedAt, comparison: result };
}
