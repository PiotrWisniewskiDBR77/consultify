/**
 * V8 read-only execution control bridge — org-scoped risk, timeline warnings,
 * delay signals, capacity reads, and portfolio budget/overspend views.
 * Namespace: /api/v8/execution-control (mounted by v8/index).
 *
 * Delegates to the same services as legacy `/api/execution-control` GET handlers.
 *
 * @module routes/v8/execution-control.routes
 */

import { Router } from 'express';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  detectOverspendSignals,
  getPortfolioBudgetSummary,
} from '../../services/executionBudgetService.js';
import { getTimelineWarningsSnapshot } from '../../services/executionControlReadService.js';
import {
  detectDelaySignals,
  getPersistedDelaySignals,
} from '../../services/delayDetectionService.js';
import { detectRiskSignals } from '../../services/riskDetectionService.js';
import {
  getCapacityTimeline,
  getLevelingAlerts,
} from '../../services/workloadCapacityService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/** Stable contract id for V8 execution-control read responses. */
export const V8_EXECUTION_CONTROL_READ_CONTRACT = 'execution_control_read_v1';

function executionControlMeta() {
  return { version: 'v8' as const, contract: V8_EXECUTION_CONTROL_READ_CONTRACT };
}

const firstQueryString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

/**
 * GET /api/v8/execution-control/risk-signals
 * Heuristic risk signals for the V8 org (optional project filter).
 */
router.get(
  '/risk-signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const projectId = firstQueryString(req.query.projectId);
    const signals = await detectRiskSignals(organizationId, projectId);
    return res.json({
      data: { signals, count: signals.length },
      meta: executionControlMeta(),
    });
  }),
);

/**
 * GET /api/v8/execution-control/timeline-warnings
 * Top overdue/blocked initiative warnings (legacy-compatible computation).
 */
router.get(
  '/timeline-warnings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const projectId = firstQueryString(req.query.projectId);
    const { warnings, total } = await getTimelineWarningsSnapshot(organizationId, projectId);
    return res.json({
      data: { warnings, total },
      meta: executionControlMeta(),
    });
  }),
);

/**
 * GET /api/v8/execution-control/delay-signals
 * Live or persisted delay signals (`persisted=true` for stored rows).
 */
router.get(
  '/delay-signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const projectId = firstQueryString(req.query.projectId);
    const severity = firstQueryString(req.query.severity) as 'WARNING' | 'CRITICAL' | undefined;
    const entityType = firstQueryString(req.query.entityType) as 'INITIATIVE' | 'TASK' | undefined;
    const persisted = firstQueryString(req.query.persisted) === 'true';

    if (persisted) {
      const signals = await getPersistedDelaySignals(organizationId, {
        projectId,
        severity,
        entityType,
      });
      return res.json({
        data: { signals, count: signals.length, source: 'persisted' as const },
        meta: executionControlMeta(),
      });
    }

    const signals = await detectDelaySignals(organizationId, projectId);
    const filtered = signals.filter((s) => {
      if (severity && s.severity !== severity) return false;
      if (entityType && s.entityType !== entityType) return false;
      return true;
    });
    return res.json({
      data: { signals: filtered, count: filtered.length, source: 'live' as const },
      meta: executionControlMeta(),
    });
  }),
);

/**
 * GET /api/v8/execution-control/capacity/leveling-alerts
 */
router.get(
  '/capacity/leveling-alerts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const alerts = await getLevelingAlerts(organizationId);
    return res.json({
      data: { alerts },
      meta: executionControlMeta(),
    });
  }),
);

/**
 * GET /api/v8/execution-control/capacity/timeline
 */
router.get(
  '/capacity/timeline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const initiativeId = firstQueryString(req.query.initiativeId);
    const weeks = await getCapacityTimeline(organizationId, initiativeId);
    return res.json({
      data: { weeks },
      meta: executionControlMeta(),
    });
  }),
);

/**
 * GET /api/v8/execution-control/budget/portfolio
 */
router.get(
  '/budget/portfolio',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const projectId = firstQueryString(req.query.projectId);
    const summary = await getPortfolioBudgetSummary(organizationId, projectId);
    return res.json({
      data: { summary },
      meta: executionControlMeta(),
    });
  }),
);

/**
 * GET /api/v8/execution-control/budget/overspend-signals
 */
router.get(
  '/budget/overspend-signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const projectId = firstQueryString(req.query.projectId);
    const signals = await detectOverspendSignals(organizationId, projectId);
    return res.json({
      data: { signals, count: signals.length },
      meta: executionControlMeta(),
    });
  }),
);

export default router;
