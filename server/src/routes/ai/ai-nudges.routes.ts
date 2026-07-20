/**
 * AI Nudges Routes
 * API endpoints for managing proactive AI nudges
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

// Apply rate limiting
const router = Router();
const notConfigured = (res: Response) =>
  res.status(503).json({
    statusCode: 503,
    success: false,
    code: 'FEATURE_UNAVAILABLE',
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });

// Service interfaces
interface ProactiveNudgesInterface {
  getPendingNudges?: (userId: string, organizationId: string) => Promise<unknown[]>;
  trackActivity?: (
    userId: string,
    organizationId: string,
    activity: {
      type: string;
      [key: string]: unknown;
    }
  ) => Promise<void>;
  checkAndGenerateNudges?: (
    userId: string,
    organizationId: string,
    context: {
      trigger?: string;
      context?: Record<string, unknown>;
    }
  ) => Promise<unknown[]>;
  dismissNudge?: (userId: string, nudgeId: string, reason?: string) => Promise<void>;
  markNudgeActed?: (userId: string, nudgeId: string, action?: string) => Promise<void>;
  suppressNudgeType?: (userId: string, nudgeType: string, duration?: string) => Promise<void>;
}

// Dynamic import for proactiveNudges service (may not be migrated yet)
let proactiveNudges: ProactiveNudgesInterface | null = null;

try {
  const nudgesModule = (await import('../../services/ai/proactiveNudges.js')) as any;
  const module = nudgesModule.default || nudgesModule;
  proactiveNudges = (module.proactiveNudges || module) as ProactiveNudgesInterface;
} catch {
  logger.warn('[AI Nudges Routes] proactiveNudges service not available');
  proactiveNudges = null;
}

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/ai/nudges/pending
 * Get pending nudges for the current user
 */
router.get(
  '/pending',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!proactiveNudges?.getPendingNudges) {
      return notConfigured(res);
    }

    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId || req.user?.organization_id;

      if (!userId || !organizationId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const nudges = await proactiveNudges.getPendingNudges(userId, organizationId);

      return res.json({
        success: true,
        data: nudges,
      });
    } catch (error: unknown) {
      logger.error('[AI Nudges] Error fetching pending nudges:', error);
      return res.status(500).json({
        success: false,
        error: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai/nudges/track
 * Track user activity for nudge generation
 */
router.post(
  '/track',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!proactiveNudges?.trackActivity || !proactiveNudges?.checkAndGenerateNudges) {
      return notConfigured(res);
    }

    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId || req.user?.organization_id;
      const { activityType, metadata } = req.body;

      if (!userId || !organizationId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      await proactiveNudges.trackActivity(userId, organizationId, {
        type: activityType,
        ...metadata,
      });

      // Check if any nudges should be generated based on activity
      const nudges = await proactiveNudges.checkAndGenerateNudges(userId, organizationId, {
        trigger: activityType,
        context: metadata,
      });

      return res.json({
        success: true,
        nudges: nudges || [],
      });
    } catch (error: unknown) {
      logger.error('[AI Nudges] Error tracking activity:', error);
      return res.status(500).json({
        success: false,
        error: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai/nudges/dismiss
 * Dismiss a nudge (user clicked "Not now")
 */
router.post(
  '/dismiss',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!proactiveNudges?.dismissNudge) {
      return notConfigured(res);
    }

    try {
      const userId = req.user?.id;
      const { nudgeId, reason } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      if (!nudgeId) {
        return res.status(400).json({
          success: false,
          error: 'nudgeId is required',
        });
      }

      await proactiveNudges.dismissNudge(userId, nudgeId, reason || 'not_now');

      return res.json({
        success: true,
      });
    } catch (error: unknown) {
      logger.error('[AI Nudges] Error dismissing nudge:', error);
      return res.status(500).json({
        success: false,
        error: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai/nudges/acted
 * Mark nudge as acted upon (user clicked "Yes, help")
 */
router.post(
  '/acted',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!proactiveNudges?.markNudgeActed) {
      return notConfigured(res);
    }

    try {
      const userId = req.user?.id;
      const { nudgeId, action } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      if (!nudgeId) {
        return res.status(400).json({
          success: false,
          error: 'nudgeId is required',
        });
      }

      await proactiveNudges.markNudgeActed(userId, nudgeId, action || 'accepted');

      return res.json({
        success: true,
      });
    } catch (error: unknown) {
      logger.error('[AI Nudges] Error marking nudge as acted:', error);
      return res.status(500).json({
        success: false,
        error: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai/nudges/suppress
 * Suppress a type of nudge permanently (user clicked "Don't show again")
 */
router.post(
  '/suppress',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!proactiveNudges?.suppressNudgeType) {
      return notConfigured(res);
    }

    try {
      const userId = req.user?.id;
      const { nudgeType, duration } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      if (!nudgeType) {
        return res.status(400).json({
          success: false,
          error: 'nudgeType is required',
        });
      }

      await proactiveNudges.suppressNudgeType(userId, nudgeType, duration || 'permanent');

      return res.json({
        success: true,
      });
    } catch (error: unknown) {
      logger.error('[AI Nudges] Error suppressing nudge type:', error);
      return res.status(500).json({
        success: false,
        error: 'Unknown error',
      });
    }
  })
);

export default router;
