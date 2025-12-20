const express = require('express');
const router = express.Router();
const ExecutionService = require('../services/executionService');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/execution/:projectId/summary
router.get('/:projectId/summary', verifyToken, async (req, res) => {
    try {
        const summary = await ExecutionService.getExecutionSummary(req.params.projectId);
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/execution/:projectId/blockers
router.get('/:projectId/blockers', verifyToken, async (req, res) => {
    try {
        const blockers = await ExecutionService.getBlockedTasks(req.params.projectId);
        res.json(blockers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/execution/:projectId/gate-check
router.post('/:projectId/gate-check', verifyToken, async (req, res) => {
    const { targetPhase } = req.body;

    try {
        const result = await ExecutionService.checkDecisionGate(req.params.projectId, targetPhase);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
