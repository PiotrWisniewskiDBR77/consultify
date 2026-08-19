import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import {
  createMaterializationProposal,
  decideMaterializationProposal,
  getAgentPlanSourceIdentity,
  listMaterializationProposals,
  materializeApprovedProposal,
} from '../../services/myWork/agentApprovedMaterializationService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireUser } from './_helpers.js';

const router = Router();
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const idempotency = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const content = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(20_000).optional(),
  body: z.string().max(100_000).optional(),
}).strict();

function sendError(res: any, error: unknown) {
  const code = error instanceof Error ? error.message : 'MYW_AGENT_INTERNAL';
  const status = code.includes('NOT_FOUND') ? 404
    : code.includes('COLLISION') || code.includes('STALE') || code.includes('DRIFT') || code.includes('SELF_APPROVAL') || code.includes('EXPIRED') ? 409
      : code.includes('MEMBERSHIP') || code.includes('FORBIDDEN') ? 403 : code.startsWith('MYW_AGENT_') ? 422 : 500;
  res.status(status).json({ status: 'fail', error: { code } });
}

router.get('/agent-materialization/source/:planId', asyncHandler(async (req: AuthRequest, res) => {
  const identity = requireUser(req, res);
  if (!identity) return;
  try {
    res.json(await getAgentPlanSourceIdentity(identity.orgId, String(req.params.planId), identity.userId));
  } catch (error) { sendError(res, error); }
}));

router.get('/agent-materialization/proposals', asyncHandler(async (req: AuthRequest, res) => {
  const identity = requireUser(req, res);
  if (!identity) return;
  const parsed = z.object({ sourcePlanId: z.string().min(1).max(128).optional() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ status: 'fail', error: { code: 'MYW_AGENT_INPUT_INVALID' } });
  try {
    res.json(await listMaterializationProposals({ organizationId: identity.orgId, userId: identity.userId,
      sourcePlanId: parsed.data.sourcePlanId }));
  } catch (error) { sendError(res, error); }
}));

router.post('/agent-materialization/proposals', asyncHandler(async (req: AuthRequest, res) => {
  const identity = requireUser(req, res);
  if (!identity) return;
  const parsed = z.object({ sourcePlanId: z.string().min(1).max(128), sourceVersion: z.number().int().positive(),
    sourceHash: hash, targetKind: z.enum(['task','decision','notebook']), content,
    idempotencyKey: idempotency, expiresAt: z.string().datetime() }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ status: 'fail', error: { code: 'MYW_AGENT_INPUT_INVALID' } });
  try {
    const result = await createMaterializationProposal({ ...parsed.data, organizationId: identity.orgId, requesterId: identity.userId });
    res.status(result.replayed ? 200 : 201).json(result);
  } catch (error) { sendError(res, error); }
}));

router.post('/agent-materialization/proposals/:proposalId/decision', asyncHandler(async (req: AuthRequest, res) => {
  const identity = requireUser(req, res);
  if (!identity) return;
  const parsed = z.object({ decision: z.enum(['APPROVE','REJECT']), expectedStateVersion: z.number().int().positive(),
    sourceHash: hash }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ status: 'fail', error: { code: 'MYW_AGENT_INPUT_INVALID' } });
  try {
    res.json(await decideMaterializationProposal({ ...parsed.data, proposalId: String(req.params.proposalId),
      organizationId: identity.orgId, approverId: identity.userId }));
  } catch (error) { sendError(res, error); }
}));

router.post('/agent-materialization/proposals/:proposalId/materialize', asyncHandler(async (req: AuthRequest, res) => {
  const identity = requireUser(req, res);
  if (!identity) return;
  const parsed = z.object({ expectedStateVersion: z.number().int().positive() }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ status: 'fail', error: { code: 'MYW_AGENT_INPUT_INVALID' } });
  try {
    res.json(await materializeApprovedProposal({ proposalId: String(req.params.proposalId), organizationId: identity.orgId,
      actorId: identity.userId, expectedStateVersion: parsed.data.expectedStateVersion }));
  } catch (error) { sendError(res, error); }
}));

export default router;
