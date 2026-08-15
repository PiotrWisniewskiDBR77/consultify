/**
 * SCMS Permission Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/permissionService.js (CommonJS) to TypeScript (ES Modules)
 * Step 14: Enhanced with database-backed PBAC (Permission-Based Access Control)
 *
 * Maintains backward compatibility with existing role-based checks while
 * adding granular database-backed permission management.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export const ROLES = {
  SUPERADMIN: 'SUPERADMIN',
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  TEAM_MEMBER: 'TEAM_MEMBER',
  VIEWER: 'VIEWER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Legacy capability constants (for backward compatibility)
export const CAPABILITIES = {
  MANAGE_USERS: 'manage_users',
  MANAGE_ROLES: 'manage_roles',
  MANAGE_BILLING: 'manage_billing',
  MANAGE_ORG_SETTINGS: 'manage_org_settings',
  MANAGE_AI_POLICY: 'manage_ai_policy',
  CREATE_PROJECT: 'create_project',
  EDIT_PROJECT_SETTINGS: 'edit_project_settings',
  MANAGE_PROJECT_ROLES: 'manage_project_roles',
  MANAGE_WORKSTREAMS: 'manage_workstreams',
  APPROVE_CHANGES: 'approve_changes',
  MANAGE_STAGE_GATES: 'manage_stage_gates',
  VIEW_AUDIT_LOG: 'view_audit_log',
  CREATE_INITIATIVE: 'create_initiative',
  EDIT_INITIATIVE: 'edit_initiative',
  MANAGE_ROADMAP: 'manage_roadmap',
  ASSIGN_TASKS: 'assign_tasks',
  UPDATE_TASK_STATUS: 'update_task_status',
  MANAGE_RISKS: 'manage_risks',
  AI_EXECUTE_ACTIONS: 'ai_execute_actions',
  AI_VIEW_INSIGHTS: 'ai_view_insights',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

// Legacy capability matrix (for backward compatibility)
export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  [ROLES.SUPERADMIN]: Object.values(CAPABILITIES) as Capability[],
  [ROLES.OWNER]: Object.values(CAPABILITIES) as Capability[],
  [ROLES.ADMIN]: Object.values(CAPABILITIES) as Capability[],
  [ROLES.PROJECT_MANAGER]: [
    CAPABILITIES.EDIT_PROJECT_SETTINGS,
    CAPABILITIES.MANAGE_PROJECT_ROLES,
    CAPABILITIES.MANAGE_WORKSTREAMS,
    CAPABILITIES.APPROVE_CHANGES,
    CAPABILITIES.MANAGE_STAGE_GATES,
    CAPABILITIES.VIEW_AUDIT_LOG,
    CAPABILITIES.CREATE_INITIATIVE,
    CAPABILITIES.EDIT_INITIATIVE,
    CAPABILITIES.MANAGE_ROADMAP,
    CAPABILITIES.ASSIGN_TASKS,
    CAPABILITIES.UPDATE_TASK_STATUS,
    CAPABILITIES.MANAGE_RISKS,
    CAPABILITIES.AI_VIEW_INSIGHTS,
  ],
  [ROLES.TEAM_MEMBER]: [CAPABILITIES.UPDATE_TASK_STATUS, CAPABILITIES.AI_VIEW_INSIGHTS],
  [ROLES.VIEWER]: [CAPABILITIES.AI_VIEW_INSIGHTS],
};

interface User {
  role?: Role;
  [key: string]: unknown;
}

interface PermissionContext {
  [key: string]: unknown;
}

interface OverrideRow {
  grant_type: 'GRANT' | 'REVOKE';
}

interface RolePermissionRow {
  permission_key: string;
}

interface PermissionRow {
  key: string;
  description: string;
  category: string;
}

interface RolePermissionMappingRow {
  role: string;
  permission_key: string;
  description: string;
  category: string;
}

interface UserPermissionsResult {
  rolePermissions: string[];
  overrides: {
    granted: string[];
    revoked: string[];
  };
  effective: string[];
}

interface GrantPermissionResult {
  success: boolean;
  id: string;
  userId: string;
  organizationId: string;
  permissionKey: string;
  grantType: 'GRANT';
  grantedBy: string;
}

interface RevokePermissionResult {
  success: boolean;
  id: string;
  userId: string;
  organizationId: string;
  permissionKey: string;
  grantType: 'REVOKE';
  revokedBy: string;
}

interface RemoveOverrideResult {
  removed: boolean;
  userId: string;
  organizationId: string;
  permissionKey: string;
}

interface ContentPermissionRow {
  id: string;
  content_id: string;
  content_type: string;
  user_id: string;
  permission_key: string;
  grant_type: 'GRANT' | 'REVOKE';
  granted_by: string;
  created_at: string;
  expires_at?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface GrantContentPermissionParams {
  contentId: string;
  contentType: string;
  userId: string;
  permissionKey: string;
  grantedBy: string;
  expiresAt?: string | null;
}

interface RevokeContentPermissionParams {
  contentId: string;
  contentType: string;
  userId: string;
  permissionKey: string;
  revokedBy: string;
}

interface GrantContentPermissionResult {
  success: boolean;
  id: string;
  contentId: string;
  contentType: string;
  userId: string;
  permissionKey: string;
  grantType: 'GRANT';
  grantedBy: string;
  expiresAt?: string | null;
}

interface RevokeContentPermissionResult {
  success: boolean;
  id: string;
  contentId: string;
  contentType: string;
  userId: string;
  permissionKey: string;
  grantType: 'REVOKE';
  revokedBy: string;
}

interface RemoveContentPermissionResult {
  removed: boolean;
  contentId: string;
  contentType: string;
  userId: string;
  permissionKey: string;
}

interface ValidateContentActionParams {
  userId: string;
  orgId: string;
  userRole: Role;
  contentId?: string;
  contentType: string;
  action: string;
}

interface ValidateContentActionResult {
  allowed: boolean;
  reason?: string;
}

// Content permission keys
export const CONTENT_PERMISSIONS = {
  // Email Templates
  EMAIL_TEMPLATE_VIEW: 'EMAIL_TEMPLATE_VIEW',
  EMAIL_TEMPLATE_CREATE: 'EMAIL_TEMPLATE_CREATE',
  EMAIL_TEMPLATE_EDIT: 'EMAIL_TEMPLATE_EDIT',
  EMAIL_TEMPLATE_DELETE: 'EMAIL_TEMPLATE_DELETE',
  EMAIL_TEMPLATE_PUBLISH: 'EMAIL_TEMPLATE_PUBLISH',
  EMAIL_TEMPLATE_DEPRECATE: 'EMAIL_TEMPLATE_DEPRECATE',
  EMAIL_TEMPLATE_CLONE: 'EMAIL_TEMPLATE_CLONE',
  EMAIL_TEMPLATE_PREVIEW: 'EMAIL_TEMPLATE_PREVIEW',
  EMAIL_TEMPLATE_TEST_SEND: 'EMAIL_TEMPLATE_TEST_SEND',
  EMAIL_TEMPLATE_RESTORE: 'EMAIL_TEMPLATE_RESTORE',
  EMAIL_TEMPLATE_ANALYTICS: 'EMAIL_TEMPLATE_ANALYTICS',

  // Playbook Templates
  PLAYBOOK_TEMPLATE_VIEW: 'PLAYBOOK_TEMPLATE_VIEW',
  PLAYBOOK_TEMPLATE_CREATE: 'PLAYBOOK_TEMPLATE_CREATE',
  PLAYBOOK_TEMPLATE_EDIT: 'PLAYBOOK_TEMPLATE_EDIT',
  PLAYBOOK_TEMPLATE_DELETE: 'PLAYBOOK_TEMPLATE_DELETE',
  PLAYBOOK_TEMPLATE_PUBLISH: 'PLAYBOOK_TEMPLATE_PUBLISH',
  PLAYBOOK_TEMPLATE_DEPRECATE: 'PLAYBOOK_TEMPLATE_DEPRECATE',
  PLAYBOOK_TEMPLATE_CLONE: 'PLAYBOOK_TEMPLATE_CLONE',
  PLAYBOOK_TEMPLATE_RESTORE: 'PLAYBOOK_TEMPLATE_RESTORE',
  PLAYBOOK_TEMPLATE_ANALYTICS: 'PLAYBOOK_TEMPLATE_ANALYTICS',

  // Content Management
  CONTENT_CATEGORY_VIEW: 'CONTENT_CATEGORY_VIEW',
  CONTENT_CATEGORY_CREATE: 'CONTENT_CATEGORY_CREATE',
  CONTENT_CATEGORY_EDIT: 'CONTENT_CATEGORY_EDIT',
  CONTENT_CATEGORY_DELETE: 'CONTENT_CATEGORY_DELETE',
  CONTENT_TAG_VIEW: 'CONTENT_TAG_VIEW',
  CONTENT_TAG_CREATE: 'CONTENT_TAG_CREATE',
  CONTENT_TAG_EDIT: 'CONTENT_TAG_EDIT',
  CONTENT_TAG_DELETE: 'CONTENT_TAG_DELETE',
  CONTENT_COMMENT_CREATE: 'CONTENT_COMMENT_CREATE',
  CONTENT_COMMENT_EDIT: 'CONTENT_COMMENT_EDIT',
  CONTENT_COMMENT_DELETE: 'CONTENT_COMMENT_DELETE',
  CONTENT_COMMENT_RESOLVE: 'CONTENT_COMMENT_RESOLVE',
  CONTENT_REVIEW_REQUEST: 'CONTENT_REVIEW_REQUEST',
  CONTENT_REVIEW_APPROVE: 'CONTENT_REVIEW_APPROVE',
  CONTENT_REVIEW_REJECT: 'CONTENT_REVIEW_REJECT',
  CONTENT_FAVORITE_ADD: 'CONTENT_FAVORITE_ADD',
  CONTENT_SEARCH: 'CONTENT_SEARCH',
  CONTENT_BULK_ACTIONS: 'CONTENT_BULK_ACTIONS',
  CONTENT_ANALYTICS_VIEW: 'CONTENT_ANALYTICS_VIEW',
} as const;

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
 * Legacy: Check if a user has a capability (role-based)
 * Maintained for backward compatibility
 */
export function can(
  user: User | null | undefined,
  capability: Capability,
  _context: PermissionContext = {}
): boolean {
  if (!user || !user.role) return false;
  if (user.role === ROLES.SUPERADMIN) return true;

  const allowedCaps = ROLE_CAPABILITIES[user.role as Role] || [];
  if (!allowedCaps.includes(capability)) return false;

  if (capability === CAPABILITIES.MANAGE_USERS || capability === CAPABILITIES.MANAGE_ORG_SETTINGS) {
    if (user.role !== ROLES.ADMIN) return false;
  }

  return true;
}

/**
 * Legacy: Get list of capabilities for a role
 */
export function getCapabilitiesForRole(role: Role): Capability[] {
  return ROLE_CAPABILITIES[role] || [];
}

/**
 * Check if a user has a specific permission (DB-backed PBAC)
 */
export async function hasPermission(
  userId: string,
  orgId: string,
  permissionKey: string,
  userRole: Role
): Promise<boolean> {
  if (!userId || !permissionKey) return false;

  // SUPERADMIN and OWNER bypass
  if (userRole === ROLES.SUPERADMIN || userRole === ROLES.OWNER) return true;

  // Fallback role→permission mapping for environments where DB role_permissions
  // aren't migrated/seeded yet. Intentionally narrow — only permissions that are
  // safe to grant by role without a per-org seed (Interview module + rollout).
  const FALLBACK_ROLE_PERMISSIONS: Record<string, string[]> = {
    [ROLES.SUPERADMIN]: ['*'],
    [ROLES.OWNER]: ['*'],
    [ROLES.ADMIN]: [
      'INTERVIEW_TEMPLATE_VIEW',
      'INTERVIEW_TEMPLATE_USE',
      'INTERVIEW_TEMPLATE_MANAGE',
      'INTERVIEW_ASSIGN_VIEW',
      'INTERVIEW_ASSIGN_MANAGE',
      'INTERVIEW_REMIND',
      // Insights suite — org admins fully manage interview insights.
      'INTERVIEW_INSIGHTS_VIEW',
      'INTERVIEW_INSIGHTS_CREATE',
      'INTERVIEW_INSIGHTS_REVIEW',
      'INTERVIEW_INSIGHTS_PUBLISH',
      'INTERVIEW_INSIGHTS_HANDOFF',
      // M14 Wdrożenie — manage rollout registers (admins keep prior access).
      'MANAGE_ROLLOUT',
      'INITIATIVE_CANDIDATE_MANAGE',
    ],
    [ROLES.PROJECT_MANAGER]: [
      'INTERVIEW_TEMPLATE_VIEW',
      'INTERVIEW_TEMPLATE_USE',
      'INTERVIEW_ASSIGN_VIEW',
      'INTERVIEW_ASSIGN_MANAGE',
      'INTERVIEW_REMIND',
      // PMs run analyses on their projects' interviews.
      'INTERVIEW_INSIGHTS_VIEW',
      'INTERVIEW_INSIGHTS_CREATE',
      // M14 Wdrożenie — PMO/manager tier owns rollout execution.
      'MANAGE_ROLLOUT',
      'INITIATIVE_CANDIDATE_MANAGE',
    ],
    [ROLES.TEAM_MEMBER]: [],
    [ROLES.VIEWER]: [],
  };
  const allowFallbackPermission = (key: string): boolean => {
    const allowed = FALLBACK_ROLE_PERMISSIONS[userRole] || [];
    return allowed.includes('*') || allowed.includes(key);
  };

  try {
    // First check for explicit org-user override.
    // FIX (T6, rejestr fail-open audit): DbPromise.get() defaults to
    // `fallback: true`, which SWALLOWS db errors and resolves `null` instead of
    // rejecting — indistinguishable from "no row found". Without `fallback: false`
    // here, a genuine internal DB error (connection reset, timeout, transient
    // failure — anything that is NOT a missing-table error) would silently fall
    // through to `allowFallbackPermission()` below instead of reaching the
    // catch-block discrimination at the bottom of this function, granting the
    // narrow role-fallback permissions (e.g. ADMIN+INTERVIEW_ASSIGN_MANAGE) on
    // an unrelated internal error. `fallback: false` makes real errors reject,
    // so they land in the catch block, which correctly denies unless the error
    // specifically looks like a missing-table/migration-not-applied condition.
    const override = await DbPromise.get<OverrideRow>(
      db,
      `SELECT grant_type FROM org_user_permissions
             WHERE user_id = ? AND organization_id = ? AND permission_key = ?`,
      [userId, orgId, permissionKey],
      { fallback: false }
    );

    // If explicit override exists, use it
    if (override) {
      return override.grant_type === 'GRANT';
    }

    // Fall back to role-based permission from builtin_role_permissions table
    // (PostgreSQL deployments may have role_permissions with role_id/permission_id schema instead of role/permission_key)
    const rolePermission = await DbPromise.get<{ '1'?: number }>(
      db,
      `SELECT 1 FROM builtin_role_permissions
             WHERE role = ? AND permission_key = ?`,
      [userRole, permissionKey],
      { fallback: false }
    );

    if (rolePermission) return true;

    // No explicit builtin grant for this specific permission. Apply the narrow
    // role-fallback map as a PER-PERMISSION safety net — not just when the role
    // has zero rows. This fixes partial seeding (e.g. ADMIN seeded with some
    // INTERVIEW_* rows but missing INTERVIEW_INSIGHTS_CREATE), which previously
    // skipped the fallback entirely and denied intended permissions.
    // allowFallbackPermission only ever returns true for keys explicitly listed in
    // the role's map (INTERVIEW_* + MANAGE_ROLLOUT); every other permission key still
    // resolves to false here, and an explicit org-user DENY (checked above) wins.
    return allowFallbackPermission(permissionKey);
  } catch (err: any) {
    logger.error('[PermissionService] Permission query error:', err as Error);
    // If permissions tables are missing (migration not applied), use narrow fallback.
    const msg = String(err?.message || err);
    const looksLikeMissingTable =
      msg.toLowerCase().includes('no such table') ||
      msg.toLowerCase().includes('does not exist') ||
      (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('does not exist'));
    if (looksLikeMissingTable) {
      return allowFallbackPermission(permissionKey);
    }
    return false;
  }
}

/**
 * Get all permissions for a user in an organization
 */
export async function getUserPermissions(
  userId: string,
  orgId: string,
  userRole: Role
): Promise<UserPermissionsResult> {
  // Get role-based permissions from builtin_role_permissions
  const rolePerms = await DbPromise.all<RolePermissionRow>(
    db,
    `SELECT permission_key FROM builtin_role_permissions WHERE role = ?`,
    [userRole]
  );

  const rolePermissions = (rolePerms || []).map((r) => r.permission_key);

  // Get user overrides
  const overrides = await DbPromise.all<OverrideRow & { permission_key: string }>(
    db,
    `SELECT permission_key, grant_type 
         FROM org_user_permissions 
         WHERE user_id = ? AND organization_id = ?`,
    [userId, orgId]
  );

  const granted = (overrides || [])
    .filter((o) => o.grant_type === 'GRANT')
    .map((o) => o.permission_key);
  const revoked = (overrides || [])
    .filter((o) => o.grant_type === 'REVOKE')
    .map((o) => o.permission_key);

  // Calculate effective permissions
  const effective = [
    ...rolePermissions.filter((p) => !revoked.includes(p)),
    ...granted.filter((p) => !rolePermissions.includes(p)),
  ];

  return {
    rolePermissions,
    overrides: { granted, revoked },
    effective,
  };
}

/**
 * Grant a permission to a user in an organization
 */
export async function grantPermission(
  userId: string,
  orgId: string,
  permissionKey: string,
  grantedBy: string
): Promise<GrantPermissionResult> {
  // Verify permission exists
  const permExists = await permissionExists(permissionKey);
  if (!permExists) {
    throw new Error(`Permission not found: ${permissionKey}`);
  }

  const id = uuidv4();
  // NOTE: real unique constraint on org_user_permissions is
  // (user_id, organization_id, permission_key), not `id` (a freshly generated UUID per
  // call). Without an explicit conflict target on the real constraint, Postgres never
  // replaces the prior GRANT/REVOKE row for this (user, org, permission) — it accumulates
  // duplicates and hasPermission()/getUserPermissions() above (no ORDER BY) can then read
  // a stale grant_type instead of the latest one.
  await DbPromise.run(
    db,
    `INSERT INTO org_user_permissions
         (id, user_id, organization_id, permission_key, grant_type, granted_by, created_at)
         VALUES (?, ?, ?, ?, 'GRANT', ?, datetime('now'))
         ON CONFLICT (user_id, organization_id, permission_key) DO UPDATE SET
           grant_type = EXCLUDED.grant_type,
           granted_by = EXCLUDED.granted_by,
           created_at = EXCLUDED.created_at`,
    [id, userId, orgId, permissionKey, grantedBy],
    { fallback: false }
  );

  logger.info(
    `[PermissionService] Permission granted: ${permissionKey} to ${userId} by ${grantedBy}`
  );
  return {
    success: true,
    id,
    userId,
    organizationId: orgId,
    permissionKey,
    grantType: 'GRANT',
    grantedBy,
  };
}

/**
 * Revoke a permission from a user in an organization
 */
export async function revokePermission(
  userId: string,
  orgId: string,
  permissionKey: string,
  revokedBy: string
): Promise<RevokePermissionResult> {
  // Verify permission exists
  const permExists = await permissionExists(permissionKey);
  if (!permExists) {
    throw new Error(`Permission not found: ${permissionKey}`);
  }

  const id = uuidv4();
  // See NOTE in grantPermission() above: conflict target must be the real unique
  // constraint (user_id, organization_id, permission_key), not `id`.
  await DbPromise.run(
    db,
    `INSERT INTO org_user_permissions
         (id, user_id, organization_id, permission_key, grant_type, granted_by, created_at)
         VALUES (?, ?, ?, ?, 'REVOKE', ?, datetime('now'))
         ON CONFLICT (user_id, organization_id, permission_key) DO UPDATE SET
           grant_type = EXCLUDED.grant_type,
           granted_by = EXCLUDED.granted_by,
           created_at = EXCLUDED.created_at`,
    [id, userId, orgId, permissionKey, revokedBy],
    { fallback: false }
  );

  logger.info(
    `[PermissionService] Permission revoked: ${permissionKey} from ${userId} by ${revokedBy}`
  );
  return {
    success: true,
    id,
    userId,
    organizationId: orgId,
    permissionKey,
    grantType: 'REVOKE',
    revokedBy,
  };
}

/**
 * Remove override (revert to role default)
 */
export async function removeOverride(
  userId: string,
  orgId: string,
  permissionKey: string
): Promise<RemoveOverrideResult> {
  const result = await DbPromise.run(
    db,
    `DELETE FROM org_user_permissions 
         WHERE user_id = ? AND organization_id = ? AND permission_key = ?`,
    [userId, orgId, permissionKey]
  );

  return {
    removed: (result.changes || 0) > 0,
    userId,
    organizationId: orgId,
    permissionKey,
  };
}

/**
 * Get all defined permissions
 */
export async function getAllPermissions(): Promise<PermissionRow[]> {
  const rows = await DbPromise.all<PermissionRow>(
    db,
    `SELECT key, description, category FROM permissions ORDER BY category, key`,
    []
  );

  return rows || [];
}

/**
 * Get permissions by category
 */
export async function getPermissionsByCategory(category: string): Promise<PermissionRow[]> {
  const rows = await DbPromise.all<PermissionRow>(
    db,
    `SELECT key, description, category FROM permissions WHERE category = ?`,
    [category]
  );

  return rows || [];
}

/**
 * Get role-permission mappings
 */
export async function getRolePermissions(
  role: Role | null = null
): Promise<RolePermissionMappingRow[]> {
  let sql = `SELECT rp.role, rp.permission_key, p.description, p.category
               FROM builtin_role_permissions rp
               LEFT JOIN permissions p ON p.key = rp.permission_key`;
  const params: unknown[] = [];

  if (role) {
    sql += ` WHERE rp.role = ?`;
    params.push(role);
  }

  sql += ` ORDER BY rp.role, p.category, rp.permission_key`;

  const rows = await DbPromise.all<RolePermissionMappingRow>(db, sql, params);
  return rows || [];
}

/**
 * Internal: Check if permission exists
 */
async function permissionExists(permissionKey: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ '1'?: number }>(
      db,
      `SELECT 1 FROM permissions WHERE key = ?`,
      [permissionKey]
    );
    return !!row;
  } catch {
    return false;
  }
}

/**
 * Check if user can perform action on specific content item
 */
export async function hasContentPermission(
  userId: string,
  orgId: string,
  contentId: string,
  contentType: string,
  permissionKey: string,
  userRole: Role
): Promise<boolean> {
  if (!userId || !contentId || !permissionKey) return false;

  // SUPERADMIN bypass
  if (userRole === ROLES.SUPERADMIN) return true;

  try {
    // First check for content-specific permission
    const contentPerm = await DbPromise.get<OverrideRow>(
      db,
      `SELECT grant_type FROM content_permissions 
             WHERE content_id = ? AND content_type = ? AND user_id = ? AND permission_key = ?
             AND (expires_at IS NULL OR expires_at > datetime('now'))`,
      [contentId, contentType, userId, permissionKey]
    );

    // If explicit content permission exists, use it
    if (contentPerm) {
      return contentPerm.grant_type === 'GRANT';
    }

    // Fall back to general permission check
    return await hasPermission(userId, orgId, permissionKey, userRole);
  } catch (err: any) {
    logger.error('[PermissionService] Content permission query error:', err as Error);
    // Fall back to general permission check
    return await hasPermission(userId, orgId, permissionKey, userRole);
  }
}

/**
 * Grant content-specific permission
 */
export async function grantContentPermission(
  params: GrantContentPermissionParams
): Promise<GrantContentPermissionResult> {
  const { contentId, contentType, userId, permissionKey, grantedBy, expiresAt = null } = params;

  if (!contentId || !contentType || !userId || !permissionKey) {
    throw new Error('contentId, contentType, userId, and permissionKey are required');
  }

  const id = uuidv4();
  await DbPromise.run(
    db,
    `INSERT OR REPLACE INTO content_permissions 
         (id, content_id, content_type, user_id, permission_key, grant_type, granted_by, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, 'GRANT', ?, datetime('now'), ?)`,
    [id, contentId, contentType, userId, permissionKey, grantedBy, expiresAt]
  );

  logger.info(
    `[PermissionService] Content permission granted: ${permissionKey} on ${contentType}:${contentId} to ${userId}`
  );
  return {
    success: true,
    id,
    contentId,
    contentType,
    userId,
    permissionKey,
    grantType: 'GRANT',
    grantedBy,
    expiresAt,
  };
}

/**
 * Revoke content-specific permission
 */
export async function revokeContentPermission(
  params: RevokeContentPermissionParams
): Promise<RevokeContentPermissionResult> {
  const { contentId, contentType, userId, permissionKey, revokedBy } = params;

  if (!contentId || !contentType || !userId || !permissionKey) {
    throw new Error('contentId, contentType, userId, and permissionKey are required');
  }

  const id = uuidv4();
  await DbPromise.run(
    db,
    `INSERT OR REPLACE INTO content_permissions 
         (id, content_id, content_type, user_id, permission_key, grant_type, granted_by, created_at)
         VALUES (?, ?, ?, ?, ?, 'REVOKE', ?, datetime('now'))`,
    [id, contentId, contentType, userId, permissionKey, revokedBy]
  );

  logger.info(
    `[PermissionService] Content permission revoked: ${permissionKey} on ${contentType}:${contentId} from ${userId}`
  );
  return {
    success: true,
    id,
    contentId,
    contentType,
    userId,
    permissionKey,
    grantType: 'REVOKE',
    revokedBy,
  };
}

/**
 * Remove content-specific permission (revert to default)
 */
export async function removeContentPermission(
  contentId: string,
  contentType: string,
  userId: string,
  permissionKey: string
): Promise<RemoveContentPermissionResult> {
  const result = await DbPromise.run(
    db,
    `DELETE FROM content_permissions 
         WHERE content_id = ? AND content_type = ? AND user_id = ? AND permission_key = ?`,
    [contentId, contentType, userId, permissionKey]
  );

  return {
    removed: (result.changes || 0) > 0,
    contentId,
    contentType,
    userId,
    permissionKey,
  };
}

/**
 * Get all permissions for a specific content item
 */
export async function getContentPermissions(
  contentId: string,
  contentType: string
): Promise<ContentPermissionRow[]> {
  const rows = await DbPromise.all<ContentPermissionRow>(
    db,
    `SELECT cp.*, u.first_name, u.last_name, u.email
         FROM content_permissions cp
         LEFT JOIN users u ON cp.user_id = u.id
         WHERE cp.content_id = ? AND cp.content_type = ?
         AND (cp.expires_at IS NULL OR cp.expires_at > datetime('now'))
         ORDER BY cp.created_at DESC`,
    [contentId, contentType]
  );

  return (rows || []).map((row) => ({
    id: row.id,
    contentId: row.content_id,
    contentType: row.content_type,
    userId: row.user_id,
    permissionKey: row.permission_key,
    grantType: row.grant_type,
    grantedBy: row.granted_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    user: row.first_name
      ? {
          id: row.user_id,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
        }
      : null,
  })) as unknown as ContentPermissionRow[];
}

/**
 * Check multiple permissions at once
 */
export async function hasPermissions(
  userId: string,
  orgId: string,
  permissionKeys: string[],
  userRole: Role
): Promise<Record<string, boolean>> {
  if (!userId || !permissionKeys || permissionKeys.length === 0) {
    return {};
  }

  // SUPERADMIN bypass
  if (userRole === ROLES.SUPERADMIN) {
    return permissionKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {});
  }

  const results: Record<string, boolean> = {};
  for (const key of permissionKeys) {
    results[key] = await hasPermission(userId, orgId, key, userRole);
  }
  return results;
}

/**
 * Validate content action (comprehensive check)
 */
export async function validateContentAction(
  params: ValidateContentActionParams
): Promise<ValidateContentActionResult> {
  const { userId, orgId, userRole, contentId, contentType, action } = params;

  // Map actions to permission keys
  const actionPermissionMap: Record<string, string> = {
    VIEW: contentType === 'EMAIL_TEMPLATE' ? 'EMAIL_TEMPLATE_VIEW' : 'PLAYBOOK_TEMPLATE_VIEW',
    CREATE: contentType === 'EMAIL_TEMPLATE' ? 'EMAIL_TEMPLATE_CREATE' : 'PLAYBOOK_TEMPLATE_CREATE',
    EDIT: contentType === 'EMAIL_TEMPLATE' ? 'EMAIL_TEMPLATE_EDIT' : 'PLAYBOOK_TEMPLATE_EDIT',
    DELETE: contentType === 'EMAIL_TEMPLATE' ? 'EMAIL_TEMPLATE_DELETE' : 'PLAYBOOK_TEMPLATE_DELETE',
    PUBLISH:
      contentType === 'EMAIL_TEMPLATE' ? 'EMAIL_TEMPLATE_PUBLISH' : 'PLAYBOOK_TEMPLATE_PUBLISH',
    DEPRECATE:
      contentType === 'EMAIL_TEMPLATE' ? 'EMAIL_TEMPLATE_DEPRECATE' : 'PLAYBOOK_TEMPLATE_DEPRECATE',
    CLONE: contentType === 'EMAIL_TEMPLATE' ? 'EMAIL_TEMPLATE_CLONE' : 'PLAYBOOK_TEMPLATE_CLONE',
    RESTORE:
      contentType === 'EMAIL_TEMPLATE' ? 'EMAIL_TEMPLATE_RESTORE' : 'PLAYBOOK_TEMPLATE_RESTORE',
    ANALYTICS:
      contentType === 'EMAIL_TEMPLATE' ? 'EMAIL_TEMPLATE_ANALYTICS' : 'PLAYBOOK_TEMPLATE_ANALYTICS',
    PREVIEW: 'EMAIL_TEMPLATE_PREVIEW',
    TEST_SEND: 'EMAIL_TEMPLATE_TEST_SEND',
  };

  const permissionKey = actionPermissionMap[action];
  if (!permissionKey) {
    return { allowed: false, reason: `Unknown action: ${action}` };
  }

  // Check permission
  const allowed = contentId
    ? await hasContentPermission(userId, orgId, contentId, contentType, permissionKey, userRole)
    : await hasPermission(userId, orgId, permissionKey, userRole);

  if (!allowed) {
    return { allowed: false, reason: `Permission denied: ${permissionKey}` };
  }

  return { allowed: true };
}

// Default export for backward compatibility
const PermissionService = {
  ROLES,
  CAPABILITIES,
  ROLE_CAPABILITIES,
  CONTENT_PERMISSIONS,
  setDependencies,
  can,
  getCapabilitiesForRole,
  hasPermission,
  getUserPermissions,
  grantPermission,
  revokePermission,
  removeOverride,
  getAllPermissions,
  getPermissionsByCategory,
  getRolePermissions,
  hasContentPermission,
  grantContentPermission,
  revokeContentPermission,
  removeContentPermission,
  getContentPermissions,
  hasPermissions,
  validateContentAction,
};

export default PermissionService;
