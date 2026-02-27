/**
 * AI Feedback Routes
 * API endpoints for collecting and managing user feedback on AI responses
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();

const serviceFallback = (
  req: AuthRequest,
  res: Response,
  feature: string,
  readPayload?: Record<string, unknown>
) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.status(200).json({
      success: true,
      status: 'not_configured',
      feature,
      writable: false,
      ...(readPayload || {}),
    });
  }
  return res.status(501).json({
    success: false,
    error: 'Feature not configured in this deployment',
    code: 'FEATURE_NOT_CONFIGURED',
    feature,
    writable: false,
  });
};

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

try {
  const loggerModule = await import('../../services/ai/logger.js');
  aiLogger = (loggerModule as any).aiLogger || (loggerModule as any).default || loggerModule;
} catch {
  console.warn('[AI Feedback Routes] aiLogger not available');
}

try {
  const adaptiveModule = await import('../../services/ai/adaptiveResponseService.js');
  const module = adaptiveModule.default || adaptiveModule;
  adaptiveResponseService = (module.adaptiveResponseService ||
    module) as AdaptiveResponseServiceInterface;
} catch {
  console.warn('[AI Feedback Routes] adaptiveResponseService not available');
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

      const organizationId = req.user?.organizationId;
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

      res.status(201).json({
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
      res.status(500).json({ error: 'Failed to submit feedback' });
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
      const userRole = req.user?.role;
      if (userRole !== 'administrator' && userRole !== 'owner') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { period = '30d', capability } = req.query;
      const organizationId = req.user?.organizationId;

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

      res.json({
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
      res.status(500).json({ error: 'Failed to fetch feedback stats' });
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
      const userRole = req.user?.role;
      if (userRole !== 'administrator' && userRole !== 'owner') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { limit = 20, type } = req.query;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      let query = `
            SELECT 
                f.*,
                u.full_name as user_name,
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

      res.json({
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
      res.status(500).json({ error: 'Failed to fetch recent feedback' });
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
      const userRole = req.user?.role;
      if (userRole !== 'administrator' && userRole !== 'owner') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const organizationId = req.user?.organizationId;

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

      res.json({
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
      res.status(500).json({ error: 'Failed to generate suggestions' });
    }
  })
);

// =====================================================
// Response Feedback Endpoints (AI Response Personalization)
// =====================================================

// Import user style profile service
let userStyleProfileService: any = null;
try {
  const styleModule = await import('../services/ai/userStyleProfileService.js');
  userStyleProfileService = styleModule.default || styleModule;
} catch {
  console.warn('[AI Feedback Routes] userStyleProfileService not available');
}

/**
 * POST /api/ai-feedback/response
 * Submit detailed feedback on AI response length/style
 * Extended with adaptive style fields (v2.0)
 */
router.post(
  '/response',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const {
        messageId,
        conversationId,
        rating,
        lengthFeedback,
        detailFeedback,
        formatFeedback,
        wantedMode,
        customFeedback,
        responseMode,
        responseLength,
        capability,
        // New adaptive style fields (v2.0)
        actionability,
        accuracy,
        expectedFormat,
        missingInfo,
        screenContext,
        focusMode,
      } = req.body;

      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

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

      // Store in database with new fields
      const id = uuidv4();
      await dbRun(
        `INSERT INTO ai_feedback 
          (id, organization_id, user_id, interaction_id, feedback_type, rating, comment,
           actionability, accuracy, expected_format, missing_info, screen_context, focus_mode, response_length,
           created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          id,
          organizationId,
          userId,
          messageId,
          rating === 'positive' ? 'HELPFUL' : 'NOT_HELPFUL',
          rating === 'positive' ? 1 : -1,
          customFeedback || null,
          actionability || null,
          accuracy || null,
          expectedFormat || null,
          missingInfo || null,
          screenContext || null,
          focusMode || null,
          responseLength || null,
        ]
      );

      // Process with userStyleProfileService if available
      let profileSuggestions: any[] = [];
      if (userStyleProfileService?.processFeedback) {
        try {
          profileSuggestions = await userStyleProfileService.processFeedback({
            userId,
            messageId,
            rating: rating as 'positive' | 'negative',
            lengthFeedback: lengthFeedback?.replace('-', '_'),
            detailFeedback: detailFeedback?.replace('-', '_'),
            formatFeedback,
            actionability,
            accuracy,
            expectedFormat,
            screenContext,
            focusMode,
          });
        } catch (err) {
          console.warn('[AI Feedback] Style profile processing failed:', err);
        }
      }

      // Also process with adaptiveResponseService if available
      if (adaptiveResponseService?.processFeedback) {
        try {
          await adaptiveResponseService.processFeedback(
            userId,
            messageId,
            conversationId,
            { rating, lengthFeedback, detailFeedback, formatFeedback, wantedMode, customFeedback },
            { responseMode, responseLength, capability }
          );
        } catch (err) {
          console.warn('[AI Feedback] Adaptive response processing failed:', err);
        }
      }

      if (aiLogger?.info) {
        aiLogger.info(
          'AIFeedback',
          `Response feedback: ${rating} from user ${userId}, format: ${expectedFormat || 'N/A'}, screen: ${screenContext || 'N/A'}`
        );
      }

      res.status(201).json({
        success: true,
        feedbackId: id,
        message: 'Feedback recorded successfully',
        profileSuggestions: profileSuggestions.length > 0 ? profileSuggestions : undefined,
      });
    } catch (error: unknown) {
      if (aiLogger?.error) {
        aiLogger.error(
          'AIFeedback',
          `Response feedback error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      res.status(500).json({ error: 'Failed to submit response feedback' });
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
      return serviceFallback(req, res, 'ai-feedback-response', {
        stats: {
          total_feedback: 0,
          positive_count: 0,
          negative_count: 0,
          satisfaction_rate: null,
        },
        recommendedMode: 'standard',
      });
    }

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const stats = await adaptiveResponseService.getUserFeedbackStats(userId);
      const recommendedMode = await adaptiveResponseService.getRecommendedMode(userId);

      res.json({
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
      res.status(500).json({ error: 'Failed to get response stats' });
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

      res.json({
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
      res.status(500).json({ error: 'Failed to get preferences' });
    }
  })
);

// =====================================================
// User Style Profile Endpoints (Adaptive Style v2.0)
// =====================================================

/**
 * GET /api/ai-feedback/style-profile
 * Get user's communication style profile
 */
router.get(
  '/style-profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!userStyleProfileService?.getProfile) {
      return serviceFallback(req, res, 'ai-style-profile', { profile: null, patterns: [] });
    }

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const profile = await userStyleProfileService.getProfile(userId);
      const patterns = (await userStyleProfileService.getLearnedPatterns?.(userId)) || [];

      res.json({
        success: true,
        profile,
        patterns,
      });
    } catch (error: unknown) {
      console.error('[AI Feedback] Style profile error:', error);
      res.status(500).json({ error: 'Failed to get style profile' });
    }
  })
);

/**
 * PUT /api/ai-feedback/style-profile
 * Update user's communication style preferences
 */
router.put(
  '/style-profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!userStyleProfileService?.updateProfile) {
      return serviceFallback(req, res, 'ai-style-profile');
    }

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const {
        preferredDepth,
        preferredFormat,
        technicalLevel,
        responseLength,
        autoAdaptEnabled,
        contextPreferences,
      } = req.body;

      const updates: Record<string, any> = {};
      if (preferredDepth) updates.preferredDepth = preferredDepth;
      if (preferredFormat) updates.preferredFormat = preferredFormat;
      if (technicalLevel) updates.technicalLevel = technicalLevel;
      if (responseLength) updates.responseLength = responseLength;
      if (autoAdaptEnabled !== undefined) updates.autoAdaptEnabled = autoAdaptEnabled;
      if (contextPreferences) updates.contextPreferences = contextPreferences;

      const profile = await userStyleProfileService.updateProfile(userId, updates);

      res.json({
        success: true,
        profile,
        message: 'Style profile updated successfully',
      });
    } catch (error: unknown) {
      console.error('[AI Feedback] Style profile update error:', error);
      res.status(500).json({ error: 'Failed to update style profile' });
    }
  })
);

export default router;
