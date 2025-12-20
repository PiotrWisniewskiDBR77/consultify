const express = require('express');
const router = express.Router();
const RoadmapService = require('../services/roadmapService');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/roadmap/:projectId/waves
router.get('/:projectId/waves', verifyToken, async (req, res) => {
    try {
        const waves = await RoadmapService.getWaves(req.params.projectId);
        res.json(waves);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/roadmap/:projectId/summary
router.get('/:projectId/summary', verifyToken, async (req, res) => {
    try {
        const summary = await RoadmapService.getRoadmapSummary(req.params.projectId);
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/roadmap/:projectId/waves
router.post('/:projectId/waves', verifyToken, async (req, res) => {
    if (!req.can('manage_roadmap')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const wave = await RoadmapService.createWave(req.params.projectId, req.body);
        res.status(201).json(wave);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/roadmap/initiatives/:initiativeId/assign
router.patch('/initiatives/:initiativeId/assign', verifyToken, async (req, res) => {
    if (!req.can('manage_roadmap')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    const { waveId } = req.body;
    try {
        const result = await RoadmapService.assignToWave(req.params.initiativeId, waveId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/roadmap/:projectId/baseline
router.post('/:projectId/baseline', verifyToken, async (req, res) => {
    if (!req.can('approve_changes')) {
        return res.status(403).json({ error: 'Permission denied: Baseline requires approval rights' });
    }

    try {
        const result = await RoadmapService.baselineRoadmap(req.params.projectId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
