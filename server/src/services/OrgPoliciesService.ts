/**
 * V4-ENT-04: Org policies service (retention, legal hold, residency)
 * Enforces org_policies before delete/export operations.
 */
import * as queryHelpers from '../utils/queryHelpers.js';
import logger from '../utils/Logger.js';

export class OrgPoliciesError extends Error {
  constructor(
    message: string,
    public code: 'LEGAL_HOLD' | 'POLICY_VIOLATION'
  ) {
    super(message);
    this.name = 'OrgPoliciesError';
  }
}

export async function hasLegalHold(organizationId: string): Promise<boolean> {
  if (!organizationId) return false;
  try {
    const row = await queryHelpers.queryOne<{ legal_hold_enabled: number }>(
      `SELECT legal_hold_enabled FROM org_policies WHERE organization_id = ?`,
      [organizationId]
    );
    return (row?.legal_hold_enabled ?? 0) === 1;
  } catch (e: any) {
    const msg = String(e?.message || e || '').toLowerCase();
    if (msg.includes('no such table') || msg.includes('does not exist')) {
      return false;
    }
    logger.warn('[OrgPolicies] Error checking legal hold:', e);
    return false;
  }
}

/**
 * Throws OrgPoliciesError if org has legal hold and operation should be blocked.
 */
export async function requireNoLegalHold(organizationId: string, operation: string): Promise<void> {
  const hold = await hasLegalHold(organizationId);
  if (hold) {
    throw new OrgPoliciesError(
      `Operation blocked: organization has legal hold. ${operation} is not allowed while legal hold is active.`,
      'LEGAL_HOLD'
    );
  }
}

export default {
  hasLegalHold,
  requireNoLegalHold,
};
