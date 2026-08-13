/**
 * Case Workspace — transactional DOMAIN EVENT OUTBOX service.
 *
 * Implements docs/product/case-workspace/06_SECURITY_EVENTS_OBSERVABILITY.md
 * §6 (event architecture / DomainEvent envelope) and §8 (delivery, ordering
 * and recovery) on top of the single table added in
 * server/migrations/20260810_case_workspace_event_outbox.sql.
 *
 * =========================================================================
 * WHAT THIS FILE IS, AND WHAT IT IS DELIBERATELY NOT
 * =========================================================================
 * It is the PRIMITIVE. It does not wire itself into anything. None of the 11
 * caseWorkspace services (caseCoreService, casePlanVersionService,
 * playService, proposalApprovalService, waitSubscriptionService,
 * artifactLinkService, executionGraphService, capabilityRegistryService,
 * runBindingService, caseHistoryService, migrationReadinessService) and none
 * of the routes are touched by this packet; the call sites are the next
 * phase's job, and the exact event_type each command must emit is fixed in
 * docs/product/case-workspace/acceptance/EVENT_TAXONOMY.md.
 *
 * =========================================================================
 * ATOMICITY — THE ONE THING THAT MAKES THIS AN OUTBOX AND NOT A LOG
 * =========================================================================
 * §6: "Domain changes and outbox records commit atomically."
 *
 * publishEvent() does NOT open its own transaction and does NOT reach for a
 * pooled connection. It takes the caller's ALREADY-OPEN transaction client as
 * its first argument and issues the INSERT on that exact connection. Every
 * mutating function across the 11 services already runs inside
 * withPgTransaction() (a pinned `pg.Client`) or withRawPgTransaction() (a
 * pinned `PoolClient`), so the aggregate UPDATE and the outbox INSERT land in
 * one BEGIN…COMMIT: if the command rolls back, the event never existed; if
 * the event exists, the command committed. There is therefore NO
 * "fallback-outbox"/best-effort-publish path in this file, and no
 * publishEvent overload that opens its own connection — such an overload is
 * exactly the hole (commit aggregate, then crash before publishing) that
 * §12's "kill worker … after domain commit before outbox publication"
 * negative test exists to catch, and it cannot be closed by retrying, only by
 * never opening it.
 *
 * PLACEHOLDER STYLE: SQL here is written with native `$1,$2,…` positional
 * placeholders, NOT this codebase's usual `?` house style. That is forced by
 * the dual-client contract: withPgTransaction's client runs every statement
 * through adaptQuery() (which rewrites `?` → `$n`) while withRawPgTransaction
 * hands over a raw PoolClient that does not. `$n` is the only form that is
 * correct on BOTH — adaptQuery leaves `$n` untouched. See
 * server/src/utils/queryHelpers.ts (PgTransactionClient) for the contract.
 *
 * =========================================================================
 * DELIVERY, RETRY, DEAD-LETTER (§8)
 * =========================================================================
 * dispatchPendingEvents() runs in its OWN short transaction, claims pending
 * rows with `FOR UPDATE SKIP LOCKED` (so N dispatchers never fight over the
 * same row — §12's "run two workers/schedulers against one ready item"), and
 * per row:
 *   - delivered   -> UPDATE delivered_at = now(), next_retry_at = NULL
 *   - failed      -> delivery_attempt_count + 1, last_delivery_error set,
 *                    delivered_at LEFT NULL, next_retry_at = now() +
 *                    computeRetryBackoffMs(newAttemptCount) (server/
 *                    migrations/20260812a_case_workspace_outbox_next_retry_at.sql).
 *                    Leaving delivered_at NULL *is* the retry mechanism; the
 *                    ROW simply re-appears in a later claim once
 *                    next_retry_at elapses — a PER-ROW exponential backoff,
 *                    capped at RETRY_BACKOFF_MAX_MS, distinct from
 *                    outboxWorker.ts's own TICK-CADENCE backoff (which slows
 *                    the whole worker loop, not one row).
 * Rows that have failed DEAD_LETTER_ATTEMPT_THRESHOLD times drop out of the
 * claim query (dead-letter) but stay fully readable through
 * listDeadLetterEvents() for reconciliation. Nothing is ever deleted here.
 *
 * WHY DELIVERY IS NOT "eventBus.publish() AND HOPE": EventBus.publish()
 * (server/src/services/event/EventBus.ts) schedules on process.nextTick and
 * its subscriber wrapper swallows every handler error into logger.error. It
 * therefore CANNOT return a delivery outcome — used alone, every dispatch
 * would report success, delivered_at would always be set, and the retry /
 * dead-letter columns would be decoration. So delivery is defined here as:
 * await every handler registered via subscribeToOutboxDelivery() (these are
 * the durable consumers; a throw = a failed delivery = a retry), and THEN
 * mirror the event onto the global in-process EventBus for existing
 * fire-and-forget listeners. Durability is Postgres'. EventBus is only the
 * in-process notification, published strictly AFTER the row is durable.
 *
 * =========================================================================
 * REDACTION (§6, §9, §13)
 * =========================================================================
 * redact() is a thin wrapper over the existing
 * server/src/utils/piiRedactor.ts (DEFAULT_PII_FIELDS + email/token
 * patterns) — no second redaction implementation is introduced. publishEvent
 * runs every summary through it unconditionally, so an un-redacted summary
 * cannot reach the table even if a future caller forgets. Oversized summaries
 * are REJECTED rather than truncated (see MAX_REDACTED_SUMMARY_BYTES), because
 * §6's "full documents, prompts, credentials … are referenced rather than
 * copied" is a rule about what an event IS, and a silently truncated document
 * is still a copied document.
 */

import { randomUUID } from 'node:crypto';

import logger from '../../utils/Logger.js';
import PiiRedactor from '../../utils/piiRedactor.js';
import { queryAll, withPgTransaction } from '../../utils/queryHelpers.js';
import { getCorrelationId } from '../../utils/RequestStore.js';
import { eventBus } from '../event/EventBus.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Table this service owns end to end. Nothing else in the repo writes to it. */
const OUTBOX_TABLE = 'case_workspace_event_outbox';

/**
 * §8 dead-letter threshold. A row that has failed this many delivery attempts
 * stops being claimed by dispatchPendingEvents() and becomes reconciliation
 * work (listDeadLetterEvents). It is never deleted and never silently marked
 * delivered.
 */
export const DEAD_LETTER_ATTEMPT_THRESHOLD = 10;

/**
 * §8 PER-ROW retry backoff (server/migrations/
 * 20260812a_case_workspace_outbox_next_retry_at.sql's `next_retry_at`
 * column). Before that migration, the ONLY backoff in this system was
 * outboxWorker.ts's TICK-CADENCE backoff (`currentBackoffMultiplier`), which
 * slows the WHOLE worker loop when ANY row is failing — a single
 * permanently-broken consumer for one event type would still have its own
 * row re-claimed and re-tried on every tick at the (possibly still-fast)
 * base interval. `next_retry_at` fixes that at the ROW level: a failed
 * delivery schedules exactly this row's next eligible attempt at
 * `now() + min(RETRY_BACKOFF_MAX_MS, RETRY_BACKOFF_BASE_MS * 2^(attempt-1))`
 * (attempt = the delivery_attempt_count AFTER this failure, 1-based), and
 * dispatchPendingEvents()'s claim query will not re-select the row before
 * that instant. A fresh row (next_retry_at IS NULL) is eligible immediately,
 * so a row's FIRST attempt is never delayed by this mechanism.
 */
export const RETRY_BACKOFF_BASE_MS = 1_000;
/** Sane cap (§8 "exponential backoff with a sane cap") — 5 minutes. */
export const RETRY_BACKOFF_MAX_MS = 5 * 60 * 1000;
/**
 * Ceiling on the exponent so `2 ** exponent` never approaches an unsafe
 * JS number range for a pathological attempt count — irrelevant in practice
 * since DEAD_LETTER_ATTEMPT_THRESHOLD (10) removes a row from the claim
 * query long before this would matter, but kept explicit rather than
 * implicit in float behavior.
 */
const RETRY_BACKOFF_MAX_EXPONENT = 20;

/**
 * §8 per-row exponential backoff, capped. `attemptNumber` is the
 * delivery_attempt_count value AFTER the failure being scheduled (1-based:
 * the first failure is attempt 1). Exported so a test can assert the exact
 * schedule without duplicating the formula, and so a future caller computing
 * an ETA for an operator dashboard has one source of truth for it.
 */
export function computeRetryBackoffMs(attemptNumber: number): number {
  const attempt = Number.isFinite(attemptNumber) && attemptNumber > 0 ? Math.floor(attemptNumber) : 1;
  const exponent = Math.min(attempt - 1, RETRY_BACKOFF_MAX_EXPONENT);
  const delayMs = RETRY_BACKOFF_BASE_MS * Math.pow(2, exponent);
  return Math.min(RETRY_BACKOFF_MAX_MS, delayMs);
}

/**
 * Hard ceiling on the serialized redacted summary. 8 KiB is generous for a
 * fact ("status DRAFT -> ACTIVE, tier T2") and far too small for a document,
 * prompt or model output — which is the point (§6). Oversized summaries throw
 * `event_outbox_redacted_summary_too_large`; the caller's fix is a
 * `payloadRef`, not a bigger event.
 */
export const MAX_REDACTED_SUMMARY_BYTES = 8 * 1024;

/** Default claim size for one dispatch pass. */
const DEFAULT_DISPATCH_BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The minimal query surface shared by BOTH transaction client shapes used
 * across the caseWorkspace services:
 *   - `PgTransactionClient` from withPgTransaction (pinned `pg.Client`), and
 *   - `PoolClient` from withRawPgTransaction (pinned pooled connection).
 * publishEvent accepts either — it never creates a connection of its own.
 */
export interface EventOutboxTransactionClient {
  query<T = any>(
    sql: string,
    params?: any[]
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

/** §6 DomainEvent envelope, as accepted from a producing service. */
export interface DomainEventEnvelope {
  /**
   * Optional. Omit it and a fresh `cwevt-<uuid>` is minted. Supply a
   * DETERMINISTIC id (derived from the command's idempotency key) when the
   * command itself can be retried — that is what makes ON CONFLICT DO NOTHING
   * a real deduplication rather than a formality.
   */
  eventId?: string;
  eventType: string;
  schemaVersion?: number;
  organizationId: string;
  projectId?: string | null;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion?: number | null;
  caseId?: string | null;
  runId?: string | null;
  nodeRunId?: string | null;
  attemptId?: string | null;
  /** §6 `actor` — acting user id, or a `system:<worker>` token. */
  actorUserId: string;
  /** Defaults to RequestStore.getCorrelationId(), else a newly minted id. */
  correlationId?: string | null;
  /** §6 `causationId` — the event/command that caused this one. */
  causationId?: string | null;
  /**
   * CW-T-E, server/migrations/20260810e_case_workspace_event_correlation.sql.
   * OPTIONAL, and a DIFFERENT concept from `correlationId` above:
   * `correlationId` groups every event ONE triggering command/request
   * produced (a trace id); `correlationKey` names the specific
   * WaitSubscription (case_workspace_waits.correlation_key /
   * CaseWait.correlationKey) this fact is meant to satisfy, when the
   * producer knows one. Leave it unset for the overwhelming majority of
   * events, which describe a fact with no wait attached — exactly like
   * `caseId`/`runId`/`nodeRunId` stay unset for org-scoped facts.
   *
   * When set, waitSubscriptionService.assertSatisfyingEventIsReal()'s
   * DOMAIN_EVENT branch treats it as the STRICT, per-step binding: the value
   * must equal the target wait's own correlationKey exactly, closing the
   * "same event_type, different step, same Case" gap a case_id-only check
   * left open. See that migration's header for the full model.
   */
  correlationKey?: string | null;
  /** Business time. Defaults to now(). */
  occurredAt?: string | Date | null;
  /** Facts only. Redacted here before it is written. */
  redactedSummary?: Record<string, unknown> | null;
  /** Pointer to the full payload that deliberately is NOT in the event. */
  payloadRef?: string | null;
}

export interface PublishEventResult {
  eventId: string;
  /** true when this exact event_id was already in the outbox (no second row). */
  deduplicated: boolean;
}

/** A row as stored, mapped to camelCase. */
export interface OutboxEventRecord {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  organizationId: string;
  projectId: string | null;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number | null;
  caseId: string | null;
  runId: string | null;
  nodeRunId: string | null;
  attemptId: string | null;
  actorUserId: string;
  correlationId: string;
  causationId: string | null;
  /** CW-T-E — see DomainEventEnvelope.correlationKey's doc for what this is (and is not). */
  correlationKey: string | null;
  /**
   * CW-T-E deterministic-ordering primitive. A real Postgres IDENTITY
   * sequence (server/migrations/20260810e_case_workspace_event_correlation.sql)
   * assigned at INSERT time — unlike `created_at`/`occurred_at`
   * (TIMESTAMPTZ defaults that CAN tie under clock-resolution pressure), this
   * is strictly monotonic per row and is what dispatchPendingEvents() and
   * replayEventsForAggregate() both use as their final, unambiguous tie-break.
   */
  sequenceNumber: number;
  occurredAt: string;
  redactedSummary: Record<string, unknown>;
  payloadRef: string | null;
  deliveredAt: string | null;
  deliveryAttemptCount: number;
  lastDeliveryError: string | null;
  /**
   * §8 per-row retry schedule (RETRY_BACKOFF_*). `null` means "eligible
   * immediately" — either never failed, or already delivered.
   */
  nextRetryAt: string | null;
  createdAt: string;
}

interface OutboxEventRow {
  event_id: string;
  event_type: string;
  schema_version: number;
  organization_id: string;
  project_id: string | null;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number | null;
  case_id: string | null;
  run_id: string | null;
  node_run_id: string | null;
  attempt_id: string | null;
  actor_user_id: string;
  correlation_id: string;
  causation_id: string | null;
  correlation_key: string | null;
  sequence_number: number | string;
  occurred_at: Date | string;
  redacted_summary: Record<string, unknown> | string | null;
  payload_ref: string | null;
  delivered_at: Date | string | null;
  delivery_attempt_count: number;
  last_delivery_error: string | null;
  next_retry_at: Date | string | null;
  created_at: Date | string;
}

/** An awaited durable consumer. Throwing = failed delivery = retry. */
export type OutboxDeliveryHandler = (event: OutboxEventRecord) => Promise<void> | void;

export interface DispatchPendingEventsOptions {
  batchSize?: number;
  /** Tenant-scoped dispatch (§3). Omit to dispatch across all tenants. */
  organizationId?: string;
}

export interface DispatchPendingEventsResult {
  claimed: number;
  delivered: number;
  failed: number;
  /** event ids left pending on purpose, for the caller's logs/metrics. */
  failedEventIds: string[];
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function requireNonBlank(value: string | null | undefined, reason: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(reason);
  return normalized;
}

function optionalTrimmed(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function toIsoTimestamp(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('event_outbox_occurred_at_invalid');
  return parsed.toISOString();
}

function normalizeTimestamp(value: Date | string | null): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function parseSummary(value: Record<string, unknown> | string | null): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value;
}

function mapRow(row: OutboxEventRow): OutboxEventRecord {
  return {
    eventId: row.event_id,
    eventType: row.event_type,
    schemaVersion: Number(row.schema_version),
    organizationId: row.organization_id,
    projectId: row.project_id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    aggregateVersion: row.aggregate_version === null ? null : Number(row.aggregate_version),
    caseId: row.case_id,
    runId: row.run_id,
    nodeRunId: row.node_run_id,
    attemptId: row.attempt_id,
    actorUserId: row.actor_user_id,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    correlationKey: row.correlation_key,
    sequenceNumber: Number(row.sequence_number),
    occurredAt: normalizeTimestamp(row.occurred_at) as string,
    redactedSummary: parseSummary(row.redacted_summary),
    payloadRef: row.payload_ref,
    deliveredAt: normalizeTimestamp(row.delivered_at),
    deliveryAttemptCount: Number(row.delivery_attempt_count ?? 0),
    lastDeliveryError: row.last_delivery_error,
    nextRetryAt: normalizeTimestamp(row.next_retry_at),
    createdAt: normalizeTimestamp(row.created_at) as string,
  };
}

const SELECT_COLUMNS = `event_id, event_type, schema_version, organization_id, project_id,
  aggregate_type, aggregate_id, aggregate_version, case_id, run_id, node_run_id, attempt_id,
  actor_user_id, correlation_id, causation_id, correlation_key, sequence_number, occurred_at,
  redacted_summary, payload_ref, delivered_at, delivery_attempt_count, last_delivery_error,
  next_retry_at, created_at`;

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

/**
 * §6/§9/§13. Thin wrapper over the existing PiiRedactor — deliberately NOT a
 * second redaction implementation. Deep-redacts DEFAULT_PII_FIELDS by key and
 * scrubs inline emails/JWT-ish tokens out of string values.
 *
 * Note what this cannot do: it is a field/pattern redactor, so it protects
 * against PII that is NAMED (email, token, ssn, …) or SHAPED like an email or
 * JWT. A caller that stuffs a whole client document under the key `details`
 * gets a redacted-but-still-copied document — the MAX_REDACTED_SUMMARY_BYTES
 * ceiling in publishEvent is the second, blunter guard against exactly that,
 * and the real answer is `payloadRef`.
 */
export function redact<T>(payload: T): T {
  return PiiRedactor.redact(payload);
}

// ---------------------------------------------------------------------------
// publishEvent — the atomicity primitive
// ---------------------------------------------------------------------------

/**
 * §6. Append one DomainEvent to the outbox ON THE CALLER'S OPEN TRANSACTION.
 *
 * `client` MUST be the same client the calling service already holds inside
 * withPgTransaction()/withRawPgTransaction(); that is the entire mechanism by
 * which the aggregate mutation and the event commit or roll back together.
 * Passing a fresh pool connection here would compile and would silently
 * reintroduce the dual-write bug this table exists to remove.
 *
 * `INSERT ... ON CONFLICT (event_id) DO NOTHING RETURNING event_id`: zero
 * returned rows means the id was already present, reported as
 * `deduplicated: true` — an explicit, non-throwing signal, never a silent
 * overwrite (the stored row is left byte-for-byte as first written).
 */
export async function publishEvent(
  client: EventOutboxTransactionClient,
  envelope: DomainEventEnvelope
): Promise<PublishEventResult> {
  if (!client || typeof client.query !== 'function') {
    throw new Error('event_outbox_transaction_client_required');
  }

  const eventId = optionalTrimmed(envelope.eventId) ?? `cwevt-${randomUUID()}`;
  const eventType = requireNonBlank(envelope.eventType, 'event_outbox_event_type_required');
  const organizationId = requireNonBlank(
    envelope.organizationId,
    'event_outbox_organization_id_required'
  );
  const aggregateType = requireNonBlank(
    envelope.aggregateType,
    'event_outbox_aggregate_type_required'
  );
  const aggregateId = requireNonBlank(envelope.aggregateId, 'event_outbox_aggregate_id_required');
  const actorUserId = requireNonBlank(envelope.actorUserId, 'event_outbox_actor_required');

  const schemaVersion = envelope.schemaVersion ?? 1;
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new Error('event_outbox_schema_version_invalid');
  }

  const aggregateVersion =
    envelope.aggregateVersion === null || envelope.aggregateVersion === undefined
      ? null
      : Number(envelope.aggregateVersion);
  if (aggregateVersion !== null && (!Number.isInteger(aggregateVersion) || aggregateVersion < 0)) {
    throw new Error('event_outbox_aggregate_version_invalid');
  }

  // §6/§10: correlation_id is NOT NULL in the schema — a hole here breaks the
  // operator trace. Prefer the caller's explicit value, then the ambient
  // request correlation id, and only then mint one (background workers and
  // schedulers run outside any AsyncLocalStorage request scope).
  const correlationId =
    optionalTrimmed(envelope.correlationId) ?? getCorrelationId() ?? `corr-${randomUUID()}`;

  const redactedSummary = redact(envelope.redactedSummary ?? {}) as Record<string, unknown>;
  const serializedSummary = JSON.stringify(redactedSummary ?? {});
  if (Buffer.byteLength(serializedSummary, 'utf8') > MAX_REDACTED_SUMMARY_BYTES) {
    throw new Error('event_outbox_redacted_summary_too_large');
  }

  const result = await client.query<{ event_id: string }>(
    `INSERT INTO ${OUTBOX_TABLE} (
       event_id, event_type, schema_version, organization_id, project_id,
       aggregate_type, aggregate_id, aggregate_version,
       case_id, run_id, node_run_id, attempt_id,
       actor_user_id, correlation_id, causation_id, correlation_key,
       occurred_at, redacted_summary, payload_ref
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8,
       $9, $10, $11, $12,
       $13, $14, $15, $16,
       $17, $18::jsonb, $19
     )
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [
      eventId,
      eventType,
      schemaVersion,
      organizationId,
      optionalTrimmed(envelope.projectId),
      aggregateType,
      aggregateId,
      aggregateVersion,
      optionalTrimmed(envelope.caseId),
      optionalTrimmed(envelope.runId),
      optionalTrimmed(envelope.nodeRunId),
      optionalTrimmed(envelope.attemptId),
      actorUserId,
      correlationId,
      optionalTrimmed(envelope.causationId),
      optionalTrimmed(envelope.correlationKey),
      toIsoTimestamp(envelope.occurredAt),
      serializedSummary,
      optionalTrimmed(envelope.payloadRef),
    ]
  );

  return { eventId, deduplicated: result.rows.length === 0 };
}

// ---------------------------------------------------------------------------
// Delivery subscribers (in-process, awaited)
// ---------------------------------------------------------------------------

const deliveryHandlers: OutboxDeliveryHandler[] = [];

/**
 * Register a durable consumer. Unlike EventBus subscribers, these are AWAITED
 * by dispatchPendingEvents(): a handler that throws marks the delivery failed,
 * which leaves delivered_at NULL and re-queues the row (§8 retry). Returns an
 * unsubscribe function.
 */
export function subscribeToOutboxDelivery(handler: OutboxDeliveryHandler): () => void {
  deliveryHandlers.push(handler);
  return () => {
    const index = deliveryHandlers.indexOf(handler);
    if (index >= 0) deliveryHandlers.splice(index, 1);
  };
}

/** Test/teardown helper — drops every registered delivery handler. */
export function clearOutboxDeliverySubscribers(): void {
  deliveryHandlers.length = 0;
}

async function deliverOne(event: OutboxEventRecord): Promise<void> {
  // Durable consumers first, awaited: their failure is what "delivery failed"
  // means. Sequential on purpose — a later handler must not observe an event
  // whose earlier handler already failed the delivery.
  for (const handler of [...deliveryHandlers]) {
    await handler(event);
  }
  // Then the in-process notification, strictly AFTER the row is durable and
  // after every awaited consumer accepted it. Fire-and-forget by design.
  eventBus.publish(event.eventType, event as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// dispatchPendingEvents — §8 delivery, retry, dead-letter
// ---------------------------------------------------------------------------

/**
 * §8. Claim and deliver one batch of pending events, in its OWN short
 * transaction (this is the one place in this file that opens a transaction —
 * it is a background dispatcher, not part of any command).
 *
 * `FOR UPDATE SKIP LOCKED` is what makes concurrent dispatchers safe: a row
 * already claimed by another dispatcher's open transaction is skipped, never
 * waited on and never double-delivered.
 *
 * Failure handling is deliberately per row: one consumer blowing up on one
 * event must not abort the batch's transaction or lose the other rows'
 * bookkeeping. Handler errors are JS-level (never SQL), so the transaction
 * stays valid and each row's outcome is written before COMMIT.
 */
export async function dispatchPendingEvents(
  options: DispatchPendingEventsOptions | number = {}
): Promise<DispatchPendingEventsResult> {
  const normalized: DispatchPendingEventsOptions =
    typeof options === 'number' ? { batchSize: options } : options;
  const batchSize =
    Number.isInteger(normalized.batchSize) && (normalized.batchSize as number) > 0
      ? (normalized.batchSize as number)
      : DEFAULT_DISPATCH_BATCH_SIZE;
  const organizationId = optionalTrimmed(normalized.organizationId);

  return withPgTransaction(async (client) => {
    const claimed = await client.query<OutboxEventRow>(
      `SELECT ${SELECT_COLUMNS}
         FROM ${OUTBOX_TABLE}
        WHERE delivered_at IS NULL
          AND delivery_attempt_count < $1
          AND (next_retry_at IS NULL OR next_retry_at <= now())
          AND ($2::text IS NULL OR organization_id = $2)
        ORDER BY sequence_number
        LIMIT $3
        FOR UPDATE SKIP LOCKED`,
      [DEAD_LETTER_ATTEMPT_THRESHOLD, organizationId, batchSize]
    );

    const result: DispatchPendingEventsResult = {
      claimed: claimed.rows.length,
      delivered: 0,
      failed: 0,
      failedEventIds: [],
    };

    for (const row of claimed.rows) {
      const event = mapRow(row);
      try {
        await deliverOne(event);
        await client.query(
          `UPDATE ${OUTBOX_TABLE}
              SET delivered_at = now(), last_delivery_error = NULL, next_retry_at = NULL
            WHERE event_id = $1`,
          [event.eventId]
        );
        result.delivered += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // delivered_at stays NULL — that IS the retry. The row re-appears in
        // a later claim once next_retry_at elapses, until it succeeds or
        // crosses DEAD_LETTER_ATTEMPT_THRESHOLD. attemptNumber is the
        // delivery_attempt_count value AFTER this failure (row.
        // delivery_attempt_count is the value BEFORE it, read by the claim
        // SELECT above), so the backoff computed here matches the count this
        // exact UPDATE is about to write.
        const attemptNumber = Number(row.delivery_attempt_count ?? 0) + 1;
        const backoffMs = computeRetryBackoffMs(attemptNumber);
        await client.query(
          `UPDATE ${OUTBOX_TABLE}
              SET delivery_attempt_count = delivery_attempt_count + 1,
                  last_delivery_error = $2,
                  next_retry_at = now() + ($3 || ' milliseconds')::interval
            WHERE event_id = $1`,
          [event.eventId, message.slice(0, 2000), String(backoffMs)]
        );
        result.failed += 1;
        result.failedEventIds.push(event.eventId);
        logger.warn(
          `[eventOutbox] delivery failed for ${event.eventId} (${event.eventType}), attempt ${attemptNumber}, ` +
            `next retry in ${backoffMs}ms: ${message}`
        );
      }
    }

    return result;
  });
}

// ---------------------------------------------------------------------------
// Read-only queries (no side effects anywhere below this line)
// ---------------------------------------------------------------------------

/**
 * §8 ordering / §13 "operator trace reconstructing the complete correlation
 * chain". Pure read: every event ever emitted about one aggregate, in
 * aggregate-version order.
 *
 * `aggregate_version NULLS LAST` then occurred_at then created_at then
 * sequence_number: aggregates without a version concept (see the migration's
 * aggregate_version comment) still come back in a stable, deterministic
 * order. `occurred_at`/`created_at` break most ties, but TWO events that
 * share BOTH an aggregate_version (e.g. case_workspace_waits' claim/renew
 * pair, neither of which bumps the OCC counter — see
 * waitSubscriptionService.ts) AND a wall-clock instant (real, under load —
 * see CW-T-E) need a tie-break with NO possible collision. `sequence_number`
 * (server/migrations/20260810e_case_workspace_event_correlation.sql) is that:
 * a Postgres IDENTITY sequence assigned at INSERT time, so it is true
 * insertion order regardless of clock resolution.
 */
export async function replayEventsForAggregate(
  aggregateType: string,
  aggregateId: string,
  options: { organizationId?: string; limit?: number } = {}
): Promise<OutboxEventRecord[]> {
  const type = requireNonBlank(aggregateType, 'event_outbox_aggregate_type_required');
  const id = requireNonBlank(aggregateId, 'event_outbox_aggregate_id_required');
  const organizationId = optionalTrimmed(options.organizationId);
  const limit =
    Number.isInteger(options.limit) && (options.limit as number) > 0 ? (options.limit as number) : null;

  const rows = await queryAll<OutboxEventRow>(
    `SELECT ${SELECT_COLUMNS}
       FROM ${OUTBOX_TABLE}
      WHERE aggregate_type = $1
        AND aggregate_id = $2
        AND ($3::text IS NULL OR organization_id = $3)
      ORDER BY aggregate_version ASC NULLS LAST, occurred_at ASC, created_at ASC, sequence_number ASC
      ${limit === null ? '' : 'LIMIT $4'}`,
    limit === null ? [type, id, organizationId] : [type, id, organizationId, limit]
  );

  return rows.map(mapRow);
}

/** Pure read: one event by id, or null. */
export async function getOutboxEvent(eventId: string): Promise<OutboxEventRecord | null> {
  const id = requireNonBlank(eventId, 'event_outbox_event_id_required');
  const rows = await queryAll<OutboxEventRow>(
    `SELECT ${SELECT_COLUMNS} FROM ${OUTBOX_TABLE} WHERE event_id = $1`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * §8 dead-letter + reconciliation surface: events that exhausted
 * DEAD_LETTER_ATTEMPT_THRESHOLD attempts and are no longer claimed. Read-only
 * — nothing here retries, discards or rewrites them; that is a human decision.
 */
export async function listDeadLetterEvents(
  options: { organizationId?: string; limit?: number } = {}
): Promise<OutboxEventRecord[]> {
  const organizationId = optionalTrimmed(options.organizationId);
  const limit =
    Number.isInteger(options.limit) && (options.limit as number) > 0 ? (options.limit as number) : 100;
  const rows = await queryAll<OutboxEventRow>(
    `SELECT ${SELECT_COLUMNS}
       FROM ${OUTBOX_TABLE}
      WHERE delivered_at IS NULL
        AND delivery_attempt_count >= $1
        AND ($2::text IS NULL OR organization_id = $2)
      ORDER BY created_at ASC
      LIMIT $3`,
    [DEAD_LETTER_ATTEMPT_THRESHOLD, organizationId, limit]
  );
  return rows.map(mapRow);
}

/**
 * CW-T-E worker diagnostics. Pure read, `count(*)` only — the cheap
 * companion to listDeadLetterEvents() for a metrics/health snapshot that does
 * not want to pull the rows themselves (outboxWorker.ts's tick metrics).
 */
export async function countDeadLetterEvents(
  options: { organizationId?: string } = {}
): Promise<number> {
  const organizationId = optionalTrimmed(options.organizationId);
  const rows = await queryAll<{ n: string | number }>(
    `SELECT count(*)::int AS n
       FROM ${OUTBOX_TABLE}
      WHERE delivered_at IS NULL
        AND delivery_attempt_count >= $1
        AND ($2::text IS NULL OR organization_id = $2)`,
    [DEAD_LETTER_ATTEMPT_THRESHOLD, organizationId]
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * §10 "queue and outbox/inbox lag" metric input. Pure read: how many events
 * are still owed, and how old the oldest one is (seconds).
 */
export async function getOutboxBacklog(
  options: { organizationId?: string } = {}
): Promise<{ pending: number; oldestPendingAgeSeconds: number | null }> {
  const organizationId = optionalTrimmed(options.organizationId);
  const rows = await queryAll<{ pending: string | number; oldest_age: string | number | null }>(
    `SELECT count(*)::int AS pending,
            EXTRACT(EPOCH FROM (now() - min(created_at)))::int AS oldest_age
       FROM ${OUTBOX_TABLE}
      WHERE delivered_at IS NULL
        AND ($1::text IS NULL OR organization_id = $1)`,
    [organizationId]
  );
  const row = rows[0];
  return {
    pending: Number(row?.pending ?? 0),
    oldestPendingAgeSeconds:
      row?.oldest_age === null || row?.oldest_age === undefined ? null : Number(row.oldest_age),
  };
}
