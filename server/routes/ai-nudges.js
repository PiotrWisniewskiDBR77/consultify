/**
 * AI Nudges API Routes
 * 
 * Endpoints for managing proactive AI nudges.
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { proactiveNudges } = require('../services/ai/proactiveNudges');

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/ai/nudges/pending
 * Get pending nudges for the current user
 */
router.get('/pending', async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organization_id;

        const nudges = await proactiveNudges.getPendingNudges(userId, organizationId);

        res.json({
            success: true,
            data: nudges
        });
    } catch (error) {
        console.error('[AI Nudges] Error fetching pending nudges:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ai/nudges/track
 * Track user activity for nudge generation
 */
router.post('/track', async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organization_id;
        const { activityType, metadata } = req.body;

        await proactiveNudges.trackActivity(userId, organizationId, {
            type: activityType,
            ...metadata
        });

        // Check if any nudges should be generated based on activity
        const nudges = await proactiveNudges.checkAndGenerateNudges(userId, organizationId, {
            trigger: activityType,
            context: metadata
        });

        res.json({
            success: true,
            nudges: nudges || []
        });
    } catch (error) {
        console.error('[AI Nudges] Error tracking activity:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ai/nudges/dismiss
 * Dismiss a nudge (user clicked "Not now")
 */
router.post('/dismiss', async (req, res) => {
    try {
        const userId = req.user.id;
        const { nudgeId, reason } = req.body;

        if (!nudgeId) {
            return res.status(400).json({
                success: false,
                error: 'nudgeId is required'
            });
        }

        await proactiveNudges.dismissNudge(userId, nudgeId, reason || 'not_now');

        res.json({
            success: true
        });
    } catch (error) {
        console.error('[AI Nudges] Error dismissing nudge:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ai/nudges/acted
 * Mark nudge as acted upon (user clicked "Yes, help")
 */
router.post('/acted', async (req, res) => {
    try {
        const userId = req.user.id;
        const { nudgeId, action } = req.body;

        if (!nudgeId) {
            return res.status(400).json({
                success: false,
                error: 'nudgeId is required'
            });
        }

        await proactiveNudges.markNudgeActed(userId, nudgeId, action || 'accepted');

        res.json({
            success: true
        });
    } catch (error) {
        console.error('[AI Nudges] Error marking nudge as acted:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ai/nudges/suppress
 * Suppress a type of nudge permanently (user clicked "Don't show again")
 */
router.post('/suppress', async (req, res) => {
    try {
        const userId = req.user.id;
        const { nudgeType, duration } = req.body;

        if (!nudgeType) {
            return res.status(400).json({
                success: false,
                error: 'nudgeType is required'
            });
        }

        await proactiveNudges.suppressNudgeType(userId, nudgeType, duration || 'permanent');

        res.json({
            success: true
        });
    } catch (error) {
        console.error('[AI Nudges] Error suppressing nudge type:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;

