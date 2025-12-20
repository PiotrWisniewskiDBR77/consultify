const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const AIPlaybookService = require('../ai/aiPlaybookService');
const AIPlaybookEngine = require('../ai/aiPlaybookEngine');
const AIPlaybookExecutor = require('../ai/aiPlaybookExecutor');

router.use(authMiddleware);

/**
 * @route GET /api/ai/playbooks/templates
 * @desc List playbook templates (with optional status filter)
 * @access SUPERADMIN
 * @query status - Optional filter: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED'
 */
router.get('/templates', async (req, res) => {
    try {
        if (req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: SuperAdmin access required' });
        }

        const { status } = req.query;

        // If status is provided, use getTemplatesByStatus, otherwise use listTemplates
        let templates;
        if (status) {
            templates = await AIPlaybookService.getTemplatesByStatus(status.toUpperCase());
        } else {
            templates = await AIPlaybookService.listTemplates(true);
        }

        res.json(templates);
    } catch (err) {
        console.error('[AIPlaybooks] Error listing templates:', err);
        res.status(500).json({ error: err.message || 'Failed to list templates' });
    }
});

/**
 * @route POST /api/ai/playbooks/templates
 * @desc Create a playbook template (as DRAFT)
 * @access SUPERADMIN
 */
router.post('/templates', async (req, res) => {
    try {
        if (req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: SuperAdmin access required' });
        }

        const { key, title, description, triggerSignal, estimatedDurationMins, templateGraph } = req.body;
        const template = await AIPlaybookService.createDraftTemplate({
            key, title, description, triggerSignal, estimatedDurationMins, templateGraph
        });

        res.status(201).json(template);
    } catch (err) {
        console.error('[AIPlaybooks] Error creating template:', err);
        res.status(400).json({ error: err.message });
    }
});

/**
 * @route GET /api/ai/playbooks/proposals
 * @desc Get playbook proposals for current org
 * @access ADMIN/SUPERADMIN
 */
router.get('/proposals', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const AICoach = require('../ai/aiCoach');
        const report = await AICoach.getAdvisoryReport(req.organizationId);
        const proposals = await AIPlaybookEngine.generatePlaybookProposals({
            data: report.context_snapshot,
            organization: { id: req.organizationId }
        });

        res.json(proposals);
    } catch (err) {
        console.error('[AIPlaybooks] Error generating proposals:', err);
        res.status(500).json({ error: 'Failed to generate proposals' });
    }
});

/**
 * @route POST /api/ai/playbooks/runs
 * @desc Initiate a playbook run
 * @access ADMIN/SUPERADMIN
 */
router.post('/runs', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const { templateId, contextSnapshot } = req.body;

        if (!templateId) {
            return res.status(400).json({ error: 'templateId is required' });
        }

        const run = await AIPlaybookService.initiateRun({
            templateId,
            organizationId: req.organizationId,
            initiatedBy: req.userId,
            contextSnapshot
        });

        res.status(201).json(run);
    } catch (err) {
        console.error('[AIPlaybooks] Error initiating run:', err);
        res.status(400).json({ error: err.message });
    }
});

/**
 * @route GET /api/ai/playbooks/runs/:id
 * @desc Get run status with steps
 * @access ADMIN/SUPERADMIN
 */
router.get('/runs/:id', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const run = await AIPlaybookService.getRun(req.params.id);

        if (!run) {
            return res.status(404).json({ error: 'Run not found' });
        }

        // Org isolation for non-superadmins
        if (req.user.role !== 'SUPERADMIN' && run.organizationId !== req.organizationId) {
            return res.status(403).json({ error: 'Forbidden: Organization mismatch' });
        }

        res.json(run);
    } catch (err) {
        console.error('[AIPlaybooks] Error getting run:', err);
        res.status(500).json({ error: 'Failed to get run' });
    }
});

/**
 * @route POST /api/ai/playbooks/runs/:id/advance
 * @desc Execute next step in the run
 * @access ADMIN/SUPERADMIN
 */
router.post('/runs/:id/advance', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const run = await AIPlaybookService.getRun(req.params.id);

        if (!run) {
            return res.status(404).json({ error: 'Run not found' });
        }

        if (req.user.role !== 'SUPERADMIN' && run.organizationId !== req.organizationId) {
            return res.status(403).json({ error: 'Forbidden: Organization mismatch' });
        }

        const result = await AIPlaybookExecutor.advanceRun(req.params.id, req.userId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (err) {
        console.error('[AIPlaybooks] Error advancing run:', err);
        res.status(500).json({ error: 'Failed to advance run' });
    }
});

/**
 * @route POST /api/ai/playbooks/runs/:id/cancel
 * @desc Cancel a run
 * @access ADMIN/SUPERADMIN
 */
router.post('/runs/:id/cancel', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const run = await AIPlaybookService.getRun(req.params.id);

        if (!run) {
            return res.status(404).json({ error: 'Run not found' });
        }

        if (req.user.role !== 'SUPERADMIN' && run.organizationId !== req.organizationId) {
            return res.status(403).json({ error: 'Forbidden: Organization mismatch' });
        }

        const result = await AIPlaybookExecutor.cancelRun(req.params.id, req.userId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (err) {
        console.error('[AIPlaybooks] Error cancelling run:', err);
        res.status(500).json({ error: 'Failed to cancel run' });
    }
});

// ==========================================
// STEP 12: CONDITIONAL BRANCHING ENDPOINTS
// ==========================================

/**
 * @route POST /api/ai/playbooks/runs/:id/dry-run-route
 * @desc Preview routing for current step without persisting
 * @access ADMIN/SUPERADMIN
 */
router.post('/runs/:id/dry-run-route', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const run = await AIPlaybookService.getRun(req.params.id);

        if (!run) {
            return res.status(404).json({ error: 'Run not found' });
        }

        if (req.user.role !== 'SUPERADMIN' && run.organizationId !== req.organizationId) {
            return res.status(403).json({ error: 'Forbidden: Organization mismatch' });
        }

        const result = await AIPlaybookExecutor.dryRunRoute(req.params.id);

        res.json(result);
    } catch (err) {
        console.error('[AIPlaybooks] Error in dry-run-route:', err);
        res.status(500).json({ error: 'Failed to evaluate routing' });
    }
});

// ==========================================
// STEP 13: VISUAL PLAYBOOK EDITOR - VERSIONING ENDPOINTS
// ==========================================

const templateValidationService = require('../ai/templateValidationService');

/**
 * @route GET /api/ai/playbooks/templates/published
 * @desc List published templates only (for ADMIN)
 * @access ADMIN/SUPERADMIN
 */
router.get('/templates/published', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const templates = await AIPlaybookService.getTemplatesByStatus('PUBLISHED');
        res.json(templates);
    } catch (err) {
        console.error('[AIPlaybooks] Error listing published templates:', err);
        res.status(500).json({ error: 'Failed to list published templates' });
    }
});

/**
 * @route GET /api/ai/playbooks/templates/:id
 * @desc Get single template by ID
 * @access SUPERADMIN (full) / ADMIN (published only)
 */
router.get('/templates/:id', async (req, res) => {
    try {
        const template = await AIPlaybookService.getTemplateById(req.params.id);

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // ADMIN can only see PUBLISHED templates
        if (req.user.role === 'ADMIN' && template.status !== 'PUBLISHED') {
            return res.status(403).json({ error: 'Forbidden: Template is not published' });
        }

        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        res.json(template);
    } catch (err) {
        console.error('[AIPlaybooks] Error getting template:', err);
        res.status(500).json({ error: 'Failed to get template' });
    }
});

/**
 * @route PUT /api/ai/playbooks/templates/:id
 * @desc Update a draft template
 * @access SUPERADMIN
 */
router.put('/templates/:id', async (req, res) => {
    try {
        if (req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: SuperAdmin access required' });
        }

        const { title, description, triggerSignal, templateGraph, estimatedDurationMins, isActive } = req.body;

        const updated = await AIPlaybookService.updateDraftTemplate(req.params.id, {
            title, description, triggerSignal, templateGraph, estimatedDurationMins, isActive
        });

        if (!updated) {
            return res.status(400).json({ error: 'No changes made' });
        }

        const template = await AIPlaybookService.getTemplateById(req.params.id);
        res.json(template);
    } catch (err) {
        console.error('[AIPlaybooks] Error updating template:', err);
        res.status(400).json({ error: err.message });
    }
});

/**
 * @route POST /api/ai/playbooks/templates/:id/validate
 * @desc Validate template graph
 * @access SUPERADMIN
 */
router.post('/templates/:id/validate', async (req, res) => {
    try {
        if (req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: SuperAdmin access required' });
        }

        const template = await AIPlaybookService.getTemplateById(req.params.id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const result = templateValidationService.validate(template);
        res.json(result);
    } catch (err) {
        console.error('[AIPlaybooks] Error validating template:', err);
        res.status(500).json({ error: 'Failed to validate template' });
    }
});

/**
 * @route POST /api/ai/playbooks/templates/:id/publish
 * @desc Publish a draft template
 * @access SUPERADMIN
 */
router.post('/templates/:id/publish', async (req, res) => {
    try {
        if (req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: SuperAdmin access required' });
        }

        // Validate before publishing
        const template = await AIPlaybookService.getTemplateById(req.params.id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const validation = templateValidationService.validate(template);
        if (!validation.ok) {
            return res.status(400).json({
                error: 'Template validation failed',
                validationErrors: validation.errors
            });
        }

        const result = await AIPlaybookService.publishTemplate(req.params.id, req.userId);
        res.json(result);
    } catch (err) {
        console.error('[AIPlaybooks] Error publishing template:', err);
        res.status(400).json({ error: err.message });
    }
});

/**
 * @route POST /api/ai/playbooks/templates/:id/deprecate
 * @desc Deprecate a template
 * @access SUPERADMIN
 */
router.post('/templates/:id/deprecate', async (req, res) => {
    try {
        if (req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: SuperAdmin access required' });
        }

        const result = await AIPlaybookService.deprecateTemplate(req.params.id);
        res.json(result);
    } catch (err) {
        console.error('[AIPlaybooks] Error deprecating template:', err);
        res.status(400).json({ error: err.message });
    }
});

/**
 * @route GET /api/ai/playbooks/templates/:id/export
 * @desc Export template as JSON
 * @access SUPERADMIN
 */
router.get('/templates/:id/export', async (req, res) => {
    try {
        if (req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: SuperAdmin access required' });
        }

        const exportData = await AIPlaybookService.exportTemplate(req.params.id);

        // Set content-disposition for download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="playbook-${req.params.id}.json"`);
        res.json(exportData);
    } catch (err) {
        console.error('[AIPlaybooks] Error exporting template:', err);
        res.status(400).json({ error: err.message });
    }
});

/**
 * @route POST /api/ai/playbooks/templates/import
 * @desc Import template from JSON
 * @access SUPERADMIN
 */
router.post('/templates/import', async (req, res) => {
    try {
        if (req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: SuperAdmin access required' });
        }

        const result = await AIPlaybookService.importTemplate(req.body, req.userId);
        res.status(201).json(result);
    } catch (err) {
        console.error('[AIPlaybooks] Error importing template:', err);
        res.status(400).json({ error: err.message });
    }
});

// ==========================================
// STEP 11: ASYNC JOB ENDPOINTS FOR PLAYBOOKS
// ==========================================

const AsyncJobService = require('../ai/asyncJobService');
const { v4: uuidv4 } = require('uuid');

/**
 * @route POST /api/ai/playbooks/runs/:id/advance-async
 * @desc Enqueue async advance to next playbook step
 * @access ADMIN/SUPERADMIN
 */
router.post('/runs/:id/advance-async', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const { priority = 'normal' } = req.body;
        const run = await AIPlaybookService.getRun(req.params.id);

        if (!run) {
            return res.status(404).json({ error: 'Run not found' });
        }

        // Org isolation
        if (req.user.role !== 'SUPERADMIN' && run.organizationId !== req.organizationId) {
            return res.status(403).json({ error: 'Forbidden: Organization mismatch' });
        }

        // Validate run state
        if (run.status === 'COMPLETED' || run.status === 'FAILED' || run.status === 'CANCELLED') {
            return res.status(400).json({ error: `Run is already ${run.status}` });
        }

        const correlationId = run.correlationId || `corr-${uuidv4()}`;
        const result = await AsyncJobService.enqueuePlaybookAdvance({
            runId: req.params.id,
            organizationId: run.organizationId,
            correlationId,
            priority,
            createdBy: req.userId
        });

        res.status(202).json(result);
    } catch (err) {
        console.error('[AIPlaybooks] Error enqueuing async advance:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/ai/playbooks/jobs/:jobId
 * @desc Get async job status
 * @access ADMIN/SUPERADMIN
 */
router.get('/jobs/:jobId', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const orgId = req.user.role === 'SUPERADMIN' ? 'SUPERADMIN_BYPASS' : req.organizationId;
        const job = await AsyncJobService.getJob(req.params.jobId, orgId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json(job);
    } catch (err) {
        console.error('[AIPlaybooks] Error getting job:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/ai/playbooks/jobs/:jobId/retry
 * @desc Retry a failed or dead-letter job
 * @access ADMIN/SUPERADMIN
 */
router.post('/jobs/:jobId/retry', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const orgId = req.user.role === 'SUPERADMIN' ? 'SUPERADMIN_BYPASS' : req.organizationId;
        const result = await AsyncJobService.retryJob(req.params.jobId, orgId);

        res.json(result);
    } catch (err) {
        if (err.code === 'JOB_NOT_FOUND') {
            return res.status(404).json({ error: err.message });
        }
        if (err.code === 'JOB_INVALID_STATE') {
            return res.status(400).json({ error: err.message });
        }
        console.error('[AIPlaybooks] Error retrying job:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/ai/playbooks/jobs/:jobId/cancel
 * @desc Cancel a queued job
 * @access ADMIN/SUPERADMIN
 */
router.post('/jobs/:jobId/cancel', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const orgId = req.user.role === 'SUPERADMIN' ? 'SUPERADMIN_BYPASS' : req.organizationId;
        const result = await AsyncJobService.cancelJob(req.params.jobId, orgId);

        res.json(result);
    } catch (err) {
        if (err.code === 'JOB_NOT_FOUND') {
            return res.status(404).json({ error: err.message });
        }
        if (err.code === 'JOB_INVALID_STATE') {
            return res.status(400).json({ error: err.message });
        }
        console.error('[AIPlaybooks] Error cancelling job:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
