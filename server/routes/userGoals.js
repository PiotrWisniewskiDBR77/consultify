/**
 * User Goals API Routes
 */

import express from 'express';
const router = express.Router();
const UserGoalsService = import('userGoals.js');
import auth from '../middleware/authMiddleware.js';

// GET /api/user/goals — Get user's current goal
router.get('/goals', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const goal = await UserGoalsService.getUserGoal(userId);

        if (!goal) {
            return res.json({ success: true, goal: null });
        }

        // Include suggested actions
        const suggestedActions = UserGoalsService.getSuggestedActions(goal.goalId);
        const tourId = UserGoalsService.getTourForGoal(goal.goalId);

        res.json({
            success: true,
            goal: {
                ...goal,
                suggestedActions,
                tourId,
            },
        });
    } catch (error) {
        console.error('Get user goal error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/user/goals — Set user's goal
router.post('/goals', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { goalId, metadata } = req.body;

        if (!goalId) {
            return res.status(400).json({ error: 'goalId is required' });
        }

        const result = await UserGoalsService.setUserGoal(userId, goalId, metadata || {});

        // Get suggested actions for response
        const suggestedActions = UserGoalsService.getSuggestedActions(goalId);
        const tourId = UserGoalsService.getTourForGoal(goalId);

        res.json({
            success: true,
            goal: {
                ...result,
                suggestedActions,
                tourId,
            },
        });
    } catch (error) {
        console.error('Set user goal error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/user/goals/history — Get goal history
router.get('/goals/history', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const history = await UserGoalsService.getGoalHistory(userId);

        res.json({
            success: true,
            history,
        });
    } catch (error) {
        console.error('Get goal history error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
