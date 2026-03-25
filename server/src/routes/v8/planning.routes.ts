/**
 * V8 read-only Planning continuity bridge — org-scoped WBS snapshot, cross-initiative
 * dependencies, decision chains, and org-wide pending decision chains.
 * Namespace: /api/v8/planning (mounted by v8/index).
 *
 * @module routes/v8/planning.routes
 */

import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  getCrossInitiativeDependencies,
  getCriticalPath,
  getDecisionChainsByInitiative,
  getDecompositionTree,
  getPendingDecisions,
  validateWBSCompleteness,
} from '../../services/v8/planningContinuityService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/** Stable contract id for clients parsing V8 planning continuity read responses. */
export const V8_PLANNING_READ_CONTRACT = 'planning_continuity_read_v1';

function planningMeta() {
  return { version: 'v8' as const, contract: V8_PLANNING_READ_CONTRACT };
}

const initiativeIdParamSchema = z.string().uuid();

const firstParam = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

/**
 * GET /api/v8/planning/initiatives/:initiativeId/snapshot
 * Aggregates decomposition tree, WBS completeness, critical-path proxy, cross-initiative
 * dependencies, and decision chains for the V8 org context.
 */
router.get(
  '/initiatives/:initiativeId/snapshot',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id must be a valid UUID',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }
    const initiativeId = parsed.data;

    const [
      decompositionTree,
      wbsCompleteness,
      criticalPath,
      crossInitiativeDependencies,
      decisionChains,
    ] = await Promise.all([
      getDecompositionTree(initiativeId, organizationId),
      validateWBSCompleteness(initiativeId, organizationId),
      getCriticalPath(initiativeId, organizationId),
      getCrossInitiativeDependencies(initiativeId, organizationId),
      getDecisionChainsByInitiative(initiativeId, organizationId),
    ]);

    return res.json({
      data: {
        initiativeId,
        decompositionTree,
        wbsCompleteness,
        criticalPath,
        crossInitiativeDependencies,
        decisionChains,
      },
      meta: planningMeta(),
    });
  }),
);

/**
 * GET /api/v8/planning/pending-decisions
 * Decision chains in the org that still have at least one pending decision entry.
 */
router.get(
  '/pending-decisions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const pendingDecisionChains = await getPendingDecisions(organizationId);
    return res.json({
      data: { pendingDecisionChains },
      meta: planningMeta(),
    });
  }),
);

export default router;
