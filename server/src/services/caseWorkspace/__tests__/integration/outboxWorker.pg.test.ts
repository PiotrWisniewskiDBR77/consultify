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
 * ISOLATION: every test owns a uniquely namespaced organization_id
 * (randomUUID) and scopes every worker call to it via `organizationId`, so
 * concurrently running suites (and this repo's other CW-T-* packets writing
 * to the same FK-less outbox table) can never be claimed by this suite's
 * ticks or vice versa.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
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
});
