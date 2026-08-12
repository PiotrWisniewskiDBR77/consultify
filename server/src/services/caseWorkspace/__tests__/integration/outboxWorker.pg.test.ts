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
 *    it was down — with NO redelivery of what already went out. AN
 *    IN-PROCESS FAKE — see item 3b below for the real-process version of the
 *    same claim.
 * 3b. REAL SEPARATE-PROCESS RESTART (D3 packet) — the in-process fake above
 *    cannot actually disprove a stranded row: nothing in it ever leaves this
 *    ONE Node process/module registry either way. This case spawns two REAL
 *    OS processes (`tsx` child processes running the actual production
 *    `startCaseWorkspaceOutboxWorker()` entry point) — SIGKILLs the first
 *    mid-drain, then starts a completely independent second one — and reads
 *    the outcome straight from Postgres: every row reaches `delivered_at`,
 *    none is left behind, and none gets more than one real delivery attempt.
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

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

  /**
   * §8 PER-ROW backoff (server/migrations/
   * 20260812a_case_workspace_outbox_next_retry_at.sql) means a row that just
   * failed is NOT reclaimable on the very next tick anymore — see
   * eventOutboxService.ts's own `computeRetryBackoffMs`. Every test in this
   * file that loops ticks against a DELIBERATELY-FAILING event (dead-letter,
   * adaptive-backoff, reconciliation) needs the row's `next_retry_at` moved
   * into the past between iterations, exactly like an operator's "retry now"
   * would — otherwise those loops would (correctly!) see `claimed: 0` and
   * the tests would hang/fail for a reason that has nothing to do with what
   * they are actually trying to prove. This is the SAME technique
   * eventOutboxService.pg.test.ts's own retry test uses.
   */
  async function fastForwardRetry(orgId: string): Promise<void> {
    await control.query(
      `UPDATE case_workspace_event_outbox
          SET next_retry_at = now() - interval '1 second'
        WHERE organization_id = $1 AND delivered_at IS NULL`,
      [orgId]
    );
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
        if (attempt > 1) await fastForwardRetry(orgId); // bypass this row's own per-row backoff
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
  // 5. REAL SEPARATE-PROCESS RESTART — the test above proves the SAME
  //    property with an in-process fake (`_resetOutboxWorkerForTests()` +
  //    a fresh `startCaseWorkspaceOutboxWorker()` call, all in ONE Node
  //    process/module registry). An in-process fake cannot actually
  //    disprove "a process restart strands nothing" — module-level state
  //    (subscriber closures over `deliveredBy`, `require` caching, the V8
  //    heap itself) never leaves that one process either way, so it proves
  //    at most that THIS FILE's OWN bookkeeping resets, not that a genuinely
  //    different OS process picks up where a killed one left off. This test
  //    spawns two REAL, SEPARATE `node`/`tsx` child processes — no shared
  //    memory, no shared module registry, no shared metrics singleton with
  //    the parent test process or with each other — and proves recovery
  //    against Postgres alone, the only thing this design's header
  //    ("restart does not lose or duplicate the effect") ever claims is
  //    load-bearing.
  // =========================================================================
  it(
    'a REAL separate OS process running startCaseWorkspaceOutboxWorker, SIGKILLed mid-drain, strands nothing: ' +
      'a second, independently-spawned fresh process finishes the drain with no row left behind and no duplicate delivery',
    async () => {
      const { orgId, caseId } = scope('real-process-restart');
      const EVENT_COUNT = 400;
      const serverDir = path.resolve(fileURLToPath(new URL('../../../../../..', import.meta.url)));
      const outboxWorkerAbsPath = path.resolve(
        fileURLToPath(new URL('../../outboxWorker.ts', import.meta.url))
      );
      const tsxBin = path.join(serverDir, 'node_modules', '.bin', 'tsx');
      let tmpDir: string | null = null;

      /** Poll Postgres directly (never this process's own in-memory state) for the delivered-row count. */
      async function readDeliveredCount(): Promise<number> {
        const result = await control.query<{ n: string }>(
          `SELECT count(*)::int AS n FROM case_workspace_event_outbox
             WHERE organization_id = $1 AND delivered_at IS NOT NULL`,
          [orgId]
        );
        return Number(result.rows[0]?.n ?? 0);
      }

      async function waitUntil(
        predicate: () => Promise<boolean>,
        timeoutMs: number,
        pollMs = 100
      ): Promise<boolean> {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
          if (await predicate()) return true;
          if (Date.now() >= deadline) return false;
          await new Promise((resolve) => setTimeout(resolve, pollMs));
        }
      }

      function spawnWorkerProcess(): ReturnType<typeof spawn> {
        const scriptPath = path.join(tmpDir!, `worker-${randomUUID()}.mjs`);
        // Plain ESM importing the REAL production module by absolute path —
        // its own relative imports ('../../utils/Logger.js', etc.) resolve
        // from THAT file's real location on disk regardless of where this
        // generated script physically sits, so it is the exact same code
        // path `server/src/index.ts` itself uses in production (see
        // outboxWorker.ts's own header: "startCaseWorkspaceOutboxWorker();
        // called once at server boot").
        const script = [
          `import { startCaseWorkspaceOutboxWorker } from ${JSON.stringify(outboxWorkerAbsPath)};`,
          `startCaseWorkspaceOutboxWorker({`,
          `  forceEnable: true,`,
          `  organizationId: ${JSON.stringify(orgId)},`,
          `  intervalMs: 150,`,
          `  batchSize: 20,`,
          `});`,
          // startCaseWorkspaceOutboxWorker's own timer is deliberately
          // unref'd (its header: a worker must never keep a real server
          // process alive by itself) — this generated script is nothing
          // BUT the worker, so it needs its own explicit keep-alive or the
          // event loop would drain and the process would exit immediately.
          `setInterval(() => {}, 60_000);`,
          `process.stdout.write('worker-process-ready\\n');`,
        ].join('\n');
        writeFileSync(scriptPath, script, 'utf8');

        const child = spawn(tsxBin, [scriptPath], {
          cwd: serverDir,
          env: process.env, // inherits DATABASE_URL/RUN_DB_TESTS/MOCK_DB/DB_TYPE/NODE_ENV as-is
          stdio: ['ignore', 'pipe', 'pipe'],
          // DELIBERATE, and the reason killProcessTree() below exists: `tsx`
          // (confirmed by inspecting the actually-running process tree while
          // developing this test) does not exec-replace itself — the PID
          // `spawn()` hands back is a `tsx` LAUNCHER process, which itself
          // spawns a SEPARATE child (`node --require tsx/dist/preflight.cjs
          // --import tsx/dist/loader.mjs <script>`) that is the one actually
          // running startCaseWorkspaceOutboxWorker(). A plain
          // `child.kill('SIGKILL')` only signals the launcher — the real
          // worker grandchild survives as an orphan (observed directly:
          // leaked `cw-outbox-restart-*` node processes still running
          // minutes after a test run had already reported PASS). `detached:
          // true` puts the launcher in its OWN process group so
          // `killProcessTree()` can signal the WHOLE group with one call.
          detached: true,
        });
        return child;
      }

      /**
       * Kills the ENTIRE process tree rooted at `child` (see the `detached:
       * true` comment above for why a plain `child.kill()` leaks tsx's real
       * worker grandchild). `process.kill(-pid, signal)` — a NEGATIVE pid —
       * is the POSIX convention for "signal every process in this group",
       * which is exactly the group `detached: true` created. Falls back to a
       * plain kill if the group signal itself fails (e.g. already exited).
       */
      function killProcessTree(child: ReturnType<typeof spawn>): void {
        if (!child.pid) return;
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          try {
            child.kill('SIGKILL');
          } catch {
            // already gone — nothing left to clean up.
          }
        }
      }

      try {
        tmpDir = mkdtempSync(path.join(tmpdir(), 'cw-outbox-restart-'));

        // ---- SEED: EVENT_COUNT fresh pending rows ------------------------------
        // A single bulk multi-row INSERT, not EVENT_COUNT sequential publish()
        // calls: withPgTransaction() opens a DEDICATED pg.Client PER CALL (see
        // queryHelpers.ts), so EVENT_COUNT of those sequentially measures
        // connection-churn, not this test's actual subject (worker restart
        // recovery) — confirmed empirically: 50 sequential publish() calls took
        // ~10.5s in this same environment, which would blow this test's budget
        // at EVENT_COUNT=400. Same technique and justification as
        // __tests__/perf/outboxThroughput.perf.pg.test.ts's own Section 1 seed
        // (see that file's header) — reproduces publishEvent's own column
        // values/defaults exactly; what this test measures starts at
        // dispatchPendingEvents, which cannot tell a bulk-seeded row from a
        // service-published one.
        const seedParams: unknown[] = [];
        const seedRows: string[] = [];
        let seedParamIndex = 1;
        for (let i = 0; i < EVENT_COUNT; i += 1) {
          const eventId = `cwevt-restart-${orgId}-${i}`;
          seedParams.push(eventId, orgId, 'CASE', caseId, caseId, `cwworker-restart-actor-${i}`);
          seedRows.push(
            `($${seedParamIndex++}, 'case.real_process_restart_probe', 1, $${seedParamIndex++}, $${seedParamIndex++}, $${seedParamIndex++}, $${seedParamIndex++}, $${seedParamIndex++}, '{}'::jsonb)`
          );
        }
        await control.query(
          `INSERT INTO case_workspace_event_outbox
             (event_id, event_type, schema_version, organization_id, aggregate_type, aggregate_id, case_id, actor_user_id, redacted_summary, correlation_id)
           SELECT event_id, event_type, schema_version, organization_id, aggregate_type, aggregate_id, case_id, actor_user_id, redacted_summary,
                  'cwworker-restart-corr-' || event_id
             FROM (VALUES ${seedRows.join(',')}) AS t(event_id, event_type, schema_version, organization_id, aggregate_type, aggregate_id, case_id, actor_user_id, redacted_summary)`,
          seedParams
        );
        const seededCount = await control.query<{ n: string }>(
          `SELECT count(*)::int AS n FROM case_workspace_event_outbox WHERE organization_id = $1`,
          [orgId]
        );
        expect(Number(seededCount.rows[0]?.n)).toBe(EVENT_COUNT);
        expect(await readDeliveredCount()).toBe(0);

        // ---- PROCESS A: a real, separate OS process starts draining ----------
        const processA = spawnWorkerProcess();
        const processAStderr: string[] = [];
        processA.stderr?.on('data', (chunk) => processAStderr.push(String(chunk)));
        let processAPid: number | undefined;
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error(`process A never signalled ready. stderr: ${processAStderr.join('')}`)),
            15_000
          );
          processA.stdout?.on('data', (chunk) => {
            if (String(chunk).includes('worker-process-ready')) {
              clearTimeout(timer);
              processAPid = processA.pid;
              resolve();
            }
          });
          processA.on('exit', (code) => {
            clearTimeout(timer);
            reject(new Error(`process A exited early (code ${code}). stderr: ${processAStderr.join('')}`));
          });
        });
        expect(processAPid).toBeGreaterThan(0);

        // ---- Wait for genuine MID-FLIGHT progress: some delivered, not all ----
        const madeMidProgress = await waitUntil(async () => {
          const n = await readDeliveredCount();
          return n > 0 && n < EVENT_COUNT;
        }, 20_000);
        expect(madeMidProgress).toBe(true);
        const midDeliveredCount = await readDeliveredCount();
        expect(midDeliveredCount).toBeGreaterThan(0);
        expect(midDeliveredCount).toBeLessThan(EVENT_COUNT);

        // ---- THE CRASH: SIGKILL — no graceful shutdown, no chance to flush ----
        // any in-memory state. This is deliberately the least forgiving kill
        // signal available (SIGTERM would at least let handlers run).
        // killProcessTree(), not a plain processA.kill(): see that helper's
        // own comment — a plain kill leaves tsx's real worker grandchild
        // process running, orphaned, which would make this "crash" a lie
        // (the worker never actually stops) and leak a process per test run.
        killProcessTree(processA);
        await new Promise<void>((resolve) => {
          processA.on('exit', () => resolve());
          // Already-exited safety net.
          setTimeout(resolve, 5_000);
        });

        // A moment for Postgres to notice the dead backend and release any
        // locks it held — mirrors outboxWorker.pg.test.ts's own "stuck lease"
        // test's same allowance.
        await new Promise((resolve) => setTimeout(resolve, 500));

        const afterKillDeliveredCount = await readDeliveredCount();
        // Still genuinely partial — the kill actually interrupted real work,
        // this is not a test that happened to race to completion first.
        expect(afterKillDeliveredCount).toBeLessThan(EVENT_COUNT);

        // ---- PROCESS B: a SECOND, INDEPENDENTLY-SPAWNED fresh process --------
        // No relation whatsoever to process A beyond both reading the same
        // Postgres rows — different PID, different V8 heap, different module
        // registry, started fresh by THIS test, not "recovered" from A.
        const processB = spawnWorkerProcess();
        const processBStderr: string[] = [];
        processB.stderr?.on('data', (chunk) => processBStderr.push(String(chunk)));
        let processBPid: number | undefined;

        try {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error(`process B never signalled ready. stderr: ${processBStderr.join('')}`)),
              15_000
            );
            processB.stdout?.on('data', (chunk) => {
              if (String(chunk).includes('worker-process-ready')) {
                clearTimeout(timer);
                processBPid = processB.pid;
                resolve();
              }
            });
            processB.on('exit', (code) => {
              clearTimeout(timer);
              reject(new Error(`process B exited early (code ${code}). stderr: ${processBStderr.join('')}`));
            });
          });
          expect(processBPid).toBeGreaterThan(0);
          expect(processBPid).not.toBe(processAPid);

          const fullyDrained = await waitUntil(async () => (await readDeliveredCount()) === EVENT_COUNT, 30_000);
          expect(fullyDrained).toBe(true);
        } finally {
          killProcessTree(processB);
        }

        // ---- THE DECISIVE READS — straight from Postgres, not from either
        // process's own in-memory metrics (both are gone/killed by now). ----
        const finalRows = await control.query<{
          event_id: string;
          delivered_at: Date | null;
          delivery_attempt_count: number;
        }>(
          `SELECT event_id, delivered_at, delivery_attempt_count
             FROM case_workspace_event_outbox WHERE organization_id = $1`,
          [orgId]
        );
        expect(finalRows.rows).toHaveLength(EVENT_COUNT);
        // NOTHING STRANDED: every single row reached delivered_at, across
        // TWO real, separate, killed-and-fresh OS processes.
        expect(finalRows.rows.every((r) => r.delivered_at !== null)).toBe(true);
        // NO DUPLICATE/RUNAWAY EFFECT: a row that was mid-flight when A was
        // killed gets ONE more real attempt from B (SKIP LOCKED means A's own
        // claiming transaction, whatever it had claimed, released those locks
        // the instant the SIGKILL'd connection died — see outboxWorker.
        // pg.test.ts's own "stuck lease" test for the same property), never
        // an unbounded retry storm.
        expect(finalRows.rows.every((r) => Number(r.delivery_attempt_count) <= 1)).toBe(true);

        const finalBacklog = await eventOutboxService.getOutboxBacklog({ organizationId: orgId });
        expect(finalBacklog.pending).toBe(0);
      } finally {
        if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
        await teardown(orgId);
      }
    },
    90_000
  );

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

      // Bypass this row's own PER-ROW backoff (distinct from the
      // tick-cadence multiplier this test is actually about) so the second
      // tick can re-claim it immediately, same as the operator "retry now"
      // shape used elsewhere in this file.
      await fastForwardRetry(orgId);
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
        if (attempt > 1) await fastForwardRetry(orgId); // bypass this row's own per-row backoff
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
