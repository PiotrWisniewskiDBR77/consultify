import type { NextFunction, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  getGovernedProposalProjection,
  rebaselineGovernedProposal,
  rejectProposalScope,
  requestProposalRevision,
  reviewProposalScope,
  reviseGovernedProposal,
} from '../../services/v8/agentProposalGovernanceService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
const idSchema = z.string().trim().min(1).max(256);
const reasonSchema = z.string().trim().min(1).max(2000);
const expiresAtSchema = z.string().datetime({ offset: true });

type GovernanceErrorResponse = { status: number; code: string };

function governanceError(error: unknown): GovernanceErrorResponse {
  const code = error instanceof Error ? error.message : 'proposal_governance_failed';
  if (code === 'governed_proposal_not_found')
    return { status: 404, code: 'GOVERNED_PROPOSAL_NOT_FOUND' };
  if (code === 'proposal_reviewer_not_authorized')
    return { status: 403, code: 'PROPOSAL_REVIEWER_NOT_AUTHORIZED' };
  if (code === 'governed_proposal_expired')
    return { status: 410, code: 'GOVERNED_PROPOSAL_EXPIRED' };
  if (
    [
      'governed_proposal_not_reviewable',
      'proposal_revision_not_requested',
      'proposal_rebaseline_not_allowed',
      'proposal_rebaseline_unchanged',
    ].includes(code)
  )
    return { status: 409, code: code.toUpperCase() };
  if (
    [
      'proposal_scope_not_found',
      'proposal_review_reason_required',
      'proposal_expiry_must_be_future',
      'proposal_plan_version_invalid',
      'proposal_context_digest_required',
    ].includes(code)
  )
    return { status: 400, code: code.toUpperCase() };
  return { status: 500, code: 'PROPOSAL_GOVERNANCE_FAILED' };
}

function sendGovernanceError(res: Response, error: unknown) {
  const mapped = governanceError(error);
  return res.status(mapped.status).json({ code: mapped.code });
}

// This router is normally mounted behind verifyToken + attachV8Context. Keep
// direct mounting fail-closed so missing auth can never become an unscoped call.
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    getV8Context(req);
    next();
  } catch {
    res.status(401).json({ code: 'AUTHENTICATION_REQUIRED' });
  }
});

router.get(
  '/:proposalVersionId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const proposalVersionId = idSchema.safeParse(req.params.proposalVersionId);
    if (!proposalVersionId.success)
      return res.status(400).json({ code: 'INVALID_PROPOSAL_VERSION_ID' });
    const { organizationId } = getV8Context(req);
    try {
      const data = await getGovernedProposalProjection({
        proposalVersionId: proposalVersionId.data,
        organizationId,
      });
      return res.json({ data });
    } catch (error) {
      return sendGovernanceError(res, error);
    }
  })
);

const reviewSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'revision_requested']),
  reason: reasonSchema,
});

router.post(
  '/:proposalVersionId/scopes/:scopeKey/review',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const params = z
      .object({ proposalVersionId: idSchema, scopeKey: idSchema })
      .safeParse(req.params);
    const body = reviewSchema.safeParse(req.body);
    if (!params.success || !body.success)
      return res.status(400).json({ code: 'INVALID_PROPOSAL_SCOPE_REVIEW' });
    const { organizationId, userId } = getV8Context(req);
    try {
      const data = await reviewProposalScope({
        ...params.data,
        ...body.data,
        organizationId,
        actorUserId: userId,
      });
      return res.json({ data });
    } catch (error) {
      return sendGovernanceError(res, error);
    }
  })
);

function scopedDecisionRoute(decision: 'rejected' | 'revision_requested') {
  return asyncHandler(async (req: AuthRequest, res: Response) => {
    const params = z
      .object({ proposalVersionId: idSchema, scopeKey: idSchema })
      .safeParse(req.params);
    const body = z.object({ reason: reasonSchema }).safeParse(req.body);
    if (!params.success || !body.success)
      return res.status(400).json({ code: 'INVALID_PROPOSAL_SCOPE_REVIEW' });
    const { organizationId, userId } = getV8Context(req);
    const input = {
      ...params.data,
      reason: body.data.reason,
      organizationId,
      actorUserId: userId,
    };
    try {
      const data =
        decision === 'rejected'
          ? await rejectProposalScope(input)
          : await requestProposalRevision(input);
      return res.json({ data });
    } catch (error) {
      return sendGovernanceError(res, error);
    }
  });
}

router.post('/:proposalVersionId/scopes/:scopeKey/reject', scopedDecisionRoute('rejected'));
router.post(
  '/:proposalVersionId/scopes/:scopeKey/request-revision',
  scopedDecisionRoute('revision_requested')
);

router.post(
  '/:proposalVersionId/revise',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const params = z.object({ proposalVersionId: idSchema }).safeParse(req.params);
    const body = z
      .object({
        after: z.record(z.string(), z.unknown()),
        expiresAt: expiresAtSchema,
        reason: reasonSchema,
      })
      .safeParse(req.body);
    if (!params.success || !body.success)
      return res.status(400).json({ code: 'INVALID_PROPOSAL_REVISION' });
    const { organizationId, userId } = getV8Context(req);
    try {
      const data = await reviseGovernedProposal({
        ...params.data,
        ...body.data,
        organizationId,
        actorUserId: userId,
      });
      return res.status(201).json({ data });
    } catch (error) {
      return sendGovernanceError(res, error);
    }
  })
);

router.post(
  '/:proposalVersionId/rebaseline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const params = z.object({ proposalVersionId: idSchema }).safeParse(req.params);
    const body = z
      .object({
        planVersion: z.number().int().positive(),
        contextDigest: z.string().trim().min(1).max(512),
        expiresAt: expiresAtSchema,
        reason: reasonSchema,
      })
      .safeParse(req.body);
    if (!params.success || !body.success)
      return res.status(400).json({ code: 'INVALID_PROPOSAL_REBASELINE' });
    const { organizationId, userId } = getV8Context(req);
    try {
      const data = await rebaselineGovernedProposal({
        ...params.data,
        ...body.data,
        organizationId,
        actorUserId: userId,
      });
      return res.status(201).json({ data });
    } catch (error) {
      return sendGovernanceError(res, error);
    }
  })
);

export default router;
