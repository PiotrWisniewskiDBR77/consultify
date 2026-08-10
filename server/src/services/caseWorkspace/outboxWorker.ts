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
import {
  countDeadLetterEvents,
  dispatchPendingEvents,
  getOutboxBacklog,
  type DispatchPendingEventsResult,
} from './eventOutboxService.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface OutboxWorkerTickResult extends DispatchPendingEventsResult {
  /** §8 dead-letter surface, sampled AFTER this tick's dispatch. */
  deadLetterCount: number;
  /** §10 lag metric, sampled AFTER this tick's dispatch. */
  pendingBacklog: number;
  durationMs: number;
}

export interface OutboxWorkerOptions {
  /** Milliseconds between ticks. Floored at 500ms. Default 5000ms. */
  intervalMs?: number;
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
}

// ---------------------------------------------------------------------------
// In-process state — deliberately the ONLY state this file keeps, and none
// of it is load-bearing for correctness (see the header's "restart" section).
// ---------------------------------------------------------------------------

let timer: ReturnType<typeof setInterval> | null = null;
let tickInFlight: Promise<void> | null = null;
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
  };
}

// ---------------------------------------------------------------------------
// runOutboxWorkerTick — ONE dispatch pass. The pure, directly-testable
// primitive behind the interval loop below (same split as
// notificationOutboxService's drainOnce() vs startNotificationOutboxDrainCron()).
// ---------------------------------------------------------------------------

/**
 * One claim-and-deliver pass, plus a post-tick metrics sample
 * (dead-letter count, pending backlog). Safe to call directly and
 * repeatedly — this is what every test in this packet does; the interval
 * loop below is a thin wrapper that calls this on a timer and never
 * overlaps two ticks (see `tick()`'s `tickInFlight` guard).
 */
export async function runOutboxWorkerTick(
  options: { batchSize?: number; organizationId?: string } = {}
): Promise<OutboxWorkerTickResult> {
  const startedAt = Date.now();
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
    durationMs: Date.now() - startedAt,
  };

  metrics.ticks += 1;
  metrics.lastTickAt = new Date().toISOString();
  metrics.lastTickDurationMs = result.durationMs;
  metrics.lastTickResult = result;
  metrics.totalClaimed += result.claimed;
  metrics.totalDelivered += result.delivered;
  metrics.totalFailed += result.failed;
  metrics.consecutiveTickErrors = 0;
  metrics.lastTickError = null;

  if (result.failed > 0 || deadLetterCount > 0) {
    logger.warn(
      `[CaseWorkspaceOutboxWorker] tick: claimed=${result.claimed} delivered=${result.delivered} ` +
        `failed=${result.failed} deadLetter=${deadLetterCount} pendingBacklog=${backlog.pending}` +
        `${options.organizationId ? ` org=${options.organizationId}` : ''}`
    );
  }

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
 * §8 "restart recovery" property), then on the configured interval.
 * `tickInFlight` guarantees a slow tick is never joined by a second
 * concurrent one from this SAME process — two ticks racing `dispatchPendingEvents`
 * concurrently would be harmless (`FOR UPDATE SKIP LOCKED` already makes
 * that safe across N *processes*), but serializing this process's own timer
 * keeps its tick metrics ("claimed/delivered per tick") meaningful instead
 * of interleaved.
 */
export function startCaseWorkspaceOutboxWorker(options: OutboxWorkerOptions = {}): void {
  if (process.env.NODE_ENV === 'test' && !options.forceEnable) return;
  if (timer) return;

  const intervalMs = Math.max(500, options.intervalMs ?? 5_000);

  const tick = (): void => {
    if (tickInFlight) return;
    tickInFlight = runOutboxWorkerTick({
      batchSize: options.batchSize,
      organizationId: options.organizationId,
    })
      .then((result) => {
        options.onTick?.(result);
      })
      .catch((error: unknown) => {
        metrics.consecutiveTickErrors += 1;
        metrics.lastTickError = error instanceof Error ? error.message : String(error);
        logger.warn(
          `[CaseWorkspaceOutboxWorker] tick failed (non-fatal, will retry next interval): ${metrics.lastTickError}`
        );
        options.onTickError?.(error);
      })
      .finally(() => {
        tickInFlight = null;
      });
  };

  metrics.running = true;
  metrics.startedAt = new Date().toISOString();
  timer = setInterval(tick, intervalMs);
  // A background worker must never be the reason the process refuses to exit.
  if (typeof timer.unref === 'function') timer.unref();
  tick();

  logger.info(`[CaseWorkspaceOutboxWorker] started (every ${intervalMs}ms).`);
}

/** Stop the interval loop. Safe to call when not running. Idempotent. */
export function stopCaseWorkspaceOutboxWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  metrics.running = false;
}

/** A snapshot of this process's own worker metrics — for `/health`/diagnostics. */
export function getOutboxWorkerMetrics(): OutboxWorkerMetricsSnapshot {
  return { ...metrics };
}

/** Test-only: fully reset in-process worker state between test cases. */
export function _resetOutboxWorkerForTests(): void {
  stopCaseWorkspaceOutboxWorker();
  metrics = freshMetrics();
}
