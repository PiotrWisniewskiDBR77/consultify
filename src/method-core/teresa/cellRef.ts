/**
 * Matrix cell reference for a Teresa preview (S4, 2026-08-13).
 *
 * Requirement 7 of CEL 5: a preview must point at the exact matrix cell
 * (`unitId#level`) it would change, not just name a capability. Neither
 * `TeresaIntent` nor `TeresaProposedChange` carries a ready-made
 * `"unitId#level"` string — this derives one from whichever field actually
 * carries the level for a given preview shape:
 *   1. `intent.unitId` + `intent.level` when the capability itself was
 *      invoked against an explicit level (e.g. `challenge_coverage_and_scale`,
 *      `draft_score_proposal`).
 *   2. a `score_proposal` proposed change's numeric `after` value, which IS
 *      the level being proposed, when `intent.level` was not set.
 * Anything else (a capability with no unit/level in play, e.g.
 * `cluster_findings`) legitimately has no single cell to point at —
 * `resolveTeresaCellRef` returns `null` rather than guessing.
 */
import type { TeresaPreview } from '@/method-core/contracts';

export interface TeresaCellRef {
  readonly unitId: string;
  readonly level: number;
}

export function resolveTeresaCellRef(preview: TeresaPreview): TeresaCellRef | null {
  const { intent, proposedChanges } = preview;

  if (intent.unitId && typeof intent.level === 'number') {
    return { unitId: intent.unitId, level: intent.level };
  }

  const scoreChange = proposedChanges.find(
    (c) => c.target === 'score_proposal' && typeof c.after === 'number'
  );
  if (scoreChange) {
    const unitId = intent.unitId ?? (typeof scoreChange.targetId === 'string' ? scoreChange.targetId : null);
    if (unitId) {
      return { unitId, level: scoreChange.after as number };
    }
  }

  return null;
}

export function formatCellRef(ref: TeresaCellRef): string {
  return `${ref.unitId}#${ref.level}`;
}

/** Convenience: `null` when there is nothing to show, formatted string otherwise. */
export function formatPreviewCellRef(preview: TeresaPreview): string | null {
  const ref = resolveTeresaCellRef(preview);
  return ref ? formatCellRef(ref) : null;
}
