/**
 * Generic Reports API Routes
 * Handles generic assessment report uploads (ISO, consulting, compliance, etc.)
 */

const express = require('express');
const router = express.Router();
const GenericReportService = require('../services/genericReportService');
const upload = require('../middleware/fileUploadMiddleware');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

/**
 * Upload Generic Report
 * POST /api/generic-reports
 */
router.post('/', upload.single('file'), async (req, res) => {
    try {
        const { reportType, title, consultantName, reportDate, tags, projectId } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        if (!req.file) {
            return res.status(400).json({ error: 'File upload required' });
        }

        if (!title) {
            return res.status(400).json({ error: 'Report title required' });
        }

        const report = await GenericReportService.uploadReport({
            organizationId,
            projectId: projectId || null,
            reportType: reportType || 'OTHER',
            title,
            consultantName: consultantName || null,
            reportDate: reportDate || null,
            filePath: req.file.path,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            fileType: req.file.mimetype,
            tags: tags ? JSON.parse(tags) : [],
            userId
        });

        console.log(`[GenericReport API] Uploaded: ${report.id}`);
        res.status(201).json(report);
    } catch (error) {
        console.error('[GenericReport API] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get Generic Report by ID
 * GET /api/generic-reports/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        const report = await GenericReportService.getReport(id, organizationId);
        res.json({ report });
    } catch (error) {
        console.error('[GenericReport API] Error:', error.message);
        res.status(404).json({ error: error.message });
    }
});

/**
 * List/Search Generic Reports
 * GET /api/generic-reports/organization/:orgId
 */
router.get('/organization/:orgId', async (req, res) => {
    try {
        const { orgId } = req.params;
        const { search, type, sortBy } = req.query;
        const requestingOrgId = req.user.organizationId;

        // Security check
        if (orgId !== requestingOrgId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const reports = await GenericReportService.searchReports({
            organizationId: orgId,
            query: search || null,
            reportType: type || 'ALL',
            sortBy: sortBy || 'uploaded_at'
        });

        res.json({ reports, totalCount: reports.length });
    } catch (error) {
        console.error('[GenericReport API] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Full-text search
 * GET /api/generic-reports/search
 */
router.get('/search', async (req, res) => {
    try {
        const { q, orgId } = req.query;
        const requestingOrgId = req.user.organizationId;

        if (!q) {
            return res.status(400).json({ error: 'Search query required' });
        }

        // Security check
        const targetOrgId = orgId || requestingOrgId;
        if (targetOrgId !== requestingOrgId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const reports = await GenericReportService.searchReports({
            organizationId: targetOrgId,
            query: q,
            reportType: 'ALL',
            sortBy: 'uploaded_at'
        });

        res.json({ results: reports });
    } catch (error) {
        console.error('[GenericReport API] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Link report to initiative
 * POST /api/generic-reports/:id/link-initiative
 */
router.post('/:id/link-initiative', async (req, res) => {
    try {
        const { id } = req.params;
        const { initiativeId } = req.body;
        const organizationId = req.user.organizationId;

        if (!initiativeId) {
            return res.status(400).json({ error: 'Initiative ID required' });
        }

        const result = await GenericReportService.linkToInitiative(id, initiativeId, organizationId);
        res.json(result);
    } catch (error) {
        console.error('[GenericReport API] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Delete report
 * DELETE /api/generic-reports/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        const db = require('../database');
        const sql = `DELETE FROM generic_assessment_reports WHERE id = ? AND organization_id = ?`;

        db.run(sql, [id, organizationId], function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Report not found' });
            }

            res.json({ message: 'Report deleted successfully' });
        });
    } catch (error) {
        console.error('[GenericReport API] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
