/**
 * AI Explainability Routes
 * 
 * Step 15: Explainability Ledger & Evidence Pack
 * 
 * Provides API endpoints for retrieving AI explanations and exporting
 * evidence packs for audit purposes.
 */

const express = require('express');
const router = express.Router();
const EvidenceLedgerService = require('../services/evidenceLedgerService');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth to all routes
router.use(authMiddleware);

// Valid entity types that can be explained
const VALID_ENTITY_TYPES = ['proposal', 'decision', 'execution', 'run_step', 'playbook_run'];

// ==========================================
// STATIC ROUTES (must be defined before dynamic routes)
// ==========================================

/**
 * @route GET /api/ai/explain/evidences
 * @desc List all evidence objects for the organization
 * @access Private (ADMIN / SUPERADMIN)
 */
router.get('/evidences', async (req, res) => {
    try {
        // RBAC check
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const orgId = req.user.organizationId;
        const { type, source, limit } = req.query;

        const evidences = await EvidenceLedgerService.getEvidencesByOrg(orgId, {
            type,
            source,
            limit: limit ? parseInt(limit, 10) : 100
        });

        res.json(evidences);
    } catch (err) {
        console.error('[AIEvidenceListRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// DYNAMIC ROUTES (with :entityType/:id parameters)
// ==========================================

/**
 * @route GET /api/ai/explain/:entityType/:id
 * @desc Get explanation for an AI artifact (reasoning + linked evidences)
 * @access Private (ADMIN / SUPERADMIN)
 */
router.get('/:entityType/:id', async (req, res) => {
    try {
        const { entityType, id } = req.params;

        // RBAC check
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        // Validate entity type
        if (!VALID_ENTITY_TYPES.includes(entityType)) {
            return res.status(400).json({
                error: `Invalid entityType. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`
            });
        }

        // Get organization ID (scoped access)
        const orgId = req.user.organizationId;

        const explanation = await EvidenceLedgerService.getExplanation(orgId, entityType, id);

        res.json(explanation);
    } catch (err) {
        console.error('[AIExplainRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/ai/explain/:entityType/:id/export
 * @desc Export explanation as JSON (AI Decision Pack)
 * @access Private (ADMIN / SUPERADMIN)
 */
router.get('/:entityType/:id/export', async (req, res) => {
    try {
        const { entityType, id } = req.params;
        const { format = 'json' } = req.query;

        // RBAC check
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        // Validate entity type
        if (!VALID_ENTITY_TYPES.includes(entityType)) {
            return res.status(400).json({
                error: `Invalid entityType. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`
            });
        }

        // Validate format
        if (!['json', 'pdf'].includes(format)) {
            return res.status(400).json({ error: 'Invalid format. Must be json or pdf' });
        }

        const orgId = req.user.organizationId;

        const pack = await EvidenceLedgerService.exportExplanation(orgId, entityType, id, format);

        // Set appropriate headers
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="ai-decision-pack-${entityType}-${id}.json"`
        );

        res.json(pack);
    } catch (err) {
        console.error('[AIExplainExportRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/ai/explain/:entityType/:id/export/pdf
 * @desc Generate PDF-ready JSON for AI Decision Pack
 * @access Private (ADMIN / SUPERADMIN)
 * @note Actual PDF generation will be in Step 18 or separate implementation
 */
router.post('/:entityType/:id/export/pdf', async (req, res) => {
    try {
        const { entityType, id } = req.params;

        // RBAC check
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        // Validate entity type
        if (!VALID_ENTITY_TYPES.includes(entityType)) {
            return res.status(400).json({
                error: `Invalid entityType. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`
            });
        }

        const orgId = req.user.organizationId;

        // Export with PDF render options
        const pack = await EvidenceLedgerService.exportExplanation(orgId, entityType, id, 'pdf');

        res.json({
            success: true,
            message: 'PDF-ready JSON generated. Actual PDF rendering available in Step 18.',
            data: pack
        });
    } catch (err) {
        console.error('[AIExplainPDFRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/ai/explain/:entityType/:id/has-evidence
 * @desc Check if entity has at least one evidence object
 * @access Private (ADMIN / SUPERADMIN)
 */
router.get('/:entityType/:id/has-evidence', async (req, res) => {
    try {
        const { entityType, id } = req.params;

        // RBAC check
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        // Validate entity type
        if (!VALID_ENTITY_TYPES.includes(entityType)) {
            return res.status(400).json({
                error: `Invalid entityType. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`
            });
        }

        const hasEvidence = await EvidenceLedgerService.hasEvidence(entityType, id);

        res.json({
            entity_type: entityType,
            entity_id: id,
            has_evidence: hasEvidence
        });
    } catch (err) {
        console.error('[AIHasEvidenceRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
