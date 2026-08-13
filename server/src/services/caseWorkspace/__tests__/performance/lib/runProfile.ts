/**
 * CW-PERF — the actual workload run against ONE fresh, migrated database.
 *
 * This file is imported and executed by `runProfileMain.ts` (the tsx entry
 * point spawned once per fresh database by `orchestrate.ts`). It is kept
 * separate from the entry point so the entry point can set
 * `process.env.DATABASE_URL`/`RUN_DB_TESTS`/`MOCK_DB` etc BEFORE any
 * `caseWorkspace` service module is imported (those modules read
 * `databaseConfig` at import time — see queryHelpers.ts's withPgTransaction
 * docblock).
 *
 * Every mutation below goes through the REAL service API
 * (caseCoreService.createCase, casePlanVersionService.createPlanDraft,
 * caseHistoryService.appendCaseHistoryEvent, eventOutboxService.*) — never a
 * direct INSERT into case_core/case_plan_versions/case_workspace_history_events/
 * case_workspace_event_outbox. Only the PREREQUISITE tenancy rows
 * (organizations/projects/users/organization_members) are seeded by direct
 * INSERT, via fixtures.ts, exactly as every other `*.pg.test.ts` file in
 * this directory already does — that is fixture bootstrap, not shortcutting
 * the measured objects.
 */

import { randomUUID } from 'node:crypto';

import { Client, Pool } from 'pg';

import * as caseCoreService from '../../../caseCoreService.js';
import * as caseHistoryService from '../../../caseHistoryService.js';
import * as casePlanVersionService from '../../../casePlanVersionService.js';
import * as eventOutboxService from '../../../eventOutboxService.js';
import { collectRunnerEnvInfo, type RunnerEnvInfo } from './envInfo.js';
import { seedOrgProjectActor } from './fixtures.js';
import { buildLinearGraph } from './graphBuilder.js';
import {
  type HeapSnapshot,
  type LatencyStats,
  forceGcIfAvailable,
  mapWithConcurrency,
  round2,
  snapshotHeap,
  summarize,
  timed,
} from './stats.js';

export interface ProfileOptions {
  runId: string;
  databaseUrl: string;
  caseCount: number;
  nodeCount: number;
  edgeCount: number;
  eventsPerCase: number;
  caseConcurrency: number;
  eventConcurrency: number;
  dispatchBatchSize: number;
  queryReps: number;
  runFailureInjection: boolean;
  soakMs: number;
}

export interface ProfileResult {
  runId: string;
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  options: Omit<ProfileOptions, 'databaseUrl'>;
  env: RunnerEnvInfo;
  counts: {
    casesRequested: number;
    casesCreated: number;
    planNodes: number;
    planEdges: number;
    historyEventsRequested: number;
    historyEventsCreated: number;
    outboxRowsTotalAfterSeed: number;
    outboxRowsDeliveredAfterDispatch: number;
    outboxRowsPendingAfterDispatch: number;
  };
  seedLatency: {
    createCase: LatencyStats;
    createPlanDraft: LatencyStats;
    appendHistoryEvent: LatencyStats;
  };
  queryLatency: {
    listCasesForOrganization: LatencyStats;
    getPlanVersionGraph: LatencyStats;
    listCaseHistoryEventsForCase: LatencyStats;
    getOutboxBacklog: LatencyStats;
  };
  dispatch: {
    batchSize: number;
    batchLatency: LatencyStats;
    totalBatches: number;
    totalDelivered: number;
    totalFailed: number;
    totalDispatchWallMs: number;
    eventsPerSecond: number;
  };
  heap: {
    snapshots: HeapSnapshot[];
    gcExposed: boolean;
    baselineHeapUsedMB: number;
    postSeedHeapUsedMB: number;
    postQueriesHeapUsedMB: number;
    postGcHeapUsedMB: number | null;
    growthPctBaselineToPostGc: number | null;
  };
  failureInjection: FailureInjectionResult | { skipped: true; reason: string };
  soak: SoakResult | { skipped: true; reason: string };
  errors: string[];
}

export interface FailureInjectionResult {
  probeEventCount: number;
  poisonEventId: string;
  poisonPositionInBatch: number;
  crashAttempt: {
    dispatchRejected: boolean;
    rejectionMessage: string | null;
    deliveredAfterCrash: number;
    attemptCountAfterCrash: number;
    terminatedBackendPid: number | null;
    /**
     * True when the injected connection kill ALSO fired as a raw, unlistened
     * `'error'` event on withPgTransaction()'s bare `pg.Client` (a real
     * node-postgres footgun in that helper — see the long comment at this
     * function's process.on('uncaughtException', …) guard). This harness
     * survives it (the guard swallows only this exact signature); a REAL
     * production process running the same code path, with the same missing
     * listener, would crash the whole process on this exact class of event,
     * not just reject one dispatch call.
     */
    crashAlsoLeakedAsUnlistenedClientErrorEvent: boolean;
  };
  recoveryAttempt: {
    claimed: number;
    delivered: number;
    failed: number;
  };
  finalState: {
    totalProbeRows: number;
    deliveredProbeRows: number;
    duplicateEventIds: number;
  };
  verdict: string;
}

export interface SoakResult {
  durationMsRequested: number;
  durationMsActual: number;
  iterations: number;
  heapSamples: HeapSnapshot[];
  listCasesLatency: LatencyStats;
}

const PROBE_EVENT_TYPE = 'CW_PERF_FAILURE_INJECTION_PROBE';

export async function runProfile(options: ProfileOptions): Promise<ProfileResult> {
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const errors: string[] = [];
  const heapSnapshots: HeapSnapshot[] = [];

  const pool = new Pool({ connectionString: options.databaseUrl, max: 10 });
  heapSnapshots.push(snapshotHeap('baseline'));

  try {
    const env = await collectRunnerEnvInfo(pool);

    // -----------------------------------------------------------------
    // Fixture bootstrap (tenancy prerequisites only — see file header).
    // -----------------------------------------------------------------
    const fixture = await seedOrgProjectActor(pool, options.runId);

    // -----------------------------------------------------------------
    // 1. Seed N Cases through the real caseCoreService.createCase() API.
    // -----------------------------------------------------------------
    const createCaseSamples: number[] = [];
    const caseIndexes = Array.from({ length: options.caseCount }, (_, i) => i);
    const caseIds = await mapWithConcurrency(caseIndexes, options.caseConcurrency, async (i) => {
      const { result, ms } = await timed(() =>
        caseCoreService.createCase({
          projectId: fixture.projectId,
          organizationId: fixture.orgId,
          caseName: `CW perf case ${i}`,
          caseProfile: 'STANDARD',
          governanceTier: 'STANDARD',
          autonomyPolicy: 'ASK_MATERIAL_ACTIONS',
          contractedClosureType: 'DELIVERY_COMPLETED',
          createdByActorId: fixture.actorId,
        })
      );
      createCaseSamples.push(ms);
      return result.caseId;
    });
    heapSnapshots.push(snapshotHeap('after_case_seed'));

    // -----------------------------------------------------------------
    // 2. One Plan with the frozen 250-node/500-edge fixture, on the first Case.
    // -----------------------------------------------------------------
    const graph = buildLinearGraph(options.nodeCount, options.edgeCount, 'cwperf');
    const { result: planVersion, ms: createPlanDraftMs } = await timed(() =>
      casePlanVersionService.createPlanDraft({
        caseId: caseIds[0],
        semanticGraph: graph,
        createdByActorId: fixture.actorId,
      })
    );
    heapSnapshots.push(snapshotHeap('after_plan_seed'));

    // -----------------------------------------------------------------
    // 3. Seed events*cases history events through the real
    //    caseHistoryService.appendCaseHistoryEvent() API — every append is
    //    also one atomic case_workspace_event_outbox row (EVENT_TAXONOMY §2).
    // -----------------------------------------------------------------
    const appendEventSamples: number[] = [];
    const eventJobs: Array<{ caseId: string; seq: number }> = [];
    for (const caseId of caseIds) {
      for (let seq = 0; seq < options.eventsPerCase; seq += 1) {
        eventJobs.push({ caseId, seq });
      }
    }
    let historyEventsCreated = 0;
    await mapWithConcurrency(eventJobs, options.eventConcurrency, async (job) => {
      const { ms } = await timed(() =>
        caseHistoryService.appendCaseHistoryEvent({
          organizationId: fixture.orgId,
          projectId: fixture.projectId,
          caseId: job.caseId,
          eventType: 'CW_PERF_SEED_EVENT',
          actorId: fixture.actorId,
          occurredAt: new Date().toISOString(),
          summary: `perf seed event ${job.seq} for ${job.caseId}`,
          sourceTable: 'cwperf_synthetic',
          sourceId: `${job.caseId}-${job.seq}`,
        })
      );
      appendEventSamples.push(ms);
      historyEventsCreated += 1;
    });
    heapSnapshots.push(snapshotHeap('after_event_seed'));

    const outboxAfterSeed = await pool.query<{ n: string }>(
      `SELECT count(*)::int AS n FROM case_workspace_event_outbox WHERE organization_id = $1`,
      [fixture.orgId]
    );
    const outboxRowsTotalAfterSeed = Number(outboxAfterSeed.rows[0]?.n ?? 0);

    // -----------------------------------------------------------------
    // 4. Read-path p95 measurements — the exact 4 queries the owner named:
    //    Case list, Plan graph, history/timeline, outbox backlog gauge.
    // -----------------------------------------------------------------
    const listCasesSamples: number[] = [];
    for (let i = 0; i < options.queryReps; i += 1) {
      const { ms } = await timed(() =>
        caseCoreService.listCasesForOrganization(fixture.orgId, undefined, fixture.actorId)
      );
      listCasesSamples.push(ms);
    }

    const getGraphSamples: number[] = [];
    for (let i = 0; i < options.queryReps; i += 1) {
      const { ms } = await timed(() =>
        casePlanVersionService.getGraph(planVersion.casePlanVersionId, fixture.actorId)
      );
      getGraphSamples.push(ms);
    }

    const historySampleCaseIds = caseIds.filter((_, i) => i % Math.max(1, Math.floor(caseIds.length / options.queryReps)) === 0).slice(0, options.queryReps);
    const historySamples: number[] = [];
    for (const caseId of historySampleCaseIds) {
      const { ms } = await timed(() =>
        caseHistoryService.listCaseHistoryEventsForCase(caseId, undefined, { limit: 200 }, fixture.actorId)
      );
      historySamples.push(ms);
    }

    const backlogSamples: number[] = [];
    for (let i = 0; i < Math.min(10, options.queryReps); i += 1) {
      const { ms } = await timed(() => eventOutboxService.getOutboxBacklog({ organizationId: fixture.orgId }));
      backlogSamples.push(ms);
    }
    heapSnapshots.push(snapshotHeap('after_read_queries'));

    // -----------------------------------------------------------------
    // 5. Drain the outbox — p95 per dispatch batch + throughput.
    // -----------------------------------------------------------------
    const dispatchLatencies: number[] = [];
    let totalDelivered = 0;
    let totalFailed = 0;
    let totalBatches = 0;
    const dispatchStart = performance.now();
    for (;;) {
      const { result, ms } = await timed(() =>
        eventOutboxService.dispatchPendingEvents({
          batchSize: options.dispatchBatchSize,
          organizationId: fixture.orgId,
        })
      );
      totalBatches += 1;
      dispatchLatencies.push(ms);
      totalDelivered += result.delivered;
      totalFailed += result.failed;
      if (result.claimed === 0) break;
      // Safety valve — never loop forever even if something is stuck.
      if (totalBatches > 5000) {
        errors.push('dispatch loop aborted after 5000 batches (safety valve)');
        break;
      }
    }
    const dispatchWallMs = performance.now() - dispatchStart;
    heapSnapshots.push(snapshotHeap('after_dispatch_drain'));

    const outboxAfterDispatch = await pool.query<{ delivered: string; pending: string }>(
      `SELECT
         count(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered,
         count(*) FILTER (WHERE delivered_at IS NULL)::int AS pending
       FROM case_workspace_event_outbox WHERE organization_id = $1`,
      [fixture.orgId]
    );

    // -----------------------------------------------------------------
    // 6. Heap after forced GC (needs --expose-gc on the runner process).
    // -----------------------------------------------------------------
    const gcRan = forceGcIfAvailable();
    const postGcSnapshot = gcRan ? snapshotHeap('after_forced_gc') : null;
    if (postGcSnapshot) heapSnapshots.push(postGcSnapshot);

    // -----------------------------------------------------------------
    // 7. Failure injection (optional — see runFailureInjection()).
    // -----------------------------------------------------------------
    let failureInjection: ProfileResult['failureInjection'] = {
      skipped: true,
      reason: 'runFailureInjection=false',
    };
    if (options.runFailureInjection) {
      try {
        failureInjection = await runFailureInjection(pool, options.databaseUrl, fixture.orgId, fixture.actorId, caseIds[1] ?? caseIds[0]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`failure injection stage threw: ${message}`);
        failureInjection = { skipped: true, reason: `threw: ${message}` };
      }
    }

    // -----------------------------------------------------------------
    // 8. Optional short soak (supplementary — see PERFORMANCE_EVIDENCE.md
    //    for why this is NOT the DoD-I 30-minute browser Run).
    // -----------------------------------------------------------------
    let soak: ProfileResult['soak'] = { skipped: true, reason: 'soakMs<=0' };
    if (options.soakMs > 0) {
      soak = await runSoak(options.soakMs, fixture.orgId, fixture.actorId);
    }

    const finishedAt = new Date().toISOString();
    const totalDurationMs = performance.now() - t0;

    const baselineHeapUsedMB = heapSnapshots[0].heapUsedMB;
    const postSeed = heapSnapshots.find((h) => h.label === 'after_event_seed') ?? heapSnapshots[heapSnapshots.length - 1];
    const postQueries = heapSnapshots.find((h) => h.label === 'after_read_queries') ?? postSeed;
    const postGc = postGcSnapshot;

    return {
      runId: options.runId,
      startedAt,
      finishedAt,
      totalDurationMs: round2(totalDurationMs),
      options: {
        runId: options.runId,
        caseCount: options.caseCount,
        nodeCount: options.nodeCount,
        edgeCount: options.edgeCount,
        eventsPerCase: options.eventsPerCase,
        caseConcurrency: options.caseConcurrency,
        eventConcurrency: options.eventConcurrency,
        dispatchBatchSize: options.dispatchBatchSize,
        queryReps: options.queryReps,
        runFailureInjection: options.runFailureInjection,
        soakMs: options.soakMs,
      },
      env,
      counts: {
        casesRequested: options.caseCount,
        casesCreated: caseIds.length,
        planNodes: graph.nodes.length,
        planEdges: graph.edges.length,
        historyEventsRequested: eventJobs.length,
        historyEventsCreated,
        outboxRowsTotalAfterSeed,
        outboxRowsDeliveredAfterDispatch: Number(outboxAfterDispatch.rows[0]?.delivered ?? 0),
        outboxRowsPendingAfterDispatch: Number(outboxAfterDispatch.rows[0]?.pending ?? 0),
      },
      seedLatency: {
        createCase: summarize(createCaseSamples),
        createPlanDraft: summarize([createPlanDraftMs]),
        appendHistoryEvent: summarize(appendEventSamples),
      },
      queryLatency: {
        listCasesForOrganization: summarize(listCasesSamples),
        getPlanVersionGraph: summarize(getGraphSamples),
        listCaseHistoryEventsForCase: summarize(historySamples),
        getOutboxBacklog: summarize(backlogSamples),
      },
      dispatch: {
        batchSize: options.dispatchBatchSize,
        batchLatency: summarize(dispatchLatencies),
        totalBatches,
        totalDelivered,
        totalFailed,
        totalDispatchWallMs: round2(dispatchWallMs),
        eventsPerSecond: dispatchWallMs > 0 ? round2((totalDelivered / dispatchWallMs) * 1000) : 0,
      },
      heap: {
        snapshots: heapSnapshots,
        gcExposed: env.gcExposed,
        baselineHeapUsedMB,
        postSeedHeapUsedMB: postSeed.heapUsedMB,
        postQueriesHeapUsedMB: postQueries.heapUsedMB,
        postGcHeapUsedMB: postGc ? postGc.heapUsedMB : null,
        growthPctBaselineToPostGc:
          postGc && baselineHeapUsedMB > 0
            ? round2(((postGc.heapUsedMB - baselineHeapUsedMB) / baselineHeapUsedMB) * 100)
            : null,
      },
      failureInjection,
      soak,
      errors,
    };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Failure injection: "what happens when the process/connection dies in the
// middle of a dispatch batch". See PERFORMANCE_EVIDENCE.md for the narrative
// interpretation of this result.
// ---------------------------------------------------------------------------

async function runFailureInjection(
  pool: Pool,
  databaseUrl: string,
  organizationId: string,
  actorId: string,
  caseId: string
): Promise<FailureInjectionResult> {
  const PROBE_COUNT = 24;
  const dbName = new URL(databaseUrl).pathname.replace(/^\//, '');

  // 1. Seed a small, ISOLATED batch of probe events — run only after the
  //    main backlog has already been fully drained (by the caller), so this
  //    dispatch call claims EXACTLY this batch and nothing older.
  for (let i = 0; i < PROBE_COUNT; i += 1) {
    await caseHistoryService.appendCaseHistoryEvent({
      organizationId,
      caseId,
      eventType: PROBE_EVENT_TYPE,
      actorId,
      occurredAt: new Date().toISOString(),
      summary: `failure injection probe ${i}`,
      sourceTable: 'cwperf_failure_injection',
      sourceId: `probe-${i}`,
    });
  }

  const pending = await pool.query<{ event_id: string }>(
    `SELECT event_id FROM case_workspace_event_outbox
       WHERE organization_id = $1 AND event_type = $2 AND delivered_at IS NULL
       ORDER BY sequence_number ASC`,
    [organizationId, PROBE_EVENT_TYPE]
  );
  const orderedIds = pending.rows.map((r) => r.event_id);
  const poisonIndex = Math.floor(orderedIds.length / 2);
  const poisonEventId = orderedIds[poisonIndex];

  let terminatedBackendPid: number | null = null;
  let deliveredBeforePoison = 0;

  const handler = async (event: { eventId: string; eventType: string }) => {
    if (event.eventType !== PROBE_EVENT_TYPE) return;
    if (event.eventId === poisonEventId) {
      // Find the backend holding the open dispatch transaction (it will be
      // "idle in transaction" while this very handler is awaited — the
      // transaction is not running a query right now, it is suspended in
      // JS) and kill it, simulating a crashed connection mid-batch.
      const admin = new Client({ connectionString: databaseUrl });
      await admin.connect();
      try {
        const victims = await admin.query<{ pid: number }>(
          `SELECT pid FROM pg_stat_activity
             WHERE datname = $1 AND state = 'idle in transaction' AND pid <> pg_backend_pid()`,
          [dbName]
        );
        if (victims.rows[0]) {
          terminatedBackendPid = victims.rows[0].pid;
          await admin.query('SELECT pg_terminate_backend($1)', [terminatedBackendPid]);
        }
      } finally {
        await admin.end().catch(() => undefined);
      }
      throw new Error('CW_PERF_INJECTED_MIDDISPATCH_CRASH');
    }
    deliveredBeforePoison += 1;
  };

  eventOutboxService.subscribeToOutboxDelivery(handler as never);

  let rejectionMessage: string | null = null;
  let dispatchRejected = false;
  let unexpectedUncaughtException: string | null = null;
  let injectedSignatureLeakedAsUncaughtException = false;

  // withPgTransaction() (server/src/utils/queryHelpers.ts) opens its own
  // bare `pg.Client` with NO `.on('error', …)` listener attached — a
  // documented node-postgres footgun (see
  // https://node-postgres.com/apis/client#events, "always attach an error
  // listener"). When the backend we `pg_terminate_backend()` in the handler
  // above is the one holding this exact transaction, node-postgres BOTH (a)
  // rejects the in-flight query promise (the path our own try/catch below is
  // built to observe) AND (b) re-emits 'error' on the bare Client with zero
  // listeners, which is an uncaught EventEmitter 'error' — Node's default
  // behavior for that is to crash the whole process. This guard is what lets
  // this harness observe (a) without dying to (b); it is deliberately
  // NARROW (matches only the exact injected-crash signature) so it can never
  // silently swallow an unrelated real bug — see the `unexpectedUncaughtException`
  // field in the result this function returns, which surfaces exactly that.
  const INJECTED_CRASH_SIGNATURE = /terminating connection due to administrator command|ECONNRESET|Connection terminated/i;
  const uncaughtGuard = (err: Error) => {
    if (INJECTED_CRASH_SIGNATURE.test(err.message)) {
      // Expected fallout of our own pg_terminate_backend() call above —
      // record and continue; the query-promise rejection path below is the
      // one this function's assertions are actually built on.
      injectedSignatureLeakedAsUncaughtException = true;
      return;
    }
    unexpectedUncaughtException = `${err.name}: ${err.message}`;
  };
  process.on('uncaughtException', uncaughtGuard);

  try {
    await eventOutboxService.dispatchPendingEvents({
      batchSize: PROBE_COUNT,
      organizationId,
    });
  } catch (err) {
    dispatchRejected = true;
    rejectionMessage = err instanceof Error ? err.message : String(err);
  } finally {
    eventOutboxService.clearOutboxDeliverySubscribers();
    process.off('uncaughtException', uncaughtGuard);
  }

  if (unexpectedUncaughtException) {
    throw new Error(
      `failure injection observed an UNRELATED uncaughtException (not our own injected connection kill): ${unexpectedUncaughtException}`
    );
  }

  // Give the terminated connection a moment to fully drop before re-querying.
  await new Promise((r) => setTimeout(r, 300));

  const afterCrash = await pool.query<{ delivered: string; attempts: string }>(
    `SELECT
       count(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered,
       max(delivery_attempt_count)::int AS attempts
     FROM case_workspace_event_outbox WHERE organization_id = $1 AND event_type = $2`,
    [organizationId, PROBE_EVENT_TYPE]
  );
  const deliveredAfterCrash = Number(afterCrash.rows[0]?.delivered ?? 0);
  const attemptCountAfterCrash = Number(afterCrash.rows[0]?.attempts ?? 0);

  // Recovery: dispatch again, this time letting every handler succeed.
  const recovery = await eventOutboxService.dispatchPendingEvents({
    batchSize: PROBE_COUNT,
    organizationId,
  });

  const finalState = await pool.query<{ total: string; delivered: string; distinct_ids: string }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered,
            count(DISTINCT event_id)::int AS distinct_ids
       FROM case_workspace_event_outbox WHERE organization_id = $1 AND event_type = $2`,
    [organizationId, PROBE_EVENT_TYPE]
  );
  const totalProbeRows = Number(finalState.rows[0]?.total ?? 0);
  const deliveredProbeRows = Number(finalState.rows[0]?.delivered ?? 0);
  const distinctIds = Number(finalState.rows[0]?.distinct_ids ?? 0);

  const verdict =
    deliveredAfterCrash === 0 && dispatchRejected
      ? `ATOMIC_ROLLBACK: the whole in-flight batch (including rows delivered to consumer handlers before the poison row) was rolled back when the connection was killed mid-transaction — no partial delivery reached the database, and no bookkeeping (delivery_attempt_count) for the crash attempt persisted either. This is CORRECT for exactly-once DB state, but it means any consumer handler for the pre-poison rows that already produced a real external side effect (email sent, webhook called, etc.) before the crash WILL have that handler invoked again on the next successful dispatch — the framework guarantees outbox-row atomicity, not consumer-handler idempotency across a crash-retry.${injectedSignatureLeakedAsUncaughtException ? ' ADDITIONALLY: the connection kill also fired as an unlistened pg.Client "error" event (see crashAttempt.crashAlsoLeakedAsUnlistenedClientErrorEvent) — in a real server process (no harness guard) this class of event crashes the ENTIRE process, not just this one dispatch call.' : ''}`
      : `UNEXPECTED: deliveredAfterCrash=${deliveredAfterCrash}, dispatchRejected=${dispatchRejected} — see raw fields, does not match the atomic-rollback hypothesis and needs manual review.`;

  return {
    probeEventCount: PROBE_COUNT,
    poisonEventId: poisonEventId ?? 'NONE_FOUND',
    poisonPositionInBatch: poisonIndex,
    crashAttempt: {
      dispatchRejected,
      rejectionMessage,
      deliveredAfterCrash,
      attemptCountAfterCrash,
      terminatedBackendPid,
      crashAlsoLeakedAsUnlistenedClientErrorEvent: injectedSignatureLeakedAsUncaughtException,
    },
    recoveryAttempt: {
      claimed: recovery.claimed,
      delivered: recovery.delivered,
      failed: recovery.failed,
    },
    finalState: {
      totalProbeRows,
      deliveredProbeRows,
      duplicateEventIds: totalProbeRows - distinctIds,
    },
    verdict,
  };
}

// ---------------------------------------------------------------------------
// Supplementary short soak — NOT the DoD-I 30-minute browser Run. See
// PERFORMANCE_EVIDENCE.md's explicit EVIDENCE_MISSING note on that gap.
// ---------------------------------------------------------------------------

async function runSoak(durationMs: number, organizationId: string, actorId: string): Promise<SoakResult> {
  const start = performance.now();
  const heapSamples: HeapSnapshot[] = [snapshotHeap('soak_start')];
  const latencies: number[] = [];
  let iterations = 0;
  const sampleEveryMs = Math.max(5000, Math.floor(durationMs / 12));
  let nextSampleAt = sampleEveryMs;

  while (performance.now() - start < durationMs) {
    const { ms } = await timed(() => caseCoreService.listCasesForOrganization(organizationId, undefined, actorId));
    latencies.push(ms);
    iterations += 1;
    const elapsed = performance.now() - start;
    if (elapsed >= nextSampleAt) {
      heapSamples.push(snapshotHeap(`soak_${Math.round(elapsed / 1000)}s`));
      nextSampleAt += sampleEveryMs;
    }
  }
  heapSamples.push(snapshotHeap('soak_end'));

  return {
    durationMsRequested: durationMs,
    durationMsActual: round2(performance.now() - start),
    iterations,
    heapSamples,
    listCasesLatency: summarize(latencies),
  };
}
