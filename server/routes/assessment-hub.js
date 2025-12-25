/**
 * Assessment Hub API Routes
 * 
 * Provides unified endpoints for the Assessment Module Hub (4-tab interface):
 * - GET /api/assessments - List assessments for AssessmentTable
 * - GET /api/assessment-reports - List reports for ReportsTable
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
// ASSESSMENTS LIST (for AssessmentTable component)
// ============================================================================

/**
 * GET /api/assessments
 * Get list of assessments for the AssessmentTable component
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const { projectId } = req.query;
        const organizationId = req.user.organizationId;

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        const assessments = await AssessmentOverviewService.getAssessmentsList(
            organizationId,
            projectId || null
        );

        res.json({ assessments, total: assessments.length });
    } catch (error) {
        console.error('[Assessments API] Error listing assessments:', error);
        res.status(500).json({ error: 'Failed to list assessments' });
    }
});

module.exports = router;
