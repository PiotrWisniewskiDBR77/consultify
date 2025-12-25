/**
 * Assessment Workflow Routes
 * Enterprise workflow management for assessments
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { assessmentRBAC } = require('../middleware/assessmentRBAC');
const { AssessmentWorkflowService, WORKFLOW_STATES } = require('../services/assessmentWorkflowService');
const AssessmentAuditLogger = require('../utils/assessmentAuditLogger');

/**
 * @route GET /api/assessment-workflow/:assessmentId/status
 * @desc Get workflow status for an assessment
 */
router.get('/:assessmentId/status', authMiddleware, async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const status = await AssessmentWorkflowService.getWorkflowStatus(assessmentId);

        if (!status) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        res.json(status);
    } catch (error) {
        console.error('[WorkflowRoute] Error getting status:', error);
        res.status(500).json({ error: 'Failed to get workflow status' });
    }
});

/**
 * @route POST /api/assessment-workflow/:assessmentId/initialize
 * @desc Initialize workflow for a new assessment
 */
router.post('/:assessmentId/initialize', authMiddleware, assessmentRBAC('create'), async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { projectId } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        const workflow = await AssessmentWorkflowService.initializeWorkflow(
            assessmentId,
            projectId,
            organizationId,
            userId
        );

        await AssessmentAuditLogger.log({
            userId,
            organizationId,
            action: 'WORKFLOW_INITIALIZED',
            resourceType: 'ASSESSMENT_WORKFLOW',
            resourceId: workflow.workflowId,
            details: { assessmentId },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.status(201).json(workflow);
    } catch (error) {
        console.error('[WorkflowRoute] Error initializing workflow:', error);
        res.status(500).json({ error: error.message || 'Failed to initialize workflow' });
    }
});

/**
 * @route POST /api/assessment-workflow/:assessmentId/submit-for-review
 * @desc Submit assessment for stakeholder review
 */
router.post('/:assessmentId/submit-for-review', authMiddleware, assessmentRBAC('update'), async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { reviewers } = req.body;
        const userId = req.user.id;

        if (!reviewers || !Array.isArray(reviewers) || reviewers.length === 0) {
            return res.status(400).json({ error: 'At least one reviewer is required' });
        }

        const result = await AssessmentWorkflowService.submitForReview(
            assessmentId,
            userId,
            reviewers
        );

        await AssessmentAuditLogger.log({
            userId,
            organizationId: req.user.organizationId,
            action: 'SUBMITTED_FOR_REVIEW',
            resourceType: 'ASSESSMENT_WORKFLOW',
            resourceId: result.workflowId,
            details: { assessmentId, reviewersCount: reviewers.length },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json(result);
    } catch (error) {
        console.error('[WorkflowRoute] Error submitting for review:', error);
        res.status(400).json({ error: error.message || 'Failed to submit for review' });
    }
});

/**
 * @route GET /api/assessment-workflow/pending-reviews
 * @desc Get pending reviews for current user
 */
router.get('/pending-reviews', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organizationId;

        const reviews = await AssessmentWorkflowService.getPendingReviews(userId, organizationId);
        res.json({ reviews, count: reviews.length });
    } catch (error) {
        console.error('[WorkflowRoute] Error getting pending reviews:', error);
        res.status(500).json({ error: 'Failed to get pending reviews' });
    }
});

/**
 * @route POST /api/assessment-workflow/reviews/:reviewId/submit
 * @desc Submit a stakeholder review
 */
router.post('/reviews/:reviewId/submit', authMiddleware, async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { rating, comments, axisComments, recommendation } = req.body;
        const reviewerId = req.user.id;

        if (!recommendation) {
            return res.status(400).json({ error: 'Recommendation is required' });
        }

        const result = await AssessmentWorkflowService.submitReview(reviewId, reviewerId, {
            rating,
            comments,
            axisComments,
            recommendation
        });

        await AssessmentAuditLogger.log({
            userId: reviewerId,
            organizationId: req.user.organizationId,
            action: 'REVIEW_SUBMITTED',
            resourceType: 'ASSESSMENT_REVIEW',
            resourceId: reviewId,
            details: { rating, recommendation },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json(result);
    } catch (error) {
        console.error('[WorkflowRoute] Error submitting review:', error);
        res.status(400).json({ error: error.message || 'Failed to submit review' });
    }
});

/**
 * @route POST /api/assessment-workflow/:assessmentId/approve
 * @desc Approve an assessment (final approval gate)
 */
router.post('/:assessmentId/approve', authMiddleware, assessmentRBAC('update'), async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { approvalNotes } = req.body;
        const approverId = req.user.id;

        // Check user has approval permission (ORG_ADMIN or PROJECT_MANAGER)
        if (!['SUPER_ADMIN', 'ORG_ADMIN', 'PROJECT_MANAGER'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions to approve' });
        }

        const result = await AssessmentWorkflowService.approveAssessment(
            assessmentId,
            approverId,
            approvalNotes
        );

        await AssessmentAuditLogger.log({
            userId: approverId,
            organizationId: req.user.organizationId,
            action: 'ASSESSMENT_APPROVED',
            resourceType: 'ASSESSMENT_WORKFLOW',
            resourceId: result.assessmentId,
            details: { version: result.version },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json(result);
    } catch (error) {
        console.error('[WorkflowRoute] Error approving assessment:', error);
        res.status(400).json({ error: error.message || 'Failed to approve assessment' });
    }
});

/**
 * @route POST /api/assessment-workflow/:assessmentId/reject
 * @desc Reject an assessment (send back for revision)
 */
router.post('/:assessmentId/reject', authMiddleware, assessmentRBAC('update'), async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { rejectionReason, axisIssues } = req.body;
        const rejectorId = req.user.id;

        if (!rejectionReason) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }

        const result = await AssessmentWorkflowService.rejectAssessment(
            assessmentId,
            rejectorId,
            rejectionReason,
            axisIssues
        );

        await AssessmentAuditLogger.log({
            userId: rejectorId,
            organizationId: req.user.organizationId,
            action: 'ASSESSMENT_REJECTED',
            resourceType: 'ASSESSMENT_WORKFLOW',
            resourceId: result.assessmentId,
            details: { rejectionReason },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json(result);
    } catch (error) {
        console.error('[WorkflowRoute] Error rejecting assessment:', error);
        res.status(400).json({ error: error.message || 'Failed to reject assessment' });
    }
});

/**
 * @route GET /api/assessment-workflow/:assessmentId/comments
 * @desc Get all comments for an assessment
 */
router.get('/:assessmentId/comments', authMiddleware, async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { axisId } = req.query;

        const comments = await AssessmentWorkflowService.getAxisComments(assessmentId, axisId);
        res.json({ comments });
    } catch (error) {
        console.error('[WorkflowRoute] Error getting comments:', error);
        res.status(500).json({ error: 'Failed to get comments' });
    }
});

/**
 * @route POST /api/assessment-workflow/:assessmentId/comments
 * @desc Add a comment to an assessment axis
 */
router.post('/:assessmentId/comments', authMiddleware, async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { axisId, comment, parentCommentId } = req.body;
        const userId = req.user.id;

        if (!axisId || !comment) {
            return res.status(400).json({ error: 'axisId and comment are required' });
        }

        const result = await AssessmentWorkflowService.addAxisComment(
            assessmentId,
            axisId,
            userId,
            comment,
            parentCommentId
        );

        res.status(201).json(result);
    } catch (error) {
        console.error('[WorkflowRoute] Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

/**
 * @route GET /api/assessment-workflow/:assessmentId/history
 * @desc Get workflow history for an assessment
 */
router.get('/:assessmentId/history', authMiddleware, async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const history = await AssessmentWorkflowService.getWorkflowHistory(assessmentId);
        res.json({ history });
    } catch (error) {
        console.error('[WorkflowRoute] Error getting history:', error);
        res.status(500).json({ error: 'Failed to get workflow history' });
    }
});

/**
 * @route GET /api/assessment-workflow/:assessmentId/versions
 * @desc Get version history for an assessment
 */
router.get('/:assessmentId/versions', authMiddleware, async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const versions = await AssessmentWorkflowService.getVersionHistory(assessmentId);
        res.json({ versions });
    } catch (error) {
        console.error('[WorkflowRoute] Error getting versions:', error);
        res.status(500).json({ error: 'Failed to get version history' });
    }
});

/**
 * @route POST /api/assessment-workflow/:assessmentId/restore/:version
 * @desc Restore assessment to a specific version
 */
router.post('/:assessmentId/restore/:version', authMiddleware, assessmentRBAC('update'), async (req, res) => {
    try {
        const { assessmentId, version } = req.params;
        const restoredBy = req.user.id;

        const result = await AssessmentWorkflowService.restoreVersion(
            assessmentId,
            parseInt(version),
            restoredBy
        );

        await AssessmentAuditLogger.log({
            userId: restoredBy,
            organizationId: req.user.organizationId,
            action: 'VERSION_RESTORED',
            resourceType: 'ASSESSMENT_VERSION',
            resourceId: assessmentId,
            details: { fromVersion: version, newVersion: result.newVersion },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json(result);
    } catch (error) {
        console.error('[WorkflowRoute] Error restoring version:', error);
        res.status(400).json({ error: error.message || 'Failed to restore version' });
    }
});

// =====================================================
// Enterprise Report Generation Endpoints
// =====================================================

const assessmentReportService = require('../services/assessmentReportService');

/**
 * @route POST /api/assessment-workflow/:assessmentId/export/pdf
 * @desc Generate and download PDF report
 */
router.post('/:assessmentId/export/pdf', authMiddleware, assessmentRBAC('export'), async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { includeComments, includeHistory, watermark } = req.body;

        const report = await assessmentReportService.generatePDFReport(assessmentId, {
            includeComments,
            includeHistory,
            watermark: watermark !== false
        });

        await AssessmentAuditLogger.log({
            userId: req.user.id,
            organizationId: req.user.organizationId,
            action: 'PDF_EXPORTED',
            resourceType: 'ASSESSMENT_REPORT',
            resourceId: report.reportId,
            details: { assessmentId, format: 'PDF' },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true,
            reportId: report.reportId,
            fileUrl: report.fileUrl,
            fileName: report.fileName,
            generatedAt: report.generatedAt
        });
    } catch (error) {
        console.error('[WorkflowRoute] Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF report' });
    }
});

/**
 * @route POST /api/assessment-workflow/:assessmentId/export/excel
 * @desc Generate and download Excel report
 */
router.post('/:assessmentId/export/excel', authMiddleware, assessmentRBAC('export'), async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { includeRawData, includeFormulas } = req.body;

        const report = await assessmentReportService.generateExcelReport(assessmentId, {
            includeRawData: includeRawData !== false,
            includeFormulas
        });

        await AssessmentAuditLogger.log({
            userId: req.user.id,
            organizationId: req.user.organizationId,
            action: 'EXCEL_EXPORTED',
            resourceType: 'ASSESSMENT_REPORT',
            resourceId: report.reportId,
            details: { assessmentId, format: 'XLSX' },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true,
            reportId: report.reportId,
            fileUrl: report.fileUrl,
            fileName: report.fileName,
            generatedAt: report.generatedAt
        });
    } catch (error) {
        console.error('[WorkflowRoute] Error generating Excel:', error);
        res.status(500).json({ error: 'Failed to generate Excel report' });
    }
});

/**
 * @route GET /api/assessment-workflow/:assessmentId/export/download/:fileName
 * @desc Download generated report file
 */
router.get('/:assessmentId/export/download/:fileName', authMiddleware, async (req, res) => {
    try {
        const { fileName } = req.params;
        const path = require('path');
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('[WorkflowRoute] Download error:', err);
                res.status(404).json({ error: 'File not found' });
            }
        });
    } catch (error) {
        console.error('[WorkflowRoute] Error downloading file:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// =====================================================
// Collaboration / Presence Endpoints
// =====================================================

const presenceStore = new Map(); // In-memory store for presence (use Redis in production)

/**
 * @route POST /api/assessment-workflow/:assessmentId/presence
 * @desc Update user presence for real-time collaboration
 */
router.post('/:assessmentId/presence', authMiddleware, async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { userId, userName, currentAxis, currentView } = req.body;

        const key = `${assessmentId}:${userId}`;
        presenceStore.set(key, {
            userId,
            userName,
            userEmail: req.user.email,
            avatarColor: getAvatarColor(userId),
            currentAxis,
            currentView,
            lastActivity: new Date(),
            isActive: true
        });

        // Get all collaborators for this assessment
        const collaborators = [];
        const now = new Date();
        const timeout = 30000; // 30 seconds

        presenceStore.forEach((value, storeKey) => {
            if (storeKey.startsWith(`${assessmentId}:`)) {
                const isActive = (now - new Date(value.lastActivity)) < timeout;
                if (isActive) {
                    collaborators.push({ ...value, isActive });
                } else {
                    presenceStore.delete(storeKey);
                }
            }
        });

        res.json({ collaborators });
    } catch (error) {
        console.error('[WorkflowRoute] Error updating presence:', error);
        res.status(500).json({ error: 'Failed to update presence' });
    }
});

/**
 * @route POST /api/assessment-workflow/:assessmentId/presence/leave
 * @desc Remove user presence on leave
 */
router.post('/:assessmentId/presence/leave', authMiddleware, async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { userId } = req.body;

        const key = `${assessmentId}:${userId}`;
        presenceStore.delete(key);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove presence' });
    }
});

// Activity store (in-memory, use database in production)
const activityStore = new Map();

/**
 * @route GET /api/assessment-workflow/:assessmentId/activities
 * @desc Get recent activities for assessment
 */
router.get('/:assessmentId/activities', authMiddleware, async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { since } = req.query;

        const activities = activityStore.get(assessmentId) || [];
        const sinceDate = since ? new Date(since) : new Date(0);

        const filtered = activities.filter(a => new Date(a.timestamp) > sinceDate);

        res.json({ activities: filtered.slice(0, 50) });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get activities' });
    }
});

/**
 * @route POST /api/assessment-workflow/:assessmentId/activities
 * @desc Add activity to feed
 */
router.post('/:assessmentId/activities', authMiddleware, async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { type, userId, userName, data } = req.body;

        const activity = {
            id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            userId,
            userName,
            data,
            timestamp: new Date()
        };

        const activities = activityStore.get(assessmentId) || [];
        activities.unshift(activity);

        // Keep only last 100 activities
        if (activities.length > 100) {
            activities.pop();
        }

        activityStore.set(assessmentId, activities);

        res.status(201).json({ success: true, activity });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add activity' });
    }
});

// Helper function for avatar colors
function getAvatarColor(userId) {
    const colors = [
        'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500',
        'bg-pink-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-rose-500'
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

module.exports = router;

