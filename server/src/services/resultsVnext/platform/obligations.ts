/**
 * Platform-owned obligations (KPI-E003 decision #5).
 *
 * Design: docs/product/results-vnext/KPI_E003_DESIGN.md §A (schema) / §C
 * (MyWork integration). Built now, in the platform layer rather than under
 * `kpi/`, because OKR (check-in-due) and ROI (PIR-due) will need the
 * identical "assignee has a one-shot or recurring obligation tied to an
 * aggregate, completed by the same domain command the UI calls" mechanism —
 * building it once here avoids the exact fragmentation (5 ROI systems, 4 KPI
 * tables, EXECUTION_LEDGER.md §3.7/§3.8) this program exists to fix.
 *
 * Schema: server/migrations/20260811_rvn_platform_obligations.sql.
 *
 * Every function here takes a caller-supplied `PoolClient` and does no
 * BEGIN/COMMIT of its own — obligations are always created/completed INSIDE
 * a domain command's own transaction (§C: "Created inline in the same
 * transaction as `openOrEscalateDeviationCase`", "completes the obligation
 * in the same transaction" as `submitRootCause`), never as a standalone
 * atomic-write call of their own. This mirrors how `openOrEscalateDeviationCase`
 * itself takes a `PoolClient` rather than acquiring one.
 *
 * `createObligation` is idempotent via `ON CONFLICT (organization_id,
 * deduplication_key) DO NOTHING` — a caller that races (e.g. two concurrent
 * critical measurements both trying to open the same KPI's "explain
 * deviation" obligation) gets `null` back on the losing side rather than a
 * duplicate row or a thrown error, so domain callers do not need their own
 * pre-check.
 */
import type { PoolClient } from 'pg';

import { toObligation, type Obligation, type ObligationRow } from '../kpi/kpiDeviationTypes.js';

// ==========================================
// createObligation
// ==========================================

export interface CreateObligationParams {
  organizationId: string;
  assigneeUserId: string;
  referenceType: string;
  referenceId: string;
  /** The referenced aggregate's own optimistic-concurrency version at the
   * moment this obligation was created — lets a future consumer detect that
   * the aggregate moved on without this obligation being explicitly
   * superseded (not enforced by this function itself). */
  aggregateVersionAtCreation: number;
  obligationType: string;
  dueAt?: string | null;
  /**
   * No source is defined anywhere in KPI_E003_DESIGN.md for what this value
   * should be for the one obligation type this package actually creates
   * (`explain_warning_critical_deviation`) — the column exists for a future
   * caller that DOES have a versioned policy driving the obligation's
   * cadence/terms. Left optional, defaulting to `null` (the column is
   * nullable) rather than fabricating a value; a caller that has one should
   * pass it.
   */
  policyVersionId?: string | null;
  /** `null` for a one-shot obligation (design §C: "cadence_occurrence_id =
   * NULL -- one-shot, not a recurring check-in"). */
  cadenceOccurrenceId?: string | null;
  deduplicationKey: string;
}

/**
 * Returns the newly created `Obligation`, or `null` if an obligation with
 * this exact `(organizationId, deduplicationKey)` already existed (the
 * `ON CONFLICT ... DO NOTHING` fired) — the caller decides whether that is
 * an error or an expected idempotent no-op; this function never re-SELECTs
 * the existing row on the caller's behalf (unlike `executeAtomicCreate`'s
 * idempotency-key handling, which reconstructs and RETURNS the prior
 * result) because an obligation, unlike an event, is not itself the
 * durable record of "this command already ran" — the caller's own
 * idempotency key on ITS OWN command already answers that question.
 */
export async function createObligation(
  client: PoolClient,
  params: CreateObligationParams
): Promise<Obligation | null> {
  const {
    organizationId,
    assigneeUserId,
    referenceType,
    referenceId,
    aggregateVersionAtCreation,
    obligationType,
    dueAt = null,
    policyVersionId = null,
    cadenceOccurrenceId = null,
    deduplicationKey,
  } = params;

  const result = await client.query<ObligationRow>(
    `INSERT INTO rvn_platform_obligations
       (organization_id, assignee_user_id, reference_type, reference_id,
        aggregate_version_at_creation, obligation_type, due_at, policy_version_id,
        cadence_occurrence_id, deduplication_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (organization_id, deduplication_key) DO NOTHING
     RETURNING *`,
    [
      organizationId,
      assigneeUserId,
      referenceType,
      referenceId,
      aggregateVersionAtCreation,
      obligationType,
      dueAt,
      policyVersionId,
      cadenceOccurrenceId,
      deduplicationKey,
    ]
  );
  const row = result.rows[0];
  return row ? toObligation(row) : null;
}

// ==========================================
// completeObligation
// ==========================================

export interface CompleteObligationParams {
  organizationId: string;
  referenceType: string;
  referenceId: string;
  obligationType: string;
  /** Design §C: `completed_via_command = 'submitRootCause'` — the name of
   * the domain command whose successful transition completed this
   * obligation, for audit/debugging (not a foreign key to anything). */
  completedViaCommand: string;
  /**
   * OKR-E004 addition (IO-6: additive, backward-compatible — omitted by
   * every existing KPI-E003/ROI caller, so their behavior is byte-for-byte
   * unchanged). Without this filter, `(organizationId, referenceType,
   * referenceId, obligationType, status='open')` is NOT guaranteed unique:
   * a single Key Result can have more than one open `check_in` obligation
   * open at once (one per missed cadence window — see
   * `okrCheckInScheduler.ts`'s `detectAndFlagMissedCheckIns`), so a plain
   * `recordCheckIn` completion for THIS window's obligation would otherwise
   * also complete an unrelated still-open obligation for a DIFFERENT
   * window on the same KR (the `UPDATE` has no `LIMIT` and matches every
   * row satisfying the WHERE clause). Passing this narrows the WHERE to the
   * exact occurrence the caller is completing.
   */
  cadenceOccurrenceId?: string | null;
}

/**
 * Design §C's literal SQL, parameterized: only completes an `'open'`
 * obligation matching the reference/type — a second call (e.g. a retried
 * command) matches zero rows and returns `null`, which is the expected,
 * harmless idempotent outcome, not an error.
 */
export async function completeObligation(
  client: PoolClient,
  params: CompleteObligationParams
): Promise<Obligation | null> {
  const { organizationId, referenceType, referenceId, obligationType, completedViaCommand, cadenceOccurrenceId } = params;

  const result = await client.query<ObligationRow>(
    `UPDATE rvn_platform_obligations
        SET status = 'completed', completed_at = now(), completed_via_command = $5,
            row_version = row_version + 1, updated_at = now()
      WHERE organization_id = $1 AND reference_type = $2 AND reference_id = $3
        AND obligation_type = $4 AND status = 'open'
        AND ($6::text IS NULL OR cadence_occurrence_id = $6::text)
      RETURNING *`,
    [organizationId, referenceType, referenceId, obligationType, completedViaCommand, cadenceOccurrenceId ?? null]
  );
  const row = result.rows[0];
  return row ? toObligation(row) : null;
}

// ==========================================
// attachSourceEventId
// ==========================================

export interface AttachSourceEventIdParams {
  organizationId: string;
  obligationId: string;
  eventId: string;
}

/**
 * Second-step pattern per the migration's own column comment
 * (`rvn_platform_obligations.source_event_id`): `buildEvent()` only knows
 * the real `event_id` AFTER `applyMutation` returns and the platform's
 * `executeAtomicCommand`/`executeAtomicCreate` has actually inserted the
 * `rvn_platform_events` row — so a caller whose obligation was created
 * inside an `applyMutation` that itself runs before that insert cannot
 * populate `source_event_id` inline. This function is that caller's
 * follow-up write.
 *
 * NOTE for THIS package's own caller (`openOrEscalateDeviationCase`): that
 * function does NOT go through `executeAtomicCommand`/`executeAtomicCreate`
 * itself (design decision #3 — it runs inside the OUTER
 * `recordMeasurement`/`correctMeasurement` transaction, on that transaction's
 * own pinned client) and manually inserts its own `kpi.deviation_opened`
 * `rvn_platform_events` row with an explicit `RETURNING event_id` — so it
 * already has a real `event_id` synchronously, in the SAME transaction as
 * the obligation `INSERT`, and does not need this second step; see
 * `kpiDeviationCommands.ts`. This function exists for a future obligation
 * creator whose triggering event genuinely is only known post-commit (e.g.
 * an obligation created by a plain `executeAtomicCommand` caller reading its
 * own `outcome.eventId`).
 */
export async function attachSourceEventId(
  client: PoolClient,
  params: AttachSourceEventIdParams
): Promise<void> {
  const { organizationId, obligationId, eventId } = params;
  await client.query(
    `UPDATE rvn_platform_obligations
        SET source_event_id = $1, updated_at = now()
      WHERE obligation_id = $2 AND organization_id = $3`,
    [eventId, obligationId, organizationId]
  );
}
