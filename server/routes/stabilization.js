// Stabilization Routes - Phase 6 management
// Step 6: Stabilization, Reporting & Economics

const express = require('express');
const router = express.Router();
const StabilizationService = require('../services/stabilizationService');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/stabilization/:projectId/entry-criteria
router.get('/:projectId/entry-criteria', verifyToken, async (req, res) => {
    try {
        const criteria = await StabilizationService.checkEntryCriteria(req.params.projectId);
        res.json(criteria);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stabilization/:projectId/exit-criteria
router.get('/:projectId/exit-criteria', verifyToken, async (req, res) => {
    try {
        const criteria = await StabilizationService.checkExitCriteria(req.params.projectId);
        res.json(criteria);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stabilization/:projectId/summary
router.get('/:projectId/summary', verifyToken, async (req, res) => {
    try {
        const summary = await StabilizationService.getStabilizationSummary(req.params.projectId);
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/stabilization/initiatives/:id/status
router.patch('/initiatives/:id/status', verifyToken, async (req, res) => {
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'status required' });
    }

    try {
        const result = await StabilizationService.setStabilizationStatus(req.params.id, status, req.userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/stabilization/:projectId/close
router.post('/:projectId/close', verifyToken, async (req, res) => {
    if (!req.can('approve_changes')) {
        return res.status(403).json({ error: 'Permission denied: Project closure requires approval rights' });
    }

    const { closureType, lessonsLearned } = req.body;

    if (!closureType || !['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(closureType)) {
        return res.status(400).json({ error: 'Valid closureType required (COMPLETED, CANCELLED, ARCHIVED)' });
    }

    try {
        const result = await StabilizationService.closeProject(
            req.params.projectId, closureType, req.userId, lessonsLearned
        );
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

