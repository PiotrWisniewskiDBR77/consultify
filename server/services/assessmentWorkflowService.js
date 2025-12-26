/**
 * Assessment Workflow Service
 * Enterprise-grade workflow management for assessments
 * Supports multi-stakeholder reviews, approval gates, and versioning
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const AssessmentAuditLogger = require('../utils/assessmentAuditLogger');

// Workflow States
const WORKFLOW_STATES = {
    DRAFT: 'DRAFT',                     // Initial state, editable
    IN_REVIEW: 'IN_REVIEW',             // Submitted for stakeholder review
    AWAITING_APPROVAL: 'AWAITING_APPROVAL', // All reviews done, awaiting final approval
    APPROVED: 'APPROVED',               // Assessment approved
    REJECTED: 'REJECTED',               // Assessment rejected, needs revision
    ARCHIVED: 'ARCHIVED'                // Historical version
};

// Stakeholder Review Status
const REVIEW_STATUS = {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    SKIPPED: 'SKIPPED'
};

// Enterprise Workflow Configuration
const WORKFLOW_CONFIG = {
    // Minimum reviewers required before approval gate
    minReviewers: 2,
    // Auto-archive previous versions on approval
    autoArchive: true,
    // Enable AI sense-check before submission
    aiSenseCheck: true,
    // Require justification for all axes
    requireJustification: true,
    // Maximum review period in days
    maxReviewDays: 14,
    // Default SLA for review completion (in hours)
    reviewSlaHours: 48
};

class AssessmentWorkflowService {
    /**
     * Initialize assessment workflow
     */
    static async initializeWorkflow(assessmentId, projectId, organizationId, createdBy) {
        const workflowId = uuidv4();
        
        const sql = `
            INSERT INTO assessment_workflows (
                id, assessment_id, project_id, organization_id,
                status, current_version, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
        `;
        
        return new Promise((resolve, reject) => {
            db.run(sql, [
                workflowId, assessmentId, projectId, organizationId,
                WORKFLOW_STATES.DRAFT, createdBy
            ], function(err) {
                if (err) return reject(err);
                resolve({
                    workflowId,
                    assessmentId,
                    status: WORKFLOW_STATES.DRAFT,
                    version: 1
                });
            });
        });
    }

    /**
     * Get workflow status for an assessment
     */
    static async getWorkflowStatus(assessmentId) {
        const sql = `
            SELECT 
                w.*,
                (SELECT COUNT(*) FROM assessment_reviews r WHERE r.workflow_id = w.id AND r.status = 'COMPLETED') as completed_reviews,
                (SELECT COUNT(*) FROM assessment_reviews r WHERE r.workflow_id = w.id) as total_reviews
            FROM assessment_workflows w
            WHERE w.assessment_id = ?
            ORDER BY w.current_version DESC
            LIMIT 1
        `;
        
        return new Promise((resolve, reject) => {
            db.get(sql, [assessmentId], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                
                resolve({
                    ...row,
                    canSubmitForReview: row.status === WORKFLOW_STATES.DRAFT,
                    canApprove: row.status === WORKFLOW_STATES.AWAITING_APPROVAL,
                    reviewProgress: row.total_reviews > 0 
                        ? Math.round((row.completed_reviews / row.total_reviews) * 100)
                        : 0
                });
            });
        });
    }

    /**
     * Submit assessment for stakeholder review
     */
    static async submitForReview(assessmentId, submittedBy, reviewers = []) {
        // Validate current state
        const workflow = await this.getWorkflowStatus(assessmentId);
        if (!workflow) {
            throw new Error('Workflow not found for assessment');
        }
        if (workflow.status !== WORKFLOW_STATES.DRAFT && workflow.status !== WORKFLOW_STATES.REJECTED) {
            throw new Error(`Cannot submit from state: ${workflow.status}`);
        }

        // Validate assessment completeness
        const completeness = await this._validateAssessmentCompleteness(assessmentId);
        if (!completeness.isComplete) {
            throw new Error(`Assessment incomplete: ${completeness.missingItems.join(', ')}`);
        }

        // Create review requests for each reviewer
        const reviewIds = [];
        for (const reviewer of reviewers) {
            const reviewId = uuidv4();
            await new Promise((resolve, reject) => {
                // Use SLA from config (48 hours by default)
                const slaHours = WORKFLOW_CONFIG.reviewSlaHours;
                db.run(`
                    INSERT INTO assessment_reviews (
                        id, workflow_id, reviewer_id, reviewer_role,
                        status, requested_at, due_date
                    ) VALUES (?, ?, ?, ?, 'PENDING', datetime('now'), datetime('now', '+${slaHours} hours'))
                `, [reviewId, workflow.id, reviewer.userId, reviewer.role], function(err) {
                    if (err) return reject(err);
                    reviewIds.push(reviewId);
                    resolve();
                });
            });
        }

        // Update workflow status
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE assessment_workflows 
                SET status = ?, submitted_at = datetime('now'), submitted_by = ?, updated_at = datetime('now')
                WHERE id = ?
            `, [WORKFLOW_STATES.IN_REVIEW, submittedBy, workflow.id], function(err) {
                if (err) return reject(err);
                resolve();
            });
        });

        // Get assessment name for notification
        const assessment = await new Promise((resolve, reject) => {
            db.get('SELECT name, project_id FROM assessments WHERE id = ?', [assessmentId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        // Get submitter name
        const submitter = await new Promise((resolve, reject) => {
            db.get('SELECT first_name, last_name FROM users WHERE id = ?', [submittedBy], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        // Send notifications to reviewers
        const submitterName = submitter ? `${submitter.first_name} ${submitter.last_name}` : 'Someone';
        const assessmentName = assessment?.name || 'Assessment';
        
        for (const reviewer of reviewers) {
            try {
                await new Promise((resolve, reject) => {
                    db.run(`
                        INSERT INTO notifications (
                            id, user_id, type, title, message, data, created_at
                        ) VALUES (?, ?, 'REVIEW_REQUEST', ?, ?, ?, datetime('now'))
                    `, [
                        uuidv4(),
                        reviewer.userId,
                        '📋 Review Request',
                        `${submitterName} requested your review on "${assessmentName}"`,
                        JSON.stringify({
                            assessmentId,
                            workflowId: workflow.id,
                            submittedBy,
                            assessmentName
                        })
                    ], function(err) {
                        if (err) {
                            console.warn('[Notification] Failed to create notification:', err.message);
                            // Don't fail the whole operation if notification fails
                        }
                        resolve();
                    });
                });
            } catch (notifError) {
                console.warn('[Notification] Error creating notification:', notifError);
            }
        }

        return {
            workflowId: workflow.id,
            status: WORKFLOW_STATES.IN_REVIEW,
            reviewIds,
            reviewersCount: reviewers.length,
            notificationsSent: reviewers.length
        };
    }

    /**
     * Submit stakeholder review
     */
    static async submitReview(reviewId, reviewerId, reviewData) {
        const { rating, comments, axisComments = {}, recommendation } = reviewData;
        
        // Validate reviewer
        const review = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM assessment_reviews WHERE id = ? AND reviewer_id = ?`, 
                [reviewId, reviewerId], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
        });

        if (!review) {
            throw new Error('Review not found or not assigned to this user');
        }

        // Save review
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE assessment_reviews 
                SET status = 'COMPLETED',
                    rating = ?,
                    comments = ?,
                    axis_comments = ?,
                    recommendation = ?,
                    completed_at = datetime('now')
                WHERE id = ?
            `, [rating, comments, JSON.stringify(axisComments), recommendation, reviewId], function(err) {
                if (err) return reject(err);
                resolve();
            });
        });

        // Check if all reviews are complete
        await this._checkReviewCompletion(review.workflow_id);

        return {
            reviewId,
            status: REVIEW_STATUS.COMPLETED,
            recommendation
        };
    }

    /**
     * Add comment to specific axis during review
     */
    static async addAxisComment(assessmentId, axisId, userId, comment, parentCommentId = null) {
        const commentId = uuidv4();
        
        const sql = `
            INSERT INTO assessment_axis_comments (
                id, assessment_id, axis_id, user_id,
                comment, parent_comment_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `;

        return new Promise((resolve, reject) => {
            db.run(sql, [commentId, assessmentId, axisId, userId, comment, parentCommentId], function(err) {
                if (err) return reject(err);
                resolve({ commentId, axisId, comment });
            });
        });
    }

    /**
     * Get all comments for an assessment axis
     */
    static async getAxisComments(assessmentId, axisId = null) {
        let sql = `
            SELECT c.*, u.name as author_name, u.email as author_email
            FROM assessment_axis_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.assessment_id = ?
        `;
        const params = [assessmentId];

        if (axisId) {
            sql += ` AND c.axis_id = ?`;
            params.push(axisId);
        }

        sql += ` ORDER BY c.created_at ASC`;

        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                
                // Build comment tree
                const comments = this._buildCommentTree(rows || []);
                resolve(comments);
            });
        });
    }

    /**
     * Approve assessment (final approval gate)
     */
    static async approveAssessment(assessmentId, approverId, approvalNotes = '') {
        const workflow = await this.getWorkflowStatus(assessmentId);
        
        if (!workflow) {
            throw new Error('Workflow not found');
        }
        
        if (workflow.status !== WORKFLOW_STATES.AWAITING_APPROVAL) {
            throw new Error(`Cannot approve from state: ${workflow.status}. Must be in AWAITING_APPROVAL state.`);
        }

        // Create version snapshot before approval
        await this._createVersionSnapshot(assessmentId, workflow.current_version);

        // Update workflow to approved
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE assessment_workflows 
                SET status = ?,
                    approved_by = ?,
                    approved_at = datetime('now'),
                    approval_notes = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `, [WORKFLOW_STATES.APPROVED, approverId, approvalNotes, workflow.id], function(err) {
                if (err) return reject(err);
                resolve();
            });
        });

        // Update assessment to mark as approved
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE maturity_assessments 
                SET is_approved = 1, approved_at = datetime('now'), approved_by = ?
                WHERE id = ?
            `, [approverId, assessmentId], function(err) {
                if (err) return reject(err);
                resolve();
            });
        });

        return {
            assessmentId,
            status: WORKFLOW_STATES.APPROVED,
            approvedBy: approverId,
            version: workflow.current_version
        };
    }

    /**
     * Reject assessment (send back for revision)
     */
    static async rejectAssessment(assessmentId, rejectorId, rejectionReason, axisIssues = {}) {
        const workflow = await this.getWorkflowStatus(assessmentId);
        
        if (!workflow) {
            throw new Error('Workflow not found');
        }

        // Update workflow to rejected
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE assessment_workflows 
                SET status = ?,
                    rejected_by = ?,
                    rejected_at = datetime('now'),
                    rejection_reason = ?,
                    axis_issues = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `, [
                WORKFLOW_STATES.REJECTED, 
                rejectorId, 
                rejectionReason, 
                JSON.stringify(axisIssues),
                workflow.id
            ], function(err) {
                if (err) return reject(err);
                resolve();
            });
        });

        return {
            assessmentId,
            status: WORKFLOW_STATES.REJECTED,
            rejectionReason,
            axisIssues
        };
    }

    /**
     * Get workflow history for an assessment
     */
    static async getWorkflowHistory(assessmentId) {
        const sql = `
            SELECT 
                w.id, w.status, w.current_version,
                w.submitted_at, w.approved_at, w.rejected_at,
                w.created_at, w.updated_at,
                u1.name as submitted_by_name,
                u2.name as approved_by_name,
                u3.name as rejected_by_name
            FROM assessment_workflows w
            LEFT JOIN users u1 ON w.submitted_by = u1.id
            LEFT JOIN users u2 ON w.approved_by = u2.id
            LEFT JOIN users u3 ON w.rejected_by = u3.id
            WHERE w.assessment_id = ?
            ORDER BY w.current_version DESC
        `;

        return new Promise((resolve, reject) => {
            db.all(sql, [assessmentId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }

    /**
     * Get pending reviews for a user
     */
    static async getPendingReviews(userId, organizationId) {
        const sql = `
            SELECT 
                r.*,
                w.assessment_id,
                a.name as assessment_name,
                p.name as project_name,
                u.name as submitter_name,
                CASE 
                    WHEN r.due_date IS NOT NULL AND datetime(r.due_date) < datetime('now') 
                    THEN 1 
                    ELSE 0 
                END as is_overdue,
                CASE 
                    WHEN r.due_date IS NOT NULL 
                    THEN ROUND((julianday(r.due_date) - julianday('now')) * 24)
                    ELSE NULL 
                END as hours_remaining
            FROM assessment_reviews r
            JOIN assessment_workflows w ON r.workflow_id = w.id
            JOIN maturity_assessments a ON w.assessment_id = a.id
            JOIN projects p ON w.project_id = p.id
            LEFT JOIN users u ON w.submitted_by = u.id
            WHERE r.reviewer_id = ?
            AND r.status IN ('PENDING', 'IN_PROGRESS')
            AND w.organization_id = ?
            ORDER BY r.due_date ASC NULLS LAST, r.requested_at ASC
        `;

        return new Promise((resolve, reject) => {
            db.all(sql, [userId, organizationId], (err, rows) => {
                if (err) return reject(err);
                
                // Transform rows to include isOverdue boolean
                const reviews = (rows || []).map(row => ({
                    ...row,
                    isOverdue: row.is_overdue === 1,
                    hoursRemaining: row.hours_remaining
                }));
                
                resolve(reviews);
            });
        });
    }

    /**
     * Get assessment version history
     */
    static async getVersionHistory(assessmentId) {
        const sql = `
            SELECT 
                v.*,
                u.name as created_by_name
            FROM assessment_versions v
            LEFT JOIN users u ON v.created_by = u.id
            WHERE v.assessment_id = ?
            ORDER BY v.version DESC
        `;

        return new Promise((resolve, reject) => {
            db.all(sql, [assessmentId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }

    /**
     * Restore assessment to specific version
     */
    static async restoreVersion(assessmentId, version, restoredBy) {
        const versionData = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM assessment_versions WHERE assessment_id = ? AND version = ?`,
                [assessmentId, version], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
        });

        if (!versionData) {
            throw new Error(`Version ${version} not found`);
        }

        // Create new version with restored data
        const currentWorkflow = await this.getWorkflowStatus(assessmentId);
        const newVersion = (currentWorkflow?.current_version || 0) + 1;

        // Save current as new version
        await this._createVersionSnapshot(assessmentId, newVersion);

        // Restore data
        const assessmentData = JSON.parse(versionData.assessment_data);
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE maturity_assessments
                SET axis_scores = ?, overall_score = ?, updated_at = datetime('now')
                WHERE id = ?
            `, [JSON.stringify(assessmentData.axis_scores), assessmentData.overall_score, assessmentId], function(err) {
                if (err) return reject(err);
                resolve();
            });
        });

        // Update workflow version
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE assessment_workflows
                SET current_version = ?, status = 'DRAFT', updated_at = datetime('now')
                WHERE assessment_id = ?
            `, [newVersion, assessmentId], function(err) {
                if (err) return reject(err);
                resolve();
            });
        });

        return {
            assessmentId,
            restoredFromVersion: version,
            newVersion,
            status: WORKFLOW_STATES.DRAFT
        };
    }

    // ========== Private Helper Methods ==========

    /**
     * Validate assessment completeness before submission
     */
    static async _validateAssessmentCompleteness(assessmentId) {
        const assessment = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM maturity_assessments WHERE id = ?`, [assessmentId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!assessment) {
            return { isComplete: false, missingItems: ['Assessment not found'] };
        }

        const missingItems = [];
        const axisScores = JSON.parse(assessment.axis_scores || '{}');
        const requiredAxes = ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity'];

        for (const axis of requiredAxes) {
            if (!axisScores[axis] || !axisScores[axis].actual) {
                missingItems.push(`Missing assessment for ${axis}`);
            }
            if (WORKFLOW_CONFIG.requireJustification && (!axisScores[axis] || !axisScores[axis].justification)) {
                missingItems.push(`Missing justification for ${axis}`);
            }
        }

        return {
            isComplete: missingItems.length === 0,
            missingItems,
            completionPercentage: Math.round(((requiredAxes.length * 2 - missingItems.length) / (requiredAxes.length * 2)) * 100)
        };
    }

    /**
     * Check if all reviews are complete and update workflow status
     */
    static async _checkReviewCompletion(workflowId) {
        const stats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
                FROM assessment_reviews
                WHERE workflow_id = ?
            `, [workflowId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (stats.total > 0 && stats.completed >= stats.total) {
            // All reviews complete - move to awaiting approval
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE assessment_workflows
                    SET status = ?, updated_at = datetime('now')
                    WHERE id = ?
                `, [WORKFLOW_STATES.AWAITING_APPROVAL, workflowId], function(err) {
                    if (err) return reject(err);
                    resolve();
                });
            });
        } else if (stats.completed >= WORKFLOW_CONFIG.minReviewers) {
            // Minimum reviews met - can optionally move to awaiting approval
            // For now, we wait for all reviews
        }
    }

    /**
     * Create a version snapshot of the assessment
     */
    static async _createVersionSnapshot(assessmentId, version) {
        const assessment = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM maturity_assessments WHERE id = ?`, [assessmentId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!assessment) return;

        const versionId = uuidv4();
        const snapshotData = {
            axis_scores: JSON.parse(assessment.axis_scores || '{}'),
            overall_score: assessment.overall_score,
            gap_analysis: JSON.parse(assessment.gap_analysis || '{}')
        };

        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO assessment_versions (
                    id, assessment_id, version, assessment_data,
                    created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, datetime('now'))
            `, [versionId, assessmentId, version, JSON.stringify(snapshotData), assessment.updated_by], function(err) {
                if (err) return reject(err);
                resolve();
            });
        });

        return versionId;
    }

    /**
     * Build comment tree from flat list
     */
    static _buildCommentTree(comments) {
        const commentMap = new Map();
        const roots = [];

        // First pass: create map
        for (const comment of comments) {
            commentMap.set(comment.id, { ...comment, replies: [] });
        }

        // Second pass: build tree
        for (const comment of comments) {
            const node = commentMap.get(comment.id);
            if (comment.parent_comment_id) {
                const parent = commentMap.get(comment.parent_comment_id);
                if (parent) {
                    parent.replies.push(node);
                } else {
                    roots.push(node);
                }
            } else {
                roots.push(node);
            }
        }

        return roots;
    }
}

// Export
module.exports = {
    AssessmentWorkflowService,
    WORKFLOW_STATES,
    REVIEW_STATUS,
    WORKFLOW_CONFIG
};

