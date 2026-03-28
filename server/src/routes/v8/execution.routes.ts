import type { Response } from 'express';
import { Router } from 'express';
import { ZodError } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import * as executionSpineService from '../../services/v8/executionSpineService.js';
import {
  type ProposalStatus,
  ProposalStatusValues,
  type RunState,
  RunStateValues,
} from '../../types/executionSpine.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

const RESOLVABLE_PROPOSAL_STATUSES: readonly ProposalStatus[] = [
  'approved',
  'rejected',
  'expired',
  'policy_allowed',
];

function parseLimit(raw: unknown, fallback: number = 50): number {
  const parsed = Number.parseInt(String(raw ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 200);
}

function isRunState(value: string): value is RunState {
  return (RunStateValues as readonly string[]).includes(value);
}

function isResolvableProposalStatus(value: string): value is ProposalStatus {
  return (RESOLVABLE_PROPOSAL_STATUSES as readonly string[]).includes(value);
}

function handleExecutionError(
  err: unknown,
  res: Response,
  fallbackMessage: string
): Response | null {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: fallbackMessage,
      code: 'VALIDATION_ERROR',
      details: err.issues,
    });
  }

  if (err instanceof Error) {
    if (err.message.includes('not found')) {
      return res.status(404).json({
        error: err.message,
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (
      err.message.includes('Cannot transition') ||
      err.message.includes('current status') ||
      err.message.includes('Invalid resolution status')
    ) {
      return res.status(409).json({
        error: err.message,
        code: 'EXECUTION_STATE_CONFLICT',
      });
    }
  }

  return null;
}

async function ensureRunExists(runId: string, organizationId: string, res: Response) {
  await executionSpineService.checkRunExpiration(runId, organizationId);
  const run = await executionSpineService.getRun(runId, organizationId);
  if (!run) {
    res.status(404).json({
      error: `Run ${runId} not found`,
      code: 'RUN_NOT_FOUND',
    });
    return null;
  }
  return run;
}

async function ensureProposalBelongsToRun(
  runId: string,
  proposalId: string,
  organizationId: string,
  res: Response
) {
  const proposals = await executionSpineService.getProposalsByRun(runId, organizationId);
  const proposal = proposals.find((item) => item.proposalId === proposalId);
  if (!proposal) {
    res.status(404).json({
      error: `Proposal ${proposalId} not found for run ${runId}`,
      code: 'PROPOSAL_NOT_FOUND',
    });
    return null;
  }
  return proposal;
}

router.get(
  '/runs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const active = String(req.query.active || '').toLowerCase() === 'true';
    const limit = parseLimit(req.query.limit);

    if (state && !isRunState(state)) {
      return res.status(400).json({
        error: `Invalid state "${state}"`,
        code: 'INVALID_QUERY_PARAM',
      });
    }

    const data = active
      ? await executionSpineService.getActiveRuns(organizationId)
      : await executionSpineService.getRunsByOrg(organizationId, state, limit);

    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/runs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await executionSpineService.createRun({
        ...req.body,
        organizationId,
        initiatorUserId: userId,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleExecutionError(err, res, 'Invalid execution run parameters');
      if (handled) return handled;
      throw err;
    }
  })
);

router.get(
  '/runs/:runId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const run = await ensureRunExists(req.params.runId, organizationId, res);
    if (!run) return;
    return res.json({ data: run, meta: { version: 'v8' } });
  })
);

router.get(
  '/runs/:runId/transitions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const run = await ensureRunExists(req.params.runId, organizationId, res);
    if (!run) return;

    const data = await executionSpineService.getRunTransitions(req.params.runId);
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.get(
  '/runs/:runId/proposals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const run = await ensureRunExists(req.params.runId, organizationId, res);
    if (!run) return;

    const data = await executionSpineService.getProposalsByRun(req.params.runId, organizationId);
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/runs/:runId/proposals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const run = await ensureRunExists(req.params.runId, organizationId, res);
    if (!run) return;

    try {
      const data = await executionSpineService.createProposal({
        ...req.body,
        executionRunId: req.params.runId,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleExecutionError(err, res, 'Invalid proposal parameters');
      if (handled) return handled;
      throw err;
    }
  })
);

router.post(
  '/runs/:runId/submit-review',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await executionSpineService.submitForReview(
        req.params.runId,
        organizationId,
        userId
      );
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleExecutionError(err, res, 'Unable to submit run for review');
      if (handled) return handled;
      throw err;
    }
  })
);

router.post(
  '/runs/:runId/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await executionSpineService.approveRun(
        req.params.runId,
        organizationId,
        userId,
        req.body?.reason
      );
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleExecutionError(err, res, 'Unable to approve run');
      if (handled) return handled;
      throw err;
    }
  })
);

router.post(
  '/runs/:runId/reject',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

    if (!reason) {
      return res.status(400).json({
        error: 'reason is required',
        code: 'VALIDATION_ERROR',
      });
    }

    try {
      const data = await executionSpineService.rejectRun(
        req.params.runId,
        organizationId,
        userId,
        reason
      );
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleExecutionError(err, res, 'Unable to reject run');
      if (handled) return handled;
      throw err;
    }
  })
);

router.post(
  '/runs/:runId/apply',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await executionSpineService.applyRun(req.params.runId, organizationId, userId);
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleExecutionError(err, res, 'Unable to apply run');
      if (handled) return handled;
      throw err;
    }
  })
);

router.post(
  '/runs/:runId/complete',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await executionSpineService.completeRun(
        req.params.runId,
        organizationId,
        userId
      );
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleExecutionError(err, res, 'Unable to complete run');
      if (handled) return handled;
      throw err;
    }
  })
);

router.post(
  '/runs/:runId/replan',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await executionSpineService.replanFromRejection(
        req.params.runId,
        organizationId,
        userId
      );
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleExecutionError(err, res, 'Unable to replan run');
      if (handled) return handled;
      throw err;
    }
  })
);

router.post(
  '/runs/:runId/proposals/resolve-batch',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { proposalIds, status } = req.body ?? {};

    if (!Array.isArray(proposalIds) || proposalIds.length === 0) {
      return res.status(400).json({
        error: 'proposalIds must be a non-empty array',
        code: 'VALIDATION_ERROR',
      });
    }

    if (typeof status !== 'string' || !isResolvableProposalStatus(status)) {
      return res.status(400).json({
        error: 'status must be one of approved, rejected, expired, policy_allowed',
        code: 'VALIDATION_ERROR',
      });
    }

    const run = await ensureRunExists(req.params.runId, organizationId, res);
    if (!run) return;

    const proposals = await executionSpineService.getProposalsByRun(
      req.params.runId,
      organizationId
    );
    const allowedIds = new Set(proposals.map((item) => item.proposalId));
    const hasForeignProposal = proposalIds.some(
      (proposalId: unknown) => !allowedIds.has(String(proposalId))
    );

    if (hasForeignProposal) {
      return res.status(404).json({
        error: 'One or more proposals do not belong to this run',
        code: 'PROPOSAL_NOT_FOUND',
      });
    }

    try {
      const data = await executionSpineService.resolveProposalsBatch(
        proposalIds.map((proposalId: unknown) => String(proposalId)),
        status,
        userId
      );
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleExecutionError(err, res, 'Unable to resolve proposals');
      if (handled) return handled;
      throw err;
    }
  })
);

router.post(
  '/runs/:runId/proposals/:proposalId/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { status } = req.body ?? {};

    if (typeof status !== 'string' || !isResolvableProposalStatus(status)) {
      return res.status(400).json({
        error: 'status must be one of approved, rejected, expired, policy_allowed',
        code: 'VALIDATION_ERROR',
      });
    }

    const run = await ensureRunExists(req.params.runId, organizationId, res);
    if (!run) return;

    const proposal = await ensureProposalBelongsToRun(
      req.params.runId,
      req.params.proposalId,
      organizationId,
      res
    );
    if (!proposal) return;

    try {
      const data = await executionSpineService.resolveProposal(
        req.params.proposalId,
        status,
        userId
      );
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleExecutionError(err, res, 'Unable to resolve proposal');
      if (handled) return handled;
      throw err;
    }
  })
);

export default router;
