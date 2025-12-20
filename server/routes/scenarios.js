// Scenarios Routes - What-if analysis
// Step 4: Roadmap, Sequencing & Capacity

const express = require('express');
const router = express.Router();
const ScenarioService = require('../services/scenarioService');
const CriticalPathService = require('../services/criticalPathService');
const verifyToken = require('../middleware/authMiddleware');

// POST /api/scenarios/:projectId
router.post('/:projectId', verifyToken, async (req, res) => {
    const { name, proposedChanges, persist } = req.body;

    if (!name || !proposedChanges || !Array.isArray(proposedChanges)) {
        return res.status(400).json({ error: 'name and proposedChanges array required' });
    }

    try {
        const scenario = await ScenarioService.createScenario(
            req.params.projectId, name, proposedChanges, req.userId, persist
        );
        res.status(201).json(scenario);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/scenarios/:projectId
router.get('/:projectId', verifyToken, async (req, res) => {
    try {
        const scenarios = await ScenarioService.getScenarios(req.params.projectId);
        res.json(scenarios);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/scenarios/:projectId/analyze
router.post('/:projectId/analyze', verifyToken, async (req, res) => {
    const { proposedChanges } = req.body;

    if (!proposedChanges || !Array.isArray(proposedChanges)) {
        return res.status(400).json({ error: 'proposedChanges array required' });
    }

    try {
        const impact = await ScenarioService.analyzeImpact(req.params.projectId, proposedChanges);
        res.json(impact);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/scenarios/:projectId/critical-path
router.get('/:projectId/critical-path', verifyToken, async (req, res) => {
    try {
        const criticalPath = await CriticalPathService.calculateCriticalPath(req.params.projectId);
        res.json(criticalPath);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/scenarios/:projectId/schedule-risks
router.get('/:projectId/schedule-risks', verifyToken, async (req, res) => {
    try {
        const analysis = await CriticalPathService.analyzeScheduleRisks(req.params.projectId);
        res.json(analysis);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/scenarios/:projectId/conflicts
router.get('/:projectId/conflicts', verifyToken, async (req, res) => {
    try {
        const conflicts = await CriticalPathService.detectSchedulingConflicts(req.params.projectId);
        res.json(conflicts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
