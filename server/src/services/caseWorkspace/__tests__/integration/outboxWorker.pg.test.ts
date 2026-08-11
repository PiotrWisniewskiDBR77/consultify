/**
 * Case Workspace — the PRODUCTION OUTBOX WORKER, proved against a REAL
 * PostgreSQL (CW-T-E, Problem 2). Exercises
 * server/src/services/caseWorkspace/outboxWorker.ts on top of
 * server/src/services/caseWorkspace/eventOutboxService.ts and
 * server/migrations/20260810_case_workspace_event_outbox.sql +
 * 20260810e_case_workspace_event_correlation.sql (sequence_number).
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * Same convention as eventOutboxService.pg.test.ts / waitSubscriptionService.
 * pg.test.ts: `NODE_ENV=test` ALONE is a trap (Database.ts hands back an
 * in-memory MOCK unless RUN_DB_TESTS=1 && MOCK_DB=false). Gate on that, probe
 * reachability AND schema presence, and SKIP LOUDLY when either is missing.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run \
 *   src/services/caseWorkspace/__tests__/integration/outboxWorker.pg.test.ts \
 *   --environment node
 *
 * ===========================================================================
 * WHAT THIS SUITE IS ACTUALLY TRYING TO DISPROVE
 * ===========================================================================
 * 1. FAILURE INJECTION + DEAD-LETTER — a durable consumer that always throws
 *    drives a row to DEAD_LETTER_ATTEMPT_THRESHOLD attempts, at which point
 *    the worker stops claiming it (never a silent infinite retry loop) and
 *    it becomes visible as reconciliation work.
 * 2. CONCURRENT DELIVERY — two ticks (standing in for two worker processes)
 *    racing the SAME pending batch never both deliver the same event: `FOR
 *    UPDATE SKIP LOCKED` on the SHARED claim query is what outboxWorker.ts
 *    relies on rather than reimplementing its own locking.
 * 3. RESTART RECOVERY — a worker is started, delivers something, is fully
 *    stopped AND has its in-process metrics reset (simulating a genuinely
 *    new process), and a fresh start recovers whatever was published while
 *    it was down — with NO redelivery of what already went out.
 * 4. NO DUPLICATE EFFECT ON REPLAY — an already-delivered row is never
 *    reclaimed by a later tick, so a durable consumer counts each event
 *    exactly once across any number of ticks.
 * 5. TICK METRICS — runOutboxWorkerTick()'s own return value and
 *    getOutboxWorkerMetrics() agree with what Postgres actually recorded.
 *
 * ===========================================================================
 * ADDED IN CW-T-E / B4 (perf, dead-letter recovery, observability)
 * ===========================================================================
 * 6. STUCK LEASE RECOVERY — this design has no lease/lock-expiry column at
 *    all (claim + deliver + mark happen inside ONE short transaction), so a
 *    dispatcher that crashes mid-claim has Postgres release its row locks
 *    the instant its connection dies. This case proves that literally: a
 *    manually-opened, never-committed claim transaction is killed mid-flight
 *    with `pg_terminate_backend`, and the very next tick recovers its row
 *    immediately — no lease-expiry wait of any kind — while a concurrent
 *    tick, run WHILE the stuck transaction was still open, already proved
 *    `SKIP LOCKED` lets every OTHER row through regardless.
 * 7. TICK WATCHDOG — a durable consumer whose promise hangs past
 *    `tickTimeoutMs` does not block `runOutboxWorkerTick()` from returning
 *    (`timedOut: true`), and once the hung consumer is finally released, its
 *    real outcome still lands in `getOutboxWorkerMetrics()`'s cumulative
 *    totals.
 * 8. ADAPTIVE BACKOFF — `getOutboxWorkerMetrics().currentBackoffMultiplier`
 *    doubles across consecutive failing ticks (capped) and resets to 1 on
 *    the next clean tick.
 * 9. RECONCILIATION SWEEP — `runOutboxReconciliationSweep()` surfaces the
 *    actual dead-lettered rows (event id/type/attempt count/last error), not
 *    just a count, and mirrors them onto `getOutboxWorkerMetrics()`.
 * 10. QUEUE LAG (TIME) — `oldestPendingAgeSeconds` (not just the row-count
 *     backlog) is `null` when idle, positive while something ages, and
 *     `null` again once fully drained.
 *
 * ISOLATION: every test owns a uniquely namespaced organization_id
 * (randomUUID) and scopes every worker call to it via `organizationId`, so
 * concurrently running suites (and this repo's other CW-T-* packets writing
 * to the same FK-less outbox table) can never be claimed by this suite's
 * ticks or vice versa.
 */

import { randomUUID } from 'node:crypto';

import { Client, Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { withPgTransaction } from '../../../../utils/queryHelpers.js';
import * as eventOutboxService from '../../eventOutboxService.js';
import * as outboxWorker from '../../outboxWorker.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const outbox = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_event_outbox'
          AND column_name IN ('event_id', 'delivered_at', 'delivery_attempt_count',
                              'correlation_key', 'sequence_number')`
    );
    return Number(outbox.rows[0]?.present ?? 0) === 5;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[outboxWorker pg suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and ` +
      `20260810_case_workspace_event_outbox.sql + 20260810e_case_workspace_event_correlation.sql applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface OutboxDbRow {
  event_id: string;
  delivered_at: Date | null;
  delivery_attempt_count: number;
}

suite('outboxWorker — the production outbox worker against a real PostgreSQL (CW-T-E, Problem 2)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  afterEach(() => {
    // A leaked interval or a leaked throwing subscriber would poison every
    // later test in this file (and, since EventBus/subscribers are
    // module-level singletons, potentially other files run in this process).
    outboxWorker._resetOutboxWorkerForTests();
    eventOutboxService.clearOutboxDeliverySubscribers();
  });

  function scope(label: string): { orgId: string; caseId: string } {
    const suffix = randomUUID();
    return {
      orgId: `cwworker-org-${label}-${suffix}`,
      caseId: `cwworker-case-${label}-${suffix}`,
    };
  }

  /**
   * NOTE (discovered running this suite for real, CW-T-E / B4): as of
   * server/migrations/20260810f_case_workspace_append_only_guards.sql — a
   * migration outside this packet's allowlist, landed by a sibling packet —
   * `case_workspace_event_outbox` has a real, DB-level `BEFORE DELETE`
   * trigger that unconditionally `RAISE EXCEPTION`s on every delete (§9
   * audit-survives guarantee: the outbox is append-only FACTS, mutable only
   * in `delivered_at`/`delivery_attempt_count`/`last_delivery_error`). This
   * DELETE therefore ALWAYS fails now and the `.catch()` below always
   * swallows it — this function has been a no-op since that migration
   * landed, for every `*.pg.test.ts` in this repo that ever called it, not
   * just this file. It is kept only so a future relaxation of that guard
   * (or a partition/retention job) makes cleanup start working again for
   * free. Correctness is unaffected: every org id here is a fresh
   * `randomUUID()`, so rows accumulating forever cannot collide with a later
   * run — but the shared `case_workspace_test` database DOES grow
   * unboundedly across every test run in this suite. Flagged in this
   * packet's report as a genuine, previously-undocumented finding — not
   * fixed here (`eventOutboxService.ts` and `server/migrations/**` are both
   * outside this packet's allowlist).
   */
  async function teardown(orgId: string): Promise<void> {
    await control
      .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
      .catch(() => undefined);
  }

  async function publish(
    orgId: string,
    caseId: string,
    overrides: Partial<eventOutboxService.DomainEventEnvelope> = {}
  ): Promise<string> {
    const eventId = overrides.eventId ?? `cwevt-${randomUUID()}`;
    await withPgTransaction((client) =>
      eventOutboxService.publishEvent(client, {
        eventType: 'case.created',
        organizationId: orgId,
        aggregateType: 'CASE',
        aggregateId: caseId,
        caseId,
        actorUserId: `cwworker-actor-${randomUUID()}`,
        redactedSummary: { caseStatus: 'DRAFT' },
        ...overrides,
        eventId,
      })
    );
    return eventId;
  }

  async function readRow(eventId: string): Promise<OutboxDbRow | null> {
    const result = await control.query<OutboxDbRow>(
      `SELECT event_id, delivered_at, delivery_attempt_count
         FROM case_workspace_event_outbox WHERE event_id = $1`,
      [eventId]
    );
    return result.rows[0] ?? null;
  }

  // =========================================================================
  // 1. TICK METRICS — runOutboxWorkerTick()'s return value and
  //    getOutboxWorkerMetrics() both agree with Postgres.
  // =========================================================================
  it('runOutboxWorkerTick delivers pending events, reports accurate backlog/dead-letter counts, and accumulates into getOutboxWorkerMetrics()', async () => {
    const { orgId, caseId } = scope('tick-metrics');
    try {
      const delivered: string[] = [];
      eventOutboxService.subscribeToOutboxDelivery((event) => {
        delivered.push(event.eventId);
      });

      const idBefore = await publish(orgId, caseId);
      const backlogBefore = await eventOutboxService.getOutboxBacklog({ organizationId: orgId });
      expect(backlogBefore.pending).toBe(1);

      const tick = await outboxWorker.runOutboxWorkerTick({ organizationId: orgId });
      expect(tick).toMatchObject({ claimed: 1, delivered: 1, failed: 0, deadLetterCount: 0 });
      expect(tick.pendingBacklog).toBe(0);
      expect(delivered).toEqual([idBefore]);

      const metrics = outboxWorker.getOutboxWorkerMetrics();
      expect(metrics.ticks).toBe(1);
      expect(metrics.totalClaimed).toBe(1);
      expect(metrics.totalDelivered).toBe(1);
      expect(metrics.totalFailed).toBe(0);
      expect(metrics.consecutiveTickErrors).toBe(0);
      expect(metrics.lastTickResult).toMatchObject({ claimed: 1, delivered: 1 });

      // An idle tick claims nothing and still updates the tick counter.
      const idleTick = await outboxWorker.runOutboxWorkerTick({ organizationId: orgId });
      expect(idleTick).toMatchObject({ claimed: 0, delivered: 0, failed: 0 });
      expect(outboxWorker.getOutboxWorkerMetrics().ticks).toBe(2);
      // NO DUPLICATE EFFECT: the delivery handler was never invoked a second
      // time for the same event across two ticks.
      expect(delivered).toEqual([idBefore]);
    } finally {
      await teardown(orgId);
    }
  }, 30_000);

  // =========================================================================
  // 2. FAILURE INJECTION + DEAD-LETTER after DEAD_LETTER_ATTEMPT_THRESHOLD.
  // =========================================================================
  it('a permanently-failing consumer drives a row to dead-letter after DEAD_LETTER_ATTEMPT_THRESHOLD attempts, and the worker stops claiming it', async () => {
    const { orgId, caseId } = scope('dead-letter');
    try {
      eventOutboxService.subscribeToOutboxDelivery(() => {
        throw new Error('cwworker_permanent_consumer_failure');
      });

      const eventId = await publish(orgId, caseId, { eventType: 'case.activated' });

      for (let attempt = 1; attempt <= eventOutboxService.DEAD_LETTER_ATTEMPT_THRESHOLD; attempt += 1) {
        const tick = await outboxWorker.runOutboxWorkerTick({ organizationId: orgId });
        expect(tick).toMatchObject({ claimed: 1, delivered: 0, failed: 1 });
        const row = await readRow(eventId);
        expect(row?.delivered_at).toBeNull();
        expect(Number(row?.delivery_attempt_count)).toBe(attempt);
      }

      // One more attempt count than the threshold allows: the row must no
      // longer be claimable — a stuck consumer must not retry forever.
      const afterThreshold = await outboxWorker.runOutboxWorkerTick({ organizationId: orgId });
      expect(afterThreshold).toMatchObject({ claimed: 0, delivered: 0, failed: 0 });
      expect(afterThreshold.deadLetterCount).toBe(1);

      const count = await eventOutboxService.countDeadLetterEvents({ organizationId: orgId });
      expect(count).toBe(1);
      const deadLettered = await eventOutboxService.listDeadLetterEvents({ organizationId: orgId });
      expect(deadLettered.map((e) => e.eventId)).toEqual([eventId]);

      // Dead-lettering is durable, not merely a same-tick artifact: it still
      // reads as dead-lettered (and still uncleaimed) one more tick later.
      const oneMoreTick = await outboxWorker.runOutboxWorkerTick({ organizationId: orgId });
      expect(oneMoreTick).toMatchObject({ claimed: 0, delivered: 0, failed: 0 });
      expect(oneMoreTick.deadLetterCount).toBe(1);

      const finalRow = await readRow(eventId);
      expect(finalRow?.delivered_at).toBeNull();
      expect(Number(finalRow?.delivery_attempt_count)).toBe(
        eventOutboxService.DEAD_LETTER_ATTEMPT_THRESHOLD
      );
    } finally {
      await teardown(orgId);
    }
  }, 60_000);

  // =========================================================================
  // 3. CONCURRENT DELIVERY — two ticks racing the same batch never
  //    double-deliver the same event.
  // =========================================================================
  it('two concurrent ticks (standing in for two worker processes) racing the same pending batch deliver every event exactly once, with no double-delivery', async () => {
    const { orgId, caseId } = scope('concurrent');
    try {
      const deliveredBy: Record<string, number> = {};
      eventOutboxService.subscribeToOutboxDelivery((event) => {
        deliveredBy[event.eventId] = (deliveredBy[event.eventId] ?? 0) + 1;
      });

      const eventIds: string[] = [];
      for (let i = 0; i < 8; i += 1) {
        eventIds.push(await publish(orgId, caseId, { eventType: `case.step_${i}` }));
      }

      // Genuinely concurrent: both ticks issue their claim query before
      // either commits. `FOR UPDATE SKIP LOCKED` (eventOutboxService.ts) is
      // what makes this safe — outboxWorker.ts adds no locking of its own.
      const [tickA, tickB] = await Promise.all([
        outboxWorker.runOutboxWorkerTick({ organizationId: orgId, batchSize: 5 }),
        outboxWorker.runOutboxWorkerTick({ organizationId: orgId, batchSize: 5 }),
      ]);

      // Together they claimed everything, with NO overlap (SKIP LOCKED means
      // a row claimed by one tick is invisible to the other's claim query,
      // never double-counted as `claimed` by both).
      expect(tickA.claimed + tickB.claimed).toBe(eventIds.length);
      expect(tickA.delivered + tickB.delivered).toBe(eventIds.length);

      // The decisive assertion: every event's delivery handler ran EXACTLY
      // once, never twice — the actual "no duplicate effect" property, not
      // just a row-count coincidence.
      for (const eventId of eventIds) {
        expect(deliveredBy[eventId]).toBe(1);
      }

      const finalBacklog = await eventOutboxService.getOutboxBacklog({ organizationId: orgId });
      expect(finalBacklog.pending).toBe(0);
    } finally {
      await teardown(orgId);
    }
  }, 60_000);

  // =========================================================================
  // 4. RESTART RECOVERY — full stop + in-process state reset (simulating a
  //    genuinely new process), then a fresh start recovers what was pending.
  // =========================================================================
  it('a worker that is fully stopped (simulating a crash/restart) is recovered by a freshly-started one, with no redelivery of what already went out', async () => {
    const { orgId, caseId } = scope('restart');
    try {
      const deliveredBy: Record<string, number> = {};
      eventOutboxService.subscribeToOutboxDelivery((event) => {
        deliveredBy[event.eventId] = (deliveredBy[event.eventId] ?? 0) + 1;
      });

      // --- "worker instance A": delivers one event, then is stopped. -------
      const firstEventId = await publish(orgId, caseId, { eventType: 'case.step_before_restart' });
      await new Promise<void>((resolve) => {
        outboxWorker.startCaseWorkspaceOutboxWorker({
          organizationId: orgId,
          intervalMs: 500,
          forceEnable: true,
          onTick: (result) => {
            if (result.delivered > 0) resolve();
          },
        });
      });
      expect(deliveredBy[firstEventId]).toBe(1);

      // Full stop + metrics reset — nothing left in THIS process claims to
      // remember instance A ever ran.
      outboxWorker._resetOutboxWorkerForTests();
      expect(outboxWorker.getOutboxWorkerMetrics().running).toBe(false);
      expect(outboxWorker.getOutboxWorkerMetrics().ticks).toBe(0);

      // Something is published while NO worker is running at all — the
      // "crashed between deploys" window.
      const secondEventId = await publish(orgId, caseId, { eventType: 'case.step_during_downtime' });
      // Genuinely idle: confirmed via a direct read, not by trusting an
      // absence of logs.
      const stillPending = await readRow(secondEventId);
      expect(stillPending?.delivered_at).toBeNull();

      // --- "worker instance B": a fresh start recovers it. -----------------
      await new Promise<void>((resolve) => {
        outboxWorker.startCaseWorkspaceOutboxWorker({
          organizationId: orgId,
          intervalMs: 500,
          forceEnable: true,
          onTick: (result) => {
            if (result.delivered > 0) resolve();
          },
        });
      });

      expect(deliveredBy[secondEventId]).toBe(1);
      // NO REDELIVERY of what instance A already delivered before it stopped.
      expect(deliveredBy[firstEventId]).toBe(1);

      const finalBacklog = await eventOutboxService.getOutboxBacklog({ organizationId: orgId });
      expect(finalBacklog.pending).toBe(0);
    } finally {
      outboxWorker.stopCaseWorkspaceOutboxWorker();
      await teardown(orgId);
    }
  }, 60_000);

  // =========================================================================
  // 6. STUCK LEASE RECOVERY — no lease column exists; a crashed claiming
  //    transaction releases its locks the instant its connection dies, and
  //    SKIP LOCKED already lets every other row through while it is stuck.
  // =========================================================================
  it(
    'a claiming transaction that never commits (simulating a crashed/stuck dispatcher) does not block ' +
      'other rows, and once its connection is killed the next tick recovers its row immediately — no lease-expiry wait',
    async () => {
      const { orgId, caseId } = scope('stuck-lease');
      const stuckClient = new Client({ connectionString: CONNECTION_STRING });
      // node-postgres re-emits 'error' on the Client itself when its
      // connection is severed out from under it (exactly what
      // pg_terminate_backend below does, on purpose) — an EventEmitter
      // 'error' with zero listeners is an uncaughtException by default. This
      // test deliberately terminates its OWN client's connection, so the
      // expected termination error is swallowed here, not left to crash the
      // process (the real production gap this documents for `queryHelpers.ts`'s
      // `withPgTransaction` — which has no such listener — is flagged
      // separately in this packet's report, out of this file's allowlist to
      // fix).
      stuckClient.on('error', () => undefined);
      try {
        const delivered: string[] = [];
        eventOutboxService.subscribeToOutboxDelivery((event) => {
          delivered.push(event.eventId);
        });

        const stuckEventId = await publish(orgId, caseId, { eventType: 'case.stuck_probe' });
        const healthyEventId = await publish(orgId, caseId, { eventType: 'case.healthy_probe' });

        await stuckClient.connect();
        await stuckClient.query('BEGIN');
        // Same claim shape dispatchPendingEvents() uses, scoped to just this
        // one row, held open forever — never COMMIT/ROLLBACK-ed until this
        // test kills it below. This IS "a stuck dispatcher": a transaction
        // that claimed a row and then never finished.
        const claimResult = await stuckClient.query<{ event_id: string }>(
          `SELECT event_id FROM case_workspace_event_outbox
             WHERE event_id = $1 FOR UPDATE SKIP LOCKED`,
          [stuckEventId]
        );
        expect(claimResult.rows.map((row) => row.event_id)).toEqual([stuckEventId]);
        const pidResult = await stuckClient.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
        const stuckPid = pidResult.rows[0]!.pid;

        // While the stuck transaction is still open: a real tick must still
        // deliver the OTHER, unlocked row — SKIP LOCKED means the locked row
        // is silently skipped, never waited on.
        const tickWhileStuck = await outboxWorker.runOutboxWorkerTick({ organizationId: orgId });
        expect(tickWhileStuck.claimed).toBe(1);
        expect(delivered).toEqual([healthyEventId]);
        expect((await readRow(stuckEventId))?.delivered_at).toBeNull();

        // Kill the stuck backend — the real-world equivalent of that
        // dispatcher process crashing. Postgres releases every lock it held
        // the instant the connection dies; there is no lease to wait out.
        await control.query('SELECT pg_terminate_backend($1)', [stuckPid]);
        await stuckClient.end().catch(() => undefined);

        const recoveryTick = await outboxWorker.runOutboxWorkerTick({ organizationId: orgId });
        expect(recoveryTick).toMatchObject({ claimed: 1, delivered: 1, failed: 0 });
        expect(delivered).toEqual([healthyEventId, stuckEventId]);
        expect((await readRow(stuckEventId))?.delivered_at).not.toBeNull();
      } finally {
        await stuckClient.end().catch(() => undefined);
        await teardown(orgId);
      }
    },
    30_000
  );

  // =========================================================================
  // 7. TICK WATCHDOG — a hung durable consumer must not block the worker
  //    loop forever; `tickTimeoutMs` returns early, and the real outcome
  //    still lands in metrics once the hung consumer eventually resolves.
  // =========================================================================
  it(
    'tickTimeoutMs: a durable consumer hung past the watchdog does not block runOutboxWorkerTick from ' +
      'returning (timedOut=true, stuckTicks increments), and the late real outcome still updates cumulative metrics',
    async () => {
      const { orgId, caseId } = scope('watchdog');
      let releaseHang: (() => void) | null = null;
      const hangGate = new Promise<void>((resolve) => {
        releaseHang = resolve;
      });
      const deliveredAfterRelease: string[] = [];
      try {
        eventOutboxService.subscribeToOutboxDelivery(async (event) => {
          // Hang until explicitly released — a bounded stand-in for "a
          // webhook call with no timeout", kept finite so this test never
          // leaks a permanently-open DB connection of its own.
          await hangGate;
          deliveredAfterRelease.push(event.eventId);
        });

        const eventId = await publish(orgId, caseId, { eventType: 'case.hang_probe' });

        const stuckTicksBefore = outboxWorker.getOutboxWorkerMetrics().stuckTicks;
        const startedAt = Date.now();
        const tick = await outboxWorker.runOutboxWorkerTick({
          organizationId: orgId,
          tickTimeoutMs: 300,
        });
        const elapsedMs = Date.now() - startedAt;

        expect(tick.timedOut).toBe(true);
        // The decisive assertion: the call returned close to tickTimeoutMs,
        // NOT after however long the handler eventually takes to resolve —
        // proving the loop was never blocked on it.
        expect(elapsedMs).toBeLessThan(2_000);
        expect(outboxWorker.getOutboxWorkerMetrics().stuckTicks).toBe(stuckTicksBefore + 1);
        // Nothing was falsely marked delivered just because the caller
        // stopped waiting on it.
        expect((await readRow(eventId))?.delivered_at).toBeNull();

        releaseHang!();
        // Give the background dispatch (now unblocked) a moment to finish
        // and apply its real outcome to metrics.
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(deliveredAfterRelease).toEqual([eventId]);
        expect((await readRow(eventId))?.delivered_at).not.toBeNull();
        expect(outboxWorker.getOutboxWorkerMetrics().totalDelivered).toBeGreaterThanOrEqual(1);
      } finally {
        if (releaseHang) releaseHang();
        await teardown(orgId);
      }
    },
    15_000
  );

  // =========================================================================
  // 8. ADAPTIVE BACKOFF — the tick-cadence backoff multiplier doubles across
  //    consecutive failing ticks (capped) and resets to 1 on a clean tick.
  // =========================================================================
  it('getOutboxWorkerMetrics().currentBackoffMultiplier doubles on consecutive failing ticks and resets to 1 on the next clean tick', async () => {
    const { orgId, caseId } = scope('backoff');
    try {
      eventOutboxService.subscribeToOutboxDelivery(() => {
        throw new Error('cwworker_backoff_probe_failure');
      });
      await publish(orgId, caseId, { eventType: 'case.backoff_probe_a' });

      expect(outboxWorker.getOutboxWorkerMetrics().currentBackoffMultiplier).toBe(1);

      const tick1 = await outboxWorker.runOutboxWorkerTick({ organizationId: orgId });
      expect(tick1.failed).toBe(1);
      expect(outboxWorker.getOutboxWorkerMetrics().currentBackoffMultiplier).toBe(2);

      const tick2 = await outboxWorker.runOutboxWorkerTick({ organizationId: orgId });
      expect(tick2.failed).toBe(1);
      expect(outboxWorker.getOutboxWorkerMetrics().currentBackoffMultiplier).toBe(4);

      // Fix the consumer: the very next CLEAN tick resets the multiplier
      // immediately — it is not phased back in gradually.
      eventOutboxService.clearOutboxDeliverySubscribers();
      await publish(orgId, caseId, { eventType: 'case.backoff_probe_b' });
      const tick3 = await outboxWorker.runOutboxWorkerTick({ organizationId: orgId });
      expect(tick3.failed).toBe(0);
      expect(outboxWorker.getOutboxWorkerMetrics().currentBackoffMultiplier).toBe(1);
    } finally {
      await teardown(orgId);
    }
  }, 30_000);

  // =========================================================================
  // 9. RECONCILIATION SWEEP — the actual dead-lettered rows, not just a
  //    count, surfaced through both the direct call and getOutboxWorkerMetrics().
  // =========================================================================
  it('runOutboxReconciliationSweep surfaces the dead-lettered rows (event id/type/attempts/lastError) and mirrors them onto getOutboxWorkerMetrics()', async () => {
    const { orgId, caseId } = scope('reconciliation');
    try {
      eventOutboxService.subscribeToOutboxDelivery(() => {
        throw new Error('cwworker_reconciliation_probe_failure');
      });
      const eventId = await publish(orgId, caseId, { eventType: 'case.reconciliation_probe' });

      for (let attempt = 1; attempt <= eventOutboxService.DEAD_LETTER_ATTEMPT_THRESHOLD; attempt += 1) {
        await outboxWorker.runOutboxWorkerTick({ organizationId: orgId });
      }

      // Before any sweep has run, the metrics field starts empty — it is not
      // implicitly populated by the plain per-tick deadLetterCount.
      expect(outboxWorker.getOutboxWorkerMetrics().lastDeadLetterSample).toEqual([]);

      const sweep = await outboxWorker.runOutboxReconciliationSweep({ organizationId: orgId });
      expect(sweep.sampledCount).toBe(1);
      expect(sweep.sample).toEqual([
        expect.objectContaining({
          eventId,
          eventType: 'case.reconciliation_probe',
          deliveryAttemptCount: eventOutboxService.DEAD_LETTER_ATTEMPT_THRESHOLD,
          lastDeliveryError: expect.stringContaining('cwworker_reconciliation_probe_failure'),
        }),
      ]);

      const metricsAfterSweep = outboxWorker.getOutboxWorkerMetrics();
      expect(metricsAfterSweep.lastDeadLetterSample).toEqual(sweep.sample);
      expect(metricsAfterSweep.lastReconciliationAt).not.toBeNull();
    } finally {
      await teardown(orgId);
    }
  }, 30_000);

  // =========================================================================
  // 10. QUEUE LAG IN TIME — oldestPendingAgeSeconds, not just the row-count
  //     backlog, is what actually answers "is anything late".
  // =========================================================================
  it('oldestPendingAgeSeconds is null when idle, positive while something ages, and null again once fully drained', async () => {
    const { orgId, caseId } = scope('queue-lag');
    try {
      const idleTick = await outboxWorker.runOutboxWorkerTick({ organizationId: orgId });
      expect(idleTick.oldestPendingAgeSeconds).toBeNull();

      await publish(orgId, caseId, { eventType: 'case.lag_probe' });
      // Let the row actually age past the 1-second granularity of the
      // EXTRACT(EPOCH ...) read this asserts against.
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const backlogBeforeDrain = await eventOutboxService.getOutboxBacklog({ organizationId: orgId });
      expect(backlogBeforeDrain.oldestPendingAgeSeconds).toBeGreaterThanOrEqual(1);

      const drainingTick = await outboxWorker.runOutboxWorkerTick({ organizationId: orgId });
      expect(drainingTick.claimed).toBe(1);
      // Sampled AFTER dispatch — the backlog is already empty by the time
      // this tick's own oldestPendingAgeSeconds is read.
      expect(drainingTick.oldestPendingAgeSeconds).toBeNull();
      expect(outboxWorker.getOutboxWorkerMetrics().lastTickResult?.oldestPendingAgeSeconds).toBeNull();
    } finally {
      await teardown(orgId);
    }
  }, 15_000);
});
