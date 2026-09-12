/**
 * V4-ENT-04: Org policies service (retention, legal hold, residency)
 * Enforces org_policies before delete/export operations.
 */
import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

import { acquirePgClient } from '../database/PostgresDatabase.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

export class OrgPoliciesError extends Error {
  constructor(
    message: string,
    public code: 'LEGAL_HOLD' | 'POLICY_VIOLATION' | 'POLICY_READ_FAILED',
    public statusCode: number = code === 'LEGAL_HOLD' ? 423 : 503
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
    logger.error('[OrgPolicies] Error checking legal hold; denying operation', e);
    throw new OrgPoliciesError('Organization policy could not be verified.', 'POLICY_READ_FAILED');
  }
}

export async function lockOrganizationPolicy(client: PoolClient, organizationId: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [organizationId]);
}

export async function requireNoLegalHoldInTransaction(
  client: PoolClient,
  organizationId: string,
  operation: string
): Promise<void> {
  try {
    const table = await client.query<{ table_name: string | null }>(
      `SELECT to_regclass('public.org_policies')::text AS table_name`
    );
    if (!table.rows[0]?.table_name) return;
    const policy = await client.query<{ legal_hold_enabled: number }>(
      'SELECT legal_hold_enabled FROM org_policies WHERE organization_id = $1 FOR SHARE',
      [organizationId]
    );
    if ((policy.rows[0]?.legal_hold_enabled ?? 0) === 1) {
      throw new OrgPoliciesError(
        `Operation blocked: organization has legal hold. ${operation} is not allowed while legal hold is active.`,
        'LEGAL_HOLD'
      );
    }
  } catch (error) {
    if (error instanceof OrgPoliciesError) throw error;
    logger.error('[OrgPolicies] Transactional policy read failed; denying operation', error);
    throw new OrgPoliciesError('Organization policy could not be verified.', 'POLICY_READ_FAILED');
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
  patch: {
    retentionDays?: number | null;
    legalHoldEnabled?: boolean;
    residencyRegion?: string | null;
  }
): Promise<OrgPolicyRow> {
  const now = new Date().toISOString();
  const client = await acquirePgClient();
  try {
    await client.query('BEGIN');
    await lockOrganizationPolicy(client, organizationId);
    const existingResult = await client.query<OrgPolicyRow>(
      'SELECT * FROM org_policies WHERE organization_id = $1 FOR UPDATE',
      [organizationId]
    );
    const existing = existingResult.rows[0] || null;
    let result: OrgPolicyRow;
    if (existing) {
    const retentionDays =
      patch.retentionDays !== undefined ? patch.retentionDays : existing.retention_days;
    const legalHoldEnabled =
      patch.legalHoldEnabled !== undefined
        ? patch.legalHoldEnabled
          ? 1
          : 0
        : existing.legal_hold_enabled;
    const residencyRegion =
      patch.residencyRegion !== undefined ? patch.residencyRegion : existing.residency_region;

      const updated = await client.query<OrgPolicyRow>(
        `UPDATE org_policies SET retention_days = $1, legal_hold_enabled = $2, residency_region = $3, updated_at = $4 WHERE organization_id = $5 RETURNING *`,
        [retentionDays, legalHoldEnabled, residencyRegion, now, organizationId]
      );
      result = updated.rows[0]!;
    } else {
      const inserted = await client.query<OrgPolicyRow>(
        `INSERT INTO org_policies (id, organization_id, retention_days, legal_hold_enabled, residency_region, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          `op-${uuidv4()}`,
          organizationId,
          patch.retentionDays ?? null,
          patch.legalHoldEnabled ? 1 : 0,
          patch.residencyRegion ?? null,
          now,
          now,
        ]
      );
      result = inserted.rows[0]!;
    }
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export default {
  hasLegalHold,
  requireNoLegalHold,
  requireNoLegalHoldInTransaction,
  lockOrganizationPolicy,
  getOrgPolicy,
  getAllOrgPolicies,
  upsertOrgPolicy,
};
