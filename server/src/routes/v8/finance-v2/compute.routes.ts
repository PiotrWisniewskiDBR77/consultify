/**
 * Finance v3 canonical adapter — compute job queue surface,
 * `/api/v8/finance-v2/compute/jobs/*`.
 *
 * Pakiet B (API & Runtime Integration), priority (a). Exposes the
 * caller-facing subset of `computeJobService.ts`: `enqueue`, `getJob`,
 * `cancelJob`. Deliberately NOT exposed here (worker-internal, not a
 * client-facing REST concern): `claim`/`claimById`/`heartbeat`/
 * `completeJobSuccess`/`failJob`/`reapExpiredLeases` — these are called by
 * the compute worker/cron (`server/src/cron/Scheduler.ts`), not by an HTTP
 * client acting on behalf of a user. Same reasoning for the org-wide
 * kill-switch/concurrency-limit setters (`setKillSwitch`/
 * `setOrgConcurrencyLimit`) — operational controls, not part of this
 * package's user-facing artifact/compute surface; flagged NIEPOKRYTE in
 * the report rather than guessed at.
 *
 * `ComputeJobRow` has no `output`/`result` column (that lives in
 * `compute_job_outputs`, written by `completeJobSuccess`) and
 * `computeJobService.ts` exports no reader for it — GET /jobs/:jobId
 * therefore returns job status (queued/running/succeeded/failed/cancelled)
 * and `input_revision_hash`, but NOT the compute result payload. Documented
 * as a gap in the report (services/finance/canonical/computeJobService.ts
 * is out of this package's write-allowlist — `server/src/services/finance/**`
 * is explicitly NOT allowed to be modified here).
 *
 * Gate E FIX-B (proof-gaps pass, 2026-08-12): the above write-allowlist note is now historical for
 * ONE narrow addition — `computeJobService.ts`'s `enqueue()` used to let a cross-tenant
 * `inputArtifactId`'s raw Postgres FK-violation (`fk_compute_jobs_artifact_org`) propagate as an
 * unhandled 500 (see `cross-tenant.routes.pg.test.ts`'s own comment documenting this as a known
 * defect at the time). `enqueue()` now throws a typed `ComputeJobArtifactMismatchError` for exactly
 * that one constraint; this router catches it below and returns the same 404 shape every other
 * tenant-scoped denial in this router already uses. No other `computeJobService.ts` behavior
 * changed.
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import {
  cancelJob,
  ComputeJobArtifactMismatchError,
  enqueue,
  type EnqueueJobParams,
  getJob,
  getJobOutput,
} from '../../../services/finance/canonical/computeJobService.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { financeV2Meta, readIdempotencyKey, sendError } from './_shared.js';

const router = Router();

function jobToDto(job: Awaited<ReturnType<typeof getJob>>) {
  if (!job) return null;
  return {
    jobId: job.id,
    jobType: job.job_type,
    status: job.status,
    inputArtifactId: job.input_artifact_id,
    inputRevisionHash: job.input_revision_hash,
    attemptCount: job.attempt_count,
    maxAttempts: job.max_attempts,
    createdAt: job.created_at,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    error: job.error,
    requestedByUserId: job.requested_by_user_id,
  };
}

// ---------------------------------------------------------------------------
// POST /compute/jobs — enqueue
// ---------------------------------------------------------------------------

router.post(
  '/compute/jobs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const body = req.body ?? {};

    const idempotencyKey = readIdempotencyKey(req);
    if (!idempotencyKey) {
      return sendError(
        res,
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        'Idempotency-Key header (or body.idempotencyKey) is required to enqueue a compute job'
      );
    }
    for (const field of ['jobType', 'inputArtifactId', 'inputRevisionHash', 'engineManifestId']) {
      if (typeof body[field] !== 'string' || !body[field].trim()) {
        return sendError(
          res,
          400,
          'INVALID_BODY',
          `${field} is required and must be a non-empty string`
        );
      }
    }

    const params: EnqueueJobParams = {
      organizationId,
      jobType: body.jobType,
      inputArtifactId: body.inputArtifactId,
      inputRevisionHash: body.inputRevisionHash,
      engineManifestId: body.engineManifestId,
      idempotencyKey,
      requestedByUserId: userId,
      requestId: typeof body.requestId === 'string' ? body.requestId : null,
      maxAttempts: typeof body.maxAttempts === 'number' ? body.maxAttempts : undefined,
    };

    // Gate E FIX-B LUKA 3: a cross-tenant (or simply nonexistent-in-this-org) inputArtifactId trips
    // the composite FK `fk_compute_jobs_artifact_org` at the DB layer. Before this fix that raw
    // Postgres error reached `asyncHandler` unhandled -> 500. Caught here and mapped to the SAME
    // 404 shape every other tenant-scoped denial in this router already uses (GET/cancel above) —
    // a typed 4xx, not a leak of the underlying constraint violation, and not distinguishable from
    // "this artifactId never existed at all" (uniform, per the FIX-B brief).
    let result: Awaited<ReturnType<typeof enqueue>>;
    try {
      result = await enqueue(params);
    } catch (error) {
      if (error instanceof ComputeJobArtifactMismatchError) {
        return sendError(res, 404, error.code, error.message);
      }
      throw error;
    }

    return res.status(result.wasExisting ? 200 : 201).json({
      data: { ...jobToDto(result.job), wasExisting: result.wasExisting },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /compute/jobs/:jobId — status
// ---------------------------------------------------------------------------

router.get(
  '/compute/jobs/:jobId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const jobId = String(req.params.jobId || '');

    const job = await getJob(organizationId, jobId);
    if (!job) {
      return sendError(res, 404, 'NOT_FOUND', 'Compute job not found');
    }

    return res.status(200).json({ data: jobToDto(job), meta: financeV2Meta() });
  })
);

// ---------------------------------------------------------------------------
// GET /compute/jobs/:jobId/output — D2 fix (Pakiet B2). Closes the gap Pakiet
// B's report flagged: no endpoint could ever return a compute result, only
// job status. Fail-closed: job must exist for THIS org (404 otherwise);
// output missing (job not yet succeeded, or succeeded-without-output — see
// `computeJobService.getJobOutput`'s own doc comment) is a distinct 404 code
// so a client can tell "wrong id/not yours" apart from "not ready yet".
// ---------------------------------------------------------------------------

router.get(
  '/compute/jobs/:jobId/output',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const jobId = String(req.params.jobId || '');

    const job = await getJob(organizationId, jobId);
    if (!job) {
      return sendError(res, 404, 'NOT_FOUND', 'Compute job not found');
    }

    const output = await getJobOutput(organizationId, jobId);
    if (!output) {
      return sendError(res, 404, 'OUTPUT_NOT_READY', 'Compute job has no committed output yet', {
        jobStatus: job.status,
      });
    }

    return res.status(200).json({
      data: {
        jobId: output.job_id,
        outputArtifactId: output.output_artifact_id,
        outputBusinessVersionId: output.output_business_version_id,
        outputWorkingRevisionId: output.output_working_revision_id,
        committedByAttemptNumber: output.committed_by_attempt_number,
        contentSemanticHash: output.content_semantic_hash,
        freshness: output.freshness,
        committedAt: output.committed_at,
      },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// POST /compute/jobs/:jobId/cancel
// ---------------------------------------------------------------------------

router.post(
  '/compute/jobs/:jobId/cancel',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const jobId = String(req.params.jobId || '');
    const reason =
      typeof (req.body ?? {}).reason === 'string' ? req.body.reason : 'Cancelled via API';

    const updated = await cancelJob(organizationId, jobId, reason);
    if (!updated) {
      // Fail-closed / not-a-leak: identical response whether the job does not
      // exist, belongs to another org, or is already terminal (queued/running
      // only are cancellable) — callers cannot distinguish "not yours" from
      // "already done" from "never existed".
      return sendError(
        res,
        404,
        'NOT_FOUND',
        'Compute job not found or not cancellable (already terminal)'
      );
    }

    return res.status(200).json({ data: jobToDto(updated), meta: financeV2Meta() });
  })
);

export default router;
