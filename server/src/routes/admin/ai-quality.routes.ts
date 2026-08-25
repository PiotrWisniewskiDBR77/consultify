/**
 * AI Quality Admin Routes
 * FLOW-AI-ADAPTIVE-001: Admin dashboard for AI quality monitoring and management
 *
 * Provides endpoints for:
 * - Quality metrics and satisfaction scores
 * - Feedback management and review
 * - Learning patterns monitoring
 * - Style profile analytics
 *
 * @version 1.0.0
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

// All routes require authentication and admin role
router.use(verifyToken);

// Middleware to check admin role
const requireAdmin = asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
  const userRole = req.user?.role;
  if (userRole !== 'administrator' && userRole !== 'owner') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
});

router.use(requireAdmin);

// =====================================================
// Quality Metrics Endpoints
// =====================================================

/**
 * GET /api/admin/ai-quality/metrics
 * Get overall AI quality metrics
 */
router.get(
  '/metrics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      const { period = '30d' } = req.query;

      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      let daysBack = 30;
      if (period === '7d') daysBack = 7;
      else if (period === '90d') daysBack = 90;

      // Get feedback stats
      const feedbackStats = (await dbGet(
        `SELECT 
          COUNT(*) as total_feedback,
          SUM(CASE WHEN feedback_type = 'HELPFUL' OR rating > 0 THEN 1 ELSE 0 END) as positive_count,
          SUM(CASE WHEN feedback_type = 'NOT_HELPFUL' OR rating < 0 THEN 1 ELSE 0 END) as negative_count,
          AVG(actionability) as avg_actionability,
          AVG(accuracy) as avg_accuracy
        FROM ai_feedback
        WHERE organization_id = ?
        AND created_at > datetime('now', '-${daysBack} days')`,
        [organizationId]
      )) as {
        total_feedback: number;
        positive_count: number;
        negative_count: number;
        avg_actionability: number | null;
        avg_accuracy: number | null;
      } | null;

      // Get trend data (by day)
      const trendData = (await dbAll(
        `SELECT 
          DATE(created_at) as date,
          COUNT(*) as total,
          SUM(CASE WHEN feedback_type = 'HELPFUL' OR rating > 0 THEN 1 ELSE 0 END) as positive
        FROM ai_feedback
        WHERE organization_id = ?
        AND created_at > datetime('now', '-${daysBack} days')
        GROUP BY DATE(created_at)
        ORDER BY date`,
        [organizationId]
      )) as Array<{ date: string; total: number; positive: number }>;

      // Get learning patterns count
      const patternsCount = (await dbGet(
        `SELECT COUNT(*) as count FROM ai_style_learning_patterns WHERE status = 'active'`,
        []
      )) as { count: number } | null;

      // Get style profiles count
      const profilesCount = (await dbGet(
        `SELECT COUNT(*) as count FROM ai_user_style_profiles WHERE organization_id = ?`,
        [organizationId]
      )) as { count: number } | null;

      const total = feedbackStats?.total_feedback || 0;
      const positive = feedbackStats?.positive_count || 0;
      const satisfactionRate = total > 0 ? ((positive / total) * 100).toFixed(1) : null;

      res.json({
        success: true,
        period,
        metrics: {
          satisfactionRate: satisfactionRate ? parseFloat(satisfactionRate) : null,
          totalFeedback: total,
          positiveFeedback: positive,
          negativeFeedback: feedbackStats?.negative_count || 0,
          avgActionability: feedbackStats?.avg_actionability
            ? parseFloat(feedbackStats.avg_actionability.toFixed(2))
            : null,
          avgAccuracy: feedbackStats?.avg_accuracy
            ? parseFloat(feedbackStats.avg_accuracy.toFixed(2))
            : null,
          activePatternsCount: patternsCount?.count || 0,
          userProfilesCount: profilesCount?.count || 0,
        },
        trend: trendData.map((d) => ({
          date: d.date,
          total: d.total,
          positive: d.positive,
          satisfactionRate: d.total > 0 ? ((d.positive / d.total) * 100).toFixed(1) : null,
        })),
      });
    } catch (error) {
      logger.error('[AI Quality] Metrics error:', error);
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  })
);

/**
 * GET /api/admin/ai-quality/feedback
 * Get paginated feedback list with filters
 */
router.get(
  '/feedback',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      const { page = '1', limit = '20', status, rating, screenContext } = req.query;

      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const pageNum = parseInt(page as string);
      const limitNum = Math.min(parseInt(limit as string), 100);
      const offset = (pageNum - 1) * limitNum;

      let query = `
        SELECT
          f.*,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.display_name, u.email) as user_name,
          u.email as user_email
        FROM ai_feedback f
        LEFT JOIN users u ON f.user_id = u.id
        WHERE f.organization_id = ?
      `;
      const params: any[] = [organizationId];

      if (status === 'pending') {
        query += ` AND f.reviewed_at IS NULL`;
      } else if (status === 'reviewed') {
        query += ` AND f.reviewed_at IS NOT NULL`;
      }

      if (rating === 'positive') {
        query += ` AND (f.feedback_type = 'HELPFUL' OR f.rating > 0)`;
      } else if (rating === 'negative') {
        query += ` AND (f.feedback_type = 'NOT_HELPFUL' OR f.rating < 0)`;
      }

      if (screenContext) {
        query += ` AND f.screen_context = ?`;
        params.push(screenContext);
      }

      // Get total count
      const countResult = (await dbGet(
        // Robust to the SELECT-list content (regex, not an exact literal) so the
        // user_name expression can change without silently breaking the count.
        query.replace(
          /SELECT[\s\S]*?FROM ai_feedback f/,
          'SELECT COUNT(*) as count FROM ai_feedback f'
        ),
        params
      )) as { count: number } | null;

      // Get paginated results
      query += ` ORDER BY f.created_at DESC LIMIT ? OFFSET ?`;
      params.push(limitNum, offset);

      const feedback = await dbAll(query, params);

      res.json({
        success: true,
        feedback,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: countResult?.count || 0,
          totalPages: Math.ceil((countResult?.count || 0) / limitNum),
        },
      });
    } catch (error) {
      logger.error('[AI Quality] Feedback list error:', error);
      res.status(500).json({ error: 'Failed to fetch feedback' });
    }
  })
);

/**
 * POST /api/admin/ai-quality/feedback/:id/review
 * Mark feedback as reviewed
 */
router.post(
  '/feedback/:id/review',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { actionTaken, notes } = req.body;
      const reviewerId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!reviewerId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await dbRun(
        `UPDATE ai_feedback SET
          reviewed_by = ?,
          reviewed_at = datetime('now'),
          action_taken = ?,
          review_notes = ?
        WHERE id = ? AND organization_id = ?`,
        [reviewerId, actionTaken || null, notes || null, id, organizationId]
      );

      if (!result.changes) {
        return res.status(404).json({ error: 'Feedback not found' });
      }

      res.json({
        success: true,
        message: 'Feedback reviewed successfully',
      });
    } catch (error) {
      logger.error('[AI Quality] Feedback review error:', error);
      res.status(500).json({ error: 'Failed to review feedback' });
    }
  })
);

// =====================================================
// Learning Patterns Endpoints
// =====================================================

/**
 * GET /api/admin/ai-quality/patterns
 * Get learning patterns with confidence scores
 */
router.get(
  '/patterns',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      const { status = 'active', limit = '50' } = req.query;

      let query = `
        SELECT
          p.*,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.display_name, u.email) as user_name
        FROM ai_style_learning_patterns p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE (p.organization_id = ? OR p.organization_id IS NULL)
      `;
      const params: any[] = [organizationId];

      if (status !== 'all') {
        query += ` AND p.status = ?`;
        params.push(status);
      }

      query += ` ORDER BY p.confidence_score DESC, p.occurrence_count DESC LIMIT ?`;
      params.push(parseInt(limit as string));

      const patterns = await dbAll(query, params);

      // Group patterns by type
      const grouped: Record<string, any[]> = {};
      for (const pattern of patterns as any[]) {
        const type = pattern.pattern_type || 'other';
        if (!grouped[type]) {
          grouped[type] = [];
        }
        grouped[type].push(pattern);
      }

      res.json({
        success: true,
        patterns,
        grouped,
        summary: {
          total: (patterns as any[]).length,
          byType: Object.fromEntries(
            Object.entries(grouped).map(([type, items]) => [type, items.length])
          ),
        },
      });
    } catch (error) {
      logger.error('[AI Quality] Patterns error:', error);
      res.status(500).json({ error: 'Failed to fetch patterns' });
    }
  })
);

/**
 * POST /api/admin/ai-quality/patterns/:id/status
 * Update pattern status (apply/reject/expire)
 */
router.post(
  '/patterns/:id/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!['active', 'applied', 'rejected', 'expired'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const result = await dbRun(
        `UPDATE ai_style_learning_patterns SET
          status = ?,
          applied_at = CASE WHEN ? = 'applied' THEN datetime('now') ELSE applied_at END,
          updated_at = datetime('now')
        WHERE id = ? AND organization_id = ?`,
        [status, status, id, organizationId]
      );

      if (!result.changes) {
        return res.status(404).json({ error: 'Pattern not found' });
      }

      res.json({
        success: true,
        message: 'Pattern status updated',
      });
    } catch (error) {
      logger.error('[AI Quality] Pattern status update error:', error);
      res.status(500).json({ error: 'Failed to update pattern status' });
    }
  })
);

// =====================================================
// Analytics Endpoints
// =====================================================

/**
 * GET /api/admin/ai-quality/analytics/contexts
 * Get feedback breakdown by screen context
 */
router.get(
  '/analytics/contexts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      const { period = '30d' } = req.query;

      let daysBack = 30;
      if (period === '7d') daysBack = 7;
      else if (period === '90d') daysBack = 90;

      const contextStats = (await dbAll(
        `SELECT 
          screen_context,
          COUNT(*) as total,
          SUM(CASE WHEN feedback_type = 'HELPFUL' OR rating > 0 THEN 1 ELSE 0 END) as positive,
          AVG(actionability) as avg_actionability,
          AVG(accuracy) as avg_accuracy
        FROM ai_feedback
        WHERE organization_id = ?
        AND screen_context IS NOT NULL
        AND created_at > datetime('now', '-${daysBack} days')
        GROUP BY screen_context
        ORDER BY total DESC`,
        [organizationId]
      )) as Array<{
        screen_context: string;
        total: number;
        positive: number;
        avg_actionability: number | null;
        avg_accuracy: number | null;
      }>;

      res.json({
        success: true,
        period,
        contexts: contextStats.map((c) => ({
          context: c.screen_context,
          total: c.total,
          positive: c.positive,
          satisfactionRate: c.total > 0 ? ((c.positive / c.total) * 100).toFixed(1) : null,
          avgActionability: c.avg_actionability?.toFixed(2) || null,
          avgAccuracy: c.avg_accuracy?.toFixed(2) || null,
        })),
      });
    } catch (error) {
      logger.error('[AI Quality] Context analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch context analytics' });
    }
  })
);

/**
 * GET /api/admin/ai-quality/analytics/formats
 * Get feedback breakdown by expected format
 */
router.get(
  '/analytics/formats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;

      const formatStats = (await dbAll(
        `SELECT 
          expected_format,
          COUNT(*) as count
        FROM ai_feedback
        WHERE organization_id = ?
        AND expected_format IS NOT NULL
        AND created_at > datetime('now', '-30 days')
        GROUP BY expected_format
        ORDER BY count DESC`,
        [organizationId]
      )) as Array<{ expected_format: string; count: number }>;

      res.json({
        success: true,
        formats: formatStats,
      });
    } catch (error) {
      logger.error('[AI Quality] Format analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch format analytics' });
    }
  })
);

/**
 * GET /api/admin/ai-quality/analytics/issues
 * Get top issues from negative feedback
 */
router.get(
  '/analytics/issues',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;

      // Get negative feedback with missing_info
      const issues = (await dbAll(
        `SELECT 
          missing_info,
          screen_context,
          COUNT(*) as occurrences
        FROM ai_feedback
        WHERE organization_id = ?
        AND (feedback_type = 'NOT_HELPFUL' OR rating < 0)
        AND missing_info IS NOT NULL
        AND missing_info != ''
        AND created_at > datetime('now', '-30 days')
        GROUP BY missing_info
        ORDER BY occurrences DESC
        LIMIT 20`,
        [organizationId]
      )) as Array<{ missing_info: string; screen_context: string; occurrences: number }>;

      res.json({
        success: true,
        issues,
      });
    } catch (error) {
      logger.error('[AI Quality] Issues analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch issues' });
    }
  })
);

export default router;
