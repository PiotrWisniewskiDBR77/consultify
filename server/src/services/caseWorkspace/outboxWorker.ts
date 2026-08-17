/**
 * Case Workspace — the PRODUCTION OUTBOX WORKER (CW-T-E, Problem 2).
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS
 * ===========================================================================
 * eventOutboxService.dispatchPendingEvents() is a correct, transactionally
 * sound PRIMITIVE — it claims a batch with `FOR UPDATE SKIP LOCKED`,
 * delivers, and records retry/dead-letter bookkeeping. Before this file,
 * NOTHING called it outside a test: grep the pre-existing repo and every
 * call site is inside a `*.pg.test.ts`. A row committed to
 * `case_workspace_event_outbox` sat there forever — every durable consumer
 * registered via `subscribeToOutboxDelivery()` would simply never run in a
 * real deployment. This file is the missing caller: a real interval loop,
 * started once at boot, that keeps calling `dispatchPendingEvents()` for as
 * long as the process lives.
 *
 * ===========================================================================
 * WHAT THIS FILE DOES NOT DO, ON PURPOSE
 * ===========================================================================
 * It adds NO new delivery mechanism, NO new retry policy and NO new
 * dead-letter rule — all of that already lives in eventOutboxService.ts and
 * is correct. This file is orchestration only: when to call
 * dispatchPendingEvents(), how often, what to do with a tick's own failure
 * (log and try again next tick — never crash the process over a transient DB
 * blip), and a small in-process metrics snapshot for `/health`-style
 * diagnostics. It is deliberately the SAME shape as
 * server/src/services/notificationOutboxService.ts's own
 * `startNotificationOutboxDrainCron()` (a sibling outbox worker already in
 * production) — same skip-under-test convention, same unref'd timer, same
 * "first tick shortly after boot, then on interval" pattern.
 *
 * ===========================================================================
 * "RESTART DOES NOT LOSE OR DUPLICATE THE EFFECT" — WHY THAT IS ALREADY TRUE
 * ===========================================================================
 * This worker keeps NO durable state of its own. Every fact that decides
 * "is this event still owed" and "how many times has delivery been tried"
 * lives in Postgres, on the row itself (`delivered_at`,
 * `delivery_attempt_count` — see eventOutboxService.ts's own header). A
 * fresh worker instance — a new process, after a crash or a deploy — simply
 * calls `dispatchPendingEvents()` again and picks up exactly the rows that
 * are still `delivered_at IS NULL`, in the same deterministic
 * `sequence_number` order (server/migrations/
 * 20260810e_case_workspace_event_correlation.sql) any prior instance would
 * have used. `ON CONFLICT (event_id) DO NOTHING` on the PRODUCER side
 * (publishEvent) is what prevents a re-run of the ORIGINAL command from
 * duplicating the fact; `delivered_at` being set exactly once is what
 * prevents this WORKER from redelivering an already-delivered row. Neither
 * property depends on the worker's own uptime.
 *
 * ===========================================================================
 * PRODUCTION WIRING — the one thing this packet's allowlist does not cover
 * ===========================================================================
 * CW-T-E's allowlist for this packet does not include server/src/index.ts
 * (collision-avoidance mandate — five other agents are editing this shared
 * worktree concurrently). This file therefore does not call itself; the
 * production call site to add, mirroring notificationOutboxService's own
 * (`server/src/index.ts` — search `startNotificationOutboxDrainCron`), is:
 *
 *   import { startCaseWorkspaceOutboxWorker } from
 *     './services/caseWorkspace/outboxWorker.js';
 *   startCaseWorkspaceOutboxWorker();
 *
 * called once at server boot, after the database pool is ready. See this
 * packet's report for the exact recommended location.
 */

import logger from '../../utils/Logger.js';
import { durableOperationalAlertsEnabled, recordOperationalAlertSignal } from '../operationalAlertSignalDeliveryService.js';
import {
  countDeadLetterEvents,
  dispatchPendingEvents,
  getOutboxBacklog,
  listDeadLetterEvents,
  type DispatchPendingEventsResult,
} from './eventOutboxService.js';
import {
  runInboxReconciliationSweep,
  type InboxReconciliationSweepResult,
} from './eventInboxService.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface OutboxWorkerTickResult extends DispatchPendingEventsResult {
  /** §8 dead-letter surface, sampled AFTER this tick's dispatch. */
  deadLetterCount: number;
  /** §10 lag metric (row count), sampled AFTER this tick's dispatch. */
  pendingBacklog: number;
  /**
   * §10 lag metric (TIME), sampled AFTER this tick's dispatch — how old the
   * oldest still-pending row is, in seconds. `pendingBacklog` alone conflates
   * "many small events just arrived" with "something has been stuck for an
   * hour"; this is the number that actually answers "is anything late".
   * `null` only when the backlog is empty.
   */
  oldestPendingAgeSeconds: number | null;
  durationMs: number;
  /**
   * true when this result was returned early by `tickTimeoutMs` because the
   * underlying `dispatchPendingEvents()` call had not settled yet (a
   * pathologically slow query, or a durable consumer registered via
   * `subscribeToOutboxDelivery()` that never resolves — e.g. an outbound
   * webhook call with no timeout of its own). claimed/delivered/failed are
   * `0`/unknown on a timed-out result — the real numbers land later, applied
   * to `getOutboxWorkerMetrics()`'s cumulative totals whenever the slow call
   * actually finishes (see `runOutboxWorkerTick`'s own doc). A timed-out
   * result does NOT mean the dispatch was cancelled — Postgres/Node give no
   * way to cancel an in-flight query or an already-awaited handler promise
   * from here; it means the WORKER LOOP stopped waiting on it so one wedged
   * tick cannot wedge every future tick.
   */
  timedOut: boolean;
}

export interface OutboxWorkerOptions {
  /** Milliseconds between ticks when the previous tick was clean. Floored at 500ms. Default 5000ms. */
  intervalMs?: number;
  /**
   * Ceiling for the exponential-backoff delay applied after a tick that saw
   * `failed > 0` (doubles per consecutive bad tick, reset to `intervalMs` by
   * the next clean tick). Default `intervalMs * 8`. This is a TICK-CADENCE
   * backoff — it does not (and, without a `next_retry_at` column on
   * `case_workspace_event_outbox`, cannot from this file alone) delay
   * reclaiming one specific failing row; see `runOutboxWorkerTick`'s header
   * for why per-row backoff is out of this file's reach.
   */
  maxIntervalMs?: number;
  /**
   * How long a single tick may run before the interval loop stops waiting on
   * it and schedules the next one anyway (§10 "stuck lease" observability —
   * see `OutboxWorkerTickResult.timedOut`). Default
   * `max(intervalMs * 6, 30000)`.
   */
  tickTimeoutMs?: number;
  /**
   * Run a deeper dead-letter reconciliation sweep (`runOutboxReconciliationSweep`)
   * every N clean ticks. Default 12 (≈ once a minute at the 5s default
   * interval). A timed-out tick never counts towards this cadence.
   */
  reconciliationEveryNTicks?: number;
  batchSize?: number;
  /** Tenant-scoped worker (rare — normally omitted to dispatch every tenant). */
  organizationId?: string;
  onTick?: (result: OutboxWorkerTickResult) => void;
  onTickError?: (error: unknown) => void;
  /**
   * Bypass the `NODE_ENV=test` skip. Tests that want to exercise the actual
   * interval loop (restart recovery, concurrent workers) set this — every
   * other test calls `runOutboxWorkerTick()` directly instead, same
   * convention as notificationOutboxService's own `drainOnce()`.
   */
  forceEnable?: boolean;
}

/** §8 dead-letter reconciliation surface — one sampled row, no payload. */
export interface DeadLetterSampleEntry {
  eventId: string;
  eventType: string;
  deliveryAttemptCount: number;
  lastDeliveryError: string | null;
}

export interface ReconciliationSweepResult {
  /** Rows actually returned in `sample` (bounded by `sampleLimit`). */
  sampledCount: number;
  sample: DeadLetterSampleEntry[];
}

export interface OutboxWorkerMetricsSnapshot {
  running: boolean;
  startedAt: string | null;
  ticks: number;
  lastTickAt: string | null;
  lastTickDurationMs: number | null;
  lastTickResult: OutboxWorkerTickResult | null;
  totalClaimed: number;
  totalDelivered: number;
  totalFailed: number;
  /** Resets to 0 on the first tick that does not itself throw. */
  consecutiveTickErrors: number;
  lastTickError: string | null;
  /** §10 "stuck leases ... observable": count of ticks that hit `tickTimeoutMs`. */
  stuckTicks: number;
  /** Current tick-cadence backoff multiplier (1 = base interval, doubles per consecutive bad tick). */
  currentBackoffMultiplier: number;
  /** Delay, in ms, before the interval loop's next scheduled tick. `null` when the loop is not running. */
  nextTickDelayMs: number | null;
  /** Rolling p50 tick duration (ms) over the last `TICK_DURATION_HISTORY_LIMIT` ticks — a delivery-latency proxy. */
  tickDurationMsP50: number | null;
  /** Rolling p95 tick duration (ms) over the last `TICK_DURATION_HISTORY_LIMIT` ticks. */
  tickDurationMsP95: number | null;
  lastReconciliationAt: string | null;
  /** Most recent dead-letter reconciliation sample (bounded, event ids + attempt counts, no payload). */
  lastDeadLetterSample: DeadLetterSampleEntry[];
  /**
   * §8 inbox reconciliation — mirrors eventInboxService.runInboxReconciliationSweep()'s
   * last result onto the same operator-facing snapshot as the outbox's own
   * dead-letter sample. Non-zero here means the "receiveExternalEvent is
   * atomic, so no row is ever durably RECEIVED" invariant was violated and a
   * human needs to look — see that function's own header for why.
   */
  lastInboxReconciliationAt: string | null;
  lastInboxStaleSample: InboxReconciliationSweepResult['sample'];
}

// ---------------------------------------------------------------------------
// In-process state — deliberately the ONLY state this file keeps, and none
// of it is load-bearing for correctness (see the header's "restart" section).
// ---------------------------------------------------------------------------

/** Ceiling on the tick-cadence backoff multiplier (1x, 2x, 4x, ... capped here). */
const MAX_BACKOFF_MULTIPLIER = 8;
/** Rolling window size for the tick-duration p50/p95 delivery-latency proxy. */
const TICK_DURATION_HISTORY_LIMIT = 50;

let timer: ReturnType<typeof setTimeout> | null = null;
let loopRunning = false;
let tickInFlight: Promise<void> | null = null;
let backoffMultiplier = 1;
let tickDurationHistory: number[] = [];
let metrics: OutboxWorkerMetricsSnapshot = freshMetrics();

function freshMetrics(): OutboxWorkerMetricsSnapshot {
  return {
    running: false,
    startedAt: null,
    ticks: 0,
    lastTickAt: null,
    lastTickDurationMs: null,
    lastTickResult: null,
    totalClaimed: 0,
    totalDelivered: 0,
    totalFailed: 0,
    consecutiveTickErrors: 0,
    lastTickError: null,
    stuckTicks: 0,
    currentBackoffMultiplier: 1,
    nextTickDelayMs: null,
    tickDurationMsP50: null,
    tickDurationMsP95: null,
    lastReconciliationAt: null,
    lastDeadLetterSample: [],
    lastInboxReconciliationAt: null,
    lastInboxStaleSample: [],
  };
}

function percentile(sortedMs: number[], p: number): number | null {
  if (sortedMs.length === 0) return null;
  const idx = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[Math.max(0, idx)] ?? null;
}

/**
 * Apply ONE completed tick's real result to the module-level metrics. Called
 * exactly once per tick that actually finishes — including a tick that first
 * returned `timedOut: true` to its caller (see `runOutboxWorkerTick`): the
 * slow underlying call still lands here, late, once it settles, so the
 * cumulative totals are never permanently short a tick's worth of work just
 * because the loop stopped waiting on it.
 */
function applyTickResultToMetrics(result: OutboxWorkerTickResult): void {
  metrics.ticks += 1;
  metrics.lastTickAt = new Date().toISOString();
  metrics.lastTickDurationMs = result.durationMs;
  metrics.lastTickResult = result;
  metrics.totalClaimed += result.claimed;
  metrics.totalDelivered += result.delivered;
  metrics.totalFailed += result.failed;
  metrics.consecutiveTickErrors = 0;
  metrics.lastTickError = null;

  tickDurationHistory.push(result.durationMs);
  if (tickDurationHistory.length > TICK_DURATION_HISTORY_LIMIT) tickDurationHistory.shift();
  const sortedDurations = [...tickDurationHistory].sort((a, b) => a - b);
  metrics.tickDurationMsP50 = percentile(sortedDurations, 50);
  metrics.tickDurationMsP95 = percentile(sortedDurations, 95);

  // Tick-cadence backoff (§ OutboxWorkerOptions.maxIntervalMs doc): a tick
  // that saw ANY delivery failure doubles the next delay (capped); a fully
  // clean tick (failed === 0) resets to the base interval immediately — a
  // single recovered tick is trusted, not phased back in gradually, because
  // dispatchPendingEvents() re-claims failed rows automatically regardless
  // of this file's own cadence (see the header).
  backoffMultiplier =
    result.failed > 0 ? Math.min(MAX_BACKOFF_MULTIPLIER, backoffMultiplier * 2) : 1;
  metrics.currentBackoffMultiplier = backoffMultiplier;
}

// ---------------------------------------------------------------------------
// runOutboxWorkerTick — ONE dispatch pass. The pure, directly-testable
// primitive behind the interval loop below (same split as
// notificationOutboxService's drainOnce() vs startNotificationOutboxDrainCron()).
// ---------------------------------------------------------------------------

/**
 * The actual claim-and-deliver work of one tick. Broken out of
 * `runOutboxWorkerTick` so that a tick which is returned to its caller EARLY
 * (via `tickTimeoutMs`, see below) still has its real outcome applied to
 * `getOutboxWorkerMetrics()` whenever `dispatchPendingEvents()` and the
 * post-tick reads actually finish, instead of that work being silently
 * discarded.
 */
async function runTickBody(
  options: { batchSize?: number; organizationId?: string },
  startedAt: number
): Promise<OutboxWorkerTickResult> {
  const dispatch = await dispatchPendingEvents({
    batchSize: options.batchSize,
    organizationId: options.organizationId,
  });
  const [deadLetterCount, backlog] = await Promise.all([
    countDeadLetterEvents({ organizationId: options.organizationId }),
    getOutboxBacklog({ organizationId: options.organizationId }),
  ]);

  const result: OutboxWorkerTickResult = {
    ...dispatch,
    deadLetterCount,
    pendingBacklog: backlog.pending,
    oldestPendingAgeSeconds: backlog.oldestPendingAgeSeconds,
    durationMs: Date.now() - startedAt,
    timedOut: false,
  };

  applyTickResultToMetrics(result);

  if (options.organizationId && durableOperationalAlertsEnabled()) {
    const bucket = Math.floor(startedAt / 60_000);
    const base = {
      organizationId: options.organizationId,
      actorId: 'system:case-workspace-outbox',
      correlationId: `case-outbox:${options.organizationId}:${bucket}`,
      sourceType: 'case_workspace_event_outbox',
      sourceId: `tick:${bucket}`,
    };
    await Promise.all([
      recordOperationalAlertSignal({ ...base, kind: 'OUTBOX_OLDEST_AGE', outcome: 'SAMPLE', observedValue: (backlog.oldestPendingAgeSeconds ?? 0) * 1000, idempotencyKey: `case:${options.organizationId}:${bucket}:age` }),
      ...(result.delivered > 0 ? [recordOperationalAlertSignal({ ...base, sourceId: `tick:${bucket}:success`, kind: 'WRITE_FAILURE_RATE', outcome: 'SUCCESS', observedValue: result.delivered, idempotencyKey: `case:${options.organizationId}:${bucket}:success` })] : []),
      ...(result.failed > 0 ? [recordOperationalAlertSignal({ ...base, sourceId: `tick:${bucket}:failure`, kind: 'WRITE_FAILURE_RATE', outcome: 'FAILURE', observedValue: result.failed, idempotencyKey: `case:${options.organizationId}:${bucket}:failure` })] : []),
    ]);
  }

  if (result.failed > 0 || deadLetterCount > 0) {
    logger.warn(
      `[CaseWorkspaceOutboxWorker] tick: claimed=${result.claimed} delivered=${result.delivered} ` +
        `failed=${result.failed} deadLetter=${deadLetterCount} pendingBacklog=${backlog.pending} ` +
        `queueLagSeconds=${backlog.oldestPendingAgeSeconds ?? 'n/a'}` +
        `${options.organizationId ? ` org=${options.organizationId}` : ''}`
    );
  }

  return result;
}

/**
 * One claim-and-deliver pass, plus a post-tick metrics sample (dead-letter
 * count, pending backlog, queue-lag age). Safe to call directly and
 * repeatedly — this is what every test in this packet does that does not
 * need the interval loop itself; the loop below is a thin wrapper that calls
 * this on a (backoff-adjusted) timer and never overlaps two ticks from its
 * OWN scheduling (see `startCaseWorkspaceOutboxWorker`'s `tickInFlight`
 * guard) — concurrent ticks from DIFFERENT processes/callers are already
 * safe regardless, via `FOR UPDATE SKIP LOCKED` in eventOutboxService.ts.
 *
 * =========================================================================
 * `tickTimeoutMs` — stuck-tick recovery (§10 "stuck leases ... observable")
 * =========================================================================
 * This outbox has no lease/lock-expiry column of its own: `dispatchPendingEvents()`
 * claims and delivers a batch inside ONE short transaction, so a dispatcher
 * that crashes mid-batch has Postgres release its row locks the instant the
 * connection dies — there is no lease to expire and nothing to sweep (proved
 * against a real crash in outboxWorker.pg.test.ts's "stuck lease recovery"
 * case, which kills a claiming transaction's backend mid-flight with
 * `pg_terminate_backend` and confirms the very next tick recovers the rows
 * immediately, not after any wait).
 *
 * The failure mode THIS option guards against is different and JS-side: a
 * `subscribeToOutboxDelivery()` handler whose returned promise never settles
 * (a webhook call with no timeout, a deadlocked downstream call, ...).
 * `deliverOne()` awaits handlers sequentially inside `dispatchPendingEvents()`'s
 * open transaction, so such a handler wedges that ONE call — and, in the
 * `setInterval`-based design this replaced, would have wedged the interval
 * loop forever (`tickInFlight` never clears). Passing `tickTimeoutMs` races
 * the real work against a timer: if the timer wins, this function returns a
 * `{ timedOut: true, claimed: 0, delivered: 0, failed: 0 }` placeholder
 * immediately so the CALLER (the interval loop) is never blocked — but the
 * real `runTickBody()` call is left running in the background exactly as
 * before (it is not, and cannot be, cancelled), and whenever it does finish
 * — successfully or not — its real outcome is still applied to
 * `getOutboxWorkerMetrics()` (`applyTickResultToMetrics`), so no claimed/
 * delivered/failed count is ever silently lost, only reported late.
 */
export async function runOutboxWorkerTick(
  options: { batchSize?: number; organizationId?: string; tickTimeoutMs?: number } = {}
): Promise<OutboxWorkerTickResult> {
  const startedAt = Date.now();
  const bodyPromise = runTickBody(options, startedAt);

  if (!options.tickTimeoutMs || options.tickTimeoutMs <= 0) {
    return bodyPromise;
  }

  return new Promise<OutboxWorkerTickResult>((resolve, reject) => {
    let settled = false;

    const watchdog = setTimeout(() => {
      if (settled) return;
      settled = true;
      metrics.stuckTicks += 1;
      logger.warn(
        `[CaseWorkspaceOutboxWorker] tick exceeded tickTimeoutMs=${options.tickTimeoutMs}ms — ` +
          `returning early (timedOut=true) so the worker loop is not blocked. The underlying ` +
          `dispatch call is still running and will still update getOutboxWorkerMetrics() when it ` +
          `eventually settles.${options.organizationId ? ` org=${options.organizationId}` : ''}`
      );
      resolve({
        claimed: 0,
        delivered: 0,
        failed: 0,
        failedEventIds: [],
        deadLetterCount: metrics.lastTickResult?.deadLetterCount ?? 0,
        pendingBacklog: metrics.lastTickResult?.pendingBacklog ?? 0,
        oldestPendingAgeSeconds: metrics.lastTickResult?.oldestPendingAgeSeconds ?? null,
        durationMs: Date.now() - startedAt,
        timedOut: true,
      });
    }, options.tickTimeoutMs);
    if (typeof watchdog.unref === 'function') watchdog.unref();

    bodyPromise
      .then((result) => {
        clearTimeout(watchdog);
        if (!settled) {
          settled = true;
          resolve(result);
        }
        // else: the watchdog already returned to the caller — the real
        // result was already applied to metrics inside runTickBody() itself,
        // nothing left to do with it here.
      })
      .catch((error: unknown) => {
        clearTimeout(watchdog);
        if (!settled) {
          settled = true;
          reject(error);
          return;
        }
        // A tick that had already been reported as timed-out failed for
        // real once it finally settled. Nothing awaits this promise anymore
        // (that is the entire point of the watchdog), so surface it as a log
        // line rather than an unhandled rejection.
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(
          `[CaseWorkspaceOutboxWorker] a previously timed-out tick failed after all: ${message}`
        );
      });
  });
}

/**
 * §8 dead-letter reconciliation surface, deeper than the plain count already
 * in every tick result: samples the actual dead-lettered rows (event id,
 * type, attempt count, last error — no payload) so an operator/dashboard has
 * something to act on, not just a number. Read-only — mirrors, never
 * mutates, `listDeadLetterEvents()`. Safe to call directly (every
 * `*.pg.test.ts` in this packet does); the interval loop below also calls it
 * periodically (`OutboxWorkerOptions.reconciliationEveryNTicks`).
 */
export async function runOutboxReconciliationSweep(
  options: { organizationId?: string; sampleLimit?: number } = {}
): Promise<ReconciliationSweepResult> {
  const sampleLimit =
    Number.isInteger(options.sampleLimit) && (options.sampleLimit as number) > 0
      ? (options.sampleLimit as number)
      : 20;
  const rows = await listDeadLetterEvents({
    organizationId: options.organizationId,
    limit: sampleLimit,
  });
  const sample: DeadLetterSampleEntry[] = rows.map((row) => ({
    eventId: row.eventId,
    eventType: row.eventType,
    deliveryAttemptCount: row.deliveryAttemptCount,
    lastDeliveryError: row.lastDeliveryError,
  }));

  metrics.lastReconciliationAt = new Date().toISOString();
  metrics.lastDeadLetterSample = sample;

  if (sample.length > 0) {
    const first = sample[0]!;
    logger.warn(
      `[CaseWorkspaceOutboxWorker] reconciliation sweep: ${sample.length} dead-lettered event(s) ` +
        `sampled — needs human reconciliation. First: ${first.eventId} (${first.eventType}, ` +
        `attempts=${first.deliveryAttemptCount}, lastError=${first.lastDeliveryError ?? 'n/a'})` +
        `${options.organizationId ? ` org=${options.organizationId}` : ''}`
    );
  }

  return { sampledCount: sample.length, sample };
}

/**
 * §8 INBOX reconciliation, run on the same cadence as the outbox's own
 * `runOutboxReconciliationSweep()` above. Thin wrapper: delegates to
 * `eventInboxService.runInboxReconciliationSweep()` (the real detection +
 * `recordInboxProcessingFailure()` logic — see that function's own header
 * for why a stuck-RECEIVED row can only mean the atomicity invariant was
 * violated) and mirrors the result onto `getOutboxWorkerMetrics()` so an
 * operator reads ONE snapshot for both halves of the event spine. Safe to
 * call directly (this packet's own tests do); the interval loop below also
 * calls it periodically, right alongside the outbox sweep.
 */
export async function runCaseWorkspaceInboxReconciliationSweep(
  options: { organizationId?: string; staleAfterMs?: number; sampleLimit?: number } = {}
): Promise<InboxReconciliationSweepResult> {
  const result = await runInboxReconciliationSweep(options);

  metrics.lastInboxReconciliationAt = new Date().toISOString();
  metrics.lastInboxStaleSample = result.sample;

  return result;
}

// ---------------------------------------------------------------------------
// startCaseWorkspaceOutboxWorker / stopCaseWorkspaceOutboxWorker — the
// interval loop. See the header for the production call site.
// ---------------------------------------------------------------------------

/**
 * Start the interval loop. Idempotent — a second call while already running
 * is a no-op (call `stopCaseWorkspaceOutboxWorker()` first to change
 * options). Skipped under `NODE_ENV=test` unless `options.forceEnable` is
 * set — same convention as notificationOutboxService's own
 * `startNotificationOutboxDrainCron()`.
 *
 * Fires once immediately (so a freshly started/restarted worker does not
 * wait a full interval before draining whatever is already pending — the
 * §8 "restart recovery" property), then RESCHEDULES ITSELF (a self-scheduling
 * `setTimeout`, not `setInterval`) after every tick, at a delay that is:
 *   - `intervalMs` after a clean tick (`failed === 0`);
 *   - up to `maxIntervalMs` (default `intervalMs * 8`, doubling per
 *     consecutive bad tick) after a tick that saw `failed > 0` — see
 *     `applyTickResultToMetrics`'s backoff comment for why this is a
 *     TICK-CADENCE backoff, not a per-row one;
 *   - `intervalMs` (not backed off) after a tick that came back `timedOut`,
 *     since a stuck-and-recovered loop should not ALSO wait longer before
 *     trying again.
 * `tickInFlight` guarantees this process's OWN scheduling never starts a
 * second tick while one from this same loop is still in flight — two ticks
 * racing `dispatchPendingEvents` concurrently would be harmless regardless
 * (`FOR UPDATE SKIP LOCKED` already makes that safe across N *processes*),
 * but serializing this loop's own timer keeps its tick metrics meaningful
 * instead of interleaved. `runOutboxWorkerTick`'s own `tickTimeoutMs` is
 * what normally prevents a wedged tick from ever making this guard matter;
 * it exists as the last-resort backstop if that ever fails.
 */
export function startCaseWorkspaceOutboxWorker(options: OutboxWorkerOptions = {}): void {
  if (process.env.NODE_ENV === 'test' && !options.forceEnable) return;
  if (loopRunning) return;

  const intervalMs = Math.max(500, options.intervalMs ?? 5_000);
  const maxIntervalMs = Math.max(intervalMs, options.maxIntervalMs ?? intervalMs * MAX_BACKOFF_MULTIPLIER);
  const tickTimeoutMs = Math.max(intervalMs, options.tickTimeoutMs ?? Math.max(intervalMs * 6, 30_000));
  const reconciliationEveryNTicks = Math.max(1, options.reconciliationEveryNTicks ?? 12);
  let reconciliationCountdown = reconciliationEveryNTicks;

  loopRunning = true;
  metrics.running = true;
  metrics.startedAt = new Date().toISOString();
  backoffMultiplier = 1;
  metrics.currentBackoffMultiplier = 1;

  const scheduleNext = (delayMs: number): void => {
    if (!loopRunning) return;
    metrics.nextTickDelayMs = delayMs;
    timer = setTimeout(runTickCycle, delayMs);
    if (typeof timer.unref === 'function') timer.unref();
  };

  const runTickCycle = (): void => {
    if (tickInFlight) {
      // Last-resort backstop only — `tickTimeoutMs` below is what normally
      // keeps this branch unreached. Try again at the base interval rather
      // than compounding backoff on top of an already-anomalous state.
      scheduleNext(intervalMs);
      return;
    }

    tickInFlight = runOutboxWorkerTick({
      batchSize: options.batchSize,
      organizationId: options.organizationId,
      tickTimeoutMs,
    })
      .then((result) => {
        options.onTick?.(result);
        tickInFlight = null;

        if (!result.timedOut) {
          reconciliationCountdown -= 1;
          if (reconciliationCountdown <= 0) {
            reconciliationCountdown = reconciliationEveryNTicks;
            runOutboxReconciliationSweep({ organizationId: options.organizationId }).catch(
              (error: unknown) => {
                logger.warn(
                  `[CaseWorkspaceOutboxWorker] reconciliation sweep failed (non-fatal): ${
                    error instanceof Error ? error.message : String(error)
                  }`
                );
              }
            );
            // Same cadence, the inbox half of the event spine (§8 "Failed
            // outbox/inbox delivery has retry, dead-letter and
            // reconciliation" — the inbox clause, not just the outbox one).
            runCaseWorkspaceInboxReconciliationSweep({ organizationId: options.organizationId }).catch(
              (error: unknown) => {
                logger.warn(
                  `[CaseWorkspaceOutboxWorker] inbox reconciliation sweep failed (non-fatal): ${
                    error instanceof Error ? error.message : String(error)
                  }`
                );
              }
            );
          }
        }

        const nextDelay = result.timedOut
          ? intervalMs
          : Math.min(maxIntervalMs, intervalMs * backoffMultiplier);
        scheduleNext(nextDelay);
      })
      .catch((error: unknown) => {
        metrics.consecutiveTickErrors += 1;
        metrics.lastTickError = error instanceof Error ? error.message : String(error);
        logger.warn(
          `[CaseWorkspaceOutboxWorker] tick failed (non-fatal, will retry next interval): ${metrics.lastTickError}`
        );
        options.onTickError?.(error);
        tickInFlight = null;
        scheduleNext(Math.min(maxIntervalMs, intervalMs * backoffMultiplier));
      });
  };

  runTickCycle();

  logger.info(
    `[CaseWorkspaceOutboxWorker] started (every ${intervalMs}ms, backoff up to ${maxIntervalMs}ms, ` +
      `tick timeout ${tickTimeoutMs}ms, reconciliation every ${reconciliationEveryNTicks} ticks).`
  );
}

/** Stop the interval loop. Safe to call when not running. Idempotent. */
export function stopCaseWorkspaceOutboxWorker(): void {
  loopRunning = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  metrics.running = false;
  metrics.nextTickDelayMs = null;
}

/** A snapshot of this process's own worker metrics — for `/health`/diagnostics. */
export function getOutboxWorkerMetrics(): OutboxWorkerMetricsSnapshot {
  return { ...metrics };
}

/** Test-only: fully reset in-process worker state between test cases. */
export function _resetOutboxWorkerForTests(): void {
  stopCaseWorkspaceOutboxWorker();
  metrics = freshMetrics();
  backoffMultiplier = 1;
  tickDurationHistory = [];
}
