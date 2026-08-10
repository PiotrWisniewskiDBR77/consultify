/**
 * Case Workspace — durable INBOUND EVENT INBOX.
 *
 * Implements docs/product/case-workspace/06_SECURITY_EVENTS_OBSERVABILITY.md §8
 * on top of `case_workspace_event_inbox`
 * (server/migrations/20260810_case_workspace_node_run_and_inbox.sql):
 *
 *   "Event consumers deduplicate by eventId."
 *   "Failed outbox/inbox delivery has retry, dead-letter and reconciliation."
 *   "Wait satisfaction is atomic and unique; duplicate or late events are
 *    audited but do not reactivate completed/cancelled Runs."
 *
 * ===========================================================================
 * THE TRUST BOUNDARY, IN ORDER
 * ===========================================================================
 * `eventOutboxService` is OUTBOUND: everything it writes is a fact this system
 * asserts. This file is the mirror image and the opposite in kind: every field
 * arriving here is a CLAIM by an untrusted caller. The order of the four gates
 * below is load-bearing and is exactly the order the canon states:
 *
 *   1. AUTHENTICATE. HMAC-SHA256 over the canonicalized raw payload against the
 *      channel's registered secret, compared in constant time. An unsigned or
 *      wrongly-signed delivery is refused BEFORE a row is written — writing
 *      first would let an unauthenticated caller fill the table (and squat
 *      other senders' event ids) for free.
 *   2. DEDUPLICATE. `INSERT ... ON CONFLICT (source, event_id) DO NOTHING`.
 *      Zero returned rows means this exact delivery was already accepted, and
 *      the function returns immediately WITHOUT touching a wait. This is the
 *      whole of "duplicate delivery produces one effect" — it is a unique index,
 *      not application care, so it holds across processes, restarts and true
 *      concurrency (a simultaneous second INSERT blocks on the index until the
 *      first transaction commits, then finds the conflict).
 *   3. VALIDATE TENANT + CORRELATION. The wait is resolved by correlation key
 *      and its REAL organization_id is compared with the claimed one. A
 *      mismatch is recorded as a REJECTED row with rejection_code
 *      'TENANT_MISMATCH' and influences nothing.
 *   4. APPLY. Only now may the wait be satisfied — on the SAME transaction
 *      client, so the inbox row and the wait flip commit together.
 *
 * ===========================================================================
 * WHY ALL FOUR STEPS SHARE ONE TRANSACTION
 * ===========================================================================
 * If the inbox INSERT committed separately from the wait satisfaction, a crash
 * between them would leave a row that says APPLIED with no effect (silent data
 * loss) or an effect with no dedup record (the next redelivery does it again).
 * Both are the dual-write bug the outbox pattern exists to remove. That is why
 * the wait is satisfied through waitSubscriptionService.satisfyWaitOnClient()
 * — which takes this function's client — and NEVER through the public
 * resolveWait(), which would open a second connection.
 *
 * ===========================================================================
 * REJECTIONS ARE RECORDED, NOT SWALLOWED
 * ===========================================================================
 * Every rejection after step 1 writes a durable REJECTED row with a stable
 * `rejection_code`. A cross-tenant callback is a security event, and a 404 with
 * no trace is how such an attempt becomes invisible. Step 1 is the single
 * exception: a caller that cannot authenticate at all is not yet a "sender"
 * whose claims are worth storing, and storing them would be an unauthenticated
 * write primitive.
 */

import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import logger from '../../utils/Logger.js';
import PiiRedactor from '../../utils/piiRedactor.js';
import {
  type PgTransactionClient,
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';
import { getCorrelationId } from '../../utils/RequestStore.js';
import { publishEvent, redact } from './eventOutboxService.js';
import { satisfyWaitOnClient, loadWaitByCorrelationKeyOnClient } from './waitSubscriptionService.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INBOX_TABLE = 'case_workspace_event_inbox';

/** §6 aggregate discriminator for events this service emits. */
const INBOX_AGGREGATE_TYPE = 'INBOX_EVENT';

const SYSTEM_ACTOR_INBOX = 'system:case-workspace-event-inbox';

/**
 * Same ceiling and same reasoning as the outbox's MAX_REDACTED_SUMMARY_BYTES:
 * a redacted inbound summary is a set of FACTS about the callback, not a copy
 * of the provider's document. Oversized summaries are REJECTED rather than
 * truncated — a silently truncated document is still a copied document.
 */
export const MAX_REDACTED_PAYLOAD_BYTES = 8 * 1024;

/** §8 dead-letter threshold for TRANSIENT apply failures. Mirrors the outbox's. */
export const INBOX_DEAD_LETTER_ATTEMPT_THRESHOLD = 10;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type InboxRecordStatus = 'RECEIVED' | 'APPLIED' | 'REJECTED' | 'DEAD_LETTER';

export type InboxRejectionCode =
  | 'SIGNATURE_INVALID'
  | 'CHANNEL_UNKNOWN'
  | 'TENANT_MISMATCH'
  | 'CORRELATION_UNKNOWN'
  | 'PAYLOAD_INVALID'
  | 'WAIT_NOT_ACTIVE'
  | 'WAIT_TYPE_MISMATCH';

export interface ReceiveExternalEventInput {
  /** The SENDER's event id. Half of the dedup key; never minted by us. */
  eventId: string;
  /** The authenticated channel key, e.g. 'docusign-webhook'. */
  source: string;
  eventType: string;
  /** The tenant the caller CLAIMS. Verified against the wait, never trusted. */
  organizationId: string;
  projectId?: string | null;
  /** Echoed back by the sender; matched against case_workspace_waits.correlation_key. */
  correlationKey: string;
  caseId?: string | null;
  runId?: string | null;
  nodeRunId?: string | null;
  /** The raw body as received. Hashed and redacted here; never stored verbatim. */
  payload: Record<string, unknown>;
  /** Hex HMAC-SHA256 of the canonicalized payload under the channel secret. */
  signature: string;
}

export type ReceiveExternalEventResult =
  | { outcome: 'applied'; inboxRecordId: string; waitId: string }
  | { outcome: 'duplicate'; inboxRecordId: string; firstReceivedAt: string; appliedEffectRef: string | null }
  | { outcome: 'rejected'; inboxRecordId: string; rejectionCode: InboxRejectionCode }
  | { outcome: 'unauthenticated'; rejectionCode: 'SIGNATURE_INVALID' | 'CHANNEL_UNKNOWN' };

export interface InboxRecord {
  inboxRecordId: string;
  eventId: string;
  source: string;
  eventType: string;
  organizationId: string;
  projectId: string | null;
  caseId: string | null;
  runId: string | null;
  nodeRunId: string | null;
  correlationKey: string;
  waitId: string | null;
  status: InboxRecordStatus;
  rejectionCode: InboxRejectionCode | null;
  authPrincipal: string | null;
  signatureDigest: string | null;
  payloadDigest: string;
  redactedPayload: Record<string, unknown>;
  receivedAt: string;
  processedAt: string | null;
  appliedEffectRef: string | null;
  processAttemptCount: number;
  lastProcessError: string | null;
}

interface InboxRow {
  inbox_record_id: string;
  event_id: string;
  source: string;
  event_type: string;
  organization_id: string;
  project_id: string | null;
  case_id: string | null;
  run_id: string | null;
  node_run_id: string | null;
  correlation_key: string;
  wait_id: string | null;
  status: InboxRecordStatus;
  rejection_code: InboxRejectionCode | null;
  auth_principal: string | null;
  signature_digest: string | null;
  payload_digest: string;
  redacted_payload: Record<string, unknown> | string | null;
  received_at: Date | string;
  processed_at: Date | string | null;
  applied_effect_ref: string | null;
  process_attempt_count: number | string;
  last_process_error: string | null;
}

const SELECT_COLUMNS = `inbox_record_id, event_id, source, event_type, organization_id, project_id,
  case_id, run_id, node_run_id, correlation_key, wait_id, status, rejection_code,
  auth_principal, signature_digest, payload_digest, redacted_payload,
  received_at, processed_at, applied_effect_ref, process_attempt_count, last_process_error`;

// ---------------------------------------------------------------------------
// Channel registry — the authentication material
// ---------------------------------------------------------------------------

interface InboxChannel {
  source: string;
  secret: string;
  principal: string;
  /** Optional shape gate run before anything is applied (step 3, PAYLOAD_INVALID). */
  validatePayload?: (payload: Record<string, unknown>) => boolean;
  /** Wait types this channel is permitted to satisfy. */
  allowedWaitTypes?: readonly string[];
}

/**
 * Process-local registry of authenticated inbound channels.
 *
 * DELIBERATELY IN MEMORY, NOT IN A TABLE. A channel secret is a live
 * credential; putting it in a `case_workspace_*` table would make every future
 * SELECT *, every backup and every support query a credential-disclosure path,
 * and this program has no envelope-encryption/KMS primitive to lean on yet.
 * Secrets are therefore injected at boot from configuration/env by whoever
 * mounts the route, and only a DIGEST of the presented signature is ever
 * persisted. When a real secret store exists, only registerInboxChannel's body
 * changes.
 */
const channels = new Map<string, InboxChannel>();

export function registerInboxChannel(channel: InboxChannel): void {
  const source = requireNonBlank(channel.source, 'inbox_channel_source_required');
  const secret = requireNonBlank(channel.secret, 'inbox_channel_secret_required');
  channels.set(source, {
    ...channel,
    source,
    secret,
    principal: requireNonBlank(channel.principal, 'inbox_channel_principal_required'),
  });
}

/** Test/teardown helper. Drops every registered channel. */
export function clearInboxChannels(): void {
  channels.clear();
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

/**
 * Deterministic key ordering before hashing/signing. Without it, two byte-
 * identical deliveries that merely serialized their JSON keys in a different
 * order would produce different digests and different signatures — the
 * signature check would fail for legitimate senders and the payload digest
 * would be useless for reconciliation.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([key, v]) => [key, sortKeysDeep(v)] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const result: Record<string, unknown> = {};
    for (const [key, v] of entries) result[key] = v;
    return result;
  }
  return value;
}

function canonicalJson(payload: unknown): string {
  return JSON.stringify(sortKeysDeep(payload ?? null));
}

export function computeInboxPayloadDigest(payload: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex')}`;
}

/**
 * The signature a sender must present. Exported so a channel's operator (and
 * this packet's own tests) can produce a valid delivery without duplicating —
 * and therefore drifting from — the verification logic.
 */
export function computeInboxSignature(secret: string, payload: unknown): string {
  return createHmac('sha256', secret).update(canonicalJson(payload), 'utf8').digest('hex');
}

/**
 * Constant-time comparison. A plain `===` on an HMAC leaks, through timing, how
 * many leading bytes were correct, which turns forging a signature into a
 * byte-at-a-time search. Length is compared first because timingSafeEqual
 * throws on unequal lengths — and length alone is not the secret.
 */
function signaturesMatch(expected: string, presented: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(presented, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function normalizeTimestamp(value: Date | string | null): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function parsePayload(value: Record<string, unknown> | string | null): Record<string, unknown> {
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

function mapRow(row: InboxRow): InboxRecord {
  return {
    inboxRecordId: row.inbox_record_id,
    eventId: row.event_id,
    source: row.source,
    eventType: row.event_type,
    organizationId: row.organization_id,
    projectId: row.project_id,
    caseId: row.case_id,
    runId: row.run_id,
    nodeRunId: row.node_run_id,
    correlationKey: row.correlation_key,
    waitId: row.wait_id,
    status: row.status,
    rejectionCode: row.rejection_code,
    authPrincipal: row.auth_principal,
    signatureDigest: row.signature_digest,
    payloadDigest: row.payload_digest,
    redactedPayload: parsePayload(row.redacted_payload),
    receivedAt: normalizeTimestamp(row.received_at) as string,
    processedAt: normalizeTimestamp(row.processed_at),
    appliedEffectRef: row.applied_effect_ref,
    processAttemptCount: Number(row.process_attempt_count ?? 0),
    lastProcessError: row.last_process_error,
  };
}

// ---------------------------------------------------------------------------
// receiveExternalEvent — the whole trust boundary, in one transaction
// ---------------------------------------------------------------------------

/**
 * §8. Accept one inbound external event.
 *
 * Returns rather than throws for every expected outcome (duplicate, rejected,
 * unauthenticated): a webhook endpoint has to answer 2xx to a duplicate — that
 * is what stops the sender retrying forever — and an exception-based control
 * flow would make "duplicate" and "our database is down" indistinguishable at
 * the call site. Genuine infrastructure failures still throw.
 *
 * `deduplicated` is decided by the database, not by a prior SELECT: a
 * check-then-insert has a window in which two concurrent deliveries both see
 * "not present". The unique index has no such window.
 */
export async function receiveExternalEvent(
  input: ReceiveExternalEventInput
): Promise<ReceiveExternalEventResult> {
  const eventId = requireNonBlank(input.eventId, 'inbox_event_id_required');
  const source = requireNonBlank(input.source, 'inbox_source_required');
  const eventType = requireNonBlank(input.eventType, 'inbox_event_type_required');
  const claimedOrganizationId = requireNonBlank(
    input.organizationId,
    'inbox_organization_id_required'
  );
  const correlationKey = requireNonBlank(input.correlationKey, 'inbox_correlation_key_required');
  const payload = input.payload ?? {};

  // ---- GATE 1: authenticate. Nothing is written before this passes. --------
  const channel = channels.get(source);
  if (!channel) {
    logger.warn(`[eventInbox] rejected delivery on unknown channel source=${source}`);
    return { outcome: 'unauthenticated', rejectionCode: 'CHANNEL_UNKNOWN' };
  }
  const presentedSignature = optionalTrimmed(input.signature) ?? '';
  if (!signaturesMatch(computeInboxSignature(channel.secret, payload), presentedSignature)) {
    logger.warn(`[eventInbox] rejected delivery with invalid signature source=${source}`);
    return { outcome: 'unauthenticated', rejectionCode: 'SIGNATURE_INVALID' };
  }

  const payloadDigest = computeInboxPayloadDigest(payload);
  // The raw signature is a replayable credential — only a digest of it is
  // durable, which is enough to prove two deliveries carried the same one.
  const signatureDigest = `sha256:${createHash('sha256')
    .update(presentedSignature)
    .digest('hex')
    .slice(0, 32)}`;

  const redactedPayload = PiiRedactor.redact(payload) as Record<string, unknown>;
  const serializedPayload = JSON.stringify(redactedPayload ?? {});
  if (Buffer.byteLength(serializedPayload, 'utf8') > MAX_REDACTED_PAYLOAD_BYTES) {
    // Refused BEFORE insert: an oversized body is a caller contract violation,
    // and storing a truncated copy would defeat the size rule it violated.
    throw new Error('inbox_redacted_payload_too_large');
  }

  const inboxRecordId = `cwinbox-${randomUUID()}`;
  const correlationId = getCorrelationId() ?? `corr-${randomUUID()}`;

  return withPgTransaction(async (client) => {
    // ---- GATE 2: deduplicate, in the database. ----------------------------
    const inserted = await client.query<InboxRow>(
      `INSERT INTO ${INBOX_TABLE} (
         inbox_record_id, event_id, source, event_type, organization_id, project_id,
         case_id, run_id, node_run_id, correlation_key, status,
         auth_principal, signature_digest, payload_digest, redacted_payload
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?::jsonb)
       ON CONFLICT (source, event_id) DO NOTHING
       RETURNING ${SELECT_COLUMNS}`,
      [
        inboxRecordId,
        eventId,
        source,
        eventType,
        claimedOrganizationId,
        optionalTrimmed(input.projectId),
        optionalTrimmed(input.caseId),
        optionalTrimmed(input.runId),
        optionalTrimmed(input.nodeRunId),
        correlationKey,
        channel.principal,
        signatureDigest,
        payloadDigest,
        serializedPayload,
      ]
    );

    const insertedRow = inserted.rows[0];
    if (!insertedRow) {
      // Already accepted. Return WITHOUT touching a wait — this single early
      // return is what "duplicate delivery produces one effect" means in
      // practice. No event is emitted either: a redelivery is not a fact about
      // the domain, and emitting one would double-count in every metric.
      const existingResult = await client.query<InboxRow>(
        `SELECT ${SELECT_COLUMNS} FROM ${INBOX_TABLE} WHERE source = ? AND event_id = ?`,
        [source, eventId]
      );
      const existing = existingResult.rows[0];
      if (!existing) throw new Error('inbox_dedup_row_missing');
      return {
        outcome: 'duplicate',
        inboxRecordId: existing.inbox_record_id,
        firstReceivedAt: normalizeTimestamp(existing.received_at) as string,
        appliedEffectRef: existing.applied_effect_ref,
      };
    }

    // ---- GATE 3: validate payload shape, correlation and TENANT. ----------
    const reject = async (
      rejectionCode: InboxRejectionCode,
      detail: Record<string, unknown>
    ): Promise<ReceiveExternalEventResult> => {
      const rejected = await client.query<InboxRow>(
        `UPDATE ${INBOX_TABLE}
            SET status = 'REJECTED', rejection_code = ?, processed_at = now()
          WHERE inbox_record_id = ?
          RETURNING ${SELECT_COLUMNS}`,
        [rejectionCode, inboxRecordId]
      );
      const rejectedRow = rejected.rows[0];
      if (!rejectedRow) throw new Error('inbox_reject_update_failed');
      // A rejection IS a fact — especially a cross-tenant one. Emitted on the
      // same client so the audit event cannot survive a rolled-back rejection
      // or vice versa.
      await publishEvent(client, {
        eventType: 'inbox.event_rejected',
        organizationId: claimedOrganizationId,
        projectId: optionalTrimmed(input.projectId),
        aggregateType: INBOX_AGGREGATE_TYPE,
        aggregateId: inboxRecordId,
        caseId: optionalTrimmed(input.caseId),
        runId: optionalTrimmed(input.runId),
        nodeRunId: optionalTrimmed(input.nodeRunId),
        actorUserId: SYSTEM_ACTOR_INBOX,
        correlationId,
        redactedSummary: redact({
          source,
          externalEventType: eventType,
          rejectionCode,
          correlationKey,
          ...detail,
        }),
        payloadRef: payloadDigest,
      });
      return { outcome: 'rejected', inboxRecordId, rejectionCode };
    };

    if (channel.validatePayload && !channel.validatePayload(payload)) {
      return reject('PAYLOAD_INVALID', {});
    }

    // Locks the wait row for the rest of this transaction, so the tenancy check
    // and the satisfaction below cannot be split by a concurrent writer.
    const wait = await loadWaitByCorrelationKeyOnClient(client, correlationKey);
    if (!wait) return reject('CORRELATION_UNKNOWN', {});

    // THE TENANCY CHECK. The wait's own organization_id is the authority; the
    // caller's claim is only a claim. Note the deliberate ordering: the wait is
    // looked up WITHOUT an org filter precisely so that a cross-tenant attempt
    // lands here as TENANT_MISMATCH rather than being disguised as
    // CORRELATION_UNKNOWN — a rejection that names the real reason is the only
    // one an operator can act on.
    if (wait.organizationId !== claimedOrganizationId) {
      logger.warn(
        `[eventInbox] TENANT MISMATCH: source=${source} claimed org differs from the wait's org`
      );
      return reject('TENANT_MISMATCH', {});
    }

    // A cross-CASE claim is the same class of error one level down.
    const claimedCaseId = optionalTrimmed(input.caseId);
    if (claimedCaseId && claimedCaseId !== wait.caseId) {
      return reject('TENANT_MISMATCH', {});
    }

    const allowedWaitTypes = channel.allowedWaitTypes ?? ['EXTERNAL_CALLBACK', 'DOMAIN_EVENT'];
    if (!allowedWaitTypes.includes(wait.waitType)) {
      // A channel that may satisfy EXTERNAL_CALLBACK waits must not be able to
      // reach in and satisfy a HUMAN approval wait.
      return reject('WAIT_TYPE_MISMATCH', { waitType: wait.waitType });
    }

    // §8: "duplicate or late events are audited but do not reactivate
    // completed/cancelled Runs". A late callback for an already SATISFIED,
    // EXPIRED or CANCELLED wait is stored and rejected, never applied.
    if (wait.status !== 'ACTIVE') {
      return reject('WAIT_NOT_ACTIVE', { waitStatus: wait.status });
    }

    if (wait.expectedEventType && wait.expectedEventType !== eventType) {
      return reject('PAYLOAD_INVALID', { expectedEventType: wait.expectedEventType });
    }

    // ---- GATE 4: apply, on THIS client, in THIS transaction. --------------
    // satisfyWaitOnClient emits the wait's own `wait.satisfied` event on the
    // same client; the inbox's `inbox.event_applied` below is a separate fact
    // about the INBOX aggregate. Two aggregates, two events — not a double
    // count of one thing.
    await satisfyWaitOnClient(
      client,
      wait.waitId,
      { satisfiedByEventId: `${source}:${eventId}` },
      wait.version,
      {
        eventType: 'wait.satisfied',
        actorUserId: SYSTEM_ACTOR_INBOX,
        summary: { satisfiedBySource: source },
        // The full body stays outside the event; the digest is the pointer.
        payloadRef: payloadDigest,
      }
    );

    const applied = await client.query<InboxRow>(
      `UPDATE ${INBOX_TABLE}
          SET status = 'APPLIED', wait_id = ?, case_id = COALESCE(case_id, ?),
              run_id = COALESCE(run_id, ?), node_run_id = COALESCE(node_run_id, ?),
              applied_effect_ref = ?, processed_at = now(),
              process_attempt_count = process_attempt_count + 1
        WHERE inbox_record_id = ? AND status = 'RECEIVED'
        RETURNING ${SELECT_COLUMNS}`,
      [wait.waitId, wait.caseId, wait.runId, wait.nodeRunId, wait.waitId, inboxRecordId]
    );
    if (!applied.rows[0]) throw new Error('inbox_apply_update_failed');

    await publishEvent(client, {
      eventType: 'inbox.event_applied',
      organizationId: wait.organizationId,
      projectId: wait.projectId,
      aggregateType: INBOX_AGGREGATE_TYPE,
      aggregateId: inboxRecordId,
      caseId: wait.caseId,
      runId: wait.runId,
      nodeRunId: wait.nodeRunId,
      actorUserId: SYSTEM_ACTOR_INBOX,
      correlationId,
      redactedSummary: redact({
        source,
        externalEventType: eventType,
        correlationKey,
        satisfiedWaitId: wait.waitId,
        waitType: wait.waitType,
      }),
      payloadRef: payloadDigest,
    });

    return { outcome: 'applied', inboxRecordId, waitId: wait.waitId };
  });
}

// ---------------------------------------------------------------------------
// Transient failure bookkeeping (§8 retry / dead-letter)
// ---------------------------------------------------------------------------

/**
 * §8 "Failed inbox delivery has retry, dead-letter and reconciliation".
 *
 * For TRANSIENT apply failures ONLY (the wait's Case row was momentarily
 * locked, a downstream projection was unavailable) — never for a rejection. A
 * REJECTED row is a decision and must never re-enter the retry loop; that is
 * why this function refuses to touch anything that is not still 'RECEIVED'.
 *
 * Crossing INBOX_DEAD_LETTER_ATTEMPT_THRESHOLD flips the row to DEAD_LETTER,
 * which removes it from listPendingInboxRecords() while leaving it fully
 * readable for reconciliation. Nothing is ever deleted here.
 */
export async function recordInboxProcessingFailure(
  inboxRecordId: string,
  error: unknown
): Promise<InboxRecord | null> {
  const id = requireNonBlank(inboxRecordId, 'inbox_record_id_required');
  const message = error instanceof Error ? error.message : String(error);

  return withPgTransaction(async (client) => {
    const updated = await client.query<InboxRow>(
      `UPDATE ${INBOX_TABLE}
          SET process_attempt_count = process_attempt_count + 1,
              last_process_error = ?,
              status = CASE WHEN process_attempt_count + 1 >= ? THEN 'DEAD_LETTER' ELSE status END,
              processed_at = CASE WHEN process_attempt_count + 1 >= ? THEN now() ELSE processed_at END
        WHERE inbox_record_id = ? AND status = 'RECEIVED'
        RETURNING ${SELECT_COLUMNS}`,
      [
        message.slice(0, 2000),
        INBOX_DEAD_LETTER_ATTEMPT_THRESHOLD,
        INBOX_DEAD_LETTER_ATTEMPT_THRESHOLD,
        id,
      ]
    );
    const row = updated.rows[0];
    if (!row) return null;

    if (row.status === 'DEAD_LETTER') {
      await publishEvent(client, {
        eventType: 'inbox.event_dead_lettered',
        organizationId: row.organization_id,
        projectId: row.project_id,
        aggregateType: INBOX_AGGREGATE_TYPE,
        aggregateId: row.inbox_record_id,
        caseId: row.case_id,
        runId: row.run_id,
        nodeRunId: row.node_run_id,
        actorUserId: SYSTEM_ACTOR_INBOX,
        redactedSummary: redact({
          source: row.source,
          externalEventType: row.event_type,
          attempts: Number(row.process_attempt_count),
        }),
        payloadRef: row.payload_digest,
      });
    }
    return mapRow(row);
  });
}

// ---------------------------------------------------------------------------
// Read-only queries — nothing below this line mutates anything
// ---------------------------------------------------------------------------

export async function getInboxRecord(inboxRecordId: string): Promise<InboxRecord | null> {
  const id = requireNonBlank(inboxRecordId, 'inbox_record_id_required');
  const row = await queryOne<InboxRow>(
    `SELECT ${SELECT_COLUMNS} FROM ${INBOX_TABLE} WHERE inbox_record_id = ?`,
    [id]
  );
  return row ? mapRow(row) : null;
}

/** The dedup identity read: what did this sender's event id resolve to? */
export async function getInboxRecordByEventId(
  source: string,
  eventId: string
): Promise<InboxRecord | null> {
  const row = await queryOne<InboxRow>(
    `SELECT ${SELECT_COLUMNS} FROM ${INBOX_TABLE} WHERE source = ? AND event_id = ?`,
    [
      requireNonBlank(source, 'inbox_source_required'),
      requireNonBlank(eventId, 'inbox_event_id_required'),
    ]
  );
  return row ? mapRow(row) : null;
}

export async function listInboxRecordsForOrganization(
  organizationId: string,
  options: { status?: InboxRecordStatus; limit?: number } = {}
): Promise<InboxRecord[]> {
  const orgId = requireNonBlank(organizationId, 'inbox_organization_id_required');
  const limit = Number.isInteger(options.limit) && (options.limit as number) > 0 ? options.limit : 100;
  const rows = await queryAll<InboxRow>(
    `SELECT ${SELECT_COLUMNS} FROM ${INBOX_TABLE}
      WHERE organization_id = ?
        AND (?::text IS NULL OR status = ?)
      ORDER BY received_at DESC
      LIMIT ?`,
    [orgId, options.status ?? null, options.status ?? null, limit]
  );
  return rows.map(mapRow);
}

/** §8 reconciliation surface: rejected + dead-lettered, most recent first. */
export async function listInboxReconciliationBacklog(
  options: { organizationId?: string; limit?: number } = {}
): Promise<InboxRecord[]> {
  const organizationId = optionalTrimmed(options.organizationId);
  const limit = Number.isInteger(options.limit) && (options.limit as number) > 0 ? options.limit : 100;
  const rows = await queryAll<InboxRow>(
    `SELECT ${SELECT_COLUMNS} FROM ${INBOX_TABLE}
      WHERE status IN ('REJECTED', 'DEAD_LETTER')
        AND (?::text IS NULL OR organization_id = ?)
      ORDER BY received_at DESC
      LIMIT ?`,
    [organizationId, organizationId, limit]
  );
  return rows.map(mapRow);
}

/** §10 "outbox/inbox lag" metric input. */
export async function getInboxBacklog(
  options: { organizationId?: string } = {}
): Promise<{ pending: number; oldestPendingAgeSeconds: number | null }> {
  const organizationId = optionalTrimmed(options.organizationId);
  const rows = await queryAll<{ pending: string | number; oldest_age: string | number | null }>(
    `SELECT count(*)::int AS pending,
            EXTRACT(EPOCH FROM (now() - min(received_at)))::int AS oldest_age
       FROM ${INBOX_TABLE}
      WHERE status = 'RECEIVED'
        AND (?::text IS NULL OR organization_id = ?)`,
    [organizationId, organizationId]
  );
  const row = rows[0];
  return {
    pending: Number(row?.pending ?? 0),
    oldestPendingAgeSeconds:
      row?.oldest_age === null || row?.oldest_age === undefined ? null : Number(row.oldest_age),
  };
}

/** Re-exported so a transaction-owning caller can reuse the client type. */
export type InboxTransactionClient = PgTransactionClient;
