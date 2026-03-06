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

export interface OrgPolicyRow {
  id: string;
  organization_id: string;
  retention_days: number | null;
  legal_hold_enabled: number;
  residency_region: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function getOrgPolicy(organizationId: string): Promise<OrgPolicyRow | null> {
  try {
    const row = await queryHelpers.queryOne<OrgPolicyRow>(
      `SELECT * FROM org_policies WHERE organization_id = ?`,
      [organizationId]
    );
    return row;
  } catch (e: any) {
    const msg = String(e?.message || e || '').toLowerCase();
    if (msg.includes('no such table') || msg.includes('does not exist')) return null;
    logger.warn('[OrgPolicies] getOrgPolicy error:', e);
    return null;
  }
}

export async function getAllOrgPolicies(): Promise<OrgPolicyRow[]> {
  try {
    const rows = await queryHelpers.queryAll<OrgPolicyRow>(`SELECT * FROM org_policies`);
    return rows || [];
  } catch (e: any) {
    const msg = String(e?.message || e || '').toLowerCase();
    if (msg.includes('no such table') || msg.includes('does not exist')) return [];
    logger.warn('[OrgPolicies] getAllOrgPolicies error:', e);
    return [];
  }
}

export async function upsertOrgPolicy(
  organizationId: string,
  patch: { retentionDays?: number | null; legalHoldEnabled?: boolean; residencyRegion?: string | null }
): Promise<OrgPolicyRow> {
  const { v4: uuidv4 } = await import('uuid');
  const now = new Date().toISOString();

  const existing = await getOrgPolicy(organizationId);
  if (existing) {
    const retentionDays = patch.retentionDays !== undefined ? patch.retentionDays : existing.retention_days;
    const legalHoldEnabled =
      patch.legalHoldEnabled !== undefined ? (patch.legalHoldEnabled ? 1 : 0) : existing.legal_hold_enabled;
    const residencyRegion =
      patch.residencyRegion !== undefined ? patch.residencyRegion : existing.residency_region;

    await queryHelpers.queryRun(
      `UPDATE org_policies SET retention_days = ?, legal_hold_enabled = ?, residency_region = ?, updated_at = ? WHERE organization_id = ?`,
      [retentionDays, legalHoldEnabled, residencyRegion, now, organizationId]
    );
    return (await getOrgPolicy(organizationId))!;
  } else {
    const id = `op-${uuidv4()}`;
    await queryHelpers.queryRun(
      `INSERT INTO org_policies (id, organization_id, retention_days, legal_hold_enabled, residency_region, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        organizationId,
        patch.retentionDays ?? null,
        patch.legalHoldEnabled ? 1 : 0,
        patch.residencyRegion ?? null,
        now,
        now,
      ]
    );
    return (await getOrgPolicy(organizationId))!;
  }
}

export default {
  hasLegalHold,
  requireNoLegalHold,
  getOrgPolicy,
  getAllOrgPolicies,
  upsertOrgPolicy,
};
