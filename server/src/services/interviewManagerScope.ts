import { getTableColumns } from '../utils/dbSchema.js';
import * as queryHelpers from '../utils/queryHelpers.js';

const ORG_WIDE_MANAGER_ROLES = ['SUPERADMIN', 'OWNER', 'ADMIN', 'PROJECT_MANAGER'] as const;
const PROJECT_MANAGER_ROLES = ['PMO_LEAD', 'WORKSTREAM_OWNER', 'INITIATIVE_OWNER', 'SPONSOR'] as const;

export type InterviewManagerScope =
  | { kind: 'organization' }
  | { kind: 'projects'; projectIds: string[] }
  | { kind: 'creator'; creatorId: string };

export function isOrgWideInterviewManagerRole(role?: string): boolean {
  return ORG_WIDE_MANAGER_ROLES.includes(String(role || '').toUpperCase() as any);
}

export async function resolveInterviewManagerScope(params: {
  userId: string;
  organizationId: string;
  role?: string;
}): Promise<InterviewManagerScope> {
  if (isOrgWideInterviewManagerRole(params.role)) {
    return { kind: 'organization' };
  }

  try {
    const projectMemberColumns = await getTableColumns('project_members');
    const hasProjectMembersTable = projectMemberColumns.size > 0;
    if (!hasProjectMembersTable || !projectMemberColumns.has('project_id')) {
      return { kind: 'creator', creatorId: params.userId };
    }

    const roleColumn = projectMemberColumns.has('project_role')
      ? 'project_role'
      : projectMemberColumns.has('role')
        ? 'role'
        : null;
    if (!roleColumn) {
      return { kind: 'creator', creatorId: params.userId };
    }

    const placeholders = PROJECT_MANAGER_ROLES.map(() => '?').join(', ');
    const rows = await queryHelpers.queryAll<{ project_id: string }>(
      `SELECT DISTINCT pm.project_id
       FROM project_members pm
       INNER JOIN projects p ON p.id = pm.project_id
       WHERE pm.user_id = ?
         AND p.organization_id = ?
         AND UPPER(COALESCE(pm.${roleColumn}, '')) IN (${placeholders})`,
      [params.userId, params.organizationId, ...PROJECT_MANAGER_ROLES]
    );

    const projectIds = (rows || [])
      .map((row) => String(row.project_id || '').trim())
      .filter(Boolean);
    if (projectIds.length > 0) {
      return { kind: 'projects', projectIds };
    }
  } catch {
    // Fall back to creator scope if project-role resolution is unavailable.
  }

  return { kind: 'creator', creatorId: params.userId };
}

export function buildAssignmentManagerScopeClause(
  scope: InterviewManagerScope,
  options?: { assignmentAlias?: string }
): { clause: string; params: unknown[] } {
  const assignmentAlias = options?.assignmentAlias || 'a';
  if (scope.kind === 'organization') {
    return { clause: '', params: [] };
  }
  if (scope.kind === 'creator') {
    return {
      clause: ` AND ${assignmentAlias}.created_by = ?`,
      params: [scope.creatorId],
    };
  }
  return {
    clause: ` AND ${assignmentAlias}.project_id IN (${scope.projectIds
      .map(() => '?')
      .join(', ')})`,
    params: scope.projectIds,
  };
}

export function buildSessionManagerScopeClause(
  scope: InterviewManagerScope,
  options?: { assignmentAlias?: string; sessionProjectColumn?: string }
): { clause: string; params: unknown[] } {
  const assignmentAlias = options?.assignmentAlias || 'a';
  const sessionProjectColumn = options?.sessionProjectColumn || 's.project_id';
  if (scope.kind === 'organization') {
    return { clause: '', params: [] };
  }
  if (scope.kind === 'creator') {
    return {
      clause: ` AND ${assignmentAlias}.created_by = ?`,
      params: [scope.creatorId],
    };
  }
  return {
    clause: ` AND ${sessionProjectColumn} IN (${scope.projectIds.map(() => '?').join(', ')})`,
    params: scope.projectIds,
  };
}

export { ORG_WIDE_MANAGER_ROLES, PROJECT_MANAGER_ROLES };
