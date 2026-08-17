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
 *   blocks/hides Finance and vice versa (contract point 3).
 * - ★ Codex review round 3 — a PLANNED KPI target
 *   (`initiative_kpis.target_value`) is NOT evidence a benefit was REALIZED,
 *   and reaching status DONE is not evidence either. Round 2 of this packet
 *   still wrote `target_value` into `roi_realized_values` whenever its
 *   `unit` matched the initiative's currency — semantically wrong
 *   (plan ≠ actual), fixed that round. `expected_roi` is separately never
 *   used either way (round 2, still correct): it's a free-text ROI/percentage
 *   narrative field in this schema, not currency
 *   (migration 903_expected_roi_to_text.sql; CharterBuilder.tsx's
 *   "Expected ROI (%)" label, distinct from "Business Value (PLN)").
 * - ★ Codex review round 4 — read before touching
 *   {@link findCandidateMonetaryMeasurement}: round 3 still auto-wrote
 *   `roi_realized_values` whenever an OBSERVED `kpi_time_series` measurement
 *   existed, was currency-matched, and was "recent enough" — rejected on
 *   review because recency + observation is NOT approval, and this codebase
 *   has NO formal sign-off/approval field or process for a measurement at
 *   all. Fixed this round: the Finance leg now NEVER writes
 *   `roi_realized_values` automatically and ALWAYS terminates in
 *   `NEEDS_DECISION`. {@link findCandidateMonetaryMeasurement} only surfaces
 *   a CANDIDATE (for transparency, via `finance_payload.candidateMeasurementId`
 *   and `reason: 'MEASUREMENT_REQUIRES_APPROVAL'`) — it never triggers a
 *   write. The former recency window
 *   (`MONETARY_MEASUREMENT_MAX_AGE_DAYS`) is gone as a gate entirely; the
 *   candidate's age is carried as purely informational `ageDays`. Building an
 *   actual approval/sign-off process is explicitly OUT OF SCOPE for this
 *   packet — do not add one without a Piotr/Codex decision.
 */

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import { type PgTransactionClient, withPgTransaction } from '../utils/queryHelpers.js';
import { CLOSURE_HANDOFF_SOURCE, handoffFromClosure } from './executionResultsBridge.js';
import { observeWriter } from './results/resultsWriterObservationService.js';
import { ensureRoiCaseForClosureReceipt } from './resultsVnext/roi/closureReceiptRoiCaseAdapter.js';

const LOG_PREFIX = '[ClosureDeliveryReceipt]';

function closureRoiBindingEnabled(): boolean {
  return process.env.FLOW_CLOSURE_ROI_BINDING_ENABLED === 'true';
}

export const SYSTEM_ACTOR_LABEL = 'system:exe-009-closure-receipt';

export type ResultsStatus = 'PENDING' | 'DELIVERING' | 'DELIVERED' | 'FAILED' | 'DEAD_LETTER';
export type FinanceStatus = 'PENDING' | 'DELIVERING' | 'DELIVERED' | 'FAILED' | 'NEEDS_DECISION' | 'DEAD_LETTER';

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
  payloadVersion: number;
  maxAttempts: number;
  deadLetteredAt: string | null;
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
  payload_version: number;
  max_attempts: number;
  dead_lettered_at: string | null;
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
    payloadVersion: row.payload_version,
    maxAttempts: row.max_attempts,
    deadLetteredAt: row.dead_lettered_at,
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

/** Durable repair seam for deterministic demo/materialized DONE rows that do
 * not pass through the transition transaction. The deterministic id makes
 * repeated seeding a replay, never a second closure event. */
export async function ensureReceiptForMaterializedDone(
  organizationId:string,initiativeId:string,actorId:string|null
):Promise<string>{
  const receiptId=`materialized-done:${organizationId}:${initiativeId}`;
  await queryHelpers.queryRun(
    `INSERT INTO closure_delivery_receipts
      (id,organization_id,initiative_id,transition_audit_ref,actor_id,actor_label)
     SELECT ?,i.organization_id,i.id,?,?,?
       FROM initiatives i WHERE i.id=? AND i.organization_id=? AND UPPER(i.status)='DONE'
     ON CONFLICT (id) DO NOTHING`,
    [receiptId,receiptId,actorId,SYSTEM_ACTOR_LABEL,initiativeId,organizationId]
  );
  const receipt=await getReceiptById(receiptId,organizationId);
  if(!receipt) throw new Error(`${LOG_PREFIX} materialized DONE receipt was not persisted`);
  return receiptId;
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

/**
 * Codex review round 4, BLOCKER-B: "fallback nie może być silent no-op...
 * brak rzeczywistego rekordu Results ma prowadzić do retryable
 * failure/NEEDS_DECISION, nie do fałszywego DELIVERED." Mirrors
 * `executionResultsBridge.ts`'s OWN decision logic for whether a closure
 * had anything to hand off (planned KPIs with a target, or a numeric
 * `expected_roi`) — NOT re-implementing that logic differently, just
 * checking the same precondition independently so a zero-benefit-row
 * outcome can be told apart from "genuinely nothing to hand off" (a
 * legitimate DELIVERED with an empty payload) vs. "there WAS something to
 * hand off but no benefit row exists" (a real failure — write silently
 * didn't happen, for the title-column reason just fixed or any other
 * future cause — must never be reported as DELIVERED).
 */
async function initiativeHadResultsSignal(
  initiativeId: string,
  organizationId: string
): Promise<boolean> {
  const kpiCount = await queryHelpers.queryOne<{ n: string }>(
    `SELECT COUNT(*)::int AS n FROM initiative_kpis WHERE initiative_id = ? AND target_value IS NOT NULL`,
    [initiativeId]
  );
  if (Number(kpiCount?.n ?? 0) > 0) return true;

  const initiative = await queryHelpers.queryOne<{ expected_roi: string | null }>(
    `SELECT expected_roi FROM initiatives WHERE id = ? AND organization_id = ?`,
    [initiativeId, organizationId]
  );
  const expectedRoi =
    initiative?.expected_roi !== null && initiative?.expected_roi !== undefined
      ? Number(initiative.expected_roi)
      : null;
  return expectedRoi !== null && Number.isFinite(expectedRoi) && expectedRoi !== 0;
}

interface InitiativeFinanceRow {
  budget_currency: string | null;
}

interface MonetaryMeasurementRow {
  id: string;
  value: number | string;
  period_end: string | null;
  period_start: string;
}

/**
 * Find a CANDIDATE monetary measurement for this initiative — deliberately
 * NOT reading `initiative_benefits` (the Results leg's output) and NOT
 * `initiative_kpis.target_value` (round 3's fix: a plan is not evidence a
 * benefit was realized). Round 4 (Codex review, read before touching):
 * finding a real, observed, recent `kpi_time_series` row is STILL NOT
 * evidence it was ever APPROVED as an actual — this codebase has no formal
 * approval/sign-off field or workflow for a measurement at all (confirmed by
 * a fresh discovery pass: `roi_realized_values`/`kpi_time_series` both have
 * a self-asserted `source` column with no sign-off field;
 * `v8_roi_realization_entries.verified_by`, the one column anywhere in this
 * schema with real approval semantics, is only ever written by a synthetic
 * health-check probe, never a real user flow; `initiative_benefits.actual_annual_value`
 * is declared but never written by any code path). This function therefore
 * NEVER results in an automatic write to `roi_realized_values` — it only
 * returns a CANDIDATE for the caller to surface as
 * `NEEDS_DECISION` / `MEASUREMENT_REQUIRES_APPROVAL`. Building the actual
 * approval workflow (who can approve, what UI, what audit trail) is an
 * explicit NEEDS_PRODUCT_DECISION, out of scope for this packet — not
 * silently built here.
 *
 * Returns `null` when the initiative has no explicit `budget_currency` or no
 * KPI's `unit` matches it — those cases have no candidate to even show a
 * human, not merely "unapproved".
 */
async function findCandidateMonetaryMeasurement(
  organizationId: string,
  initiativeId: string
): Promise<{
  amount: number;
  currency: string;
  valueSource: string;
  measurementId: string;
  ageDays: number;
} | null> {
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

  // Most recent measurement, across any KPI on this initiative whose unit
  // matches the initiative's currency — NO recency filter (round 4: age is
  // informational only, never a gate). A single most-recent OBSERVED value
  // — not a sum across KPIs the way targets were summed in earlier rounds:
  // an "actual" is a point-in-time fact, summing unrelated point-in-time
  // observations across different KPIs doesn't have the same clear meaning
  // a sum of planned upside lines did.
  const measurement = await queryHelpers.queryOne<MonetaryMeasurementRow>(
    `SELECT kts.id, kts.value, kts.period_end, kts.period_start
       FROM kpi_time_series kts
       JOIN initiative_kpis ik ON ik.id = kts.kpi_id
      WHERE kts.initiative_id = ?
        AND kts.organization_id = ?
        AND ik.unit = ?
      ORDER BY COALESCE(kts.period_end, kts.period_start) DESC, kts.created_at DESC
      LIMIT 1`,
    [initiativeId, organizationId, initiative.budget_currency]
  );
  if (!measurement) {
    // No currency-matched measurement at all — no candidate to show.
    return null;
  }

  const amount = Number(measurement.value);
  if (!Number.isFinite(amount)) return null;

  const periodEnd = measurement.period_end ?? measurement.period_start;
  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(periodEnd).getTime()) / (24 * 60 * 60 * 1000))
  );

  return {
    amount,
    currency: initiative.budget_currency,
    valueSource: `kpi_time_series measurement (id=${measurement.id}, period_end=${periodEnd}, unit=${initiative.budget_currency})`,
    measurementId: measurement.id,
    ageDays,
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
            (${statusCol} IN ('PENDING', 'FAILED') AND ${leg}_attempts < max_attempts)
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

  const {
    organization_id: organizationId,
    initiative_id: initiativeId,
    actor_id: actorId,
  } = receipt;

  if (Number(receipt.payload_version) !== 1) {
    await queryHelpers.queryRun(
      `UPDATE closure_delivery_receipts SET results_status='DEAD_LETTER',
         finance_status='DEAD_LETTER',dead_lettered_at=CURRENT_TIMESTAMP,
         results_last_error=?,finance_last_error=?,next_retry_at=NULL,updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [`unsupported_closure_payload_version:${receipt.payload_version}`,
       `unsupported_closure_payload_version:${receipt.payload_version}`,receiptId]
    );
    const unsupported=await queryHelpers.queryOne<ReceiptRow>(
      `SELECT * FROM closure_delivery_receipts WHERE id=?`,[receiptId]
    );
    return toReceipt(unsupported as ReceiptRow);
  }

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
        if (rows.length === 0 && (await initiativeHadResultsSignal(initiativeId, organizationId))) {
          // The initiative genuinely had planned KPIs or a valid expected_roi
          // — handoffFromClosure should have produced at least one benefit
          // row. Zero rows here means the write silently didn't happen.
          // Never report this as DELIVERED — throw so the outer catch
          // records a retryable FAILED status instead.
          throw new Error(
            'handoffFromClosure completed without throwing, but produced zero initiative_benefits ' +
              'rows despite the initiative having a planned KPI target or a valid expected_roi — ' +
              'treating as a delivery failure (silent no-op), not a false DELIVERED.'
          );
        }
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

      // Writer observability for the Execution -> Results family (side-channel;
      // never gates or alters this delivery). Placed AFTER the terminal
      // transaction commits, so an observation means "this writer really ran
      // and the leg is DELIVERED", not "an attempt started".
      //
      // Instrumented HERE, at the business call site, rather than inside
      // `executionResultsBridge.handoffFromClosure`: `healthProbeService.ts`
      // calls that same bridge function twice per probe run, and probe traffic
      // must never be counted as real Execution -> Results usage. This call
      // site is business traffic by construction, so the probe stays
      // uninstrumented without needing a suppression flag.
      //
      // `receiptId` is the correlation identity: a retried delivery of the same
      // receipt leg is the same logical operation and dedupes to one row via
      // uq_results_writer_observation_correlated_op.
      observeWriter({
        organizationId,
        actorUserId: actorId ?? null,
        writerFamily: 'execution_results',
        operation: 'closureHandoff',
        endpoint: 'service:closureDeliveryReceiptService.deliver#results',
        correlationId: receiptId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`${LOG_PREFIX} Results delivery failed for receipt ${receiptId}: ${message}`);
      await queryHelpers.queryRun(
        `UPDATE closure_delivery_receipts
            SET results_status = CASE WHEN results_attempts + 1 >= max_attempts THEN 'DEAD_LETTER' ELSE 'FAILED' END,
                results_attempts = results_attempts + 1,
                results_last_error = ?,
                dead_lettered_at = CASE WHEN results_attempts + 1 >= max_attempts THEN CURRENT_TIMESTAMP ELSE dead_lettered_at END,
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
      // Codex review round 4: this codebase has no approval/sign-off process
      // for a measurement at all, so an OBSERVED `kpi_time_series` row is
      // never sufficient by itself to book a realization — no matter how
      // recent or currency-matched. The Finance leg therefore NEVER writes
      // `roi_realized_values` here and ALWAYS terminates in NEEDS_DECISION.
      // A candidate measurement (if any) is surfaced only for transparency,
      // via `candidateMeasurementId` + `reason: 'MEASUREMENT_REQUIRES_APPROVAL'`,
      // so a human can review and record it through the existing manual
      // "Record Realization" flow if they approve it.
      const candidate = await findCandidateMonetaryMeasurement(organizationId, initiativeId);
      const payload = candidate
        ? {
            reason: 'MEASUREMENT_REQUIRES_APPROVAL',
            candidateMeasurementId: candidate.measurementId,
            candidateAmount: candidate.amount,
            candidateCurrency: candidate.currency,
            candidateAgeDays: candidate.ageDays,
            candidateValueSource: candidate.valueSource,
          }
        : { reason: 'NO_MONETARY_MEASUREMENT' };
      const message = candidate
        ? "An observed kpi_time_series measurement exists (currency-matched to the initiative's " +
          `budget_currency; id=${candidate.measurementId}) but this codebase has no approval/sign-off ` +
          'process for a measurement — it is surfaced as a candidate only, never auto-booked as a ' +
          'realized actual. Needs an explicit human decision (via the existing manual Record ' +
          'Realization flow) before roi_realized_values is written.'
        : 'No candidate monetary measurement: initiative has no budget_currency, no KPI whose unit ' +
          'matches it, or no matching kpi_time_series measurement at all. A planned KPI target or ' +
          'expected_roi is NEVER used as a substitute — closure/DONE is not evidence a benefit was ' +
          'realized. Needs an explicit product decision on an approved-actual source.';
      await queryHelpers.queryRun(
        `UPDATE closure_delivery_receipts
            SET finance_status = 'NEEDS_DECISION',
                finance_last_error = ?,
                finance_payload = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [message, JSON.stringify(payload), receiptId]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`${LOG_PREFIX} Finance delivery failed for receipt ${receiptId}: ${message}`);
      await queryHelpers.queryRun(
        `UPDATE closure_delivery_receipts
            SET finance_status = CASE WHEN finance_attempts + 1 >= max_attempts THEN 'DEAD_LETTER' ELSE 'FAILED' END,
                finance_attempts = finance_attempts + 1,
                finance_last_error = ?,
                dead_lettered_at = CASE WHEN finance_attempts + 1 >= max_attempts THEN CURRENT_TIMESTAMP ELSE dead_lettered_at END,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [message, receiptId]
      );
    }
  }

  // The closure row is itself the durable repair cursor. If ROI-case binding
  // fails after the primary Results/Finance outcomes committed, neither
  // outcome is rewritten: next_retry_at makes the reconciliation sweep retry
  // only the missing idempotent binding.
  if (closureRoiBindingEnabled()) {
    try {
      const binding = await ensureRoiCaseForClosureReceipt({ organizationId, receiptId });
      await queryHelpers.queryRun(
        `UPDATE closure_delivery_receipts
            SET finance_payload = COALESCE(finance_payload, '{}'::jsonb) || ?::jsonb,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND organization_id = ?`,
        [JSON.stringify({ roiCaseId: binding.result.case.caseId }), receiptId, organizationId]
      );
    } catch (err) {
      logger.warn(`${LOG_PREFIX} ROI case binding deferred for receipt ${receiptId}`, {
        message: err instanceof Error ? err.message : String(err),
      });
      await queryHelpers.queryRun(
        `UPDATE closure_delivery_receipts
            SET next_retry_at = COALESCE(next_retry_at, CURRENT_TIMESTAMP),
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND organization_id = ?`,
        [receiptId, organizationId]
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
    result.financeStatus === 'FAILED' ||
    (closureRoiBindingEnabled() && typeof result.financePayload?.roiCaseId !== 'string');
  const nextRetryAt = stillPending
    ? new Date(
        Date.now() + backoffMs(Math.max(result.resultsAttempts, result.financeAttempts))
      ).toISOString()
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
    throw new Error(
      `${LOG_PREFIX} retryDeliveryForOrg: no receipt ${receiptId} in organization ${organizationId}`
    );
  }
  await queryHelpers.queryRun(
    `UPDATE closure_delivery_receipts SET next_retry_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [receiptId]
  );
  return attemptDeliveryInternal(receiptId);
}

export async function redriveDeadLetterForOrg(
  receiptId: string,
  organizationId: string
): Promise<ClosureDeliveryReceipt> {
  const existing = await getReceiptById(receiptId, organizationId);
  if (!existing) throw new Error(`${LOG_PREFIX} redrive: receipt not found`);
  await queryHelpers.queryRun(
    `UPDATE closure_delivery_receipts SET
       results_status=CASE WHEN results_status='DEAD_LETTER' THEN 'PENDING' ELSE results_status END,
       finance_status=CASE WHEN finance_status='DEAD_LETTER' THEN 'PENDING' ELSE finance_status END,
       results_attempts=CASE WHEN results_status='DEAD_LETTER' THEN 0 ELSE results_attempts END,
       finance_attempts=CASE WHEN finance_status='DEAD_LETTER' THEN 0 ELSE finance_attempts END,
       dead_lettered_at=NULL,next_retry_at=NULL,updated_at=CURRENT_TIMESTAMP
     WHERE id=? AND organization_id=? AND (results_status='DEAD_LETTER' OR finance_status='DEAD_LETTER')`,
    [receiptId,organizationId]
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
          (results_status IN ('PENDING', 'FAILED') AND results_attempts < max_attempts)
          OR (finance_status IN ('PENDING', 'FAILED') AND finance_attempts < max_attempts)
          OR (results_status = 'DELIVERING' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '${STALE_DELIVERING_LEASE_MINUTES} minutes')
          OR (finance_status = 'DELIVERING' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '${STALE_DELIVERING_LEASE_MINUTES} minutes')
          OR (? = 1 AND finance_payload->>'roiCaseId' IS NULL)
        )
          AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)
        ORDER BY created_at ASC
        LIMIT ?
        FOR UPDATE SKIP LOCKED`,
      [closureRoiBindingEnabled() ? 1 : 0, limit]
    );
    const ids = rows.map((r) => r.id);
    if (ids.length > 0) {
      const leaseUntil = new Date(Date.now() + 60_000).toISOString();
      await client.query(
        `UPDATE closure_delivery_receipts SET next_retry_at = ? WHERE id = ANY(?)`,
        [leaseUntil, ids]
      );
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
        (result.resultsStatus === 'DELIVERED' || result.resultsStatus === 'DEAD_LETTER') &&
        (result.financeStatus === 'DELIVERED' ||
          result.financeStatus === 'NEEDS_DECISION' ||
          result.financeStatus === 'DEAD_LETTER');
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
      logger.error(
        `${LOG_PREFIX} reconciliation cron tick failed: ${err instanceof Error ? err.message : err}`
      );
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
