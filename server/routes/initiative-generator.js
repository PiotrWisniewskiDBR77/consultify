const express = require('express');
const router = express.Router();
const InitiativeGeneratorService = require('../services/initiativeGeneratorService');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

/**
 * Generate initiatives from assessments
 * POST /api/initiatives/generate-from-assessments
 */
router.post('/generate-from-assessments', async (req, res) => {
    try {
        const { projectId, drdAssessmentId, leanAssessmentId, externalAssessmentIds } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        // Generate initiative drafts
        const initiatives = await InitiativeGeneratorService.generateInitiativesFromAssessments({
            organizationId,
            projectId,
            drdAssessmentId,
            leanAssessmentId,
            externalAssessmentIds: externalAssessmentIds || [],
            userId
        });

        // Save to database
        const savedIds = await InitiativeGeneratorService.saveInitiatives(
            initiatives,
            organizationId,
            projectId
        );

        res.json({
            initiatives,
            savedIds,
            count: initiatives.length
        });
    } catch (error) {
        console.error('[InitiativeGenerator API] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
