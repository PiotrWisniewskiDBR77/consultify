/**
 * AP-04 — ComputePinning: pin every compute enqueue to the artifact's CURRENT
 * `content_semantic_hash` at request time.
 *
 * Program: `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`
 * section 5, AP-04 task brief item 5: "Compute pinned do revision hash: gdy
 * uzytkownik wywoluje compute, przypnij do konkretnego content_semantic_hash
 * aktualnego working_revision ... jesli w miedzyczasie ktos edytuje, nowy
 * compute dostaje nowy hash, stary wynik nie jest cicho podmieniany (to juz
 * czesciowo zaprojektowane w WP-B04, tutaj tylko integracja z autosave/undo
 * flow)".
 *
 * `computeJobService.enqueue()` (Gate C, `server/src/services/finance/canonical/computeJobService.ts`)
 * already accepts an `inputRevisionHash` parameter and already makes
 * `compute_job_outputs` unique on `(organization_id, output_artifact_id,
 * content_semantic_hash)` (migration `20260809_finance_v3_b04_compute_jobs.sql`
 * line ~113) — the hash-pinning MECHANISM is already shipped. What was
 * missing, and what this file adds, is the one integration call: read the
 * artifact's CURRENT working revision's `content_semantic_hash` (which
 * `autosaveService.checkpointOperationStack` — this same work package — is
 * what actually keeps fresh as edits land) and pass exactly that into
 * `enqueue()`, instead of every caller having to know to do this itself. No
 * new compute-engine logic is added here; `computeJobService.ts` is not
 * modified.
 */

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import * as computeJobService from '../canonical/computeJobService.js';

export interface EnqueueComputeForCurrentRevisionParams {
  organizationId: string;
  artifactId: string;
  jobType: string;
  engineManifestId: string;
  idempotencyKey: string;
  requestedByUserId: string;
  requestId?: string | null;
  maxAttempts?: number;
}

export type EnqueueComputeForCurrentRevisionResult =
  | { ok: true; job: computeJobService.ComputeJobRow; wasExisting: boolean; pinnedContentSemanticHash: string }
  | { ok: false; code: 'NOT_FOUND' | 'NO_CONTENT_HASH'; message: string };

/**
 * Reads the artifact's CURRENT `is_current` working revision's
 * `content_semantic_hash` and enqueues a compute job pinned to exactly that
 * hash. If an edit lands (a new autosave/explicit-save checkpoint, or a
 * future domain-table apply) between this read and the job actually running,
 * the job's own `compute_job_outputs.content_semantic_hash` (recorded at
 * COMMIT time by `computeJobService`'s `completeJobSuccess`, not here) will
 * reflect what it actually ran against — a caller re-computing after a
 * further edit gets served through a DIFFERENT idempotency key (a new user
 * action), so it lands as a separate `compute_job_outputs` row rather than
 * overwriting the old one; the old, now-stale, hash-pinned result is never
 * silently replaced.
 *
 * Requires the artifact to have been checkpointed at least once
 * (`content_semantic_hash IS NOT NULL`) — a brand-new Draft that has never
 * gone through `checkpointOperationStack` has nothing to pin to yet.
 */
export async function enqueueComputeForCurrentRevision(
  params: EnqueueComputeForCurrentRevisionParams
): Promise<EnqueueComputeForCurrentRevisionResult> {
  const current = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ content_semantic_hash: string | null }>(
      `SELECT content_semantic_hash FROM finance_working_revisions WHERE artifact_id = ? AND organization_id = ? AND is_current = true`,
      [params.artifactId, params.organizationId]
    )
  );
  if (!current) {
    return { ok: false, code: 'NOT_FOUND', message: 'No current working revision for this artifact' };
  }
  if (!current.content_semantic_hash) {
    return {
      ok: false,
      code: 'NO_CONTENT_HASH',
      message: 'Current working revision has no content_semantic_hash yet (never checkpointed) — nothing to pin compute to',
    };
  }

  const { job, wasExisting } = await computeJobService.enqueue({
    organizationId: params.organizationId,
    jobType: params.jobType,
    inputArtifactId: params.artifactId,
    inputRevisionHash: current.content_semantic_hash,
    engineManifestId: params.engineManifestId,
    idempotencyKey: params.idempotencyKey,
    requestedByUserId: params.requestedByUserId,
    requestId: params.requestId ?? null,
    maxAttempts: params.maxAttempts,
  });

  return { ok: true, job, wasExisting, pinnedContentSemanticHash: current.content_semantic_hash };
}
