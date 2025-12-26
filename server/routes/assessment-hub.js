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
 * Includes review information for the current user
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const { projectId } = req.query;
        const organizationId = req.user.organizationId;
        const currentUserId = req.user.id;

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        const assessments = await AssessmentOverviewService.getAssessmentsList(
            organizationId,
            projectId || null,
            currentUserId
        );

        res.json({ assessments, total: assessments.length });
    } catch (error) {
        console.error('[Assessments API] Error listing assessments:', error);
        res.status(500).json({ error: 'Failed to list assessments' });
    }
});

/**
 * GET /api/assessments/:id
 * Get single assessment with full data for Map view
 */
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const assessment = await AssessmentOverviewService.getAssessmentDetails(id);

        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        res.json(assessment);
    } catch (error) {
        console.error('[Assessments API] Error fetching assessment:', error);
        res.status(500).json({ error: 'Failed to fetch assessment' });
    }
});

/**
 * DELETE /api/assessments/:id
 * Delete an assessment and related workflow/reviews
 */
router.delete('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    try {
        // Check if assessment exists and belongs to user's org
        const assessment = await new Promise((resolve, reject) => {
            db.get(
                `SELECT aw.*, ma.project_id 
                 FROM assessment_workflows aw 
                 LEFT JOIN maturity_assessments ma ON aw.project_id = ma.project_id
                 WHERE (aw.id = ? OR aw.assessment_id = ?) AND aw.organization_id = ?`,
                [id, id, organizationId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        // Only allow delete if user is creator or has admin role
        if (assessment.created_by !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Not authorized to delete this assessment' });
        }

        // Delete related records first
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM assessment_reviews WHERE workflow_id = ?', [assessment.id], (err) => {
                if (err) reject(err);
                else resolve(null);
            });
        });

        await new Promise((resolve, reject) => {
            db.run('DELETE FROM assessment_axis_comments WHERE assessment_id = ?', [id], (err) => {
                if (err) reject(err);
                else resolve(null);
            });
        });

        // Delete workflow
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM assessment_workflows WHERE id = ? OR assessment_id = ?', [id, id], (err) => {
                if (err) reject(err);
                else resolve(null);
            });
        });

        res.json({ success: true, message: 'Assessment deleted' });
    } catch (error) {
        console.error('[Assessments API] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete assessment' });
    }
});

/**
 * POST /api/assessments/:id/duplicate
 * Duplicate an assessment
 */
router.post('/:id/duplicate', verifyToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    try {
        // Get original assessment
        const original = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM assessment_workflows 
                 WHERE (id = ? OR assessment_id = ?) AND organization_id = ?`,
                [id, id, organizationId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!original) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        // Create new assessment workflow
        const newId = uuidv4();
        const now = new Date().toISOString();

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO assessment_workflows 
                 (id, assessment_id, organization_id, project_id, status, created_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?)`,
                [newId, newId, organizationId, original.project_id, userId, now, now],
                (err) => {
                    if (err) reject(err);
                    else resolve(null);
                }
            );
        });

        // Copy maturity assessment data if exists
        const maturityData = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM maturity_assessments WHERE project_id = ?',
                [original.project_id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (maturityData) {
            const newMaturityId = uuidv4();
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO maturity_assessments 
                     (id, project_id, organization_id, overall_as_is, overall_to_be, is_complete, axis_data, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
                    [
                        newMaturityId,
                        newId, // Use new assessment ID as project reference
                        organizationId,
                        maturityData.overall_as_is,
                        maturityData.overall_to_be,
                        maturityData.axis_data,
                        now,
                        now
                    ],
                    (err) => {
                        if (err) reject(err);
                        else resolve(null);
                    }
                );
            });
        }

        res.json({
            success: true,
            id: newId,
            message: 'Assessment duplicated'
        });
    } catch (error) {
        console.error('[Assessments API] Duplicate error:', error);
        res.status(500).json({ error: 'Failed to duplicate assessment' });
    }
});

module.exports = router;
