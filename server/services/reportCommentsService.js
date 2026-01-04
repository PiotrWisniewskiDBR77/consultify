/**
 * Report Comments Service
 * 
 * Handles inline commenting system for Management Reports
 * with threading, mentions, and resolution tracking.
 * 
 * PMO Standards Alignment:
 * - ISO 21500: Communication Management
 * - PMBOK 7: Stakeholder Engagement
 * - PRINCE2: Lessons Learned
 */

import { getDatabase } from '../src/database/index.js';
const db = getDatabase();
import ReportAuditService from './reportAuditService.js';
import { v4 as uuidv4 } from 'uuid';

// Lazy-load to avoid circular dependency
let NotificationOutboxService = null;
const getNotificationService = () => {
    if (!NotificationOutboxService) {
        try {
            NotificationOutboxService = require('./notificationOutboxService');
        } catch (e) {
            // Service might not exist
            NotificationOutboxService = { send: async () => {} };
        }
    }
    return NotificationOutboxService;
};

const ReportCommentsService = {
    /**
     * Adds a new comment to a report.
     * @param {string} reportId - Report ID
     * @param {string|null} sectionId - Optional section ID (e.g., 'executiveSummary', 'kpis')
     * @param {string} content - Comment content
     * @param {string} userId - User creating the comment
     * @param {string[]} mentions - Array of user IDs mentioned
     * @param {string|null} parentCommentId - Parent comment ID for replies
     * @returns {Promise<Object>} Created comment
     */
    addComment: async (reportId, sectionId, content, userId, mentions = [], parentCommentId = null) => {
        // Check if report exists and is not locked
        const report = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, organization_id, status, locked_at, title FROM management_reports WHERE id = ?`,
                [reportId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!report) {
            throw new Error('Report not found');
        }

        if (report.status === 'FINAL' && report.locked_at) {
            throw new Error('Cannot add comments to a finalized report');
        }

        // Validate parent comment if provided
        if (parentCommentId) {
            const parentComment = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT id, report_id FROM management_report_comments WHERE id = ?`,
                    [parentCommentId],
                    (err, row) => err ? reject(err) : resolve(row)
                );
            });

            if (!parentComment || parentComment.report_id !== reportId) {
                throw new Error('Invalid parent comment');
            }
        }

        // Get current version if exists
        let versionId = null;
        try {
            const version = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT id FROM management_report_versions 
                     WHERE report_id = ? 
                     ORDER BY version_number DESC LIMIT 1`,
                    [reportId],
                    (err, row) => err ? reject(err) : resolve(row)
                );
            });
            if (version) {
                versionId = version.id;
            }
        } catch (e) {
            // Ignore - version tracking is optional
        }

        const id = uuidv4();
        const now = new Date().toISOString();

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO management_report_comments 
                 (id, report_id, version_id, section_id, parent_comment_id, content, mentions, is_resolved, created_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
                [id, reportId, versionId, sectionId, parentCommentId, content, JSON.stringify(mentions), userId, now, now],
                function(err) {
                    if (err) reject(err);
                    else resolve({ lastID: this.lastID, changes: this.changes });
                }
            );
        });

        // Log audit
        ReportAuditService.log(reportId, 'COMMENT_ADDED', userId, {
            commentId: id,
            sectionId,
            parentCommentId,
            hasMentions: mentions.length > 0
        });

        // Send notifications for mentions
        if (mentions.length > 0) {
            const notificationService = getNotificationService();
            for (const mentionedUserId of mentions) {
                try {
                    await notificationService.send({
                        type: 'COMMENT_MENTION',
                        userId: mentionedUserId,
                        data: {
                            reportId,
                            reportTitle: report.title,
                            commentId: id,
                            mentionedBy: userId
                        }
                    });
                } catch (e) {
                    console.error('[ReportCommentsService] Failed to send mention notification:', e);
                }
            }
        }

        return {
            id,
            reportId,
            versionId,
            sectionId,
            parentCommentId,
            content,
            mentions,
            isResolved: false,
            createdBy: userId,
            createdAt: now,
            updatedAt: now
        };
    },

    /**
     * Gets all comments for a report.
     * @param {string} reportId - Report ID
     * @param {string|null} sectionId - Optional section filter
     * @param {boolean|null} resolved - Optional resolved status filter
     * @returns {Promise<Array>} List of comments
     */
    getComments: async (reportId, sectionId = null, resolved = null) => {
        let sql = `
            SELECT c.*, u.first_name, u.last_name, u.email as author_email
            FROM management_report_comments c
            LEFT JOIN users u ON c.created_by = u.id
            WHERE c.report_id = ?
        `;
        const params = [reportId];

        if (sectionId !== null) {
            sql += ` AND c.section_id = ?`;
            params.push(sectionId);
        }

        if (resolved !== null) {
            sql += ` AND c.is_resolved = ?`;
            params.push(resolved ? 1 : 0);
        }

        sql += ` ORDER BY c.created_at ASC`;

        const rows = await new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
        });

        return rows.map(row => ({
            id: row.id,
            reportId: row.report_id,
            versionId: row.version_id,
            sectionId: row.section_id,
            parentCommentId: row.parent_comment_id,
            content: row.content,
            mentions: JSON.parse(row.mentions || '[]'),
            isResolved: Boolean(row.is_resolved),
            resolvedBy: row.resolved_by,
            resolvedAt: row.resolved_at,
            createdBy: row.created_by,
            authorName: row.first_name ? `${row.first_name} ${row.last_name}` : row.author_email,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    },

    /**
     * Gets a specific comment by ID.
     * @param {string} commentId - Comment ID
     * @returns {Promise<Object|null>}
     */
    getComment: async (commentId) => {
        const row = await new Promise((resolve, reject) => {
            db.get(
                `SELECT c.*, u.first_name, u.last_name
                 FROM management_report_comments c
                 LEFT JOIN users u ON c.created_by = u.id
                 WHERE c.id = ?`,
                [commentId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!row) return null;

        return {
            id: row.id,
            reportId: row.report_id,
            versionId: row.version_id,
            sectionId: row.section_id,
            parentCommentId: row.parent_comment_id,
            content: row.content,
            mentions: JSON.parse(row.mentions || '[]'),
            isResolved: Boolean(row.is_resolved),
            resolvedBy: row.resolved_by,
            resolvedAt: row.resolved_at,
            createdBy: row.created_by,
            authorName: row.first_name ? `${row.first_name} ${row.last_name}` : row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    },

    /**
     * Updates a comment.
     * @param {string} commentId - Comment ID
     * @param {string} userId - User making the update
     * @param {string|null} content - New content (null to keep existing)
     * @param {boolean|null} isResolved - New resolved status (null to keep existing)
     * @returns {Promise<Object>} Updated comment
     */
    updateComment: async (commentId, userId, content = null, isResolved = null) => {
        const comment = await ReportCommentsService.getComment(commentId);
        if (!comment) {
            throw new Error('Comment not found');
        }

        // Only author can edit content
        if (content !== null && comment.createdBy !== userId) {
            throw new Error('Only the author can edit this comment');
        }

        const updates = [];
        const params = [];

        if (content !== null) {
            updates.push('content = ?');
            params.push(content);
        }

        if (isResolved !== null) {
            updates.push('is_resolved = ?');
            params.push(isResolved ? 1 : 0);

            if (isResolved) {
                updates.push('resolved_by = ?', 'resolved_at = ?');
                params.push(userId, new Date().toISOString());
            } else {
                updates.push('resolved_by = NULL', 'resolved_at = NULL');
            }
        }

        if (updates.length === 0) {
            return comment;
        }

        updates.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(commentId);

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE management_report_comments SET ${updates.join(', ')} WHERE id = ?`,
                params,
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });

        // Log audit
        ReportAuditService.log(comment.reportId, 'COMMENT_UPDATED', userId, {
            commentId,
            contentUpdated: content !== null,
            resolvedStatusChanged: isResolved !== null
        });

        return ReportCommentsService.getComment(commentId);
    },

    /**
     * Resolves a comment and all its replies.
     * @param {string} commentId - Comment ID
     * @param {string} userId - User resolving
     * @returns {Promise<Object>}
     */
    resolveComment: async (commentId, userId) => {
        const comment = await ReportCommentsService.getComment(commentId);
        if (!comment) {
            throw new Error('Comment not found');
        }

        const now = new Date().toISOString();

        // Resolve parent comment
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE management_report_comments 
                 SET is_resolved = 1, resolved_by = ?, resolved_at = ?, updated_at = ?
                 WHERE id = ?`,
                [userId, now, now, commentId],
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });

        // Resolve all replies
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE management_report_comments 
                 SET is_resolved = 1, resolved_by = ?, resolved_at = ?, updated_at = ?
                 WHERE parent_comment_id = ?`,
                [userId, now, now, commentId],
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });

        ReportAuditService.log(comment.reportId, 'COMMENT_RESOLVED', userId, { commentId });

        return { ...comment, isResolved: true, resolvedBy: userId, resolvedAt: now };
    },

    /**
     * Unresolves a comment.
     * @param {string} commentId - Comment ID
     * @param {string} userId - User unresolving
     * @returns {Promise<Object>}
     */
    unresolveComment: async (commentId, userId) => {
        const comment = await ReportCommentsService.getComment(commentId);
        if (!comment) {
            throw new Error('Comment not found');
        }

        const now = new Date().toISOString();

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE management_report_comments 
                 SET is_resolved = 0, resolved_by = NULL, resolved_at = NULL, updated_at = ?
                 WHERE id = ?`,
                [now, commentId],
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });

        ReportAuditService.log(comment.reportId, 'COMMENT_UNRESOLVED', userId, { commentId });

        return { ...comment, isResolved: false, resolvedBy: null, resolvedAt: null };
    },

    /**
     * Deletes a comment and all its replies.
     * @param {string} commentId - Comment ID
     * @param {string} userId - User deleting
     * @param {boolean} isAdmin - Whether user is admin (can delete any comment)
     * @returns {Promise<Object>}
     */
    deleteComment: async (commentId, userId, isAdmin = false) => {
        const comment = await ReportCommentsService.getComment(commentId);
        if (!comment) {
            throw new Error('Comment not found');
        }

        // Check permission
        if (!isAdmin && comment.createdBy !== userId) {
            // Check if user is admin
            const user = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT role FROM users WHERE id = ?`,
                    [userId],
                    (err, row) => err ? reject(err) : resolve(row)
                );
            });

            if (!user || !['ADMIN', 'SUPERADMIN'].includes(user.role)) {
                throw new Error('Only the author can delete this comment');
            }
        }

        // Delete replies first
        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM management_report_comments WHERE parent_comment_id = ?`,
                [commentId],
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });

        // Delete comment
        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM management_report_comments WHERE id = ?`,
                [commentId],
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });

        ReportAuditService.log(comment.reportId, 'COMMENT_DELETED', userId, { commentId });

        return { deleted: true, commentId };
    },

    /**
     * Gets comments organized as threads.
     * @param {string} reportId - Report ID
     * @returns {Promise<Array>}
     */
    getThreadedComments: async (reportId) => {
        const allComments = await ReportCommentsService.getComments(reportId);

        const parentComments = allComments.filter(c => !c.parentCommentId);
        const replyMap = new Map();

        allComments.forEach(c => {
            if (c.parentCommentId) {
                if (!replyMap.has(c.parentCommentId)) {
                    replyMap.set(c.parentCommentId, []);
                }
                replyMap.get(c.parentCommentId).push(c);
            }
        });

        return parentComments.map(parent => ({
            ...parent,
            replies: replyMap.get(parent.id) || []
        }));
    },

    /**
     * Gets comment counts for a report.
     * @param {string} reportId - Report ID
     * @returns {Promise<Object>}
     */
    getCommentCount: async (reportId) => {
        const total = await new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM management_report_comments WHERE report_id = ?`,
                [reportId],
                (err, row) => err ? reject(err) : resolve(row?.count || 0)
            );
        });

        const open = await new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM management_report_comments WHERE report_id = ? AND is_resolved = 0`,
                [reportId],
                (err, row) => err ? reject(err) : resolve(row?.count || 0)
            );
        });

        const resolved = await new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM management_report_comments WHERE report_id = ? AND is_resolved = 1`,
                [reportId],
                (err, row) => err ? reject(err) : resolve(row?.count || 0)
            );
        });

        return { total, open, resolved };
    },

    /**
     * Gets comments grouped by section.
     * @param {string} reportId - Report ID
     * @returns {Promise<Object>}
     */
    getCommentsBySection: async (reportId) => {
        const rows = await new Promise((resolve, reject) => {
            db.all(
                `SELECT section_id, COUNT(*) as count 
                 FROM management_report_comments 
                 WHERE report_id = ? AND section_id IS NOT NULL
                 GROUP BY section_id`,
                [reportId],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });

        const result = {};
        rows.forEach(row => {
            result[row.section_id] = row.count;
        });

        return result;
    }
};

export default ReportCommentsService;











