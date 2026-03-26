/**
 * V8 read-only Interview bridge — org-scoped session listing/detail via existing interview loaders.
 * Namespace: /api/v8/interview (mounted by v8/index).
 *
 * @module routes/v8/interview.routes
 */

import { Router } from 'express';
import type { Response } from 'express';

import {
  InterviewController,
  loadAcceptedInterviewSessionsForManager,
  loadInterviewSessionForOrganization,
  loadInterviewSessionsForOrganization,
} from '../../controllers/InterviewController.js';
import {
  getManagedAssignments,
  getMyAssignments,
  getOverdueAssignments,
} from '../../services/InterviewAssignmentService.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/** Stable contract id for clients parsing V8 interview read responses. */
export const V8_INTERVIEW_READ_CONTRACT = 'interview_runtime_read_v1';

function interviewMeta() {
  return { version: 'v8' as const, contract: V8_INTERVIEW_READ_CONTRACT };
}

const firstParam = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

/**
 * GET /api/v8/interview/sessions?status=
 * Same org filter and status semantics as GET /api/interview/sessions.
 */
router.get(
  '/sessions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const sessions = await loadInterviewSessionsForOrganization(organizationId, req.query.status);
    return res.json({ data: { sessions }, meta: interviewMeta() });
  }),
);

/**
 * GET /api/v8/interview/sessions/accepted
 * Same manager-scoped accepted-sources semantics as GET /api/interview/sessions/accepted.
 */
router.get(
  '/sessions/accepted',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const sessions = await loadAcceptedInterviewSessionsForManager(organizationId, userId);
    return res.json({ data: { sessions }, meta: interviewMeta() });
  }),
);

/**
 * GET /api/v8/interview/sessions/:id
 * Same org-scoped access as GET /api/interview/sessions/:id.
 */
router.get(
  '/sessions/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const id = firstParam((req.params as { id?: string }).id);
    if (!id) {
      return res.status(400).json({ error: 'Session id is required', code: 'INTERVIEW_SESSION_ID_REQUIRED' });
    }

    const session = await loadInterviewSessionForOrganization(organizationId, id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found', code: 'INTERVIEW_SESSION_NOT_FOUND' });
    }

    return res.json({ data: { session }, meta: interviewMeta() });
  }),
);

/**
 * GET /api/v8/interview/assignments/my
 * Same assignee-scoped semantics as GET /api/interview/assignments/my.
 */
router.get(
  '/assignments/my',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const assignments = await getMyAssignments(userId, organizationId);
    return res.json({ data: { assignments }, meta: interviewMeta() });
  }),
);

/**
 * GET /api/v8/interview/assignments/managed
 * Same manager-scoped semantics as GET /api/interview/assignments/managed.
 */
router.get(
  '/assignments/managed',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const assignments = await getManagedAssignments(userId, organizationId);
    return res.json({ data: { assignments }, meta: interviewMeta() });
  }),
);

/**
 * GET /api/v8/interview/assignments/overdue
 * Same organization-scoped semantics as GET /api/interview/assignments/overdue.
 */
router.get(
  '/assignments/overdue',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const assignments = await getOverdueAssignments(organizationId);
    return res.json({ data: { assignments }, meta: interviewMeta() });
  }),
);

router.post('/assignments/:id/start', InterviewController.startAssignment);

router.post('/assignments/:id/submit', InterviewController.submitAssignment);

router.post('/assignments/:id/remind', InterviewController.sendAssignmentReminder);

router.post('/assignments/:id/send-back', InterviewController.sendBackAssignment);

router.post('/assignments/:id/approve', InterviewController.approveAssignment);

export default router;
