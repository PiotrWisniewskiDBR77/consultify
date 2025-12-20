const express = require('express');
const router = express.Router();
const AssessmentService = require('../services/assessmentService');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/assessment/:projectId
router.get('/:projectId', verifyToken, async (req, res) => {
    try {
        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.json({ projectId: req.params.projectId, axisScores: [], completedAxes: [], isComplete: false });
        }

        // Add gap analysis
        const gapAnalysis = AssessmentService.generateGapSummary(assessment);

        res.json({
            ...assessment,
            ...gapAnalysis
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/assessment/:projectId
router.put('/:projectId', verifyToken, async (req, res) => {
    if (!req.can('edit_project_settings')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const result = await AssessmentService.saveAssessment(req.params.projectId, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/assessment/:projectId/gap-analysis (AI Triggered)
router.post('/:projectId/gap-analysis', verifyToken, async (req, res) => {
    try {
        const assessment = await AssessmentService.getAssessment(req.params.projectId);
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const gapAnalysis = AssessmentService.generateGapSummary(assessment);

        // Future: Call AI for deeper analysis
        res.json({
            ...gapAnalysis,
            aiRecommendations: gapAnalysis.prioritizedGaps.length > 0
                ? [`Focus on closing gaps in: ${gapAnalysis.prioritizedGaps.join(', ')}`]
                : ['Assessment complete. Proceed to Initiatives.']
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
