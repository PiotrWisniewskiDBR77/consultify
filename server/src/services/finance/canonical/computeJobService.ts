/**
 * Finance v3 canonical — compute job queue service.
 *
 * Gate C, WP-C02 "compatibility services". Wraps `compute_jobs` /
 * `compute_job_runs` / `compute_job_outputs`
 * (migration `20260809_finance_v3_b04_compute_jobs.sql`), per
 * `docs/validation/finance-v3/generated/gate-b/WP-B04_jobs_runs_outputs_ADR.md`
 * section 5 (claim-query pattern: `FOR UPDATE SKIP LOCKED`).
 *
 * `org_concurrency_limit()`/`is_org_compute_killed()` (referenced by the B04
 * ADR's claim-query sketch) are explicitly NOT implemented anywhere in Gate C
 * per the WP-C01 migration report §6 point 9 — no concrete DDL exists for
 * them in any ADR. This service's `claim()` therefore does not enforce a
 * per-org concurrency cap; that is documented, open follow-on work, not a
 * silent omission.
 */

import { v4 as uuidv4 } from 'uuid';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';

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
 * whose `next_attempt_at` has arrived, claimed in one statement (subquery
 * selects+locks, outer UPDATE claims) so two concurrent workers never both
 * claim the same job — the second worker's `SKIP LOCKED` simply excludes
 * the row the first worker's subquery already locked, rather than blocking
 * on it. Also inserts the corresponding `compute_job_runs` row (attempt
 * bookkeeping) in the SAME transaction.
 */
export async function claim(params: ClaimParams): Promise<ComputeJobRow[]> {
  const limit = params.limit ?? 1;
  const leaseSeconds = params.leaseDurationSeconds ?? 300;

  return withPinnedPostgresTransaction(async (tx) => {
    const typeFilter = params.jobTypes && params.jobTypes.length > 0 ? `AND job_type = ANY(?)` : '';
    const claimed = await tx.queryAll<ComputeJobRow>(
      `UPDATE compute_jobs
          SET status = 'running',
              lease_owner = ?,
              lease_expires_at = now() + (? || ' seconds')::interval,
              started_at = COALESCE(started_at, now()),
              attempt_count = attempt_count + 1
        WHERE id IN (
          SELECT id FROM compute_jobs
           WHERE status = 'queued' AND next_attempt_at <= now() ${typeFilter}
           ORDER BY next_attempt_at ASC
           FOR UPDATE SKIP LOCKED
           LIMIT ?
        )
        RETURNING *`,
      typeFilter
        ? [params.workerId, String(leaseSeconds), params.jobTypes, limit]
        : [params.workerId, String(leaseSeconds), limit]
    );

    for (const job of claimed) {
      await tx.queryRun(
        `INSERT INTO compute_job_runs (id, job_id, attempt_number, worker_id) VALUES (?, ?, ?, ?)`,
        [uuidv4(), job.id, job.attempt_count, params.workerId]
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

export interface FailJobParams {
  jobId: string;
  error: string;
}

/** Fail an attempt; requeues with a linear backoff if attempts remain, else terminal `failed`. */
export async function failJob(params: FailJobParams): Promise<ComputeJobRow | null> {
  return withPinnedPostgresTransaction(async (tx) => {
    const job = await tx.queryOne<ComputeJobRow>(`SELECT * FROM compute_jobs WHERE id = ? FOR UPDATE`, [params.jobId]);
    if (!job || job.status !== 'running') return null;

    const willRetry = job.attempt_count < job.max_attempts;
    const updated = await tx.queryOne<ComputeJobRow>(
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
    return updated;
  });
}

export async function cancelJob(jobId: string, reason: string): Promise<ComputeJobRow | null> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryOne<ComputeJobRow>(
      `UPDATE compute_jobs SET status = 'cancelled', cancel_requested_at = now(), cancel_reason = ?
        WHERE id = ? AND status IN ('queued', 'running') RETURNING *`,
      [reason, jobId]
    )
  );
}

export async function getJob(jobId: string): Promise<ComputeJobRow | null> {
  return withPinnedPostgresTransaction((tx) => tx.queryOne<ComputeJobRow>(`SELECT * FROM compute_jobs WHERE id = ?`, [jobId]));
}
