/**
 * EXE-09 — durable Execution-closure → Results/Finance delivery receipt.
 *
 * Replaces the fire-and-forget-only handoff in `executionResultsBridge.ts`
 * (`fireClosureHandoff`, `.catch(logger.warn)` and forget) with a durable row
 * (migration 935_exe009_closure_delivery_receipt.sql,
 * `closure_delivery_receipts`) written INSIDE the same transaction as the
 * initiative's DONE transition (`initiativeTransitionService.ts` — the only
 * caller of {@link createReceiptOnClosure}), plus a worker/reconciliation
 * sweep ({@link runReconciliationSweep}) that retries delivery until it lands.
 *
 * Results and Finance are two INDEPENDENT legs (separate status columns,
 * separate downstream writers, separate failure isolation):
 *
 * - Results leg calls the existing, already-idempotent
 *   `executionResultsBridge.handoffFromClosure` (dedup via migration 783's
 *   partial unique index on `initiative_benefits`), then reads back the
 *   actual benefit row ids so a RETRIED attempt reports the same downstream
 *   ids rather than only whatever the first attempt saw.
 * - Finance leg (Codex review round 2, BLOCKER1/BLOCKER2 — read before
 *   touching): does NOT write to any new/isolated table. Round 1 of this
 *   packet built a standalone `closure_finance_actuals` table that nothing
 *   in the actual Finance module read — rejected on review as "a table
 *   named finance isn't the same as delivering to Finance." A fresh
 *   inventory (this round) found the Finance module has NO db-backed read of
 *   initiative-level actuals at all; the one real, UI-rendered,
 *   organization+initiative-scoped realization table in this codebase is
 *   `roi_realized_values` (read by `src/components/Benefits/ROITrackingPanel.tsx`
 *   via `GET /benefits/roi/portfolio/summary`), owned by
 *   `executionRealizationService.recordExecutionRealization` — this is the
 *   SAME table/function a human uses today via Execution's "Record
 *   Realization" form. This leg now calls that EXACT canonical function
 *   (migration 937 adds an optional, additive `closure_receipt_id` dedup key
 *   to it — the existing human-entry call site is untouched and unaffected).
 * - The value itself is computed INDEPENDENTLY of the Results leg's output
 *   (not read from `initiative_benefits`) so a Results-leg failure never
 *   blocks/hides Finance and vice versa (contract point 3). `expected_roi` is
 *   NEVER used as a monetary amount (Codex review BLOCKER2 — confirmed by
 *   direct investigation that `expected_roi` is a free-text ROI/percentage
 *   narrative field in this schema, not currency; see migration
 *   903_expected_roi_to_text.sql's own header and CharterBuilder.tsx's
 *   "Expected ROI (%)" label, a DIFFERENT field from "Business Value (PLN)").
 *   The ONLY signal used is a planned KPI whose `unit` column is LITERALLY
 *   the initiative's own `budget_currency` code — anything else (KPI in %,
 *   days, count; no currency on the initiative; no matching KPI at all)
 *   yields NEEDS_DECISION, never a fabricated value. Investigation confirmed
 *   no seed/demo data currently sets a currency-valued KPI unit, so
 *   NEEDS_DECISION is the expected, correct outcome for most real closures
 *   today — that is honest, not a bug.
 */

import * as queryHelpers from '../utils/queryHelpers.js';
import { withPgTransaction, type PgTransactionClient } from '../utils/queryHelpers.js';
import logger from '../utils/Logger.js';
import { handoffFromClosure, CLOSURE_HANDOFF_SOURCE } from './executionResultsBridge.js';
import { recordExecutionRealization } from './executionRealizationService.js';

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
 * concern, handled by {@link attemptDeliveryInternal}).
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
}

interface PlannedKpiTargetRow {
  target_value: number | string;
}

/**
 * Independently compute the monetary realization amount/currency for this
 * initiative — deliberately NOT reading `initiative_benefits` (the Results
 * leg's output), so a Results-leg failure this attempt cannot block Finance
 * delivery. Returns `null` when the amount or currency cannot be determined
 * unambiguously — the caller must treat that as NEEDS_DECISION, never
 * substitute a default.
 *
 * `expected_roi` is NEVER used here (Codex review BLOCKER2, round 2). It is a
 * free-text ROI/percentage narrative field in this schema (migration
 * 903_expected_roi_to_text.sql: the AI hydration path writes strings like
 * "ROI 200%" / "44% (zysk netto ÷ nakład), payback 14 mies"; the UI labels
 * the SAME field "Expected ROI (%)" — `CharterBuilder.tsx` — as a field
 * distinct from "Business Value (PLN)"), never a currency amount. Turning a
 * percentage into a currency figure was a real domain-invalid bug in round 1
 * of this packet, now removed entirely — there is no fallback path anymore.
 *
 * The ONLY signal used: a planned KPI whose `unit` column is LITERALLY the
 * initiative's own `budget_currency` code. This is a real, if currently rare,
 * signal (investigation found no seed/demo data sets a currency-valued KPI
 * unit today, so NEEDS_DECISION is the expected, correct outcome for most
 * real closures until a product decision creates a genuine "monetary target"
 * field/contract) — not a heuristic dressed up as a mapping.
 */
async function computeMonetaryRealization(
  organizationId: string,
  initiativeId: string
): Promise<{ amount: number; currency: string; valueSource: string } | null> {
  const initiative = await queryHelpers.queryOne<InitiativeFinanceRow>(
    `SELECT budget_currency FROM initiatives WHERE id = ? AND organization_id = ?`,
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
    `SELECT target_value FROM initiative_kpis
      WHERE initiative_id = ? AND target_value IS NOT NULL AND unit = ?`,
    [initiativeId, initiative.budget_currency]
  );
  if (kpiTargets.length === 0) {
    // No currency-matched KPI target — nothing to hand off. Mapping gap, not
    // a silent zero: NEEDS_DECISION.
    return null;
  }

  const amount = kpiTargets.reduce((sum, row) => sum + Number(row.target_value), 0);
  if (!Number.isFinite(amount)) return null;

  // A real match, including a legitimate sum of exactly 0 — that IS the
  // answer, not "no answer".
  return {
    amount,
    currency: initiative.budget_currency,
    valueSource: `initiative_kpis.target_value (sum, unit=${initiative.budget_currency}) + initiatives.budget_currency`,
  };
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
 * Atomically claim one leg for processing: flips PENDING/FAILED -> DELIVERING
 * in a single `UPDATE ... WHERE <col> IN (...)` statement. A single UPDATE is
 * atomic per-row in Postgres regardless of any surrounding transaction, so
 * when two callers race (the post-commit immediate-delivery trigger, the
 * operator-triggered manual retry route, and the cron reconciliation sweep
 * all call {@link attemptDeliveryInternal} independently, with NO shared lock between
 * them), at most one UPDATE affects a row — the loser's `changes` is 0 and it
 * skips this leg for this call, instead of both racing straight into
 * `handoffFromClosure`/the Finance write concurrently. This is the fix for a
 * real gap found in adversarial review: without this claim, two concurrent
 * callers could both pass `handoffFromClosure`'s own SELECT-then-INSERT dedup
 * check for the no-KPI `expected_roi` fallback benefit (that path has no DB
 * unique index — see migration 936) and both INSERT, producing two
 * `initiative_benefits` rows for one closure.
 */
/**
 * A leg claimed but never resolved (process killed between the claim and the
 * terminal UPDATE, below) would otherwise sit in DELIVERING forever — nothing
 * else in this file ever moves a row OUT of DELIVERING except the same
 * attempt that put it there. Treating a DELIVERING leg as reclaimable once
 * it's older than this is the standard stale-lease-reclaim pattern for an
 * outbox worker; ordinary attempts here are fast in-process DB calls, so this
 * is a wide margin, not a tight race with a still-genuinely-running attempt.
 */
const STALE_DELIVERING_LEASE_MINUTES = 5;

async function claimLeg(receiptId: string, leg: 'results' | 'finance'): Promise<boolean> {
  const statusCol = leg === 'results' ? 'results_status' : 'finance_status';
  // Deliberately `withPgTransaction` (a dedicated, pinned `pg.Client`), NOT
  // `queryHelpers.queryRun` (the shared connection POOL) — this codebase has
  // a documented, previously-hit-in-production footgun where an affected-row
  // count reported through the pool's callback-style shim can be misattributed
  // under concurrent overlapping calls (see queryHelpers.ts's own comment on
  // `withPgTransaction`, "recordsMigrated=N reported but 0 rows actually
  // landed"). This claim is exactly the kind of concurrent, correctness
  // -critical single statement that footgun applies to — verified empirically
  // during EXE-09 review that using the pool here produced intermittent,
  // timing-dependent false claim results; the pinned connection did not.
  return withPgTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE closure_delivery_receipts
          SET ${statusCol} = 'DELIVERING', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND (
            ${statusCol} IN ('PENDING', 'FAILED')
            OR (${statusCol} = 'DELIVERING' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '${STALE_DELIVERING_LEASE_MINUTES} minutes')
          )`,
      [receiptId]
    );
    return rowCount > 0;
  });
}

/**
 * Attempt (or retry) delivery of both legs for one receipt.
 *
 * ★ INTERNAL / worker-owned API (Codex review round 2, BLOCKER4) — this
 * function trusts its `receiptId` argument completely and does NOT check
 * organization ownership. That is correct for its three legitimate callers
 * (the post-commit immediate-delivery trigger, which only ever has a
 * `receiptId` it JUST minted inside the SAME transaction as the closure
 * itself; the cron reconciliation sweep, which is a system-wide worker BY
 * DESIGN and operates across all tenants; and {@link retryDeliveryForOrg},
 * which performs the org check itself BEFORE calling this). It is NOT safe
 * to expose to a user-facing/HTTP-adjacent code path directly — a future
 * caller wiring a client-supplied id straight into this function would
 * silently cross tenants. If you need an org-checked entry point, use
 * {@link retryDeliveryForOrg}, never this function directly.
 *
 * Safe to call concurrently / repeatedly for the same receipt — see
 * {@link claimLeg}: each leg only does real work in the ONE call that wins
 * the atomic claim; every other concurrent caller sees its claim fail and
 * leaves that leg alone this round (it stays exactly as it was, to be picked
 * up again on the very next attempt). Never throws for an ordinary
 * downstream failure — the failure is recorded on the row and observable via
 * {@link getReceiptById}; it only throws if the receipt itself does not
 * exist.
 */
export async function attemptDeliveryInternal(
  receiptId: string,
  opts: AttemptDeliveryOptions = {}
): Promise<ClosureDeliveryReceipt> {
  const receipt = await queryHelpers.queryOne<ReceiptRow>(
    `SELECT * FROM closure_delivery_receipts WHERE id = ?`,
    [receiptId]
  );
  if (!receipt) {
    throw new Error(`${LOG_PREFIX} attemptDeliveryInternal: no receipt found for id ${receiptId}`);
  }

  const { organization_id: organizationId, initiative_id: initiativeId, actor_id: actorId } = receipt;

  // ---- Results leg ----
  if (receipt.results_status !== 'DELIVERED' && (await claimLeg(receiptId, 'results'))) {
    try {
      if (opts.__testForceResultsError) throw opts.__testForceResultsError;
      await handoffFromClosure(organizationId, initiativeId, actorId);
      // Read-back + terminal UPDATE on a DEDICATED pinned connection, NOT the
      // shared pool (queryHelpers.queryAll/queryRun) — same fix, same reason,
      // as claimLeg: this codebase has a documented footgun where a query
      // issued right after a write can land on a different pool connection
      // than the one that just committed, and a read can observe a state
      // predating the write. Verified empirically under this exact
      // concurrent-delivery scenario: reading `initiative_benefits` via the
      // pool immediately after `handoffFromClosure` intermittently returned
      // zero rows even though the insert had genuinely committed (confirmed
      // via a separate, later query) — reading via a pinned connection
      // eliminated it across repeated runs.
      await withPgTransaction(async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM initiative_benefits WHERE initiative_id = ? AND source_tag = ?`,
          [initiativeId, CLOSURE_HANDOFF_SOURCE]
        );
        await client.query(
          `UPDATE closure_delivery_receipts
              SET results_status = 'DELIVERED',
                  results_attempts = results_attempts + 1,
                  results_last_error = NULL,
                  results_delivered_at = CURRENT_TIMESTAMP,
                  results_payload = ?,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [JSON.stringify({ benefitIds: rows.map((r) => r.id) }), receiptId]
        );
      });
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
  // DELIVERED and NEEDS_DECISION are the only true terminal states (the
  // latter requires a human product decision, never auto-retried); DELIVERING
  // is included here so a STALE (crashed mid-attempt) lease can still be
  // reclaimed by claimLeg's own staleness check — a fresh/still-in-flight
  // DELIVERING simply fails the claim and is skipped, same as any other race.
  if (
    receipt.finance_status !== 'DELIVERED' &&
    receipt.finance_status !== 'NEEDS_DECISION' &&
    (await claimLeg(receiptId, 'finance'))
  ) {
    try {
      if (opts.__testForceFinanceError) throw opts.__testForceFinanceError;
      const value = await computeMonetaryRealization(organizationId, initiativeId);
      if (!value) {
        await queryHelpers.queryRun(
          `UPDATE closure_delivery_receipts
              SET finance_status = 'NEEDS_DECISION',
                  finance_last_error = ?,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [
            'No unambiguous financial target: initiative has no budget_currency, or no planned ' +
              'KPI whose unit matches that currency. Needs an explicit product decision on value ' +
              'mapping — never fabricated from expected_roi (a percentage field, not currency).',
            receiptId,
          ]
        );
      } else {
        // Idempotency: `closureReceiptId` is the dedup key (migration 937's
        // partial unique index on roi_realized_values.closure_receipt_id) —
        // NOT the id `recordExecutionRealization` returns. `dbRun` (this
        // canonical service's own persistence helper) defaults to swallowing
        // errors including a unique-violation, so a retried call could
        // report a locally-generated id that was never actually persisted.
        // Always re-read the row keyed by closure_receipt_id afterward — the
        // authoritative id, whether from THIS call or an earlier one.
        const periodMonth = new Date(receipt.created_at);
        const periodMonthIso = `${periodMonth.getUTCFullYear()}-${String(periodMonth.getUTCMonth() + 1).padStart(2, '0')}-01`;
        await recordExecutionRealization({
          organizationId,
          initiativeId,
          periodMonth: periodMonthIso,
          realizedRevenueDelta: value.amount,
          varianceNotes:
            `EXE-09 closure-triggered realization — source: ${value.valueSource}, ` +
            `currency: ${value.currency} (informational; roi_realized_values has no currency column).`,
          recordedBy: actorId ?? SYSTEM_ACTOR_LABEL,
          closureReceiptId: receiptId,
        });
        // Read-back + terminal UPDATE on a DEDICATED pinned connection, NOT
        // the shared pool — same fix/reason as the Results leg above.
        await withPgTransaction(async (client) => {
          const { rows } = await client.query<{ id: string }>(
            `SELECT id FROM roi_realized_values WHERE closure_receipt_id = ?`,
            [receiptId]
          );
          const persisted = rows[0];
          if (!persisted) {
            throw new Error(
              'recordExecutionRealization completed but no roi_realized_values row was found for this ' +
                'closure_receipt_id — cannot confirm a canonical downstream id was actually persisted.'
            );
          }
          await client.query(
            `UPDATE closure_delivery_receipts
                SET finance_status = 'DELIVERED',
                    finance_attempts = finance_attempts + 1,
                    finance_last_error = NULL,
                    finance_delivered_at = CURRENT_TIMESTAMP,
                    finance_payload = ?,
                    updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
            [JSON.stringify({ realizationId: persisted.id }), receiptId]
          );
        });
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
  void attemptDeliveryInternal(receiptId).catch((err) => {
    logger.warn(
      `${LOG_PREFIX} immediate delivery attempt failed for receipt ${receiptId} (reconciliation ` +
        `sweep will retry): ${err instanceof Error ? err.message : String(err)}`
    );
  });
}

/**
 * ★ USER-FACING / org-checked entry point (Codex review round 2, BLOCKER4) —
 * the ONLY safe way to trigger a retry from an HTTP route or any other
 * caller acting on behalf of a specific tenant. ALWAYS verifies the receipt
 * belongs to `organizationId` BEFORE doing anything else — a receipt id from
 * a foreign organization resolves to "not found" here exactly like it does
 * everywhere else in this codebase's initiative/closure surface, never a
 * cross-tenant retry. Callers still need their OWN role/capability check
 * before calling this (this function only proves tenant ownership, not
 * "is this actor allowed to act on this initiative's closure" — see
 * `initiativeClosure.routes.ts`'s retry route, which calls
 * `assertActorCanApprove` first, reusing the exact same gate `/approve`
 * uses).
 *
 * Clears the backoff wait so the very next sweep tick (or this call itself)
 * reprocesses the receipt immediately. Safe for any receipt state — a
 * receipt with both legs already DELIVERED/NEEDS_DECISION simply does
 * nothing on the next attempt (idempotent).
 */
export async function retryDeliveryForOrg(
  receiptId: string,
  organizationId: string
): Promise<ClosureDeliveryReceipt> {
  const existing = await getReceiptById(receiptId, organizationId);
  if (!existing) {
    throw new Error(`${LOG_PREFIX} retryDeliveryForOrg: no receipt ${receiptId} in organization ${organizationId}`);
  }
  await queryHelpers.queryRun(
    `UPDATE closure_delivery_receipts SET next_retry_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [receiptId]
  );
  return attemptDeliveryInternal(receiptId);
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
    // Also picks up a leg STUCK in DELIVERING past the stale-lease window
    // (see claimLeg) — otherwise the sweep would never even look at a row a
    // crashed attempt left mid-flight, regardless of claimLeg's own ability
    // to reclaim it once selected.
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM closure_delivery_receipts
        WHERE (
          results_status IN ('PENDING', 'FAILED')
          OR finance_status IN ('PENDING', 'FAILED')
          OR (results_status = 'DELIVERING' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '${STALE_DELIVERING_LEASE_MINUTES} minutes')
          OR (finance_status = 'DELIVERING' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '${STALE_DELIVERING_LEASE_MINUTES} minutes')
        )
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
      const result = await attemptDeliveryInternal(id);
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
