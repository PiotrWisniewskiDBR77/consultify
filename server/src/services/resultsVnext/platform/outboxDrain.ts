/**
 * RN-G1 Platform Foundation — outbox drain primitives.
 *
 * Design: docs/product/results-vnext/RN_G1_PLATFORM_DESIGN.md §A.5.
 * Schema: server/migrations/20260809_rvn_platform_events_outbox.sql
 * (`rvn_platform_outbox`).
 *
 * This file is a set of FUNCTIONS, not a process. It deliberately does NOT
 * start a worker/cron/loop — see "Wiring this into a cron" below for how an
 * actual drain loop should be built on top of these functions, mirroring
 * `notificationOutboxService.ts`'s existing drain cron. Wiring that up is
 * out of scope for this package (no consumer/dispatcher exists yet to call
 * on a claimed row — see EXECUTION_LEDGER.md §8, this whole platform layer
 * is inert scaffolding, nothing calls it yet).
 *
 * Status: NOT_IMPLEMENTED as a wired dependency — no cron/route calls this
 * yet (see README.md in this directory).
 *
 * ---------------------------------------------------------------------
 * Wiring this into a cron (DO NOT build this now — documented for the next
 * package that does):
 *
 * `notificationOutboxService.ts` (lines ~202-237) is the existing reference
 * pattern in this repo:
 *   - `NOTIFICATION_OUTBOX_DRAIN_INTERVAL_MS` env var controls the tick
 *     interval (default 60_000ms), `NOTIFICATION_OUTBOX_DRAIN_ENABLED`
 *     ('false' to disable, default ON).
 *   - `startNotificationOutboxDrainCron()` guards `NODE_ENV === 'test'`
 *     (skip under test — tests call `drainOnce()` directly instead),
 *     de-dupes with a module-level `drainTimer` handle, does a first tick
 *     after a 10s boot delay via `setTimeout`, then `setInterval` on the
 *     configured interval, and swallows/logs tick errors so one bad tick
 *     never kills the process.
 *   - It is started from `server/src/index.ts` (~line 1850) alongside the
 *     rest of the app's boot-time cron registration.
 *
 * The analogous RN-G1 wiring would add (in a NEW file, e.g.
 * `platformOutboxDrainCron.ts`, not here — this file stays pure functions):
 *   - `RVN_PLATFORM_OUTBOX_DRAIN_INTERVAL_MS` /
 *     `RVN_PLATFORM_OUTBOX_DRAIN_ENABLED` env vars, same defaults/semantics.
 *   - A `startRvnPlatformOutboxDrainCron()` that on each tick: acquires a
 *     pinned client via `acquirePgClient()`, runs `reclaimExpiredClaims`
 *     first (the reaper — same client, same tick, per design §A.5 comment
 *     "ten sam cron, kolejny krok"), then `claimOutboxBatch`, then for each
 *     claimed row looks up its dispatcher by `consumer_group` (a registry
 *     that does not exist yet — no consumer/projection is implemented),
 *     calls it, and on success/failure calls `markDispatched`/`markFailed`.
 *   - Registered from `server/src/index.ts` next to
 *     `startNotificationOutboxDrainCron()`.
 * ---------------------------------------------------------------------
 */
import type { PoolClient } from 'pg';

import logger from '../../../utils/Logger.js';

export type RvnOutboxStatus = 'pending' | 'claimed' | 'dispatched' | 'failed' | 'dead_letter';

export interface RvnOutboxRow {
  outbox_id: string;
  event_id: string;
  consumer_group: string;
  status: RvnOutboxStatus;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  claimed_by: string | null;
  claimed_at: string | null;
  claim_expires_at: string | null;
  dispatched_at: string | null;
  last_error: string | null;
  created_at: string;
}

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_CLAIM_TTL_MINUTES = 2;

/**
 * Design §A.5 "claim" query, executed literally (parameterized worker id /
 * batch size in place of the design's literal `$worker` / `LIMIT 50`):
 *
 *   UPDATE rvn_platform_outbox
 *   SET status='claimed', claimed_by=$worker, claimed_at=now(),
 *       claim_expires_at=now()+interval '2 minutes'
 *   WHERE outbox_id IN (
 *     SELECT outbox_id FROM rvn_platform_outbox
 *     WHERE status IN ('pending','failed') AND next_attempt_at <= now()
 *     ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED
 *   ) RETURNING *;
 *
 * `FOR UPDATE SKIP LOCKED` is what makes this safe for multiple concurrent
 * workers/dyno instances to poll the same table without claiming the same
 * row twice. Caller supplies the transactional client (same pinned-client
 * convention as the rest of this module family) — this function itself does
 * not open/close a transaction, so a caller running this as part of a
 * larger per-tick transaction (e.g. together with `reclaimExpiredClaims`)
 * can do so on one connection.
 */
export async function claimOutboxBatch(
  client: PoolClient,
  workerId: string,
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<RvnOutboxRow[]> {
  const result = await client.query<RvnOutboxRow>(
    `UPDATE rvn_platform_outbox
        SET status = 'claimed',
            claimed_by = $1,
            claimed_at = now(),
            claim_expires_at = now() + interval '${DEFAULT_CLAIM_TTL_MINUTES} minutes'
      WHERE outbox_id IN (
        SELECT outbox_id FROM rvn_platform_outbox
         WHERE status IN ('pending', 'failed') AND next_attempt_at <= now()
         ORDER BY created_at
         LIMIT $2
         FOR UPDATE SKIP LOCKED
      )
      RETURNING *`,
    [workerId, batchSize]
  );
  return result.rows;
}

/**
 * Design §A.5 reaper, executed literally:
 *
 *   UPDATE rvn_platform_outbox SET status='pending'
 *   WHERE status='claimed' AND claim_expires_at < now();
 *
 * Recovers rows whose claim expired without a `markDispatched`/`markFailed`
 * call (worker crashed/was killed mid-dispatch) so they become claimable
 * again. Per design comment ("ten sam cron, kolejny krok"), the intended
 * caller runs this once per tick, before `claimOutboxBatch`, on the same
 * client/tick as the claim step.
 */
export async function reclaimExpiredClaims(client: PoolClient): Promise<number> {
  const result = await client.query(
    `UPDATE rvn_platform_outbox
        SET status = 'pending'
      WHERE status = 'claimed' AND claim_expires_at < now()
      RETURNING outbox_id`
  );
  return result.rowCount ?? 0;
}

/**
 * Successful delivery. Design §A.5: "Sukces -> dispatched." `attempts` is
 * NOT incremented here — the design only calls out `attempts+=1` on the
 * failure branch, so a successful dispatch does not count against
 * `max_attempts`.
 */
export async function markDispatched(client: PoolClient, outboxId: string): Promise<void> {
  await client.query(
    `UPDATE rvn_platform_outbox
        SET status = 'dispatched', dispatched_at = now()
      WHERE outbox_id = $1`,
    [outboxId]
  );
}

/**
 * Failed delivery. Design §A.5: "Porażka -> attempts+=1, exponential
 * backoff w next_attempt_at, po max_attempts -> dead_letter (wymaga alertu,
 * nie cichy koniec)."
 *
 * `backoffSeconds` is the base delay; the actual delay applied is
 * `backoffSeconds * 2^attempts` (attempts BEFORE this call's increment,
 * i.e. the first failure backs off by `backoffSeconds * 1`, the second by
 * `* 2`, the third by `* 4`, ...), capped at 2^10 multiplier so a
 * long-failing row does not compute an absurd/overflowing interval. The
 * increment, status transition, and backoff computation happen in one
 * UPDATE so there is no read-then-write race on `attempts` between
 * concurrent workers (there should not be any, since a row is only ever
 * touched by whichever worker holds its claim, but the single-statement
 * form costs nothing and removes the assumption).
 */
export async function markFailed(
  client: PoolClient,
  outboxId: string,
  error: string,
  backoffSeconds: number
): Promise<{ status: RvnOutboxStatus; attempts: number }> {
  const result = await client.query<{ status: RvnOutboxStatus; attempts: number }>(
    `UPDATE rvn_platform_outbox
        SET attempts = attempts + 1,
            last_error = $2,
            status = CASE
                       WHEN attempts + 1 >= max_attempts THEN 'dead_letter'
                       ELSE 'failed'
                     END,
            next_attempt_at = CASE
                       WHEN attempts + 1 >= max_attempts THEN next_attempt_at
                       ELSE now() + ($3 * power(2, LEAST(attempts, 10))) * interval '1 second'
                     END
      WHERE outbox_id = $1
      RETURNING status, attempts`,
    [outboxId, error, backoffSeconds]
  );

  const row = result.rows[0];
  if (row?.status === 'dead_letter') {
    // TODO(RN-G1 follow-up): wire this into the repo's actual alerting path
    // (whatever paged/Slack-notified path other dead-letter/exhausted-retry
    // conditions in this codebase use — none identified/built as part of
    // this bounded package). A dead_letter row today is only discoverable
    // by querying rvn_platform_outbox directly or grepping logs for this
    // warning; per design §A.5 ("wymaga alertu, nie cichy koniec") that is
    // NOT sufficient for production, but building a full alerting system is
    // out of scope here.
    logger.warn(
      '[resultsVnext/platform/outboxDrain] outbox row moved to dead_letter — requires alert, see TODO in markFailed',
      { outboxId, attempts: row.attempts, lastError: error }
    );
  }

  return row ?? { status: 'failed', attempts: 0 };
}
