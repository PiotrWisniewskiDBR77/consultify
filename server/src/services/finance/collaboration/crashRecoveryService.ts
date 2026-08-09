/**
 * AP-04 — CrashRecoveryService: detect and reconstruct a dangling autosave
 * checkpoint on artifact re-open.
 *
 * Program: `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 4 ("crash/refresh recovery"). ADR:
 * `docs/validation/finance-v3/generated/gate-d/AP-04_undo_autosave_conflicts_ADR.md`.
 * Task instruction (Gate A brief, item 3): "przy ponownym otwarciu artefaktu,
 * jesli istnieje working_revision z crash_recovery_checkpoint=true nowszy niz
 * ostatni jawny save - zaproponuj odzyskanie (nie automatyczne nadpisanie)".
 *
 * Detection rule, traced against the real schema
 * (`finance_working_revisions.crash_recovery_checkpoint`, shipped Gate C):
 * the artifact's current `is_current` row IS the newest working revision by
 * construction (every checkpoint write demotes the prior `is_current` row
 * first — `autosaveService.checkpointOperationStack`, same pattern as
 * `reopenVersion()`). So "a crash-recovery checkpoint newer than the last
 * explicit save" reduces to: is the CURRENT row itself a crash-recovery
 * checkpoint? If yes, walk backward to the most recent
 * `checkpoint_source = 'EXPLICIT_SAVE'` row for context (what the user last
 * knowingly saved) and return both to the caller — which proposes recovery
 * to the user, never auto-restores.
 */

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import type { FinanceUnsavedOperationStackEntry } from '../../../types/finance/WorkspaceState.js';
import { OperationStack, type OperationStackEntry } from './operationStack.js';
import {
  checkpointOperationStack,
  type CheckpointPayload,
  type CheckpointResult,
  type CheckpointSource,
  type WorkingRevisionCheckpointRow,
} from './autosaveService.js';

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

export interface RecoverableCheckpoint {
  workingRevisionId: string;
  revisionSeq: number;
  checkpointSource: CheckpointSource | null;
  /** Raw payload as persisted — `null` for a pre-AP-04 row that predates `checkpoint_payload` (T1 create / T12 reopen rows never populate it). */
  payload: CheckpointPayload | null;
  editedBy: string | null;
  editedAt: string;
  /** The most recent row this artifact has where `checkpoint_source = 'EXPLICIT_SAVE'` — `null` if the artifact has never had an explicit save (still on its original T1/T12 row). This is the "ostatni jawny save" the task brief compares against. */
  lastExplicitSaveWorkingRevisionId: string | null;
  lastExplicitSaveRevisionSeq: number | null;
}

export type DetectRecoveryResult =
  | { ok: true; recoverable: true; checkpoint: RecoverableCheckpoint }
  | { ok: true; recoverable: false }
  | { ok: false; code: 'NOT_FOUND'; message: string };

function parseCheckpointPayload(raw: unknown): CheckpointPayload | null {
  if (raw === null || raw === undefined) return null;
  // `pg` already parses JSONB columns into JS objects; guard defensively in
  // case a caller passes a pre-stringified value through a different path.
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (typeof value !== 'object' || value === null || !Array.isArray((value as any).unsavedOperationStack)) {
    return null;
  }
  return value as CheckpointPayload;
}

/**
 * Call this when an artifact is opened. Read-only (no write) — proposing
 * recovery must never itself mutate state, per the task's explicit
 * "nie automatyczne nadpisanie" instruction.
 */
export async function detectRecoverableCheckpoint(params: {
  organizationId: string;
  artifactId: string;
}): Promise<DetectRecoveryResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    const current = await tx.queryOne<WorkingRevisionCheckpointRow>(
      `SELECT * FROM finance_working_revisions WHERE artifact_id = ? AND organization_id = ? AND is_current = true`,
      [params.artifactId, params.organizationId]
    );
    if (!current) return { ok: false, code: 'NOT_FOUND', message: 'No working revision for this artifact' };

    if (!current.crash_recovery_checkpoint) {
      return { ok: true, recoverable: false };
    }

    const lastExplicit = await tx.queryOne<{ working_revision_id: string; revision_seq: number | string }>(
      `SELECT working_revision_id, revision_seq FROM finance_working_revisions
        WHERE artifact_id = ? AND organization_id = ? AND checkpoint_source = 'EXPLICIT_SAVE'
        ORDER BY revision_seq DESC LIMIT 1`,
      [params.artifactId, params.organizationId]
    );

    return {
      ok: true,
      recoverable: true,
      checkpoint: {
        workingRevisionId: current.working_revision_id,
        revisionSeq: Number(current.revision_seq),
        checkpointSource: current.checkpoint_source,
        payload: parseCheckpointPayload(current.checkpoint_payload),
        editedBy: current.edited_by,
        editedAt: current.edited_at,
        lastExplicitSaveWorkingRevisionId: lastExplicit?.working_revision_id ?? null,
        lastExplicitSaveRevisionSeq: lastExplicit ? Number(lastExplicit.revision_seq) : null,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Reconstruction — pure, no DB. Separate from detection so the "read from
// Postgres" leg and the "rebuild an OperationStack from JSON" leg can each be
// timed independently in the ≤5s benchmark (task item 3).
// ---------------------------------------------------------------------------

export function reconstructOperationStack(
  checkpoint: Pick<RecoverableCheckpoint, 'payload'>,
  options: { maxDepth?: number } = {}
): OperationStack {
  const entries: OperationStackEntry[] = (checkpoint.payload?.unsavedOperationStack ?? []).map((e) => ({
    operation: e.operation,
    // The checkpoint payload only carries `FinanceUnsavedOperationStackEntry`
    // (operation + appliedAt + committed — the WorkspaceState wire shape,
    // `server/src/types/finance/WorkspaceState.ts`), which does NOT carry
    // per-cell `priorValues` (that is OperationStack's own in-memory undo
    // bookkeeping, never serialized to the server — AP-00 ADR section 8
    // deliberately keeps WorkspaceState's wire shape minimal). A
    // crash-recovered stack can therefore REPLAY forward (redo the pending
    // edits) but cannot itself further UNDO past the recovery point without
    // the client re-deriving priorValues from the grid it reloads against —
    // documented here rather than silently guessing empty priorValues.
    priorValues: [],
    pushedAt: e.appliedAt,
  }));
  return OperationStack.fromEntries(entries, options);
}

/** Convenience wrapper combining detect + reconstruct in one call, for the "open artifact" code path. Still read-only. */
export async function loadRecoverableWorkspace(params: {
  organizationId: string;
  artifactId: string;
  maxUndoDepth?: number;
}): Promise<
  | { ok: true; recoverable: true; checkpoint: RecoverableCheckpoint; operationStack: OperationStack }
  | { ok: true; recoverable: false }
  | { ok: false; code: 'NOT_FOUND'; message: string }
> {
  const detection = await detectRecoverableCheckpoint(params);
  if (!detection.ok || !detection.recoverable) return detection;
  const operationStack = reconstructOperationStack(detection.checkpoint, { maxDepth: params.maxUndoDepth });
  return { ok: true, recoverable: true, checkpoint: detection.checkpoint, operationStack };
}

// ---------------------------------------------------------------------------
// Resolution — the two things a user can do with a recovery prompt. Neither
// happens automatically (task: "zaproponuj odzyskanie, nie automatyczne
// nadpisanie") — both require an explicit caller invocation AFTER the user
// has chosen in the UI.
// ---------------------------------------------------------------------------

/**
 * User chose "resume my unsaved work". Re-checkpoints the SAME recovered
 * payload under `checkpoint_source = 'CRASH_RECOVERY_RESTORE'` — this
 * advances `revision_seq` (so a second client racing to open the same
 * artifact sees a fresh `working_revision_id` and, if it also tries to
 * accept, gets a normal `WORKING_REVISION_CONFLICT` from
 * `checkpointOperationStack` rather than silently clobbering this accept)
 * while still leaving `crash_recovery_checkpoint = true` (the work is still
 * un-explicitly-saved — accepting a recovery is not the same act as saving).
 */
export async function acceptRecovery(params: {
  organizationId: string;
  artifactId: string;
  actorId: string;
  checkpoint: Pick<RecoverableCheckpoint, 'workingRevisionId' | 'payload'>;
}): Promise<CheckpointResult> {
  return checkpointOperationStack({
    organizationId: params.organizationId,
    artifactId: params.artifactId,
    actorId: params.actorId,
    expectedWorkingRevisionId: params.checkpoint.workingRevisionId,
    unsavedOperationStack: params.checkpoint.payload?.unsavedOperationStack ?? [],
    source: 'CRASH_RECOVERY_RESTORE',
  });
}

/**
 * User chose "discard, start clean". Writes an EXPLICIT_SAVE checkpoint with
 * an EMPTY operation stack — this is what actually clears
 * `crash_recovery_checkpoint` back to `false`, so the next `detectRecoverableCheckpoint`
 * call for this artifact returns `recoverable: false` instead of re-prompting
 * with the same stale checkpoint forever.
 */
export async function discardRecovery(params: {
  organizationId: string;
  artifactId: string;
  actorId: string;
  checkpoint: Pick<RecoverableCheckpoint, 'workingRevisionId'>;
}): Promise<CheckpointResult> {
  return checkpointOperationStack({
    organizationId: params.organizationId,
    artifactId: params.artifactId,
    actorId: params.actorId,
    expectedWorkingRevisionId: params.checkpoint.workingRevisionId,
    unsavedOperationStack: [],
    source: 'EXPLICIT_SAVE',
  });
}

export type { FinanceUnsavedOperationStackEntry };
