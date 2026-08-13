/**
 * Case Workspace — STREAM E PERFORMANCE EVIDENCE, proved against a REAL
 * PostgreSQL, at the volumes docs/product/case-workspace/
 * 14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md's DoD-I actually names:
 *
 *   "SPEC-L remains operable with 1,000 Cases, Plan with 250 nodes/500 edges,
 *    and timeline with 10,000 events using pagination or virtualization."
 *   "... p95 server-backed mutation feedback <= 1 s under a recorded
 *    throttled-network profile."
 *   "Projection lag, stuck leases, waits, retries and capability health are
 *    observable."
 *
 * ===========================================================================
 * WHAT THIS FILE CAN AND CANNOT MEASURE — READ BEFORE TRUSTING A NUMBER
 * ===========================================================================
 * DoD-I is written for the FULL STACK: a browser rendering SPEC-L's table,
 * under a versioned network-throttling profile (`CW-NET-1`: 1.6 Mbps down /
 * 750 Kbps up / 150 ms RTT), on a frozen, documented runner (4 vCPU, 16 GB
 * RAM, SSD, current Chromium). This packet's allowlist is
 * server/src/services/caseWorkspace/** only — no browser, no HTTP layer, no
 * frontend pagination/virtualization code is reachable from here. Concretely:
 *
 *   MEASURABLE HERE (server, no network, no browser):
 *     - Outbox DISPATCH throughput/latency at a 10,000-event backlog —
 *       the exact volume DoD-I names for the timeline.
 *     - The queue-lag/backlog READ (`getOutboxBacklog`) staying cheap and
 *       accurate at that same volume — the literal "projection lag …
 *       observable" requirement, on the server side of it.
 *     - `publishEvent`'s own commit latency (p95) as a LOWER-BOUND proxy for
 *       "p95 server-backed mutation feedback" — it is the DB-transaction
 *       floor of that number, with NO HTTP framing, NO network throttle and
 *       NO frontend render on top. The real DoD-I number can only be equal to
 *       or (in real deployments, always) larger than what is measured here.
 *     - Section 3 (added CW-T-E / B4): this Node process's OWN heap while
 *       draining the same 10,000-event backlog through the REAL production
 *       call path — `outboxWorker.runOutboxWorkerTick()` — not raw
 *       `dispatchPendingEvents()`, and `getOutboxWorkerMetrics()` staying
 *       accurate (queue-lag age, cumulative totals, tick-duration
 *       percentiles) at that same volume. This is a SERVER-PROCESS heap
 *       number, explicitly not the DoD-I `CW-DOD-I4` BROWSER-heap
 *       requirement — see PERFORMANCE_EVIDENCE.md §6 for why that one stays
 *       `EVIDENCE_MISSING` from this repo's backend-only harnesses.
 *
 *   NOT MEASURABLE HERE, REPORTED AS EVIDENCE_MISSING:
 *     - Warm p95 route-to-interactive, p95 local interaction response.
 *     - 30-minute Run DOM/event growth and browser-heap growth after GC.
 *     - SPEC-L's own pagination/virtualization behavior at 1,000
 *       Cases / 250 nodes / 500 edges (a frontend rendering concern; this
 *       packet touches no frontend code and no v8/Plan/Case rendering code).
 *     - Anything under the CW-NET-1 throttle profile or on the frozen runner
 *       (this suite runs on whatever machine executes the test, not a
 *       frozen/approved perf environment — see DoD-I's own "undocumented
 *       environment is EVIDENCE_MISSING, not PASS").
 *
 *   Every number this file prints is therefore a SERVER-ONLY, UNTHROTTLED,
 *   UNFROZEN-ENVIRONMENT data point — useful evidence for THIS packet's own
 *   scope (event spine throughput/latency/observability), explicitly NOT a
 *   substitute for a real DoD-I browser run.
 *
 * ===========================================================================
 * WHY THE BACKLOG IS SEEDED WITH BULK SQL, NOT 10,000 publishEvent() CALLS
 * ===========================================================================
 * `withPgTransaction` opens a DEDICATED `pg.Client` connection per call (see
 * queryHelpers.ts) — issuing 10,000 of them sequentially would measure
 * connection-churn, not dispatch throughput, and would make this suite
 * impractically slow to run. Section 1 below seeds the 10,000-row backlog with
 * one bulk multi-row INSERT that reproduces `publishEvent`'s own column values
 * exactly (same table, same required NOT NULL columns, same defaults) — this
 * is a volume fixture, not a correctness claim; publishEvent's own atomicity
 * and column contract are already proved row-by-row in eventOutboxService.
 * pg.test.ts. What THIS file measures starts at `dispatchPendingEvents`, which
 * cannot tell a bulk-seeded row from a service-published one — both are just
 * rows with `delivered_at IS NULL`. Section 2 (mutation latency) DOES use the
 * real `publishEvent`/`withPgTransaction` path, because that IS the thing
 * being timed there.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test \
 *   npx vitest run \
 *   src/services/caseWorkspace/__tests__/perf/outboxThroughput.perf.pg.test.ts \
 *   --environment node
 *
 * Override CW_PERF_EVENT_COUNT to change the seeded volume (default 10000,
 * matching DoD-I's literal "timeline with 10,000 events"). Add
 * `NODE_OPTIONS=--expose-gc` for Section 3's forced-GC heap floor (falls back
 * to a raw, clearly-labelled `process.memoryUsage()` sample without it).
 *
 * ===========================================================================
 * DISCOVERED RUNNING THIS SUITE FOR REAL (CW-T-E / B4) — DELETE cleanup below
 * is a no-op, on purpose, since a sibling packet's migration
 * ===========================================================================
 * `server/migrations/20260810f_case_workspace_append_only_guards.sql` (out of
 * this packet's allowlist) added a real `BEFORE DELETE` trigger on
 * `case_workspace_event_outbox` that unconditionally rejects every DELETE
 * (§9 audit-survives guarantee). Every `DELETE ... .catch(() => undefined)`
 * below has therefore been a silent no-op since that migration landed — this
 * suite's own seeded rows, and every other `*.pg.test.ts` in this repo that
 * writes to this table, now accumulate PERMANENTLY in whatever database this
 * runs against. Correctness is unaffected here (every `orgId` is a fresh
 * `randomUUID()`, so accumulation cannot collide with a later run), but the
 * shared test database's size only ever grows. Flagged in this packet's
 * report as a genuine, previously-undocumented finding, not fixed here
 * (`eventOutboxService.ts` and `server/migrations/**` are both outside this
 * packet's allowlist).
 *
 * ===========================================================================
 * DISCOVERED RUNNING THIS SUITE FOR REAL (D3 packet) — Section 1/3 CAN FAIL
 * on `case_workspace_test` for a REAL, IDENTIFIED, ENVIRONMENTAL reason that
 * is NOT a bug in dispatchPendingEvents()/getOutboxBacklog()/outboxWorker.ts
 * ===========================================================================
 * A real run against `DATABASE_URL=...case_workspace_test` failed Section 1's
 * `expect(backlogBeforeDrain.pending).toBe(EVENT_COUNT)` at 9958/10000 (42
 * short) immediately after seeding, before this suite's own drain loop ever
 * ran a single tick; Section 3 (the heap/worker-path test) then timed out at
 * its full 300s budget. ROOT CAUSE, confirmed directly, not guessed:
 *
 *   1. `ps aux` on the machine running this suite showed THREE separate
 *      `tsx src/index.ts` processes from THIS SAME worktree. One of them
 *      (PORT=3001, NODE_ENV=development — the session's own long-running dev
 *      backend, explicitly "the coordinator owns it" in this packet's own
 *      operating rules) had `DATABASE_URL=postgresql://...@127.0.0.1:55432/
 *      case_workspace_test` — the EXACT SAME database this suite's own
 *      DATABASE_URL points at.
 *   2. `NODE_ENV=development` on that process means `startCaseWorkspaceOutboxWorker()`'s
 *      own `NODE_ENV==='test'` skip-gate (outboxWorker.ts) does NOT apply —
 *      the REAL production interval loop (5s default tick, no
 *      `organizationId` filter — dispatches across EVERY tenant by design)
 *      is running continuously against that database, for real, the whole
 *      time this suite (or anyone else's) runs against it.
 *   3. Direct proof, queried straight from Postgres well after the failed
 *      run's test PROCESS had already exited (so this cannot be this
 *      suite's own drain loop): the org this run seeded 10,000 rows into
 *      showed `delivered=2042` rows — climbing over time, entirely from that
 *      OTHER process's own ticks, on a table this suite's own `DELETE` can
 *      never clean up (see the note above) so it just sat there being
 *      drained by someone else indefinitely.
 *
 * This is category (c) from this packet's own brief — "a shared, loaded
 * machine can absolutely distort a throughput measurement" — in its most
 * literal form: not merely CPU/IO contention, but a REAL, correctly-behaving
 * consumer of the exact table this suite treats as its own private volume
 * fixture. Re-measuring against an EMPTY, otherwise-unused database on the
 * SAME Postgres server (`case_workspace_perf_probe`, already present
 * alongside `case_workspace_test`/`cw_freshmig` at the time of this note —
 * schema pre-applied, zero active connections, zero attached workers) PASSED
 * all 3 tests cleanly (3/3, ~466s wall clock, no assertion failures) with the
 * exact same code, proving the dispatch/backlog/worker-path logic itself is
 * correct and the failure was never a logic bug. The system's own `uptime`
 * during this investigation additionally showed a load average in the
 * HUNDREDS (a `load average` of 700+ on what is normally a low double-digit-
 * core machine) — corroborating "~9 other agents on the same Postgres" as a
 * real, machine-wide condition, not merely a one-off contention on this one
 * table.
 *
 * DO NOT "fix" a future red run here by loosening `toBe(EVENT_COUNT)` or the
 * Section 3 timeout — re-point `DATABASE_URL` at an idle database on the same
 * server (or wait for the coordinator's dev backend on port 3001 / the other
 * concurrent agents to quiet down) and re-measure instead. Nothing about this
 * finding is fixable from within this packet's allowlist (the coordinator
 * owns port 3001; this suite cannot and must not stop or redirect it).
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
          AND column_name IN ('event_id', 'delivered_at', 'sequence_number')`
    );
    return Number(outbox.rows[0]?.present ?? 0) === 3;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[outboxThroughput perf suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `case_workspace_event_outbox migrations applied. requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

/** DoD-I's literal "timeline with 10,000 events" volume. */
const EVENT_COUNT = Number(process.env.CW_PERF_EVENT_COUNT ?? 10_000);
/** DoD-I's literal "1,000 Cases" volume — events are spread across this many Cases. */
const CASE_COUNT = Number(process.env.CW_PERF_CASE_COUNT ?? 1_000);
const DISPATCH_BATCH_SIZE = 500;

function percentile(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return 0;
  const idx = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[Math.max(0, idx)]!;
}

suite('outbox dispatch throughput/latency at DoD-I volumes (server-side only — see file header for scope)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // =========================================================================
  // SECTION 1 — 10,000-event backlog across 1,000 Cases: dispatch throughput,
  // per-tick latency distribution, and queue-lag read cost.
  // =========================================================================
  it(
    `drains a ${EVENT_COUNT}-event backlog spread across ${CASE_COUNT} Cases, reports p50/p95/p99 tick ` +
      'latency and total wall-clock throughput, and confirms getOutboxBacklog() stays cheap at this volume',
    async () => {
      const orgId = `cwperf-org-${randomUUID()}`;

      try {
        // ---- SEED: one bulk multi-row INSERT, no publishEvent() round trips ----
        // Each row needs exactly 6 bind params (event_id, organization_id,
        // aggregate_type, aggregate_id, case_id, actor_user_id);
        // correlation_id (NOT NULL, no default) is computed in SQL from
        // event_id rather than bound, so it never has to be threaded through
        // the chunking below.
        const PARAMS_PER_ROW = 6;
        function buildRowParams(i: number): unknown[] {
          const caseId = `cwperf-case-${i % CASE_COUNT}`;
          const eventId = `cwperf-evt-${orgId}-${i}`;
          return [eventId, orgId, 'CASE', caseId, caseId, `cwperf-actor-${i % 50}`];
        }

        const seedStarted = Date.now();
        // Chunk the INSERT so one statement never carries all 10,000 rows'
        // worth of params (keeps this a realistic "several bulk writes",
        // matching how a real backfill/import would seed volume, and avoids
        // any driver-side param-count ceiling).
        const CHUNK = 1000;
        for (let offset = 0; offset < EVENT_COUNT; offset += CHUNK) {
          const chunkSize = Math.min(CHUNK, EVENT_COUNT - offset);
          const paramsChunk: unknown[] = [];
          let n = 1;
          const localRows: string[] = [];
          for (let j = 0; j < chunkSize; j += 1) {
            paramsChunk.push(...buildRowParams(offset + j));
            localRows.push(
              `($${n++}, 'case.status_changed', 1, $${n++}, $${n++}, $${n++}, $${n++}, $${n++}, '{}'::jsonb)`
            );
          }
          expect(paramsChunk.length).toBe(chunkSize * PARAMS_PER_ROW);
          await control.query(
            `INSERT INTO case_workspace_event_outbox
               (event_id, event_type, schema_version, organization_id, aggregate_type, aggregate_id, case_id, actor_user_id, redacted_summary, correlation_id)
             SELECT event_id, event_type, schema_version, organization_id, aggregate_type, aggregate_id, case_id, actor_user_id, redacted_summary,
                    'cwperf-corr-' || event_id
               FROM (VALUES ${localRows.join(',')}) AS t(event_id, event_type, schema_version, organization_id, aggregate_type, aggregate_id, case_id, actor_user_id, redacted_summary)`,
            paramsChunk
          );
        }
        const seedMs = Date.now() - seedStarted;

        const seededCount = await control.query<{ n: string }>(
          `SELECT count(*)::int AS n FROM case_workspace_event_outbox WHERE organization_id = $1`,
          [orgId]
        );
        expect(Number(seededCount.rows[0]?.n)).toBe(EVENT_COUNT);

        // ---- QUEUE LAG READ COST at full volume, BEFORE any dispatch -------
        const backlogReadStarted = Date.now();
        const backlogBeforeDrain = await eventOutboxService.getOutboxBacklog({ organizationId: orgId });
        const backlogReadMs = Date.now() - backlogReadStarted;
        expect(backlogBeforeDrain.pending).toBe(EVENT_COUNT);

        // ---- DRAIN: repeated dispatch ticks, timing EACH ONE -----------------
        const tickDurationsMs: number[] = [];
        const drainStarted = Date.now();
        let claimedTotal = 0;
        let deliveredTotal = 0;
        // Safety ceiling so a genuine regression fails the test instead of
        // looping forever.
        const maxTicks = Math.ceil(EVENT_COUNT / DISPATCH_BATCH_SIZE) + 5;
        for (let tick = 0; tick < maxTicks; tick += 1) {
          const tickStarted = Date.now();
          const result = await eventOutboxService.dispatchPendingEvents({
            organizationId: orgId,
            batchSize: DISPATCH_BATCH_SIZE,
          });
          tickDurationsMs.push(Date.now() - tickStarted);
          claimedTotal += result.claimed;
          deliveredTotal += result.delivered;
          if (result.claimed === 0) break;
        }
        const drainWallClockMs = Date.now() - drainStarted;

        expect(claimedTotal).toBe(EVENT_COUNT);
        expect(deliveredTotal).toBe(EVENT_COUNT);

        const backlogAfterDrain = await eventOutboxService.getOutboxBacklog({ organizationId: orgId });
        expect(backlogAfterDrain.pending).toBe(0);

        const sorted = [...tickDurationsMs].sort((a, b) => a - b);
        const p50 = percentile(sorted, 50);
        const p95 = percentile(sorted, 95);
        const p99 = percentile(sorted, 99);
        const eventsPerSecond = EVENT_COUNT / (drainWallClockMs / 1000);

        // -------------------------------------------------------------------
        // THE EVIDENCE. Printed unconditionally (not gated behind a verbose
        // flag) because this suite's entire purpose is to be quoted in the
        // packet report — a number that only exists in a variable is not
        // evidence.
        // -------------------------------------------------------------------
        // eslint-disable-next-line no-console
        console.log(
          `[outboxThroughput] EVIDENCE eventCount=${EVENT_COUNT} caseCount=${CASE_COUNT} ` +
            `batchSize=${DISPATCH_BATCH_SIZE} seedMs=${seedMs} backlogReadMs(at full volume)=${backlogReadMs} ` +
            `ticks=${tickDurationsMs.length} drainWallClockMs=${drainWallClockMs} ` +
            `eventsPerSecond=${eventsPerSecond.toFixed(1)} tickLatencyMs p50=${p50} p95=${p95} p99=${p99} ` +
            `minMs=${sorted[0]} maxMs=${sorted[sorted.length - 1]}`
        );

        // The queue-lag READ itself must stay cheap even with 10,000 pending
        // rows — it is a count(*)+min(created_at) against a PARTIAL index on
        // undelivered rows (see the outbox migration's own
        // idx_case_workspace_event_outbox_pending), so it must not degrade
        // with total table volume. 2s is a generous ceiling for an
        // unthrottled local/CI database; the printed number is the real
        // evidence, this is only a regression tripwire.
        expect(backlogReadMs).toBeLessThan(2_000);
      } finally {
        await control
          .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
          .catch(() => undefined);
      }
    },
    300_000
  );

  // =========================================================================
  // SECTION 2 — publishEvent()'s own commit latency: the DB-transaction FLOOR
  // of DoD-I's "p95 server-backed mutation feedback <= 1 s" (see file header —
  // this has NO HTTP framing, NO network throttle on top; it can only
  // understate the real number).
  // =========================================================================
  it('publishEvent() commit latency (p50/p95/p99) over 200 real single-mutation transactions — the DB-only floor of the DoD-I 1s mutation-feedback budget', async () => {
    const orgId = `cwperf-mut-org-${randomUUID()}`;
    const caseId = `cwperf-mut-case-${randomUUID()}`;
    const SAMPLE_SIZE = 200;
    const durationsMs: number[] = [];

    try {
      for (let i = 0; i < SAMPLE_SIZE; i += 1) {
        const started = Date.now();
        await withPgTransaction((client) =>
          eventOutboxService.publishEvent(client, {
            eventId: `cwperf-mut-evt-${orgId}-${i}`,
            eventType: 'case.status_changed',
            organizationId: orgId,
            aggregateType: 'CASE',
            aggregateId: caseId,
            caseId,
            actorUserId: 'cwperf-mut-actor',
            redactedSummary: { caseStatus: 'ACTIVE', iteration: i },
          })
        );
        durationsMs.push(Date.now() - started);
      }

      const sorted = [...durationsMs].sort((a, b) => a - b);
      const p50 = percentile(sorted, 50);
      const p95 = percentile(sorted, 95);
      const p99 = percentile(sorted, 99);

      // eslint-disable-next-line no-console
      console.log(
        `[outboxThroughput] EVIDENCE publishEvent commit latency sampleSize=${SAMPLE_SIZE} ` +
          `p50Ms=${p50} p95Ms=${p95} p99Ms=${p99} minMs=${sorted[0]} maxMs=${sorted[sorted.length - 1]} ` +
          `(DB-transaction floor only — NOT the full DoD-I HTTP/network/render number; see file header)`
      );

      // Sanity ceiling only — the DB-only floor should be a small fraction of
      // the 1s full-stack DoD-I budget on any non-degenerate database. This
      // is NOT a DoD-I pass/fail: DoD-I's own number needs the HTTP layer,
      // the CW-NET-1 throttle profile and the frozen runner, none of which
      // this packet's allowlist reaches.
      expect(p95).toBeLessThan(1_000);
    } finally {
      await control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
    }
  }, 120_000);

  // =========================================================================
  // SECTION 3 — CW-T-E / B4: heap during the heaviest operation this suite
  // knows how to produce (draining the same 10,000-event backlog as Section 1,
  // this time through the REAL production path — `outboxWorker.runOutboxWorkerTick()`
  // — not the raw `dispatchPendingEvents()` call Section 1 uses), plus the
  // SAME volume proving `getOutboxWorkerMetrics()` (queue-lag age, dead-letter
  // count, cumulative totals) stays accurate at full 10,000-row scale, not
  // just in the small-fixture integration tests.
  //
  // Run with `NODE_OPTIONS=--expose-gc` for a REAL forced-GC heap floor (same
  // convention as the sibling `__tests__/performance/**` harness's own
  // `lib/runProfile.ts`). Without it, `global.gc` is undefined and this test
  // reports heap WITHOUT a forced collection — still printed, but visibly
  // labelled `forcedGc=false` rather than silently passed off as the same
  // measurement.
  // =========================================================================
  it(
    `heap during the heaviest operation: draining a ${EVENT_COUNT}-event backlog through the ` +
      'REAL outboxWorker.runOutboxWorkerTick() path (not raw dispatchPendingEvents), sampling this ' +
      'Node process heap at baseline / post-seed / post-drain / post-forced-GC, and confirming ' +
      'getOutboxWorkerMetrics() (queue-lag age, totals, tick-duration p50/p95) stays accurate at full volume',
    async () => {
      const orgId = `cwperf-heap-org-${randomUUID()}`;
      const forcedGcAvailable = typeof global.gc === 'function';

      function sampleHeapMb(): number {
        if (forcedGcAvailable) global.gc!();
        return process.memoryUsage().heapUsed / (1024 * 1024);
      }

      outboxWorker._resetOutboxWorkerForTests();

      try {
        const baselineHeapMb = sampleHeapMb();

        // ---- SEED: identical shape to Section 1 (bulk INSERT, see that
        // section's own header note on why 10,000 publishEvent() round trips
        // would measure connection churn instead of dispatch/worker cost). ----
        const PARAMS_PER_ROW = 6;
        function buildRowParams(i: number): unknown[] {
          const caseId = `cwperfheap-case-${i % CASE_COUNT}`;
          const eventId = `cwperfheap-evt-${orgId}-${i}`;
          return [eventId, orgId, 'CASE', caseId, caseId, `cwperfheap-actor-${i % 50}`];
        }
        const CHUNK = 1000;
        for (let offset = 0; offset < EVENT_COUNT; offset += CHUNK) {
          const chunkSize = Math.min(CHUNK, EVENT_COUNT - offset);
          const paramsChunk: unknown[] = [];
          let n = 1;
          const localRows: string[] = [];
          for (let j = 0; j < chunkSize; j += 1) {
            paramsChunk.push(...buildRowParams(offset + j));
            localRows.push(
              `($${n++}, 'case.status_changed', 1, $${n++}, $${n++}, $${n++}, $${n++}, $${n++}, '{}'::jsonb)`
            );
          }
          expect(paramsChunk.length).toBe(chunkSize * PARAMS_PER_ROW);
          await control.query(
            `INSERT INTO case_workspace_event_outbox
               (event_id, event_type, schema_version, organization_id, aggregate_type, aggregate_id, case_id, actor_user_id, redacted_summary, correlation_id)
             SELECT event_id, event_type, schema_version, organization_id, aggregate_type, aggregate_id, case_id, actor_user_id, redacted_summary,
                    'cwperfheap-corr-' || event_id
               FROM (VALUES ${localRows.join(',')}) AS t(event_id, event_type, schema_version, organization_id, aggregate_type, aggregate_id, case_id, actor_user_id, redacted_summary)`,
            paramsChunk
          );
        }

        const seededCount = await control.query<{ n: string }>(
          `SELECT count(*)::int AS n FROM case_workspace_event_outbox WHERE organization_id = $1`,
          [orgId]
        );
        expect(Number(seededCount.rows[0]?.n)).toBe(EVENT_COUNT);

        const postSeedHeapMb = sampleHeapMb();

        // ---- DRAIN via the REAL outboxWorker.runOutboxWorkerTick() path,
        // sampling heap at ~25%/~75% progress and after full drain. ----
        const heapDuringDrainMb: number[] = [];
        const maxTicks = Math.ceil(EVENT_COUNT / DISPATCH_BATCH_SIZE) + 5;
        const quarterTick = Math.max(1, Math.floor(maxTicks / 4));
        const threeQuarterTick = Math.max(quarterTick + 1, Math.floor((maxTicks * 3) / 4));

        for (let tickIndex = 0; tickIndex < maxTicks; tickIndex += 1) {
          const result = await outboxWorker.runOutboxWorkerTick({
            organizationId: orgId,
            batchSize: DISPATCH_BATCH_SIZE,
          });
          if (tickIndex === quarterTick || tickIndex === threeQuarterTick) {
            heapDuringDrainMb.push(process.memoryUsage().heapUsed / (1024 * 1024));
          }
          if (result.claimed === 0) break;
        }

        const postDrainHeapMb = sampleHeapMb();

        const finalMetrics = outboxWorker.getOutboxWorkerMetrics();
        const finalBacklog = await eventOutboxService.getOutboxBacklog({ organizationId: orgId });

        expect(finalMetrics.totalClaimed).toBe(EVENT_COUNT);
        expect(finalMetrics.totalDelivered).toBe(EVENT_COUNT);
        expect(finalMetrics.totalFailed).toBe(0);
        expect(finalBacklog.pending).toBe(0);
        // §10 "queue lag ... observable": the age metric must go back to
        // "empty" once the real worker path has actually drained everything,
        // not just the row-count backlog.
        expect(finalMetrics.lastTickResult?.oldestPendingAgeSeconds).toBeNull();
        // The rolling tick-duration percentiles must have real data at this
        // volume — the whole point of exercising 21+ ticks here.
        expect(finalMetrics.tickDurationMsP50).not.toBeNull();
        expect(finalMetrics.tickDurationMsP95).not.toBeNull();

        const growthPct =
          baselineHeapMb > 0 ? ((postDrainHeapMb - baselineHeapMb) / baselineHeapMb) * 100 : null;

        // -------------------------------------------------------------------
        // THE EVIDENCE.
        // -------------------------------------------------------------------
        // eslint-disable-next-line no-console
        console.log(
          `[outboxThroughput] EVIDENCE heap forcedGc=${forcedGcAvailable} eventCount=${EVENT_COUNT} ` +
            `caseCount=${CASE_COUNT} ticks=${finalMetrics.ticks} baselineHeapMb=${baselineHeapMb.toFixed(2)} ` +
            `postSeedHeapMb=${postSeedHeapMb.toFixed(2)} duringDrainHeapMb=[${heapDuringDrainMb
              .map((v) => v.toFixed(2))
              .join(', ')}] postDrainHeapMb=${postDrainHeapMb.toFixed(2)} ` +
            `growthPctBaselineToPostDrain=${growthPct === null ? 'n/a' : growthPct.toFixed(2) + '%'} ` +
            `tickDurationMsP50=${finalMetrics.tickDurationMsP50} tickDurationMsP95=${finalMetrics.tickDurationMsP95} ` +
            `stuckTicks=${finalMetrics.stuckTicks} totalDelivered=${finalMetrics.totalDelivered}` +
            (forcedGcAvailable
              ? ''
              : ' (NOTE: run with NODE_OPTIONS=--expose-gc for a forced-GC floor instead of a raw sample)')
        );

        if (!forcedGcAvailable) {
          // eslint-disable-next-line no-console
          console.warn(
            '[outboxThroughput] heap section ran WITHOUT --expose-gc — the numbers above are raw ' +
              'process.memoryUsage() samples, not a post-forced-GC floor. Re-run with ' +
              'NODE_OPTIONS=--expose-gc for the stronger measurement.'
          );
        }
      } finally {
        await control
          .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
          .catch(() => undefined);
        outboxWorker._resetOutboxWorkerForTests();
      }
    },
    300_000
  );
});
