// @ts-nocheck
/**
 * Gamification Routes
 * API endpoints for gamification
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

// Apply rate limiting
const router = Router();

const serviceFallback = (req: AuthRequest, res: Response, readPayload?: Record<string, unknown>) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.status(200).json({
      success: true,
      status: 'not_configured',
      feature: 'gamification',
      writable: false,
      ...(readPayload || {}),
    });
  }
  return res.status(501).json({
    success: false,
    error: 'Feature not configured in this deployment',
    code: 'FEATURE_NOT_CONFIGURED',
    feature: 'gamification',
    writable: false,
  });
};

// Service interfaces
interface GamificationServiceInterface {
  getUserProfile?: (userId: string) => Promise<unknown>;
  getUserAchievements?: (userId: string) => Promise<unknown>;
}

// Dynamic import for GamificationService (may not be migrated yet)
const GamificationService: GamificationServiceInterface | null = null;

// Service is currently not available - import commented out
// Uncomment when service is ready:
// try {
//   const gamificationModule = (await import('../services/gamificationService.js')) as any;
//   GamificationService = (gamificationModule.default ||
//     gamificationModule) as GamificationServiceInterface;
// } catch {
//   logger.debug('[Gamification Routes] GamificationService not available');
// }

/**
 * GET /api/gamification/me
 * Get current user's stats and achievements
 */
router.get(
  '/me',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!GamificationService?.getUserProfile || !GamificationService?.getUserAchievements) {
      return serviceFallback(req, res, { data: { achievements: [] } });
    }

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const profile = await GamificationService.getUserProfile(userId);
      const achievements = await GamificationService.getUserAchievements(userId);

      return res.json({
        success: true,
        data: {
          ...(profile as Record<string, unknown>),
          achievements,
        },
      });
    } catch (error: unknown) {
      logger.error('Gamification profile error:', error);
      return res
        .status(500)
        .json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  })
);

export default router;
