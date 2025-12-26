const express = require('express');
const router = express.Router();
const InitiativeGeneratorService = require('../services/initiativeGeneratorService');
const AICharterGeneratorService = require('../services/aiCharterGeneratorService');
const InitiativeTemplateService = require('../services/initiativeTemplateService');
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
        const organizationId = req.user.organizationId; // ADDED: Get organizationId from token

        if (!initiatives || !Array.isArray(initiatives)) {
            return res.status(400).json({ error: 'Initiatives array is required' });
        }

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required (from user token)' });
        }

        const result = await InitiativeGeneratorService.approveAndTransfer(
            initiatives,
            projectId,
            userId,
            organizationId // ADDED: Pass organizationId to service
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

// =====================================================
// AI CHARTER GENERATOR ENDPOINTS
// =====================================================

/**
 * Generate full AI charter from gaps/report
 * POST /api/initiatives/charter/generate
 */
router.post('/charter/generate', async (req, res) => {
    try {
        const request = req.body;
        const userId = req.user.id;

        if (!request.sourceType) {
            return res.status(400).json({ error: 'sourceType is required (GAP, REPORT, or MANUAL)' });
        }

        const charter = await AICharterGeneratorService.generateFullCharter(request, userId);

        res.json({
            success: true,
            charter,
            generationConfidence: charter.generationConfidence
        });
    } catch (error) {
        console.error('[AICharter API] Generate error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Regenerate a specific section of the charter
 * POST /api/initiatives/charter/regenerate-section
 */
router.post('/charter/regenerate-section', async (req, res) => {
    try {
        const { charter, section, context } = req.body;

        if (!charter || !section) {
            return res.status(400).json({ error: 'charter and section are required' });
        }

        const validSections = ['problem', 'target', 'kill', 'risks', 'tasks', 'team'];
        if (!validSections.includes(section)) {
            return res.status(400).json({ 
                error: `Invalid section. Must be one of: ${validSections.join(', ')}` 
            });
        }

        const regenerated = await AICharterGeneratorService.regenerateSection(
            charter, 
            section, 
            context || {}
        );

        res.json({
            success: true,
            section,
            data: regenerated
        });
    } catch (error) {
        console.error('[AICharter API] Regenerate section error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// TEMPLATE LIBRARY ENDPOINTS
// =====================================================

/**
 * Get all available templates
 * GET /api/initiatives/templates
 */
router.get('/templates', async (req, res) => {
    try {
        const { category } = req.query;
        const organizationId = req.user.organizationId;

        const templates = await InitiativeTemplateService.getTemplates({
            category: category || null,
            organizationId,
            includePublic: true
        });

        res.json({
            success: true,
            templates,
            count: templates.length
        });
    } catch (error) {
        console.error('[Templates API] List error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get template categories with counts
 * GET /api/initiatives/templates/categories
 */
router.get('/templates/categories', async (req, res) => {
    try {
        const categories = await InitiativeTemplateService.getTemplateCategories();

        res.json({
            success: true,
            categories
        });
    } catch (error) {
        console.error('[Templates API] Categories error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Search templates
 * GET /api/initiatives/templates/search
 */
router.get('/templates/search', async (req, res) => {
    try {
        const { q } = req.query;
        const organizationId = req.user.organizationId;

        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }

        const templates = await InitiativeTemplateService.searchTemplates(q, organizationId);

        res.json({
            success: true,
            templates,
            count: templates.length
        });
    } catch (error) {
        console.error('[Templates API] Search error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get single template by ID
 * GET /api/initiatives/templates/:id
 */
router.get('/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const template = await InitiativeTemplateService.getTemplateById(id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json({
            success: true,
            template
        });
    } catch (error) {
        console.error('[Templates API] Get error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create a custom template
 * POST /api/initiatives/templates
 */
router.post('/templates', async (req, res) => {
    try {
        const template = req.body;
        const userId = req.user.id;

        if (!template.name || !template.category) {
            return res.status(400).json({ error: 'name and category are required' });
        }

        const validCategories = ['DATA', 'PROCESS', 'PRODUCT', 'CULTURE', 'SECURITY', 'AI_ML', 'CUSTOM'];
        if (!validCategories.includes(template.category)) {
            return res.status(400).json({ 
                error: `Invalid category. Must be one of: ${validCategories.join(', ')}` 
            });
        }

        // Set organization ID from user token
        template.organizationId = req.user.organizationId;

        const created = await InitiativeTemplateService.createTemplate(template, userId);

        res.status(201).json({
            success: true,
            template: created
        });
    } catch (error) {
        console.error('[Templates API] Create error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update a template
 * PUT /api/initiatives/templates/:id
 */
router.put('/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const updated = await InitiativeTemplateService.updateTemplate(id, updates);

        res.json({
            success: true,
            template: updated
        });
    } catch (error) {
        console.error('[Templates API] Update error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Delete a template
 * DELETE /api/initiatives/templates/:id
 */
router.delete('/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await InitiativeTemplateService.deleteTemplate(id);
        if (!deleted) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json({
            success: true,
            message: 'Template deleted'
        });
    } catch (error) {
        console.error('[Templates API] Delete error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Apply template to charter
 * POST /api/initiatives/templates/:id/apply
 */
router.post('/templates/:id/apply', async (req, res) => {
    try {
        const { id } = req.params;
        const { charter } = req.body;

        if (!charter) {
            return res.status(400).json({ error: 'charter object is required' });
        }

        const merged = await InitiativeTemplateService.applyTemplate(id, charter);

        res.json({
            success: true,
            charter: merged
        });
    } catch (error) {
        console.error('[Templates API] Apply error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
