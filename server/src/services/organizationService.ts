/**
 * Organization Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/organizationService.js (CommonJS) to TypeScript (ES Modules)
 *
 * Handles core organization logic:
 * - Member management (RBAC source of truth)
 * - Billing status & Token balance management
 * - Organization details
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { ORG_TYPES, TRIAL_DURATION_DAYS } from './access/AccessTypes.js';
import { DEMO_TRIAL_EVENT_TYPES, recordDemoTrialEvent } from './demoTrialTelemetryService.js';

// ==========================================
// TYPES
// ==========================================

export const ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  GUEST: 'GUEST',
  CONSULTANT: 'CONSULTANT',
} as const;

export type OrganizationRole = (typeof ROLES)[keyof typeof ROLES];

export function normalizeOrganizationRole(rawRole: string | null | undefined): OrganizationRole {
  const normalized = String(rawRole || '')
    .trim()
    .toUpperCase();

  switch (normalized) {
    case 'OWNER':
      return ROLES.OWNER;
    case 'ADMIN':
    case 'SUPERADMIN':
    case 'SUPER_ADMIN':
    case 'ADMINISTRATOR':
      return ROLES.ADMIN;
    case 'VIEWER':
    case 'GUEST':
      return ROLES.GUEST;
    case 'CONSULTANT':
      return ROLES.CONSULTANT;
    case 'USER':
    case 'MEMBER':
    default:
      return ROLES.MEMBER;
  }
}

interface CreateOrganizationParams {
  userId: string;
  name: string;
  email?: string;
  attribution?: { type: string; id: string } | null;
  attributionData?: Record<string, unknown> | null;
  industry?: string | null;
  domain?: string | null;
  vatNumber?: string | null;
}

interface CreateOrganizationResult {
  id: string;
  name: string;
  role: OrganizationRole;
}

interface Organization {
  id: string;
  name: string;
  status: string;
  billing_status: string;
  token_balance: number;
  created_at: string;
}

interface UpdateOrganizationParams {
  name?: string;
  industry?: string;
  domain?: string;
  vatNumber?: string;
  attributionData?: Record<string, unknown>;
  onboardingStatus?: string;
}

interface AddMemberParams {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  invitedBy?: string;
}

interface AddMemberResult {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}

interface Member {
  id: string;
  user_id: string;
  role: OrganizationRole;
  status: string;
  created_at: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface UserOrganization {
  id: string;
  name: string;
  billing_status: string;
  role: OrganizationRole;
}

interface AISettings {
  ai_assertiveness_level: string;
  ai_autonomy_level: string;
}

interface UpdateAISettingsParams {
  ai_assertiveness_level?: string;
  ai_autonomy_level?: string;
}

interface ActivateBillingResult {
  success: boolean;
  billingStatus: string;
  organizationType: string;
  tokensAdded: number;
}

interface UpdateMemberRoleParams {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}

interface UpdateMemberRoleResult {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}

interface RemoveMemberParams {
  organizationId: string;
  userId: string;
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();

/**
 * Set database instance (for testing)
 */
export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
  if (newDeps.db) {
    db = newDeps.db;
  }
}

/**
 * Create a new organization with an initial OWNER
 */
export async function createOrganization(
  params: CreateOrganizationParams
): Promise<CreateOrganizationResult> {
  const {
    userId,
    name,
    attribution = null,
    attributionData = null,
    industry = null,
    domain = null,
    vatNumber = null,
  } = params;
  const orgId = uuidv4();
  const now = new Date().toISOString();
  const trialExpiresAt = new Date(
    Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const attributionJson =
    attribution || attributionData
      ? JSON.stringify({
          ...(attributionData || {}),
          ...(attribution ? { referral: attribution } : {}),
        })
      : null;

  // Use transaction for atomic operations
  const memberId = uuidv4();
  const result = await DbPromise.transaction([
    {
      sql: `INSERT INTO organizations (
                id, name, status, billing_status, token_balance, created_by_user_id, created_at, is_active,
                ai_assertiveness_level, ai_autonomy_level, attribution_data, industry, domain, vat_number,
                organization_type, trial_started_at, trial_expires_at
            )
             VALUES (?, ?, 'active', 'TRIAL', 0, ?, ?, 1, 'MEDIUM', 'SUGGEST_ONLY', ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        orgId,
        name,
        userId,
        now,
        attributionJson,
        industry,
        domain,
        vatNumber,
        ORG_TYPES.TRIAL,
        now,
        trialExpiresAt,
      ],
    },
    {
      sql: `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
                 VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
      params: [memberId, orgId, userId, 'OWNER', now],
    },
  ]);

  if (!result.success) {
    throw new Error(result.error || 'Failed to create organization');
  }

  await recordDemoTrialEvent({
    eventType: DEMO_TRIAL_EVENT_TYPES.TRIAL_STARTED,
    organizationId: orgId,
    userId,
    source: attribution?.type || 'self_serve',
    metadata: {
      trialExpiresAt,
      trialDurationDays: TRIAL_DURATION_DAYS,
    },
  });

  return { id: orgId, name, role: 'OWNER' };
}

/**
 * Get organization details including billing and tokens
 */
export async function getOrganization(orgId: string): Promise<Organization> {
  const row = await DbPromise.get<Organization>(
    `SELECT id, name, status, billing_status, token_balance, created_at 
         FROM organizations WHERE id = ?`,
    [orgId]
  );

  if (!row) {
    throw new Error('Organization not found');
  }

  return row;
}

/**
 * Update organization profile fields (trial / onboarding)
 */
export async function updateOrganization(
  orgId: string,
  updates: UpdateOrganizationParams
): Promise<{ id: string }> {
  const set: string[] = [];
  const params: unknown[] = [];

  if (updates.name !== undefined) {
    set.push('name = ?');
    params.push(updates.name);
  }
  if (updates.industry !== undefined) {
    set.push('industry = ?');
    params.push(updates.industry);
  }
  if (updates.domain !== undefined) {
    set.push('domain = ?');
    params.push(updates.domain);
  }
  if (updates.vatNumber !== undefined) {
    set.push('vat_number = ?');
    params.push(updates.vatNumber);
  }
  if (updates.onboardingStatus !== undefined) {
    set.push('onboarding_status = ?');
    params.push(updates.onboardingStatus);
  }
  if (updates.attributionData !== undefined) {
    set.push('attribution_data = ?');
    params.push(JSON.stringify(updates.attributionData || {}));
  }

  if (set.length === 0) {
    return { id: orgId };
  }

  set.push('updated_at = CURRENT_TIMESTAMP');
  params.push(orgId);

  const result = await DbPromise.run(
    db,
    `UPDATE organizations SET ${set.join(', ')} WHERE id = ?`,
    params,
    { fallback: false }
  );

  if ((result.changes || 0) === 0) {
    throw new Error('Organization not found');
  }

  return { id: orgId };
}

/**
 * Add a member to the organization
 */
export async function addMember(params: AddMemberParams): Promise<AddMemberResult> {
  const { organizationId, userId, invitedBy } = params;
  const role = normalizeOrganizationRole(params.role);

  if (!Object.values(ROLES).includes(role)) {
    throw new Error('Invalid role');
  }

  const id = uuidv4();

  try {
    const _result = await DbPromise.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, invited_by_user_id)
             VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
      [id, organizationId, userId, role, invitedBy || null],
      { fallback: false }
    );

    return { id, organizationId, userId, role };
  } catch (err: any) {
    const error = err as Error;
    // Check for unique constraint violation
    if (error.message.includes('UNIQUE constraint failed')) {
      throw new Error('User is already a member of this organization');
    }
    throw err;
  }
}

/**
 * Get members of an organization
 */
export async function getMembers(orgId: string): Promise<Member[]> {
  const rows = await DbPromise.all<Member>(
    db,
    `SELECT m.id, m.user_id, m.role, m.status, m.created_at, u.first_name, u.last_name, u.email
         FROM organization_members m
         JOIN users u ON m.user_id = u.id
         WHERE m.organization_id = ?`,
    [orgId]
  );

  return rows || [];
}

/**
 * Directory-safe tenant membership read used by the mounted Admin/IAM screen.
 * Revoked/inactive rows remain in the ledger for audit, but they are neither an
 * authorization edge nor part of the current member directory.
 */
export async function getActiveMembers(orgId: string): Promise<Member[]> {
  const rows = await DbPromise.all<Member>(
    db,
    `SELECT m.id, m.user_id, m.role, m.status, m.created_at, u.first_name, u.last_name, u.email
         FROM organization_members m
         JOIN users u ON m.user_id = u.id
         WHERE m.organization_id = ?
           AND UPPER(COALESCE(m.status, '')) = 'ACTIVE'`,
    [orgId]
  );

  return rows || [];
}

/**
 * Get organizations for a user
 */
export async function getUserOrganizations(userId: string): Promise<UserOrganization[]> {
  const rows = await DbPromise.all<UserOrganization>(
    db,
    `SELECT o.id, o.name, o.billing_status, m.role
         FROM organizations o
         JOIN organization_members m ON o.id = m.organization_id
         WHERE m.user_id = ?`,
    [userId]
  );

  return rows || [];
}

/**
 * Activate billing for an organization
 */
export async function activateBilling(orgId: string): Promise<ActivateBillingResult> {
  const INITIAL_TOKENS = 100000; // Configurable initial pack

  // Use transaction for atomic operations
  const result = await DbPromise.transaction([
    {
      sql: `UPDATE organizations 
                 SET billing_status = 'ACTIVE', 
                     organization_type = 'PAID',
                     status = 'active',
                     token_balance = IFNULL(token_balance, 0) + ? 
                 WHERE id = ?`,
      params: [INITIAL_TOKENS, orgId],
    },
    {
      sql: `INSERT OR REPLACE INTO organization_billing (organization_id, status, updated_at)
                 VALUES (?, 'ACTIVE', CURRENT_TIMESTAMP)`,
      params: [orgId],
    },
  ]);

  if (!result.success) {
    throw new Error(result.error || 'Failed to activate billing');
  }

  // Check if organization was updated
  if (result.results[0]?.changes === 0) {
    throw new Error('Organization not found');
  }

  // Log the event (post-commit)
  try {
    const { default: OrganizationEventService } = { default: {} } as any; // Stubbed missing service
    await OrganizationEventService.logEvent(orgId, 'BILLING_ACTIVATED', null, {
      initialTokens: INITIAL_TOKENS,
    });
  } catch (e: unknown) {
    // Event logging failed, but billing is active. Acceptable.
    logger.error('Post-billing activation error', e);
  }

  return {
    success: true,
    billingStatus: 'ACTIVE',
    organizationType: 'PAID',
    tokensAdded: INITIAL_TOKENS,
  };
}

/**
 * Update AI settings for an organization
 */
export async function updateAISettings(
  orgId: string,
  settings: UpdateAISettingsParams
): Promise<void> {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (settings.ai_assertiveness_level) {
    updates.push('ai_assertiveness_level = ?');
    params.push(settings.ai_assertiveness_level);
  }
  if (settings.ai_autonomy_level) {
    updates.push('ai_autonomy_level = ?');
    params.push(settings.ai_autonomy_level);
  }

  if (updates.length === 0) return;

  params.push(orgId);

  await DbPromise.run(db, `UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`, params);
}

/**
 * Get AI settings for an organization
 */
export async function getAISettings(orgId: string): Promise<AISettings> {
  const row = await DbPromise.get<AISettings>(
    db,
    `SELECT ai_assertiveness_level, ai_autonomy_level 
        FROM organizations WHERE id = ?`,
    [orgId]
  );

  return (
    row || {
      ai_assertiveness_level: 'MEDIUM',
      ai_autonomy_level: 'SUGGEST_ONLY',
    }
  );
}

/**
 * Remove a member from the organization
 */
export async function removeMember(params: RemoveMemberParams): Promise<void> {
  const { organizationId, userId } = params;

  const result = await DbPromise.run(
    db,
    `DELETE FROM organization_members 
         WHERE organization_id = ? AND user_id = ?`,
    [organizationId, userId]
  );

  if ((result.changes || 0) === 0) {
    throw new Error('Member not found');
  }
}

/**
 * Update a member's role in the organization
 */
export async function updateMemberRole(
  params: UpdateMemberRoleParams
): Promise<UpdateMemberRoleResult> {
  const { organizationId, userId } = params;
  const role = normalizeOrganizationRole(params.role);

  if (!Object.values(ROLES).includes(role)) {
    throw new Error('Invalid role');
  }

  const result = await DbPromise.run(
    db,
    `UPDATE organization_members 
         SET role = ? 
         WHERE organization_id = ? AND user_id = ?`,
    [role, organizationId, userId]
  );

  if ((result.changes || 0) === 0) {
    throw new Error('Member not found');
  }

  return { organizationId, userId, role };
}

/**
 * Get a member's role in the organization
 */
export async function getMemberRole(
  organizationId: string,
  userId: string
): Promise<OrganizationRole | null> {
  const row = await DbPromise.get<{ role: OrganizationRole }>(
    db,
    `SELECT role FROM organization_members 
         WHERE organization_id = ? AND user_id = ?`,
    [organizationId, userId]
  );

  return row ? row.role : null;
}

// Default export for backward compatibility
const OrganizationService = {
  ROLES,
  setDependencies,
  createOrganization,
  getOrganization,
  addMember,
  getMembers,
  getActiveMembers,
  getUserOrganizations,
  activateBilling,
  updateAISettings,
  getAISettings,
  removeMember,
  updateMemberRole,
  getMemberRole,
};

export default OrganizationService;
