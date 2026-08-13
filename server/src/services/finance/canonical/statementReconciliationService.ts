/**
 * Finance v3 canonical — Statement Pack reconciliation service (Gate D / Fala 3, WP-D02).
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 5 "Workflow" (... map -> RECONCILE -> exception resolution -> review
 * -> approve) and "Reconciliation ledger" (source total -> mapped -> excluded
 * -> unmapped -> duplicate/reclass/elimination -> canonical total -> residual).
 *
 * Consumes `statementMappingService.mapStatementLines()`'s per-row output and:
 *  1. computes the waterfall totals (pure, unit-testable — `computeWaterfall`),
 *  2. persists one `finance_reconciliation_runs` row (WP-B05, already shipped)
 *     and one `finance_stmt_reconciliation` row per input row (WP-D01 section
 *     4.6, the row-level detail that rolls up INTO the B05 aggregate rather
 *     than re-deriving its shape — ADR section 10.3),
 *  3. raises a `finance_exceptions` row (`exceptionLedgerService`, WP-B05)
 *     when the residual exceeds the materiality placeholder, severity scaled
 *     to how far over the threshold it is,
 *  4. optionally checks `finance_stmt_is_ready_for_review()` (WP-D01 section 7,
 *     already shipped as `20260809_finance_v3_d01_statements_03_readiness.sql`)
 *     and — only if ready — calls `artifactVersionService.transition()`'s T2
 *     (`submit_for_review`) to move the Statement Pack DRAFT -> READY_FOR_REVIEW.
 *
 * Materiality placeholder: `docs/validation/finance-v3/generated/gate-b/
 * GATE_B_INTEGRATION_RECONCILIATION.md` section 7 (B02-Q4, escalated, NOT a
 * final owner decision) — "5% wartości linii/subtotala LUB konfigurowalny
 * per-organizacja próg (cokolwiek niższe)", explicitly marked
 * `PROVISIONAL_PENDING_OWNER_DECISION`. This module exports the 5% figure as
 * `PROVISIONAL_MATERIALITY_THRESHOLD_PCT` and accepts a caller-supplied
 * override (the "per-organization" half of that rule) — it never invents a
 * different number and never claims this is a GO-gate-final threshold.
 *
 * Residual formula matches `finance_reconciliation_runs`'s own GENERATED
 * column EXACTLY (WP-B05 migration): `source_total - canonical_total -
 * excluded_total - unmapped_total`. Note `duplicate_total` is deliberately
 * NOT subtracted in that formula — an unresolved duplicate mapping is NEVER
 * silently netted out of the canonical total; it always shows up as residual
 * until a human explicitly resolves it (excludes it, or removes the
 * duplicate rule). This is the exact mechanism the CD Projekt regression test
 * (see the .pg.test.ts file next to this one) exercises: two different
 * mapping rules for the same source label landing on the same canonical cell
 * with two different values must be CAUGHT, not silently averaged/overwritten.
 */

import { v4 as uuidv4 } from 'uuid';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import {
  transition,
  stampWorkingRevisionComputeIdentity,
  type BusinessVersionRow,
  type TransitionServiceResult,
} from './artifactVersionService.js';
import { canonicalPayloadHash } from './contentHash.js';
import * as exceptionLedgerService from './exceptionLedgerService.js';
import type { ExceptionSeverity, FinanceExceptionRow } from './exceptionLedgerService.js';
import type { FinanceRole } from './lifecycleService.js';
import type { MappedRowResult, ReconciliationBucket } from './statementMappingService.js';

// ---------------------------------------------------------------------------
// Waterfall — pure, no DB (unit-testable per the task's explicit requirement)
// ---------------------------------------------------------------------------

/**
 * RC-01 coverage — "how much of the real source statement actually reached the
 * canonical model", counted in rows AND in absolute source value.
 *
 * Absolute (|x|) sums, not signed sums: a signed source total lets a +500 asset and
 * a -500 contra line cancel to 0, which would report "0% of nothing lost" on a pack
 * that lost both. Coverage is a completeness measure, so it counts magnitude.
 */
export interface CoverageMetrics {
  totalRowCount: number;
  /** MAPPED + RECLASS + ELIMINATION — rows whose value landed in `finance_stmt_lines`. */
  mappedRowCount: number;
  excludedRowCount: number;
  unmappedRowCount: number;
  duplicateRowCount: number;
  /** UNMAPPED rows + EXCLUDED rows flagged `coverageLoss` (taxonomy gap, not analyst decision). */
  coverageLossRowCount: number;
  /** Sum of |sourceAmount| over every input row. */
  absSourceTotal: number;
  /** Sum of |sourceAmount| over rows that landed in the canonical model. */
  absCoveredTotal: number;
  /** Sum of |sourceAmount| over coverage-loss rows. */
  absCoverageLossTotal: number;
  /** `absCoveredTotal / absSourceTotal`; null when every source value is 0 (undefined, NOT 100%). */
  sourceValueCoveragePct: number | null;
  /** `mappedRowCount / totalRowCount`; null when there are no rows at all. */
  sourceRowCoveragePct: number | null;
  /**
   * `absCoverageLossTotal / absSourceTotal`, falling back to the ROW share when every source
   * value is 0 (a zero-valued line still occupies a taxonomy slot that does not exist).
   * Never null — a caller must always be able to compare it against a threshold.
   */
  coverageLossSharePct: number;
}

export interface WaterfallTotals {
  sourceTotal: number;
  mappedTotal: number;
  excludedTotal: number;
  unmappedTotal: number;
  duplicateTotal: number;
  reclassNetTotal: number;
  eliminationNetTotal: number;
  canonicalTotal: number;
  /** `source_total - canonical_total - excluded_total - unmapped_total` — matches the DB GENERATED column verbatim. */
  residual: number;
  /** `|residual| / |sourceTotal|`, or null when sourceTotal is 0 (percentage undefined, not zero). */
  residualPct: number | null;
  /** RC-01 — completeness, a SEPARATE axis from the residual (see `determineReconciliationStatus`). */
  coverage: CoverageMetrics;
}

export type WaterfallRow = Pick<MappedRowResult, 'bucket' | 'sourceAmount' | 'mappedAmount' | 'signConvention'> &
  Partial<Pick<MappedRowResult, 'coverageLoss'>>;

/** Below this absolute residual, treat as exactly balanced (floating-point dust, not a real discrepancy). */
const RESIDUAL_ZERO_EPSILON = 1e-6;

export function computeWaterfall(rows: readonly WaterfallRow[]): WaterfallTotals {
  let sourceTotal = 0;
  let mappedTotal = 0;
  let excludedTotal = 0;
  let unmappedTotal = 0;
  let duplicateTotal = 0;
  let reclassNetTotal = 0;
  let eliminationNetTotal = 0;

  let mappedRowCount = 0;
  let excludedRowCount = 0;
  let unmappedRowCount = 0;
  let duplicateRowCount = 0;
  let coverageLossRowCount = 0;
  let absSourceTotal = 0;
  let absCoveredTotal = 0;
  let absCoverageLossTotal = 0;

  for (const row of rows) {
    sourceTotal += row.sourceAmount;
    const contribution = row.mappedAmount ?? 0;

    const abs = Math.abs(row.sourceAmount);
    absSourceTotal += abs;
    // `coverageLoss` is optional on WaterfallRow so pure callers can pass a bare bucket;
    // an UNMAPPED row is coverage loss by definition regardless of what the caller said.
    const isCoverageLossRow = row.coverageLoss === true || row.bucket === 'UNMAPPED';
    if (isCoverageLossRow) {
      coverageLossRowCount += 1;
      absCoverageLossTotal += abs;
    }
    if (row.bucket === 'MAPPED' || row.bucket === 'RECLASS' || row.bucket === 'ELIMINATION') {
      mappedRowCount += 1;
      absCoveredTotal += abs;
    } else if (row.bucket === 'EXCLUDED') {
      excludedRowCount += 1;
    } else if (row.bucket === 'UNMAPPED') {
      unmappedRowCount += 1;
    } else if (row.bucket === 'DUPLICATE') {
      duplicateRowCount += 1;
    }

    switch (row.bucket) {
      case 'MAPPED':
        mappedTotal += contribution;
        break;
      case 'EXCLUDED':
        excludedTotal += row.sourceAmount;
        break;
      case 'UNMAPPED':
        unmappedTotal += row.sourceAmount;
        break;
      case 'DUPLICATE':
        // Deliberately NOT netted into canonicalTotal or subtracted in the residual formula
        // below — see file header. duplicateTotal is reported for visibility/UI only.
        duplicateTotal += row.sourceAmount;
        break;
      case 'RECLASS':
        reclassNetTotal += contribution;
        break;
      case 'ELIMINATION': {
        const signed = row.signConvention === 'CONTRA' ? -contribution : contribution;
        eliminationNetTotal += signed;
        break;
      }
      case 'CANONICAL':
        // Reserved bucket value (WP-D01 4.6 CHECK), unused by this work package's row-detail model.
        break;
      default: {
        const _exhaustive: never = row.bucket;
        void _exhaustive;
      }
    }
  }

  const canonicalTotal = mappedTotal + reclassNetTotal + eliminationNetTotal;
  const residual = sourceTotal - canonicalTotal - excludedTotal - unmappedTotal;
  const residualPct = sourceTotal === 0 ? null : Math.abs(residual) / Math.abs(sourceTotal);

  const totalRowCount = rows.length;
  const coverage: CoverageMetrics = {
    totalRowCount,
    mappedRowCount,
    excludedRowCount,
    unmappedRowCount,
    duplicateRowCount,
    coverageLossRowCount,
    absSourceTotal,
    absCoveredTotal,
    absCoverageLossTotal,
    sourceValueCoveragePct: absSourceTotal === 0 ? null : absCoveredTotal / absSourceTotal,
    sourceRowCoveragePct: totalRowCount === 0 ? null : mappedRowCount / totalRowCount,
    coverageLossSharePct:
      absSourceTotal > 0
        ? absCoverageLossTotal / absSourceTotal
        : totalRowCount > 0
          ? coverageLossRowCount / totalRowCount
          : 0,
  };

  return { sourceTotal, mappedTotal, excludedTotal, unmappedTotal, duplicateTotal, reclassNetTotal, eliminationNetTotal, canonicalTotal, residual, residualPct, coverage };
}

/** `finance_reconciliation_runs.status` CHECK values (WP-B05, already shipped). */
export type ReconciliationRunStatus = 'CLEAN' | 'WITHIN_TOLERANCE' | 'EXCEEDS_MATERIALITY';

/** DEC-FIN-009's own vocabulary: "kazdy material ... rozroznia clean/conditional/provisional". */
export type ReconciliationResultQuality = 'CLEAN' | 'CONDITIONAL' | 'PROVISIONAL';

/** Residual-only status — the pre-RC-01 behaviour, kept as its own named function. */
export function determineResidualStatus(totals: WaterfallTotals, materialityThresholdPct: number): ReconciliationRunStatus {
  if (Math.abs(totals.residual) < RESIDUAL_ZERO_EPSILON) return 'CLEAN';
  if (totals.residualPct === null) return 'EXCEEDS_MATERIALITY'; // non-zero residual against a zero source total: undefined %, cannot be "within" anything
  return totals.residualPct <= materialityThresholdPct ? 'WITHIN_TOLERANCE' : 'EXCEEDS_MATERIALITY';
}

/**
 * BUGFIX RC-01 — the residual can be exactly 0 while three quarters of the real source
 * statement never reached the canonical model, because `unmapped_total` (and the
 * taxonomy-gap half of `excluded_total`) are SUBTRACTED in the residual formula. The
 * number was already computed; it just never reached the status. That is the whole gap:
 * "counted, but not consequential".
 *
 * Rule: any coverage loss forbids `CLEAN`. It does NOT escalate to
 * `EXCEEDS_MATERIALITY` on its own, deliberately — `finance_stmt_readiness_check()`
 * check #6 treats `EXCEEDS_MATERIALITY` as a hard block, and DEC-FIN-009 is explicit that
 * a data-quality defect must not block creation/compute/export. The severity of the
 * coverage loss is carried by `determineResultQuality()` (CONDITIONAL / PROVISIONAL) and
 * by a `finance_exceptions` row, which are marks, not gates.
 */
export function determineReconciliationStatus(totals: WaterfallTotals, materialityThresholdPct: number): ReconciliationRunStatus {
  const residualStatus = determineResidualStatus(totals, materialityThresholdPct);
  if (residualStatus === 'CLEAN' && totals.coverage.coverageLossRowCount > 0) return 'WITHIN_TOLERANCE';
  return residualStatus;
}

/**
 * DEC-FIN-009 result quality. CRITICAL_DATA-grade defects (on either axis) produce
 * `PROVISIONAL` — the addendum's "compute/export dozwolone, ale wynik ma status
 * Provisional / Accepted with critical exceptions". Anything else that is not perfect is
 * `CONDITIONAL` ("akceptacja analityka z uzasadnieniem").
 *
 * `periodJumpCount` (RC-05) marks but never escalates past CONDITIONAL — a WARNING-tier
 * plausibility flag is not by itself grounds for calling the whole pack provisional.
 */
export function determineResultQuality(
  totals: WaterfallTotals,
  materialityThresholdPct: number,
  periodJumpCount = 0
): ReconciliationResultQuality {
  const residualStatus = determineResidualStatus(totals, materialityThresholdPct);
  const coverageLoss = totals.coverage.coverageLossRowCount > 0;
  const coverageSeverity = coverageLoss ? severityForResidual(totals.coverage.coverageLossSharePct, materialityThresholdPct) : null;

  if (residualStatus === 'EXCEEDS_MATERIALITY' || coverageSeverity === 'CRITICAL_DATA') return 'PROVISIONAL';
  if (residualStatus === 'WITHIN_TOLERANCE' || coverageLoss || periodJumpCount > 0) return 'CONDITIONAL';
  return 'CLEAN';
}

/**
 * Severity scaling for the exception raised when status='EXCEEDS_MATERIALITY'
 * (task: "severity odpowiednim do wielkości residuala"). Never returns
 * 'SECURITY' — that severity is reserved for `blocking_category`
 * TENANT_BREACH/UNDEFINED_MATH (WP-B05), a different failure class than an
 * over-threshold reconciliation residual.
 */
export function severityForResidual(residualPct: number | null, materialityThresholdPct: number): ExceptionSeverity {
  if (residualPct === null) return 'CRITICAL_DATA';
  const ratio = residualPct / materialityThresholdPct;
  if (ratio <= 2) return 'WARNING';
  if (ratio <= 5) return 'MATERIAL';
  return 'CRITICAL_DATA';
}

// ---------------------------------------------------------------------------
// Materiality placeholder (see file header)
// ---------------------------------------------------------------------------

/** PROVISIONAL_PENDING_OWNER_DECISION — GATE_B_INTEGRATION_RECONCILIATION.md section 7. */
export const PROVISIONAL_MATERIALITY_THRESHOLD_PCT = 0.05;

// ---------------------------------------------------------------------------
// BUGFIX RC-05 — period-over-period plausibility control for balance-sheet lines
// ---------------------------------------------------------------------------

/**
 * Relative move that makes a MATERIAL balance-sheet position implausible without an
 * explanation. 80% is a judgment call, and here is the reasoning rather than a number
 * pulled from the air:
 *
 *  - Working-capital positions (AR/AP/inventory) track revenue; a group whose revenue
 *    moved +8% y/y (Apator FY2024) does not move a payables balance by ±80% for an
 *    operating reason. Empirically, a >80% single-year move in a material BS line is
 *    either a corporate event (disposal/acquisition/refinancing) or a data defect —
 *    both of which a human must SEE, which is exactly what a WARNING is for.
 *  - Setting it lower (e.g. 30-50%) would fire on ordinary cash/debt swings and train
 *    the analyst to ignore the flag, which is worse than no flag.
 *  - The real defect this exists for (RC-05: Apator `AP` 93 591 -> 722, a 99.2% collapse)
 *    clears 80% with an order of magnitude to spare, so the threshold is not tuned to
 *    the sample.
 *
 * PROVISIONAL_PENDING_OWNER_DECISION, same status as the materiality placeholder above:
 * overridable per call, never silently re-invented elsewhere.
 */
export const PERIOD_JUMP_RELATIVE_THRESHOLD_PCT = 0.8;

/**
 * Materiality floor for the jump control, expressed as a fraction of the LARGEST absolute
 * balance-sheet position observed in the compared periods (in practice: total assets).
 * 1% of total assets sits at the conventional lower edge of audit planning materiality
 * (0.5-2% of total assets), so the control fires on positions a reader would notice and
 * stays silent on rounding-scale lines that would otherwise flood the ledger — a 100%
 * move on a 3-thousand line is noise, the same move on a 93-million line is not.
 *
 * Anchoring to the pack's own largest position (rather than an absolute currency amount)
 * keeps the control unit-agnostic: it behaves identically whether the pack is filed in
 * UNITS, THOUSANDS or MILLIONS.
 */
export const PERIOD_JUMP_MATERIALITY_ANCHOR_PCT = 0.01;

/** One `finance_stmt_lines` cell, flattened for the pure detector. */
export interface PeriodObservation {
  entityId: string;
  canonicalLineId: string;
  lineCode: string | null;
  statementType: string;
  consolidationScope: string;
  accumulationBasis: string;
  periodId: string;
  periodLabel: string;
  /** ISO date used ONLY for chronological ordering within a series. */
  periodEnd: string;
  /** null for value_status MISSING/NA/NOT_APPLICABLE — never coerced to 0. */
  value: number | null;
}

export interface PeriodJumpFinding {
  entityId: string;
  canonicalLineId: string;
  lineCode: string | null;
  statementType: string;
  consolidationScope: string;
  accumulationBasis: string;
  priorPeriodId: string;
  priorPeriodLabel: string;
  priorValue: number;
  currentPeriodId: string;
  currentPeriodLabel: string;
  currentValue: number;
  /** Signed `(current - prior) / |prior|`. */
  changePct: number;
  /** `|changePct|`, the value compared against the threshold. */
  absChangePct: number;
  /** The absolute floor a position had to clear to be considered material for this run. */
  materialityFloor: number;
  direction: 'COLLAPSE' | 'SPIKE';
  /** Human-readable, self-contained — goes verbatim into the exception evidence. */
  description: string;
}

function seriesKey(o: PeriodObservation): string {
  return [o.entityId, o.canonicalLineId, o.consolidationScope, o.accumulationBasis].join('::');
}

/**
 * Pure, DB-free (RC-05). Groups observations into per-cell time series, walks consecutive
 * period pairs, and reports every move that is BOTH material (the larger of the two values
 * clears the floor) AND relatively extreme (>= the relative threshold).
 *
 * Deliberately does NOT flag:
 *  - a series where either side is `null` (MISSING) — that is RC-06's finding (a coverage
 *    gap), and reporting it here as a "100% change" would fabricate a number;
 *  - a prior value of exactly 0 — the relative change is undefined, not infinite, and a
 *    line appearing for the first time is ordinary (new lease, new instrument).
 */
export function detectPeriodOverPeriodJumps(
  observations: readonly PeriodObservation[],
  opts: { relativeThresholdPct?: number; materialityAnchorPct?: number } = {}
): PeriodJumpFinding[] {
  const relativeThresholdPct = opts.relativeThresholdPct ?? PERIOD_JUMP_RELATIVE_THRESHOLD_PCT;
  const materialityAnchorPct = opts.materialityAnchorPct ?? PERIOD_JUMP_MATERIALITY_ANCHOR_PCT;

  let anchor = 0;
  for (const o of observations) {
    if (o.value !== null) anchor = Math.max(anchor, Math.abs(o.value));
  }
  const materialityFloor = anchor * materialityAnchorPct;
  if (materialityFloor <= 0) return [];

  const series = new Map<string, PeriodObservation[]>();
  for (const o of observations) {
    const key = seriesKey(o);
    const bucket = series.get(key);
    if (bucket) bucket.push(o);
    else series.set(key, [o]);
  }

  const findings: PeriodJumpFinding[] = [];
  for (const bucket of series.values()) {
    const ordered = [...bucket].sort((a, b) => (a.periodEnd < b.periodEnd ? -1 : a.periodEnd > b.periodEnd ? 1 : 0));
    for (let i = 1; i < ordered.length; i++) {
      const prior = ordered[i - 1];
      const current = ordered[i];
      if (prior.value === null || current.value === null) continue;
      if (prior.value === 0) continue;
      if (Math.max(Math.abs(prior.value), Math.abs(current.value)) < materialityFloor) continue;

      const changePct = (current.value - prior.value) / Math.abs(prior.value);
      const absChangePct = Math.abs(changePct);
      if (absChangePct < relativeThresholdPct) continue;

      const direction: 'COLLAPSE' | 'SPIKE' = changePct < 0 ? 'COLLAPSE' : 'SPIKE';
      findings.push({
        entityId: current.entityId,
        canonicalLineId: current.canonicalLineId,
        lineCode: current.lineCode,
        statementType: current.statementType,
        consolidationScope: current.consolidationScope,
        accumulationBasis: current.accumulationBasis,
        priorPeriodId: prior.periodId,
        priorPeriodLabel: prior.periodLabel,
        priorValue: prior.value,
        currentPeriodId: current.periodId,
        currentPeriodLabel: current.periodLabel,
        currentValue: current.value,
        changePct,
        absChangePct,
        materialityFloor,
        direction,
        description:
          `${current.statementType} line ${current.lineCode ?? current.canonicalLineId} moved from ` +
          `${prior.value} (${prior.periodLabel}) to ${current.value} (${current.periodLabel}) — ` +
          `${(changePct * 100).toFixed(1)}% ${direction === 'COLLAPSE' ? 'collapse' : 'spike'} on a position ` +
          `above the ${materialityFloor} materiality floor. Confirm this is a real corporate event and not an extraction defect.`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export interface FinanceReconciliationRunRow {
  id: string;
  organization_id: string;
  artifact_id: string;
  business_version_id: string | null;
  source_system: string;
  source_total: string;
  mapped_total: string;
  excluded_total: string;
  unmapped_total: string;
  duplicate_total: string;
  reclass_net_total: string;
  elimination_net_total: string;
  canonical_total: string;
  residual: string;
  residual_pct: string | null;
  materiality_threshold_applied: string;
  status: ReconciliationRunStatus;
  linked_exception_id: string | null;
  bucket_detail: unknown;
  created_at: string;
  created_by: string | null;
  /** RC-01, additive column (20260810_finance_v3_d02_reconciliation_coverage.sql). */
  result_quality: ReconciliationResultQuality | null;
  /** RC-01, additive column — `absCoveredTotal / absSourceTotal` as stored NUMERIC. */
  source_value_coverage_pct: string | null;
  /** RC-01, additive column — FK to the coverage exception (distinct from the residual one). */
  coverage_exception_id: string | null;
}

export interface FinanceStmtReconciliationRow {
  id: string;
  organization_id: string;
  business_version_id: string;
  reconciliation_run_id: string;
  source_row_ref: unknown;
  canonical_line_id: string | null;
  entity_id: string | null;
  period_id: string | null;
  bucket: ReconciliationBucket;
  source_amount: string;
  mapped_amount: string | null;
  duplicate_of_row_id: string | null;
  reclass_target_line_id: string | null;
  elimination_counterparty_entity_id: string | null;
  reason_code: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export interface ReadinessCheckRow {
  check_name: string;
  passed: boolean;
  detail: string;
}

export interface RunReconciliationParams {
  organizationId: string;
  artifactId: string;
  businessVersionId: string;
  /** e.g. 'mock:parsed_upload', 'import:xlsx' — free text per WP-B05's `source_system` column. */
  sourceSystem: string;
  mappingResults: MappedRowResult[];
  /** Default PROVISIONAL_MATERIALITY_THRESHOLD_PCT. Caller-supplied override is the "or a lower
   *  per-organization threshold" half of the GATE_B placeholder rule — callers must pass the
   *  MINIMUM of their org's configured threshold and the 5% default themselves; this function
   *  does not compare against the default on the caller's behalf. */
  materialityThresholdPct?: number;
  createdBy: string;
  /** If true, checks `finance_stmt_is_ready_for_review()` after persisting and — only if ready —
   *  attempts the DRAFT -> READY_FOR_REVIEW transition (T2). Requires actorId/role/expectedVersion. */
  attemptReadinessTransition?: boolean;
  actorId?: string;
  role?: FinanceRole;
  expectedVersion?: number;
  /** RC-05 — set false to skip the period-over-period plausibility control (default: run it). */
  runPeriodJumpCheck?: boolean;
  /** RC-05 overrides (defaults: `PERIOD_JUMP_RELATIVE_THRESHOLD_PCT` / `PERIOD_JUMP_MATERIALITY_ANCHOR_PCT`). */
  periodJumpRelativeThresholdPct?: number;
  periodJumpMaterialityAnchorPct?: number;
}

export interface RunReconciliationResult {
  run: FinanceReconciliationRunRow;
  reconciliationRows: FinanceStmtReconciliationRow[];
  totals: WaterfallTotals;
  materialityThresholdPct: number;
  exception: FinanceExceptionRow | null;
  /** RC-01 — raised when any source row failed to reach the canonical model. */
  coverageException: FinanceExceptionRow | null;
  /** RC-01 — DEC-FIN-009 clean/conditional/provisional, persisted on the run row. */
  resultQuality: ReconciliationResultQuality;
  /** RC-05 — every implausible period-over-period move detected on this version's BS lines. */
  periodJumps: PeriodJumpFinding[];
  /** RC-05 — one WARNING `finance_exceptions` row per finding (deduplicated). */
  periodJumpExceptions: FinanceExceptionRow[];
  readiness: {
    checked: boolean;
    ready: boolean;
    checks: ReadinessCheckRow[];
    transitionAttempted: boolean;
    transitionResult?: TransitionServiceResult;
    businessVersion?: BusinessVersionRow;
  };
}

export async function runReconciliation(params: RunReconciliationParams): Promise<RunReconciliationResult> {
  const materialityThresholdPct = params.materialityThresholdPct ?? PROVISIONAL_MATERIALITY_THRESHOLD_PCT;
  const totals = computeWaterfall(params.mappingResults);
  const status = determineReconciliationStatus(totals, materialityThresholdPct);
  const provisionalResultQuality = determineResultQuality(totals, materialityThresholdPct, 0);

  const runId = uuidv4();
  const reconRowIds = params.mappingResults.map(() => uuidv4());

  const { run, reconciliationRows } = await withPinnedPostgresTransaction(async (tx) => {
    const insertedRun = await tx.queryOne<FinanceReconciliationRunRow>(
      `INSERT INTO finance_reconciliation_runs (
         id, organization_id, artifact_id, business_version_id, source_system,
         source_total, mapped_total, excluded_total, unmapped_total, duplicate_total,
         reclass_net_total, elimination_net_total, canonical_total, materiality_threshold_applied,
         status, result_quality, source_value_coverage_pct, bucket_detail, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        runId,
        params.organizationId,
        params.artifactId,
        params.businessVersionId,
        params.sourceSystem,
        totals.sourceTotal,
        totals.mappedTotal,
        totals.excludedTotal,
        totals.unmappedTotal,
        totals.duplicateTotal,
        totals.reclassNetTotal,
        totals.eliminationNetTotal,
        totals.canonicalTotal,
        materialityThresholdPct,
        status,
        // Provisional at insert time: RC-05 jumps are only known after the lines are queried
        // back below, and this row must never exist without SOME quality verdict on it.
        provisionalResultQuality,
        totals.coverage.sourceValueCoveragePct,
        JSON.stringify({ coverage: totals.coverage }),
        params.createdBy,
      ]
    );
    if (!insertedRun) throw new Error('finance_reconciliation_runs insert returned no row');

    const rows: FinanceStmtReconciliationRow[] = [];
    for (let i = 0; i < params.mappingResults.length; i++) {
      const row = params.mappingResults[i];
      const inserted = await tx.queryOne<FinanceStmtReconciliationRow>(
        `INSERT INTO finance_stmt_reconciliation (
           id, organization_id, business_version_id, reconciliation_run_id, source_row_ref,
           canonical_line_id, entity_id, period_id, bucket, source_amount, mapped_amount,
           duplicate_of_row_id, reclass_target_line_id, elimination_counterparty_entity_id,
           reason_code, notes, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *`,
        [
          reconRowIds[i],
          params.organizationId,
          params.businessVersionId,
          runId,
          JSON.stringify(row.raw.sourceRef ?? { lineItem: row.raw.lineItem, periodId: row.raw.periodId, entityCode: row.raw.entityCode }),
          row.canonicalLineId,
          row.entityId,
          row.periodId,
          row.bucket,
          row.sourceAmount,
          row.mappedAmount,
          row.duplicateOfRowIndex !== null ? reconRowIds[row.duplicateOfRowIndex] : null,
          row.reclassTargetLineId,
          row.eliminationCounterpartyEntityId,
          row.reasonCode,
          null,
          params.createdBy,
        ]
      );
      if (!inserted) throw new Error('finance_stmt_reconciliation insert returned no row');
      rows.push(inserted);
    }

    return { run: insertedRun, reconciliationRows: rows };
  });

  // W10-D01 fix (`docs/validation/finance-v3/generated/gate-d/W10_D01_SEMANTIC_HASH_FIX_report.md`):
  // Statement Pack has no `compute_jobs` row at all (unlike Baseline/Prediction/
  // Valuation/KPI) — this reconciliation run (`runId`, `finance_reconciliation_runs.id`
  // above) IS the "real run" for this artifact type, so it is what `compute_run_id`
  // points at. The hash uses the SAME `canonicalPayloadHash()` primitive every other
  // engine now uses (`./contentHash.ts`), applied to this run's own totals + row
  // count — the smallest deterministic fingerprint of "what this reconciliation run
  // produced", mirroring `batchContentHash()`'s "hash the run's own output, not a
  // full domain re-read" convention in `financeImportService.ts`.
  const reconciliationWorkingRevision = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ working_revision_id: string }>(
      `SELECT working_revision_id FROM finance_working_revisions WHERE artifact_id = ? AND organization_id = ? AND is_current = true`,
      [params.artifactId, params.organizationId]
    )
  );
  if (reconciliationWorkingRevision) {
    await stampWorkingRevisionComputeIdentity({
      organizationId: params.organizationId,
      workingRevisionId: reconciliationWorkingRevision.working_revision_id,
      contentSemanticHash: canonicalPayloadHash({ totals, reconciliationRowCount: reconciliationRows.length }),
      computeRunId: runId,
    });
  }

  // --- Exception on over-threshold residual (task: "Residual > materiality placeholder -> tworzy
  //     finance_exceptions z severity odpowiednim do wielkości residuala"). ---
  let exception: FinanceExceptionRow | null = null;
  let finalRun = run;
  if (status === 'EXCEEDS_MATERIALITY') {
    const severity = severityForResidual(totals.residualPct, materialityThresholdPct);
    const raised = await exceptionLedgerService.raise({
      organizationId: params.organizationId,
      artifactId: params.artifactId,
      businessVersionId: params.businessVersionId,
      severity,
      sourceRef: { kind: 'STATEMENT_RECONCILIATION_RESIDUAL', reconciliationRunId: runId },
      expected: totals.sourceTotal - totals.excludedTotal - totals.unmappedTotal,
      observed: totals.canonicalTotal,
      delta: totals.residual,
      unit: null,
      reasonCode: 'RECONCILIATION_RESIDUAL_EXCEEDS_MATERIALITY',
      raisedBy: params.createdBy,
      evidence: { totals, materialityThresholdPct },
    });
    if (!raised.ok) {
      throw new Error(`Failed to raise reconciliation-residual exception: ${raised.message}`);
    }
    exception = raised.exception;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_reconciliation_runs SET linked_exception_id = ? WHERE id = ?`, [exception!.id, runId])
    );
    finalRun = { ...run, linked_exception_id: exception.id };
  }

  // --- BUGFIX RC-01: coverage exception. A row that never reached the canonical model is a
  //     completeness defect on its own axis — it must be COUNTABLE (how many rows mapped, how
  //     many were left, what share of source VALUE the mapped rows carry), not implied by a
  //     residual that already subtracted it away. Non-blocking by DEC-FIN-009; the severity
  //     rides on the exception and on result_quality, never on a gate. ---
  let coverageException: FinanceExceptionRow | null = null;
  if (totals.coverage.coverageLossRowCount > 0) {
    const cov = totals.coverage;
    const severity = severityForResidual(cov.coverageLossSharePct, materialityThresholdPct);
    const raised = await exceptionLedgerService.raise({
      organizationId: params.organizationId,
      artifactId: params.artifactId,
      businessVersionId: params.businessVersionId,
      severity,
      sourceRef: { kind: 'STATEMENT_RECONCILIATION_COVERAGE', reconciliationRunId: runId },
      // "expected" = the whole source statement by magnitude; "observed" = what the canonical
      // model actually carries. delta is the value that silently disappeared.
      expected: cov.absSourceTotal,
      observed: cov.absCoveredTotal,
      delta: -cov.absCoverageLossTotal,
      unit: null,
      reasonCode: 'RECONCILIATION_SOURCE_COVERAGE_INCOMPLETE',
      dedupKey: `coverage::${params.businessVersionId}::${runId}`,
      raisedBy: params.createdBy,
      evidence: {
        coverage: cov,
        materialityThresholdPct,
        summary:
          `${cov.mappedRowCount} of ${cov.totalRowCount} source rows reached the canonical model; ` +
          `${cov.coverageLossRowCount} row(s) had no canonical target. Mapped rows carry ` +
          `${cov.sourceValueCoveragePct === null ? 'an undefined share of' : `${(cov.sourceValueCoveragePct * 100).toFixed(1)}% of`} ` +
          `the absolute source value.`,
      },
    });
    if (!raised.ok) {
      throw new Error(`Failed to raise reconciliation-coverage exception: ${raised.message}`);
    }
    coverageException = raised.exception;
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_reconciliation_runs SET coverage_exception_id = ? WHERE id = ?`, [coverageException!.id, runId])
    );
    finalRun = { ...finalRun, coverage_exception_id: coverageException.id };
  }

  // --- BUGFIX RC-05: period-over-period plausibility control on the balance sheet. ---
  let periodJumps: PeriodJumpFinding[] = [];
  const periodJumpExceptions: FinanceExceptionRow[] = [];
  if (params.runPeriodJumpCheck !== false) {
    const observations = await loadBalanceSheetObservations(params.businessVersionId);
    periodJumps = detectPeriodOverPeriodJumps(observations, {
      relativeThresholdPct: params.periodJumpRelativeThresholdPct,
      materialityAnchorPct: params.periodJumpMaterialityAnchorPct,
    });
    for (const jump of periodJumps) {
      const dedupKey = `period_jump::${params.businessVersionId}::${jump.entityId}::${jump.canonicalLineId}::${jump.priorPeriodId}::${jump.currentPeriodId}`;
      const alreadyOpen = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ id: string }>(`SELECT id FROM finance_exceptions WHERE dedup_key = ? LIMIT 1`, [dedupKey])
      );
      if (alreadyOpen) continue;
      const raised = await exceptionLedgerService.raise({
        organizationId: params.organizationId,
        artifactId: params.artifactId,
        businessVersionId: params.businessVersionId,
        // WARNING by DEC-FIN-009: "akceptacja analityka z uzasadnieniem" — this MARKS the
        // import, it never blocks it (a SECURITY severity would; WARNING does not).
        severity: 'WARNING',
        sourceRef: {
          kind: 'STATEMENT_PERIOD_OVER_PERIOD_JUMP',
          reconciliationRunId: runId,
          entityId: jump.entityId,
          canonicalLineId: jump.canonicalLineId,
          lineCode: jump.lineCode,
          statementType: jump.statementType,
          priorPeriodId: jump.priorPeriodId,
          currentPeriodId: jump.currentPeriodId,
        },
        expected: jump.priorValue,
        observed: jump.currentValue,
        delta: jump.currentValue - jump.priorValue,
        unit: null,
        reasonCode: 'PERIOD_OVER_PERIOD_JUMP',
        dedupKey,
        raisedBy: params.createdBy,
        evidence: { jump },
      });
      if (!raised.ok) {
        throw new Error(`Failed to raise period-over-period jump exception: ${raised.message}`);
      }
      periodJumpExceptions.push(raised.exception);
    }
  }

  // --- Final DEC-FIN-009 verdict, now that RC-05 findings are known. ---
  const resultQuality = determineResultQuality(totals, materialityThresholdPct, periodJumps.length);
  if (resultQuality !== provisionalResultQuality) {
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_reconciliation_runs SET result_quality = ? WHERE id = ?`, [resultQuality, runId])
    );
  }
  finalRun = { ...finalRun, result_quality: resultQuality };

  // Propagate the verdict onto the Statement Pack itself so the artifact — not just the
  // reconciliation run — carries clean/conditional/provisional (DEC-FIN-009: "kazdy material
  // pokazuje jakosc ... rozroznia clean/conditional/provisional"). Scoped to DRAFT so the B01
  // post-approval immutability trigger is never provoked.
  await withPinnedPostgresTransaction((tx) =>
    tx.queryRun(`UPDATE finance_business_versions SET result_quality = ? WHERE business_version_id = ? AND status = 'DRAFT'`, [
      resultQuality,
      params.businessVersionId,
    ])
  );

  // --- Readiness gate + optional DRAFT -> READY_FOR_REVIEW transition (WP-D01 section 7 /
  //     WP-B02 T2, both already shipped — this function only calls them). ---
  const readiness: RunReconciliationResult['readiness'] = { checked: false, ready: false, checks: [], transitionAttempted: false };
  if (params.attemptReadinessTransition) {
    const checks = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<ReadinessCheckRow>(`SELECT * FROM finance_stmt_readiness_check(?)`, [params.businessVersionId])
    );
    const readyRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ ready: boolean }>(`SELECT finance_stmt_is_ready_for_review(?) AS ready`, [params.businessVersionId])
    );
    readiness.checked = true;
    readiness.checks = checks;
    readiness.ready = readyRow?.ready === true;

    if (readiness.ready) {
      if (!params.actorId || !params.role || params.expectedVersion === undefined) {
        throw new Error('attemptReadinessTransition=true requires actorId, role, and expectedVersion');
      }
      readiness.transitionAttempted = true;
      const transitionResult = await transition({
        organizationId: params.organizationId,
        businessVersionId: params.businessVersionId,
        action: 'submit_for_review',
        actorId: params.actorId,
        role: params.role,
        expectedVersion: params.expectedVersion,
      });
      readiness.transitionResult = transitionResult;
      if (transitionResult.ok) readiness.businessVersion = transitionResult.businessVersion;
    }
  }

  return {
    run: finalRun,
    reconciliationRows,
    totals,
    materialityThresholdPct,
    exception,
    coverageException,
    resultQuality,
    periodJumps,
    periodJumpExceptions,
    readiness,
  };
}

// ---------------------------------------------------------------------------
// Pakiet B2 — thin readers (DEC-FIN-012). No prior HTTP caller wrote
// `finance_reconciliation_runs`/`finance_stmt_reconciliation` back out —
// `runReconciliation` above only ever returns them in-process to its own
// caller. Org-scoped SELECTs only, mirroring this file's own row shapes.
// ---------------------------------------------------------------------------

/** Single reconciliation run by id, org-scoped — 404-vs-empty-array disambiguation for the router (same reasoning as `artifactVersionService.getArtifact`). */
export async function getReconciliationRun(
  organizationId: string,
  reconciliationRunId: string
): Promise<FinanceReconciliationRunRow | null> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryOne<FinanceReconciliationRunRow>(
      `SELECT * FROM finance_reconciliation_runs WHERE organization_id = ? AND id = ?`,
      [organizationId, reconciliationRunId]
    )
  );
}

/** Every reconciliation run for one Statement Pack version, newest first — the "reconciliation ledger" the brief asks for. */
export async function listReconciliationRuns(
  organizationId: string,
  businessVersionId: string
): Promise<FinanceReconciliationRunRow[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<FinanceReconciliationRunRow>(
      `SELECT * FROM finance_reconciliation_runs WHERE organization_id = ? AND business_version_id = ? ORDER BY created_at DESC`,
      [organizationId, businessVersionId]
    )
  );
}

/** Row-level detail (one row per mapped source line) for a single reconciliation run — the waterfall's audit trail. */
export async function listReconciliationDetail(
  organizationId: string,
  reconciliationRunId: string
): Promise<FinanceStmtReconciliationRow[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<FinanceStmtReconciliationRow>(
      `SELECT * FROM finance_stmt_reconciliation WHERE organization_id = ? AND reconciliation_run_id = ? ORDER BY created_at ASC`,
      [organizationId, reconciliationRunId]
    )
  );
}

/**
 * RC-05 data access — every stored balance-sheet cell of one Statement Pack version, flattened
 * for `detectPeriodOverPeriodJumps`. Only `value_status='PRESENT_*'` cells carry a number;
 * MISSING/NA cells come back as `value: null` so the detector can skip them instead of reading
 * a NULL as zero (which would manufacture a 100% "collapse" out of a missing row).
 */
async function loadBalanceSheetObservations(businessVersionId: string): Promise<PeriodObservation[]> {
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{
      entity_id: string;
      canonical_line_id: string;
      line_code: string | null;
      statement_type: string;
      consolidation_scope: string;
      accumulation_basis: string;
      period_id: string;
      period_label: string;
      period_end: string;
      value_decimal: string | null;
      value_status: string;
    }>(
      `SELECT l.entity_id, l.canonical_line_id, fsl.line_code, l.statement_type,
              l.consolidation_scope, l.accumulation_basis,
              l.period_id, p.label AS period_label, p.period_end,
              l.value_decimal, l.value_status
         FROM finance_stmt_lines l
         JOIN finance_stmt_periods p ON p.period_id = l.period_id
         LEFT JOIN financial_statement_lines fsl ON fsl.id = l.canonical_line_id
        WHERE l.business_version_id = ? AND l.statement_type = 'BS'`,
      [businessVersionId]
    )
  );

  return rows.map((r) => ({
    entityId: r.entity_id,
    canonicalLineId: r.canonical_line_id,
    lineCode: r.line_code,
    statementType: r.statement_type,
    consolidationScope: r.consolidation_scope,
    accumulationBasis: r.accumulation_basis,
    periodId: r.period_id,
    periodLabel: r.period_label,
    periodEnd: typeof r.period_end === 'string' ? r.period_end : new Date(r.period_end as unknown as string).toISOString(),
    value: r.value_decimal === null ? null : Number(r.value_decimal),
  }));
}
