/**
 * Journey Analytics API Routes
 * 
 * Endpoints for user journey tracking and analytics dashboard.
 */

const express = require('express');
const router = express.Router();
const JourneyAnalytics = require('../services/journeyAnalytics');
const auth = require('../middleware/authMiddleware');

// Middleware to check if user is admin (for aggregate endpoints)
const requireAdmin = (req, res, next) => {
    if (!req.user?.role || !['superadmin', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// POST /api/analytics/journey/track — Track event from frontend
router.post('/track', auth, async (req, res) => {
    try {
        const { eventType, eventName, phase, metadata } = req.body;
        const userId = req.user.id;

        if (!eventType || !eventName) {
            return res.status(400).json({ error: 'eventType and eventName are required' });
        }

        let result;
        switch (eventType) {
            case 'phase_entry':
                result = await JourneyAnalytics.trackPhaseEntry(userId, phase, metadata);
                break;
            case 'milestone':
                result = await JourneyAnalytics.trackMilestone(userId, eventName, metadata);
                break;
            case 'feature_use':
                result = await JourneyAnalytics.trackFeatureUse(userId, eventName, metadata);
                break;
            case 'tour_event':
                result = await JourneyAnalytics.trackTourEvent(userId, metadata?.tourId, eventName, metadata);
                break;
            default:
                return res.status(400).json({ error: `Unknown eventType: ${eventType}` });
        }

        res.json(result);
    } catch (error) {
        console.error('Journey track error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/journey/me — Get current user's journey
router.get('/me', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const journey = await JourneyAnalytics.getUserJourney(userId);
        const ttv = await JourneyAnalytics.calculateTimeToValue(userId);

        // Check activation status for each phase
        const activation = {};
        for (const phase of ['A', 'B', 'C', 'D', 'E', 'F']) {
            activation[phase] = await JourneyAnalytics.isActivated(userId, phase);
        }

        res.json({
            success: true,
            journey,
            timeToValue: ttv,
            activation,
        });
    } catch (error) {
        console.error('Journey get error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/journey/funnel — Get funnel metrics (admin only)
router.get('/funnel', auth, requireAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const funnel = await JourneyAnalytics.getFunnelMetrics({ startDate, endDate });
        const dropOff = await JourneyAnalytics.getDropOffAnalysis({ startDate, endDate });

        res.json({
            success: true,
            funnel,
            dropOff,
        });
    } catch (error) {
        console.error('Funnel metrics error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/journey/ttv — Get average TTV (admin only)
router.get('/ttv', auth, requireAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const ttv = await JourneyAnalytics.getAverageTTV({ startDate, endDate });

        res.json({
            success: true,
            ...ttv,
        });
    } catch (error) {
        console.error('TTV metrics error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/journey/user/:userId — Get specific user journey (admin only)
router.get('/user/:userId', auth, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const journey = await JourneyAnalytics.getUserJourney(userId);
        const ttv = await JourneyAnalytics.calculateTimeToValue(userId);

        res.json({
            success: true,
            userId,
            journey,
            timeToValue: ttv,
        });
    } catch (error) {
        console.error('User journey error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
