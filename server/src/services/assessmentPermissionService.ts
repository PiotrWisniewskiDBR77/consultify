/**
 * Assessment Permission Service
 *
 * Handles role-based access control for assessments.
 * Supports hierarchical roles: Admin > Manager > Editor > Viewer
 *
 * Key features:
 * - Per-assessment role assignments
 * - Granular permission flags for managers
 * - Access request workflow
 * - Area-level restrictions
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type AssessmentRole = 'admin' | 'manager' | 'editor' | 'viewer';

export interface AssessmentPermissions {
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
  canManageTeam: boolean;
  canChangeStatus: boolean;
  canApprove: boolean;
  canDelete: boolean;
  canGenerateReport: boolean;
  canGenerateInitiatives: boolean;
  canRequestAccess: boolean;
}

export interface AssessmentRoleRecord {
  id: string;
  assessmentId: string;
  userId: string;
  organizationId: string;
  role: AssessmentRole;
  canEdit: boolean;
  canApprove: boolean;
  canManageTeam: boolean;
  canChangeStatus: boolean;
  canGenerateReport: boolean;
  canGenerateInitiatives: boolean;
  assignedAreas: string[] | null;
  assignedBy: string;
  assignedAt: string;
  updatedAt: string;
  // Joined user info
  userName?: string;
  userEmail?: string;
}

export interface AssessmentAccessRequest {
  id: string;
  assessmentId: string;
  organizationId: string;
  requesterId: string;
  requestedRole: 'editor' | 'manager';
  requestedAreas: string[] | null;
  justification: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  grantedRole: string | null;
  grantedPermissions: Record<string, boolean> | null;
  grantedAreas: string[] | null;
  createdAt: string;
  updatedAt: string;
  // Joined user info
  requesterName?: string;
  requesterEmail?: string;
  reviewerName?: string;
  reviewerEmail?: string;
}

export interface UserRoleInfo {
  role: AssessmentRole;
  permissions: AssessmentPermissions;
  assignedAreas: string[] | null;
  isOwner: boolean;
}

export interface AssignRoleParams {
  assessmentId: string;
  userId: string;
  organizationId: string;
  role: AssessmentRole;
  assignedBy: string;
  permissions?: Partial<{
    canEdit: boolean;
    canApprove: boolean;
    canManageTeam: boolean;
    canChangeStatus: boolean;
    canGenerateReport: boolean;
    canGenerateInitiatives: boolean;
  }>;
  assignedAreas?: string[];
}

export interface CreateAccessRequestParams {
  assessmentId: string;
  organizationId: string;
  requesterId: string;
  requestedRole: 'editor' | 'manager';
  requestedAreas?: string[];
  justification: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export interface ApproveAccessRequestParams {
  requestId: string;
  reviewerId: string;
  grantedRole: 'editor' | 'manager';
  grantedPermissions?: Partial<{
    canEdit: boolean;
    canApprove: boolean;
    canManageTeam: boolean;
    canChangeStatus: boolean;
    canGenerateReport: boolean;
    canGenerateInitiatives: boolean;
  }>;
  grantedAreas?: string[];
  notes?: string;
}

// ==========================================
// DATABASE HELPERS
// ==========================================

let db: IDatabase = getDatabase();

export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
  if (newDeps.db) {
    db = newDeps.db;
  }
}

function queryAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: T | null) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function queryRun(
  sql: string,
  params: unknown[] = []
): Promise<{ changes: number; lastID: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: { changes: number; lastID: number }, err: Error | null) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

// ==========================================
// SCHEMA (SQLite-first, best-effort)
// ==========================================

let _schemaEnsured = false;

/**
 * Ensure required tables for workflow "Manage" exist.
 *
 * Dev SQLite DBs may miss some tables if migrations were skipped. The UI calls
 * endpoints that assume these exist (roles + access requests). Missing tables
 * cause hard errors like: SQLITE_ERROR: no such table: assessment_access_requests
 *
 * Uses CREATE TABLE IF NOT EXISTS (safe to run repeatedly).
 * Best-effort: if DB doesn't support these statements, we log and continue.
 */
async function ensureAssessmentPermissionSchema(): Promise<void> {
  if (_schemaEnsured) return;
  _schemaEnsured = true;

  try {
    await queryRun(
      `CREATE TABLE IF NOT EXISTS assessment_roles (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        role TEXT NOT NULL,
        can_edit INTEGER DEFAULT 0,
        can_approve INTEGER DEFAULT 0,
        can_manage_team INTEGER DEFAULT 0,
        can_change_status INTEGER DEFAULT 0,
        can_generate_report INTEGER DEFAULT 0,
        can_generate_initiatives INTEGER DEFAULT 0,
        assigned_areas TEXT,
        assigned_by TEXT NOT NULL,
        assigned_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      []
    );
    await queryRun(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_roles_unique
       ON assessment_roles(assessment_id, user_id, organization_id)`,
      []
    );

    await queryRun(
      `CREATE TABLE IF NOT EXISTS assessment_access_requests (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        requester_id TEXT NOT NULL,
        requested_role TEXT NOT NULL,
        requested_areas TEXT,
        justification TEXT NOT NULL,
        priority TEXT DEFAULT 'NORMAL',
        status TEXT DEFAULT 'PENDING',
        reviewed_by TEXT,
        reviewed_at TEXT,
        review_notes TEXT,
        granted_role TEXT,
        granted_permissions TEXT,
        granted_areas TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      []
    );
    await queryRun(
      `CREATE INDEX IF NOT EXISTS idx_assessment_access_requests_assessment
       ON assessment_access_requests(assessment_id, organization_id, status)`,
      []
    );
  } catch (err: any) {
    logger.warn(
      `[AssessmentPermissionService] Failed to ensure permission schema (continuing): ${err?.message || err}`
    );
  }
}

// ==========================================
// PERMISSION CALCULATION
// ==========================================

/**
 * Get default permissions for a role
 */
function getDefaultPermissions(role: AssessmentRole): AssessmentPermissions {
  switch (role) {
    case 'admin':
      return {
        canView: true,
        canEdit: true,
        canManage: true,
        canManageTeam: true,
        canChangeStatus: true,
        canApprove: true,
        canDelete: true,
        canGenerateReport: true,
        canGenerateInitiatives: true,
        canRequestAccess: false, // Admin doesn't need to request
      };
    case 'manager':
      return {
        canView: true,
        canEdit: false, // Configurable
        canManage: true,
        canManageTeam: false, // Configurable
        canChangeStatus: false, // Configurable
        canApprove: false, // Configurable
        canDelete: false,
        canGenerateReport: true,
        canGenerateInitiatives: true,
        canRequestAccess: false,
      };
    case 'editor':
      return {
        canView: true,
        canEdit: true,
        canManage: false,
        canManageTeam: false,
        canChangeStatus: false,
        canApprove: false,
        canDelete: false,
        canGenerateReport: false,
        canGenerateInitiatives: false,
        canRequestAccess: false,
      };
    case 'viewer':
    default:
      return {
        canView: true,
        canEdit: false,
        canManage: false,
        canManageTeam: false,
        canChangeStatus: false,
        canApprove: false,
        canDelete: false,
        canGenerateReport: false,
        canGenerateInitiatives: false,
        canRequestAccess: true,
      };
  }
}

/**
 * Calculate effective permissions from role record
 */
function calculatePermissions(
  role: AssessmentRole,
  customPermissions?: Partial<AssessmentPermissions>
): AssessmentPermissions {
  const defaults = getDefaultPermissions(role);

  if (role !== 'manager' || !customPermissions) {
    return defaults;
  }

  // For managers, apply custom permissions
  return {
    ...defaults,
    canEdit: customPermissions.canEdit ?? defaults.canEdit,
    canApprove: customPermissions.canApprove ?? defaults.canApprove,
    canManageTeam: customPermissions.canManageTeam ?? defaults.canManageTeam,
    canChangeStatus: customPermissions.canChangeStatus ?? defaults.canChangeStatus,
    canGenerateReport: customPermissions.canGenerateReport ?? defaults.canGenerateReport,
    canGenerateInitiatives:
      customPermissions.canGenerateInitiatives ?? defaults.canGenerateInitiatives,
  };
}

// ==========================================
// CORE FUNCTIONS
// ==========================================

/**
 * Get user's role and permissions for an assessment
 */
export async function getUserRole(
  assessmentId: string,
  userId: string,
  organizationId: string
): Promise<UserRoleInfo> {
  await ensureAssessmentPermissionSchema();
  try {
    // First check if user is the assessment creator (always admin)
    const assessment = await queryOne<{ created_by: string }>(
      `SELECT created_by FROM assessments WHERE id = ? AND organization_id = ?`,
      [assessmentId, organizationId]
    );

    logger.info(
      `[AssessmentPermissionService] Checking role for user=${userId}, assessment=${assessmentId}, created_by=${assessment?.created_by}`
    );

    const isOwner = assessment?.created_by === userId;

    // Check for explicit role assignment
    const roleRecord = await queryOne<{
      role: AssessmentRole;
      can_edit: number;
      can_approve: number;
      can_manage_team: number;
      can_change_status: number;
      can_generate_report: number;
      can_generate_initiatives: number;
      assigned_areas: string | null;
    }>(
      `SELECT role, can_edit, can_approve, can_manage_team, can_change_status, 
              can_generate_report, can_generate_initiatives, assigned_areas
       FROM assessment_roles 
       WHERE assessment_id = ? AND user_id = ?`,
      [assessmentId, userId]
    );

    // If user is owner, they're always admin
    if (isOwner) {
      return {
        role: 'admin',
        permissions: getDefaultPermissions('admin'),
        assignedAreas: null,
        isOwner: true,
      };
    }

    // If no role record, default to viewer
    if (!roleRecord) {
      return {
        role: 'viewer',
        permissions: getDefaultPermissions('viewer'),
        assignedAreas: null,
        isOwner: false,
      };
    }

    const customPermissions: Partial<AssessmentPermissions> = {
      canEdit: Boolean(roleRecord.can_edit),
      canApprove: Boolean(roleRecord.can_approve),
      canManageTeam: Boolean(roleRecord.can_manage_team),
      canChangeStatus: Boolean(roleRecord.can_change_status),
      canGenerateReport: Boolean(roleRecord.can_generate_report),
      canGenerateInitiatives: Boolean(roleRecord.can_generate_initiatives),
    };

    const assignedAreas = roleRecord.assigned_areas ? JSON.parse(roleRecord.assigned_areas) : null;

    return {
      role: roleRecord.role,
      permissions: calculatePermissions(roleRecord.role, customPermissions),
      assignedAreas,
      isOwner: false,
    };
  } catch (error) {
    logger.error('[AssessmentPermissionService] Error getting user role:', error);
    // Default to viewer on error
    return {
      role: 'viewer',
      permissions: getDefaultPermissions('viewer'),
      assignedAreas: null,
      isOwner: false,
    };
  }
}

/**
 * Check if user has specific permission
 */
export async function hasPermission(
  assessmentId: string,
  userId: string,
  organizationId: string,
  permission: keyof AssessmentPermissions
): Promise<boolean> {
  const userRole = await getUserRole(assessmentId, userId, organizationId);
  return userRole.permissions[permission];
}

/**
 * Get all roles for an assessment
 * Includes the assessment creator as Admin (owner) even if not in assessment_roles table
 */
export async function getAssessmentRoles(
  assessmentId: string,
  organizationId: string
): Promise<AssessmentRoleRecord[]> {
  await ensureAssessmentPermissionSchema();
  try {
    // First, get the assessment creator (owner)
    const assessment = await queryOne<{
      created_by: string;
      created_at: string;
      creator_email: string;
      creator_first_name: string;
      creator_last_name: string;
    }>(
      `SELECT a.created_by, a.created_at, 
              u.email as creator_email,
              u.first_name as creator_first_name,
              u.last_name as creator_last_name
       FROM assessments a
       LEFT JOIN users u ON a.created_by = u.id
       WHERE a.id = ? AND a.organization_id = ?`,
      [assessmentId, organizationId]
    );

    // Get explicit role assignments
    const rows = await queryAll<{
      id: string;
      assessment_id: string;
      user_id: string;
      organization_id: string;
      role: AssessmentRole;
      can_edit: number;
      can_approve: number;
      can_manage_team: number;
      can_change_status: number;
      can_generate_report: number;
      can_generate_initiatives: number;
      assigned_areas: string | null;
      assigned_by: string;
      assigned_at: string;
      updated_at: string;
      user_email: string | null;
      user_first_name: string | null;
      user_last_name: string | null;
    }>(
      `SELECT ar.*, 
              u.email as user_email,
              u.first_name as user_first_name,
              u.last_name as user_last_name
       FROM assessment_roles ar
       LEFT JOIN users u ON ar.user_id = u.id
       WHERE ar.assessment_id = ? AND ar.organization_id = ?
       ORDER BY ar.assigned_at DESC`,
      [assessmentId, organizationId]
    );

    const roles: AssessmentRoleRecord[] = rows.map((row) => ({
      id: row.id,
      assessmentId: row.assessment_id,
      userId: row.user_id,
      organizationId: row.organization_id,
      role: row.role,
      canEdit: Boolean(row.can_edit),
      canApprove: Boolean(row.can_approve),
      canManageTeam: Boolean(row.can_manage_team),
      canChangeStatus: Boolean(row.can_change_status),
      canGenerateReport: Boolean(row.can_generate_report),
      canGenerateInitiatives: Boolean(row.can_generate_initiatives),
      assignedAreas: row.assigned_areas ? JSON.parse(row.assigned_areas) : null,
      assignedBy: row.assigned_by,
      assignedAt: row.assigned_at,
      updatedAt: row.updated_at,
      userName:
        row.user_first_name && row.user_last_name
          ? `${row.user_first_name} ${row.user_last_name}`
          : row.user_email || undefined,
      userEmail: row.user_email || undefined,
    }));

    // Add the creator as Admin if not already in the roles list
    if (assessment?.created_by) {
      const creatorAlreadyInRoles = roles.some((r) => r.userId === assessment.created_by);
      if (!creatorAlreadyInRoles) {
        const ownerPermissions = getDefaultPermissions('admin');
        roles.unshift({
          id: `owner-${assessment.created_by}`,
          assessmentId,
          userId: assessment.created_by,
          organizationId,
          role: 'admin',
          canEdit: ownerPermissions.canEdit,
          canApprove: ownerPermissions.canApprove,
          canManageTeam: ownerPermissions.canManageTeam,
          canChangeStatus: ownerPermissions.canChangeStatus,
          canGenerateReport: ownerPermissions.canGenerateReport,
          canGenerateInitiatives: ownerPermissions.canGenerateInitiatives,
          assignedAreas: null,
          assignedBy: 'system',
          assignedAt: assessment.created_at || new Date().toISOString(),
          updatedAt: assessment.created_at || new Date().toISOString(),
          userName:
            assessment.creator_first_name && assessment.creator_last_name
              ? `${assessment.creator_first_name} ${assessment.creator_last_name}`
              : assessment.creator_email || undefined,
          userEmail: assessment.creator_email || undefined,
        });
      }
    }

    return roles;
  } catch (error) {
    logger.error('[AssessmentPermissionService] Error getting assessment roles:', error);
    return [];
  }
}

/**
 * Assign or update a role for a user
 */
export async function assignRole(params: AssignRoleParams): Promise<AssessmentRoleRecord> {
  await ensureAssessmentPermissionSchema();
  const {
    assessmentId,
    userId,
    organizationId,
    role,
    assignedBy,
    permissions = {},
    assignedAreas,
  } = params;

  const id = uuidv4();
  const now = new Date().toISOString();

  // Determine permission flags based on role
  const canEdit =
    role === 'admin' || role === 'editor' || (role === 'manager' && permissions.canEdit);
  const canApprove = role === 'admin' || (role === 'manager' && permissions.canApprove);
  const canManageTeam = role === 'admin' || (role === 'manager' && permissions.canManageTeam);
  const canChangeStatus = role === 'admin' || (role === 'manager' && permissions.canChangeStatus);
  const canGenerateReport = role === 'admin' || role === 'manager';
  const canGenerateInitiatives = role === 'admin' || role === 'manager';

  try {
    await queryRun(
      `INSERT INTO assessment_roles 
       (id, assessment_id, user_id, organization_id, role, 
        can_edit, can_approve, can_manage_team, can_change_status,
        can_generate_report, can_generate_initiatives, assigned_areas, 
        assigned_by, assigned_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (assessment_id, user_id, organization_id) DO UPDATE SET
         role = excluded.role,
         can_edit = excluded.can_edit,
         can_approve = excluded.can_approve,
         can_manage_team = excluded.can_manage_team,
         can_change_status = excluded.can_change_status,
         can_generate_report = excluded.can_generate_report,
         can_generate_initiatives = excluded.can_generate_initiatives,
         assigned_areas = excluded.assigned_areas,
         assigned_by = excluded.assigned_by,
         updated_at = excluded.updated_at`,
      [
        id,
        assessmentId,
        userId,
        organizationId,
        role,
        canEdit ? 1 : 0,
        canApprove ? 1 : 0,
        canManageTeam ? 1 : 0,
        canChangeStatus ? 1 : 0,
        canGenerateReport ? 1 : 0,
        canGenerateInitiatives ? 1 : 0,
        assignedAreas ? JSON.stringify(assignedAreas) : null,
        assignedBy,
        now,
        now,
      ]
    );
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    // Some SQLite DBs might be missing the expected UNIQUE constraint/index for the UPSERT target.
    // Fallback to a manual upsert to avoid breaking team management.
    if (msg.includes('ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint')) {
      const update = await queryRun(
        `UPDATE assessment_roles
         SET role = ?,
             can_edit = ?,
             can_approve = ?,
             can_manage_team = ?,
             can_change_status = ?,
             can_generate_report = ?,
             can_generate_initiatives = ?,
             assigned_areas = ?,
             assigned_by = ?,
             updated_at = ?
         WHERE assessment_id = ? AND user_id = ? AND organization_id = ?`,
        [
          role,
          canEdit ? 1 : 0,
          canApprove ? 1 : 0,
          canManageTeam ? 1 : 0,
          canChangeStatus ? 1 : 0,
          canGenerateReport ? 1 : 0,
          canGenerateInitiatives ? 1 : 0,
          assignedAreas ? JSON.stringify(assignedAreas) : null,
          assignedBy,
          now,
          assessmentId,
          userId,
          organizationId,
        ]
      );

      if (update.changes === 0) {
        await queryRun(
          `INSERT INTO assessment_roles
           (id, assessment_id, user_id, organization_id, role,
            can_edit, can_approve, can_manage_team, can_change_status,
            can_generate_report, can_generate_initiatives, assigned_areas,
            assigned_by, assigned_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            assessmentId,
            userId,
            organizationId,
            role,
            canEdit ? 1 : 0,
            canApprove ? 1 : 0,
            canManageTeam ? 1 : 0,
            canChangeStatus ? 1 : 0,
            canGenerateReport ? 1 : 0,
            canGenerateInitiatives ? 1 : 0,
            assignedAreas ? JSON.stringify(assignedAreas) : null,
            assignedBy,
            now,
            now,
          ]
        );
      }
    } else {
      throw err;
    }
  }

  logger.info(
    `[AssessmentPermissionService] Role assigned: ${role} to user ${userId} for assessment ${assessmentId}`
  );

  return {
    id,
    assessmentId,
    userId,
    organizationId,
    role,
    canEdit: Boolean(canEdit),
    canApprove: Boolean(canApprove),
    canManageTeam: Boolean(canManageTeam),
    canChangeStatus: Boolean(canChangeStatus),
    canGenerateReport: Boolean(canGenerateReport),
    canGenerateInitiatives: Boolean(canGenerateInitiatives),
    assignedAreas: assignedAreas || null,
    assignedBy,
    assignedAt: now,
    updatedAt: now,
  };
}

/**
 * Remove a user's role from an assessment
 */
export async function removeRole(
  assessmentId: string,
  userId: string,
  organizationId: string
): Promise<boolean> {
  await ensureAssessmentPermissionSchema();
  const result = await queryRun(
    `DELETE FROM assessment_roles 
     WHERE assessment_id = ? AND user_id = ? AND organization_id = ?`,
    [assessmentId, userId, organizationId]
  );

  if (result.changes > 0) {
    logger.info(
      `[AssessmentPermissionService] Role removed for user ${userId} from assessment ${assessmentId}`
    );
  }

  return result.changes > 0;
}

// ==========================================
// ACCESS REQUESTS
// ==========================================

/**
 * Create an access request
 */
export async function createAccessRequest(
  params: CreateAccessRequestParams
): Promise<AssessmentAccessRequest> {
  await ensureAssessmentPermissionSchema();
  const {
    assessmentId,
    organizationId,
    requesterId,
    requestedRole,
    requestedAreas,
    justification,
    priority = 'NORMAL',
  } = params;

  // Check if there's already a pending request
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM assessment_access_requests 
     WHERE assessment_id = ? AND requester_id = ? AND status = 'PENDING'`,
    [assessmentId, requesterId]
  );

  if (existing) {
    throw new Error('You already have a pending access request for this assessment');
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  await queryRun(
    `INSERT INTO assessment_access_requests 
     (id, assessment_id, organization_id, requester_id, requested_role, 
      requested_areas, justification, priority, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
    [
      id,
      assessmentId,
      organizationId,
      requesterId,
      requestedRole,
      requestedAreas ? JSON.stringify(requestedAreas) : null,
      justification,
      priority,
      now,
      now,
    ]
  );

  logger.info(
    `[AssessmentPermissionService] Access request created: ${id} for assessment ${assessmentId}`
  );

  return {
    id,
    assessmentId,
    organizationId,
    requesterId,
    requestedRole,
    requestedAreas: requestedAreas || null,
    justification,
    priority,
    status: 'PENDING',
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    grantedRole: null,
    grantedPermissions: null,
    grantedAreas: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get access requests for an assessment
 */
export async function getAccessRequests(
  assessmentId: string,
  organizationId: string,
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
): Promise<AssessmentAccessRequest[]> {
  await ensureAssessmentPermissionSchema();
  let sql = `
    SELECT ar.*,
           u.email as requester_email,
           u.first_name as requester_first_name,
           u.last_name as requester_last_name,
           r.email as reviewer_email,
           r.first_name as reviewer_first_name,
           r.last_name as reviewer_last_name
    FROM assessment_access_requests ar
    LEFT JOIN users u ON ar.requester_id = u.id
    LEFT JOIN users r ON ar.reviewed_by = r.id
    WHERE ar.assessment_id = ? AND ar.organization_id = ?
  `;
  const params: unknown[] = [assessmentId, organizationId];

  if (status) {
    sql += ` AND ar.status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY ar.created_at DESC`;

  const rows = await queryAll<{
    id: string;
    assessment_id: string;
    organization_id: string;
    requester_id: string;
    requested_role: 'editor' | 'manager';
    requested_areas: string | null;
    justification: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    reviewed_by: string | null;
    reviewed_at: string | null;
    review_notes: string | null;
    granted_role: string | null;
    granted_permissions: string | null;
    granted_areas: string | null;
    created_at: string;
    updated_at: string;
    requester_email: string | null;
    requester_first_name: string | null;
    requester_last_name: string | null;
    reviewer_email: string | null;
    reviewer_first_name: string | null;
    reviewer_last_name: string | null;
  }>(sql, params);

  return rows.map((row) => ({
    id: row.id,
    assessmentId: row.assessment_id,
    organizationId: row.organization_id,
    requesterId: row.requester_id,
    requestedRole: row.requested_role,
    requestedAreas: row.requested_areas ? JSON.parse(row.requested_areas) : null,
    justification: row.justification,
    priority: row.priority,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    grantedRole: row.granted_role,
    grantedPermissions: row.granted_permissions ? JSON.parse(row.granted_permissions) : null,
    grantedAreas: row.granted_areas ? JSON.parse(row.granted_areas) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    requesterName:
      row.requester_first_name && row.requester_last_name
        ? `${row.requester_first_name} ${row.requester_last_name}`
        : row.requester_email || undefined,
    requesterEmail: row.requester_email || undefined,
    reviewerName:
      row.reviewer_first_name && row.reviewer_last_name
        ? `${row.reviewer_first_name} ${row.reviewer_last_name}`
        : row.reviewer_email || undefined,
    reviewerEmail: row.reviewer_email || undefined,
  }));
}

/**
 * Approve an access request
 */
export async function approveAccessRequest(
  params: ApproveAccessRequestParams
): Promise<AssessmentAccessRequest> {
  await ensureAssessmentPermissionSchema();
  const { requestId, reviewerId, grantedRole, grantedPermissions, grantedAreas, notes } = params;

  // Get the request
  const request = await queryOne<{
    id: string;
    assessment_id: string;
    organization_id: string;
    requester_id: string;
    status: string;
  }>(
    `SELECT id, assessment_id, organization_id, requester_id, status 
     FROM assessment_access_requests WHERE id = ?`,
    [requestId]
  );

  if (!request) {
    throw new Error('Access request not found');
  }

  if (request.status !== 'PENDING') {
    throw new Error('This request has already been processed');
  }

  const now = new Date().toISOString();

  // Update the request
  await queryRun(
    `UPDATE assessment_access_requests 
     SET status = 'APPROVED',
         reviewed_by = ?,
         reviewed_at = ?,
         review_notes = ?,
         granted_role = ?,
         granted_permissions = ?,
         granted_areas = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      reviewerId,
      now,
      notes || null,
      grantedRole,
      grantedPermissions ? JSON.stringify(grantedPermissions) : null,
      grantedAreas ? JSON.stringify(grantedAreas) : null,
      now,
      requestId,
    ]
  );

  // Assign the role
  await assignRole({
    assessmentId: request.assessment_id,
    userId: request.requester_id,
    organizationId: request.organization_id,
    role: grantedRole,
    assignedBy: reviewerId,
    permissions: grantedPermissions,
    assignedAreas: grantedAreas,
  });

  logger.info(
    `[AssessmentPermissionService] Access request ${requestId} approved by ${reviewerId}`
  );

  // Return updated request
  const requests = await getAccessRequests(request.assessment_id, request.organization_id);
  return requests.find((r) => r.id === requestId)!;
}

/**
 * Reject an access request
 */
export async function rejectAccessRequest(
  requestId: string,
  reviewerId: string,
  reason: string
): Promise<AssessmentAccessRequest> {
  await ensureAssessmentPermissionSchema();
  const request = await queryOne<{
    id: string;
    assessment_id: string;
    organization_id: string;
    status: string;
  }>(
    `SELECT id, assessment_id, organization_id, status 
     FROM assessment_access_requests WHERE id = ?`,
    [requestId]
  );

  if (!request) {
    throw new Error('Access request not found');
  }

  if (request.status !== 'PENDING') {
    throw new Error('This request has already been processed');
  }

  const now = new Date().toISOString();

  await queryRun(
    `UPDATE assessment_access_requests 
     SET status = 'REJECTED',
         reviewed_by = ?,
         reviewed_at = ?,
         review_notes = ?,
         updated_at = ?
     WHERE id = ?`,
    [reviewerId, now, reason, now, requestId]
  );

  logger.info(
    `[AssessmentPermissionService] Access request ${requestId} rejected by ${reviewerId}`
  );

  const requests = await getAccessRequests(request.assessment_id, request.organization_id);
  return requests.find((r) => r.id === requestId)!;
}

/**
 * Cancel an access request (by requester)
 */
export async function cancelAccessRequest(
  requestId: string,
  requesterId: string
): Promise<boolean> {
  await ensureAssessmentPermissionSchema();
  const result = await queryRun(
    `UPDATE assessment_access_requests 
     SET status = 'CANCELLED', updated_at = ?
     WHERE id = ? AND requester_id = ? AND status = 'PENDING'`,
    [new Date().toISOString(), requestId, requesterId]
  );

  if (result.changes > 0) {
    logger.info(`[AssessmentPermissionService] Access request ${requestId} cancelled`);
  }

  return result.changes > 0;
}

/**
 * Get admins for an assessment (for notifications)
 */
export async function getAssessmentAdmins(
  assessmentId: string,
  organizationId: string
): Promise<{ userId: string; userName?: string; userEmail?: string }[]> {
  await ensureAssessmentPermissionSchema();
  // Get assessment creator
  const assessment = await queryOne<{
    created_by: string;
    creator_email: string;
    creator_first_name: string;
    creator_last_name: string;
  }>(
    `SELECT a.created_by, u.email as creator_email, 
            u.first_name as creator_first_name, u.last_name as creator_last_name
     FROM assessments a
     LEFT JOIN users u ON a.created_by = u.id
     WHERE a.id = ? AND a.organization_id = ?`,
    [assessmentId, organizationId]
  );

  const admins: { userId: string; userName?: string; userEmail?: string }[] = [];

  if (assessment) {
    admins.push({
      userId: assessment.created_by,
      userName:
        assessment.creator_first_name && assessment.creator_last_name
          ? `${assessment.creator_first_name} ${assessment.creator_last_name}`
          : undefined,
      userEmail: assessment.creator_email,
    });
  }

  // Get users with admin role
  const roleAdmins = await queryAll<{
    user_id: string;
    user_email: string;
    user_first_name: string;
    user_last_name: string;
  }>(
    `SELECT ar.user_id, u.email as user_email, 
            u.first_name as user_first_name, u.last_name as user_last_name
     FROM assessment_roles ar
     LEFT JOIN users u ON ar.user_id = u.id
     WHERE ar.assessment_id = ? AND ar.organization_id = ? AND ar.role = 'admin'`,
    [assessmentId, organizationId]
  );

  for (const admin of roleAdmins) {
    if (!admins.some((a) => a.userId === admin.user_id)) {
      admins.push({
        userId: admin.user_id,
        userName:
          admin.user_first_name && admin.user_last_name
            ? `${admin.user_first_name} ${admin.user_last_name}`
            : undefined,
        userEmail: admin.user_email,
      });
    }
  }

  return admins;
}

// ==========================================
// EXPORTS
// ==========================================

const AssessmentPermissionService = {
  setDependencies,
  getUserRole,
  hasPermission,
  getAssessmentRoles,
  assignRole,
  removeRole,
  createAccessRequest,
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  cancelAccessRequest,
  getAssessmentAdmins,
  getDefaultPermissions,
  calculatePermissions,
};

export default AssessmentPermissionService;
