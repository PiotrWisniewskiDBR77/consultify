/**
 * V8 Workspace Governance Service
 *
 * Grants/revokes workspace roles, resolves effective permissions with a fixed
 * role hierarchy, classifies session content, records compliance checks, and
 * aggregates a small governance dashboard. All queries enforce org isolation.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  ClassifyContentParams,
  ComplianceCheckResult,
  ContentGovernanceRecord,
  GovernanceDashboard,
  GrantPermissionParams,
  PermissionAction,
  WorkspacePermission,
  WorkspaceRole,
} from '../../types/workspaceGovernance.js';
import {
  ClassifyContentParamsSchema,
  GrantPermissionParamsSchema,
  WorkspaceRoleValues,
} from '../../types/workspaceGovernance.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:WorkspaceGovernance]';

/** Lowest → highest privilege (index = rank). */
const ROLE_RANK_ORDER: readonly WorkspaceRole[] = [
  'guest',
  'viewer',
  'editor',
  'admin',
  'owner',
] as const;

function roleRank(role: WorkspaceRole): number {
  return ROLE_RANK_ORDER.indexOf(role);
}

function maxRole(a: WorkspaceRole, b: WorkspaceRole): WorkspaceRole {
  return roleRank(a) >= roleRank(b) ? a : b;
}

/**
 * Minimum role required to perform an action. Higher roles inherit all lower actions.
 */
const ACTION_MINIMUM_ROLE: Record<PermissionAction, WorkspaceRole> = {
  'session.create': 'editor',
  'session.pause': 'editor',
  'session.complete': 'editor',
  'room.link': 'editor',
  'room.unlink': 'editor',
  'context.update': 'editor',
  'context.read': 'guest',
  'activity.read': 'guest',
  'activity.write': 'editor',
  'suggestion.accept': 'editor',
  'suggestion.dismiss': 'editor',
  'decision.create': 'editor',
  'decision.vote': 'viewer',
  'decision.close': 'admin',
  'governance.manage': 'admin',
};

// ==========================================
// ROW TYPES
// ==========================================

interface PermissionRow {
  permission_id: string;
  workspace_id: string;
  organization_id: string;
  user_id: string;
  role: string;
  granted_by: string;
  granted_at: string;
  revoked_at: string | null;
}

interface ContentGovRow {
  record_id: string;
  session_id: string;
  organization_id: string;
  resource_ref: string;
  classification: string;
  retention_days: number;
  classified_by: string;
  classified_at: string;
}

interface ComplianceRow {
  check_id: string;
  session_id: string;
  organization_id: string;
  check_type: string;
  passed: number;
  details: string;
  checked_at: string;
}

interface SessionWorkspaceRow {
  workspace_id: string;
}

interface CountRow {
  cnt: number;
}

interface RoleCountRow {
  role: string;
  cnt: number;
}

interface ClassCountRow {
  classification: string;
  cnt: number;
}

interface RateRow {
  passed_sum: number;
  total: number;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToPermission(row: PermissionRow): WorkspacePermission {
  return {
    permissionId: row.permission_id,
    workspaceId: row.workspace_id,
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role as WorkspaceRole,
    grantedBy: row.granted_by,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at ?? null,
  };
}

function rowToContentGov(row: ContentGovRow): ContentGovernanceRecord {
  return {
    recordId: row.record_id,
    sessionId: row.session_id,
    organizationId: row.organization_id,
    resourceRef: row.resource_ref,
    classification: row.classification as ContentGovernanceRecord['classification'],
    retentionDays: row.retention_days,
    classifiedBy: row.classified_by,
    classifiedAt: row.classified_at,
  };
}

function rowToCompliance(row: ComplianceRow): ComplianceCheckResult {
  return {
    checkId: row.check_id,
    sessionId: row.session_id,
    organizationId: row.organization_id,
    checkType: row.check_type,
    passed: row.passed === 1,
    details: row.details,
    checkedAt: row.checked_at,
  };
}

function emptyRoleCounts(): Record<WorkspaceRole, number> {
  const out = {} as Record<WorkspaceRole, number>;
  for (const r of WorkspaceRoleValues) {
    out[r] = 0;
  }
  return out;
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Grant a workspace role to a user (new permission row; prior active grants for the same
 * user/workspace remain valid; effective role is the highest active role).
 */
export async function grantPermission(params: GrantPermissionParams): Promise<WorkspacePermission> {
  const validated = GrantPermissionParamsSchema.parse(params);
  const permissionId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_workspace_permissions (
      permission_id, workspace_id, organization_id, user_id, role,
      granted_by, granted_at, revoked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      permissionId,
      validated.workspaceId,
      validated.organizationId,
      validated.userId,
      validated.role,
      validated.grantedBy,
      now,
      null,
    ]
  );

  const created: WorkspacePermission = {
    permissionId,
    workspaceId: validated.workspaceId,
    organizationId: validated.organizationId,
    userId: validated.userId,
    role: validated.role,
    grantedBy: validated.grantedBy,
    grantedAt: now,
    revokedAt: null,
  };

  logger.info(
    `${LOG_PREFIX} Granted role ${validated.role} to user ${validated.userId} workspace ${validated.workspaceId}`
  );
  return created;
}

/**
 * Revoke a permission by setting revokedAt (org-scoped).
 */
export async function revokePermission(
  permissionId: string,
  organizationId: string
): Promise<WorkspacePermission> {
  const existing = await dbGet<PermissionRow>(
    `SELECT * FROM v8_workspace_permissions
     WHERE permission_id = ? AND organization_id = ?`,
    [permissionId, organizationId],
    { fallback: true }
  );

  if (!existing) {
    throw new Error(`Permission ${permissionId} not found in organization ${organizationId}`);
  }

  if (existing.revoked_at) {
    return rowToPermission(existing);
  }

  const now = new Date().toISOString();
  const result = await dbRun(
    `UPDATE v8_workspace_permissions
     SET revoked_at = ?
     WHERE permission_id = ? AND organization_id = ? AND revoked_at IS NULL`,
    [now, permissionId, organizationId]
  );

  if (!result.success || (result.changes ?? 0) < 1) {
    throw new Error(`Failed to revoke permission ${permissionId}`);
  }

  const updated = await dbGet<PermissionRow>(
    `SELECT * FROM v8_workspace_permissions
     WHERE permission_id = ? AND organization_id = ?`,
    [permissionId, organizationId],
    { fallback: true }
  );

  if (!updated) {
    throw new Error(`Permission ${permissionId} missing after revoke`);
  }

  logger.info(`${LOG_PREFIX} Revoked permission ${permissionId}`);
  return rowToPermission(updated);
}

/**
 * All active (non-revoked) permissions for a workspace.
 */
export async function getPermissions(
  workspaceId: string,
  organizationId: string
): Promise<WorkspacePermission[]> {
  const rows = await dbAll<PermissionRow>(
    `SELECT * FROM v8_workspace_permissions
     WHERE workspace_id = ? AND organization_id = ? AND revoked_at IS NULL
     ORDER BY granted_at ASC`,
    [workspaceId, organizationId],
    { fallback: true }
  );

  return rows.map(rowToPermission);
}

/**
 * Effective role for a user: highest active role on the workspace, or null if none.
 */
export async function getUserRole(
  workspaceId: string,
  userId: string,
  organizationId: string
): Promise<WorkspaceRole | null> {
  const rows = await dbAll<PermissionRow>(
    `SELECT role FROM v8_workspace_permissions
     WHERE workspace_id = ? AND user_id = ? AND organization_id = ? AND revoked_at IS NULL`,
    [workspaceId, userId, organizationId],
    { fallback: true }
  );

  if (rows.length === 0) return null;

  let best: WorkspaceRole = rows[0].role as WorkspaceRole;
  for (let i = 1; i < rows.length; i += 1) {
    best = maxRole(best, rows[i].role as WorkspaceRole);
  }
  return best;
}

/**
 * True if the user's effective role satisfies the minimum role for the action.
 */
export async function checkPermission(
  workspaceId: string,
  userId: string,
  action: PermissionAction,
  organizationId: string
): Promise<boolean> {
  const userRole = await getUserRole(workspaceId, userId, organizationId);
  if (!userRole) return false;

  const required = ACTION_MINIMUM_ROLE[action];
  return roleRank(userRole) >= roleRank(required);
}

/**
 * Record content classification for a session resource.
 */
export async function classifyContent(
  params: ClassifyContentParams
): Promise<ContentGovernanceRecord> {
  const validated = ClassifyContentParamsSchema.parse(params);
  const recordId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_content_governance (
      record_id, session_id, organization_id, resource_ref, classification,
      retention_days, classified_by, classified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      recordId,
      validated.sessionId,
      validated.organizationId,
      validated.resourceRef,
      validated.classification,
      validated.retentionDays,
      validated.classifiedBy,
      now,
    ]
  );

  const record: ContentGovernanceRecord = {
    recordId,
    sessionId: validated.sessionId,
    organizationId: validated.organizationId,
    resourceRef: validated.resourceRef,
    classification: validated.classification,
    retentionDays: validated.retentionDays,
    classifiedBy: validated.classifiedBy,
    classifiedAt: now,
  };

  logger.info(
    `${LOG_PREFIX} Classified resource ${validated.resourceRef} as ${validated.classification} session ${validated.sessionId}`
  );
  return record;
}

/**
 * All governance records for a session.
 */
export async function getContentClassifications(
  sessionId: string,
  organizationId: string
): Promise<ContentGovernanceRecord[]> {
  const rows = await dbAll<ContentGovRow>(
    `SELECT * FROM v8_content_governance
     WHERE session_id = ? AND organization_id = ?
     ORDER BY classified_at ASC`,
    [sessionId, organizationId],
    { fallback: true }
  );

  return rows.map(rowToContentGov);
}

async function getSessionWorkspaceId(sessionId: string, organizationId: string): Promise<string> {
  const row = await dbGet<SessionWorkspaceRow>(
    `SELECT workspace_id FROM v8_workspace_sessions
     WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId],
    { fallback: true }
  );
  if (!row) {
    throw new Error(`Session ${sessionId} not found in organization ${organizationId}`);
  }
  return row.workspace_id;
}

async function evaluateComplianceRule(
  sessionId: string,
  organizationId: string,
  workspaceId: string,
  checkType: string
): Promise<{ passed: boolean; details: string }> {
  if (checkType === 'content.classification.present') {
    const row = await dbGet<CountRow>(
      `SELECT COUNT(*) AS cnt FROM v8_content_governance
       WHERE session_id = ? AND organization_id = ?`,
      [sessionId, organizationId],
      { fallback: true }
    );
    const cnt = row?.cnt ?? 0;
    const passed = cnt > 0;
    return {
      passed,
      details: passed
        ? `Session has ${cnt} classification record(s).`
        : 'No content classification records for this session.',
    };
  }

  if (checkType === 'workspace.permissions.configured') {
    const row = await dbGet<CountRow>(
      `SELECT COUNT(*) AS cnt FROM v8_workspace_permissions
       WHERE workspace_id = ? AND organization_id = ? AND revoked_at IS NULL`,
      [workspaceId, organizationId],
      { fallback: true }
    );
    const cnt = row?.cnt ?? 0;
    const passed = cnt > 0;
    return {
      passed,
      details: passed
        ? `Workspace has ${cnt} active permission grant(s).`
        : 'No active workspace permissions configured.',
    };
  }

  return {
    passed: true,
    details: `No specific rule for "${checkType}"; marked as passed by default.`,
  };
}

/**
 * Run a compliance check for a session, persist the result, and return it.
 */
export async function runComplianceCheck(
  sessionId: string,
  organizationId: string,
  checkType: string
): Promise<ComplianceCheckResult> {
  const workspaceId = await getSessionWorkspaceId(sessionId, organizationId);
  const { passed, details } = await evaluateComplianceRule(
    sessionId,
    organizationId,
    workspaceId,
    checkType
  );

  const checkId = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO v8_compliance_checks (
      check_id, session_id, organization_id, check_type, passed, details, checked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [checkId, sessionId, organizationId, checkType, passed ? 1 : 0, details, now]
  );

  const result: ComplianceCheckResult = {
    checkId,
    sessionId,
    organizationId,
    checkType,
    passed,
    details,
    checkedAt: now,
  };

  logger.info(
    `${LOG_PREFIX} Compliance check ${checkType} session ${sessionId}: ${passed ? 'PASS' : 'FAIL'}`
  );
  return result;
}

/**
 * Compliance history for a session (newest last in ORDER BY asc — callers may reverse).
 */
export async function getComplianceHistory(
  sessionId: string,
  organizationId: string
): Promise<ComplianceCheckResult[]> {
  const rows = await dbAll<ComplianceRow>(
    `SELECT * FROM v8_compliance_checks
     WHERE session_id = ? AND organization_id = ?
     ORDER BY checked_at ASC`,
    [sessionId, organizationId],
    { fallback: true }
  );

  return rows.map(rowToCompliance);
}

/**
 * Aggregate permission counts, content classifications (sessions in workspace), and compliance pass rate.
 */
export async function getGovernanceDashboard(
  workspaceId: string,
  organizationId: string
): Promise<GovernanceDashboard> {
  const permRows = await dbAll<RoleCountRow>(
    `SELECT role, COUNT(*) AS cnt FROM v8_workspace_permissions
     WHERE workspace_id = ? AND organization_id = ? AND revoked_at IS NULL
     GROUP BY role`,
    [workspaceId, organizationId],
    { fallback: true }
  );

  const permissionCountByRole = emptyRoleCounts();
  for (const r of permRows) {
    const role = r.role as WorkspaceRole;
    if (role in permissionCountByRole) {
      permissionCountByRole[role] = r.cnt;
    }
  }

  const classRows = await dbAll<ClassCountRow>(
    `SELECT cg.classification, COUNT(*) AS cnt
     FROM v8_content_governance cg
     INNER JOIN v8_workspace_sessions s
       ON s.session_id = cg.session_id AND s.organization_id = cg.organization_id
     WHERE s.workspace_id = ? AND s.organization_id = ?
     GROUP BY cg.classification`,
    [workspaceId, organizationId],
    { fallback: true }
  );

  const contentClassificationCounts: Partial<
    Record<ContentGovernanceRecord['classification'], number>
  > = {};
  for (const r of classRows) {
    contentClassificationCounts[r.classification as ContentGovernanceRecord['classification']] =
      r.cnt;
  }

  const rateRow = await dbGet<RateRow>(
    `SELECT
       SUM(c.passed) AS passed_sum,
       COUNT(*) AS total
     FROM v8_compliance_checks c
     INNER JOIN v8_workspace_sessions s
       ON s.session_id = c.session_id AND s.organization_id = c.organization_id
     WHERE s.workspace_id = ? AND s.organization_id = ?`,
    [workspaceId, organizationId],
    { fallback: true }
  );

  const totalComplianceChecks = rateRow?.total ?? 0;
  const passedSum = rateRow?.passed_sum ?? 0;
  const compliancePassRate = totalComplianceChecks > 0 ? passedSum / totalComplianceChecks : null;

  return {
    permissionCountByRole,
    contentClassificationCounts,
    compliancePassRate,
    totalComplianceChecks,
  };
}
