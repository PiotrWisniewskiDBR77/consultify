/**
 * AI Observability Admin Routes
 *
 * Unified observability dashboard endpoints for superadmin:
 * - Aggregated AI metrics (quality, latency, cost, safety, tools, RAG, feedback)
 * - Alert evaluation
 * - Grounding analytics
 */
import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { aiObservabilityService } from '../../services/ai/aiObservabilityService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

router.use(verifyToken);

const requireSuperAdmin = asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
  const userRole = req.user?.role;
  if (userRole !== 'super_admin' && userRole !== 'administrator' && userRole !== 'owner') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
});

router.use(requireSuperAdmin);

/**
 * GET /api/admin/ai-observability/metrics
 * Aggregated AI metrics for a time range
 */
router.get(
  '/metrics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { from, to, organization_id } = req.query;
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const defaultTo = now.toISOString();

    const orgId =
      (organization_id as string) || req.user?.organizationId || null;

    const metrics = await aiObservabilityService.getMetrics(
      orgId,
      (from as string) || defaultFrom,
      (to as string) || defaultTo
    );

    res.json({ success: true, data: metrics });
  })
);

/**
 * GET /api/admin/ai-observability/alerts
 * Check current alert status
 */
router.get(
  '/alerts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { from, to, organization_id } = req.query;
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const defaultTo = now.toISOString();

    const orgId =
      (organization_id as string) || req.user?.organizationId || null;

    const metrics = await aiObservabilityService.getMetrics(
      orgId,
      (from as string) || defaultFrom,
      (to as string) || defaultTo
    );

    const alerts = aiObservabilityService.checkAlerts(metrics);
    const triggered = alerts.filter((a) => a.triggered);

    res.json({
      success: true,
      data: {
        totalRules: alerts.length,
        triggeredCount: triggered.length,
        alerts: triggered.map((a) => ({
          metric: a.rule.metric,
          severity: a.rule.severity,
          threshold: a.rule.threshold,
          currentValue: a.currentValue,
          operator: a.rule.operator,
        })),
      },
    });
  })
);

export default router;
