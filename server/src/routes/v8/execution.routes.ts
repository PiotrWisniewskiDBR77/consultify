import type { Response } from 'express';
import { Router } from 'express';
import { ZodError } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import * as artifactRegistryService from '../../services/v8/artifactRegistryService.js';
import { getExecutionManagementSnapshot } from '../../services/v8/executionManagementSnapshotService.js';
import * as executionSpineService from '../../services/v8/executionSpineService.js';
import * as toolGovernanceService from '../../services/v8/toolGovernanceService.js';
import {
  type ProposalStatus,
  ProposalStatusValues,
  type RunState,
  RunStateValues,
} from '../../types/executionSpine.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet } from '../../utils/DbPromise.js';

const router = Router();

router.get(
  '/management/initiatives/:initiativeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const initiativeId = String(req.params.initiativeId || '').trim();
    const projectId =
      typeof req.query.projectId === 'string' ? req.query.projectId.trim() : undefined;
    const snapshot = await getExecutionManagementSnapshot(
      organizationId,
      initiativeId,
      projectId || undefined
    );
    if (!snapshot) {
      return res.status(404).json({
        error: 'Initiative not found',
        code: 'EXECUTION_MANAGEMENT_INITIATIVE_NOT_FOUND',
      });
    }
    return res.json({ data: snapshot });
  })
);

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

function isPrivilegedRole(role: string | null | undefined): boolean {
  const normalized = String(role || '').toUpperCase();
  return normalized === 'ADMIN' || normalized === 'OWNER' || normalized === 'SUPERADMIN';
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
        error: 'Resource not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    if (
      err.message.includes('Cannot transition') ||
      err.message.includes('current status') ||
      err.message.includes('Invalid resolution status')
    ) {
      return res.status(409).json({
        error: 'Invalid execution state transition',
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

async function ensureRunVisibleToUser(params: {
  runId: string;
  organizationId: string;
  userId: string;
  userRole: string;
  res: Response;
}): Promise<boolean> {
  if (isPrivilegedRole(params.userRole)) return true;

  const visible = await artifactRegistryService.listArtifactsForUserByExecutionRunId({
    organizationId: params.organizationId,
    executionRunId: params.runId,
    userId: params.userId,
    roleKey: params.userRole,
    limit: 1,
  });

  if (visible.length > 0) return true;

  params.res.status(404).json({
    error: `Run ${params.runId} not found`,
    code: 'RUN_NOT_FOUND',
  });
  return false;
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
    const initiativeId =
      typeof req.query.initiativeId === 'string' && req.query.initiativeId.trim()
        ? req.query.initiativeId.trim()
        : undefined;

    if (state && !isRunState(state)) {
      return res.status(400).json({
        error: `Invalid state "${state}"`,
        code: 'INVALID_QUERY_PARAM',
      });
    }
    if (initiativeId) {
      const initiative = await dbGet<{ id: string }>(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, organizationId],
        { fallback: true }
      );
      if (!initiative?.id) {
        return res.status(404).json({
          error: `Initiative ${initiativeId} not found`,
          code: 'INITIATIVE_NOT_FOUND',
        });
      }
    }

    let data;
    try {
      data = active
        ? await executionSpineService.getActiveRuns(organizationId, initiativeId)
        : await executionSpineService.getRunsByOrg(organizationId, state, limit, initiativeId);
    } catch {
      return res.status(500).json({
        error: 'Failed to load execution runs',
        code: 'EXECUTION_RUNS_READ_FAILED',
      });
    }

    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/runs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const metadata =
      req.body &&
      typeof req.body === 'object' &&
      req.body.metadata &&
      typeof req.body.metadata === 'object'
        ? (req.body.metadata as Record<string, unknown>)
        : null;
    const metadataInitiativeId = metadata?.initiativeId;
    const initiativeId =
      typeof metadataInitiativeId === 'string' && metadataInitiativeId.trim()
        ? metadataInitiativeId.trim()
        : undefined;
    if (initiativeId) {
      const initiative = await dbGet<{ id: string }>(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, organizationId],
        { fallback: true }
      );
      if (!initiative?.id) {
        return res.status(404).json({
          error: `Initiative ${initiativeId} not found`,
          code: 'INITIATIVE_NOT_FOUND',
        });
      }
    }

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
  '/runs/:runId/tool-usage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const run = await ensureRunExists(req.params.runId, organizationId, res);
    if (!run) return;

    const ok = await ensureRunVisibleToUser({
      runId: req.params.runId,
      organizationId,
      userId,
      userRole,
      res,
    });
    if (!ok) return;

    const data = await toolGovernanceService.getToolUsageByRun(req.params.runId, organizationId);
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.get(
  '/runs/:runId/outputs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const run = await ensureRunExists(req.params.runId, organizationId, res);
    if (!run) return;

    const limit = parseLimit(req.query.limit, 50);
    const data = await artifactRegistryService.listArtifactsForUserByExecutionRunId({
      organizationId,
      executionRunId: req.params.runId,
      userId,
      roleKey: userRole,
      limit,
    });

    if (!isPrivilegedRole(userRole) && data.length === 0) {
      return res.status(404).json({
        error: `Run ${req.params.runId} not found`,
        code: 'RUN_NOT_FOUND',
      });
    }

    return res.json({ data, meta: { version: 'v8' } });
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
