import { Router } from 'express';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { executiveAggregateService } from '../services/executiveAggregateService.js';

const router = Router();

/**
 * GET /api/executive/aggregate
 * Aggregated snapshot for ExecutionHub (Module 7) sections 7.1–7.6.
 *
 * Query params:
 * - projectId (required)
 * - period: week|month|quarter|custom (default: week)
 * - includeAI: true|false (default: true)
 * - refresh: true|false (default: false)
 * - modelId: optional LLM model id
 */
router.get(
  '/aggregate',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const orgId = req.organizationId || req.user?.organizationId;
    const userId = req.userId || req.user?.id;
    const projectId = String(req.query.projectId || '');
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    // Basic capability check: allow viewers/managers; disallow if explicit PBAC says no.
    // We keep this permissive because ExecutionHub itself is already behind auth routes in frontend.
    if (req.can && !req.can('ai_view_insights') && String(req.query.includeAI || 'true') === 'true') {
      // If user can't view AI insights, still return non-AI snapshot.
      req.query.includeAI = 'false';
    }

    const period = String(req.query.period || 'week') as any;
    const includeAI = String(req.query.includeAI || 'true') === 'true';
    const refresh = String(req.query.refresh || 'false') === 'true';
    const modelId = req.query.modelId ? String(req.query.modelId) : undefined;

    const snapshot = await executiveAggregateService.getSnapshot({
      organizationId: String(orgId),
      projectId,
      period,
      includeAI,
      refresh,
      userId: String(userId),
      modelId,
    });

    return res.json({ success: true, data: snapshot });
  })
);

export default router;

