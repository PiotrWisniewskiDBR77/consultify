/**
 * Finance v3 canonical — Enterprise Valuation compute, FCFF layer (Gate D / Fala 7, WP-D10).
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 9 ("Obliczenia" — `FCFF = EBIT(1-cash tax) + D&A - ΔWC - CAPEX`). Schema:
 * `WP-D09_valuation_schema_ADR.md` section 5 ("FCFF — jawny kontrakt formuły" — the four inputs are
 * NEVER duplicated into a Valuation table; they are read live, per projection year, from
 * `finance_baseline_outputs` (source = an Approved/Draft `BASELINE_MODEL`, via a `MODEL_TO_VALUATION`
 * lineage edge) or `finance_prediction_outputs_effective` (source = a `PREDICTION_SCENARIO`, via a
 * `SCENARIO_TO_VALUATION` edge — the view already collapses `STANDARD_BASE` to a Baseline
 * passthrough, WP-D07 section 8.3, so this module needs no special case for it).
 *
 * Reuse discipline (same as `predictionComputeService.ts`'s reuse of `baselineComputeService.ts`):
 * this module does NOT recompute P&L/CF/BS. It reads the four already-computed canonical lines
 * (`EBIT`, `DEPRECIATION`, `CAPEX`, `WORKING_CAPITAL`) that `baselineComputeService.ts`/
 * `predictionComputeService.ts` already wrote, resolves the exact lineage source itself (mirroring
 * `baselineComputeService.ts`'s own `resolveSourceStatementPackVersion()` pattern for
 * `STATEMENT_TO_MODEL`), and applies the FCFF formula on top.
 *
 * SCALE / UNIT DISCIPLINE (audit finding this module is a direct regression guard for — see
 * `docs/validation/finance-v3/generated/gate-d/WP-D10_valuation_compute_engine_report.md` section
 * "Apator-scale regression"): every value cell this module reads carries its OWN `unit`
 * (`UNITS`/`THOUSANDS`/`MILLIONS`/`BILLIONS`) and `multiplier` (WP-B01 section 2.7 mandatory bundle,
 * adopted verbatim by `finance_baseline_outputs`/`finance_prediction_outputs`, WP-D05 section 4.4 /
 * WP-D07 section 7). This module converts EVERY cell to full presentation-currency units
 * (`value_decimal * FINANCE_UNIT_MULTIPLIER[unit] * multiplier`) at the point of read, before any
 * arithmetic — never after aggregation, never assumed-uniform across periods. A prior, real
 * production incident (memory note `p4-apator-realny-upload-2026-08-06`) found a downstream engine
 * silently losing this factor and reporting a company's enterprise value ~1000x too small; this
 * module's own `TEST_APATOR_SCALE` regression (WP-D10 report) proves that class of bug cannot
 * recur here.
 *
 * N/A discipline (WP-B01 section 2.7 / WP-D01 section 5.6, "Missing nigdy nie staje się zero"): a
 * period whose EBIT/DEPRECIATION/CAPEX/WORKING_CAPITAL cell is `MISSING`/`NA`/`NOT_APPLICABLE` — or
 * has NO row at all for that `(canonical_line_id, period_id)` — makes that projection year's FCFF
 * `MISSING`, never a silent zero. `ΔWC` failure propagates forward: once a year's closing
 * `WORKING_CAPITAL` is unknown, every later year's `ΔWC` (which needs the prior year's closing WC)
 * is unknown too, so FCFF stays `MISSING` from that year onward, by design.
 */

import {
  withPinnedPostgresTransaction,
  type PinnedTransactionClient,
} from '../../../database/PostgresDatabase.js';
import { FINANCE_UNIT_MULTIPLIER, type FinanceUnit } from '../../../types/finance/financeValueSemantics.js';
import type { LineageEdgeType } from './lineageService.js';

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type ValuationSourceType = 'BASELINE' | 'PREDICTION';

const SOURCE_EDGE_TYPES: readonly LineageEdgeType[] = ['MODEL_TO_VALUATION', 'SCENARIO_TO_VALUATION'];

export interface CellRow {
  canonical_line_id: string;
  period_id: string;
  value_status: string;
  value_decimal: string | null;
  presentation_currency: string;
  unit: FinanceUnit;
  multiplier: string;
}

/** One projection year's worth of source period_ids, chronologically ordered within the year. */
export interface FcffYearInput {
  fiscalYear: number;
  /** All period rows (typically 12 MONTH periods, or a single YEAR period) belonging to this projection year, oldest first. */
  periodIds: readonly string[];
}

export interface FcffYearResult {
  fiscalYear: number;
  /** `MISSING` if any input this year (or its ΔWC dependency on the prior year) could not be resolved to a real value — never a silent zero. */
  status: 'PRESENT' | 'MISSING';
  ebit: number | null;
  depreciationAmortization: number | null;
  closingWorkingCapital: number | null;
  deltaWorkingCapital: number | null;
  capex: number | null;
  fcff: number | null;
  missingReason?: string;
}

export interface ComputeFcffSeriesParams {
  organizationId: string;
  /** The Enterprise Valuation variant's own `business_version_id` (`finance_valuation_variants.business_version_id`). */
  valuationBusinessVersionId: string;
  entityId: string;
  /** From `finance_valuation_wacc_inputs.cash_tax_rate_pct` (e.g. 19 for 19%) — the FCFF formula's own tax rate, not necessarily the statutory Baseline tax rate. */
  cashTaxRatePct: number;
  /** Chronologically ordered projection years. */
  projectionYears: readonly FcffYearInput[];
  /**
   * Full-unit closing WORKING_CAPITAL as of the period immediately BEFORE `projectionYears[0]`
   * (i.e. the last actual/opening balance sheet) — needed to compute year 1's ΔWC. Pass `null` if
   * genuinely unknown (year 1's FCFF is then reported `MISSING`, never a silent zero).
   */
  openingWorkingCapital: number | null;
}

export type ComputeFcffSeriesResult =
  | {
      ok: true;
      sourceType: ValuationSourceType;
      sourceBusinessVersionId: string;
      currency: string;
      years: FcffYearResult[];
    }
  | {
      ok: false;
      code: 'NO_VALUATION_SOURCE_EDGE' | 'MULTIPLE_VALUATION_SOURCE_EDGES' | 'UNKNOWN_CANONICAL_LINE' | 'INCONSISTENT_CURRENCY';
      message: string;
    };

// ---------------------------------------------------------------------------
// Lineage resolution — mirrors baselineComputeService.ts's resolveSourceStatementPackVersion()
// ---------------------------------------------------------------------------

export interface ResolvedValuationSource {
  sourceType: ValuationSourceType;
  sourceBusinessVersionId: string;
}

export type ResolveValuationSourceResult =
  | { ok: true; source: ResolvedValuationSource }
  | { ok: false; code: 'NO_VALUATION_SOURCE_EDGE' | 'MULTIPLE_VALUATION_SOURCE_EDGES'; message: string };

/**
 * Resolves the ONE `MODEL_TO_VALUATION` or `SCENARIO_TO_VALUATION` edge targeting this Valuation
 * variant's `business_version_id`. `uq_finance_lineage_edges_one_valuation_source` (WP-D09 section
 * 4.3) already guarantees at most one such row exists physically; this function still defends
 * against zero (not-yet-sourced Draft) and treats more-than-one as a hard error rather than
 * silently picking the first row.
 */
export async function resolveValuationSource(
  organizationId: string,
  valuationBusinessVersionId: string
): Promise<ResolveValuationSourceResult> {
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{ edge_type: LineageEdgeType; source_version_id: string }>(
      `SELECT edge_type, source_version_id FROM finance_lineage_edges
        WHERE organization_id = ? AND target_version_id = ? AND edge_type = ANY(?)`,
      [organizationId, valuationBusinessVersionId, [...SOURCE_EDGE_TYPES]]
    )
  );
  if (rows.length === 0) {
    return {
      ok: false,
      code: 'NO_VALUATION_SOURCE_EDGE',
      message: `No MODEL_TO_VALUATION/SCENARIO_TO_VALUATION lineage edge targets business_version_id ${valuationBusinessVersionId}`,
    };
  }
  if (rows.length > 1) {
    return {
      ok: false,
      code: 'MULTIPLE_VALUATION_SOURCE_EDGES',
      message: `${rows.length} source edges target business_version_id ${valuationBusinessVersionId}; uq_finance_lineage_edges_one_valuation_source should have prevented this`,
    };
  }
  const row = rows[0];
  return {
    ok: true,
    source: {
      sourceType: row.edge_type === 'MODEL_TO_VALUATION' ? 'BASELINE' : 'PREDICTION',
      sourceBusinessVersionId: row.source_version_id,
    },
  };
}

// ---------------------------------------------------------------------------
// Cell read + unit/multiplier normalization
// ---------------------------------------------------------------------------

/** `value_decimal` converted to full presentation-currency units. `null` iff the cell is not a present value. */
export function toFullUnitValue(row: Pick<CellRow, 'value_status' | 'value_decimal' | 'unit' | 'multiplier'>): number | null {
  if (row.value_status !== 'PRESENT_ZERO' && row.value_status !== 'PRESENT_NONZERO') return null;
  if (row.value_decimal === null) return null;
  const unitMultiplier = FINANCE_UNIT_MULTIPLIER[row.unit];
  return Number(row.value_decimal) * unitMultiplier * Number(row.multiplier);
}

async function loadLineIds(tx: PinnedTransactionClient, lineCodes: readonly string[]): Promise<Map<string, string>> {
  const rows = await tx.queryAll<{ id: string; line_code: string }>(
    `SELECT id, line_code FROM financial_statement_lines WHERE line_code = ANY(?)`,
    [[...lineCodes]]
  );
  const byCode = new Map<string, string>();
  for (const r of rows) byCode.set(r.line_code, r.id);
  return byCode;
}

async function loadCells(
  tx: PinnedTransactionClient,
  sourceType: ValuationSourceType,
  sourceBusinessVersionId: string,
  entityId: string,
  periodIds: readonly string[]
): Promise<CellRow[]> {
  if (periodIds.length === 0) return [];
  const table = sourceType === 'BASELINE' ? 'finance_baseline_outputs' : 'finance_prediction_outputs_effective';
  return tx.queryAll<CellRow>(
    `SELECT canonical_line_id, period_id, value_status, value_decimal, presentation_currency, unit, multiplier
       FROM ${table}
      WHERE business_version_id = ? AND entity_id = ? AND period_id = ANY(?) AND consolidation_scope = 'CONSOLIDATED'`,
    [sourceBusinessVersionId, entityId, [...periodIds]]
  );
}

/**
 * Sum a flow line (EBIT/DEPRECIATION/CAPEX) across a year's periods. `null` if any period is
 * missing a present value OR has no row at all.
 *
 * W3-determinism fix (`docs/validation/finance-v3/generated/gate-d/W3_COMPUTE_DETERMINISM_report.md`):
 * `loadCells()`'s SQL has no `ORDER BY` (same reasoning as `kpiComputeService.ts`'s own
 * no-`ORDER BY` query — see that file's comment), so `cells` arrives in whatever order Postgres's
 * query plan happens to return, which is NOT guaranteed stable even for the exact same underlying
 * rows (empirically reproduced on real Postgres: as `finance_baseline_outputs` grows across
 * independent compute runs, the planner's chosen scan/row order shifts). Floating-point addition
 * is not associative, so summing `rowsForLine` in THAT order made `sumFlow`'s result — and
 * therefore `enterpriseValueComputed` — differ on the last significant digit between runs of
 * byte-identical monthly EBIT/D&A/CAPEX inputs (proven: the 12 stored monthly values were
 * bit-identical across 10 independent runs; only the SUMMED total varied, in 3 distinct bit
 * patterns). `orderedPeriodIds` is the CALLER's own canonical (chronological)
 * `FcffYearInput.periodIds` order — sorting `rowsForLine` to match it before summing makes the
 * arithmetic order deterministic without touching the SQL query or the row SET being summed.
 */
export function sumFlow(
  cells: CellRow[],
  lineId: string,
  orderedPeriodIds: readonly string[]
): { value: number | null; presentCount: number } {
  const rowsForLine = cells.filter((c) => c.canonical_line_id === lineId);
  if (rowsForLine.length < orderedPeriodIds.length) return { value: null, presentCount: rowsForLine.length };
  const periodRank = new Map(orderedPeriodIds.map((pid, idx) => [pid, idx]));
  const sorted = [...rowsForLine].sort((a, b) => (periodRank.get(a.period_id) ?? 0) - (periodRank.get(b.period_id) ?? 0));
  let sum = 0;
  for (const r of sorted) {
    const v = toFullUnitValue(r);
    if (v === null) return { value: null, presentCount: rowsForLine.length };
    sum += v;
  }
  return { value: sum, presentCount: rowsForLine.length };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function computeFcffSeries(params: ComputeFcffSeriesParams): Promise<ComputeFcffSeriesResult> {
  const resolved = await resolveValuationSource(params.organizationId, params.valuationBusinessVersionId);
  if (!resolved.ok) return resolved;
  const { sourceType, sourceBusinessVersionId } = resolved.source;

  const lineIds = await withPinnedPostgresTransaction((tx) => loadLineIds(tx, ['EBIT', 'DEPRECIATION', 'CAPEX', 'WORKING_CAPITAL']));
  for (const code of ['EBIT', 'DEPRECIATION', 'CAPEX', 'WORKING_CAPITAL']) {
    if (!lineIds.has(code)) {
      return { ok: false, code: 'UNKNOWN_CANONICAL_LINE', message: `financial_statement_lines has no row for line_code=${code}` };
    }
  }
  const ebitId = lineIds.get('EBIT')!;
  const daId = lineIds.get('DEPRECIATION')!;
  const capexId = lineIds.get('CAPEX')!;
  const wcId = lineIds.get('WORKING_CAPITAL')!;

  const taxFactor = 1 - params.cashTaxRatePct / 100;

  let priorClosingWc = params.openingWorkingCapital;
  const years: FcffYearResult[] = [];
  let currency: string | null = null;

  for (const year of params.projectionYears) {
    const cells = await withPinnedPostgresTransaction((tx) =>
      loadCells(tx, sourceType, sourceBusinessVersionId, params.entityId, year.periodIds)
    );

    const currenciesThisYear = new Set(cells.map((c) => c.presentation_currency));
    if (currenciesThisYear.size > 1) {
      return {
        ok: false,
        code: 'INCONSISTENT_CURRENCY',
        message: `fiscal year ${year.fiscalYear} mixes presentation currencies: ${[...currenciesThisYear].join(', ')}`,
      };
    }
    for (const c of currenciesThisYear) {
      if (currency === null) currency = c;
      else if (currency !== c) {
        return { ok: false, code: 'INCONSISTENT_CURRENCY', message: `fiscal year ${year.fiscalYear} presentation currency ${c} differs from prior year's ${currency}` };
      }
    }

    const ebit = sumFlow(cells, ebitId, year.periodIds);
    const da = sumFlow(cells, daId, year.periodIds);
    const capex = sumFlow(cells, capexId, year.periodIds);
    const closingPeriodId = year.periodIds[year.periodIds.length - 1];
    const closingWcCells = cells.filter((c) => c.canonical_line_id === wcId);
    // WORKING_CAPITAL is a BS (stock) line — for a monthly year, only the LAST period's row is the
    // closing value; re-query narrowly scoped to the closing period so a multi-month year does not
    // accidentally pick an earlier month's row via `.find()` ordering.
    const closingWcCell =
      closingWcCells.length <= 1
        ? closingWcCells[0]
        : (await withPinnedPostgresTransaction((tx) => loadCells(tx, sourceType, sourceBusinessVersionId, params.entityId, [closingPeriodId])))
            .filter((c) => c.canonical_line_id === wcId)[0];
    const closingWc = closingWcCell ? toFullUnitValue(closingWcCell) : null;

    let deltaWc: number | null = null;
    let fcff: number | null = null;
    let status: FcffYearResult['status'] = 'PRESENT';
    let missingReason: string | undefined;

    if (ebit.value === null) {
      status = 'MISSING';
      missingReason = 'EBIT not present for one or more periods in this fiscal year';
    } else if (da.value === null) {
      status = 'MISSING';
      missingReason = 'DEPRECIATION not present for one or more periods in this fiscal year';
    } else if (capex.value === null) {
      status = 'MISSING';
      missingReason = 'CAPEX not present for one or more periods in this fiscal year';
    } else if (closingWc === null) {
      status = 'MISSING';
      missingReason = 'closing WORKING_CAPITAL not present for this fiscal year';
    } else if (priorClosingWc === null) {
      status = 'MISSING';
      missingReason = 'prior fiscal year closing WORKING_CAPITAL unknown, so ΔWC cannot be derived';
    } else {
      deltaWc = closingWc - priorClosingWc;
      fcff = ebit.value * taxFactor + da.value - deltaWc - capex.value;
    }

    years.push({
      fiscalYear: year.fiscalYear,
      status,
      ebit: ebit.value,
      depreciationAmortization: da.value,
      closingWorkingCapital: closingWc,
      deltaWorkingCapital: deltaWc,
      capex: capex.value,
      fcff,
      missingReason,
    });

    // Propagate forward: once WC is unknown for a year, every later year's ΔWC is unknown too
    // (documented in the module header) — never resurrect a guess.
    priorClosingWc = closingWc;
  }

  return { ok: true, sourceType, sourceBusinessVersionId, currency: currency ?? 'PLN', years };
}
