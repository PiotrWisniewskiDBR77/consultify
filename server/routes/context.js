const express = require('express');
const router = express.Router();
const ContextService = require('../services/contextService');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/context/:projectId
router.get('/:projectId', verifyToken, async (req, res) => {
    try {
        const context = await ContextService.getContext(req.params.projectId);
        if (!context) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Calculate readiness
        const readiness = ContextService.calculateReadiness(context);

        res.json({
            ...context,
            contextReadinessScore: readiness.score,
            contextGaps: readiness.gaps,
            isContextComplete: readiness.isComplete
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/context/:projectId
router.put('/:projectId', verifyToken, async (req, res) => {
    if (!req.can('edit_project_settings')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const result = await ContextService.saveContext(req.params.projectId, req.body);

        // Return updated readiness
        const readiness = ContextService.calculateReadiness(req.body);

        res.json({
            ...result,
            contextReadinessScore: readiness.score,
            contextGaps: readiness.gaps,
            isContextComplete: readiness.isComplete
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/context/:projectId/analyze (AI Analysis)
router.post('/:projectId/analyze', verifyToken, async (req, res) => {
    try {
        const context = await ContextService.getContext(req.params.projectId);
        const readiness = ContextService.calculateReadiness(context);

        // Future: Call AI to analyze context sufficiency
        // For now, return heuristic result
        res.json({
            contextReadinessScore: readiness.score,
            contextGaps: readiness.gaps,
            isContextComplete: readiness.isComplete,
            aiRecommendations: readiness.gaps.length > 0
                ? [`Please provide: ${readiness.gaps.join(', ')}`]
                : ['Context is complete. You may proceed to Assessment.']
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
