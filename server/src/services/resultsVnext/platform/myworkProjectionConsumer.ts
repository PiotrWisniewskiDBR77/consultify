/**
 * RN-G3 Outbox Dispatcher — `mywork_projection` consumer.
 *
 * Design: docs/product/results-vnext/RN_G3_OUTBOX_DISPATCHER_DESIGN.md §1/§8.
 *
 * THE SCOPE-CHANGING FINDING (design §1): `RN_G1_PLATFORM_DESIGN.md` §A.5
 * points at `v8_canonical_object_states` as the projection target, but the
 * REAL Inbox is `canonical_inbox_items`, fed by
 * `inboxService.materializeInboxItems()`, which reads exactly three
 * hardcoded sources: `tasks`, `decisions`, `notifications`. KPI/ROI/OKR
 * appear in none of them — writing ONLY `v8_canonical_object_states` would
 * satisfy the platform design's letter and produce ZERO visible product
 * change. So this consumer writes BOTH rows, in the SAME transaction, per
 * relevant event:
 *   1. `v8_canonical_object_states` upsert — cross-surface canonical truth
 *      (design intent, §C.1).
 *   2. `notifications` INSERT (or, for `kpi.deviation_closed`, an UPDATE
 *      resolving the earlier one — IO-E) — the real, already-shipped path
 *      into the user's Inbox via `materializeInboxItems`'s existing
 *      `notifications` query, with ZERO changes to `inboxService.ts`.
 *
 * Both writes use the CALLER's pinned `PoolClient` (the cron's own
 * BEGIN/COMMIT around this function, per design §3's tick body) — this file
 * deliberately does NOT call `myWorkRoofService.setCanonicalObjectState()`,
 * which goes through `DbPromise`/the plain pool and would run on a
 * DIFFERENT connection, breaking the "both writes commit together" property
 * this whole slice is supposed to prove. The upsert SQL below is copied
 * verbatim from that service's own `INSERT ... ON CONFLICT` (same columns,
 * same conflict target) so the two paths stay byte-for-byte consistent.
 *
 * Idempotency (design §5): `rvn_platform_consumer_processed` is the primary
 * guard — checked and claimed FIRST via `ON CONFLICT DO NOTHING`, before any
 * other write. No row returned = already processed by this consumer group =
 * expected no-op success under at-least-once redelivery, not an error.
 *
 * Event-type coverage: only the four event types design §8 documents write
 * real projections here (`kpi.deviation_opened`/`roi.case_approved`/
 * `okr_support.decision_requested`/`kpi.deviation_closed`). Every OTHER
 * event type that fans out to `mywork_projection` in `atomicWrite.ts`'s
 * `EVENT_TYPE_CONSUMER_GROUPS` (roughly 140 of them — effectively every KPI/
 * ROI/OKR event) still gets claimed (the idempotency INSERT above) and
 * dispatched successfully — it is a deliberate no-op, NOT an error and NOT a
 * silent drop of anything real: no domain data exists yet for this consumer
 * to project for those types. Throwing here instead would dead-letter and
 * CRITICAL-alert on effectively the entire KPI/ROI/OKR event stream, the
 * exact alert-fatigue failure IO-C explicitly rejects for `finance_projection`
 * — the same reasoning applies here. Extending real handling to more event
 * types is deliberately out of THIS slice's bounded scope (proving the path
 * end-to-end with one real consumer, per the design's own framing) — a
 * follow-up package's job, tracked the same way `finance_projection` itself
 * is tracked in `consumerRegistry.ts`.
 */
import type { PoolClient } from 'pg';

import logger from '../../../utils/Logger.js';

import type { RvnOutboxRow } from './outboxDrain.js';
import type { RvnPlatformEventRow } from './consumerRegistry.js';

// ==========================================
// IO-A: canonical-state vocabulary SSOT
// ==========================================

/**
 * IO-A ruling: `v8_canonical_object_states.canonical_state` has no SSOT
 * vocabulary in the schema (a free `z.string().min(1)` in
 * `SetCanonicalObjectStateParamsSchema`). Adopting the design's proposed
 * five values, but — per the ruling — defined ONCE here and never as inline
 * string literals at any call site in this file (or any future one). This
 * is the vocabulary; extend it here, not by inventing a sixth parallel
 * taxonomy elsewhere.
 */
export const RVN_CANONICAL_STATES = {
  NEEDS_ATTENTION: 'needs_attention',
  IN_PROGRESS: 'in_progress',
  APPROVED: 'approved',
  RESOLVED: 'resolved',
  ARCHIVED: 'archived',
} as const;

export type RvnCanonicalState = (typeof RVN_CANONICAL_STATES)[keyof typeof RVN_CANONICAL_STATES];

const CONSUMER_GROUP = 'mywork_projection';

// ==========================================
// Shared helpers
// ==========================================

/**
 * Upsert `v8_canonical_object_states`, same conflict target/columns as
 * `myWorkRoofService.setCanonicalObjectState()` — copied rather than called
 * so this runs on the SAME pinned client as the notification write (see file
 * header). Seeds `home`/`inbox` surface projections per design §8 step 1.
 */
async function upsertCanonicalObjectState(
  client: PoolClient,
  params: {
    objectId: string;
    objectType: string;
    organizationId: string;
    canonicalState: RvnCanonicalState;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const surfaceProjections: Record<string, unknown> = {};
  for (const surface of ['home', 'inbox'] as const) {
    surfaceProjections[surface] = {
      surface,
      displayState: params.canonicalState,
      isStale: false,
      lastRefreshedAt: now,
    };
  }

  await client.query(
    `INSERT INTO v8_canonical_object_states (
       object_id, object_type, organization_id, canonical_state,
       last_updated_at, surface_projections
     ) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (object_id, organization_id) DO UPDATE SET
       object_type = excluded.object_type,
       canonical_state = excluded.canonical_state,
       last_updated_at = excluded.last_updated_at,
       surface_projections = excluded.surface_projections`,
    [
      params.objectId,
      params.objectType,
      params.organizationId,
      params.canonicalState,
      now,
      JSON.stringify(surfaceProjections),
    ]
  );
}

/**
 * Insert one `notifications` row for the real, already-shipped
 * `materializeInboxItems()` pull path (`inboxService.ts` reads
 * `WHERE user_id = ? AND COALESCE(read, 0) = 0`) — `read`/`is_read` both left
 * at their unread defaults (`0`) so the row is picked up immediately. Both
 * columns are `INTEGER` on the real, fully-migrated table (verified against
 * a real Postgres — `000_initdb_core_tables.sql`'s own `BOOLEAN` declaration
 * for `is_read` is superseded by a later migration; there is no boolean
 * notifications column at all), so this writes `0`/`1`, never JS
 * `true`/`false`. `organization_id`/`entity_type`/`entity_id` are set so a
 * later `kpi.deviation_closed` can find and resolve this exact row (IO-E).
 */
async function insertNotification(
  client: PoolClient,
  params: {
    userId: string;
    organizationId: string;
    type: string;
    title: string;
    message: string;
    priority?: string;
    entityType: string;
    entityId: string;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO notifications (
       id, user_id, organization_id, type, title, message, priority,
       entity_type, entity_id, read, is_read, created_at
     ) VALUES (
       gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, 0, 0, now()
     )`,
    [
      params.userId,
      params.organizationId,
      params.type,
      params.title,
      params.message,
      params.priority ?? 'high',
      params.entityType,
      params.entityId,
    ]
  );
}

/**
 * IO-E: resolve the stale notification(s) this consumer itself created for
 * a now-closed deviation case — scoped by `organization_id` in addition to
 * `entity_type`/`entity_id` (the acceptance suite's proof 8 deliberately
 * seeds two orgs whose deviation cases share the same LITERAL
 * `aggregate_id`/`entity_id`; omitting the org predicate here would resolve
 * the wrong org's notification).
 */
async function resolveStaleNotifications(
  client: PoolClient,
  params: { organizationId: string; entityType: string; entityId: string }
): Promise<void> {
  await client.query(
    `UPDATE notifications
        SET read = 1, is_read = 1, read_at = now()
      WHERE organization_id = $1 AND entity_type = $2 AND entity_id = $3
        AND COALESCE(read, 0) = 0`,
    [params.organizationId, params.entityType, params.entityId]
  );
}

/**
 * Courtesy advance of `rvn_platform_projection_checkpoints` (design §5:
 * "for replay/rebuild, not per-row dispatch... the consumer should still
 * advance it as a courtesy for a future rebuild tool"). NOT the idempotency
 * guard — `rvn_platform_consumer_processed` is — this is unsafe as a guard
 * under concurrent out-of-sequence claims, hence "courtesy" only.
 */
async function advanceCheckpoint(
  client: PoolClient,
  params: { organizationId: string; sequence: string }
): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_projection_checkpoints
       (projection_name, organization_id, last_applied_sequence, updated_at)
     VALUES ($1, $2, $3::bigint, now())
     ON CONFLICT (projection_name, organization_id) DO UPDATE SET
       last_applied_sequence = GREATEST(
         rvn_platform_projection_checkpoints.last_applied_sequence, excluded.last_applied_sequence
       ),
       updated_at = now()`,
    [CONSUMER_GROUP, params.organizationId, params.sequence]
  );
}

// ==========================================
// Per-event-type domain queries (design §8 table — payload is deliberately
// thin, so each type re-queries its own domain table for assignee/owner).
// ==========================================

async function handleKpiDeviationOpened(client: PoolClient, event: RvnPlatformEventRow): Promise<void> {
  const oblig = await client.query<{ assignee_user_id: string }>(
    `SELECT assignee_user_id FROM rvn_platform_obligations
      WHERE organization_id = $1 AND reference_type = 'deviation_case' AND reference_id = $2::uuid
        AND status = 'open'
      ORDER BY created_at DESC LIMIT 1`,
    [event.organization_id, event.aggregate_id]
  );
  const assigneeUserId = oblig.rows[0]?.assignee_user_id ?? null;

  await upsertCanonicalObjectState(client, {
    objectId: event.aggregate_id,
    objectType: event.aggregate_type,
    organizationId: event.organization_id,
    canonicalState: RVN_CANONICAL_STATES.NEEDS_ATTENTION,
  });

  if (assigneeUserId) {
    await insertNotification(client, {
      userId: assigneeUserId,
      organizationId: event.organization_id,
      type: 'DEVIATION_CASE_OPENED',
      title: 'Odchylenie KPI wymaga wyjaśnienia',
      message: `Sprawa odchylenia ${event.aggregate_id} wymaga Twojego wyjaśnienia.`,
      entityType: 'deviation_case',
      entityId: event.aggregate_id,
    });
  } else {
    logger.warn(
      '[resultsVnext/platform/myworkProjectionConsumer] kpi.deviation_opened: no open obligation found — canonical state written, notification skipped',
      { eventId: event.event_id, aggregateId: event.aggregate_id, organizationId: event.organization_id }
    );
  }
}

async function handleKpiDeviationClosed(client: PoolClient, event: RvnPlatformEventRow): Promise<void> {
  await upsertCanonicalObjectState(client, {
    objectId: event.aggregate_id,
    objectType: event.aggregate_type,
    organizationId: event.organization_id,
    canonicalState: RVN_CANONICAL_STATES.RESOLVED,
  });

  // IO-E: resolve the earlier "needs attention" notification rather than
  // creating a new one — a cold reopen of the Inbox must show the CURRENT
  // state, not a stale unread item for a case that is already closed.
  await resolveStaleNotifications(client, {
    organizationId: event.organization_id,
    entityType: 'deviation_case',
    entityId: event.aggregate_id,
  });
}

async function handleRoiCaseApproved(client: PoolClient, event: RvnPlatformEventRow): Promise<void> {
  const roiCase = await client.query<{ owner_user_id: string }>(
    `SELECT owner_user_id FROM rvn_roi_cases WHERE organization_id = $1 AND case_id = $2::uuid`,
    [event.organization_id, event.aggregate_id]
  );
  const ownerUserId = roiCase.rows[0]?.owner_user_id ?? null;

  await upsertCanonicalObjectState(client, {
    objectId: event.aggregate_id,
    objectType: event.aggregate_type,
    organizationId: event.organization_id,
    canonicalState: RVN_CANONICAL_STATES.APPROVED,
  });

  if (ownerUserId) {
    await insertNotification(client, {
      userId: ownerUserId,
      organizationId: event.organization_id,
      type: 'ROI_CASE_APPROVED',
      title: 'Case ROI zatwierdzony',
      message: `Case ROI ${event.aggregate_id} został zatwierdzony.`,
      priority: 'normal',
      entityType: 'roi_case',
      entityId: event.aggregate_id,
    });
  } else {
    logger.warn(
      '[resultsVnext/platform/myworkProjectionConsumer] roi.case_approved: rvn_roi_cases row not found — canonical state written, notification skipped',
      { eventId: event.event_id, aggregateId: event.aggregate_id, organizationId: event.organization_id }
    );
  }
}

async function handleOkrSupportDecisionRequested(
  client: PoolClient,
  event: RvnPlatformEventRow
): Promise<void> {
  const requestId = typeof event.payload?.requestId === 'string' ? event.payload.requestId : null;
  let assignedToUserId: string | null = null;

  if (requestId) {
    const req = await client.query<{ assigned_to_user_id: string | null }>(
      `SELECT assigned_to_user_id FROM okr_vnext_support_requests
        WHERE organization_id = $1 AND request_id = $2::uuid`,
      [event.organization_id, requestId]
    );
    assignedToUserId = req.rows[0]?.assigned_to_user_id ?? null;
  }

  await upsertCanonicalObjectState(client, {
    objectId: event.aggregate_id,
    objectType: event.aggregate_type,
    organizationId: event.organization_id,
    canonicalState: RVN_CANONICAL_STATES.NEEDS_ATTENTION,
  });

  if (assignedToUserId && requestId) {
    await insertNotification(client, {
      userId: assignedToUserId,
      organizationId: event.organization_id,
      type: 'OKR_SUPPORT_DECISION_REQUESTED',
      title: 'Decyzja OKR wymagana',
      message: `Wsparcie OKR ${requestId} wymaga decyzji.`,
      entityType: 'okr_support_request',
      entityId: requestId,
    });
  } else {
    logger.warn(
      '[resultsVnext/platform/myworkProjectionConsumer] okr_support.decision_requested: assignee not resolved — canonical state written, notification skipped',
      { eventId: event.event_id, aggregateId: event.aggregate_id, organizationId: event.organization_id, requestId }
    );
  }
}

// ==========================================
// Public entrypoint (consumerRegistry.ts's ConsumerFn)
// ==========================================

export async function dispatchMyWorkProjection(
  client: PoolClient,
  event: RvnPlatformEventRow,
  _outboxRow: RvnOutboxRow
): Promise<void> {
  // Design §5: primary idempotency guard, checked/claimed FIRST. No row
  // returned = a prior delivery of THIS event already applied this
  // consumer's side effects — at-least-once redelivery is an expected
  // success, not an error, so this returns cleanly without touching
  // anything else.
  const claim = await client.query<{ event_id: string }>(
    `INSERT INTO rvn_platform_consumer_processed (consumer_group, event_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING event_id`,
    [CONSUMER_GROUP, event.event_id]
  );
  if (claim.rowCount === 0) {
    return;
  }

  switch (event.event_type) {
    case 'kpi.deviation_opened':
      await handleKpiDeviationOpened(client, event);
      break;
    case 'kpi.deviation_closed':
      await handleKpiDeviationClosed(client, event);
      break;
    case 'roi.case_approved':
      await handleRoiCaseApproved(client, event);
      break;
    case 'okr_support.decision_requested':
      await handleOkrSupportDecisionRequested(client, event);
      break;
    default:
      // See file header "Event-type coverage" — deliberate no-op for the
      // ~140 other event types routed to mywork_projection. Claimed above
      // (so redelivery stays idempotent), no projection exists for them yet.
      logger.debug(
        '[resultsVnext/platform/myworkProjectionConsumer] no projection handler for event_type — claimed as a no-op',
        { eventId: event.event_id, eventType: event.event_type }
      );
      break;
  }

  // Design §5 "courtesy" advance — not the idempotency guard (the INSERT
  // above already is), just a watermark for a future replay/rebuild tool.
  await advanceCheckpoint(client, { organizationId: event.organization_id, sequence: event.sequence });
}
