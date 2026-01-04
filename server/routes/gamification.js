/**
 * Gamification API Routes
 */

import express from 'express';
const router = express.Router();
import * as GamificationServiceModule from '../services/gamificationService.js';
const GamificationService = GamificationServiceModule.default || GamificationServiceModule;
import auth from '../middleware/authMiddleware.js';

// GET /api/gamification/me — Get current user's stats
router.get('/me', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const profile = await GamificationService.getUserProfile(userId);
        const achievements = await GamificationService.getUserAchievements(userId);

        res.json({
            success: true,
            data: {
                ...profile,
                achievements
            }
        });
    } catch (error) {
        console.error('Gamification profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
