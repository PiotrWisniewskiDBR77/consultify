/**
 * Project Membership IAM Service
 *
 * Centralised access-control, ownership validation, canonical role enforcement,
 * last-sponsor/leader protection and audit for project membership mutations.
 *
 * Design goals:
 *  - Enforce org → project ownership before any mutation.
 *  - Map membership requests to canonical ProjectRole values.
 *  - Protect required roles (PROJECT_SPONSOR, PROJECT_LEADER) from removal when last.
 *  - Emit audit events for all successful writes.
 */

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { normalizeProjectRole } from '../utils/roleNormalization.js';
import { hasEffectiveCapability, resolveEffectiveAccess } from './effectiveAccessService.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectIamDenialCode =
  | 'UNAUTHORIZED'
  | 'CAPABILITY_REQUIRED'
  | 'PROJECT_NOT_IN_ORG'
  | 'ALREADY_MEMBER'
  | 'USER_NOT_FOUND'
  | 'MEMBER_NOT_FOUND'
  | 'INVALID_PROJECT_ROLE'
  | 'LAST_SPONSOR_PROTECTED'
  | 'LAST_LEADER_PROTECTED';

export interface ProjectIamDenial {
  denied: true;
  code: ProjectIamDenialCode;
  message: string;
}

export interface ProjectIamSuccess {
  denied: false;
  normalizedRole: string;
}

export type ProjectIamResult = ProjectIamDenial | ProjectIamSuccess;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function deny(code: ProjectIamDenialCode, message: string): ProjectIamDenial {
  return { denied: true, code, message };
}

async function getProjectMembers(
  projectId: string
): Promise<Array<{ user_id: string; role: string; normalized_project_role?: string }>> {
  const rows = await dbAll<{ user_id: string; role: string; normalized_project_role?: string }>(
    `SELECT user_id, role, normalized_project_role FROM project_members WHERE project_id = ?`,
    [projectId],
    { fallback: true }
  );
  return rows || [];
}

async function emitAuditEvent(params: {
  organizationId: string;
  projectId: string;
  actorId: string;
  action: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await dbRun(
      `INSERT OR IGNORE INTO role_change_audit_events
        (id, organization_id, project_id, actor_id, action, resource_type, resource_id,
         before_json, after_json, created_at)
       VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, 'project_member', ?, ?, ?, datetime('now'))`,
      [
        params.organizationId,
        params.projectId,
        params.actorId,
        params.action,
        params.resourceId,
        params.before ? JSON.stringify(params.before) : null,
        params.after ? JSON.stringify(params.after) : null,
      ],
      { fallback: true }
    );
  } catch (err) {
    logger.warn('[ProjectMembershipIAM] audit write failed', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a member to a project.
 * Validates: org ownership of project, actor capability, canonical project role.
 */
export async function addProjectMemberViaIam(params: {
  actorId: string;
  actorRole: string;
  organizationId: string;
  projectId: string;
  targetUserId: string;
  projectRole: string;
  roleTemplateId?: string | null;
}): Promise<ProjectIamResult> {
  // Verify project belongs to the actor's org
  const project = await dbGet<{ id: string }>(
    `SELECT id FROM projects WHERE id = ? AND organization_id = ? LIMIT 1`,
    [params.projectId, params.organizationId],
    { fallback: true }
  );
  if (!project) {
    return deny('PROJECT_NOT_IN_ORG', 'Project not found in this organisation');
  }

  // Capability check
  const access = await resolveEffectiveAccess({
    userId: params.actorId,
    organizationId: params.organizationId,
    applicationRole: params.actorRole,
    projectId: params.projectId,
  });

  const canManageTeam =
    hasEffectiveCapability(access, 'project.team.manage') ||
    hasEffectiveCapability(access, 'admin.people.manage');

  if (!canManageTeam) {
    return deny(
      'CAPABILITY_REQUIRED',
      'Capability project.team.manage required to add project members'
    );
  }

  // Normalize to canonical project role
  const normalizedRole = normalizeProjectRole(params.projectRole);
  if (!normalizedRole) {
    return deny('INVALID_PROJECT_ROLE', `Unknown project role: ${params.projectRole}`);
  }

  return { denied: false, normalizedRole };
}

/**
 * Remove a member from a project.
 * Protects last PROJECT_SPONSOR and last PROJECT_LEADER.
 */
export async function removeProjectMemberViaIam(params: {
  actorId: string;
  actorRole: string;
  organizationId: string;
  projectId: string;
  targetMemberId: string;
}): Promise<ProjectIamResult> {
  const project = await dbGet<{ id: string }>(
    `SELECT id FROM projects WHERE id = ? AND organization_id = ? LIMIT 1`,
    [params.projectId, params.organizationId],
    { fallback: true }
  );
  if (!project) {
    return deny('PROJECT_NOT_IN_ORG', 'Project not found in this organisation');
  }

  const access = await resolveEffectiveAccess({
    userId: params.actorId,
    organizationId: params.organizationId,
    applicationRole: params.actorRole,
    projectId: params.projectId,
  });

  if (
    !hasEffectiveCapability(access, 'project.team.manage') &&
    !hasEffectiveCapability(access, 'admin.people.manage')
  ) {
    return deny('CAPABILITY_REQUIRED', 'Capability project.team.manage required');
  }

  // Last sponsor / leader protection
  const members = await getProjectMembers(params.projectId);
  const targetMember = members.find((m) => m.user_id === params.targetMemberId);
  if (!targetMember) {
    return deny('MEMBER_NOT_FOUND', 'Project member not found');
  }

  const targetRole = normalizeProjectRole(
    targetMember.normalized_project_role || targetMember.role
  );

  if (targetRole === 'PROJECT_SPONSOR') {
    const sponsors = members.filter(
      (m) => normalizeProjectRole(m.normalized_project_role || m.role) === 'PROJECT_SPONSOR'
    );
    if (sponsors.length <= 1) {
      return deny(
        'LAST_SPONSOR_PROTECTED',
        'Cannot remove the last PROJECT_SPONSOR from this project'
      );
    }
  }

  if (targetRole === 'PROJECT_LEADER') {
    const leaders = members.filter(
      (m) => normalizeProjectRole(m.normalized_project_role || m.role) === 'PROJECT_LEADER'
    );
    if (leaders.length <= 1) {
      return deny(
        'LAST_LEADER_PROTECTED',
        'Cannot remove the last PROJECT_LEADER from this project'
      );
    }
  }

  await emitAuditEvent({
    organizationId: params.organizationId,
    projectId: params.projectId,
    actorId: params.actorId,
    action: 'project_member_removed',
    resourceId: params.targetMemberId,
    before: { role: targetMember.role },
  });

  return { denied: false, normalizedRole: targetRole || params.targetMemberId };
}
