// Baselines Routes - Schedule baseline management
// Step 4: Roadmap, Sequencing & Capacity

const express = require('express');
const router = express.Router();
const BaselineService = require('../services/baselineService');
const verifyToken = require('../middleware/authMiddleware');

// POST /api/baselines/:roadmapId/capture
router.post('/:roadmapId/capture', verifyToken, async (req, res) => {
    if (!req.can('approve_changes')) {
        return res.status(403).json({ error: 'Permission denied: Baseline requires approval rights' });
    }

    const { projectId, rationale } = req.body;
    if (!projectId || !rationale) {
        return res.status(400).json({ error: 'projectId and rationale required' });
    }

    try {
        const baseline = await BaselineService.captureBaseline(req.params.roadmapId, projectId, req.userId, rationale);
        res.status(201).json(baseline);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/baselines/:roadmapId/current
router.get('/:roadmapId/current', verifyToken, async (req, res) => {
    try {
        const baseline = await BaselineService.getBaseline(req.params.roadmapId);
        if (!baseline) {
            return res.status(404).json({ error: 'No baseline found' });
        }
        res.json(baseline);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/baselines/:roadmapId/history
router.get('/:roadmapId/history', verifyToken, async (req, res) => {
    try {
        const history = await BaselineService.getBaselineHistory(req.params.roadmapId);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/baselines/:roadmapId/variance
router.get('/:roadmapId/variance', verifyToken, async (req, res) => {
    const { version } = req.query;
    try {
        const variance = await BaselineService.calculateVariance(req.params.roadmapId, version ? parseInt(version) : null);
        res.json(variance);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
