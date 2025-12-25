const express = require('express');
const router = express.Router();
const InitiativeGeneratorService = require('../services/initiativeGeneratorService');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

/**
 * Generate initiatives from assessments (legacy)
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

// =====================================================
// NEW ENDPOINTS: Initiative Generator Wizard
// =====================================================

/**
 * Generate initiatives from single assessment with constraints
 * POST /api/initiatives/generate/:assessmentId
 */
router.post('/generate/:assessmentId', async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const constraints = req.body;

        const initiatives = await InitiativeGeneratorService.generateFromAssessment(
            assessmentId,
            constraints
        );

        res.json({
            success: true,
            initiatives,
            count: initiatives.length
        });
    } catch (error) {
        console.error('[InitiativeGenerator API] Generate error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * AI-powered generation with custom parameters
 * POST /api/initiatives/generate/ai
 */
router.post('/generate/ai', async (req, res) => {
    try {
        const { gaps, constraints, context } = req.body;

        if (!gaps || !Array.isArray(gaps)) {
            return res.status(400).json({ error: 'Gaps array is required' });
        }

        const initiatives = await InitiativeGeneratorService.generateWithAI(
            gaps,
            constraints || {},
            context || {}
        );

        res.json({
            success: true,
            initiatives,
            count: initiatives.length
        });
    } catch (error) {
        console.error('[InitiativeGenerator API] AI Generate error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get draft initiatives for assessment
 * GET /api/initiatives/draft/:assessmentId
 */
router.get('/draft/:assessmentId', async (req, res) => {
    try {
        const { assessmentId } = req.params;

        const initiatives = await InitiativeGeneratorService.getDraftInitiatives(assessmentId);

        res.json({
            success: true,
            initiatives,
            count: initiatives.length
        });
    } catch (error) {
        console.error('[InitiativeGenerator API] Get draft error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Save draft initiatives
 * POST /api/initiatives/draft/:assessmentId
 */
router.post('/draft/:assessmentId', async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { initiatives } = req.body;

        if (!initiatives || !Array.isArray(initiatives)) {
            return res.status(400).json({ error: 'Initiatives array is required' });
        }

        await InitiativeGeneratorService.saveDraft(assessmentId, initiatives);

        res.json({
            success: true,
            message: 'Draft saved successfully'
        });
    } catch (error) {
        console.error('[InitiativeGenerator API] Save draft error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Validate initiative before approval
 * POST /api/initiatives/validate
 */
router.post('/validate', async (req, res) => {
    try {
        const { initiative } = req.body;

        if (!initiative) {
            return res.status(400).json({ error: 'Initiative object is required' });
        }

        const validation = await InitiativeGeneratorService.validateInitiative(initiative);

        res.json({
            success: true,
            ...validation
        });
    } catch (error) {
        console.error('[InitiativeGenerator API] Validate error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Approve and transfer initiatives to Module 3
 * POST /api/initiatives/approve
 */
router.post('/approve', async (req, res) => {
    try {
        const { initiatives, projectId } = req.body;
        const userId = req.user.id;

        if (!initiatives || !Array.isArray(initiatives)) {
            return res.status(400).json({ error: 'Initiatives array is required' });
        }

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        const result = await InitiativeGeneratorService.approveAndTransfer(
            initiatives,
            projectId,
            userId
        );

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('[InitiativeGenerator API] Approve error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get gaps for assessment (for wizard step 1)
 * GET /api/initiatives/gaps/:assessmentId
 */
router.get('/gaps/:assessmentId', async (req, res) => {
    try {
        const { assessmentId } = req.params;

        const assessment = await InitiativeGeneratorService.getAssessmentById(assessmentId);
        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const gaps = InitiativeGeneratorService.extractGapsFromAssessment(assessment);

        res.json({
            success: true,
            gaps,
            assessment: {
                id: assessment.id,
                status: assessment.workflow_state,
                projectName: assessment.project_name
            }
        });
    } catch (error) {
        console.error('[InitiativeGenerator API] Get gaps error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
