/**
 * External Digital Assessments API Routes
 * Handles SIRI, ADMA, CMMI, and other framework uploads
 */

const express = require('express');
const router = express.Router();
const ExternalAssessmentService = require('../services/externalAssessmentService');
const upload = require('../middleware/fileUploadMiddleware');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

/**
 * Upload External Assessment
 * POST /api/external-assessments
 */
router.post('/', upload.single('file'), async (req, res) => {
    try {
        const { frameworkType, frameworkVersion, assessmentDate, projectId } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        if (!req.file) {
            return res.status(400).json({ error: 'File upload required' });
        }

        if (!frameworkType || !['SIRI', 'ADMA', 'CMMI', 'DIGITAL_OTHER'].includes(frameworkType)) {
            return res.status(400).json({ error: 'Valid framework type required (SIRI, ADMA, CMMI, DIGITAL_OTHER)' });
        }

        const assessment = await ExternalAssessmentService.uploadAssessment({
            organizationId,
            projectId: projectId || null,
            frameworkType,
            frameworkVersion: frameworkVersion || null,
            assessmentDate: assessmentDate || null,
            filePath: req.file.path,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            uploadMethod: 'PDF_PARSE',
            userId
        });

        console.log(`[ExternalAssessment API] Uploaded: ${assessment.id}`);
        res.status(201).json(assessment);
    } catch (error) {
        console.error('[ExternalAssessment API] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get External Assessment by ID
 * GET /api/external-assessments/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        const assessment = await ExternalAssessmentService.getAssessment(id, organizationId);
        res.json({ assessment });
    } catch (error) {
        console.error('[ExternalAssessment API] Error:', error.message);
        res.status(404).json({ error: error.message });
    }
});

/**
 * List all External Assessments for organization
 * GET /api/external-assessments/organization/:orgId
 */
router.get('/organization/:orgId', async (req, res) => {
    try {
        const { orgId } = req.params;
        const requestingOrgId = req.user.organizationId;

        // Security: users can only see their own org's assessments
        if (orgId !== requestingOrgId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Fetch all external assessments for this org
        const db = require('../database');
        const sql = `
            SELECT id, framework_type, framework_version, assessment_date, 
                   processing_status, uploaded_at, file_name
            FROM external_digital_assessments
            WHERE organization_id = ?
            ORDER BY uploaded_at DESC
        `;

        db.all(sql, [orgId], (err, rows) => {
            if (err) {
                console.error('[ExternalAssessment API] Error:', err.message);
                return res.status(500).json({ error: err.message });
            }

            res.json({ assessments: rows || [] });
        });
    } catch (error) {
        console.error('[ExternalAssessment API] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Re-process mapping (manual correction)
 * POST /api/external-assessments/:id/remap
 */
router.post('/:id/remap', async (req, res) => {
    try {
        const { id } = req.params;
        const { customMapping } = req.body;
        const organizationId = req.user.organizationId;

        // Get current assessment
        const assessment = await ExternalAssessmentService.getAssessment(id, organizationId);

        // Update with custom mapping
        const updatedMapping = { ...assessment.drd_axis_mapping, ...customMapping };

        // Save updated mapping
        const db = require('../database');
        const sql = `
            UPDATE external_digital_assessments
            SET drd_axis_mapping = ?, mapping_confidence = 1.0
            WHERE id = ? AND organization_id = ?
        `;

        db.run(sql, [JSON.stringify(updatedMapping), id, organizationId], function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json({
                updatedMapping,
                message: 'Mapping updated successfully'
            });
        });
    } catch (error) {
        console.error('[ExternalAssessment API] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
