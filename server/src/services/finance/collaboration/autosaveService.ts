/**
 * AP-04 — AutosaveService: checkpoint the client's unsaved `OperationStack`
 * into `finance_working_revisions`.
 *
 * Program: `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 4 ("autosave", "Sync/Saved/Conflict"). ADR:
 * `docs/validation/finance-v3/generated/gate-d/AP-04_undo_autosave_conflicts_ADR.md`.
 * Schema: `server/migrations/20260809_finance_v3_b01_core_artifacts.sql`
 * (`finance_working_revisions`, `crash_recovery_checkpoint` — already
 * shipped, Gate C) + `server/migrations/20260809_finance_v3_d_ap04_autosave_checkpoints.sql`
 * (`checkpoint_payload`/`checkpoint_source` — additive, this work package).
 *
 * Reuses the EXACT demote-then-INSERT working-revision pattern
 * `reopenVersion()` (`server/src/services/finance/canonical/artifactVersionService.ts`
 * lines ~700-729) already established, rather than inventing a second
 * mechanism for "how does a new working_revision checkpoint get created" —
 * per the task's hard instruction not to build a parallel mechanism next to
 * the one Gate C already shipped.
 *
 * WHY `withPinnedPostgresTransaction`, never `DbPromise`: same reasoning as
 * every other canonical service in this program (see
 * `artifactVersionService.ts`'s header comment) — a checkpoint write is a
 * `SELECT ... FOR UPDATE` + demote-UPDATE + INSERT, must be atomic and must
 * fail loud, not silently swallow a real DB error behind `DbPromise`'s
 * `fallback: true` default.
 */

import { createHash } from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import type { FinanceUnsavedOperationStackEntry } from '../../../types/finance/WorkspaceState.js';

// ---------------------------------------------------------------------------
// Sync/Saved/Conflict — explicit enum returned to the frontend (task brief,
// verbatim: "Stan Sync/Saved/Conflict jako explicit enum zwracany do
// frontendu"). `SYNCING` names the in-flight state more precisely than a bare
// "Sync" would as a REST enum value; `SAVED`/`CONFLICT` are the task's own
// words.
// ---------------------------------------------------------------------------

export const AutosaveStateValues = ['SYNCING', 'SAVED', 'CONFLICT'] as const;
export type AutosaveState = (typeof AutosaveStateValues)[number];

export const CheckpointSourceValues = ['AUTOSAVE', 'EXPLICIT_SAVE', 'CRASH_RECOVERY_RESTORE'] as const;
export type CheckpointSource = (typeof CheckpointSourceValues)[number];

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

export interface WorkingRevisionCheckpointRow {
  working_revision_id: string;
  artifact_id: string;
  organization_id: string;
  business_version_id: string | null;
  source_business_version_id: string | null;
  revision_seq: number | string; // BIGINT — `pg` returns this as a string; callers must Number(...) it.
  version: number;
  content_semantic_hash: string | null;
  is_current: boolean;
  crash_recovery_checkpoint: boolean;
  checkpoint_payload: unknown | null;
  checkpoint_source: CheckpointSource | null;
  edited_by: string | null;
  edited_at: string;
}

export interface CheckpointPayload {
  unsavedOperationStack: FinanceUnsavedOperationStackEntry[];
}

// ---------------------------------------------------------------------------
// checkpointOperationStack — the one write path every autosave, explicit
// save, and crash-recovery-restore-acknowledgement goes through.
// ---------------------------------------------------------------------------

export interface CheckpointOperationStackParams {
  organizationId: string;
  artifactId: string;
  actorId: string;
  /**
   * CAS pin: the `working_revision_id` the client believes is still
   * `is_current` (mirrors AP-00's `Operation.sourceWorkingRevisionId` /
   * `ApplyOperationsBatchRequest.expectedWorkingRevisionId`). If the artifact's
   * actual current row has moved past this, the checkpoint is REJECTED as a
   * conflict rather than silently overwriting someone else's newer
   * checkpoint — this is the concurrency guard `conflictResolver.ts` then
   * explains in detail to the UI.
   */
  expectedWorkingRevisionId: string;
  unsavedOperationStack: readonly FinanceUnsavedOperationStackEntry[];
  source: CheckpointSource;
}

export type CheckpointResult =
  | { ok: true; state: 'SAVED'; workingRevision: WorkingRevisionCheckpointRow }
  | {
      ok: false;
      state: 'CONFLICT';
      code: 'WORKING_REVISION_CONFLICT';
      message: string;
      currentWorkingRevisionId: string;
      currentRevisionSeq: number;
    }
  | { ok: false; state: 'SYNCING'; code: 'NOT_FOUND'; message: string };

/** Deterministic content hash of the checkpoint payload — this checkpoint's own `content_semantic_hash`. Not the domain-value hash a real compute/apply executor would derive from `finance_stmt_lines` rows (that executor is out of this work package's scope, see AP-00 ADR section 6.2); this hash's job is narrower: let `computePinning.ts` and freshness checks detect "the working revision changed" without a byte-diff. */
function canonicalPayloadHash(payload: CheckpointPayload): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function checkpointOperationStack(params: CheckpointOperationStackParams): Promise<CheckpointResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    const current = await tx.queryOne<WorkingRevisionCheckpointRow>(
      `SELECT * FROM finance_working_revisions WHERE artifact_id = ? AND organization_id = ? AND is_current = true FOR UPDATE`,
      [params.artifactId, params.organizationId]
    );
    if (!current) {
      return { ok: false, state: 'SYNCING', code: 'NOT_FOUND', message: 'No current working revision for this artifact' };
    }

    if (current.working_revision_id !== params.expectedWorkingRevisionId) {
      return {
        ok: false,
        state: 'CONFLICT',
        code: 'WORKING_REVISION_CONFLICT',
        message: `Working revision moved from ${params.expectedWorkingRevisionId} to ${current.working_revision_id} since this client last synced`,
        currentWorkingRevisionId: current.working_revision_id,
        currentRevisionSeq: Number(current.revision_seq),
      };
    }

    const payload: CheckpointPayload = { unsavedOperationStack: [...params.unsavedOperationStack] };
    const contentSemanticHash = canonicalPayloadHash(payload);
    const newWorkingRevisionId = uuidv4();
    const nextSeq = Number(current.revision_seq) + 1;
    // EXPLICIT_SAVE is the only source that is NOT itself a "crash recovery
    // checkpoint" — an autosave, or a restored-from-crash re-checkpoint, is
    // by definition not yet an explicit user save.
    const isCrashRecoveryCheckpoint = params.source !== 'EXPLICIT_SAVE';

    // Demote-then-INSERT, same ordering `reopenVersion()` uses (partial
    // unique index `uq_finance_wr_one_current` requires exactly this order
    // within one transaction/connection).
    await tx.queryRun(`UPDATE finance_working_revisions SET is_current = false WHERE artifact_id = ? AND is_current = true`, [
      params.artifactId,
    ]);

    const inserted = await tx.queryOne<WorkingRevisionCheckpointRow>(
      `INSERT INTO finance_working_revisions (
         working_revision_id, artifact_id, organization_id, business_version_id, source_business_version_id,
         revision_seq, content_semantic_hash, is_current, crash_recovery_checkpoint,
         checkpoint_payload, checkpoint_source, edited_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, true, ?, ?, ?, ?)
       RETURNING *`,
      [
        newWorkingRevisionId,
        params.artifactId,
        params.organizationId,
        current.business_version_id,
        current.source_business_version_id,
        nextSeq,
        contentSemanticHash,
        isCrashRecoveryCheckpoint,
        JSON.stringify(payload),
        params.source,
        params.actorId,
      ]
    );
    if (!inserted) throw new Error('finance_working_revisions checkpoint insert returned no row');

    return { ok: true, state: 'SAVED', workingRevision: inserted };
  });
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/** Current `is_current` working-revision row for an artifact, or null if the artifact has none (should not happen post-`createArtifact`, but callers must not assume). */
export async function getCurrentWorkingRevision(params: {
  organizationId: string;
  artifactId: string;
}): Promise<WorkingRevisionCheckpointRow | null> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryOne<WorkingRevisionCheckpointRow>(
      `SELECT * FROM finance_working_revisions WHERE artifact_id = ? AND organization_id = ? AND is_current = true`,
      [params.artifactId, params.organizationId]
    )
  );
}

/**
 * The Sync/Saved/Conflict state a frontend should show for an already-known
 * `expectedWorkingRevisionId`, WITHOUT writing a checkpoint — a cheap
 * read-only poll (e.g. for a periodic freshness ping between debounced
 * autosaves). `SYNCING` covers both "no working revision yet" (should not
 * normally happen) and, by convention, the moment right before a flush is
 * scheduled — callers with an in-flight autosave should prefer their own
 * local "saving..." UI state over calling this.
 */
export async function peekAutosaveState(params: {
  organizationId: string;
  artifactId: string;
  expectedWorkingRevisionId: string | null;
}): Promise<{ state: AutosaveState; currentWorkingRevisionId: string | null; currentRevisionSeq: number | null }> {
  const current = await getCurrentWorkingRevision(params);
  if (!current) return { state: 'SYNCING', currentWorkingRevisionId: null, currentRevisionSeq: null };
  if (!params.expectedWorkingRevisionId || current.working_revision_id === params.expectedWorkingRevisionId) {
    return { state: 'SAVED', currentWorkingRevisionId: current.working_revision_id, currentRevisionSeq: Number(current.revision_seq) };
  }
  return { state: 'CONFLICT', currentWorkingRevisionId: current.working_revision_id, currentRevisionSeq: Number(current.revision_seq) };
}
