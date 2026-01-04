/**
 * Gamification Routes
 * API endpoints for gamification
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

// Service interfaces
interface GamificationServiceInterface {
    getUserProfile?: (userId: string) => Promise<unknown>;
    getUserAchievements?: (userId: string) => Promise<unknown>;
}

// Dynamic import for GamificationService (may not be migrated yet)
let GamificationService: GamificationServiceInterface | null = null;

try {
    const gamificationModule = await import('../../services/gamificationService.js');
    GamificationService = (gamificationModule.default || gamificationModule) as GamificationServiceInterface;
} catch {
    logger.warn('[Gamification Routes] GamificationService not available');
}

/**
 * GET /api/gamification/me
 * Get current user's stats and achievements
 */
router.get(
    '/me',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!GamificationService?.getUserProfile || !GamificationService?.getUserAchievements) {
            return res.status(503).json({ error: 'Gamification service not available' });
        }

        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const profile = await GamificationService.getUserProfile(userId);
            const achievements = await GamificationService.getUserAchievements(userId);

            res.json({
                success: true,
                data: {
                    ...(profile as Record<string, unknown>),
                    achievements,
                },
            });
        } catch (error: unknown) {
            logger.error('Gamification profile error:', error);
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }),
);

export default router;
