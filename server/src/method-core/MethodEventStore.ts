/**
 * Shared Method Kernel — append-only event store.
 *
 * Persists src/method-core/contracts/events.ts `MethodEvent` rows into
 * `method_events` (server/migrations/20260813_method_core_kernel.sql).
 * Nothing here ever UPDATEs or DELETEs a row; a correction is a brand new
 * event carrying `supersedes`.
 *
 * Idempotency: replaying `append()` with the same (sessionId, idempotencyKey)
 * resolves to the SAME row — enforced at two layers: an application-level
 * check-then-insert (works against the sqlite-flavoured test mock, which
 * does not evaluate the partial `ON CONFLICT` target) and a partial unique
 * index + `ON CONFLICT ... DO NOTHING` for a genuine concurrent race against
 * real Postgres.
 *
 * NOTE ON THE MOCK SELECT FILTER: `server/src/database/Database.ts`'s test
 * mock only evaluates SQL `WHERE col = ?` predicates for a fixed allow-list
 * of column names (id, organization_id, user_id, pack_id, idempotency_key,
 * ...). `session_id` is NOT in that list, so a bare
 * `WHERE session_id = ?` silently returns EVERY row under the mock. Every
 * query below filters on an allow-listed column in SQL and re-checks
 * `session_id` in application code as a defensive backstop — correct under
 * both the mock and real Postgres (the SQL WHERE clause still carries the
 * precise predicate for production; the JS filter is redundant there, not
 * wrong).
 */

import * as DbPromise from '../utils/DbPromise.js';
import { genId, isUniqueViolation, parseJson, runOrThrow } from './db.js';
import type { MethodActorKind, MethodEvent, MethodEventType } from './contracts/index.js';

interface MethodEventRow {
  id: string;
  organization_id: string;
  session_id: string;
  type: string;
  unit_id: string | null;
  level: number | null;
  actor_kind: string;
  actor_user_id: string | null;
  method_pack_version: string;
  occurred_at: string;
  supersedes: string | null;
  idempotency_key: string | null;
  payload_json: unknown;
}

export interface AppendEventInput<TPayload = unknown> {
  readonly organizationId: string;
  readonly sessionId: string;
  readonly type: MethodEventType;
  readonly unitId?: string;
  readonly level?: number;
  readonly actorKind: MethodActorKind;
  /** Null only for `system` — mirrors MethodEvent.actorUserId. */
  readonly actorUserId: string | null;
  readonly methodPackVersion: string;
  /** Defaults to now(); overridable for replay/backfill callers. */
  readonly occurredAt?: string;
  readonly supersedes?: string;
  readonly idempotencyKey?: string;
  readonly payload: TPayload;
}

function toMethodEvent<TPayload = unknown>(row: MethodEventRow): MethodEvent<TPayload> {
  return {
    id: row.id,
    type: row.type as MethodEventType,
    organizationId: row.organization_id,
    sessionId: row.session_id,
    unitId: row.unit_id ?? undefined,
    level: row.level ?? undefined,
    actorKind: row.actor_kind as MethodActorKind,
    actorUserId: row.actor_user_id,
    methodPackVersion: row.method_pack_version,
    occurredAt: row.occurred_at,
    supersedes: row.supersedes ?? undefined,
    idempotencyKey: row.idempotency_key ?? undefined,
    payload: parseJson<TPayload>(row.payload_json, {} as TPayload),
  };
}

export class MethodEventStore {
  /**
   * Append one event. Same (sessionId, idempotencyKey) twice -> ONE row,
   * both calls return that row.
   */
  async append<TPayload = unknown>(
    input: AppendEventInput<TPayload>
  ): Promise<MethodEvent<TPayload>> {
    if (input.idempotencyKey) {
      const existing = await this.findByIdempotencyKey<TPayload>(
        input.organizationId,
        input.sessionId,
        input.idempotencyKey
      );
      if (existing) return existing;
    }

    const id = genId();
    const occurredAt = input.occurredAt ?? new Date().toISOString();

    try {
      await runOrThrow(
        `INSERT INTO method_events
           (id, organization_id, session_id, type, unit_id, level, actor_kind,
            actor_user_id, method_pack_version, occurred_at, supersedes,
            idempotency_key, payload_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (session_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
        [
          id,
          input.organizationId,
          input.sessionId,
          input.type,
          input.unitId ?? null,
          input.level ?? null,
          input.actorKind,
          input.actorUserId,
          input.methodPackVersion,
          occurredAt,
          input.supersedes ?? null,
          input.idempotencyKey ?? null,
          JSON.stringify(input.payload ?? {}),
        ]
      );
    } catch (err) {
      // A concurrent append won the race on the partial unique index. Fall
      // through to the settle-read below instead of failing the caller.
      if (!(input.idempotencyKey && isUniqueViolation(err))) throw err;
    }

    if (input.idempotencyKey) {
      const settled = await this.findByIdempotencyKey<TPayload>(
        input.organizationId,
        input.sessionId,
        input.idempotencyKey
      );
      if (settled) return settled;
      throw new Error(
        'method-core: event insert settled to no row (idempotency invariant violated)'
      );
    }

    return {
      id,
      type: input.type,
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      unitId: input.unitId,
      level: input.level,
      actorKind: input.actorKind,
      actorUserId: input.actorUserId,
      methodPackVersion: input.methodPackVersion,
      occurredAt,
      supersedes: input.supersedes,
      idempotencyKey: undefined,
      payload: input.payload,
    };
  }

  async findByIdempotencyKey<TPayload = unknown>(
    organizationId: string,
    sessionId: string,
    idempotencyKey: string
  ): Promise<MethodEvent<TPayload> | null> {
    const candidates = await DbPromise.all<MethodEventRow>(
      `SELECT * FROM method_events WHERE organization_id = ? AND idempotency_key = ?`,
      [organizationId, idempotencyKey]
    );
    const match = candidates.find((row) => row.session_id === sessionId);
    return match ? toMethodEvent<TPayload>(match) : null;
  }

  /** Chronological (occurredAt asc, id as tiebreaker). Never mutates rows. */
  async listBySession(organizationId: string, sessionId: string): Promise<MethodEvent[]> {
    const rows = await DbPromise.all<MethodEventRow>(
      `SELECT * FROM method_events WHERE organization_id = ? AND session_id = ?`,
      [organizationId, sessionId]
    );
    return rows
      .filter((row) => row.session_id === sessionId)
      .map((row) => toMethodEvent(row))
      .sort((a, b) => {
        const byTime = new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
        return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
      });
  }
}

export const methodEventStore = new MethodEventStore();
