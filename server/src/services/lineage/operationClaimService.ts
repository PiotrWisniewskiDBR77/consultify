/**
 * MAT-010 — dedicated operation-claim mechanism (round-5 redesign).
 *
 * ── WHAT THIS FILE IS, AND IS NOT ──────────────────────────────────────────
 * This is the ONLY place that reads or writes `artifact_lineage_operation_claims`.
 * It knows nothing about lineage events, receipts, or the outbox
 * (`artifact_lineage_pending_events`/`artifact_lineage_events` — see
 * `artifactLineageService.ts` for those). That separation is the entire
 * point: a claim answers exactly one question — "has this operation_key
 * already run its business mutation, and if not, may I be the one to run
 * it?" — and nothing here ever creates, reads, or reasons about a lineage
 * event. The round-4 design answered this by writing a claim into the SAME
 * table the reconciler scans, using a discriminator column; the round-5
 * audit rejected that as insufficient semantic separation. This module and
 * its own dedicated table are the fix: a claim cannot become a lineage event
 * by a missed WHERE clause, because it is not a row in that table at all.
 *
 * ── THE STATE MACHINE ──────────────────────────────────────────────────────
 *
 *   [no row]
 *      | acquireOrReclaimOperationClaim — fresh INSERT ... ON CONFLICT DO NOTHING
 *      v
 *   ACTIVE(owner=A, fencing=1, lease=now+leaseMs)
 *      |
 *      |-- acquireOrReclaimOperationClaim, SAME key, lease still live
 *      |     -> {outcome:'active_elsewhere'}  (row untouched)
 *      |
 *      |-- acquireOrReclaimOperationClaim, SAME key, lease EXPIRED
 *      |     -> atomic reclaim UPDATE (guarded by state='active' AND
 *      |        lease_expires_at < NOW()) — Postgres row-level locking
 *      |        serializes concurrent reclaim attempts, so exactly one
 *      |        caller's UPDATE ever matches a given expired row.
 *      v
 *   ACTIVE(owner=B, fencing=2, lease=now'+leaseMs)   <- fencing MONOTONIC
 *      |
 *      |-- finalizeOperationClaim(owner=A, fencing=1, ...)   <- STALE, post-reclaim
 *      |     -> CAS WHERE owner_token=A AND fencing_token=1 AND state='active'
 *      |        matches ZERO rows (current row has owner=B, fencing=2)
 *      |     -> {outcome:'fenced'}  (row untouched, caller must not report success)
 *      |
 *      |-- finalizeOperationClaim(owner=B, fencing=2, completedResultId=X)
 *            -> CAS matches exactly the current row -> transitions it
 *      v
 *   COMPLETED(completed_result_id=X)   <- TERMINAL. `state='active'` is
 *                                          required by every reclaim/finalize
 *                                          predicate, so a completed row can
 *                                          never be reclaimed or re-finalized.
 *
 *   Any acquireOrReclaimOperationClaim call against a COMPLETED row (a
 *   client retry after success) returns {outcome:'completed',
 *   completedResultId} — the caller replays the canonical result directly
 *   from `completedResultId` (an owner-table id — e.g. a
 *   `document_version_snapshots.version_id` — NEVER a lineage event id),
 *   without ever re-running the business mutation.
 *
 * ── WHY completedResultId IS AN OWNER-TABLE ID, NOT A LINEAGE EVENT ID ─────
 * "Exactly one canonical result per operation_key" (the claim's job) and
 * "exactly one lineage event durably recorded" (the outbox's job) are
 * DIFFERENT guarantees with different failure surfaces — the second can fail
 * even when the first has already succeeded (a genuine double failure of
 * BOTH the direct lineage write AND its pending/outbox fallback, an
 * already-accepted, explicitly logged residual from every prior MAT-010
 * round). Keying `completedResultId` off the owner-table id means a retry
 * can ALWAYS recover the correct canonical business result — read directly
 * via the existing durable DAO functions (`loadSnapshotById`,
 * `loadShareLinkById`, ...) — independent of whether the lineage layer's own
 * durability succeeded. The caller in `document-studio.routes.ts` still
 * decides what HTTP status to send for the lineage-lost case (500
 * `LINEAGE_RECOVERY_REQUIRED`, unchanged from prior rounds) — this module
 * only guarantees the OPERATION itself is never silently duplicated or lost.
 *
 * ── TRANSACTION BOUNDARIES (see the MAT-010 report for the full statement) ─
 * `createDocumentSnapshot`/`rollbackDocumentToVersion`/`createShareLink` are
 * frozen, pool-autocommit, non-transactional functions (~27 pre-existing
 * unit tests call them synchronously; changing their contract is out of this
 * package's authorization). A single literal DB transaction spanning
 * "confirm fencing -> run the business mutation -> write the outbox event ->
 * mark completed" is therefore not achievable without rebuilding that layer.
 * Each STEP here is its own single, atomic statement (acquire/reclaim is one
 * transaction; finalize is one transaction), sequenced with durability
 * confirmation (`pollForDurability`, unchanged from prior rounds) between the
 * mutation and the finalize call — a credible transactional-outbox/recovery
 * sequence, proven by the round-5 test scenarios (A–J) rather than by a
 * single-transaction guarantee this codebase's frozen layer cannot offer.
 */

import { randomUUID } from 'crypto';

import { withPgTransaction } from '../../database/PostgresDatabase.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

/** Bounded lease — long enough for a normal HTTP request's business-mutation
 * + durability-poll cycle, short enough that a crashed winner's claim
 * self-heals within one human-noticeable interval rather than needing an
 * operator. Callers (tests, mainly) may override via `leaseMs`. */
const DEFAULT_CLAIM_LEASE_MS = 30_000;

export type AcquireClaimOutcome =
  | { outcome: 'acquired'; ownerToken: string; fencingToken: number }
  | { outcome: 'active_elsewhere' }
  | { outcome: 'completed'; completedResultId: string | null }
  | { outcome: 'failed' };

export type FinalizeClaimOutcome = { outcome: 'finalized' } | { outcome: 'fenced' } | { outcome: 'failed' };

interface ClaimRow {
  claim_id: string;
  organization_id: string;
  operation_key: string;
  owner_token: string;
  fencing_token: string | number;
  lease_expires_at: unknown;
  state: 'active' | 'completed';
  completed_result_id: string | null;
}

function toFencingNumber(value: string | number): number {
  return typeof value === 'number' ? value : parseInt(value, 10);
}

/**
 * TEST-ONLY fault-injection seam for the claim ACQUIRE/RECLAIM write path —
 * double-gated (throws if set outside `NODE_ENV==='test'`, re-checked at the
 * call site), same pattern as the seams in `artifactLineageService.ts`. Not
 * reachable in production.
 */
let __testForceAcquireFault = false;
export function __setOperationClaimAcquireFaultForTests(enabled: boolean): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('__setOperationClaimAcquireFaultForTests is test-only');
  }
  __testForceAcquireFault = enabled;
}

/**
 * Attempts a brand-new claim. Succeeds (`rowCount > 0`) only when no row
 * exists yet for this `(organizationId, operationKey)` — the UNIQUE index
 * `idx_artifact_lineage_claims_operation` is what makes this atomic across
 * any number of concurrent first-time callers.
 */
async function tryAcquireFreshClaim(
  organizationId: string,
  operationKey: string,
  ownerToken: string,
  leaseMs: number
): Promise<number | null> {
  return withPgTransaction(async (query) => {
    const result = await query<{ fencing_token: string | number }>(
      `INSERT INTO artifact_lineage_operation_claims (
         claim_id, organization_id, operation_key, owner_token, fencing_token,
         lease_expires_at, state, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, 1, NOW() + ($5 || ' milliseconds')::interval,
         'active', NOW(), NOW()
       )
       ON CONFLICT (organization_id, operation_key) DO NOTHING
       RETURNING fencing_token`,
      [randomUUID(), organizationId, operationKey, ownerToken, String(leaseMs)]
    );
    return result.rows[0] ? toFencingNumber(result.rows[0].fencing_token) : null;
  });
}

/**
 * Atomic reclaim of a claim whose lease has genuinely expired. The `WHERE`
 * clause — `state = 'active' AND lease_expires_at < NOW()`, evaluated by
 * POSTGRES's own clock, never the application process's — is the entire
 * single-winner mechanism: Postgres serializes concurrent `UPDATE`s to the
 * same row, so if two callers race this at once, whichever commits first
 * re-stamps `lease_expires_at` into the future; the second then evaluates
 * its `WHERE` against the ALREADY-UPDATED row and matches zero rows.
 * `fencing_token = fencing_token + 1` is what makes the OLD (owner_token,
 * fencing_token) pair presented by a stale finalize call permanently unable
 * to match this row again.
 */
async function tryReclaimExpiredClaim(
  organizationId: string,
  operationKey: string,
  ownerToken: string,
  leaseMs: number
): Promise<number | null> {
  return withPgTransaction(async (query) => {
    const result = await query<{ fencing_token: string | number }>(
      `UPDATE artifact_lineage_operation_claims
          SET owner_token = $1,
              fencing_token = fencing_token + 1,
              lease_expires_at = NOW() + ($2 || ' milliseconds')::interval,
              updated_at = NOW()
        WHERE organization_id = $3 AND operation_key = $4
          AND state = 'active' AND lease_expires_at < NOW()
        RETURNING fencing_token`,
      [ownerToken, String(leaseMs), organizationId, operationKey]
    );
    return result.rows[0] ? toFencingNumber(result.rows[0].fencing_token) : null;
  });
}

/**
 * Reads the CURRENT row for a key, tenant-scoped. Used only after both the
 * fresh-acquire and reclaim attempts have lost, to distinguish "someone else
 * is still actively working on this" from "this operation already
 * completed" — never used to make a claiming/finalizing DECISION by itself
 * (those are always atomic INSERT/UPDATE statements above), only to report
 * an honest outcome to the caller.
 */
async function readClaimRow(organizationId: string, operationKey: string): Promise<ClaimRow | null> {
  const row = await queryHelpers.queryOne<ClaimRow>(
    `SELECT claim_id, organization_id, operation_key, owner_token, fencing_token,
            lease_expires_at, state, completed_result_id
       FROM artifact_lineage_operation_claims
      WHERE organization_id = ? AND operation_key = ?`,
    [organizationId, operationKey]
  );
  return row ?? null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Acquire a fresh claim, reclaim an expired one, or report that this
 * operation is already completed / still actively owned elsewhere.
 *
 * Invariant 1 (this function NEVER creates a lineage event): every code path
 * below touches only `artifact_lineage_operation_claims`. Grep-verifiable —
 * this file imports nothing from `artifactLineageService.ts` and never
 * references `artifact_lineage_events`/`artifact_lineage_pending_events`.
 *
 * ── THE BOUNDED WAIT (genuine concurrent acquisition, scenario F) ──────────
 * When neither a fresh acquire nor a reclaim wins — a DIFFERENT caller
 * currently holds a live (non-expired) lease — this does NOT immediately
 * report `active_elsewhere`. A genuinely concurrent request (two callers
 * racing the same `operationKey` within the same HTTP round-trip) should see
 * the WINNER's canonical result once it finishes, not an artificial
 * "in progress" for what is, from the outside, one logical operation
 * completing in well under a second. So this polls the SAME claims table
 * (bounded backoff, `waitMs`, default 8s) for the row to reach `completed`,
 * re-attempting the reclaim on every iteration too (in case the active
 * lease expires while this caller waits — covers the boundary between
 * "genuinely concurrent" and "the winner crashed"). Only after the deadline
 * does this report `active_elsewhere`, meaning "still no canonical result
 * and no reclaimable lease — this is a real in-progress operation, not a
 * fast race this caller can afford to wait out."
 */
export async function acquireOrReclaimOperationClaim(params: {
  organizationId: string;
  operationKey: string;
  leaseMs?: number;
  waitMs?: number;
}): Promise<AcquireClaimOutcome> {
  const leaseMs = params.leaseMs ?? DEFAULT_CLAIM_LEASE_MS;
  const waitMs = params.waitMs ?? 8000;
  const ownerToken = randomUUID();

  try {
    if (__testForceAcquireFault && process.env.NODE_ENV === 'test') {
      throw new Error('injected operation-claim acquire fault');
    }

    const freshFencing = await tryAcquireFreshClaim(
      params.organizationId,
      params.operationKey,
      ownerToken,
      leaseMs
    );
    if (freshFencing !== null) {
      return { outcome: 'acquired', ownerToken, fencingToken: freshFencing };
    }

    const reclaimedFencing = await tryReclaimExpiredClaim(
      params.organizationId,
      params.operationKey,
      ownerToken,
      leaseMs
    );
    if (reclaimedFencing !== null) {
      return { outcome: 'acquired', ownerToken, fencingToken: reclaimedFencing };
    }

    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      const current = await readClaimRow(params.organizationId, params.operationKey);
      if (current?.state === 'completed') {
        return { outcome: 'completed', completedResultId: current.completed_result_id };
      }
      await delay(100);
      const reclaimedDuringWait = await tryReclaimExpiredClaim(
        params.organizationId,
        params.operationKey,
        ownerToken,
        leaseMs
      );
      if (reclaimedDuringWait !== null) {
        return { outcome: 'acquired', ownerToken, fencingToken: reclaimedDuringWait };
      }
    }

    const finalCheck = await readClaimRow(params.organizationId, params.operationKey);
    if (finalCheck?.state === 'completed') {
      return { outcome: 'completed', completedResultId: finalCheck.completed_result_id };
    }
    return { outcome: 'active_elsewhere' };
  } catch (err) {
    logger.error('[OperationClaim] failed to acquire or reclaim operation claim', {
      organizationId: params.organizationId,
      operationKey: params.operationKey,
      message: err instanceof Error ? err.message : String(err),
    });
    return { outcome: 'failed' };
  }
}

/**
 * Finalizes a claim this caller currently owns, transitioning it to the
 * TERMINAL `completed` state with the canonical business result's own id.
 *
 * The CAS `UPDATE ... WHERE owner_token = $ownerToken AND fencing_token =
 * $fencingToken AND state = 'active'` is invariants 8–10 made structural:
 * if a DIFFERENT caller already reclaimed this row (this caller's lease
 * expired and a newer owner took over — `owner_token` AND `fencing_token`
 * both changed), the predicate matches zero rows and this function returns
 * `{outcome:'fenced'}` WITHOUT modifying anything. The caller (route layer)
 * must treat `fenced` as fail-closed: no success response, no lineage event
 * written on this caller's behalf.
 *
 * Tenant + operation-key scoped in the same statement (`organization_id`,
 * `operation_key` are part of the same `WHERE`), so a caller can never
 * finalize — or, by extension, discover via rowCount — another
 * organization's claim.
 */
export async function finalizeOperationClaim(params: {
  organizationId: string;
  operationKey: string;
  ownerToken: string;
  fencingToken: number;
  completedResultId: string;
}): Promise<FinalizeClaimOutcome> {
  try {
    const won = await withPgTransaction(async (query) => {
      const result = await query(
        `UPDATE artifact_lineage_operation_claims
            SET state = 'completed',
                completed_result_id = $1,
                updated_at = NOW()
          WHERE organization_id = $2 AND operation_key = $3
            AND owner_token = $4 AND fencing_token = $5 AND state = 'active'`,
        [
          params.completedResultId,
          params.organizationId,
          params.operationKey,
          params.ownerToken,
          params.fencingToken,
        ]
      );
      return (result.rowCount ?? 0) > 0;
    });
    return won ? { outcome: 'finalized' } : { outcome: 'fenced' };
  } catch (err) {
    logger.error('[OperationClaim] failed to finalize operation claim (DB error, not a fencing loss)', {
      organizationId: params.organizationId,
      operationKey: params.operationKey,
      message: err instanceof Error ? err.message : String(err),
    });
    return { outcome: 'failed' };
  }
}

/**
 * TEST-ONLY seam for the heartbeat negative control — double-gated (throws
 * if set outside `NODE_ENV==='test'`), same pattern as every other
 * fault-injection seam in this codebase. Not reachable in production.
 */
let __testForceRenewalNoOp = false;
export function __setOperationClaimRenewalNoOpForTests(enabled: boolean): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('__setOperationClaimRenewalNoOpForTests is test-only');
  }
  __testForceRenewalNoOp = enabled;
}

export type RenewClaimOutcome = { outcome: 'renewed' } | { outcome: 'fenced' } | { outcome: 'failed' };

/**
 * G22 fix — the heartbeat/renewal half of lease-based fencing. A claim's
 * lease is bounded (30s default), which is exactly right for the common
 * case (a mutation normally completes in well under a second) but was a
 * genuine gap for a SLOW mutation: without renewal, a worker still actively
 * (correctly) working past its original lease window would lose it to a
 * reclaim by another caller, racing two business mutations against each
 * other even though fencing correctly prevented the loser from finalizing.
 *
 * `renewOperationClaimLease` extends `lease_expires_at` for the CURRENT
 * owner only — the CAS predicate is IDENTICAL in shape to
 * `finalizeOperationClaim`'s (`organization_id` + `operation_key` +
 * `owner_token` + `fencing_token` + `state='active'`), so a caller whose
 * claim was already reclaimed (its `owner_token`/`fencing_token` no longer
 * match the row) gets `{outcome:'fenced'}` and must stop working — it has
 * lost ownership just as surely as if it had tried to finalize.
 *
 * Deliberately does NOT bump `fencing_token` — only a genuine reclaim does
 * that (see `tryReclaimExpiredClaim`). A renewal is the SAME owner
 * continuing to hold the SAME claim, just with a later expiry; treating it
 * as anything else would make a renewing owner indistinguishable from a
 * reclaiming one to itself on its NEXT renewal call.
 */
export async function renewOperationClaimLease(params: {
  organizationId: string;
  operationKey: string;
  ownerToken: string;
  fencingToken: number;
  leaseMs?: number;
}): Promise<RenewClaimOutcome> {
  const leaseMs = params.leaseMs ?? DEFAULT_CLAIM_LEASE_MS;
  try {
    // TEST-ONLY seam for the negative control: simulates "the production
    // renewal mechanism is disabled" without touching the DB at all, so the
    // lease genuinely expires on schedule despite the heartbeat "running".
    if (__testForceRenewalNoOp && process.env.NODE_ENV === 'test') {
      return { outcome: 'renewed' };
    }
    const renewed = await withPgTransaction(async (query) => {
      const result = await query(
        `UPDATE artifact_lineage_operation_claims
            SET lease_expires_at = NOW() + ($1 || ' milliseconds')::interval,
                updated_at = NOW()
          WHERE organization_id = $2 AND operation_key = $3
            AND owner_token = $4 AND fencing_token = $5 AND state = 'active'`,
        [String(leaseMs), params.organizationId, params.operationKey, params.ownerToken, params.fencingToken]
      );
      return (result.rowCount ?? 0) > 0;
    });
    return renewed ? { outcome: 'renewed' } : { outcome: 'fenced' };
  } catch (err) {
    logger.error('[OperationClaim] failed to renew operation claim lease (DB error, not a fencing loss)', {
      organizationId: params.organizationId,
      operationKey: params.operationKey,
      message: err instanceof Error ? err.message : String(err),
    });
    return { outcome: 'failed' };
  }
}

export interface ClaimHeartbeat {
  /** Stops the periodic renewal. Idempotent — safe to call from a `finally`
   * block even if the heartbeat already stopped itself after losing
   * ownership. */
  stop(): void;
  /** True once a renewal call has come back `fenced` — this claim's
   * ownership is gone. The caller MUST check this before finalizing or
   * writing a lineage event: a `true` here means a newer owner already
   * reclaimed the operation, and this worker must not declare success. */
  isFenced(): boolean;
}

/**
 * Starts periodic lease renewal for an ACTIVE claim this caller holds.
 * Intended to wrap a potentially-slow business mutation in the route layer:
 * start right after `acquireOrReclaimOperationClaim` returns `'acquired'`,
 * `stop()` in a `finally` once the mutation (and any post-mutation work)
 * is done.
 *
 * The renewal interval is a fraction of the lease (`leaseMs / 3` by
 * default) so at least two renewal attempts land inside any single lease
 * window before it could expire — one missed tick (a transient DB hiccup)
 * does not by itself lose the claim. A renewal that returns `'fenced'`
 * stops the heartbeat immediately (no point renewing a lease that is no
 * longer this caller's) and latches `isFenced()` to `true` permanently. A
 * renewal that errors (`'failed'`, a transient DB problem, NOT a fencing
 * loss) is logged and retried on the next tick — it does NOT set
 * `isFenced()`, since an error is not evidence of losing ownership.
 *
 * Timer is `unref()`'d where supported so it can never keep a Node process
 * alive by itself.
 */
export function startClaimHeartbeat(params: {
  organizationId: string;
  operationKey: string;
  ownerToken: string;
  fencingToken: number;
  leaseMs?: number;
  intervalMs?: number;
}): ClaimHeartbeat {
  const leaseMs = params.leaseMs ?? DEFAULT_CLAIM_LEASE_MS;
  const intervalMs = params.intervalMs ?? Math.max(50, Math.floor(leaseMs / 3));
  let fenced = false;
  let stopped = false;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    const result = await renewOperationClaimLease({
      organizationId: params.organizationId,
      operationKey: params.operationKey,
      ownerToken: params.ownerToken,
      fencingToken: params.fencingToken,
      leaseMs,
    });
    if (result.outcome === 'fenced') {
      fenced = true;
      stopped = true;
      clearInterval(timer);
    }
    // 'failed' is a transient DB error, not a fencing loss — keep the
    // heartbeat running and try again on the next tick.
  };

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  if (typeof (timer as unknown as { unref?: () => void }).unref === 'function') {
    (timer as unknown as { unref: () => void }).unref();
  }

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
    isFenced() {
      return fenced;
    },
  };
}

/** Tenant-scoped read for tests/ops — never used to gate a claim/finalize
 * decision (those are always atomic statements above). */
export async function getOperationClaimForTests(params: {
  organizationId: string;
  operationKey: string;
}): Promise<{
  state: 'active' | 'completed';
  ownerToken: string;
  fencingToken: number;
  completedResultId: string | null;
} | null> {
  const row = await readClaimRow(params.organizationId, params.operationKey);
  if (!row) return null;
  return {
    state: row.state,
    ownerToken: row.owner_token,
    fencingToken: toFencingNumber(row.fencing_token),
    completedResultId: row.completed_result_id,
  };
}
