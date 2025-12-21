/**
 * Gamification API Routes
 */

const express = require('express');
const router = express.Router();
const GamificationService = require('../services/gamificationService');
const auth = require('../middleware/authMiddleware');

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

module.exports = router;
