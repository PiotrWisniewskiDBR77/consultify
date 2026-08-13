/**
 * AP-04 — ConflictResolver: mine/theirs/base 3-way detection for the same
 * `CellRef` edited by two users between checkpoints.
 *
 * Program: `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 4 ("Conflict"). Task brief item 4: "gdy dwoch userow
 * edytuje ten sam CellRef w oknie miedzy checkpointami, wykryj (porownanie
 * base_revision_id vs aktualny), zaproponuj rozstrzygniecie (nie automatyczne,
 * zwroc strukture do UI z opcjami mine/theirs/merge-per-cell tam gdzie to
 * mozliwe)". ADR: `docs/validation/finance-v3/generated/gate-d/AP-04_undo_autosave_conflicts_ADR.md`.
 *
 * "base" = the working_revision_id `WorkspaceState.sourceWorkingRevisionId`
 * was pinned to when the current user's local session started (AP-00 ADR
 * section 8 — "the workspace-level analogue of `Operation.sourceWorkingRevisionId`,
 * used as the 'as of' pin for AP-04's mine/theirs/base conflict resolution").
 * "theirs" = every checkpoint strictly between `base` and the artifact's
 * CURRENT `is_current` working revision, reconstructed from their
 * `checkpoint_payload` (written by `autosaveService.checkpointOperationStack`,
 * this same work package) — i.e. genuinely someone else's committed
 * checkpoints, not a guess. "mine" = the calling user's own still-pending
 * `unsavedOperationStack`, supplied by the caller (never persisted server-side
 * until it goes through `checkpointOperationStack` itself).
 *
 * This module NEVER auto-applies a resolution — `detectConflicts` only
 * returns a structure for the UI to render three choices per conflicting
 * cell; `buildResolvedOperation` turns the user's explicit choices into one
 * `Operation` the caller then submits through the normal executor path, but
 * only after being called with the user's actual decisions.
 */

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { cellRefKey, type CellRef } from '../../../types/finance/CellRef.js';
import type { FinanceRole } from '../canonical/lifecycleService.js';
import type { FinanceValueInput, Operation } from '../../../types/finance/Operation.js';
import { operationTargets } from '../../../types/finance/Operation.js';
import type { FinanceUnsavedOperationStackEntry } from '../../../types/finance/WorkspaceState.js';
import { operationIntendedValues } from './operationStack.js';
import type { CheckpointPayload, WorkingRevisionCheckpointRow } from './autosaveService.js';

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

export const ConflictResolutionChoiceValues = ['MINE', 'THEIRS', 'MERGE_PER_CELL'] as const;
export type ConflictResolutionChoiceKind = (typeof ConflictResolutionChoiceValues)[number];

export interface ConflictCandidate {
  cellRef: CellRef;
  /** This user's still-pending intended value for this cell, or `null` if unresolvable at this layer (e.g. their pending op was a `reset` — see `operationIntendedValues` doc comment). */
  mine: FinanceValueInput | null;
  theirsWorkingRevisionId: string;
  theirsRevisionSeq: number;
  theirs: FinanceValueInput | null;
  theirsEditedBy: string | null;
  theirsEditedAt: string;
  /** `MERGE_PER_CELL` is only offered when BOTH sides resolved to a concrete value — offering "merge" when one side is unresolvable (`null`) would let the UI construct a nonsensical merged value. */
  resolutionOptions: ConflictResolutionChoiceKind[];
}

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  baseWorkingRevisionId: string | null;
  currentWorkingRevisionId: string;
  currentRevisionSeq: number;
  conflicts: ConflictCandidate[];
}

export type DetectConflictsResult =
  | { ok: true; result: ConflictDetectionResult }
  | { ok: false; code: 'NOT_FOUND'; message: string };

function parsePayload(raw: unknown): CheckpointPayload | null {
  if (raw === null || raw === undefined) return null;
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (typeof value !== 'object' || value === null || !Array.isArray((value as any).unsavedOperationStack)) return null;
  return value as CheckpointPayload;
}

interface TheirsWrite {
  cellRef: CellRef;
  value: FinanceValueInput | null;
  workingRevisionId: string;
  revisionSeq: number;
  editedBy: string | null;
  editedAt: string;
}

/** Latest-write-wins projection, per cell, across a set of committed stack entries — used for BOTH "mine" (my own pending ops) and "theirs" (their intervening checkpoints), same logic, so the two sides are compared on equal footing. */
function latestWritePerCell(
  operations: readonly Operation[],
  context: { workingRevisionId: string; revisionSeq: number; editedBy: string | null; editedAt: string }
): Map<string, TheirsWrite> {
  const byKey = new Map<string, TheirsWrite>();
  for (const op of operations) {
    const targets = operationTargets(op);
    const values = operationIntendedValues(op);
    targets.forEach((cellRef, idx) => {
      byKey.set(cellRefKey(cellRef), {
        cellRef,
        value: values[idx] ?? null,
        workingRevisionId: context.workingRevisionId,
        revisionSeq: context.revisionSeq,
        editedBy: context.editedBy,
        editedAt: context.editedAt,
      });
    });
  }
  return byKey;
}

export interface DetectConflictsParams {
  organizationId: string;
  artifactId: string;
  /** `WorkspaceState.sourceWorkingRevisionId` — what MY local state was built against. `null` means "never synced yet" (a brand-new Draft), in which case there is by definition no "theirs" window to scan and this call always returns `hasConflicts: false`. */
  baseWorkingRevisionId: string | null;
  myUnsavedOperationStack: readonly FinanceUnsavedOperationStackEntry[];
}

export async function detectConflicts(params: DetectConflictsParams): Promise<DetectConflictsResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    const current = await tx.queryOne<WorkingRevisionCheckpointRow>(
      `SELECT * FROM finance_working_revisions WHERE artifact_id = ? AND organization_id = ? AND is_current = true`,
      [params.artifactId, params.organizationId]
    );
    if (!current) return { ok: false, code: 'NOT_FOUND', message: 'No working revision for this artifact' };

    const currentRevisionSeq = Number(current.revision_seq);

    if (!params.baseWorkingRevisionId || current.working_revision_id === params.baseWorkingRevisionId) {
      return {
        ok: true,
        result: {
          hasConflicts: false,
          baseWorkingRevisionId: params.baseWorkingRevisionId,
          currentWorkingRevisionId: current.working_revision_id,
          currentRevisionSeq,
          conflicts: [],
        },
      };
    }

    const baseRow = await tx.queryOne<{ revision_seq: number | string }>(
      `SELECT revision_seq FROM finance_working_revisions WHERE working_revision_id = ? AND organization_id = ? AND artifact_id = ?`,
      [params.baseWorkingRevisionId, params.organizationId, params.artifactId]
    );
    // If the base row is unknown (e.g. purged, or from a different artifact
    // by client error), treat the whole history as "theirs" rather than
    // failing closed — revision_seq 0 is always below every real row.
    const baseSeq = baseRow ? Number(baseRow.revision_seq) : 0;

    const intervening = await tx.queryAll<WorkingRevisionCheckpointRow>(
      `SELECT * FROM finance_working_revisions
        WHERE artifact_id = ? AND organization_id = ? AND revision_seq > ? AND revision_seq <= ?
        ORDER BY revision_seq ASC`,
      [params.artifactId, params.organizationId, baseSeq, currentRevisionSeq]
    );

    const theirsByKey = new Map<string, TheirsWrite>();
    for (const row of intervening) {
      const payload = parsePayload(row.checkpoint_payload);
      const operations = (payload?.unsavedOperationStack ?? []).map((e) => e.operation);
      const rowWrites = latestWritePerCell(operations, {
        workingRevisionId: row.working_revision_id,
        revisionSeq: Number(row.revision_seq),
        editedBy: row.edited_by,
        editedAt: row.edited_at,
      });
      // Later (higher revision_seq) checkpoints win on the same cell —
      // `intervening` is ordered ASC, so a later iteration's set simply
      // overwrites an earlier one for the same key, which is correct
      // latest-write-wins semantics for "theirs" as a whole.
      for (const [key, write] of rowWrites) theirsByKey.set(key, write);
    }

    const mineOperations = params.myUnsavedOperationStack.map((e) => e.operation);
    const mineByKey = latestWritePerCell(mineOperations, {
      workingRevisionId: params.baseWorkingRevisionId,
      revisionSeq: baseSeq,
      editedBy: null,
      editedAt: '',
    });

    const conflicts: ConflictCandidate[] = [];
    for (const [key, mine] of mineByKey) {
      const theirs = theirsByKey.get(key);
      if (!theirs) continue; // no overlap on this cell -> not a conflict
      const bothResolvable = mine.value !== null && theirs.value !== null;
      conflicts.push({
        cellRef: theirs.cellRef,
        mine: mine.value,
        theirsWorkingRevisionId: theirs.workingRevisionId,
        theirsRevisionSeq: theirs.revisionSeq,
        theirs: theirs.value,
        theirsEditedBy: theirs.editedBy,
        theirsEditedAt: theirs.editedAt,
        resolutionOptions: bothResolvable ? ['MINE', 'THEIRS', 'MERGE_PER_CELL'] : ['MINE', 'THEIRS'],
      });
    }

    return {
      ok: true,
      result: {
        hasConflicts: conflicts.length > 0,
        baseWorkingRevisionId: params.baseWorkingRevisionId,
        currentWorkingRevisionId: current.working_revision_id,
        currentRevisionSeq,
        conflicts,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Resolution — turns the USER'S explicit per-cell choices (never inferred)
// into one `paste` Operation the caller submits through the normal executor.
// ---------------------------------------------------------------------------

export interface ConflictResolutionChoice {
  cellRef: CellRef;
  choice: ConflictResolutionChoiceKind;
  /** Required iff `choice === 'MERGE_PER_CELL'` — the analyst's own merged value, this module never computes one itself. */
  mergedValue?: FinanceValueInput;
}

export type BuildResolvedOperationResult =
  | { ok: true; operation: Operation }
  | { ok: false; code: 'NO_CHOICES' | 'MISSING_MERGED_VALUE' | 'UNRESOLVABLE_CHOICE'; message: string };

export interface ResolutionMintParams {
  operationId: string;
  idempotencyKey: string;
  actorId: string;
  actorRole: FinanceRole;
  clientTimestamp: string;
  /** Always the artifact's CURRENT working_revision_id at resolution time (i.e. `ConflictDetectionResult.currentWorkingRevisionId`) — the resolved paste is composed against the post-conflict state, not the stale base. */
  sourceWorkingRevisionId: string | null;
}

/**
 * Builds the single `paste` Operation that applies the user's resolution
 * choices. `MINE`/`THEIRS` read the value straight from the corresponding
 * `ConflictCandidate`; `MERGE_PER_CELL` requires the caller to have already
 * asked the user for the merged value and supplied it in `mergedValue` — this
 * function refuses (does not guess) if that is missing.
 */
export function buildResolvedOperation(
  conflicts: readonly ConflictCandidate[],
  choices: readonly ConflictResolutionChoice[],
  mint: ResolutionMintParams
): BuildResolvedOperationResult {
  if (choices.length === 0) return { ok: false, code: 'NO_CHOICES', message: 'No resolution choices supplied' };

  const conflictByKey = new Map(conflicts.map((c) => [cellRefKey(c.cellRef), c]));
  const targets: CellRef[] = [];
  const values: FinanceValueInput[] = [];

  for (const choice of choices) {
    const candidate = conflictByKey.get(cellRefKey(choice.cellRef));
    if (choice.choice === 'MERGE_PER_CELL') {
      if (!choice.mergedValue) {
        return {
          ok: false,
          code: 'MISSING_MERGED_VALUE',
          message: `MERGE_PER_CELL choice for a cell requires mergedValue`,
        };
      }
      targets.push(choice.cellRef);
      values.push(choice.mergedValue);
      continue;
    }
    const resolvedValue = choice.choice === 'MINE' ? candidate?.mine : candidate?.theirs;
    if (!resolvedValue) {
      return {
        ok: false,
        code: 'UNRESOLVABLE_CHOICE',
        message: `Choice ${choice.choice} for a cell has no resolvable value (candidate side was null, e.g. a pending 'reset')`,
      };
    }
    targets.push(choice.cellRef);
    values.push(resolvedValue);
  }

  return {
    ok: true,
    operation: {
      type: 'paste',
      operationId: mint.operationId,
      idempotencyKey: mint.idempotencyKey,
      actorId: mint.actorId,
      actorRole: mint.actorRole,
      clientTimestamp: mint.clientTimestamp,
      sourceWorkingRevisionId: mint.sourceWorkingRevisionId,
      target: targets,
      values,
    },
  };
}
