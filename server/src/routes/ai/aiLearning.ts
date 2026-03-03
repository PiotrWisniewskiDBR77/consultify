/**
 * AI Learning Routes
 *
 * Provides analytics endpoints used by SuperAdmin AI Intelligence → Learning System.
 *
 * Endpoints (mounted under /api/ai/learning):
 * - GET /patterns
 * - GET /interactions
 * - GET /metrics
 */
import { Router } from 'express';
import type { Response } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

import { getPatterns as getLearningPatterns } from '../../services/ai/aiLearningService.js';

const router = Router();

router.use(verifyToken);
router.use(requireRole('super_admin', 'admin'));

function rangeToDays(range: string | undefined): number {
  const r = String(range || '').toLowerCase();
  if (r === '90d') return 90;
  if (r === '30d') return 30;
  return 7;
}

/**
 * GET /api/ai/learning/patterns
 */
router.get(
  '/patterns',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const type = req.query.type ? String(req.query.type) : undefined;
    const orgId = req.query.orgId ? String(req.query.orgId) : undefined;
    const minConf = req.query.minConf !== undefined ? Number(req.query.minConf) : undefined;
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;

    const patterns = await getLearningPatterns(type, orgId, minConf, limit);
    return res.json({ success: true, patterns });
  })
);

/**
 * GET /api/ai/learning/interactions
 *
 * Uses ai_feedback as the canonical interaction source for learning analytics.
 */
router.get(
  '/interactions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const limitRaw = req.query.limit !== undefined ? Number(req.query.limit) : 10;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 10;
    const days = rangeToDays(req.query.range ? String(req.query.range) : undefined);

    try {
      const rows = await dbAll(
        `
        SELECT id, organization_id, user_id, feedback_type, rating, comment, category, created_at
        FROM ai_feedback
        WHERE created_at >= datetime('now', ?)
        ORDER BY created_at DESC
        LIMIT ?
      `,
        [`-${days} days`, limit],
        { fallback: true } as any
      );

      const interactions = (rows || []).map((r: any) => ({
        id: String(r.id || ''),
        organizationId: r.organization_id ? String(r.organization_id) : null,
        userId: r.user_id ? String(r.user_id) : null,
        feedbackType: String(r.feedback_type || ''),
        rating: r.rating ?? null,
        comment: r.comment ?? null,
        category: r.category ?? null,
        createdAt: String(r.created_at || ''),
      }));

      return res.json({ success: true, interactions });
    } catch (err) {
      logger.warn('[aiLearning] interactions query failed', err);
      return res.json({ success: true, interactions: [] });
    }
  })
);

/**
 * GET /api/ai/learning/metrics
 */
router.get(
  '/metrics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const days = rangeToDays(req.query.range ? String(req.query.range) : undefined);

    // Defaults: return empty/0 when tables aren't present yet.
    let totalInteractions = 0;
    let likes = 0;
    let dislikes = 0;
    let avgRating = 0;
    let patternsLearned = 0;
    let activeModels = 0;
    const qualityTrends: Array<{ date: string; score: number }> = [];

    try {
      const stats = await dbGet(
        `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN feedback_type = 'like' THEN 1 ELSE 0 END) as likes,
          SUM(CASE WHEN feedback_type = 'dislike' THEN 1 ELSE 0 END) as dislikes,
          AVG(CASE WHEN rating IS NOT NULL THEN rating ELSE NULL END) as avg_rating
        FROM ai_feedback
        WHERE created_at >= datetime('now', ?)
      `,
        [`-${days} days`],
        { fallback: true } as any
      );
      totalInteractions = Number((stats as any)?.total || 0);
      likes = Number((stats as any)?.likes || 0);
      dislikes = Number((stats as any)?.dislikes || 0);
      avgRating = Number((stats as any)?.avg_rating || 0);
    } catch (err) {
      logger.warn('[aiLearning] metrics feedback stats failed', err);
    }

    try {
      const rows = await dbAll(
        `
        SELECT metric_date, overall_score
        FROM ai_quality_metrics
        WHERE metric_date >= date('now', ?)
        ORDER BY metric_date ASC
      `,
        [`-${days} days`],
        { fallback: true } as any
      );
      for (const r of rows || []) {
        const d = String((r as any)?.metric_date || '');
        const scorePct = Number((r as any)?.overall_score || 0);
        qualityTrends.push({ date: d, score: Math.max(0, Math.min(1, scorePct / 100)) });
      }
    } catch (err) {
      // Optional table in early envs.
      logger.warn('[aiLearning] quality trends query failed', err);
    }

    try {
      const patternsCount = await dbGet(
        `SELECT COUNT(*) as total FROM ai_learning_patterns`,
        [],
        { fallback: true } as any
      );
      patternsLearned = Number((patternsCount as any)?.total || 0);
    } catch {
      // ignore
    }

    try {
      const active = await dbGet(
        `SELECT COUNT(*) as total FROM llm_providers WHERE is_active = 1`,
        [],
        { fallback: true } as any
      );
      activeModels = Number((active as any)?.total || 0);
    } catch {
      // ignore
    }

    const denom = likes + dislikes;
    const successRate = denom > 0 ? (likes / denom) * 100 : 0;
    const avgQualityScore = avgRating ? Math.max(0, Math.min(1, avgRating / 5)) : 0;

    return res.json({
      success: true,
      metrics: {
        totalInteractions,
        successRate,
        avgQualityScore,
        avgResponseTime: 0,
        patternsLearned,
        activeModels,
      },
      qualityTrends,
    });
  })
);

export default router;

