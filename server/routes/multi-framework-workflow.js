/**
 * Multi-Framework Workflow Routes
 * 
 * Workflow management for multi-framework assessments.
 * Handles submission, review, approval, and rejection flows.
 */

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const {
    multiFrameworkRBAC,
    requireFrameworkApprover,
    validateWorkflowTransition
} = require('../middleware/assessmentRBAC');
const { FrameworkRBACService } = require('../services/frameworkRBACService');
const db = require('../database');
const multiFrameworkAuditService = require('../services/multiFrameworkAuditService');

// ============================================
// WORKFLOW STATUS ROUTES
// ============================================

/**
 * GET /api/assessment-workflow/:assessmentId/status
 * 
 * Get workflow status for a multi-framework assessment
 */
router.get('/:assessmentId/status', authenticateToken, async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const framework = req.query.framework;

        const result = await db.query(`
            SELECT 
                mfa.id,
                mfa.status,
                mfa.submitted_at,
                mfa.submitted_by,
                mfa.approved_at,
                mfa.approved_by,
                mfa.rejected_at,
                mfa.rejected_by,
                mfa.rejection_reason,
                mfa.framework,
                mfa.version,
                su.first_name || ' ' || su.last_name AS submitted_by_name,
                au.first_name || ' ' || au.last_name AS approved_by_name,
                ru.first_name || ' ' || ru.last_name AS rejected_by_name
            FROM multi_framework_assessments mfa
            LEFT JOIN users su ON mfa.submitted_by = su.id
            LEFT JOIN users au ON mfa.approved_by = au.id
            LEFT JOIN users ru ON mfa.rejected_by = ru.id
            WHERE mfa.id = $1
        `, [assessmentId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        const assessment = result.rows[0];

        // Get reviewers
        const reviewers = await db.query(`
            SELECT 
                r.*,
                u.first_name || ' ' || u.last_name AS reviewer_name,
                u.email AS reviewer_email
            FROM multi_framework_assessment_reviewers r
            LEFT JOIN users u ON r.reviewer_id = u.id
            WHERE r.assessment_id = $1
        `, [assessmentId]);

        // Check user's permissions
        const canSubmit = await FrameworkRBACService.hasPermission(
            req.user.id, assessment.framework, 'submit'
        );
        const canApprove = await FrameworkRBACService.canApprove(
            req.user.id, assessment.framework
        );
        const canReview = await FrameworkRBACService.hasPermission(
            req.user.id, assessment.framework, 'review'
        );

        res.json({
            success: true,
            status: assessment.status,
            framework: assessment.framework,
            version: assessment.version,
            workflow: {
                submittedAt: assessment.submitted_at,
                submittedBy: assessment.submitted_by_name,
                approvedAt: assessment.approved_at,
                approvedBy: assessment.approved_by_name,
                rejectedAt: assessment.rejected_at,
                rejectedBy: assessment.rejected_by_name,
                rejectionReason: assessment.rejection_reason,
            },
            reviewers: reviewers.rows,
            permissions: {
                canSubmit,
                canApprove,
                canReview,
            },
        });
    } catch (error) {
        console.error('[MF-Workflow] Get status error:', error);
        res.status(500).json({ error: 'Failed to get workflow status' });
    }
});

/**
 * POST /api/assessment-workflow/:assessmentId/submit-for-review
 * 
 * Submit assessment for review
 */
router.post(
    '/:assessmentId/submit-for-review',
    authenticateToken,
    multiFrameworkRBAC('submit'),
    async (req, res) => {
        try {
            const { assessmentId } = req.params;
            const { reviewerIds = [], comment } = req.body;
            const framework = req.query.framework;
            const userId = req.user.id;

            // Get current assessment
            const current = await db.query(
                'SELECT * FROM multi_framework_assessments WHERE id = $1',
                [assessmentId]
            );

            if (current.rows.length === 0) {
                return res.status(404).json({ error: 'Assessment not found' });
            }

            const assessment = current.rows[0];

            if (assessment.status !== 'DRAFT') {
                return res.status(400).json({
                    error: 'Invalid status transition',
                    message: 'Only DRAFT assessments can be submitted for review',
                });
            }

            // Update status
            await db.query(`
                UPDATE multi_framework_assessments
                SET 
                    status = 'IN_REVIEW',
                    submitted_at = NOW(),
                    submitted_by = $1,
                    updated_at = NOW()
                WHERE id = $2
            `, [userId, assessmentId]);

            // Assign reviewers
            for (const reviewerId of reviewerIds) {
                await db.query(`
                    INSERT INTO multi_framework_assessment_reviewers (
                        assessment_id, reviewer_id, role, status, assigned_at
                    ) VALUES ($1, $2, 'REVIEWER', 'PENDING', NOW())
                    ON CONFLICT (assessment_id, reviewer_id) DO UPDATE
                    SET status = 'PENDING', assigned_at = NOW()
                `, [assessmentId, reviewerId]);
            }

            // Add comment if provided
            if (comment) {
                await db.query(`
                    INSERT INTO multi_framework_assessment_comments (
                        assessment_id, author_id, content, created_at
                    ) VALUES ($1, $2, $3, NOW())
                `, [assessmentId, userId, `Submission note: ${comment}`]);
            }

            // Audit log
            await multiFrameworkAuditService.logWorkflowChange(
                assessmentId,
                assessment.framework,
                userId,
                'SUBMIT_REVIEW',
                { reviewerIds, comment }
            );

            res.json({
                success: true,
                message: 'Assessment submitted for review',
                status: 'IN_REVIEW',
                reviewerCount: reviewerIds.length,
            });
        } catch (error) {
            console.error('[MF-Workflow] Submit error:', error);
            res.status(500).json({ error: 'Failed to submit for review' });
        }
    }
);

/**
 * POST /api/assessment-workflow/:assessmentId/complete-review
 * 
 * Complete a review (for reviewers)
 */
router.post(
    '/:assessmentId/complete-review',
    authenticateToken,
    multiFrameworkRBAC('review'),
    async (req, res) => {
        try {
            const { assessmentId } = req.params;
            const { feedback, score } = req.body;
            const userId = req.user.id;

            // Update reviewer record
            const result = await db.query(`
                UPDATE multi_framework_assessment_reviewers
                SET 
                    status = 'COMPLETED',
                    feedback = $1,
                    score = $2,
                    completed_at = NOW()
                WHERE assessment_id = $3 AND reviewer_id = $4
                RETURNING *
            `, [feedback, score, assessmentId, userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Review assignment not found' });
            }

            // Check if all reviews are complete
            const reviews = await db.query(`
                SELECT status FROM multi_framework_assessment_reviewers
                WHERE assessment_id = $1
            `, [assessmentId]);

            const allComplete = reviews.rows.every(r => r.status === 'COMPLETED');

            // If all reviews complete, update assessment status
            if (allComplete) {
                await db.query(`
                    UPDATE multi_framework_assessments
                    SET status = 'AWAITING_APPROVAL', updated_at = NOW()
                    WHERE id = $1
                `, [assessmentId]);
            }

            // Get framework for audit
            const assessment = await db.query(
                'SELECT framework FROM multi_framework_assessments WHERE id = $1',
                [assessmentId]
            );

            // Audit log
            await multiFrameworkAuditService.logWorkflowChange(
                assessmentId,
                assessment.rows[0]?.framework,
                userId,
                'COMPLETE_REVIEW',
                { feedback, score }
            );

            res.json({
                success: true,
                message: 'Review completed',
                allReviewsComplete: allComplete,
                newStatus: allComplete ? 'AWAITING_APPROVAL' : 'IN_REVIEW',
            });
        } catch (error) {
            console.error('[MF-Workflow] Complete review error:', error);
            res.status(500).json({ error: 'Failed to complete review' });
        }
    }
);

/**
 * POST /api/assessment-workflow/:assessmentId/approve
 * 
 * Approve assessment
 */
router.post(
    '/:assessmentId/approve',
    authenticateToken,
    async (req, res) => {
        try {
            const { assessmentId } = req.params;
            const { feedback } = req.body;
            const framework = req.query.framework;
            const userId = req.user.id;

            // Get current assessment
            const current = await db.query(
                'SELECT * FROM multi_framework_assessments WHERE id = $1',
                [assessmentId]
            );

            if (current.rows.length === 0) {
                return res.status(404).json({ error: 'Assessment not found' });
            }

            const assessment = current.rows[0];

            // Check approval permission
            const canApprove = await FrameworkRBACService.canApprove(userId, assessment.framework);
            if (!canApprove) {
                return res.status(403).json({
                    error: 'Approval permission denied',
                    message: `User is not authorized to approve ${assessment.framework} assessments`,
                });
            }

            // Validate status
            if (!['IN_REVIEW', 'AWAITING_APPROVAL'].includes(assessment.status)) {
                return res.status(400).json({
                    error: 'Invalid status transition',
                    message: 'Only IN_REVIEW or AWAITING_APPROVAL assessments can be approved',
                });
            }

            // Update status
            await db.query(`
                UPDATE multi_framework_assessments
                SET 
                    status = 'APPROVED',
                    approved_at = NOW(),
                    approved_by = $1,
                    updated_at = NOW()
                WHERE id = $2
            `, [userId, assessmentId]);

            // Add approval comment
            if (feedback) {
                await db.query(`
                    INSERT INTO multi_framework_assessment_comments (
                        assessment_id, author_id, content, created_at
                    ) VALUES ($1, $2, $3, NOW())
                `, [assessmentId, userId, `Approval feedback: ${feedback}`]);
            }

            // Audit log
            await multiFrameworkAuditService.logWorkflowChange(
                assessmentId,
                assessment.framework,
                userId,
                'APPROVE',
                { feedback }
            );

            res.json({
                success: true,
                message: 'Assessment approved',
                status: 'APPROVED',
            });
        } catch (error) {
            console.error('[MF-Workflow] Approve error:', error);
            res.status(500).json({ error: 'Failed to approve assessment' });
        }
    }
);

/**
 * POST /api/assessment-workflow/:assessmentId/reject
 * 
 * Reject assessment
 */
router.post(
    '/:assessmentId/reject',
    authenticateToken,
    async (req, res) => {
        try {
            const { assessmentId } = req.params;
            const { reason } = req.body;
            const framework = req.query.framework;
            const userId = req.user.id;

            if (!reason) {
                return res.status(400).json({ error: 'Rejection reason is required' });
            }

            // Get current assessment
            const current = await db.query(
                'SELECT * FROM multi_framework_assessments WHERE id = $1',
                [assessmentId]
            );

            if (current.rows.length === 0) {
                return res.status(404).json({ error: 'Assessment not found' });
            }

            const assessment = current.rows[0];

            // Check approval permission (same as approve)
            const canApprove = await FrameworkRBACService.canApprove(userId, assessment.framework);
            if (!canApprove) {
                return res.status(403).json({
                    error: 'Rejection permission denied',
                    message: `User is not authorized to reject ${assessment.framework} assessments`,
                });
            }

            // Update status
            await db.query(`
                UPDATE multi_framework_assessments
                SET 
                    status = 'REJECTED',
                    rejected_at = NOW(),
                    rejected_by = $1,
                    rejection_reason = $2,
                    updated_at = NOW()
                WHERE id = $3
            `, [userId, reason, assessmentId]);

            // Audit log
            await multiFrameworkAuditService.logWorkflowChange(
                assessmentId,
                assessment.framework,
                userId,
                'REJECT',
                { reason }
            );

            res.json({
                success: true,
                message: 'Assessment rejected',
                status: 'REJECTED',
                reason,
            });
        } catch (error) {
            console.error('[MF-Workflow] Reject error:', error);
            res.status(500).json({ error: 'Failed to reject assessment' });
        }
    }
);

/**
 * POST /api/assessment-workflow/:assessmentId/reopen
 * 
 * Reopen rejected assessment for editing
 */
router.post(
    '/:assessmentId/reopen',
    authenticateToken,
    multiFrameworkRBAC('edit'),
    async (req, res) => {
        try {
            const { assessmentId } = req.params;
            const userId = req.user.id;

            // Get current assessment
            const current = await db.query(
                'SELECT * FROM multi_framework_assessments WHERE id = $1',
                [assessmentId]
            );

            if (current.rows.length === 0) {
                return res.status(404).json({ error: 'Assessment not found' });
            }

            const assessment = current.rows[0];

            if (assessment.status !== 'REJECTED') {
                return res.status(400).json({
                    error: 'Invalid status transition',
                    message: 'Only REJECTED assessments can be reopened',
                });
            }

            // Update status
            await db.query(`
                UPDATE multi_framework_assessments
                SET 
                    status = 'DRAFT',
                    version = version + 1,
                    updated_at = NOW()
                WHERE id = $1
            `, [assessmentId]);

            // Clear reviewer statuses
            await db.query(`
                UPDATE multi_framework_assessment_reviewers
                SET status = 'PENDING', feedback = NULL, score = NULL, completed_at = NULL
                WHERE assessment_id = $1
            `, [assessmentId]);

            res.json({
                success: true,
                message: 'Assessment reopened for editing',
                status: 'DRAFT',
            });
        } catch (error) {
            console.error('[MF-Workflow] Reopen error:', error);
            res.status(500).json({ error: 'Failed to reopen assessment' });
        }
    }
);

/**
 * GET /api/assessment-workflow/:assessmentId/history
 * 
 * Get workflow history
 */
router.get('/:assessmentId/history', authenticateToken, async (req, res) => {
    try {
        const { assessmentId } = req.params;

        const history = await multiFrameworkAuditService.getAssessmentAuditHistory(assessmentId, {
            limit: 50,
        });

        res.json({
            success: true,
            history,
        });
    } catch (error) {
        console.error('[MF-Workflow] Get history error:', error);
        res.status(500).json({ error: 'Failed to get workflow history' });
    }
});

module.exports = router;



