/**
 * INT-08 — Interview (accepted submission OR accepted insight finding) →
 * canonical Candidate handoff routes.
 *
 * Mounted at `/api/interview/candidate-handoff` (Gateway.ts, alongside the
 * existing `/api/interview` router — a separate file/router rather than an
 * edit to the frozen `interview.routes.ts`/`interview-insights.routes.ts`,
 * so this packet never touches those files).
 *
 * Three endpoints PER source kind (submission | insight-finding):
 *   GET  .../submission/:assignmentId/preview        — read-only preview
 *   POST .../submission/:assignmentId/approve         — explicit approval (writes)
 *   GET  .../submission/:assignmentId                 — lineage read-back
 *   GET  .../insight-finding/:findingId/preview
 *   POST .../insight-finding/:findingId/approve
 *   GET  .../insight-finding/:findingId
 *
 * Same `INTERVIEW_ASSIGN_MANAGE` / `INTERVIEW_INSIGHTS_HANDOFF` capability
 * gates the existing manager-review / insight-handoff actions already use —
 * no new permission key introduced.
 */
import type { Response } from 'express';
import { Router } from 'express';

import { requirePermission } from '../middleware/permission.middleware.js';
import {
  InterviewCandidateHandoffError,
  approveInterviewCandidateHandoff,
  getInterviewCandidateHandoff,
  previewInterviewCandidate,
} from '../services/interview/interviewCandidateHandoff.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function requireUser(req: AuthenticatedRequest) {
  const user = req.user;
  if (!user) throw new Error('Unauthorized');
  return user;
}

function mapError(err: unknown): { status: number; body: Record<string, unknown> } | null {
  if (err instanceof InterviewCandidateHandoffError) {
    return {
      status: err.status,
      body: {
        error: err.message,
        code: err.code,
        ...(err.details ? { details: err.details } : {}),
      },
    };
  }
  return null;
}

router.get(
  '/submission/:assignmentId/preview',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const assignmentId = String(req.params.assignmentId || '');
    try {
      const preview = await previewInterviewCandidate({
        organizationId: user.organizationId,
        source: { kind: 'submission', assignmentId },
      });
      return res.json({ data: preview });
    } catch (err) {
      const mapped = mapError(err);
      if (mapped) return res.status(mapped.status).json(mapped.body);
      throw err;
    }
  })
);

router.post(
  '/submission/:assignmentId/approve',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const assignmentId = String(req.params.assignmentId || '');
    try {
      const result = await approveInterviewCandidateHandoff({
        organizationId: user.organizationId,
        actorId: user.id,
        source: { kind: 'submission', assignmentId },
      });
      return res.status(result.created ? 201 : 200).json({ data: result });
    } catch (err) {
      const mapped = mapError(err);
      if (mapped) return res.status(mapped.status).json(mapped.body);
      throw err;
    }
  })
);

router.get(
  '/submission/:assignmentId',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const assignmentId = String(req.params.assignmentId || '');
    const handoff = await getInterviewCandidateHandoff({
      organizationId: user.organizationId,
      sourceType: 'interview_submission',
      sourceId: assignmentId,
    });
    if (!handoff) {
      return res.status(404).json({
        error: 'No candidate handoff exists yet for this submission',
        code: 'NO_CANDIDATE_HANDOFF',
      });
    }
    return res.json({ data: handoff });
  })
);

router.get(
  '/insight-finding/:findingId/preview',
  requirePermission('INTERVIEW_INSIGHTS_HANDOFF'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const findingId = String(req.params.findingId || '');
    try {
      const preview = await previewInterviewCandidate({
        organizationId: user.organizationId,
        source: { kind: 'insight_finding', findingId },
      });
      return res.json({ data: preview });
    } catch (err) {
      const mapped = mapError(err);
      if (mapped) return res.status(mapped.status).json(mapped.body);
      throw err;
    }
  })
);

router.post(
  '/insight-finding/:findingId/approve',
  requirePermission('INTERVIEW_INSIGHTS_HANDOFF'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const findingId = String(req.params.findingId || '');
    try {
      const result = await approveInterviewCandidateHandoff({
        organizationId: user.organizationId,
        actorId: user.id,
        source: { kind: 'insight_finding', findingId },
      });
      return res.status(result.created ? 201 : 200).json({ data: result });
    } catch (err) {
      const mapped = mapError(err);
      if (mapped) return res.status(mapped.status).json(mapped.body);
      throw err;
    }
  })
);

router.get(
  '/insight-finding/:findingId',
  requirePermission('INTERVIEW_INSIGHTS_HANDOFF'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const findingId = String(req.params.findingId || '');
    const handoff = await getInterviewCandidateHandoff({
      organizationId: user.organizationId,
      sourceType: 'interview_insight_finding',
      sourceId: findingId,
    });
    if (!handoff) {
      return res.status(404).json({
        error: 'No candidate handoff exists yet for this insight finding',
        code: 'NO_CANDIDATE_HANDOFF',
      });
    }
    return res.json({ data: handoff });
  })
);

export default router;
