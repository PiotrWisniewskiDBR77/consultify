/**
 * RN-G3 Outbox Dispatcher — cron wiring.
 *
 * Design: docs/product/results-vnext/RN_G3_OUTBOX_DISPATCHER_DESIGN.md §3.
 *
 * Structural mirror of `notificationOutboxService.ts`'s
 * `startNotificationOutboxDrainCron()` (env vars, `NODE_ENV==='test'` skip,
 * module-level timer handle, boot-delay `setTimeout` then `setInterval`,
 * swallow-and-log tick errors) — but the BODY uses `acquirePgClient()` (a
 * pinned `pg.PoolClient`) instead of `DbPromise`, because
 * `claimOutboxBatch`/`reclaimExpiredClaims` need real `BEGIN`/`SELECT ...
 * FOR UPDATE SKIP LOCKED`/`COMMIT` transactions, which `DbPromise` (one
 * connection per call, from the pool) cannot give.
 *
 * BullMQ deliberately not used here — see `outboxDrain.ts`'s header and
 * design §3: the claim/backoff/dead-letter mechanics already exist at the
 * SQL level, BullMQ would duplicate them, not complement them.
 */
import os from 'node:os';

import type { PoolClient } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import logger from '../../../utils/Logger.js';
import { sendSystemAlert } from '../../systemAlertNotifier.js';

import {
  claimOutboxBatch,
  markDispatched,
  markFailed,
  markParked,
  reclaimExpiredClaims,
  type RvnOutboxRow,
} from './outboxDrain.js';
import {
  CONSUMER_REGISTRY,
  UNBUILT_CONSUMER_GROUPS,
  type RvnPlatformEventRow,
} from './consumerRegistry.js';
import { drainExecutionSignalIngress } from './executionSignalIngress.js';

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_BACKOFF_SECONDS = 30;

/** Design §6: CRITICAL dead-letter alert, throttled per consumer_group. */
const DEAD_LETTER_ALERT_THROTTLE_MS = 5 * 60_000;
/** Design §6: parked rows get a separate, INFO-severity, once-per-group-per-hour notice. */
const PARKED_NOTICE_THROTTLE_MS = 60 * 60_000;

export interface OutboxDispatchTickResult {
  reclaimed: number;
  claimed: number;
  dispatched: number;
  parked: number;
  failed: number;
  deadLettered: number;
  noConsumerRegistered: number;
}

async function loadEventForOutboxRow(
  client: PoolClient,
  row: RvnOutboxRow
): Promise<RvnPlatformEventRow | undefined> {
  const result = await client.query<RvnPlatformEventRow>(
    `SELECT e.event_id, e.sequence::text AS sequence, e.event_type, e.aggregate_type,
            e.aggregate_id, e.organization_id, e.actor_user_id, e.actor_effective_role,
            e.occurred_at, e.payload
       FROM rvn_platform_outbox o
       JOIN rvn_platform_events e ON e.event_id = o.event_id
      WHERE o.outbox_id = $1`,
    [row.outbox_id]
  );
  return result.rows[0];
}

/**
 * One dispatch tick, per design §3's tick body: reaper first (same tick),
 * then claim a batch, then dispatch each claimed row sequentially — one
 * row's failure must not abort the batch. Exported directly (not only via
 * the cron loop below) so the acceptance suite can drive exactly one tick
 * deterministically (proof 3: "Run one tick against a seeded
 * kpi.deviation_opened").
 */
export async function runOutboxDispatchTick(
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<OutboxDispatchTickResult> {
  const result: OutboxDispatchTickResult = {
    reclaimed: 0,
    claimed: 0,
    dispatched: 0,
    parked: 0,
    failed: 0,
    deadLettered: 0,
    noConsumerRegistered: 0,
  };

  const workerId = `${os.hostname()}-${process.pid}`;
  const claimClient = await acquirePgClient();
  let rows: RvnOutboxRow[] = [];
  try {
    await claimClient.query('BEGIN');
    result.reclaimed = await reclaimExpiredClaims(claimClient);
    rows = await claimOutboxBatch(claimClient, workerId, batchSize);
    await claimClient.query('COMMIT');
  } catch (err) {
    try {
      await claimClient.query('ROLLBACK');
    } catch {
      // Same defensive double-rollback-is-a-no-op pattern as atomicWrite.ts.
    }
    claimClient.release();
    throw err;
  }
  result.claimed = rows.length;

  // The claim transaction is done — release that client and use one fresh
  // pinned client per row's own dispatch transaction (design §3: "Two
  // transactions per row"). Reusing claimClient here would work too (pg
  // pool clients are single-connection, sequential use is safe), so this
  // just keeps the claim step's connection lifetime visually scoped to the
  // claim step alone.
  claimClient.release();

  for (const row of rows) {
    const dispatchClient = await acquirePgClient();
    try {
      const event = await loadEventForOutboxRow(dispatchClient, row);
      if (!event) {
        // rvn_platform_outbox.event_id has a NOT NULL FK to
        // rvn_platform_events — unreachable in practice, but fail this row
        // rather than crash the whole tick if it ever happens.
        await markFailed(
          dispatchClient,
          row.outbox_id,
          'EVENT_ROW_NOT_FOUND',
          DEFAULT_BACKOFF_SECONDS
        );
        result.failed++;
        continue;
      }

      // IO-C: known-unbuilt consumer group — park, throttled INFO notice,
      // never CRITICAL, never counted as a failure/attempt.
      if (UNBUILT_CONSUMER_GROUPS.has(row.consumer_group)) {
        await markParked(dispatchClient, row.outbox_id, 'CONSUMER_NOT_BUILT');
        result.parked++;
        await sendSystemAlert({
          severity: 'INFO',
          source: 'rvn_platform_outbox',
          title: `Outbox row parked: ${row.consumer_group}`,
          message: `consumer_group="${row.consumer_group}" has no consumer built yet — event_id=${event.event_id} event_type=${event.event_type} parked, not dead-lettered.`,
          throttleKey: `outbox_parked:${row.consumer_group}`,
          throttleMs: PARKED_NOTICE_THROTTLE_MS,
        });
        continue;
      }

      const consumerFn = CONSUMER_REGISTRY[row.consumer_group];
      if (!consumerFn) {
        // Genuinely unregistered AND not in UNBUILT_CONSUMER_GROUPS — this
        // is the "something broke / was never wired up" case design §2 IO-C
        // distinguishes from known backlog; it hard-fails and eventually
        // dead-letters + CRITICAL-alerts, as designed.
        const failResult = await markFailed(
          dispatchClient,
          row.outbox_id,
          'NO_CONSUMER_REGISTERED',
          DEFAULT_BACKOFF_SECONDS
        );
        result.noConsumerRegistered++;
        result.failed++;
        if (failResult.status === 'dead_letter') {
          result.deadLettered++;
          await sendSystemAlert({
            severity: 'CRITICAL',
            source: 'rvn_platform_outbox',
            title: `Outbox row dead-lettered: ${row.consumer_group}`,
            message: `event_id=${event.event_id} event_type=${event.event_type} org=${event.organization_id} attempts=${failResult.attempts} last_error=NO_CONSUMER_REGISTERED`,
            throttleKey: `outbox_dead_letter:${row.consumer_group}`,
            throttleMs: DEAD_LETTER_ALERT_THROTTLE_MS,
          });
        }
        continue;
      }

      try {
        await dispatchClient.query('BEGIN');
        await consumerFn(dispatchClient, event, row);
        await dispatchClient.query('COMMIT');
        await markDispatched(dispatchClient, row.outbox_id);
        result.dispatched++;
      } catch (err) {
        try {
          await dispatchClient.query('ROLLBACK');
        } catch {
          // Same defensive double-rollback-is-a-no-op pattern as atomicWrite.ts.
        }
        const message = err instanceof Error ? err.message : String(err);
        const failResult = await markFailed(
          dispatchClient,
          row.outbox_id,
          message,
          DEFAULT_BACKOFF_SECONDS
        );
        result.failed++;
        if (failResult.status === 'dead_letter') {
          result.deadLettered++;
          await sendSystemAlert({
            severity: 'CRITICAL',
            source: 'rvn_platform_outbox',
            title: `Outbox row dead-lettered: ${row.consumer_group}`,
            message: `event_id=${event.event_id} event_type=${event.event_type} org=${event.organization_id} attempts=${failResult.attempts} last_error=${message}`,
            throttleKey: `outbox_dead_letter:${row.consumer_group}`,
            throttleMs: DEAD_LETTER_ALERT_THROTTLE_MS,
          });
        }
      }
    } finally {
      dispatchClient.release();
    }
  }

  return result;
}

let drainTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the platform outbox drain loop. Skipped under test (call
 * `runOutboxDispatchTick()` directly in tests instead — same convention as
 * `notificationOutboxService.ts`'s `drainOnce()`). Runs every
 * `RVN_PLATFORM_OUTBOX_DRAIN_INTERVAL_MS` (default 60_000ms / 60s);
 * `RVN_PLATFORM_OUTBOX_DRAIN_ENABLED='false'` disables it. Default is ON.
 */
export function startPlatformOutboxDrainCron(): void {
  if (process.env.NODE_ENV === 'test') return;
  if (String(process.env.RVN_PLATFORM_OUTBOX_DRAIN_ENABLED ?? 'true').toLowerCase() === 'false') {
    logger.info('[RvnPlatformOutbox] RVN_PLATFORM_OUTBOX_DRAIN_ENABLED=false — drain not started.');
    return;
  }
  if (drainTimer) return;

  const intervalMs = Math.max(
    5_000,
    Number(process.env.RVN_PLATFORM_OUTBOX_DRAIN_INTERVAL_MS) || 60_000
  );
  const tick = () => {
    void Promise.all([runOutboxDispatchTick(), drainExecutionSignalIngress()]).catch((err) => {
      logger.warn('[RvnPlatformOutbox] drain tick failed (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  };
  // First run shortly after boot, then on the configured interval — same
  // 10s boot delay as notificationOutboxService.ts.
  setTimeout(tick, 10_000);
  drainTimer = setInterval(tick, intervalMs);
  logger.info(`[RvnPlatformOutbox] Drain cron started (every ${Math.round(intervalMs / 1000)}s).`);
}

/** Test-only: reset the timer handle so a fresh startPlatformOutboxDrainCron() can be observed. */
export function _resetPlatformOutboxDrainTimerForTests(): void {
  if (drainTimer) {
    clearInterval(drainTimer);
    drainTimer = null;
  }
}
