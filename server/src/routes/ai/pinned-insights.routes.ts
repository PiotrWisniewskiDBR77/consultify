/**
 * Pinned Insights Routes
 *
 * Wires the previously-orphaned pinnedInsightsService (server/src/services/ai/pinnedInsightsService.ts)
 * to CRUD endpoints. Lets users bookmark key insights from AI conversations; pinned insights are
 * scoped to the organization and can optionally be shared with teammates.
 *
 * DB: table `pinned_insights` already exists on the live schema — created by
 * server/migrations/672_enterprise_agent_planner.sql (well below the current migration head,
 * ~930), autorun by DatabaseInitializer. No new migration needed.
 *
 * NOT hooked into the main chat pipeline (server/src/routes/ai.routes.ts, ~9k lines) — that file
 * is frozen per mandate. This is a standalone, client-opt-in endpoint.
 *
 * INTEGRATOR: mount this in server/src/routes/ai/index.ts:
 *   import pinnedInsightsRoutes from './pinned-insights.routes.js';
 *   ...
 *   router.use('/pinned-insights', pinnedInsightsRoutes);
 * Resulting paths: GET/POST /api/ai/pinned-insights, PATCH/DELETE /api/ai/pinned-insights/:id
 */
import { Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middleware/validation.middleware.js';
import { pinnedInsightsService } from '../../services/ai/pinnedInsightsService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

router.use(verifyToken);

// ==================== VALIDATORS ====================

const PinInsightBodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  messageId: z.string().min(1).max(128).optional(),
  content: z.string().min(1).max(8000),
  tags: z.array(z.string().max(50)).max(20).optional(),
  isShared: z.boolean().optional(),
});

const ListInsightsQuerySchema = z.object({
  includeShared: z.enum(['true', 'false']).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

const InsightIdParamSchema = z.object({
  id: z.string().uuid(),
});

const UpdateInsightBodySchema = z
  .object({
    content: z.string().min(1).max(8000).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    isShared: z.boolean().optional(),
  })
  .refine((v) => v.content !== undefined || v.tags !== undefined || v.isShared !== undefined, {
    message: 'At least one field (content, tags, isShared) must be provided',
  });

// ==================== PIN INSIGHT ====================

/**
 * POST /api/ai/pinned-insights
 * Body: { conversationId?, messageId?, content, tags?, isShared? }
 */
router.post(
  '/',
  validateBody(PinInsightBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.organizationId) {
      return res.status(400).json({ error: 'Organization context required to pin an insight' });
    }

    try {
      const insight = await pinnedInsightsService.pinInsight({
        organizationId: req.organizationId,
        userId: req.userId!,
        conversationId: req.body.conversationId,
        messageId: req.body.messageId,
        content: req.body.content,
        tags: req.body.tags,
        isShared: req.body.isShared,
      });

      return res.status(201).json(insight);
    } catch (err: any) {
      // Write — NEVER fail-soft. Real error with a stable code, no err.message leak.
      logger.error('[PinnedInsights] Pin error:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Nie udało się przypiąć insightu', code: 'PINNED_INSIGHTS_PIN_FAILED' });
    }
  })
);

// ==================== LIST INSIGHTS ====================

/**
 * GET /api/ai/pinned-insights?includeShared=true&limit=50
 * Lists the caller's own pinned insights; includeShared=true also includes
 * insights shared by teammates within the same organization.
 */
router.get(
  '/',
  validateQuery(ListInsightsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.organizationId) {
      return res.status(400).json({ error: 'Organization context required to list insights' });
    }

    const { includeShared, limit } = req.query as Record<string, string | undefined>;

    try {
      const insights = await pinnedInsightsService.listInsights({
        userId: req.userId!,
        organizationId: req.organizationId,
        includeShared: includeShared === 'true',
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      return res.json({ insights, total: insights.length });
    } catch (err: any) {
      // Read — side panel enrichment (pinned insights list). Fail-soft: degrade to
      // an empty list instead of breaking the panel with a 500.
      logger.warn('[PinnedInsights] List degraded', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({ insights: [], total: 0, degraded: true });
    }
  })
);

// ==================== UPDATE INSIGHT ====================

/**
 * PATCH /api/ai/pinned-insights/:id
 * Body: { content?, tags?, isShared? }
 * Ownership-scoped (user_id) by the underlying service — matches pin/unpin semantics.
 */
router.patch(
  '/:id',
  validateParams(InsightIdParamSchema),
  validateBody(UpdateInsightBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const updated = await pinnedInsightsService.updateInsight(req.params.id, req.userId!, {
        content: req.body.content,
        tags: req.body.tags,
        isShared: req.body.isShared,
      });

      if (!updated) {
        return res.status(404).json({ error: 'Pinned insight not found' });
      }

      return res.json(updated);
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[PinnedInsights] Update error:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zaktualizować insightu',
        code: 'PINNED_INSIGHTS_UPDATE_FAILED',
      });
    }
  })
);

// ==================== UNPIN ====================

/**
 * DELETE /api/ai/pinned-insights/:id
 */
router.delete(
  '/:id',
  validateParams(InsightIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      await pinnedInsightsService.unpinInsight(req.params.id, req.userId!);
      return res.json({ success: true, deleted: req.params.id });
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[PinnedInsights] Unpin error:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Nie udało się odpiąć insightu', code: 'PINNED_INSIGHTS_UNPIN_FAILED' });
    }
  })
);

export default router;
