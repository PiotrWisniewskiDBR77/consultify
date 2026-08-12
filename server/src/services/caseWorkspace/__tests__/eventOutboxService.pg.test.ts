/**
 * Case Workspace — transactional DOMAIN EVENT OUTBOX, proved against a REAL
 * PostgreSQL. Exercises server/src/services/caseWorkspace/eventOutboxService.ts
 * against server/migrations/20260810_case_workspace_event_outbox.sql
 * (docs/product/case-workspace/06_SECURITY_EVENTS_OBSERVABILITY.md §6, §8).
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * `NODE_ENV=test` ALONE is a trap: Database.ts's getDatabase()/createDatabase()
 * hand back an in-memory MOCK whenever `RUN_DB_TESTS !== '1'` (or `MOCK_DB`
 * isn't explicitly `'false'`), and every write silently becomes a no-op — the
 * suite would pass while touching nothing. Same gate as
 * caseCoreService.pg.test.ts: require RUN_DB_TESTS=1 && MOCK_DB=false, probe
 * reachability AND that the migrated schema is actually present, and SKIP
 * LOUDLY (never silently pass) when either is missing.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/eventOutboxService.pg.test.ts \
 *   --environment node
 *
 * ===========================================================================
 * WHAT THESE TESTS ARE ACTUALLY TRYING TO DISPROVE
 * ===========================================================================
 * 1. ATOMICITY — that the outbox row is really in the caller's transaction and
 *    not quietly on some other connection. The test writes an aggregate row
 *    AND an event on ONE client, then blows the transaction up on a THIRD
 *    statement, and reads both back through a SEPARATE pool. A dual-write
 *    implementation leaves the event behind; this one must leave nothing.
 *    A positive control follows immediately (same shape, no failure) so a
 *    "nothing ever wrote anything" bug cannot masquerade as a passing rollback.
 * 2. IDEMPOTENCY — that a replayed command cannot double-emit, and that the
 *    SECOND write does not overwrite the first row's facts.
 * 3. RETRY — that a failed delivery genuinely leaves the row owed and that the
 *    row is re-claimed. The failure is injected through an AWAITED delivery
 *    subscriber, because EventBus.publish() is nextTick + swallows handler
 *    errors and can never report a delivery outcome (see the service header).
 * 4. RESTART RECOVERY — that pending state lives in Postgres and not in
 *    process memory: the row is written through one pool, that pool is
 *    DESTROYED, and a genuinely different connection picks the row up.
 *
 * Every assertion reads the row back out of Postgres through a dedicated
 * out-of-band `pg.Pool` (`control`) — never the service's return value alone,
 * which only proves what the service THINKS it wrote.
 *
 * ISOLATION: every test owns a uniquely namespaced organization_id/case_id
 * (randomUUID) and deletes its own rows in a `finally`. The outbox table has
 * no FKs, so no organizations/users/projects fixtures are needed at all —
 * nothing here can collide with a concurrently running suite, and
 * dispatchPendingEvents is always called tenant-scoped so it can never claim
 * another test's (or another suite's) rows.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { withPgTransaction } from '../../../utils/queryHelpers.js';
import * as eventOutboxService from '../eventOutboxService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

/** Reachability AND schema presence are decided once, before the suite is declared. */
const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const outbox = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_event_outbox'
          AND column_name IN ('event_id', 'delivered_at', 'delivery_attempt_count',
                              'last_delivery_error', 'redacted_summary', 'causation_id')`
    );
    const outboxOk = Number(outbox.rows[0]?.present ?? 0) === 6;

    // The atomicity test needs a second case_workspace table to mutate inside
    // the same transaction; case_workspace_history_events is used because it
    // carries no FK, so the test needs no organizations/projects fixture.
    const history = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_history_events'
          AND column_name IN ('event_id', 'organization_id', 'case_id', 'event_type',
                              'actor_id', 'occurred_at', 'summary')`
    );
    const historyOk = Number(history.rows[0]?.present ?? 0) === 7;

    return outboxOk && historyOk;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[eventOutboxService pg suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260810_case_workspace_event_outbox.sql migration applied. requested=${REAL_DB_REQUESTED} ` +
      `reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface OutboxDbRow {
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
  actor_user_id: string;
  correlation_id: string;
  causation_id: string | null;
  correlation_key: string | null;
  sequence_number: number | string;
  occurred_at: Date;
  redacted_summary: Record<string, unknown>;
  payload_ref: string | null;
  delivered_at: Date | null;
  delivery_attempt_count: number;
  last_delivery_error: string | null;
  created_at: Date;
}

suite('eventOutboxService — transactional event outbox against a real PostgreSQL (doc 06 §6/§8)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  afterEach(() => {
    // A leaked throwing subscriber would poison every later test.
    eventOutboxService.clearOutboxDeliverySubscribers();
  });

  // -------------------------------------------------------------------------
  // Fixture helpers — no FK fixtures needed; ids are namespaced per test.
  // -------------------------------------------------------------------------

  function scope(label: string): { orgId: string; caseId: string } {
    const suffix = randomUUID();
    return {
      orgId: `cwevt-org-${label}-${suffix}`,
      caseId: `cwevt-case-${label}-${suffix}`,
    };
  }

  async function teardown(orgIds: string[], caseIds: string[] = []): Promise<void> {
    for (const orgId of orgIds) {
      await control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM case_workspace_history_events WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
    }
    for (const caseId of caseIds) {
      await control
        .query(`DELETE FROM case_workspace_history_events WHERE case_id = $1`, [caseId])
        .catch(() => undefined);
    }
  }

  async function readOutboxRow(eventId: string): Promise<OutboxDbRow | null> {
    const result = await control.query<OutboxDbRow>(
      `SELECT * FROM case_workspace_event_outbox WHERE event_id = $1`,
      [eventId]
    );
    return result.rows[0] ?? null;
  }

  async function countOutboxRowsForOrg(orgId: string): Promise<number> {
    const result = await control.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM case_workspace_event_outbox WHERE organization_id = $1`,
      [orgId]
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  async function countHistoryRows(caseId: string): Promise<number> {
    const result = await control.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM case_workspace_history_events WHERE case_id = $1`,
      [caseId]
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  function envelope(
    orgId: string,
    caseId: string,
    overrides: Partial<eventOutboxService.DomainEventEnvelope> = {}
  ): eventOutboxService.DomainEventEnvelope {
    return {
      eventType: 'case.created',
      organizationId: orgId,
      aggregateType: 'CASE',
      aggregateId: caseId,
      aggregateVersion: 1,
      caseId,
      actorUserId: `cwevt-actor-${randomUUID()}`,
      correlationId: `corr-${randomUUID()}`,
      redactedSummary: { caseStatus: 'DRAFT' },
      ...overrides,
    };
  }

  // =========================================================================
  // 1. ATOMICITY — aggregate mutation + event commit or roll back together.
  // =========================================================================
  it('rolls the outbox row back with the aggregate mutation when the SAME transaction fails later (doc 06 §6 "domain changes and outbox records commit atomically")', async () => {
    const { orgId, caseId } = scope('atomic');
    const doomedEventId = `cwevt-${randomUUID()}`;
    const doomedHistoryId = `cwhist-${randomUUID()}`;
    try {
      // --- the failing transaction ------------------------------------------
      await expect(
        withPgTransaction(async (client) => {
          // (a) aggregate-side mutation
          await client.query(
            `INSERT INTO case_workspace_history_events
               (event_id, organization_id, case_id, event_type, actor_id, occurred_at, summary)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              doomedHistoryId,
              orgId,
              caseId,
              'CASE_STATUS_CHANGED',
              'cwevt-actor-atomic',
              new Date().toISOString(),
              'doomed write',
            ]
          );

          // (b) the event, on the SAME client — this is the whole mechanism
          const published = await eventOutboxService.publishEvent(
            client,
            envelope(orgId, caseId, { eventId: doomedEventId })
          );
          expect(published.deduplicated).toBe(false);

          // Both rows ARE visible inside the transaction before it dies —
          // proving the failure below is what removes them, not that they
          // never landed in the first place.
          const insideOutbox = await client.query<{ n: string }>(
            `SELECT count(*) AS n FROM case_workspace_event_outbox WHERE event_id = ?`,
            [doomedEventId]
          );
          expect(Number(insideOutbox.rows[0].n)).toBe(1);

          // (c) third statement blows the transaction up
          await client.query(`SELECT 1 / 0`);
        })
      ).rejects.toThrow();

      // --- verified from OUTSIDE the transaction, on a separate pool --------
      expect(await readOutboxRow(doomedEventId)).toBeNull();
      expect(await countOutboxRowsForOrg(orgId)).toBe(0);
      expect(await countHistoryRows(caseId)).toBe(0);

      // --- POSITIVE CONTROL -------------------------------------------------
      // Identical shape, no failure. Without this, a service that silently
      // wrote nothing at all would pass the rollback assertions above.
      const goodEventId = `cwevt-${randomUUID()}`;
      const goodHistoryId = `cwhist-${randomUUID()}`;
      await withPgTransaction(async (client) => {
        await client.query(
          `INSERT INTO case_workspace_history_events
             (event_id, organization_id, case_id, event_type, actor_id, occurred_at, summary)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            goodHistoryId,
            orgId,
            caseId,
            'CASE_STATUS_CHANGED',
            'cwevt-actor-atomic',
            new Date().toISOString(),
            'committed write',
          ]
        );
        await eventOutboxService.publishEvent(
          client,
          envelope(orgId, caseId, { eventId: goodEventId })
        );
      });

      const committed = await readOutboxRow(goodEventId);
      expect(committed).not.toBeNull();
      expect(committed?.organization_id).toBe(orgId);
      expect(committed?.delivered_at).toBeNull();
      expect(Number(committed?.delivery_attempt_count)).toBe(0);
      expect(await countHistoryRows(caseId)).toBe(1);
    } finally {
      await teardown([orgId], [caseId]);
    }
  }, 30_000);

  // =========================================================================
  // 2. IDEMPOTENCY — the same eventId can never produce a second row.
  // =========================================================================
  it('publishing the same eventId twice (in two separate transactions) leaves exactly one row and reports deduplicated on the second call (doc 06 §8)', async () => {
    const { orgId, caseId } = scope('dedupe');
    const eventId = `cwevt-${randomUUID()}`;
    try {
      const first = await withPgTransaction((client) =>
        eventOutboxService.publishEvent(
          client,
          envelope(orgId, caseId, {
            eventId,
            eventType: 'case.created',
            redactedSummary: { attempt: 'first' },
          })
        )
      );
      expect(first).toEqual({ eventId, deduplicated: false });

      const second = await withPgTransaction((client) =>
        eventOutboxService.publishEvent(
          client,
          envelope(orgId, caseId, {
            eventId,
            // Deliberately DIFFERENT facts: a DO NOTHING that quietly became a
            // DO UPDATE would show up right here.
            eventType: 'case.cancelled',
            redactedSummary: { attempt: 'second' },
          })
        )
      );
      expect(second).toEqual({ eventId, deduplicated: true });

      expect(await countOutboxRowsForOrg(orgId)).toBe(1);
      const stored = await readOutboxRow(eventId);
      expect(stored?.event_type).toBe('case.created');
      expect(stored?.redacted_summary).toEqual({ attempt: 'first' });
    } finally {
      await teardown([orgId], [caseId]);
    }
  }, 30_000);

  // =========================================================================
  // 3. DISPATCH + RETRY — a failed delivery stays owed and is re-claimed.
  // =========================================================================
  it('dispatchPendingEvents marks a delivered row, leaves a failed row pending with a growing attempt count, and delivers it on a later pass (doc 06 §8 retry)', async () => {
    const { orgId, caseId } = scope('dispatch');
    const okEventId = `cwevt-${randomUUID()}`;
    const failingEventId = `cwevt-${randomUUID()}`;
    try {
      // --- happy path -------------------------------------------------------
      const seen: string[] = [];
      const unsubscribeOk = eventOutboxService.subscribeToOutboxDelivery((event) => {
        seen.push(event.eventId);
      });

      await withPgTransaction((client) =>
        eventOutboxService.publishEvent(client, envelope(orgId, caseId, { eventId: okEventId }))
      );

      const firstPass = await eventOutboxService.dispatchPendingEvents({ organizationId: orgId });
      expect(firstPass).toMatchObject({ claimed: 1, delivered: 1, failed: 0 });
      expect(seen).toEqual([okEventId]);

      const deliveredRow = await readOutboxRow(okEventId);
      expect(deliveredRow?.delivered_at).not.toBeNull();
      expect(Number(deliveredRow?.delivery_attempt_count)).toBe(0);
      expect(deliveredRow?.last_delivery_error).toBeNull();

      // An already-delivered row is never claimed again.
      const idlePass = await eventOutboxService.dispatchPendingEvents({ organizationId: orgId });
      expect(idlePass).toMatchObject({ claimed: 0, delivered: 0, failed: 0 });

      unsubscribeOk();

      // --- failing consumer -------------------------------------------------
      const unsubscribeFailing = eventOutboxService.subscribeToOutboxDelivery(() => {
        throw new Error('consumer_projection_unavailable');
      });

      await withPgTransaction((client) =>
        eventOutboxService.publishEvent(
          client,
          envelope(orgId, caseId, { eventId: failingEventId, eventType: 'case.activated' })
        )
      );

      // Captured BEFORE the failing dispatch call so the timing assertion
      // below is monotonic and immune to how slow/loaded the machine running
      // this suite is — it only needs "scheduled after this instant", never
      // "scheduled within N ms of some later read", which is what made an
      // earlier version of this assertion flaky under a heavily loaded
      // shared Postgres (observed: a >4s gap between publish and the
      // failure being recorded, purely from host contention).
      const beforeFailingPassMs = Date.now();
      const failingPass = await eventOutboxService.dispatchPendingEvents({
        organizationId: orgId,
      });
      expect(failingPass).toMatchObject({ claimed: 1, delivered: 0, failed: 1 });
      expect(failingPass.failedEventIds).toEqual([failingEventId]);

      const afterFirstFailure = await readOutboxRow(failingEventId);
      expect(afterFirstFailure?.delivered_at).toBeNull(); // still owed — THIS is the retry
      expect(Number(afterFirstFailure?.delivery_attempt_count)).toBe(1);
      expect(afterFirstFailure?.last_delivery_error).toContain('consumer_projection_unavailable');
      // §8 PER-ROW backoff (server/migrations/
      // 20260812a_case_workspace_outbox_next_retry_at.sql): the failure UPDATE
      // now ALSO schedules next_retry_at, computeRetryBackoffMs(1) in the future
      // relative to when the failure was actually recorded.
      expect(afterFirstFailure?.next_retry_at).not.toBeNull();
      const scheduledRetryMs = new Date(afterFirstFailure!.next_retry_at as unknown as string).getTime();
      // Monotonic lower bound only: the row's own scheduling logic runs
      // `now() + computeRetryBackoffMs(1)` no earlier than this call started.
      expect(scheduledRetryMs).toBeGreaterThanOrEqual(beforeFailingPassMs + eventOutboxService.computeRetryBackoffMs(1));

      // THE DECISIVE BACKOFF ASSERTION: a row still inside its backoff window
      // must NOT be reclaimed — before this migration/change, a failed row
      // was reclaimable on the very next tick with no delay whatsoever,
      // which is exactly the "backoff is per-tick, not per-row" gap this
      // packet closes. Pinned an hour into the future via raw SQL (rather
      // than relying on the real ~1s RETRY_BACKOFF_BASE_MS window and an
      // "immediate" re-dispatch call) so this assertion is deterministic
      // regardless of how slow/loaded the machine running this suite is —
      // the scheduling-at-write-time behavior is already asserted just
      // above via `scheduledRetryMs`; this half only needs to prove the
      // CLAIM QUERY actually honors next_retry_at, which it does regardless
      // of which future instant is stored there.
      await control.query(
        `UPDATE case_workspace_event_outbox SET next_retry_at = now() + interval '1 hour' WHERE event_id = $1`,
        [failingEventId]
      );
      const withinBackoffRedispatch = await eventOutboxService.dispatchPendingEvents({
        organizationId: orgId,
      });
      expect(withinBackoffRedispatch).toMatchObject({ claimed: 0, delivered: 0, failed: 0 });
      const stillAtOneAttempt = await readOutboxRow(failingEventId);
      expect(Number(stillAtOneAttempt?.delivery_attempt_count)).toBe(1);

      // Fast-forward the backoff window directly in Postgres (no real sleep):
      // next_retry_at is one of the four columns the append-only guard
      // trigger (widened by this same migration) allows to change, from ANY
      // connection — exactly what a human/ops "retry now" action would do.
      await control.query(
        `UPDATE case_workspace_event_outbox SET next_retry_at = now() - interval '1 second' WHERE event_id = $1`,
        [failingEventId]
      );

      // NOW it is eligible again, and the counter grows on this SECOND real
      // attempt.
      const secondFailingPass = await eventOutboxService.dispatchPendingEvents({
        organizationId: orgId,
      });
      expect(secondFailingPass).toMatchObject({ claimed: 1, delivered: 0, failed: 1 });
      const afterSecondFailure = await readOutboxRow(failingEventId);
      expect(afterSecondFailure?.delivered_at).toBeNull();
      expect(Number(afterSecondFailure?.delivery_attempt_count)).toBe(2);
      // The SECOND failure's backoff must be LONGER than the first
      // (exponential growth) — computeRetryBackoffMs(2) > computeRetryBackoffMs(1).
      expect(eventOutboxService.computeRetryBackoffMs(2)).toBeGreaterThan(
        eventOutboxService.computeRetryBackoffMs(1)
      );
      const secondScheduledRetryMs = new Date(
        afterSecondFailure!.next_retry_at as unknown as string
      ).getTime();
      expect(secondScheduledRetryMs).toBeGreaterThan(scheduledRetryMs);

      // --- consumer recovers ------------------------------------------------
      unsubscribeFailing();
      const recovered: string[] = [];
      eventOutboxService.subscribeToOutboxDelivery((event) => {
        recovered.push(event.eventId);
      });

      // Fast-forward the second (longer) backoff window too — same "ops
      // retry now" shape as above, otherwise this recovery pass would itself
      // be correctly withheld by the still-future next_retry_at.
      await control.query(
        `UPDATE case_workspace_event_outbox SET next_retry_at = now() - interval '1 second' WHERE event_id = $1`,
        [failingEventId]
      );

      const recoveryPass = await eventOutboxService.dispatchPendingEvents({
        organizationId: orgId,
      });
      expect(recoveryPass).toMatchObject({ claimed: 1, delivered: 1, failed: 0 });
      expect(recovered).toEqual([failingEventId]);

      const finalRow = await readOutboxRow(failingEventId);
      expect(finalRow?.delivered_at).not.toBeNull();
      expect(finalRow?.last_delivery_error).toBeNull();
      // The attempt history is preserved — retries are auditable, not erased.
      expect(Number(finalRow?.delivery_attempt_count)).toBe(2);
      // A delivered row's backoff schedule is cleared — it is no longer
      // meaningful once delivered_at is set (the claim query's own
      // `delivered_at IS NULL` guard already excludes it either way, but a
      // stale future next_retry_at on a delivered row would be a confusing
      // read for reconciliation/operator tooling).
      expect(finalRow?.next_retry_at).toBeNull();
    } finally {
      await teardown([orgId], [caseId]);
    }
  }, 60_000);

  // =========================================================================
  // 4. RESTART RECOVERY — pending state lives in Postgres, not in memory.
  // =========================================================================
  it('an event written through one pool that is then DESTROYED is still claimed and delivered by a genuinely different connection (doc 06 §8 recovery)', async () => {
    const { orgId, caseId } = scope('restart');
    const eventId = `cwevt-${randomUUID()}`;
    try {
      // --- "process A": its own pool, own pooled client, own transaction ----
      const writerPool = new Pool({ connectionString: CONNECTION_STRING, max: 1 });
      const writerClient = await writerPool.connect();
      try {
        await writerClient.query('BEGIN');
        // publishEvent accepts either transaction-client shape; a raw pg
        // PoolClient is the withRawPgTransaction()-flavored one. The tiny
        // adapter below exists only to satisfy pg's generic query() overloads,
        // it changes no behaviour.
        const published = await eventOutboxService.publishEvent(
          {
            query: (sql: string, params?: unknown[]) =>
              writerClient.query(sql, params as unknown[]) as Promise<{
                rows: any[];
                rowCount: number | null;
              }>,
          },
          envelope(orgId, caseId, { eventId, eventType: 'case.plan.published' })
        );
        expect(published.deduplicated).toBe(false);
        await writerClient.query('COMMIT');
      } finally {
        writerClient.release();
      }
      // "Process A" dies here — every connection it ever held is gone.
      await writerPool.end();

      const pendingRow = await readOutboxRow(eventId);
      expect(pendingRow).not.toBeNull();
      expect(pendingRow?.delivered_at).toBeNull();

      const backlogBefore = await eventOutboxService.getOutboxBacklog({ organizationId: orgId });
      expect(backlogBefore.pending).toBe(1);

      // --- "process B": brand new connection, no shared in-memory state -----
      const delivered: string[] = [];
      eventOutboxService.subscribeToOutboxDelivery((event) => {
        delivered.push(event.eventId);
      });

      const pass = await eventOutboxService.dispatchPendingEvents({ organizationId: orgId });
      expect(pass).toMatchObject({ claimed: 1, delivered: 1, failed: 0 });
      expect(delivered).toEqual([eventId]);

      const afterRow = await readOutboxRow(eventId);
      expect(afterRow?.delivered_at).not.toBeNull();

      const backlogAfter = await eventOutboxService.getOutboxBacklog({ organizationId: orgId });
      expect(backlogAfter.pending).toBe(0);
    } finally {
      await teardown([orgId], [caseId]);
    }
  }, 60_000);

  // =========================================================================
  // 5. REDACTION + SIZE CEILING — §6 "events carry facts, not payloads".
  // =========================================================================
  it('redacts PII out of redactedSummary before it reaches the table and refuses an oversized summary (doc 06 §6, §13 redaction gate)', async () => {
    const { orgId, caseId } = scope('redact');
    const eventId = `cwevt-${randomUUID()}`;
    try {
      await withPgTransaction((client) =>
        eventOutboxService.publishEvent(
          client,
          envelope(orgId, caseId, {
            eventId,
            redactedSummary: {
              caseStatus: 'ACTIVE',
              approver: { email: 'client.cfo@example.com', name: 'Jan Kowalski' },
              access_token: 'aaa.bbb.ccc',
              note: 'ping client.cfo@example.com about the tier change',
            },
            payloadRef: 'artifact:rev:abc123',
          })
        )
      );

      const stored = await readOutboxRow(eventId);
      const summary = stored?.redacted_summary as Record<string, any>;
      expect(summary.caseStatus).toBe('ACTIVE');
      expect(summary.approver.email).toBe('[REDACTED]');
      expect(summary.approver.name).toBe('[REDACTED]');
      expect(summary.access_token).toBe('[REDACTED]');
      expect(JSON.stringify(summary)).not.toContain('client.cfo@example.com');
      expect(JSON.stringify(summary)).not.toContain('Kowalski');
      // The full payload is referenced, not copied.
      expect(stored?.payload_ref).toBe('artifact:rev:abc123');

      // A whole document does not become an event.
      await expect(
        withPgTransaction((client) =>
          eventOutboxService.publishEvent(
            client,
            envelope(orgId, caseId, {
              eventId: `cwevt-${randomUUID()}`,
              redactedSummary: { document: 'x'.repeat(eventOutboxService.MAX_REDACTED_SUMMARY_BYTES + 1) },
            })
          )
        )
      ).rejects.toThrow(/event_outbox_redacted_summary_too_large/);

      expect(await countOutboxRowsForOrg(orgId)).toBe(1);
    } finally {
      await teardown([orgId], [caseId]);
    }
  }, 30_000);

  // =========================================================================
  // 6. REPLAY — read-only, ordered by aggregate version, no side effects.
  // =========================================================================
  it('replayEventsForAggregate returns one aggregate\'s events in aggregate-version order and changes nothing (doc 06 §8 ordering)', async () => {
    const { orgId, caseId } = scope('replay');
    const otherAggregateId = `cwevt-other-${randomUUID()}`;
    try {
      // Inserted out of order on purpose.
      for (const version of [3, 1, 2]) {
        await withPgTransaction((client) =>
          eventOutboxService.publishEvent(
            client,
            envelope(orgId, caseId, {
              eventId: `cwevt-${randomUUID()}`,
              eventType: `case.step_${version}`,
              aggregateVersion: version,
            })
          )
        );
      }
      // A different aggregate in the same org must not leak into the replay.
      await withPgTransaction((client) =>
        eventOutboxService.publishEvent(
          client,
          envelope(orgId, caseId, {
            eventId: `cwevt-${randomUUID()}`,
            eventType: 'proposal.created',
            aggregateType: 'ACTION_PROPOSAL',
            aggregateId: otherAggregateId,
            aggregateVersion: 1,
          })
        )
      );

      const replayed = await eventOutboxService.replayEventsForAggregate('CASE', caseId, {
        organizationId: orgId,
      });
      expect(replayed.map((event) => event.eventType)).toEqual([
        'case.step_1',
        'case.step_2',
        'case.step_3',
      ]);
      expect(replayed.every((event) => event.deliveredAt === null)).toBe(true);

      // Read-only: a replay must not deliver, claim or touch anything.
      const pendingAfterReplay = await control.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM case_workspace_event_outbox
          WHERE organization_id = $1 AND delivered_at IS NULL`,
        [orgId]
      );
      expect(Number(pendingAfterReplay.rows[0].n)).toBe(4);
    } finally {
      await teardown([orgId], [caseId]);
    }
  }, 60_000);

  // =========================================================================
  // 7. CW-T-E, Problem 1 — the correlation_key column persists exactly what
  //    the producer supplies, and stays NULL when omitted (the common case).
  // =========================================================================
  it('correlationKey is persisted verbatim when supplied, and stays NULL when the producer does not supply one (CW-T-E, 20260810e migration)', async () => {
    const { orgId, caseId } = scope('correlation-key');
    const boundEventId = `cwevt-${randomUUID()}`;
    const unboundEventId = `cwevt-${randomUUID()}`;
    try {
      await withPgTransaction((client) =>
        eventOutboxService.publishEvent(
          client,
          envelope(orgId, caseId, {
            eventId: boundEventId,
            eventType: 'capability.completed',
            correlationKey: 'corr-wait-binding-example',
          })
        )
      );
      await withPgTransaction((client) =>
        eventOutboxService.publishEvent(
          client,
          envelope(orgId, caseId, { eventId: unboundEventId, eventType: 'case.activated' })
        )
      );

      const bound = await readOutboxRow(boundEventId);
      expect(bound?.correlation_key).toBe('corr-wait-binding-example');
      const unbound = await readOutboxRow(unboundEventId);
      expect(unbound?.correlation_key).toBeNull();

      // Round-trips through the public read API too, camelCased.
      const fetched = await eventOutboxService.getOutboxEvent(boundEventId);
      expect(fetched?.correlationKey).toBe('corr-wait-binding-example');
      const fetchedUnbound = await eventOutboxService.getOutboxEvent(unboundEventId);
      expect(fetchedUnbound?.correlationKey).toBeNull();
    } finally {
      await teardown([orgId], [caseId]);
    }
  }, 30_000);

  // =========================================================================
  // 8. CW-T-E — sequence_number is a true, tie-free insertion order, and both
  //    dispatchPendingEvents' claim order and replayEventsForAggregate's
  //    tie-break use it.
  // =========================================================================
  it('sequence_number orders events by true insertion order, and dispatchPendingEvents claims (hence delivers) in that exact order (CW-T-E "kolejnosc deterministyczna")', async () => {
    const { orgId, caseId } = scope('sequence-order');
    try {
      const eventIds: string[] = [];
      // Published strictly sequentially (await-in-a-loop), so insertion order
      // is unambiguous ground truth regardless of what created_at happens to
      // read as under clock-resolution pressure.
      for (let i = 0; i < 6; i += 1) {
        const eventId = `cwevt-${randomUUID()}`;
        eventIds.push(eventId);
        await withPgTransaction((client) =>
          eventOutboxService.publishEvent(
            client,
            envelope(orgId, caseId, { eventId, eventType: `case.step_${i}` })
          )
        );
      }

      const rows = await control.query<{ event_id: string; sequence_number: string }>(
        `SELECT event_id, sequence_number FROM case_workspace_event_outbox
          WHERE organization_id = $1 ORDER BY sequence_number ASC`,
        [orgId]
      );
      expect(rows.rows.map((r) => r.event_id)).toEqual(eventIds);
      // Strictly increasing, no ties — the entire point of the column.
      const sequenceNumbers = rows.rows.map((r) => Number(r.sequence_number));
      for (let i = 1; i < sequenceNumbers.length; i += 1) {
        expect(sequenceNumbers[i]).toBeGreaterThan(sequenceNumbers[i - 1]);
      }

      const delivered: string[] = [];
      eventOutboxService.subscribeToOutboxDelivery((event) => {
        delivered.push(event.eventId);
      });
      const pass = await eventOutboxService.dispatchPendingEvents({
        organizationId: orgId,
        batchSize: eventIds.length,
      });
      expect(pass).toMatchObject({ claimed: eventIds.length, delivered: eventIds.length, failed: 0 });
      // Delivered in EXACTLY insertion order — the claim query's own ORDER BY.
      expect(delivered).toEqual(eventIds);
    } finally {
      await teardown([orgId], [caseId]);
    }
  }, 30_000);

  // =========================================================================
  // 9. countDeadLetterEvents — the cheap companion to listDeadLetterEvents,
  //    proved to agree with it exactly (CW-T-E worker diagnostics).
  // =========================================================================
  it('countDeadLetterEvents agrees with listDeadLetterEvents, and both are empty before the threshold is crossed', async () => {
    const { orgId, caseId } = scope('dead-letter-count');
    const eventId = `cwevt-${randomUUID()}`;
    try {
      await withPgTransaction((client) =>
        eventOutboxService.publishEvent(
          client,
          envelope(orgId, caseId, { eventId, eventType: 'case.step_permafail' })
        )
      );

      const unsubscribe = eventOutboxService.subscribeToOutboxDelivery(() => {
        throw new Error('cwt_e_permanent_failure');
      });

      for (let attempt = 0; attempt < eventOutboxService.DEAD_LETTER_ATTEMPT_THRESHOLD - 1; attempt += 1) {
        // §8 PER-ROW backoff: bypass this row's own next_retry_at between
        // iterations (same "ops retry now" shape used throughout this
        // packet's tests) — a fresh row has none, so the FIRST iteration
        // needs no fast-forward.
        if (attempt > 0) {
          await control.query(
            `UPDATE case_workspace_event_outbox SET next_retry_at = now() - interval '1 second' WHERE event_id = $1`,
            [eventId]
          );
        }
        await eventOutboxService.dispatchPendingEvents({ organizationId: orgId });
        expect(await eventOutboxService.countDeadLetterEvents({ organizationId: orgId })).toBe(0);
      }

      // The Nth failure crosses the threshold.
      await control.query(
        `UPDATE case_workspace_event_outbox SET next_retry_at = now() - interval '1 second' WHERE event_id = $1`,
        [eventId]
      );
      await eventOutboxService.dispatchPendingEvents({ organizationId: orgId });
      const count = await eventOutboxService.countDeadLetterEvents({ organizationId: orgId });
      expect(count).toBe(1);
      const rows = await eventOutboxService.listDeadLetterEvents({ organizationId: orgId });
      expect(rows.map((r) => r.eventId)).toEqual([eventId]);
      expect(rows).toHaveLength(count);

      unsubscribe();
    } finally {
      await teardown([orgId], [caseId]);
    }
  }, 30_000);
});
