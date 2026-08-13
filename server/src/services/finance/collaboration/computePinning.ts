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
 * Requires the artifact to have REAL content to pin to: either a real
 * autosave/explicit-save/crash-recovery checkpoint (`checkpointOperationStack`),
 * a real compute/reconciliation run (`stampWorkingRevisionComputeIdentity`),
 * or a reopen's copy-on-write of a revision that itself had one of those
 * (`reopenVersion`) must have touched the current working revision.
 *
 * W2-PINSEMANTICS fix (`docs/validation/finance-v3/generated/gate-d/
 * W2_PIN_SEMANTICS_report.md`): this used to be a plain
 * `content_semantic_hash IS NOT NULL` check. The W10-D01 fix made
 * `artifactVersionService.createArtifact()` stamp a non-NULL hash onto
 * revision_seq=1 AT BIRTH (to guarantee the column is never NULL all the way
 * to an APPROVED business version — a real production gap, not a
 * hypothetical one: `canonicalServices.pg.test.ts`'s "the full T2->T4
 * transition chain..." test reaches APPROVED with zero checkpoint/compute
 * calls in between), so a brand-new, still-empty Draft now also reads as
 * "has a hash" and `IS NOT NULL` alone can no longer tell "never touched"
 * apart from "has real content".
 *
 * The fix is NOT to compare the hash value against the specific "empty
 * content" constant `createArtifact()` stamps
 * (`canonicalPayloadHash({ unsavedOperationStack: [] })`,
 * `contentHash.EMPTY_WORKING_REVISION_CONTENT_HASH`) — that constant is also
 * the byte-identical hash of a genuine, intentional EXPLICIT_SAVE checkpoint
 * whose operation stack happens to be empty (e.g. the user saves after
 * undoing every change back to a no-op), which IS real, pinnable content:
 * `concurrencyMatrix.pg.test.ts`'s A4 test does exactly this and expects the
 * pin to succeed. Content-hash equality cannot distinguish "never checkpointed"
 * from "checkpointed to a no-op state" because the hash function only ever
 * sees the operation-stack payload, never WHO wrote the row or WHY.
 *
 * What actually distinguishes "the pristine `createArtifact()` row" from
 * every other row in `finance_working_revisions` is structural, not
 * content-based: `createArtifact()` is the ONLY writer that ever produces
 * `revision_seq = 1` AND leaves `compute_run_id` NULL. Every other writer —
 * `checkpointOperationStack()` (always INSERTs a NEW row, `revision_seq =
 * previous + 1`), `stampWorkingRevisionComputeIdentity()` (always sets
 * `compute_run_id`, at any `revision_seq`), and `reopenVersion()`'s
 * copy-on-write (always INSERTs at `revision_seq > 1`, and copies forward
 * whatever `compute_run_id` its source already had) — produces a row that
 * fails at least one half of that pair. Checking `revision_seq > 1 OR
 * compute_run_id IS NOT NULL` is therefore an exact structural test for "this
 * row is not the birth row", with no risk of a coincidental hash collision.
 */
export async function enqueueComputeForCurrentRevision(
  params: EnqueueComputeForCurrentRevisionParams
): Promise<EnqueueComputeForCurrentRevisionResult> {
  const current = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ content_semantic_hash: string | null; compute_run_id: string | null; revision_seq: string | number }>(
      `SELECT content_semantic_hash, compute_run_id, revision_seq FROM finance_working_revisions WHERE artifact_id = ? AND organization_id = ? AND is_current = true`,
      [params.artifactId, params.organizationId]
    )
  );
  if (!current) {
    return { ok: false, code: 'NOT_FOUND', message: 'No current working revision for this artifact' };
  }
  // BIGINT `revision_seq` comes back from `pg` as a string — `Number(...)` here, not a
  // direct comparison (same pattern as `canonicalServices.pg.test.ts`'s own comment on this).
  const hasRealContent = Number(current.revision_seq) > 1 || current.compute_run_id !== null;
  if (!current.content_semantic_hash || !hasRealContent) {
    return {
      ok: false,
      code: 'NO_CONTENT_HASH',
      message: 'Current working revision has no content_semantic_hash yet (never checkpointed or computed) — nothing to pin compute to',
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
