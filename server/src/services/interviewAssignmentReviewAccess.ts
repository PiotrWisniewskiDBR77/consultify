import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { getStore } from '../utils/RequestStore.js';
import { AppError } from '../utils/ErrorHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import { evaluateEffectiveCapability, resolveEffectiveAccess } from './effectiveAccessService.js';
import { isOrgWideInterviewManagerRole } from './interviewManagerScope.js';
import { hasPermission, type Role } from './permissionService.js';

type Actor = { id: string; organizationId: string; role?: string };
const fail = (status: number, code: string) =>
  new AppError('Interview review is not available', status, code);

/** Review-only policy. Caller input never supplies the project being authorized. */
export async function interviewAssignmentReviewAccess(
  actor: Actor,
  assignmentId: string,
  options: { lock?: boolean; expectedSessionId?: string; expectedProjectId?: string | null } = {}
) {
  const assignment = await queryHelpers.queryOne(
    `SELECT id, project_id, session_id FROM interview_assignments WHERE id = ? AND organization_id = ?${options.lock ? ' FOR UPDATE' : ''}`,
    [assignmentId, actor.organizationId]
  );
  if (!assignment) throw fail(404, 'NOT_FOUND');
  const session = await queryHelpers.queryOne(
    `SELECT id, project_id FROM interview_sessions WHERE id = ? AND organization_id = ?${options.lock ? ' FOR UPDATE' : ''}`,
    [assignment.session_id, actor.organizationId]
  );
  if (!session) throw fail(404, 'NOT_FOUND');
  if (assignment.project_id && session.project_id && assignment.project_id !== session.project_id)
    throw fail(409, 'INTERVIEW_PROJECT_CONFLICT');
  const projectId: string | null = assignment.project_id || session.project_id || null;
  if (
    projectId &&
    !(await queryHelpers.queryOne('SELECT id FROM projects WHERE id = ? AND organization_id = ?', [
      projectId,
      actor.organizationId,
    ]))
  )
    throw fail(404, 'NOT_FOUND');
  if (
    options.expectedSessionId !== undefined &&
    (session.id !== options.expectedSessionId || projectId !== options.expectedProjectId)
  )
    throw fail(409, 'INTERVIEW_PROJECT_CONFLICT');

  // Preserve explicit legacy DENY; absence of MANAGE is not a deny of scoped review.
  const denied = await queryHelpers.queryOne(
    `SELECT permission_key FROM org_user_permissions WHERE user_id = ? AND organization_id = ? AND permission_key IN ('INTERVIEW_ASSIGN_MANAGE', 'INTERVIEW_INSIGHTS_REVIEW') AND grant_type <> 'GRANT'`,
    [actor.id, actor.organizationId]
  );
  // The second check is a new authorization decision, not a reuse of the preflight.
  if (options.lock)
    getStore()?.memo.delete(
      JSON.stringify([
        'effectiveAccess',
        actor.id,
        actor.organizationId,
        actor.role ?? null,
        projectId,
        false,
      ])
    );
  const access = await resolveEffectiveAccess({
    userId: actor.id,
    organizationId: actor.organizationId,
    applicationRole: actor.role,
    projectId,
  });
  const bypass = access.platformRole === 'SUPERADMIN' || access.applicationRole === 'OWNER';
  if (denied && !bypass) return { canReview: false, projectId, sessionId: session.id };
  if (access.warnings.includes('NO_ACTIVE_ORGANIZATION_MEMBERSHIP'))
    return { canReview: false, projectId, sessionId: session.id };

  // Legacy org managers retain their existing lane; arbitrary create grants do not.
  const currentRole = await currentInterviewOrganizationRole(actor);
  const legacyManager =
    isOrgWideInterviewManagerRole(currentRole) &&
    (await hasPermission(
      actor.id,
      actor.organizationId,
      'INTERVIEW_ASSIGN_MANAGE',
      currentRole as Role
    ));
  const explicitReview = await queryHelpers.queryOne(
    `SELECT permission_key FROM org_user_permissions WHERE user_id = ? AND organization_id = ? AND permission_key = 'INTERVIEW_INSIGHTS_REVIEW' AND grant_type = 'GRANT'`,
    [actor.id, actor.organizationId]
  );
  // Do not reinterpret ownership-only grants as review authority.
  const capabilities = access.capabilities.filter(
    (c) => !['.own', '.assigned', '.delegated'].some((suffix) => c.endsWith(suffix))
  );
  const decision = await evaluateEffectiveCapability(
    { ...access, capabilities },
    'interview.assignment.review',
    {
      requireOwnership: true,
      ownerPredicate: async () =>
        Boolean(
          projectId &&
          (await queryHelpers.queryOne(
            'SELECT project_id FROM project_members WHERE project_id = ? AND user_id = ?',
            [projectId, actor.id]
          ))
        ),
    }
  );
  return {
    canReview: Boolean(legacyManager || explicitReview || decision.allowed),
    projectId,
    sessionId: session.id,
  };
}

export async function assertInterviewAssignmentReviewAccess(
  actor: Actor,
  id: string,
  options: Parameters<typeof interviewAssignmentReviewAccess>[2] = {}
) {
  const result = await interviewAssignmentReviewAccess(actor, id, options);
  if (!result.canReview) throw fail(403, 'FORBIDDEN');
  return result;
}

/** Preserve existing readers and allow a scoped reviewer to open only their review object. */
export async function requireInterviewAssignmentReviewRead(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const user = req.user;
    if (!user?.id || !user.organizationId) throw fail(401, 'UNAUTHORIZED');
    const actor = { id: user.id, organizationId: user.organizationId, role: user.role };
    const role = await currentInterviewOrganizationRole(actor);
    const legacyRead =
      (await hasPermission(
        actor.id,
        actor.organizationId,
        'INTERVIEW_ASSIGN_VIEW',
        role as Role
      )) ||
      (await hasPermission(
        actor.id,
        actor.organizationId,
        'INTERVIEW_ASSIGN_MANAGE',
        role as Role
      ));
    if (!legacyRead) await assertInterviewAssignmentReviewAccess(actor, req.params.id);
    next();
  } catch (error) {
    next(error);
  }
}

async function currentInterviewOrganizationRole(actor: Actor): Promise<string> {
  // Preserve the existing platform SUPERADMIN lane; ordinary token roles are not authority.
  if (actor.role === 'SUPERADMIN') return 'SUPERADMIN';
  const membership = await queryHelpers.queryOne(
    'SELECT role, status FROM organization_members WHERE user_id = ? AND organization_id = ?',
    [actor.id, actor.organizationId]
  );
  if (!membership || String(membership.status).toUpperCase() !== 'ACTIVE')
    throw fail(403, 'FORBIDDEN');
  return String(membership.role || '').toUpperCase();
}
