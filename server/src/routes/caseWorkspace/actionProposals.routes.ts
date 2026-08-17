/**
 * Case Workspace HTTP routes — proposalApprovalService
 * (server/src/services/caseWorkspace/proposalApprovalService.ts).
 *
 * Mounted at /api/v8/case-workspace/proposals (see caseWorkspace/index.ts).
 * Excludes computeProposalExpiryState/computeProposalTargetValidity (pure,
 * no-DB helpers per the task brief's exclusion list).
 *
 * RE-WIRE AFTER STREAM A MERGES: createActionProposal/
 * submitActionProposalForReview/recordApprovalDecision/
 * transitionProposalToExecuting/transitionProposalToExecuted/
 * transitionProposalToFailed/retryProposalFromFailed/markProposalAudited/
 * revokeApprovedProposal all take `actor: CaseActor` (or
 * `createdByActorId`/`decidedByActorId` inside their own input object)
 * already — `actor.actorUserId` is the wiring point throughout this file; no
 * structural change expected once Stream A retrofits the service itself.
 * By-id routes (everything under /:actionProposalId) resolve the owning
 * caseId via svc.getActionProposal first, since none of those service calls
 * take a caseId directly to authorize against.
 */

import { Router } from 'express';
import { z } from 'zod';

import * as svc from '../../services/caseWorkspace/proposalApprovalService.js';
import { executeGovernedCaseAction, requireCaseAccessForActor } from './_shared/access.js';
import { caseWorkspaceHandler, readIdempotencyKeyHeader } from './_shared/handler.js';
import { toCaseWorkspaceAppError } from './_shared/errors.js';
import { parseBody, parseParams, parseQuery } from './_shared/validate.js';
import type { CaseWorkspaceActor } from './_shared/handler.js';

const router = Router();

const effectClassEnum = z.enum([
  'SAFE_ADDITIVE',
  'SAFE_UPDATE',
  'SENSITIVE_UPDATE',
  'DESTRUCTIVE',
  'GOVERNANCE_TRANSITION',
]);
const proposerTypeEnum = z.enum(['HUMAN', 'AGENT', 'SYSTEM']);
const proposalStatusEnum = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'EXECUTING',
  'EXECUTED',
  'AUDITED',
  'REJECTED',
  'REQUESTED_CHANGES',
  'REVOKED',
  'FAILED',
]);
const decisionTypeEnum = z.enum(['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'DEFER']);
const decisionSourceEnum = z.enum(['BUTTON', 'CONVERSATIONAL', 'POLICY']);

const proposalIdParams = z.object({ actionProposalId: z.string().trim().min(1) });

async function requireCaseAccessForProposal(
  actor: CaseWorkspaceActor,
  actionProposalId: string
): Promise<svc.CaseActionProposal> {
  const proposal = await svc.getActionProposal(actionProposalId, actor.actorUserId);
  if (!proposal) {
    throw toCaseWorkspaceAppError(new Error('proposal_not_found'), actor.correlationId);
  }
  await requireCaseAccessForActor(actor, proposal.caseId);
  return proposal;
}

// POST /cases/:caseId/proposals — createActionProposal
const createProposalBody = z.object({
  runId: z.string().trim().min(1),
  nodeRunId: z.string().trim().min(1),
  casePlanVersionId: z.string().trim().min(1).nullable().optional(),
  capabilityRegistryId: z.string().trim().min(1).nullable().optional(),
  supersedesActionProposalId: z.string().trim().min(1).nullable().optional(),
  payloadDigest: z.string().trim().min(1),
  targetExpectedVersion: z.number().int().nullable().optional(),
  policySnapshotRef: z.string().trim().min(1),
  effectClass: effectClassEnum,
  previewRef: z.string().trim().min(1),
  expiresAt: z.string().trim().min(1).nullable().optional(),
  proposerType: proposerTypeEnum,
  idempotencyKey: z.string().trim().min(1).optional(),
});

router.post(
  '/cases/:caseId/proposals',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ caseId: z.string().trim().min(1) }), req.params);
    const body = parseBody(createProposalBody, req.body);
    const idempotencyKey = readIdempotencyKeyHeader(req) ?? body.idempotencyKey;
    if (!idempotencyKey) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Idempotency-Key header (or body.idempotencyKey) is required.',
        },
      });
      return;
    }
    await requireCaseAccessForActor(actor, params.caseId);
    const created = await svc.createActionProposal({
      ...body,
      caseId: params.caseId,
      idempotencyKey,
      createdByActorId: actor.actorUserId,
    });
    res.status(201).json({ data: created });
  })
);

// GET /cases/:caseId/proposals — listActionProposalsForCase
router.get(
  '/cases/:caseId/proposals',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ caseId: z.string().trim().min(1) }), req.params);
    const query = parseQuery(z.object({ status: proposalStatusEnum.optional() }), req.query);
    await requireCaseAccessForActor(actor, params.caseId);
    const items = await svc.listActionProposalsForCase(params.caseId, query, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

// GET /runs/:runId/proposals — listActionProposalsForRun
router.get(
  '/runs/:runId/proposals',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ runId: z.string().trim().min(1) }), req.params);
    const items = await svc.listActionProposalsForRun(params.runId, actor.actorUserId);
    // No case-scoped read exists on this service for a bare runId (the
    // service itself applies no org/case filter here — see this file's
    // top-of-file "re-wire after A merges" note). Authorize against every
    // distinct caseId actually present in the result rather than trusting
    // the runId alone; a run with proposals across a case the actor cannot
    // access fails closed for the WHOLE list (all-or-nothing), not
    // per-row filtering, to avoid silently hiding a partial result that
    // looks like a smaller but complete list.
    const caseIds = new Set(items.map((item) => item.caseId));
    for (const caseId of caseIds) {
      await requireCaseAccessForActor(actor, caseId);
    }
    res.status(200).json({ data: items });
  })
);

// GET /:actionProposalId
router.get(
  '/proposals/:actionProposalId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(proposalIdParams, req.params);
    const proposal = await requireCaseAccessForProposal(actor, params.actionProposalId);
    res.status(200).json({ data: proposal });
  })
);

// GET /:actionProposalId/decisions — listDecisionsForProposal
router.get(
  '/proposals/:actionProposalId/decisions',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(proposalIdParams, req.params);
    const items = await svc.listDecisionsForProposal(params.actionProposalId, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

const expectedVersionBody = z.object({ expectedVersion: z.number().int() });

// POST /:actionProposalId/submit-for-review — submitActionProposalForReview
router.post(
  '/proposals/:actionProposalId/submit-for-review',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(proposalIdParams, req.params);
    const body = parseBody(expectedVersionBody, req.body);
    await requireCaseAccessForProposal(actor, params.actionProposalId);
    const updated = await svc.submitActionProposalForReview(
      params.actionProposalId,
      { actorUserId: actor.actorUserId },
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// POST /:actionProposalId/decision — recordApprovalDecision
const recordDecisionBody = z.object({
  proposalVersion: z.number().int(),
  payloadDigest: z.string().trim().min(1),
  decision: decisionTypeEnum,
  source: decisionSourceEnum,
  authenticationAssurance: z.string().trim().min(1),
  approvalChannelPolicy: z.string().trim().min(1),
  conversationId: z.string().trim().min(1).nullable().optional(),
  sourceMessageId: z.string().trim().min(1).nullable().optional(),
  sourceMessageDigest: z.string().trim().min(1).nullable().optional(),
  policyVersion: z.string().trim().min(1),
  membershipSnapshotRef: z.string().trim().min(1).nullable().optional(),
  reason: z.string().trim().min(1).nullable().optional(),
  idempotencyKey: z.string().trim().min(1).optional(),
  expectedVersion: z.number().int(),
});

router.post(
  '/proposals/:actionProposalId/decision',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(proposalIdParams, req.params);
    const body = parseBody(recordDecisionBody, req.body);
    const idempotencyKey = readIdempotencyKeyHeader(req) ?? body.idempotencyKey;
    if (!idempotencyKey) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Idempotency-Key header (or body.idempotencyKey) is required.',
        },
      });
      return;
    }
    const { expectedVersion, ...decisionInput } = body;
    const result = await executeGovernedCaseAction({
      actor, actionId: 'case.proposal.decide', targetId: params.actionProposalId,
      operation: async () => {
        await requireCaseAccessForProposal(actor, params.actionProposalId);
        return svc.recordApprovalDecision(params.actionProposalId, { ...decisionInput, idempotencyKey, decidedByActorId: actor.actorUserId }, expectedVersion);
      },
    });
    res.status(200).json({ data: result });
  })
);

// POST /:actionProposalId/transition-to-executing
router.post(
  '/proposals/:actionProposalId/transition-to-executing',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(proposalIdParams, req.params);
    const body = parseBody(expectedVersionBody, req.body);
    const updated = await executeGovernedCaseAction({
      actor, actionId: 'case.proposal.execute', targetId: params.actionProposalId,
      operation: async () => {
        await requireCaseAccessForProposal(actor, params.actionProposalId);
        return svc.transitionProposalToExecuting(params.actionProposalId, { actorUserId: actor.actorUserId }, body.expectedVersion);
      },
    });
    res.status(200).json({ data: updated });
  })
);

// POST /:actionProposalId/transition-to-executed
router.post(
  '/proposals/:actionProposalId/transition-to-executed',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(proposalIdParams, req.params);
    const body = parseBody(expectedVersionBody, req.body);
    const updated = await svc.transitionProposalToExecuted(
      params.actionProposalId,
      { actorUserId: actor.actorUserId },
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// POST /:actionProposalId/transition-to-failed
const transitionToFailedBody = z.object({
  reason: z.string().trim().min(1),
  expectedVersion: z.number().int(),
});

router.post(
  '/proposals/:actionProposalId/transition-to-failed',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(proposalIdParams, req.params);
    const body = parseBody(transitionToFailedBody, req.body);
    await requireCaseAccessForProposal(actor, params.actionProposalId);
    const updated = await svc.transitionProposalToFailed(
      params.actionProposalId,
      { actorUserId: actor.actorUserId },
      body.reason,
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// POST /:actionProposalId/retry — retryProposalFromFailed
router.post(
  '/proposals/:actionProposalId/retry',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(proposalIdParams, req.params);
    const body = parseBody(expectedVersionBody, req.body);
    await requireCaseAccessForProposal(actor, params.actionProposalId);
    const updated = await svc.retryProposalFromFailed(
      params.actionProposalId,
      { actorUserId: actor.actorUserId },
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// POST /:actionProposalId/audit — markProposalAudited
router.post(
  '/proposals/:actionProposalId/audit',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(proposalIdParams, req.params);
    const body = parseBody(expectedVersionBody, req.body);
    await requireCaseAccessForProposal(actor, params.actionProposalId);
    const updated = await svc.markProposalAudited(
      params.actionProposalId,
      { actorUserId: actor.actorUserId },
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// POST /:actionProposalId/revoke — revokeApprovedProposal
const revokeBody = z.object({
  reason: z.string().trim().min(1),
  expectedVersion: z.number().int(),
});

router.post(
  '/proposals/:actionProposalId/revoke',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(proposalIdParams, req.params);
    const body = parseBody(revokeBody, req.body);
    const updated = await executeGovernedCaseAction({
      actor, actionId: 'case.proposal.revoke', targetId: params.actionProposalId,
      operation: async () => {
        await requireCaseAccessForProposal(actor, params.actionProposalId);
        return svc.revokeApprovedProposal(params.actionProposalId, { actorUserId: actor.actorUserId }, body.reason, body.expectedVersion);
      },
    });
    res.status(200).json({ data: updated });
  })
);

export default router;
