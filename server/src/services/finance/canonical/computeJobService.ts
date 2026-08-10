/**
 * Finance v3 canonical — compute job queue service.
 *
 * Gate C, WP-C02 "compatibility services". Wraps `compute_jobs` /
 * `compute_job_runs` / `compute_job_outputs`
 * (migration `20260809_finance_v3_b04_compute_jobs.sql`), per
 * `docs/validation/finance-v3/generated/gate-b/WP-B04_jobs_runs_outputs_ADR.md`
 * section 5 (claim-query pattern: `FOR UPDATE SKIP LOCKED`).
 *
 * W2 queue contract closeout (`docs/validation/finance-v3/generated/gate-d/
 * W2_QUEUE_CONTRACT_report.md`) closed the six EVIDENCE_MISSING gaps the W9
 * fault matrix measured, plus the W9-B-1 cancel-bookkeeping defect:
 *   - EM-2 heartbeat()               — extends the lease, advances
 *     compute_job_runs.last_heartbeat_at. Must run BEFORE EM-1 existed in
 *     production, or the reaper would steal leases from live workers.
 *   - EM-1 reapExpiredLeases()       — ADR §5.3 recovery procedure, now has
 *     a caller (wired into `server/src/cron/Scheduler.ts`, see there for why
 *     a cron tick was chosen over a standalone daemon).
 *   - W9-B-1 cancelJob() fix         — now closes finished_at/lease/run row.
 *   - EM-3 is_org_compute_killed()   — SQL function + `compute_kill_switches`
 *     table (migration `20260810_finance_v3_w2_b04_queue_ops.sql`), consulted
 *     by claim().
 *   - EM-4 org_concurrency_limit()   — SQL function + table, consulted by
 *     claim(). Seeded with a deliberately generous global default (50) — see
 *     the migration file and the W2 report for why a low default was
 *     rejected (it would have silently changed `canonicalServices.pg.test.ts`
 *     SKIP LOCKED behaviour for every existing caller).
 *   - EM-6 dead-letter → exception ledger — failJob() and
 *     reapExpiredLeases() both call raiseDeadLetterException() when a job
 *     goes terminal `failed`.
 *   - EM-5 worker loop — PARTIALLY addressed. reapExpiredLeases() IS a real
 *     background loop over the queue (wired, tested), but it only recovers
 *     abandoned jobs; it does not execute domain compute. A worker pool that
 *     drains `queued` jobs THIS PROCESS DID NOT ENQUEUE and actually runs
 *     baseline/prediction/valuation compute for them is NOT built — the
 *     `compute_jobs` row has no payload column to reconstruct the
 *     domain-specific call parameters (businessVersionId, entityId,
 *     forecastPeriodIds, ...) those services need, and inventing one is a
 *     schema/contract decision beyond this work package's scope (see the W2
 *     report §EM-5 for the full reasoning and the collision note on
 *     baselineComputeService.ts/kpiComputeService.ts/predictionComputeService.ts/
 *     valuationComputeService.ts, owned by a parallel agent this session per
 *     the brief).
 */

import { v4 as uuidv4 } from 'uuid';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import * as exceptionLedgerService from './exceptionLedgerService.js';

export type ComputeJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type ComputeJobOutcome = 'succeeded' | 'failed' | 'cancelled' | 'lease_expired' | 'killed';
export type ComputeJobFreshness = 'CURRENT' | 'STALE_SOURCE' | 'STALE_ASSUMPTIONS' | 'COMPUTE_FAILED';

export interface ComputeJobRow {
  id: string;
  organization_id: string;
  job_type: string;
  status: ComputeJobStatus;
  input_artifact_id: string;
  input_revision_hash: string;
  engine_manifest_id: string;
  idempotency_key: string;
  lease_owner: string | null;
  lease_expires_at: string | null;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  cancel_requested_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  requested_by_user_id: string;
  request_id: string | null;
}

export interface EnqueueJobParams {
  organizationId: string;
  jobType: string;
  inputArtifactId: string;
  inputRevisionHash: string;
  engineManifestId: string;
  idempotencyKey: string;
  requestedByUserId: string;
  requestId?: string | null;
  maxAttempts?: number;
}

export interface EnqueueJobResult {
  job: ComputeJobRow;
  /** true iff an existing job with the same (organizationId, jobType, idempotencyKey) was returned instead of a new insert. */
  wasExisting: boolean;
}

/**
 * Enqueue a compute job. Idempotent on (organization_id, job_type,
 * idempotency_key) — `compute_jobs_idempotency_uq` (B04 migration) makes a
 * duplicate enqueue with the same key a safe no-op read-back rather than a
 * second row.
 */
export async function enqueue(params: EnqueueJobParams): Promise<EnqueueJobResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    const inserted = await tx.queryOne<ComputeJobRow>(
      `INSERT INTO compute_jobs (
         id, organization_id, job_type, input_artifact_id, input_revision_hash,
         engine_manifest_id, idempotency_key, requested_by_user_id, request_id, max_attempts
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (organization_id, job_type, idempotency_key) DO NOTHING
       RETURNING *`,
      [
        uuidv4(),
        params.organizationId,
        params.jobType,
        params.inputArtifactId,
        params.inputRevisionHash,
        params.engineManifestId,
        params.idempotencyKey,
        params.requestedByUserId,
        params.requestId ?? null,
        params.maxAttempts ?? 5,
      ]
    );
    if (inserted) return { job: inserted, wasExisting: false };

    const existing = await tx.queryOne<ComputeJobRow>(
      `SELECT * FROM compute_jobs WHERE organization_id = ? AND job_type = ? AND idempotency_key = ?`,
      [params.organizationId, params.jobType, params.idempotencyKey]
    );
    if (!existing) throw new Error('compute_jobs enqueue: ON CONFLICT DO NOTHING but no existing row found on read-back');
    return { job: existing, wasExisting: true };
  });
}

export interface ClaimParams {
  workerId: string;
  jobTypes?: readonly string[];
  limit?: number;
  leaseDurationSeconds?: number;
}

/**
 * WP-B04 §5.1 claim-query pattern: `FOR UPDATE SKIP LOCKED` over queued jobs
 * whose `next_attempt_at` has arrived, so two concurrent workers never both
 * claim the same job — the second worker's `SKIP LOCKED` simply excludes
 * the row the first worker's subquery already locked, rather than blocking
 * on it. Also inserts the corresponding `compute_job_runs` row (attempt
 * bookkeeping) in the SAME transaction.
 *
 * EM-3/EM-4 (W2 queue contract closeout): the subquery now also consults
 * `is_org_compute_killed()` and `org_concurrency_limit()` (both SQL
 * functions, migration `20260810_finance_v3_w2_b04_queue_ops.sql`), exactly
 * as the ADR §5.1 sketch specifies.
 *
 * Claiming is done ONE ROW AT A TIME in a loop (up to `limit` iterations),
 * not as a single batch `UPDATE ... LIMIT n`, deliberately: the per-org
 * running-count check inside `org_concurrency_limit()` must see jobs this
 * SAME call already claimed in an earlier iteration, or a batch claim with
 * `limit > cap` could over-claim past the cap in one shot. A transaction
 * always sees its own prior writes (regardless of isolation level), so each
 * loop iteration's concurrency count is accurate. This trades a little
 * throughput on large batch claims for correctness — documented in the W2
 * report, not a silent behaviour change.
 */
export async function claim(params: ClaimParams): Promise<ComputeJobRow[]> {
  const limit = params.limit ?? 1;
  const leaseSeconds = params.leaseDurationSeconds ?? 300;

  return withPinnedPostgresTransaction(async (tx) => {
    const typeFilter = params.jobTypes && params.jobTypes.length > 0 ? `AND job_type = ANY(?)` : '';
    const claimed: ComputeJobRow[] = [];

    for (let i = 0; i < limit; i++) {
      const rows = await tx.queryAll<ComputeJobRow>(
        `UPDATE compute_jobs
            SET status = 'running',
                lease_owner = ?,
                lease_expires_at = now() + (? || ' seconds')::interval,
                started_at = COALESCE(started_at, now()),
                attempt_count = attempt_count + 1
          WHERE id = (
            SELECT c.id FROM compute_jobs c
             WHERE c.status = 'queued' AND c.next_attempt_at <= now() ${typeFilter}
               AND NOT is_org_compute_killed(c.organization_id, c.job_type)
               AND (
                 SELECT count(*) FROM compute_jobs r
                  WHERE r.organization_id = c.organization_id
                    AND r.job_type = c.job_type
                    AND r.status = 'running'
               ) < org_concurrency_limit(c.organization_id, c.job_type)
             ORDER BY c.next_attempt_at ASC
             FOR UPDATE SKIP LOCKED
             LIMIT 1
          )
          RETURNING *`,
        typeFilter ? [params.workerId, String(leaseSeconds), params.jobTypes] : [params.workerId, String(leaseSeconds)]
      );
      const job = rows[0];
      if (!job) break; // no more eligible rows (queue empty, all killed, or all at their concurrency cap)

      await tx.queryRun(
        `INSERT INTO compute_job_runs (id, job_id, attempt_number, worker_id) VALUES (?, ?, ?, ?)`,
        [uuidv4(), job.id, job.attempt_count, params.workerId]
      );
      claimed.push(job);
    }

    return claimed;
  });
}

export interface HeartbeatParams {
  jobId: string;
  /** Must match `lease_owner` — a stale/replaced worker cannot renew someone else's lease. */
  workerId: string;
  leaseDurationSeconds?: number;
}

export type HeartbeatResult =
  | { ok: true; leaseExpiresAt: string }
  | { ok: false; code: 'LEASE_LOST'; message: string };

/**
 * EM-2 (W2 queue contract closeout). ADR §5.2: a worker computing a job
 * periodically extends `lease_expires_at` and advances
 * `compute_job_runs.last_heartbeat_at` for its current attempt. Must exist
 * and be wired into the four compute-service call sites BEFORE the reaper
 * (EM-1) is relied on in production — otherwise a slow-but-alive worker's
 * lease would expire and the reaper would hand the job to a second worker
 * while the first is still running (see the negative-control proof in the
 * W2 report: fresh heartbeat -> reaper does not touch the job; stale
 * heartbeat -> reaper reclaims it).
 *
 * Per ADR §5.2: if this returns `{ ok: false, code: 'LEASE_LOST' }` the
 * caller MUST stop computing immediately — the lease was already reaped,
 * cancelled, or the job otherwise left `running` under this worker.
 */
export async function heartbeat(params: HeartbeatParams): Promise<HeartbeatResult> {
  const leaseSeconds = params.leaseDurationSeconds ?? 300;
  return withPinnedPostgresTransaction(async (tx) => {
    const updated = await tx.queryOne<{ id: string; attempt_count: number; lease_expires_at: string }>(
      `UPDATE compute_jobs
          SET lease_expires_at = now() + (? || ' seconds')::interval
        WHERE id = ? AND lease_owner = ? AND status = 'running'
        RETURNING id, attempt_count, lease_expires_at`,
      [String(leaseSeconds), params.jobId, params.workerId]
    );
    if (!updated) {
      return {
        ok: false,
        code: 'LEASE_LOST',
        message: `Job ${params.jobId} lease is no longer held by worker ${params.workerId} (reaped, cancelled, completed, or never claimed by this worker)`,
      };
    }
    await tx.queryRun(`UPDATE compute_job_runs SET last_heartbeat_at = now() WHERE job_id = ? AND attempt_number = ?`, [
      params.jobId,
      updated.attempt_count,
    ]);
    return { ok: true, leaseExpiresAt: updated.lease_expires_at };
  });
}

export interface ClaimByIdParams {
  organizationId: string;
  jobId: string;
  workerId: string;
  leaseDurationSeconds?: number;
}

/**
 * NEW-3 fix (W2 self-claim tenant mutation,
 * docs/validation/finance-v3/generated/gate-d/W2_SELF_CLAIM_TENANT_FIX_report.md).
 * Claim ONE specific, already-known job id, scoped to `organizationId` — the
 * "self-claim" counterpart to `claim()` above.
 *
 * Every self-claim call site (baselineComputeService.ts,
 * kpiComputeService.ts, predictionComputeService.ts x2,
 * valuationComputeService.ts) calls `enqueue()` and then immediately wants to
 * claim the EXACT row it just got back — it already has that row's `id`. The
 * old code instead called `claim()`, which — correctly, per its own doc
 * comment and the WP-B04 ADR — claims "the oldest queued job of this
 * `job_type` across the WHOLE table, any organization", because that is the
 * semantics a real future worker POOL needs. Self-claim has no business
 * asking for that: it wants its own row, nothing else. Reusing `claim()`'s
 * cross-org query from a single-job self-claim call site meant one
 * organization's self-claim could silently claim-and-mutate (lease_owner,
 * status='running', attempt_count++, a `compute_job_runs` row) another
 * organization's queued job under ordinary concurrent use — no exploit
 * needed. `claim()` itself is NOT changed by this fix (must stay
 * cross-organizational for the worker-pool future) — only the caller was
 * wrong.
 *
 * Same `FOR UPDATE SKIP LOCKED` + lease + `attempt_count++` +
 * `compute_job_runs` bookkeeping as `claim()`, scoped to a single
 * `(id, organization_id)` row instead of an `ORDER BY ... LIMIT n` scan.
 *
 * Returns `null` (never throws) when the row cannot be claimed: wrong
 * `organizationId`, wrong `jobId`, or the row is no longer `status='queued'`
 * (already running/succeeded/failed/cancelled — e.g. a concurrent duplicate
 * request, or a lease taken a moment earlier by another caller that also had
 * this exact job id). Callers MUST treat `null` as a hard failure and refuse
 * to proceed — they must NOT fall back to using the un-claimed, still-queued
 * row as if it were running (that fallback pattern is exactly what the old
 * self-claim code did, and it was unsafe on its own even before the
 * cross-tenant angle: a still-`queued` row's `id` handed to
 * `completeJobSuccess()` fails its `status !== 'running'` guard and returns
 * `{ok:false, code:'NOT_RUNNING'}`, which none of the five old call sites
 * checked — so `compute_job_outputs` and the `succeeded` transition were
 * silently skipped while the caller still reported success upstream).
 */
export async function claimById(params: ClaimByIdParams): Promise<ComputeJobRow | null> {
  const leaseSeconds = params.leaseDurationSeconds ?? 300;

  return withPinnedPostgresTransaction(async (tx) => {
    const claimed = await tx.queryOne<ComputeJobRow>(
      `UPDATE compute_jobs
          SET status = 'running',
              lease_owner = ?,
              lease_expires_at = now() + (? || ' seconds')::interval,
              started_at = COALESCE(started_at, now()),
              attempt_count = attempt_count + 1
        WHERE id IN (
          SELECT id FROM compute_jobs
           WHERE id = ? AND organization_id = ? AND status = 'queued' AND next_attempt_at <= now()
           FOR UPDATE SKIP LOCKED
           LIMIT 1
        )
        RETURNING *`,
      [params.workerId, String(leaseSeconds), params.jobId, params.organizationId]
    );

    if (claimed) {
      await tx.queryRun(
        `INSERT INTO compute_job_runs (id, job_id, attempt_number, worker_id) VALUES (?, ?, ?, ?)`,
        [uuidv4(), claimed.id, claimed.attempt_count, params.workerId]
      );
    }

    return claimed;
  });
}

export interface CompleteJobSuccessParams {
  jobId: string;
  organizationId: string;
  outputArtifactId: string;
  outputWorkingRevisionId: string;
  contentSemanticHash: string;
  outputBusinessVersionId?: string | null;
  freshness?: ComputeJobFreshness;
}

export type CompleteJobResult =
  | { ok: true; job: ComputeJobRow }
  | { ok: false; code: 'NOT_RUNNING' | 'OUTPUT_ALREADY_COMMITTED'; message: string };

/** Commit a successful job's output (append-only `compute_job_outputs`) and mark the job succeeded. */
export async function completeJobSuccess(params: CompleteJobSuccessParams): Promise<CompleteJobResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    const job = await tx.queryOne<ComputeJobRow>(`SELECT * FROM compute_jobs WHERE id = ? FOR UPDATE`, [params.jobId]);
    if (!job || job.status !== 'running') {
      return { ok: false, code: 'NOT_RUNNING', message: `Job ${params.jobId} is not running` };
    }

    try {
      await tx.queryRun(
        `INSERT INTO compute_job_outputs (
           id, job_id, organization_id, output_artifact_id, output_business_version_id,
           output_working_revision_id, committed_by_attempt_number, content_semantic_hash, freshness
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          params.jobId,
          params.organizationId,
          params.outputArtifactId,
          params.outputBusinessVersionId ?? null,
          params.outputWorkingRevisionId,
          job.attempt_count,
          params.contentSemanticHash,
          params.freshness ?? 'CURRENT',
        ]
      );
    } catch (error: any) {
      const message = String(error?.message || error);
      if (error?.code === '23505' || /compute_job_outputs_job_uq/.test(message)) {
        return { ok: false, code: 'OUTPUT_ALREADY_COMMITTED', message: `Job ${params.jobId} already has a committed output` };
      }
      throw error;
    }

    const updated = await tx.queryOne<ComputeJobRow>(
      `UPDATE compute_jobs SET status = 'succeeded', finished_at = now() WHERE id = ? RETURNING *`,
      [params.jobId]
    );
    await tx.queryRun(
      `UPDATE compute_job_runs SET outcome = 'succeeded', finished_at = now()
        WHERE job_id = ? AND attempt_number = ?`,
      [params.jobId, job.attempt_count]
    );
    if (!updated) throw new Error('compute_jobs succeeded-update returned no row');
    return { ok: true, job: updated };
  });
}

/**
 * EM-6 (W2 queue contract closeout). ADR §10: "each job that reaches the DLQ
 * should generate an entry in [the exception] ledger" — WP-B05
 * `finance_exceptions` is named as the canonical consumer, referenced not
 * designed by the B04 ADR. Severity mapping is a deliberately simple
 * decision, not the full "how close to approval is this business version"
 * nuance the ADR's prose example hints at (that needs a business-version
 * fetch this generic queue service does not have and should not acquire):
 * VALUATION_* job types dead-lettering are MATERIAL, everything else is
 * WARNING. Documented as a simplification in the W2 report, not silently
 * chosen.
 *
 * Deliberately best-effort: a broken exception ledger must never mask that
 * the job itself DID reach the correct terminal state. The job's own state
 * transition (already committed by the caller before this runs) is the
 * primary contract; the ledger entry is additive observability.
 */
async function raiseDeadLetterException(job: ComputeJobRow): Promise<void> {
  try {
    const severity = job.job_type.toUpperCase().includes('VALUATION') ? 'MATERIAL' : 'WARNING';
    const raised = await exceptionLedgerService.raise({
      organizationId: job.organization_id,
      artifactId: job.input_artifact_id,
      severity,
      sourceRef: { jobId: job.id, jobType: job.job_type, attemptCount: job.attempt_count, maxAttempts: job.max_attempts },
      reasonCode: 'COMPUTE_JOB_DEAD_LETTER',
      dedupKey: `compute-job-dlq:${job.id}`,
      raisedBy: 'system:compute-queue-dlq',
      evidence: job.error ? { lastError: job.error } : null,
    });
    if (!raised.ok) {
      console.error(`[computeJobService] dead-letter exception for job ${job.id} rejected:`, raised.code, raised.message);
    }
  } catch (ledgerError: any) {
    console.error(`[computeJobService] failed to raise dead-letter exception for job ${job.id}:`, ledgerError?.message || ledgerError);
  }
}

export interface FailJobParams {
  jobId: string;
  /**
   * Required (P0 W9-C-5 fix). `failJob()` scopes its `SELECT ... FOR UPDATE`
   * to this organization — a job belonging to another tenant is treated as
   * not found (returns `null`), same convention as `getJob`/`cancelJob`
   * below, never a raw Postgres error.
   */
  organizationId: string;
  error: string;
}

/**
 * Fail an attempt; requeues with a linear backoff if attempts remain, else
 * terminal `failed` (= DLQ, ADR §10) — which now also raises an EM-6
 * dead-letter exception (see `raiseDeadLetterException` above).
 */
export async function failJob(params: FailJobParams): Promise<ComputeJobRow | null> {
  const updated = await withPinnedPostgresTransaction(async (tx) => {
    const job = await tx.queryOne<ComputeJobRow>(`SELECT * FROM compute_jobs WHERE id = ? AND organization_id = ? FOR UPDATE`, [
      params.jobId,
      params.organizationId,
    ]);
    if (!job || job.status !== 'running') return null;

    const willRetry = job.attempt_count < job.max_attempts;
    const row = await tx.queryOne<ComputeJobRow>(
      willRetry
        ? `UPDATE compute_jobs
              SET status = 'queued', error = ?, next_attempt_at = now() + (? || ' seconds')::interval,
                  lease_owner = NULL, lease_expires_at = NULL
            WHERE id = ? RETURNING *`
        : `UPDATE compute_jobs SET status = 'failed', error = ?, finished_at = now(), lease_owner = NULL, lease_expires_at = NULL
            WHERE id = ? RETURNING *`,
      willRetry
        ? [params.error, String(30 * job.attempt_count), params.jobId]
        : [params.error, params.jobId]
    );
    await tx.queryRun(
      `UPDATE compute_job_runs SET outcome = 'failed', error = ?, finished_at = now()
        WHERE job_id = ? AND attempt_number = ?`,
      [params.error, params.jobId, job.attempt_count]
    );
    return row;
  });

  if (updated && updated.status === 'failed' && updated.attempt_count >= updated.max_attempts) {
    await raiseDeadLetterException(updated);
  }
  return updated;
}

/**
 * Required `organizationId` (P0 W9-C-5 fix): a cross-tenant `jobId` now
 * refuses the same way an unknown `jobId` always did — `null`, not a raw
 * Postgres error and not another tenant's row. `claim()` is deliberately
 * left cross-organizational (WP-B04 ADR, `canonicalServices.pg.test.ts`) —
 * only the single-job read/mutate entry points below are org-scoped.
 *
 * W9-B-1 fix (W2 queue contract closeout): cancelling a `running` job used
 * to leave `finished_at` NULL, the lease held by a worker that will never
 * report back, and the in-flight `compute_job_runs` attempt open forever —
 * even though the schema has an `outcome = 'cancelled'` value for exactly
 * this. Every "how long did jobs take" query silently under-counted.
 * Cancelling now: (a) sets `finished_at`, (b) releases `lease_owner`/
 * `lease_expires_at` so the slot is visibly free, and (c) closes the open
 * `compute_job_runs` row as `outcome = 'cancelled'` — but ONLY if the job
 * was actually `running` (a `queued` job never had a run row: `claim()` is
 * the only thing that inserts one).
 */
export async function cancelJob(organizationId: string, jobId: string, reason: string): Promise<ComputeJobRow | null> {
  return withPinnedPostgresTransaction(async (tx) => {
    const before = await tx.queryOne<ComputeJobRow>(
      `SELECT * FROM compute_jobs WHERE id = ? AND organization_id = ? AND status IN ('queued', 'running') FOR UPDATE`,
      [jobId, organizationId]
    );
    if (!before) return null;

    const updated = await tx.queryOne<ComputeJobRow>(
      `UPDATE compute_jobs
          SET status = 'cancelled', cancel_requested_at = now(), cancel_reason = ?,
              finished_at = now(), lease_owner = NULL, lease_expires_at = NULL
        WHERE id = ? RETURNING *`,
      [reason, jobId]
    );

    if (before.status === 'running') {
      await tx.queryRun(
        `UPDATE compute_job_runs SET outcome = 'cancelled', finished_at = now()
          WHERE job_id = ? AND attempt_number = ? AND outcome IS NULL`,
        [jobId, before.attempt_count]
      );
    }

    return updated;
  });
}

export async function getJob(organizationId: string, jobId: string): Promise<ComputeJobRow | null> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryOne<ComputeJobRow>(`SELECT * FROM compute_jobs WHERE id = ? AND organization_id = ?`, [jobId, organizationId])
  );
}

export interface ReapedJob {
  jobId: string;
  organizationId: string;
  jobType: string;
  outcome: 'requeued' | 'dead_lettered';
  attemptCount: number;
  deadWorkerId: string | null;
}

/**
 * EM-1 (W2 queue contract closeout). ADR §5.3: reclaim jobs whose lease
 * expired without a heartbeat (EM-2) renewing it — the worker that held them
 * is presumed dead (crash, OOM, deploy). Requeues with the same linear
 * backoff `failJob()` uses if attempts remain, else terminal `failed` (DLQ,
 * ADR §10) — which also raises an EM-6 dead-letter exception, same as
 * `failJob()`'s exhaustion path. Closes the abandoned `compute_job_runs` row
 * as `outcome = 'lease_expired'` either way — that column existed since the
 * original B04 migration and nothing had ever written to it (the W9 fault
 * matrix's core finding).
 *
 * Batches (`FOR UPDATE SKIP LOCKED`, default 100 rows per call) so this is
 * safe to run from more than one process/replica without double-reaping the
 * same row, and safe to call on a tight cron tick without blocking a large
 * table scan.
 *
 * Entry point wired into `server/src/cron/Scheduler.ts` (job 42, every
 * minute) — see that file's comment for why a cron tick was chosen over a
 * standalone daemon process, and the W2 report for the negative-control
 * proof that a live worker's heartbeat prevents this from stealing its
 * lease.
 */
export async function reapExpiredLeases(params?: { batchSize?: number }): Promise<ReapedJob[]> {
  const batchSize = params?.batchSize ?? 100;

  const reaped = await withPinnedPostgresTransaction(async (tx) => {
    const expired = await tx.queryAll<ComputeJobRow>(
      `SELECT * FROM compute_jobs
        WHERE status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at < now()
        ORDER BY lease_expires_at ASC
        LIMIT ?
        FOR UPDATE SKIP LOCKED`,
      [batchSize]
    );

    const results: (ReapedJob & { row: ComputeJobRow })[] = [];
    for (const job of expired) {
      const willRetry = job.attempt_count < job.max_attempts;
      const row = await tx.queryOne<ComputeJobRow>(
        willRetry
          ? `UPDATE compute_jobs
                SET status = 'queued', lease_owner = NULL, lease_expires_at = NULL,
                    error = ?, next_attempt_at = now() + (? || ' seconds')::interval
              WHERE id = ? RETURNING *`
          : `UPDATE compute_jobs
                SET status = 'failed', lease_owner = NULL, lease_expires_at = NULL,
                    finished_at = now(), error = ?
              WHERE id = ? RETURNING *`,
        willRetry
          ? [`lease expired: worker ${job.lease_owner ?? 'unknown'} did not renew before lease_expires_at`, String(30 * job.attempt_count), job.id]
          : [`lease expired: worker ${job.lease_owner ?? 'unknown'} did not renew before lease_expires_at`, job.id]
      );
      if (!row) throw new Error(`reapExpiredLeases: requeue/fail update for job ${job.id} returned no row`);

      await tx.queryRun(
        `UPDATE compute_job_runs SET outcome = 'lease_expired', finished_at = now()
          WHERE job_id = ? AND attempt_number = ? AND outcome IS NULL`,
        [job.id, job.attempt_count]
      );

      results.push({
        jobId: job.id,
        organizationId: job.organization_id,
        jobType: job.job_type,
        outcome: willRetry ? 'requeued' : 'dead_lettered',
        attemptCount: job.attempt_count,
        deadWorkerId: job.lease_owner,
        row,
      });
    }
    return results;
  });

  // EM-6: outside the reaper's own transaction, same pattern as failJob() —
  // a broken exception ledger must never mask that the reap itself succeeded.
  for (const r of reaped) {
    if (r.outcome === 'dead_lettered') {
      await raiseDeadLetterException(r.row);
    }
  }

  return reaped.map(({ row, ...rest }) => rest);
}

export interface SetKillSwitchParams {
  /** null = global (blocks every organization). */
  organizationId: string | null;
  /** null = every job_type. */
  jobType: string | null;
  reason?: string | null;
  actorId: string;
}

/**
 * EM-3 (W2 queue contract closeout). Sets (or re-asserts) an active kill
 * switch consulted by `claim()`'s `is_org_compute_killed()` check (ADR
 * §7.2). Idempotent upsert on the `(organization_id, job_type)` scope
 * (`UNIQUE NULLS NOT DISTINCT`, migration `20260810_finance_v3_w2_b04_queue_ops.sql`).
 */
export async function setKillSwitch(params: SetKillSwitchParams): Promise<void> {
  await withPinnedPostgresTransaction((tx) =>
    tx.queryRun(
      `INSERT INTO compute_kill_switches (id, organization_id, job_type, killed, reason, created_by)
       VALUES (?, ?, ?, true, ?, ?)
       ON CONFLICT (organization_id, job_type)
       DO UPDATE SET killed = true, reason = EXCLUDED.reason, created_by = EXCLUDED.created_by, created_at = now()`,
      [uuidv4(), params.organizationId, params.jobType, params.reason ?? null, params.actorId]
    )
  );
}

/** Removes a kill switch scope entirely (claim() sees it as never having existed). */
export async function clearKillSwitch(params: { organizationId: string | null; jobType: string | null }): Promise<void> {
  await withPinnedPostgresTransaction((tx) =>
    tx.queryRun(`DELETE FROM compute_kill_switches WHERE organization_id IS NOT DISTINCT FROM ? AND job_type IS NOT DISTINCT FROM ?`, [
      params.organizationId,
      params.jobType,
    ])
  );
}

export async function isOrgComputeKilled(organizationId: string, jobType: string): Promise<boolean> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ killed: boolean }>(`SELECT is_org_compute_killed(?, ?) AS killed`, [organizationId, jobType])
  );
  return Boolean(row?.killed);
}

export interface SetOrgConcurrencyLimitParams {
  /** null = default across every organization. */
  organizationId: string | null;
  /** null = default across every job_type. */
  jobType: string | null;
  maxConcurrent: number;
  actorId: string;
}

/**
 * EM-4 (W2 queue contract closeout). Sets the cap `claim()`'s
 * `org_concurrency_limit()` check enforces (ADR §5.1/§8) for a
 * `(organization_id, job_type)` scope (either or both may be NULL for a
 * wildcard/default). The migration seeds a generous global default (50,
 * `organization_id IS NULL AND job_type IS NULL`) so this is opt-in
 * tightening, not a retroactive behaviour change for every existing caller.
 */
export async function setOrgConcurrencyLimit(params: SetOrgConcurrencyLimitParams): Promise<void> {
  if (!(params.maxConcurrent > 0)) throw new Error('setOrgConcurrencyLimit: maxConcurrent must be > 0');
  await withPinnedPostgresTransaction((tx) =>
    tx.queryRun(
      `INSERT INTO compute_org_concurrency_limits (id, organization_id, job_type, max_concurrent, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (organization_id, job_type)
       DO UPDATE SET max_concurrent = EXCLUDED.max_concurrent, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [uuidv4(), params.organizationId, params.jobType, params.maxConcurrent, params.actorId]
    )
  );
}

export async function getOrgConcurrencyLimit(organizationId: string, jobType: string): Promise<number> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ limit: number }>(`SELECT org_concurrency_limit(?, ?) AS limit`, [organizationId, jobType])
  );
  if (row == null || row.limit == null) throw new Error('org_concurrency_limit() returned no row/NULL — migration not applied?');
  return row.limit;
}
