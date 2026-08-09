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
  type BusinessVersionRow,
  type TransitionServiceResult,
} from './artifactVersionService.js';
import * as exceptionLedgerService from './exceptionLedgerService.js';
import type { ExceptionSeverity, FinanceExceptionRow } from './exceptionLedgerService.js';
import type { FinanceRole } from './lifecycleService.js';
import type { MappedRowResult, ReconciliationBucket } from './statementMappingService.js';

// ---------------------------------------------------------------------------
// Waterfall — pure, no DB (unit-testable per the task's explicit requirement)
// ---------------------------------------------------------------------------

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
}

export type WaterfallRow = Pick<MappedRowResult, 'bucket' | 'sourceAmount' | 'mappedAmount' | 'signConvention'>;

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

  for (const row of rows) {
    sourceTotal += row.sourceAmount;
    const contribution = row.mappedAmount ?? 0;

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

  return { sourceTotal, mappedTotal, excludedTotal, unmappedTotal, duplicateTotal, reclassNetTotal, eliminationNetTotal, canonicalTotal, residual, residualPct };
}

/** `finance_reconciliation_runs.status` CHECK values (WP-B05, already shipped). */
export type ReconciliationRunStatus = 'CLEAN' | 'WITHIN_TOLERANCE' | 'EXCEEDS_MATERIALITY';

export function determineReconciliationStatus(totals: WaterfallTotals, materialityThresholdPct: number): ReconciliationRunStatus {
  if (Math.abs(totals.residual) < RESIDUAL_ZERO_EPSILON) return 'CLEAN';
  if (totals.residualPct === null) return 'EXCEEDS_MATERIALITY'; // non-zero residual against a zero source total: undefined %, cannot be "within" anything
  return totals.residualPct <= materialityThresholdPct ? 'WITHIN_TOLERANCE' : 'EXCEEDS_MATERIALITY';
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
}

export interface RunReconciliationResult {
  run: FinanceReconciliationRunRow;
  reconciliationRows: FinanceStmtReconciliationRow[];
  totals: WaterfallTotals;
  materialityThresholdPct: number;
  exception: FinanceExceptionRow | null;
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

  const runId = uuidv4();
  const reconRowIds = params.mappingResults.map(() => uuidv4());

  const { run, reconciliationRows } = await withPinnedPostgresTransaction(async (tx) => {
    const insertedRun = await tx.queryOne<FinanceReconciliationRunRow>(
      `INSERT INTO finance_reconciliation_runs (
         id, organization_id, artifact_id, business_version_id, source_system,
         source_total, mapped_total, excluded_total, unmapped_total, duplicate_total,
         reclass_net_total, elimination_net_total, canonical_total, materiality_threshold_applied,
         status, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  return { run: finalRun, reconciliationRows, totals, materialityThresholdPct, exception, readiness };
}
