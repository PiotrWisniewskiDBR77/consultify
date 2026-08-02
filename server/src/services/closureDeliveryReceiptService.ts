/**
 * EXE-09 — durable Execution-closure → Results/Finance delivery receipt.
 *
 * Replaces the fire-and-forget-only handoff in `executionResultsBridge.ts`
 * (`fireClosureHandoff`, `.catch(logger.warn)` and forget) with a durable
 * row (migration 935_exe009_closure_delivery_receipt.sql,
 * `closure_delivery_receipts` / `closure_finance_actuals`) written INSIDE the
 * same transaction as the initiative's DONE transition
 * (`initiativeTransitionService.ts` — the only caller of
 * {@link createReceiptOnClosure}), plus a worker/reconciliation sweep
 * ({@link runReconciliationSweep}) that retries delivery until it lands.
 *
 * Results and Finance are two INDEPENDENT legs (separate status columns,
 * separate downstream writers, separate failure isolation):
 *
 * - Results leg calls the existing, already-idempotent
 *   `executionResultsBridge.handoffFromClosure` (dedup via migration 783's
 *   partial unique index on `initiative_benefits`), then reads back the
 *   actual benefit row ids so a RETRIED attempt reports the same downstream
 *   ids rather than only whatever the first attempt saw.
 * - Finance leg computes its value INDEPENDENTLY from the initiative's own
 *   planned KPI targets / expected_roi (the same source data
 *   `handoffFromClosure` reads — not from the Results leg's output), paired
 *   with `initiatives.budget_currency`. This is deliberate: a Results-leg
 *   failure must never block or hide a successful Finance delivery, and vice
 *   versa (EXE-09 contract point 3). If either the amount or the currency
 *   cannot be determined unambiguously, the leg is marked NEEDS_DECISION —
 *   this module never invents a value or a currency (EXE-09 contract:
 *   "nie wolno wymyślać mapowania wartości").
 *
 * Finance delivery writes to a NEW, additive `closure_finance_actuals` table
 * — deliberately not any existing Finance table/service, to stay completely
 * clear of the active FIN-05 (`feat/fin-005-statement-ingestion-golden-flow`)
 * and the frozen-but-unmerged `fix/fin-005-atelier-coherence` line (see
 * docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/EXE-009_DISCOVERY.md).
 */

import { randomUUID } from 'node:crypto';

import * as queryHelpers from '../utils/queryHelpers.js';
import { withPgTransaction, type PgTransactionClient } from '../utils/queryHelpers.js';
import logger from '../utils/Logger.js';
import { handoffFromClosure, CLOSURE_HANDOFF_SOURCE } from './executionResultsBridge.js';

const LOG_PREFIX = '[ClosureDeliveryReceipt]';

export const SYSTEM_ACTOR_LABEL = 'system:exe-009-closure-receipt';

export type ResultsStatus = 'PENDING' | 'DELIVERING' | 'DELIVERED' | 'FAILED';
export type FinanceStatus = 'PENDING' | 'DELIVERING' | 'DELIVERED' | 'FAILED' | 'NEEDS_DECISION';

export interface ClosureDeliveryReceipt {
  id: string;
  organizationId: string;
  initiativeId: string;
  transitionAuditRef: string;
  actorId: string | null;
  actorLabel: string;
  resultsStatus: ResultsStatus;
  resultsAttempts: number;
  resultsLastError: string | null;
  resultsDeliveredAt: string | null;
  resultsPayload: Record<string, unknown> | null;
  financeStatus: FinanceStatus;
  financeAttempts: number;
  financeLastError: string | null;
  financeDeliveredAt: string | null;
  financePayload: Record<string, unknown> | null;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReceiptRow {
  id: string;
  organization_id: string;
  initiative_id: string;
  transition_audit_ref: string;
  actor_id: string | null;
  actor_label: string;
  results_status: ResultsStatus;
  results_attempts: number;
  results_last_error: string | null;
  results_delivered_at: string | null;
  results_payload: unknown;
  finance_status: FinanceStatus;
  finance_attempts: number;
  finance_last_error: string | null;
  finance_delivered_at: string | null;
  finance_payload: unknown;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

function parseJsonColumn(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function toReceipt(row: ReceiptRow): ClosureDeliveryReceipt {
  return {
    id: row.id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    transitionAuditRef: row.transition_audit_ref,
    actorId: row.actor_id,
    actorLabel: row.actor_label,
    resultsStatus: row.results_status,
    resultsAttempts: row.results_attempts,
    resultsLastError: row.results_last_error,
    resultsDeliveredAt: row.results_delivered_at,
    resultsPayload: parseJsonColumn(row.results_payload),
    financeStatus: row.finance_status,
    financeAttempts: row.finance_attempts,
    financeLastError: row.finance_last_error,
    financeDeliveredAt: row.finance_delivered_at,
    financePayload: parseJsonColumn(row.finance_payload),
    nextRetryAt: row.next_retry_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Insert the receipt row. MUST be called with the SAME `client` and the SAME
 * `correlationId` the canonical transition engine used for
 * `initiative_status_history`/`initiative_history` in the SAME transaction —
 * see initiativeTransitionService.ts's call site (guarded by
 * `currentStatus !== 'DONE' && nextStatus === 'DONE'`, mirroring
 * `fireClosureHandoff`'s own trigger condition). The receipt's primary key
 * IS `correlationId`: a fresh UUID generated exactly once per real
 * transition, never client-supplied, so this insert can never collide with
 * an earlier closure of the same initiative — it is the idempotency
 * guarantee for receipt CREATION (delivery-retry idempotency is a separate
 * concern, handled by {@link attemptDelivery}).
 */
export async function createReceiptOnClosure(
  client: PgTransactionClient,
  params: {
    organizationId: string;
    initiativeId: string;
    correlationId: string;
    actorId: string | null;
  }
): Promise<void> {
  const { organizationId, initiativeId, correlationId, actorId } = params;
  await client.query(
    `INSERT INTO closure_delivery_receipts (
       id, organization_id, initiative_id, transition_audit_ref, actor_id, actor_label
     ) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [correlationId, organizationId, initiativeId, correlationId, actorId, SYSTEM_ACTOR_LABEL]
  );
}

export async function getReceiptById(
  receiptId: string,
  organizationId: string
): Promise<ClosureDeliveryReceipt | null> {
  const row = await queryHelpers.queryOne<ReceiptRow>(
    `SELECT * FROM closure_delivery_receipts WHERE id = ? AND organization_id = ?`,
    [receiptId, organizationId]
  );
  return row ? toReceipt(row) : null;
}

export async function getReceiptForInitiative(
  initiativeId: string,
  organizationId: string
): Promise<ClosureDeliveryReceipt | null> {
  // At most one receipt row is expected per initiative under normal
  // operation (an initiative can only be closed from non-DONE once without
  // an explicit revert+re-close cycle) — if a revert/re-close DOES happen,
  // this deliberately returns the MOST RECENT closure's receipt, matching
  // "current state of the current closure", not history.
  const row = await queryHelpers.queryOne<ReceiptRow>(
    `SELECT * FROM closure_delivery_receipts
      WHERE initiative_id = ? AND organization_id = ?
      ORDER BY created_at DESC
      LIMIT 1`,
    [initiativeId, organizationId]
  );
  return row ? toReceipt(row) : null;
}

interface InitiativeFinanceRow {
  budget_currency: string | null;
  expected_roi: number | string | null;
}

interface PlannedKpiTargetRow {
  target_value: number | string;
}

/**
 * Independently compute the Finance amount/currency for this initiative —
 * deliberately NOT reading `initiative_benefits` (the Results leg's output),
 * so a Results-leg failure this attempt cannot block Finance delivery. Same
 * source-of-truth precedence as `handoffFromClosure` (planned KPI targets,
 * else `expected_roi`), so the number itself is not invented — only
 * re-derived independently. Returns `null` when the amount or currency
 * cannot be determined unambiguously — the caller must treat that as
 * NEEDS_DECISION, never substitute a default.
 */
async function computeFinanceValue(
  organizationId: string,
  initiativeId: string
): Promise<{ amount: number; currency: string; valueSource: string } | null> {
  const initiative = await queryHelpers.queryOne<InitiativeFinanceRow>(
    `SELECT budget_currency, expected_roi FROM initiatives WHERE id = ? AND organization_id = ?`,
    [initiativeId, organizationId]
  );
  if (!initiative || !initiative.budget_currency) {
    // No explicit currency recorded on the initiative — this codebase has no
    // other unambiguous per-initiative currency signal (project memory:
    // Initiatives/Execution vs. Finance PLN/EUR mismatch is an open,
    // unresolved product question). Refusing to guess is the point.
    return null;
  }

  const kpiTargets = await queryHelpers.queryAll<PlannedKpiTargetRow>(
    `SELECT target_value FROM initiative_kpis WHERE initiative_id = ? AND target_value IS NOT NULL`,
    [initiativeId]
  );
  if (kpiTargets.length > 0) {
    const amount = kpiTargets.reduce((sum, row) => sum + Number(row.target_value), 0);
    if (Number.isFinite(amount) && amount !== 0) {
      return {
        amount,
        currency: initiative.budget_currency,
        valueSource: 'initiative_kpis.target_value (sum) + initiatives.budget_currency',
      };
    }
  }

  const expectedRoi =
    initiative.expected_roi !== null && initiative.expected_roi !== undefined
      ? Number(initiative.expected_roi)
      : null;
  if (expectedRoi !== null && Number.isFinite(expectedRoi) && expectedRoi !== 0) {
    return {
      amount: expectedRoi,
      currency: initiative.budget_currency,
      valueSource: 'initiatives.expected_roi + initiatives.budget_currency',
    };
  }

  // No planned KPI target and no expected_roi — same "nothing to hand off"
  // case handoffFromClosure treats as zero benefits, no error. For Finance
  // this is a mapping gap, not a silent zero: NEEDS_DECISION.
  return null;
}

function backoffMs(attempts: number): number {
  // 30s, 60s, 120s, ... capped at 30 minutes.
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 30 * 60_000);
}

export interface AttemptDeliveryOptions {
  /** Test-only fault injection — no-op unless a test sets it. */
  __testForceResultsError?: Error;
  /** Test-only fault injection — no-op unless a test sets it. */
  __testForceFinanceError?: Error;
}

/**
 * Attempt (or retry) delivery of both legs for one receipt. Safe to call
 * concurrently / repeatedly for the same receipt: each leg only acts while
 * its own status is retry-eligible (PENDING/FAILED) and is otherwise a
 * cheap no-op read. Never throws for an ordinary downstream failure — the
 * failure is recorded on the row and observable via {@link getReceiptById};
 * it only throws if the receipt itself does not exist.
 */
export async function attemptDelivery(
  receiptId: string,
  opts: AttemptDeliveryOptions = {}
): Promise<ClosureDeliveryReceipt> {
  const receipt = await queryHelpers.queryOne<ReceiptRow>(
    `SELECT * FROM closure_delivery_receipts WHERE id = ?`,
    [receiptId]
  );
  if (!receipt) {
    throw new Error(`${LOG_PREFIX} attemptDelivery: no receipt found for id ${receiptId}`);
  }

  const { organization_id: organizationId, initiative_id: initiativeId, actor_id: actorId } = receipt;

  // ---- Results leg ----
  if (receipt.results_status !== 'DELIVERED') {
    try {
      if (opts.__testForceResultsError) throw opts.__testForceResultsError;
      await handoffFromClosure(organizationId, initiativeId, actorId);
      const benefitRows = await queryHelpers.queryAll<{ id: string }>(
        `SELECT id FROM initiative_benefits WHERE initiative_id = ? AND source_tag = ?`,
        [initiativeId, CLOSURE_HANDOFF_SOURCE]
      );
      await queryHelpers.queryRun(
        `UPDATE closure_delivery_receipts
            SET results_status = 'DELIVERED',
                results_attempts = results_attempts + 1,
                results_last_error = NULL,
                results_delivered_at = CURRENT_TIMESTAMP,
                results_payload = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [JSON.stringify({ benefitIds: benefitRows.map((r) => r.id) }), receiptId]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`${LOG_PREFIX} Results delivery failed for receipt ${receiptId}: ${message}`);
      await queryHelpers.queryRun(
        `UPDATE closure_delivery_receipts
            SET results_status = 'FAILED',
                results_attempts = results_attempts + 1,
                results_last_error = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [message, receiptId]
      );
    }
  }

  // ---- Finance leg (independent of the Results leg's outcome THIS attempt) ----
  if (receipt.finance_status === 'PENDING' || receipt.finance_status === 'FAILED') {
    try {
      if (opts.__testForceFinanceError) throw opts.__testForceFinanceError;
      const value = await computeFinanceValue(organizationId, initiativeId);
      if (!value) {
        await queryHelpers.queryRun(
          `UPDATE closure_delivery_receipts
              SET finance_status = 'NEEDS_DECISION',
                  finance_last_error = ?,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [
            'No unambiguous financial target: initiative has no budget_currency, or no planned ' +
              'KPI target/expected_roi to realize. Needs an explicit product decision on value mapping.',
            receiptId,
          ]
        );
      } else {
        const financeActualId = randomUUID();
        await queryHelpers.queryRun(
          `INSERT INTO closure_finance_actuals (
             id, organization_id, initiative_id, closure_receipt_id, amount, currency, value_source, created_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (closure_receipt_id) DO NOTHING`,
          [
            financeActualId,
            organizationId,
            initiativeId,
            receiptId,
            value.amount,
            value.currency,
            value.valueSource,
            actorId,
          ]
        );
        const persisted = await queryHelpers.queryOne<{ id: string; amount: string; currency: string }>(
          `SELECT id, amount, currency FROM closure_finance_actuals WHERE closure_receipt_id = ?`,
          [receiptId]
        );
        await queryHelpers.queryRun(
          `UPDATE closure_delivery_receipts
              SET finance_status = 'DELIVERED',
                  finance_attempts = finance_attempts + 1,
                  finance_last_error = NULL,
                  finance_delivered_at = CURRENT_TIMESTAMP,
                  finance_payload = ?,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [JSON.stringify({ financeActualId: persisted?.id ?? financeActualId }), receiptId]
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`${LOG_PREFIX} Finance delivery failed for receipt ${receiptId}: ${message}`);
      await queryHelpers.queryRun(
        `UPDATE closure_delivery_receipts
            SET finance_status = 'FAILED',
                finance_attempts = finance_attempts + 1,
                finance_last_error = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [message, receiptId]
      );
    }
  }

  const refreshed = await queryHelpers.queryOne<ReceiptRow>(
    `SELECT * FROM closure_delivery_receipts WHERE id = ?`,
    [receiptId]
  );
  const result = toReceipt(refreshed as ReceiptRow);

  const stillPending =
    result.resultsStatus === 'PENDING' ||
    result.resultsStatus === 'FAILED' ||
    result.financeStatus === 'PENDING' ||
    result.financeStatus === 'FAILED';
  const nextRetryAt = stillPending
    ? new Date(Date.now() + backoffMs(Math.max(result.resultsAttempts, result.financeAttempts))).toISOString()
    : null;
  await queryHelpers.queryRun(
    `UPDATE closure_delivery_receipts SET next_retry_at = ? WHERE id = ?`,
    [nextRetryAt, receiptId]
  );

  return result;
}

/**
 * Best-effort immediate delivery attempt, fired right after the closure
 * transaction commits (replacing the old `fireClosureHandoff` call site in
 * initiativeTransitionService.ts). Unlike the old fire-and-forget, a failure
 * or a process crash here loses NOTHING: the receipt row already committed
 * atomically with the status change, so {@link runReconciliationSweep} will
 * pick it up on its next tick regardless of what happens to this call.
 */
export function triggerImmediateDeliveryBestEffort(receiptId: string): void {
  void attemptDelivery(receiptId).catch((err) => {
    logger.warn(
      `${LOG_PREFIX} immediate delivery attempt failed for receipt ${receiptId} (reconciliation ` +
        `sweep will retry): ${err instanceof Error ? err.message : String(err)}`
    );
  });
}

/**
 * Operator-triggered retry: clears the backoff wait so the very next sweep
 * tick (or this call itself) reprocesses the receipt immediately. Safe for
 * any receipt state — a receipt with both legs already DELIVERED/
 * NEEDS_DECISION simply does nothing on the next attempt (idempotent).
 */
export async function manualRetryReceipt(receiptId: string, organizationId: string): Promise<ClosureDeliveryReceipt> {
  const existing = await getReceiptById(receiptId, organizationId);
  if (!existing) {
    throw new Error(`${LOG_PREFIX} manualRetryReceipt: no receipt ${receiptId} in organization ${organizationId}`);
  }
  await queryHelpers.queryRun(
    `UPDATE closure_delivery_receipts SET next_retry_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [receiptId]
  );
  return attemptDelivery(receiptId);
}

const DEFAULT_SWEEP_BATCH_SIZE = 25;

/**
 * Claim up to `limit` receipts that are due for (re)processing, using a
 * short-lived transaction + `FOR UPDATE SKIP LOCKED` so multiple concurrent
 * sweep runs (e.g. more than one server instance) never double-process the
 * same receipt. The claim itself bumps `next_retry_at` briefly into the
 * future as a lease marker — `SKIP LOCKED` only protects rows while THIS
 * transaction is open, which ends as soon as the claim commits.
 */
async function claimDueReceipts(limit: number): Promise<string[]> {
  return withPgTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM closure_delivery_receipts
        WHERE (results_status IN ('PENDING', 'FAILED') OR finance_status IN ('PENDING', 'FAILED'))
          AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)
        ORDER BY created_at ASC
        LIMIT ?
        FOR UPDATE SKIP LOCKED`,
      [limit]
    );
    const ids = rows.map((r) => r.id);
    if (ids.length > 0) {
      const leaseUntil = new Date(Date.now() + 60_000).toISOString();
      await client.query(`UPDATE closure_delivery_receipts SET next_retry_at = ? WHERE id = ANY(?)`, [
        leaseUntil,
        ids,
      ]);
    }
    return ids;
  });
}

/**
 * The reconciliation worker. Call on an interval (see
 * `startClosureReceiptReconciliationCron` in server/src/index.ts) and also
 * safe to call directly after a process restart — it makes no assumption
 * about what happened before it runs, only about what state the durable rows
 * are in right now, so a crash between closure-commit and first delivery
 * attempt is recovered automatically on the next tick.
 */
export async function runReconciliationSweep(
  limit: number = DEFAULT_SWEEP_BATCH_SIZE
): Promise<{ claimed: number; delivered: number; stillPending: number }> {
  const ids = await claimDueReceipts(limit);
  let delivered = 0;
  let stillPending = 0;
  for (const id of ids) {
    try {
      const result = await attemptDelivery(id);
      const bothTerminal =
        (result.resultsStatus === 'DELIVERED' || result.resultsStatus === 'FAILED') &&
        (result.financeStatus === 'DELIVERED' ||
          result.financeStatus === 'NEEDS_DECISION' ||
          result.financeStatus === 'FAILED');
      if (result.resultsStatus === 'DELIVERED' && result.financeStatus !== 'PENDING') {
        delivered += 1;
      } else if (!bothTerminal) {
        stillPending += 1;
      }
    } catch (err) {
      logger.error(
        `${LOG_PREFIX} reconciliation sweep: unexpected error processing receipt ${id}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
  return { claimed: ids.length, delivered, stillPending };
}

let cronHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Registers the periodic reconciliation sweep. Mirrors
 * `notificationOutboxService.startNotificationOutboxDrainCron` (same
 * additive, idempotent-to-call-twice pattern) — call once at process
 * startup (server/src/index.ts).
 */
export function startClosureReceiptReconciliationCron(intervalMs: number = 30_000): void {
  if (cronHandle) return;
  cronHandle = setInterval(() => {
    runReconciliationSweep().catch((err) => {
      logger.error(`${LOG_PREFIX} reconciliation cron tick failed: ${err instanceof Error ? err.message : err}`);
    });
  }, intervalMs);
  if (typeof cronHandle.unref === 'function') cronHandle.unref();
}

export function stopClosureReceiptReconciliationCron(): void {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
  }
}
