/**
 * RN-G1 Platform Foundation — generic atomic-command write helper.
 *
 * Design: docs/product/results-vnext/RN_G1_PLATFORM_DESIGN.md §A.4.
 * Schema: server/migrations/20260809_rvn_platform_events_outbox.sql.
 *
 * This is the ONE place that implements the CAS + event-log + outbox write
 * pattern (§A.4). It is intentionally generic — not hardcoded to any one
 * aggregate table — because the domains this program exists to unify
 * (KPI/ROI/OKR, none of which exist yet as of this file) will all call the
 * SAME `executeAtomicCommand` with their own `loadForUpdate`/`applyMutation`/
 * `buildEvent` rather than each hand-rolling their own
 * BEGIN/SELECT FOR UPDATE/UPDATE/INSERT/COMMIT sequence. That per-domain
 * hand-rolling is exactly the pattern that produced 5 parallel ROI systems
 * and 4 KPI tables (see EXECUTION_LEDGER.md §3.7/§3.8) — this helper exists
 * so a future domain literally cannot skip the event/outbox write without
 * also skipping the aggregate write.
 *
 * DB access pattern (pinned `PoolClient`, explicit BEGIN/COMMIT-or-ROLLBACK,
 * `finally` release) and the STALE_VERSION error shape are copied verbatim
 * from `decisionCollaborationService.ts` (`finalizeDecisionTransition`,
 * lines ~809-940 / `DecisionConflictError`) — see that file's own doc
 * comment on `acquirePgClient()` in `PostgresDatabase.ts` for why
 * `pool.query()` per call does NOT give atomicity here.
 *
 * Status: NOT_IMPLEMENTED as a wired dependency — no controller/repository
 * calls this yet (see README.md in this directory). This file implements
 * the §A.4 algorithm literally so the shape is locked in for the first real
 * caller (a future KPI/ROI/OKR domain service).
 */
import type { PoolClient } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import logger from '../../../utils/Logger.js';

import type { PlatformEventEnvelope } from './eventEnvelope.js';

// ==========================================
// ERRORS
// ==========================================

/**
 * Optimistic-concurrency conflict. Shape (message/code/details) copied
 * verbatim from `DecisionConflictError` in `decisionCollaborationService.ts`
 * so callers/controllers that already know how to map that error class to an
 * HTTP 409 can handle this one identically (design §A.4: "typed 409
 * STALE_VERSION").
 */
export class AtomicWriteConflictError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AtomicWriteConflictError';
    this.code = code;
    this.details = details;
  }
}

/**
 * `loadForUpdate` found no row for (aggregateId, organizationId). Not named
 * in design §A.4 explicitly (the design assumes the row exists), but a
 * generic reusable helper cannot assume that — this mirrors
 * `DecisionNotFoundError`'s role in the reference implementation.
 */
export class AtomicWriteAggregateNotFoundError extends Error {
  constructor(message = 'Aggregate not found') {
    super(message);
    this.name = 'AtomicWriteAggregateNotFoundError';
  }
}

// ==========================================
// CONSUMER GROUP ROUTING (design §A.4 / decyzja #4, EXECUTION_LEDGER §7)
// ==========================================

/**
 * Static `event_type -> consumer_group[]` map (decyzja #4: code, not a
 * table — "mniej ruchomych części na start"). Placeholder entries only: no
 * KPI/ROI/OKR domain service exists yet to emit these event_types (see
 * EXECUTION_LEDGER.md §8 — this file is inert scaffolding, not wired to any
 * caller). Real domains extend this map when they land; `mywork_projection`
 * is a placeholder consumer name, not an existing implemented projection.
 */
export const EVENT_TYPE_CONSUMER_GROUPS: Readonly<Record<string, readonly string[]>> = {
  'kpi.definition.approved': ['mywork_projection'],
  'roi_case.decided': ['mywork_projection', 'finance_projection'],
  'okr_set.published': ['mywork_projection'],
};

/**
 * Resolves the consumer groups for an `event_type`. Unknown event types
 * resolve to an empty list (no outbox fan-out) rather than throwing — a
 * domain forgetting to register its event_type here should not crash the
 * write, but it IS silently dropping delivery, so this logs a warning.
 */
function resolveConsumerGroups(eventType: string): readonly string[] {
  const groups = EVENT_TYPE_CONSUMER_GROUPS[eventType];
  if (!groups || groups.length === 0) {
    logger.warn(
      '[resultsVnext/platform/atomicWrite] event_type has no registered consumer_group — outbox fan-out skipped',
      { eventType }
    );
    return [];
  }
  return groups;
}

// ==========================================
// PUBLIC TYPES
// ==========================================

/**
 * Fields the caller supplies to build the `rvn_platform_events` row. Omits
 * the columns the DB generates (`event_id`, `sequence`, `recorded_at`) —
 * everything else in `PlatformEventEnvelope` (see eventEnvelope.ts) must be
 * provided by the domain, since the platform layer has no idea what an
 * "approved" KPI definition looks like.
 */
export type AtomicEventInput = Omit<PlatformEventEnvelope, 'eventId' | 'sequence' | 'recordedAt'>;

export interface ExecuteAtomicCommandParams<TAggregateRow, TResult> {
  /** Tenant scope — also the second predicate on every query this helper runs. */
  organizationId: string;
  /** Aggregate row identifier, as understood by `loadForUpdate`. */
  aggregateId: string;
  /** Optimistic-concurrency precondition (design §A.4 step 3). */
  expectedVersion: number;

  /**
   * Runs `SELECT ... FOR UPDATE` (or equivalent) for the aggregate row on
   * the pinned transactional client. Return `undefined`/`null` if no row
   * exists for (aggregateId, organizationId) — this helper turns that into
   * `AtomicWriteAggregateNotFoundError`.
   */
  loadForUpdate: (
    client: PoolClient,
    aggregateId: string,
    organizationId: string
  ) => Promise<TAggregateRow | undefined | null>;

  /** Reads the current optimistic-concurrency version off the loaded row. */
  getCurrentVersion: (row: TAggregateRow) => number;

  /**
   * Applies the domain mutation (the aggregate `UPDATE ... SET ...,
   * row_version = row_version + 1`) on the SAME pinned client, and returns
   * whatever shape the caller wants back as the command result.
   * `nextVersion` is `getCurrentVersion(currentRow) + 1`, computed once by
   * this helper so the mutation and the event's `resulting_version` can
   * never drift apart.
   */
  applyMutation: (
    client: PoolClient,
    currentRow: TAggregateRow,
    nextVersion: number
  ) => Promise<TResult>;

  /**
   * Builds the `rvn_platform_events` row to insert. Called AFTER
   * `applyMutation` so it can see the mutation result (e.g. to put the new
   * state in `afterState`). Must set `idempotencyKey` — that is the column
   * the `ON CONFLICT (organization_id, idempotency_key) DO NOTHING` targets.
   */
  buildEvent: (ctx: {
    currentRow: TAggregateRow;
    result: TResult;
    nextVersion: number;
  }) => AtomicEventInput;

  /**
   * Reconstructs `TResult` from a pre-existing `rvn_platform_events` row
   * when the idempotency key was already used (a command retry). Optional —
   * if omitted, this helper falls back to casting the existing event's
   * `after_state` JSONB as `TResult` (design §A.4: "przekazana funkcja
   * loadExistingResult, albo prosty re-SELECT po idempotency_key" — the
   * fallback IS that "prosty re-SELECT" path). Domains whose `TResult`
   * cannot be reconstructed from `after_state` alone should supply this.
   */
  loadExistingResult?: (client: PoolClient, existingEvent: ExistingEventRow) => Promise<TResult>;
}

export interface ExistingEventRow {
  event_id: string;
  sequence: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  organization_id: string;
  occurred_at: string;
  recorded_at: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  resulting_version: number;
  idempotency_key: string;
}

export interface AtomicCommandOutcome<TResult> {
  /** 'applied' = this call performed the mutation. 'duplicate' = idempotency
   * key already existed; the mutation in THIS call was rolled back and the
   * previously-committed result is returned instead. */
  outcome: 'applied' | 'duplicate';
  eventId: string;
  resultingVersion: number;
  result: TResult;
}

// ==========================================
// IMPLEMENTATION
// ==========================================

const EVENT_INSERT_SQL = `
  INSERT INTO rvn_platform_events (
    schema_version, event_type, aggregate_type, aggregate_id, organization_id,
    actor_user_id, actor_effective_role, command_id, correlation_id, causation_id,
    occurred_at, policy_version, before_state, after_state, state_hash, reason,
    evidence_refs, source, idempotency_key, expected_version, resulting_version, payload
  ) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15, $16,
    $17, $18, $19, $20, $21, $22
  )
  ON CONFLICT (organization_id, idempotency_key) DO NOTHING
  RETURNING event_id, resulting_version
`;

/**
 * Design §A.4, executed literally:
 *   BEGIN
 *   SELECT ... FOR UPDATE                      (loadForUpdate)
 *     expected_version != current_version -> ROLLBACK, typed STALE_VERSION
 *   UPDATE <aggregate> SET ..., row_version+1   (applyMutation)
 *   INSERT INTO rvn_platform_events ... ON CONFLICT DO NOTHING RETURNING event_id
 *     no row returned -> ROLLBACK, return existing event's result
 *   INSERT INTO rvn_platform_outbox (one row per applicable consumer_group)
 *   COMMIT
 */
export async function executeAtomicCommand<TAggregateRow, TResult>(
  params: ExecuteAtomicCommandParams<TAggregateRow, TResult>
): Promise<AtomicCommandOutcome<TResult>> {
  const {
    organizationId,
    aggregateId,
    expectedVersion,
    loadForUpdate,
    getCurrentVersion,
    applyMutation,
    buildEvent,
    loadExistingResult,
  } = params;

  const client: PoolClient = await acquirePgClient();
  try {
    await client.query('BEGIN');

    // Step 2 (design §A.4): SELECT ... FOR UPDATE.
    const currentRow = await loadForUpdate(client, aggregateId, organizationId);
    if (!currentRow) {
      await client.query('ROLLBACK');
      throw new AtomicWriteAggregateNotFoundError();
    }

    // Step 3: CAS check.
    const currentVersion = getCurrentVersion(currentRow);
    if (expectedVersion !== currentVersion) {
      await client.query('ROLLBACK');
      throw new AtomicWriteConflictError(
        'Aggregate was modified since it was last read',
        'STALE_VERSION',
        { currentVersion, expectedVersion }
      );
    }

    const nextVersion = currentVersion + 1;

    // Step 4: domain mutation, same pinned client.
    const result = await applyMutation(client, currentRow, nextVersion);

    // Step 5: event log insert, idempotency-guarded.
    const eventInput = buildEvent({ currentRow, result, nextVersion });
    const eventResult = await client.query<{ event_id: string; resulting_version: number }>(
      EVENT_INSERT_SQL,
      [
        eventInput.schemaVersion,
        eventInput.eventType,
        eventInput.aggregateType,
        eventInput.aggregateId,
        eventInput.organizationId,
        eventInput.actorUserId,
        eventInput.actorEffectiveRole,
        eventInput.commandId,
        eventInput.correlationId,
        eventInput.causationId,
        eventInput.occurredAt,
        eventInput.policyVersion,
        eventInput.beforeState === null ? null : JSON.stringify(eventInput.beforeState),
        eventInput.afterState === null ? null : JSON.stringify(eventInput.afterState),
        eventInput.stateHash,
        eventInput.reason,
        JSON.stringify(eventInput.evidenceRefs ?? []),
        eventInput.source,
        eventInput.idempotencyKey,
        eventInput.expectedVersion,
        eventInput.resultingVersion,
        JSON.stringify(eventInput.payload ?? {}),
      ]
    );

    const insertedEvent = eventResult.rows[0];
    if (!insertedEvent) {
      // Duplicate idempotency_key — this exact command already committed
      // once. Roll back THIS call's mutation (it must not double-apply) and
      // hand back the previously-committed result instead.
      const existingResult = await client.query<ExistingEventRow>(
        `SELECT event_id, sequence, event_type, aggregate_type, aggregate_id, organization_id,
                occurred_at, recorded_at, before_state, after_state, resulting_version, idempotency_key
           FROM rvn_platform_events
          WHERE organization_id = $1 AND idempotency_key = $2`,
        [organizationId, eventInput.idempotencyKey]
      );
      const existingEvent = existingResult.rows[0];
      await client.query('ROLLBACK');

      if (!existingEvent) {
        // Should not be reachable (ON CONFLICT fired against this exact
        // unique index means a row must exist) — fail loudly rather than
        // return a fabricated result.
        throw new Error(
          `[executeAtomicCommand] idempotency conflict on (${organizationId}, ${eventInput.idempotencyKey}) but existing event row not found`
        );
      }

      const duplicateResult = loadExistingResult
        ? await loadExistingResult(client, existingEvent)
        : ((existingEvent.after_state ?? {}) as unknown as TResult);

      return {
        outcome: 'duplicate',
        eventId: existingEvent.event_id,
        resultingVersion: existingEvent.resulting_version,
        result: duplicateResult,
      };
    }

    // Step 6: outbox fan-out, one row per applicable consumer_group.
    const consumerGroups = resolveConsumerGroups(eventInput.eventType);
    if (consumerGroups.length > 0) {
      await client.query(
        `INSERT INTO rvn_platform_outbox (event_id, consumer_group, status)
           SELECT $1, cg, 'pending' FROM unnest($2::text[]) AS cg`,
        [insertedEvent.event_id, consumerGroups]
      );
    }

    // Step 7.
    await client.query('COMMIT');

    return {
      outcome: 'applied',
      eventId: insertedEvent.event_id,
      resultingVersion: insertedEvent.resulting_version,
      result,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Same defensive double-rollback-is-a-no-op pattern as
      // decisionCollaborationService.finalizeDecisionTransition — a prior
      // explicit ROLLBACK in the try block above may have already ended the
      // transaction, in which case this second ROLLBACK is a harmless no-op
      // that pg still may log/throw on depending on driver version.
      logger.warn('[resultsVnext/platform/atomicWrite] rollback after error failed', {
        error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
      });
    }
    throw err;
  } finally {
    client.release();
  }
}
