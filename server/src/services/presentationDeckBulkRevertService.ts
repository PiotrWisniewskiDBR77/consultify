/**
 * Presentation Deck Bulk Revert Service
 *
 * Pure logic helpers for evaluating whether a contiguous tail of previously
 * applied AI proposals can be bulk-reverted to a single base snapshot. The
 * actual DB mutation lives in the routes layer; this service only encodes
 * the eligibility rules so they can be unit-tested.
 *
 * "Consecutive tail revert" model: callers may only bulk-revert N consecutive
 * newest applied operations. Skipping an applied op in the middle is refused
 * to avoid corrupting deck history.
 */

export interface BulkRevertOpRow {
  id: string;
  deckId: string;
  organizationId: string;
  status: string;
  originalDeckJson: unknown;
  versionBefore: number | null;
  versionAfter: number | null;
  createdAt: string;
}

export type BulkRevertRejectReason = 'not_found' | 'org_mismatch' | 'deck_mismatch' | 'duplicate';

export interface BulkRevertRejection {
  operationId: string;
  reason: BulkRevertRejectReason;
}

export interface BulkRevertEvaluation {
  /** Sorted DESC by createdAt — newest first. */
  ordered: BulkRevertOpRow[];
  rejected: BulkRevertRejection[];
  /** The OLDEST selected op = the snapshot we revert to (END of ordered array). */
  baseSnapshot: BulkRevertOpRow | null;
}

const APPLIED_STATUSES = new Set(['applied', 'accepted']);

function hasSnapshot(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object') return true;
  return false;
}

function compareCreatedAtDesc(a: BulkRevertOpRow, b: BulkRevertOpRow): number {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  const aValid = Number.isFinite(ta);
  const bValid = Number.isFinite(tb);
  if (aValid && bValid && ta !== tb) return tb - ta;
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? 1 : -1;
  }
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

export function planBulkRevert(input: {
  requestedIds: string[];
  rows: BulkRevertOpRow[];
  deckId: string;
  organizationId: string;
}): BulkRevertEvaluation {
  const { requestedIds, rows, deckId, organizationId } = input;

  const rowsById = new Map<string, BulkRevertOpRow>();
  for (const row of rows) {
    if (row && typeof row.id === 'string') {
      rowsById.set(row.id, row);
    }
  }

  const seen = new Set<string>();
  const kept: BulkRevertOpRow[] = [];
  const rejected: BulkRevertRejection[] = [];

  for (const rawId of requestedIds) {
    const id = typeof rawId === 'string' ? rawId : '';
    if (!id) continue;
    if (seen.has(id)) {
      rejected.push({ operationId: id, reason: 'duplicate' });
      continue;
    }
    seen.add(id);

    const row = rowsById.get(id);
    if (!row) {
      rejected.push({ operationId: id, reason: 'not_found' });
      continue;
    }
    if (row.organizationId !== organizationId) {
      rejected.push({ operationId: id, reason: 'org_mismatch' });
      continue;
    }
    if (row.deckId !== deckId) {
      rejected.push({ operationId: id, reason: 'deck_mismatch' });
      continue;
    }
    kept.push(row);
  }

  const ordered = [...kept].sort(compareCreatedAtDesc);
  const baseSnapshot = ordered.length > 0 ? ordered[ordered.length - 1] : null;

  return { ordered, rejected, baseSnapshot };
}

export interface BulkRevertEligibilityResult {
  eligible: boolean;
  /** Collected reasons; empty when eligible. */
  reasons: string[];
  baseSnapshotId: string | null;
}

export function evaluateBulkRevertEligibility(input: {
  ordered: BulkRevertOpRow[];
  /**
   * Number of applied/accepted ops on the deck whose createdAt >= baseSnapshot.createdAt
   * (i.e. baseSnapshot itself plus everything newer). Caller computes this from the
   * database. If this exceeds `ordered.length` we know an applied op outside the
   * selection sits between the oldest selected op and HEAD.
   */
  newerAppliedAfterOldestCount: number;
}): BulkRevertEligibilityResult {
  const { ordered, newerAppliedAfterOldestCount } = input;
  const reasons: string[] = [];

  if (ordered.length === 0) {
    return { eligible: false, reasons: ['empty_selection'], baseSnapshotId: null };
  }

  for (const op of ordered) {
    if (!APPLIED_STATUSES.has(op.status)) {
      reasons.push(`op_${op.id}_not_applied`);
    }
  }

  const baseSnapshot = ordered[ordered.length - 1];
  if (!hasSnapshot(baseSnapshot.originalDeckJson)) {
    reasons.push(`op_${baseSnapshot.id}_no_snapshot`);
  }

  if (newerAppliedAfterOldestCount > ordered.length) {
    reasons.push('newer_op_outside_selection');
  }

  if (reasons.length > 0) {
    return { eligible: false, reasons, baseSnapshotId: baseSnapshot.id };
  }

  return { eligible: true, reasons: [], baseSnapshotId: baseSnapshot.id };
}
