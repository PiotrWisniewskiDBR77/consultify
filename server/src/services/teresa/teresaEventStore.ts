/**
 * Persistence for the Teresa kernel — append-only writes to
 * `tool_session_events` (migration 946). This IS the session state: there is
 * no parallel proposal table for the Teresa contract. A preview's full body
 * (statements, proposedChanges, quality verdict, expiresAt) lives in the
 * TERESA_PROPOSAL_CREATED event's `payload_json`, so a commit can be served
 * purely by re-reading this table — never from an in-memory cache that could
 * drift from what was actually persisted.
 *
 * Canon: src/method-core/contracts/events.ts (18-event closed set,
 * org-scoped, methodPackVersion pinned, actorKind separate from
 * actorUserId), src/method-core/contracts/teresa.ts (propose -> preview ->
 * commit).
 */
import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

import type { MethodActorKind, MethodEventType } from '../../../../src/method-core/contracts/events';
import { isMethodEventType } from '../../../../src/method-core/contracts/events';
import * as queryHelpers from '../../utils/queryHelpers.js';

export interface TeresaEventInput {
  /** Pass a fixed id when the id itself must be referenceable (e.g. previewId). */
  id?: string;
  organizationId: string;
  toolSessionId: string;
  type: MethodEventType;
  unitId?: string | null;
  level?: number | null;
  actorKind: MethodActorKind;
  actorUserId: string | null;
  methodPackVersion: string;
  payload: unknown;
  supersedes?: string | null;
  idempotencyKey?: string | null;
}

export interface TeresaEventRow {
  id: string;
  organization_id: string;
  tool_session_id: string;
  event_type: string;
  unit_id: string | null;
  level: number | null;
  actor_kind: string;
  actor_user_id: string | null;
  method_pack_version: string;
  payload_json: unknown;
  supersedes_id: string | null;
  idempotency_key: string | null;
  created_at: string;
}

/**
 * Appends one event inside an existing transaction. Idempotent: replaying the
 * same (tool_session_id, idempotency_key) pair returns the ALREADY PERSISTED
 * row instead of creating a second one (uq_tool_session_events_idempotency).
 * Rows with no idempotency_key always insert (partial unique index only
 * applies WHERE idempotency_key IS NOT NULL).
 */
export async function appendEvent(
  client: PoolClient,
  input: TeresaEventInput
): Promise<{ row: TeresaEventRow; created: boolean }> {
  if (!isMethodEventType(input.type)) {
    throw new Error(`teresaEventStore.appendEvent: "${input.type}" is not a closed-set kernel event type`);
  }
  const id = input.id ?? uuidv4();
  const insertResult = await client.query(
    `INSERT INTO tool_session_events
       (id, organization_id, tool_session_id, event_type, unit_id, level, actor_kind,
        actor_user_id, method_pack_version, payload_json, supersedes_id, idempotency_key, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     ON CONFLICT (tool_session_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
     RETURNING *`,
    [
      id,
      input.organizationId,
      input.toolSessionId,
      input.type,
      input.unitId ?? null,
      input.level ?? null,
      input.actorKind,
      input.actorUserId,
      input.methodPackVersion,
      JSON.stringify(input.payload ?? null),
      input.supersedes ?? null,
      input.idempotencyKey ?? null,
    ]
  );

  if (insertResult.rows.length > 0) {
    return { row: insertResult.rows[0] as TeresaEventRow, created: true };
  }

  // Idempotent replay: the unique index blocked the insert. Read back the
  // row that already carries this idempotency key so callers get the SAME
  // result on retry, not an error.
  const existing = await client.query(
    `SELECT * FROM tool_session_events WHERE tool_session_id = $1 AND idempotency_key = $2 LIMIT 1`,
    [input.toolSessionId, input.idempotencyKey]
  );
  if (existing.rows.length === 0) {
    throw new Error(
      `teresaEventStore.appendEvent: insert conflicted but no row found for idempotency_key=${input.idempotencyKey}`
    );
  }
  return { row: existing.rows[0] as TeresaEventRow, created: false };
}

export async function getEventById(client: PoolClient, id: string): Promise<TeresaEventRow | null> {
  const result = await client.query(`SELECT * FROM tool_session_events WHERE id = $1`, [id]);
  return (result.rows[0] as TeresaEventRow) ?? null;
}

/** Any event that supersedes `previewId` — proves the proposal was already decided. */
export async function findConsumingEvent(
  client: PoolClient,
  toolSessionId: string,
  previewId: string
): Promise<TeresaEventRow | null> {
  const result = await client.query(
    `SELECT * FROM tool_session_events
      WHERE tool_session_id = $1 AND supersedes_id = $2
        AND event_type IN ('TERESA_PROPOSAL_ACCEPTED', 'TERESA_PROPOSAL_REJECTED')
      ORDER BY created_at ASC LIMIT 1`,
    [toolSessionId, previewId]
  );
  return (result.rows[0] as TeresaEventRow) ?? null;
}

export async function listSessionEvents(
  client: PoolClient,
  toolSessionId: string,
  eventType?: MethodEventType
): Promise<TeresaEventRow[]> {
  if (eventType) {
    const result = await client.query(
      `SELECT * FROM tool_session_events WHERE tool_session_id = $1 AND event_type = $2 ORDER BY created_at ASC`,
      [toolSessionId, eventType]
    );
    return result.rows as TeresaEventRow[];
  }
  const result = await client.query(
    `SELECT * FROM tool_session_events WHERE tool_session_id = $1 ORDER BY created_at ASC`,
    [toolSessionId]
  );
  return result.rows as TeresaEventRow[];
}

/** Runs `fn` inside a real Postgres transaction (BEGIN/COMMIT/ROLLBACK). */
export async function withTeresaTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return queryHelpers.withRawPgTransaction(fn);
}
