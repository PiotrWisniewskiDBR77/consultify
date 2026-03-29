/**
 * V8 read-only Planning continuity bridge — org-scoped WBS snapshot, cross-initiative
 * dependencies, decision chains, and org-wide pending decision chains.
 * Namespace: /api/v8/planning (mounted by v8/index).
 *
 * @module routes/v8/planning.routes
 */

import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  getCriticalPath,
  getCrossInitiativeDependencies,
  getDecisionChainsByInitiative,
  getDecompositionTree,
  getPendingDecisions,
  validateWBSCompleteness,
} from '../../services/v8/planningContinuityService.js';
import {
  getInitiativeBudgetItemsRead,
  getInitiativeCommentsRead,
  getInitiativeDetailRead,
  getInitiativeGateReadinessRead,
  getInitiativeGateRolesRead,
  getInitiativeHistoryRead,
  getInitiativeIntangibleAssetsRead,
  getInitiativeKpisRead,
  getInitiativeRaidRead,
  getInitiativeResourcesRead,
  getInitiativeStakeholdersRead,
  getInitiativeStatusHistoryRead,
  getInitiativeTaskDependenciesRead,
  getInitiativeToolsRead,
  getInitiativeWatchersRead,
  getPortfolioRead,
} from '../../services/v8/planningPortfolioReadService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/** Stable contract id for clients parsing V8 planning continuity read responses. */
export const V8_PLANNING_READ_CONTRACT = 'planning_continuity_read_v1';

function planningMeta() {
  return { version: 'v8' as const, contract: V8_PLANNING_READ_CONTRACT };
}

const initiativeIdParamSchema = z.string().trim().min(1);

const firstParam = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

const arrayParam = (value: unknown): string[] | undefined => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return undefined;
};

/**
 * GET /api/v8/planning/initiatives/portfolio
 * Governed portfolio read envelope for the operator-facing list surface.
 */
router.get(
  '/initiatives/portfolio',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const portfolio = await getPortfolioRead(organizationId, {
      projectId: firstParam(req.query.projectId),
      programId: firstParam(req.query.programId),
      statuses: arrayParam(req.query.statuses) ?? firstParam(req.query.statuses),
      status: arrayParam(req.query.status) ?? firstParam(req.query.status),
      priority: arrayParam(req.query.priority) ?? firstParam(req.query.priority),
      search: firstParam(req.query.search),
    });

    return res.json({
      data: portfolio,
      meta: planningMeta(),
    });
  })
);

/**
 * GET /api/v8/planning/initiatives/:initiativeId
 * Governed initiative detail read for full-open/document flows.
 */
router.get(
  '/initiatives/:initiativeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id is required',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }

    const headers = req.headers || {};
    const acceptLang =
      (headers['accept-language'] as string) || (headers['Accept-Language'] as string) || 'en';
    const requestedLang = acceptLang.split(',')[0].split('-')[0].toLowerCase() || 'en';
    const supportedLangs = ['pl', 'en', 'de', 'es', 'ar', 'ja'];
    const lang = supportedLangs.includes(requestedLang) ? requestedLang : 'en';

    const initiative = await getInitiativeDetailRead(parsed.data, organizationId, lang);
    if (!initiative) {
      return res.status(404).json({ error: 'Initiative not found' });
    }

    return res.json({
      data: { initiative },
      meta: planningMeta(),
    });
  })
);

/**
 * GET /api/v8/planning/initiatives/:initiativeId/task-dependencies
 * Governed initiative document dependency read for the shared dependencies canvas.
 */
router.get(
  '/initiatives/:initiativeId/task-dependencies',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id is required',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }

    const dependencies = await getInitiativeTaskDependenciesRead(parsed.data, organizationId);
    return res.json({
      data: { dependencies },
      meta: planningMeta(),
    });
  })
);

router.get(
  '/initiatives/:initiativeId/watchers',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id is required',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }

    const watchers = await getInitiativeWatchersRead(parsed.data, organizationId);
    return res.json({
      data: { watchers },
      meta: planningMeta(),
    });
  })
);

router.get(
  '/initiatives/:initiativeId/stakeholders',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id is required',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }

    const stakeholders = await getInitiativeStakeholdersRead(parsed.data, organizationId);
    return res.json({
      data: { stakeholders },
      meta: planningMeta(),
    });
  })
);

router.get(
  '/initiatives/:initiativeId/gate-roles',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id is required',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }

    const roles = await getInitiativeGateRolesRead(parsed.data, organizationId);
    if (!roles) {
      return res.status(404).json({ error: 'Initiative not found' });
    }

    return res.json({
      data: { roles },
      meta: planningMeta(),
    });
  })
);

router.get(
  '/initiatives/:initiativeId/status-history',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id is required',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }

    const history = await getInitiativeStatusHistoryRead(parsed.data, organizationId);
    return res.json({
      data: { history },
      meta: planningMeta(),
    });
  })
);

router.get(
  '/initiatives/:initiativeId/history',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id is required',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }

    const events = await getInitiativeHistoryRead(parsed.data, organizationId);
    return res.json({
      data: { events },
      meta: planningMeta(),
    });
  })
);

router.get(
  '/initiatives/:initiativeId/comments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id is required',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }

    const comments = await getInitiativeCommentsRead(parsed.data, organizationId);
    return res.json({
      data: { comments },
      meta: planningMeta(),
    });
  })
);

router.get(
  '/initiatives/:initiativeId/gate-readiness-check',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id is required',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }

    const readiness = await getInitiativeGateReadinessRead(
      parsed.data,
      organizationId,
      req.user?.id,
      req.user?.role
    );
    if (!readiness) {
      return res.status(404).json({ error: 'Initiative not found' });
    }

    return res.json({
      data: { readiness },
      meta: planningMeta(),
    });
  })
);

router.get(
  '/initiatives/:initiativeId/resources',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id is required',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }

    const resources = await getInitiativeResourcesRead(parsed.data, organizationId);
    return res.json({
      data: { resources },
      meta: planningMeta(),
    });
  })
);

router.get(
  '/initiatives/:initiativeId/kpis',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id is required',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }

    const kpis = await getInitiativeKpisRead(parsed.data, organizationId);
    if (!kpis) {
      return res.status(404).json({ error: 'Initiative not found' });
    }

    return res.json({
      data: { kpis },
      meta: planningMeta(),
    });
  })
);

router.get(
  '/initiatives/:initiativeId/budget-items',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id is required',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }

    const budgetItems = await getInitiativeBudgetItemsRead(parsed.data, organizationId);
    return res.json({
      data: { budgetItems },
      meta: planningMeta(),
    });
  })
);

router.get(
  '/initiatives/:initiativeId/tools',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id is required',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }

    const tools = await getInitiativeToolsRead(parsed.data, organizationId);
    return res.json({
      data: { tools },
      meta: planningMeta(),
    });
  })
);

router.get(
  '/initiatives/:initiativeId/intangible-assets',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id is required',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }

    const intangibleAssets = await getInitiativeIntangibleAssetsRead(parsed.data, organizationId);
    return res.json({
      data: { intangibleAssets },
      meta: planningMeta(),
    });
  })
);

router.get(
  '/initiatives/:initiativeId/raid',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rawId = firstParam((req.params as { initiativeId?: string }).initiativeId);
    const parsed = initiativeIdParamSchema.safeParse(rawId);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Initiative id is required',
        code: 'PLANNING_INITIATIVE_ID_INVALID',
      });
    }

    const limitRaw = firstParam(req.query.limit);
    const limit = limitRaw ? Number(limitRaw) : 50;
    const items = await getInitiativeRaidRead(parsed.data, organizationId, limit);
    return res.json({
      data: { items },
      meta: planningMeta(),
    });
  })
);

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
        error: 'Initiative id is required',
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
  })
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
  })
);

export default router;
