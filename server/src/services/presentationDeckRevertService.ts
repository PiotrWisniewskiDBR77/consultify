/**
 * Presentation Deck Revert Service
 *
 * Pure logic helpers for evaluating whether a previously-applied AI proposal
 * can be reverted. The actual DB mutation lives in the routes layer; this
 * service only encodes the eligibility rules so they can be unit-tested.
 */

export type RevertEligibilityReason =
  | 'operation_not_found'
  | 'operation_not_applied'
  | 'operation_org_mismatch'
  | 'no_snapshot'
  | 'deck_not_found'
  | 'newer_operation_exists';

export interface RevertEligibility {
  eligible: boolean;
  reason?: RevertEligibilityReason;
}

export interface RevertSnapshotInput {
  operation: {
    id: string;
    deckId: string;
    organizationId: string;
    status: string;
    originalDeckJson: unknown;
    versionBefore: number | null;
    createdAt: string | null;
  };
  deck: {
    id: string;
    organizationId: string;
  };
  requestOrgId: string;
  newerAppliedOperationsCount: number;
}

const APPLIED_STATUSES = new Set(['applied', 'accepted']);

function hasSnapshot(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object') return true;
  return false;
}

export function evaluateRevertEligibility(input: RevertSnapshotInput): RevertEligibility {
  const { operation, deck, requestOrgId, newerAppliedOperationsCount } = input;

  if (operation.organizationId !== requestOrgId) {
    return { eligible: false, reason: 'operation_org_mismatch' };
  }
  if (!APPLIED_STATUSES.has(operation.status)) {
    return { eligible: false, reason: 'operation_not_applied' };
  }
  if (operation.deckId !== deck.id) {
    return { eligible: false, reason: 'deck_not_found' };
  }
  if (!hasSnapshot(operation.originalDeckJson)) {
    return { eligible: false, reason: 'no_snapshot' };
  }
  if (newerAppliedOperationsCount > 0) {
    return { eligible: false, reason: 'newer_operation_exists' };
  }
  return { eligible: true };
}
