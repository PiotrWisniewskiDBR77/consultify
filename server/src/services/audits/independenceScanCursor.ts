/**
 * independenceScanCursor — durable checkpoint + fenced lease for the audit
 * independence detector sweep (AUD-POL-001 / AMD-AUD-RIGHTS-001).
 *
 * The detector itself (`auditTrailService.getIndependenceReport`) is a
 * per-program read. This module is what lets a scheduled job walk EVERY
 * audit_programs row in bounded batches, survive process restarts, and never
 * starve older rows — see the migration
 * (20261013_audit_independence_scan_cursor.sql) for the full rationale.
 *
 * Concurrency contract:
 *   - `claimLease` atomically takes the lease and INCREMENTS `lease_fence`,
 *     returning the new fence to the claimant. A second worker calling
 *     `claimLease` while the lease is live gets `claimed: false` and does no
 *     work — two processes never run the same batch concurrently.
 *   - Every progress write (`advanceAndRelease`, `releaseLeaseWithoutAdvancing`)
 *     is conditioned on `lease_fence = <the fence this worker holds>`. A worker
 *     whose lease expired and was taken over therefore CANNOT write progress:
 *     its UPDATE matches zero rows and it learns it was superseded. This is the
 *     part a bare expiry timestamp cannot provide.
 *   - Re-processing a batch (after an expired lease is reclaimed, or after a
 *     failed tick releases without advancing) is safe: the detector only READS
 *     domain tables and logs findings. There is no write to be duplicated, so
 *     the sweep is idempotent by construction rather than by bookkeeping.
 *
 * This module carries no policy: it decides scan order and lease ownership,
 * never who may see what.
 */

import type { PoolClient } from 'pg';

import { acquirePgClient } from '../../database/PostgresDatabase.js';

export interface ProgramRef {
  id: string;
  organizationId: string;
}

export interface ClaimedLease {
  claimed: boolean;
  /** Fence token this worker holds; required to write progress. */
  fence: number;
  lastProgramId: string;
  cyclesCompleted: number;
}

/** Generous relative to a bounded batch, short enough that a dead worker's lease frees up quickly. */
export const LEASE_DURATION_MS = 5 * 60 * 1000;

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** Ensures the singleton cursor row exists. Idempotent. */
export async function ensureCursorRow(): Promise<void> {
  await withClient((client) =>
    client.query(
      `INSERT INTO audit_independence_scan_cursor (id, last_program_id, cycles_completed, lease_fence)
       VALUES ('global', '', 0, 0)
       ON CONFLICT (id) DO NOTHING`,
    ),
  );
}

/**
 * Atomically claims the sweep lease and bumps the fence. Returns
 * `claimed: false` (and does nothing) when another worker holds a live lease —
 * the caller's own schedule is the retry, there is no waiting or queueing.
 */
export async function claimLease(runnerId: string): Promise<ClaimedLease> {
  await ensureCursorRow();
  return withClient(async (client) => {
    const result = await client.query<{
      last_program_id: string;
      cycles_completed: string;
      lease_fence: string;
    }>(
      `UPDATE audit_independence_scan_cursor
          SET leased_by = $1,
              leased_until = now() + ($2 || ' milliseconds')::interval,
              lease_fence = lease_fence + 1,
              last_tick_at = now()
        WHERE id = 'global'
          AND (leased_until IS NULL OR leased_until < now())
      RETURNING last_program_id, cycles_completed, lease_fence`,
      [runnerId, String(LEASE_DURATION_MS)],
    );
    const row = result.rows[0];
    if (!row) return { claimed: false, fence: 0, lastProgramId: '', cyclesCompleted: 0 };
    return {
      claimed: true,
      fence: Number(row.lease_fence),
      lastProgramId: row.last_program_id,
      cyclesCompleted: Number(row.cycles_completed),
    };
  });
}

/** Bounded, deterministically-ordered batch starting strictly after `afterId`. */
export async function fetchNextBatch(afterId: string, batchSize: number): Promise<ProgramRef[]> {
  return withClient(async (client) => {
    const result = await client.query<{ id: string; organization_id: string }>(
      `SELECT id, organization_id FROM audit_programs
        WHERE id > $1
        ORDER BY id ASC
        LIMIT $2`,
      [afterId, batchSize],
    );
    return result.rows.map((r) => ({ id: r.id, organizationId: r.organization_id }));
  });
}

/**
 * Advances the cursor past the batch just processed and releases the lease —
 * but ONLY if this worker still holds the fence it was given. Returns false
 * when the worker was superseded (its lease expired and another worker took
 * over); in that case nothing is written and the caller must not treat its
 * batch as recorded.
 *
 * A batch shorter than requested means the end of the table was reached: the
 * cursor wraps to '' and the cycle counter increments, so the next tick starts
 * a fresh pass. That wrap is what guarantees no row is starved.
 */
export async function advanceAndRelease(
  fence: number,
  batch: ProgramRef[],
  requestedBatchSize: number,
): Promise<boolean> {
  const reachedEnd = batch.length < requestedBatchSize;
  const nextCursor = reachedEnd ? '' : batch[batch.length - 1]!.id;
  return withClient(async (client) => {
    const result = await client.query(
      `UPDATE audit_independence_scan_cursor
          SET last_program_id = $1,
              cycles_completed = cycles_completed + $2,
              leased_by = NULL,
              leased_until = NULL,
              updated_at = now()
        WHERE id = 'global'
          AND lease_fence = $3`,
      [nextCursor, reachedEnd ? 1 : 0, fence],
    );
    return (result.rowCount ?? 0) > 0;
  });
}

/**
 * Releases the lease WITHOUT advancing the cursor — used when a tick fails, so
 * the same batch is retried rather than skipped. Fenced like the advance path:
 * a superseded worker cannot release someone else's lease.
 */
export async function releaseLeaseWithoutAdvancing(fence: number): Promise<boolean> {
  return withClient(async (client) => {
    const result = await client.query(
      `UPDATE audit_independence_scan_cursor
          SET leased_by = NULL, leased_until = NULL
        WHERE id = 'global'
          AND lease_fence = $1`,
      [fence],
    );
    return (result.rowCount ?? 0) > 0;
  });
}
