/**
 * AI Feedback Routes
 * API endpoints for collecting and managing user feedback on AI responses
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// Apply rate limiting
const router = Router();

// Service interfaces
interface AILoggerInterface {
  info?: (category: string, message: string) => void;
  error?: (category: string, message: string) => void;
}

interface AdaptiveResponseServiceInterface {
  processFeedback?: (
    userId: string,
    messageId: string,
    conversationId: string | undefined,
    feedback: {
      rating: string;
      lengthFeedback?: string;
      detailFeedback?: string;
      formatFeedback?: string;
      wantedMode?: string;
      customFeedback?: string;
    },
    context: {
      responseMode?: string;
      responseLength?: string;
      capability?: string;
    }
  ) => Promise<{ feedbackId: string }>;
  getUserFeedbackStats?: (userId: string) => Promise<{
    total_feedback?: number;
    positive_count?: number;
    negative_count?: number;
    satisfaction_rate?: number | null;
  }>;
  getRecommendedMode?: (userId: string) => Promise<string>;
}

// Dynamic imports for services (may not be migrated yet)
let aiLogger: AILoggerInterface | null = null;
let adaptiveResponseService: AdaptiveResponseServiceInterface | null = null;
const notConfigured = (res: Response) =>
  res.status(503).json({
    statusCode: 503,
    success: false,
    code: 'FEATURE_UNAVAILABLE',
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });

try {
  const loggerModule = (await import('../../services/ai/logger.js')) as any;
  const module = loggerModule.default || loggerModule;
  aiLogger = module.aiLogger || module;
} catch {
  logger.warn('[AI Feedback Routes] aiLogger not available');
}

try {
  const adaptiveModule = (await import('../../services/ai/adaptiveResponseService.js')) as any;
  const module = adaptiveModule.default || adaptiveModule;
  adaptiveResponseService = (module.adaptiveResponseService ||
    module) as AdaptiveResponseServiceInterface;
} catch {
  logger.warn('[AI Feedback Routes] adaptiveResponseService not available');
  adaptiveResponseService = null;
}

// All routes require authentication
router.use(verifyToken);

/**
 * POST /api/ai-feedback
 * Submit feedback on an AI response
 */
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { interactionId, draftId, feedbackType, rating, comment, capability, modelUsed } =
        req.body;

      const organizationId = req.user?.organizationId || req.user?.organization_id;
      const userId = req.user?.id;

      if (!organizationId || !userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!feedbackType) {
        return res.status(400).json({ error: 'feedbackType is required' });
      }

      const validTypes = [
        'HELPFUL',
        'NOT_HELPFUL',
        'ACCURATE',
        'INACCURATE',
        'RELEVANT',
        'IRRELEVANT',
        'RATING',
      ];
      if (!validTypes.includes(feedbackType)) {
        return res.status(400).json({
          error: `Invalid feedbackType. Valid types: ${validTypes.join(', ')}`,
        });
      }

      const id = uuidv4();

      const runResult = await dbRun(
        `
            INSERT INTO ai_feedback 
            (id, organization_id, user_id, interaction_id, draft_id, feedback_type, 
             rating, comment, capability, model_used, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `,
        [
          id,
          organizationId,
          userId,
          interactionId,
          draftId,
          feedbackType,
          rating,
          comment,
          capability,
          modelUsed,
        ]
      );

      if (!runResult.success) {
        throw new Error(runResult.error || 'Failed to insert feedback');
      }

      if (aiLogger?.info) {
        aiLogger.info(
          'AIFeedback',
          `Feedback submitted: ${feedbackType} for ${capability || 'unknown'}`
        );
      }

      return res.status(201).json({
        success: true,
        feedbackId: id,
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'AIFeedback',
          `Submit error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to submit feedback' });
    }
  })
);

/**
 * GET /api/ai-feedback/stats
 * Get feedback statistics (admin only)
 */
router.get(
  '/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userRole = (req.user?.role || '').toLowerCase();
      if (!['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(userRole)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { period = '30d', capability } = req.query;
      const organizationId = req.user?.organizationId || req.user?.organization_id;

      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      let daysBack = 30;
      if (period === '7d') daysBack = 7;
      else if (period === '90d') daysBack = 90;

      // Get overall stats
      let statsQuery = `
            SELECT 
                feedback_type,
                COUNT(*) as count,
                AVG(rating) as avg_rating
            FROM ai_feedback
            WHERE organization_id = ?
            AND created_at > datetime('now', '-${daysBack} days')
        `;
      const params: unknown[] = [organizationId];

      if (capability) {
        statsQuery += ` AND capability = ?`;
        params.push(capability);
      }

      statsQuery += ` GROUP BY feedback_type`;

      const typeStats = (await dbAll(statsQuery, params)) as Array<{
        feedback_type?: string;
        count?: number;
        avg_rating?: number;
      }>;

      // Get capability breakdown
      const capabilityStats = (await dbAll(
        `
            SELECT 
                capability,
                SUM(CASE WHEN feedback_type = 'HELPFUL' THEN 1 ELSE 0 END) as helpful,
                SUM(CASE WHEN feedback_type = 'NOT_HELPFUL' THEN 1 ELSE 0 END) as not_helpful,
                COUNT(*) as total,
                AVG(rating) as avg_rating
            FROM ai_feedback
            WHERE organization_id = ?
            AND created_at > datetime('now', '-${daysBack} days')
            GROUP BY capability
        `,
        [organizationId]
      )) as Array<{
        capability?: string;
        helpful?: number;
        not_helpful?: number;
        total?: number;
        avg_rating?: number;
      }>;

      // Calculate satisfaction score
      const helpfulCount = typeStats.find((t) => t.feedback_type === 'HELPFUL')?.count || 0;
      const notHelpfulCount = typeStats.find((t) => t.feedback_type === 'NOT_HELPFUL')?.count || 0;
      const totalFeedback = helpfulCount + notHelpfulCount;
      const satisfactionScore =
        totalFeedback > 0 ? ((helpfulCount / totalFeedback) * 100).toFixed(1) : null;

      return res.json({
        success: true,
        period,
        stats: {
          satisfactionScore,
          totalFeedback,
          byType: typeStats,
          byCapability: capabilityStats.map((c) => ({
            ...c,
            satisfactionRate:
              c.total && c.total > 0 ? (((c.helpful || 0) / c.total) * 100).toFixed(1) : null,
          })),
        },
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'AIFeedback',
          `Stats error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to fetch feedback stats' });
    }
  })
);

/**
 * GET /api/ai-feedback/recent
 * Get recent feedback with comments (admin only)
 */
router.get(
  '/recent',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userRole = (req.user?.role || '').toLowerCase();
      if (!['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(userRole)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { limit = 20, type } = req.query;
      const organizationId = req.user?.organizationId || req.user?.organization_id;

      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      let query = `
            SELECT
                f.*,
                COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.display_name, u.email) as user_name,
                u.email as user_email
            FROM ai_feedback f
            LEFT JOIN users u ON f.user_id = u.id
            WHERE f.organization_id = ?
        `;
      const params: unknown[] = [organizationId];

      if (type) {
        query += ` AND f.feedback_type = ?`;
        params.push(type);
      }

      query += ` ORDER BY f.created_at DESC LIMIT ?`;
      params.push(parseInt(limit as string));

      const feedback = await dbAll(query, params);

      return res.json({
        success: true,
        feedback,
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'AIFeedback',
          `Recent error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to fetch recent feedback' });
    }
  })
);

/**
 * GET /api/ai-feedback/improvement-suggestions
 * Get AI-generated suggestions based on feedback patterns (admin only)
 */
router.get(
  '/improvement-suggestions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userRole = (req.user?.role || '').toLowerCase();
      if (!['admin', 'administrator', 'superadmin', 'super_admin', 'owner'].includes(userRole)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const organizationId = req.user?.organizationId || req.user?.organization_id;

      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Find capabilities with low satisfaction
      const problemAreas = (await dbAll(
        `
            SELECT 
                capability,
                model_used,
                COUNT(*) as total_feedback,
                SUM(CASE WHEN feedback_type = 'NOT_HELPFUL' THEN 1 ELSE 0 END) as negative,
                GROUP_CONCAT(comment, ' | ') as comments
            FROM ai_feedback
            WHERE organization_id = ?
            AND created_at > datetime('now', '-30 days')
            AND feedback_type = 'NOT_HELPFUL'
            GROUP BY capability
            HAVING negative > 2
            ORDER BY negative DESC
            LIMIT 5
        `,
        [organizationId]
      )) as Array<{
        capability?: string;
        model_used?: string;
        total_feedback?: number;
        negative?: number;
        comments?: string;
      }>;

      // Helper function to generate suggestions based on feedback patterns
      const generateSuggestion = (area: {
        negative?: number;
        comments?: string;
        capability?: string;
      }): string[] => {
        const suggestions: string[] = [];

        if ((area.negative || 0) > 5) {
          suggestions.push(`Consider reviewing the prompt for "${area.capability}" capability`);
        }

        if (area.comments && (area.comments.includes('długo') || area.comments.includes('wolno'))) {
          suggestions.push('Users report slow responses - consider using a faster model');
        }

        if (area.comments && (area.comments.includes('błąd') || area.comments.includes('error'))) {
          suggestions.push('Users report errors - check model configuration and fallbacks');
        }

        if (suggestions.length === 0) {
          suggestions.push(
            `Review ${area.negative || 0} negative feedbacks for "${area.capability}"`
          );
        }

        return suggestions;
      };

      const suggestions = problemAreas.map((area) => ({
        capability: area.capability,
        model: area.model_used,
        negativeCount: area.negative,
        totalFeedback: area.total_feedback,
        sampleComments: area.comments ? area.comments.split(' | ').slice(0, 3) : [],
        suggestion: generateSuggestion(area),
      }));

      return res.json({
        success: true,
        suggestions,
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'AIFeedback',
          `Suggestions error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to generate suggestions' });
    }
  })
);

// =====================================================
// Response Feedback Endpoints (AI Response Personalization)
// =====================================================

/**
 * POST /api/ai-feedback/response
 * Submit detailed feedback on AI response length/style
 */
router.post(
  '/response',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!adaptiveResponseService?.processFeedback) {
      return notConfigured(res);
    }

    try {
      const {
        messageId,
        // NOTE: the client-supplied `conversationId` is intentionally not
        // destructured/trusted here — see `verifiedConversationId` below,
        // which is looked up server-side from `messageId` as part of the
        // ownership check and is what actually gets persisted.
        rating,
        lengthFeedback,
        detailFeedback,
        formatFeedback,
        wantedMode,
        customFeedback,
        responseMode,
        responseLength,
        capability,
      } = req.body;

      const userId = req.user?.id;
      const organizationId = req.user?.organizationId || req.user?.organization_id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!messageId) {
        return res.status(400).json({ error: 'messageId is required' });
      }

      if (!rating || !['positive', 'negative', 'neutral'].includes(rating)) {
        return res
          .status(400)
          .json({ error: 'Valid rating is required (positive, negative, neutral)' });
      }

      // M01-P03B — real ownership check (M01-036 follow-up finding). Before
      // this, nothing here verified that `messageId` belonged to a
      // conversation the caller can actually access: any authenticated user
      // could POST a feedback row against ANY messageId, including a
      // message that lives in a different organization's conversation.
      // Mirrors the exact access policy `findAccessibleConversation()` in
      // conversations.routes.ts already enforces on read — personal
      // ownership scoped to the caller's organization, or team membership
      // inside a team-scope chat_project within that organization.
      const messageAccess = (await dbGet(
        `
            SELECT cm.id AS message_id, cm.conversation_id AS conversation_id,
                   c.user_id AS conversation_user_id, c.organization_id AS conversation_org_id,
                   cp.scope AS project_scope, cp.organization_id AS project_org_id
            FROM conversation_messages cm
            JOIN conversations c ON cm.conversation_id = c.id
            LEFT JOIN chat_projects cp ON c.chat_project_id = cp.id
            WHERE cm.id = ?
        `,
        [messageId]
      )) as {
        message_id: string;
        conversation_id: string;
        conversation_user_id: string | null;
        conversation_org_id: string | null;
        project_scope: string | null;
        project_org_id: string | null;
      } | null;

      const isPersonalOwner = Boolean(
        messageAccess &&
          messageAccess.conversation_user_id === userId &&
          (messageAccess.conversation_org_id == null ||
            messageAccess.conversation_org_id === organizationId)
      );
      const isTeamMember = Boolean(
        messageAccess &&
          messageAccess.project_scope === 'team' &&
          organizationId &&
          messageAccess.project_org_id === organizationId
      );

      if (!messageAccess || (!isPersonalOwner && !isTeamMember)) {
        // Same response for "does not exist" and "not yours" — no existence
        // oracle that would let a caller distinguish the two by repeated
        // probing (mirrors the attachment ACL pattern in
        // conversations.routes.ts).
        return res.status(404).json({ error: 'Message not found' });
      }

      // Use the DB-verified conversation_id, not whatever the client body
      // claims — the request body value is only ever used for optional
      // display context and must never override what ownership was actually
      // checked against.
      const verifiedConversationId = messageAccess.conversation_id;

      const feedback = {
        rating,
        lengthFeedback,
        detailFeedback,
        formatFeedback,
        wantedMode,
        customFeedback,
      };

      const context = {
        responseMode,
        responseLength,
        capability,
      };

      const result = await adaptiveResponseService.processFeedback(
        userId,
        messageId,
        verifiedConversationId,
        feedback,
        context
      );

      if (aiLogger?.info) {
        aiLogger.info(
          'AIFeedback',
          `Response feedback: ${rating} from user ${userId}, wanted: ${wantedMode || 'N/A'}`
        );
      }

      return res.status(201).json({
        success: true,
        feedbackId: result.feedbackId,
        message: 'Feedback recorded successfully',
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'AIFeedback',
          `Response feedback error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to submit response feedback' });
    }
  })
);

/**
 * GET /api/ai-feedback/response/stats
 * Get user's response feedback statistics
 */
router.get(
  '/response/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (
      !adaptiveResponseService?.getUserFeedbackStats ||
      !adaptiveResponseService?.getRecommendedMode
    ) {
      return notConfigured(res);
    }

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const stats = await adaptiveResponseService.getUserFeedbackStats(userId);
      const recommendedMode = await adaptiveResponseService.getRecommendedMode(userId);

      return res.json({
        success: true,
        stats: stats || {
          total_feedback: 0,
          positive_count: 0,
          negative_count: 0,
          satisfaction_rate: null,
        },
        recommendedMode,
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'AIFeedback',
          `Response stats error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to get response stats' });
    }
  })
);

/**
 * GET /api/ai-feedback/response/preferences
 * Get user's learned response preferences
 */
router.get(
  '/response/preferences',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const prefs = (await dbGet(
        `
            SELECT 
                response_mode_preference,
                quick_length_preference,
                standard_length_preference,
                deep_study_length_preference,
                auto_detect_intent,
                prefer_bullet_points,
                prefer_tables,
                prefer_action_items,
                include_examples,
                satisfaction_score
            FROM user_ai_profiles
            WHERE user_id = ?
        `,
        [userId]
      )) as {
        response_mode_preference?: string;
        quick_length_preference?: string;
        standard_length_preference?: string;
        deep_study_length_preference?: string;
        auto_detect_intent?: number;
        prefer_bullet_points?: number;
        prefer_tables?: number;
        prefer_action_items?: number;
        include_examples?: number;
        satisfaction_score?: number;
      } | null;

      return res.json({
        success: true,
        preferences: prefs || {
          response_mode_preference: 'standard',
          quick_length_preference: 'short',
          standard_length_preference: 'medium',
          deep_study_length_preference: 'long',
          auto_detect_intent: true,
        },
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'AIFeedback',
          `Preferences error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      return res.status(500).json({ error: 'Failed to get preferences' });
    }
  })
);

export default router;
