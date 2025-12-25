/**
 * Assessment Reports API Routes
 * 
 * Provides endpoints for the ReportsTable component:
 * - GET /api/assessment-reports - List reports
 * - POST /api/assessment-reports - Create a new report
 * - POST /api/assessment-reports/:id/finalize - Finalize a report
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const AssessmentOverviewService = require('../services/assessmentOverviewService');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// ============================================================================
// ASSESSMENT REPORTS (for ReportsTable component)
// ============================================================================

/**
 * GET /api/assessment-reports
 * Get list of reports for the ReportsTable component
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const { projectId } = req.query;
        const organizationId = req.user.organizationId;

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        const reports = await AssessmentOverviewService.getReportsList(
            organizationId,
            projectId || null
        );

        res.json({ reports, total: reports.length });
    } catch (error) {
        console.error('[Assessment Reports API] Error listing reports:', error);
        res.status(500).json({ error: 'Failed to list reports' });
    }
});

/**
 * POST /api/assessment-reports
 * Create a new report from an assessment
 */
router.post('/', verifyToken, async (req, res) => {
    try {
        const { assessmentId, name, projectId } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        if (!assessmentId) {
            return res.status(400).json({ error: 'Assessment ID required' });
        }

        const reportId = uuidv4();
        const now = new Date().toISOString();
        const reportName = name || `Report - ${new Date().toLocaleDateString()}`;

        const sql = `
            INSERT INTO assessment_reports (id, assessment_id, organization_id, name, status, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?)
        `;

        db.run(sql, [reportId, assessmentId, organizationId, reportName, userId, now, now], function (err) {
            if (err) {
                // Table might not exist
                if (err.message && err.message.includes('no such table')) {
                    return res.status(500).json({
                        error: 'Reports table not initialized. Run database migrations.',
                        details: 'assessment_reports table does not exist'
                    });
                }
                console.error('[Assessment Reports API] Create error:', err);
                return res.status(500).json({ error: 'Failed to create report' });
            }

            res.status(201).json({
                id: reportId,
                name: reportName,
                assessmentId,
                status: 'DRAFT',
                createdAt: now
            });
        });
    } catch (error) {
        console.error('[Assessment Reports API] Create error:', error);
        res.status(500).json({ error: 'Failed to create report' });
    }
});

/**
 * POST /api/assessment-reports/:id/finalize
 * Finalize a report (DRAFT -> FINAL)
 */
router.post('/:id/finalize', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;
        const now = new Date().toISOString();

        const sql = `
            UPDATE assessment_reports 
            SET status = 'FINAL', updated_at = ?
            WHERE id = ? AND organization_id = ?
        `;

        db.run(sql, [now, id, organizationId], function (err) {
            if (err) {
                console.error('[Assessment Reports API] Finalize error:', err);
                return res.status(500).json({ error: 'Failed to finalize report' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Report not found' });
            }

            res.json({ success: true, id, status: 'FINAL' });
        });
    } catch (error) {
        console.error('[Assessment Reports API] Finalize error:', error);
        res.status(500).json({ error: 'Failed to finalize report' });
    }
});

module.exports = router;
