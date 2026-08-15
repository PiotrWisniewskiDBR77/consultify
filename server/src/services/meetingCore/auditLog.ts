/**
 * auditLog.ts — writes to the canonical `audit_events` table on the SAME
 * pinned transaction client as the state change it documents, so the pair
 * commits or rolls back together (BLOKER 1 / atomicity requirement).
 *
 * `audit_events` has two historically duplicated column pairs. This module
 * writes the pair `AuditEventsService` actually reads and writes today
 * (server/src/services/AuditEventsService.ts:58-61 write, :163-165 read):
 *   actor_id, action, resource_type, resource_id
 * NOT the legacy pair (actor_user_id, action_type, entity_type, entity_id).
 * Using the same pair keeps meetingCore's audit trail visible through the
 * existing AuditEventsService.query() API.
 *
 * This module deliberately does NOT call AuditEventsService.log() itself:
 * that service resolves its own db connection via getDatabase() (a
 * different pool/connection than the transaction client passed in here),
 * which would break atomicity with the state change being audited.
 *
 * LANDMINE FOUND WHILE WIRING THIS UP: `audit_events.action_type` is
 * `text NOT NULL` with NO default in the real schema
 * (server/migrations-v2/001_baseline_20260413.sql:5829, mirrored verbatim in
 * tests/meeting-core/pg/schema.ts). AuditEventsService.log()'s OWN primary
 * INSERT (AuditEventsService.ts:57-77) never sets `action_type` either — it
 * relies on that INSERT throwing on the NOT NULL violation and silently
 * falling back to a second, legacy-shaped INSERT that writes
 * `action_type`/`entity_type`/`entity_id` instead of `action`/
 * `resource_type`/`resource_id`. Since `query()` (AuditEventsService.ts:165)
 * only ever reads the `action`/`resource_type`/`resource_id` pair, rows
 * written through that fallback are invisible to it — AuditEventsService's
 * audit trail is effectively write-only today. This module avoids inheriting
 * that bug: it sets `action_type = action` in the SAME single INSERT, so the
 * write succeeds on the first try AND lands in the columns `query()` (and
 * this feature's own tests) actually read. Not a fix to AuditEventsService
 * itself — out of this feature's write area — just this module not stepping
 * on the same rake.
 */

import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

export interface AuditEventWrite {
  actorId: string;
  actorType?: 'USER' | 'SYSTEM';
  action: string;
  resourceType: string;
  resourceId: string;
  organizationId: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditEvent(client: PoolClient, input: AuditEventWrite): Promise<string> {
  const id = `ae-${randomUUID()}`;
  await client.query(
    `INSERT INTO audit_events (
       id, ts, actor_id, actor_type, org_id, action, resource_type, resource_id, metadata_json, action_type
     ) VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $5)`,
    [
      id,
      input.actorId,
      input.actorType || 'USER',
      input.organizationId,
      input.action,
      input.resourceType,
      input.resourceId,
      JSON.stringify(input.metadata || {}),
    ]
  );
  return id;
}
