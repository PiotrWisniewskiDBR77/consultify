/**
 * AI Nudges Routes
 * API endpoints for managing proactive AI nudges
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const serviceFallback = (req: AuthRequest, res: Response) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.status(200).json({
      success: true,
      data: [],
      status: 'not_configured',
      feature: 'ai-nudges',
      writable: false,
    });
  }
  return res.status(501).json({
    success: false,
    error: 'Feature not configured in this deployment',
    code: 'FEATURE_NOT_CONFIGURED',
    feature: 'ai-nudges',
    writable: false,
  });
};

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
  const nudgesModule = await import('../services/ai/proactiveNudges.js');
  const module = (nudgesModule as any).default || nudgesModule;
  proactiveNudges = ((module as any).proactiveNudges || module) as ProactiveNudgesInterface;
} catch {
  console.warn('[AI Nudges Routes] proactiveNudges service not available');
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
      return serviceFallback(req, res);
    }

    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId || req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const nudges = await proactiveNudges.getPendingNudges(userId, organizationId);

      res.json({
        success: true,
        data: nudges,
      });
    } catch (error: unknown) {
      console.error('[AI Nudges] Error fetching pending nudges:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
      return serviceFallback(req, res);
    }

    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId || req.user?.organizationId;
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

      res.json({
        success: true,
        nudges: nudges || [],
      });
    } catch (error: unknown) {
      console.error('[AI Nudges] Error tracking activity:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
      return serviceFallback(req, res);
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

      res.json({
        success: true,
      });
    } catch (error: unknown) {
      console.error('[AI Nudges] Error dismissing nudge:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
      return serviceFallback(req, res);
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

      res.json({
        success: true,
      });
    } catch (error: unknown) {
      console.error('[AI Nudges] Error marking nudge as acted:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
      return serviceFallback(req, res);
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

      res.json({
        success: true,
      });
    } catch (error: unknown) {
      console.error('[AI Nudges] Error suppressing nudge type:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

export default router;
