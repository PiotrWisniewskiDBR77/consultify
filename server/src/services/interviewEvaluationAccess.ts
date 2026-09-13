import { createHash } from 'node:crypto';
import { AppError } from '../utils/ErrorHandler.js';
import * as db from '../utils/queryHelpers.js';
import { interviewAssignmentReviewAccess } from './interviewAssignmentReviewAccess.js';

type Actor = { id: string; organizationId: string; role?: string };
const fail = (status: number, code: string) =>
  new AppError('Interview evaluation is not available', status, code);

/** Evaluation is respondent work or explicit review authority, never a general read grant. */
export async function authorizeInterviewEvaluation(actor: Actor, sessionId: string, lock = false) {
  const member = await db.queryOne(
    'SELECT role, status FROM organization_members WHERE user_id = ? AND organization_id = ?',
    [actor.id, actor.organizationId]
  );
  if (!member || String(member.status).toUpperCase() !== 'ACTIVE') throw fail(403, 'FORBIDDEN');
  // Discover linkage without locking; acquire assignment then session, matching review writers.
  const discovered = await db.queryOne(
    'SELECT * FROM interview_sessions WHERE id = ? AND organization_id = ?',
    [sessionId, actor.organizationId]
  );
  if (!discovered) throw fail(404, 'NOT_FOUND');
  const assignments = await db.queryAll(
    `SELECT * FROM interview_assignments WHERE organization_id = ? AND (session_id = ? OR id = ?) ORDER BY id${lock ? ' FOR UPDATE' : ''}`,
    [actor.organizationId, sessionId, discovered.assignment_id || '']
  );
  if (assignments.length > 1) throw fail(409, 'INTERVIEW_LINK_CONFLICT');
  const assignment = assignments[0] || null;
  const session = lock
    ? await db.queryOne(
        'SELECT * FROM interview_sessions WHERE id = ? AND organization_id = ? FOR UPDATE',
        [sessionId, actor.organizationId]
      )
    : discovered;
  if (!session) throw fail(404, 'NOT_FOUND');
  if (
    (session.assignment_id && session.assignment_id !== assignment?.id) ||
    (assignment && assignment.session_id !== session.id)
  )
    throw fail(409, 'INTERVIEW_LINK_CONFLICT');
  if (assignment?.project_id && session.project_id && assignment.project_id !== session.project_id)
    throw fail(409, 'INTERVIEW_PROJECT_CONFLICT');
  const projectId = assignment?.project_id || session.project_id || null;
  if (
    projectId &&
    !(await db.queryOne('SELECT id FROM projects WHERE id = ? AND organization_id = ?', [
      projectId,
      actor.organizationId,
    ]))
  )
    throw fail(404, 'NOT_FOUND');
  const ownerId = session.owner_id || session.user_id;
  let respondent =
    String(ownerId || '') === actor.id ||
    Boolean(assignment && assignment.assignee_user_id === actor.id);
  if (!respondent && assignment)
    respondent = Boolean(
      await db.queryOne(
        'SELECT id FROM interview_assignment_members WHERE assignment_id = ? AND user_id = ?',
        [assignment.id, actor.id]
      )
    );
  if (!respondent) {
    if (!assignment) throw fail(403, 'FORBIDDEN');
    const review = await interviewAssignmentReviewAccess(actor, assignment.id, {
      lock,
      expectedSessionId: session.id,
      expectedProjectId: projectId,
    });
    if (!review.canReview) throw fail(403, 'FORBIDDEN');
  }
  return { session, assignment, projectId };
}

/** Includes persisted lifecycle/linkage and AI revision as well as every evaluated answer field. */
export function interviewEvaluationRevision(
  context: Awaited<ReturnType<typeof authorizeInterviewEvaluation>>,
  questions: unknown[]
) {
  return createHash('sha256')
    .update(JSON.stringify({ session: context.session, assignment: context.assignment, questions }))
    .digest('hex');
}
