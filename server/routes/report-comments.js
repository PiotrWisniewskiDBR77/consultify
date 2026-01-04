/**
 * Report Comments API
 * 
 * Handles comments and feedback on assessment report sections.
 * Supports AI-powered comment processing and section regeneration.
 */

import express from 'express';
const router = express.Router();
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();

import verifyToken from '../middleware/authMiddleware.js';
import * as ReportContentGeneratorModule from '../services/ai/reportContentGenerator.js';
const ReportContentGenerator = ReportContentGeneratorModule.default || ReportContentGeneratorModule;

/**
 * GET /api/report-comments/:reportId
 * Get all comments for a report
 */
router.get('/:reportId', verifyToken, async (req, res) => {
    try {
        const { reportId } = req.params;
        const { sectionId, status } = req.query;

        let sql = `
            SELECT 
                rc.*,
                u.first_name || ' ' || u.last_name as user_full_name,
                u.email as user_email
            FROM report_comments rc
            LEFT JOIN users u ON rc.user_id = u.id
            WHERE rc.report_id = ?
        `;
        const params = [reportId];

        if (sectionId) {
            sql += ` AND rc.section_id = ?`;
            params.push(sectionId);
        }

        if (status) {
            sql += ` AND rc.status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY rc.created_at DESC`;

        const comments = await new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                
                // Parse JSON fields
                const parsed = (rows || []).map(row => {
                    try {
                        row.ai_suggested_edits = row.ai_suggested_edits 
                            ? JSON.parse(row.ai_suggested_edits) 
                            : null;
                    } catch (e) {}
                    return row;
                });
                
                resolve(parsed);
            });
        });

        // Group by section
        const bySection = comments.reduce((acc, comment) => {
            const section = comment.section_id || 'general';
            if (!acc[section]) acc[section] = [];
            acc[section].push(comment);
            return acc;
        }, {});

        res.json({
            reportId,
            totalCount: comments.length,
            openCount: comments.filter(c => c.status === 'OPEN').length,
            comments,
            bySection
        });
    } catch (error) {
        console.error('[Report Comments API] GET error:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

/**
 * POST /api/report-comments/:reportId
 * Add a new comment to a report section
 */
router.post('/:reportId', verifyToken, async (req, res) => {
    try {
        const { reportId } = req.params;
        const { sectionId, sectionType, content, commentType, parentCommentId } = req.body;
        const userId = req.user.id;
        const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Comment content is required' });
        }

        const commentId = uuidv4();
        const now = new Date().toISOString();

        // Get thread position if this is a reply
        let threadPosition = 0;
        if (parentCommentId) {
            threadPosition = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT MAX(thread_position) as maxPos FROM report_comments WHERE parent_comment_id = ?`,
                    [parentCommentId],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve((row?.maxPos || 0) + 1);
                    }
                );
            });
        }

        const sql = `
            INSERT INTO report_comments (
                id, report_id, section_id, section_type, user_id, user_name,
                comment_type, content, status, parent_comment_id, thread_position,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?)
        `;

        await new Promise((resolve, reject) => {
            db.run(sql, [
                commentId, reportId, sectionId, sectionType, userId, userName,
                commentType || 'FEEDBACK', content.trim(), parentCommentId, threadPosition,
                now, now
            ], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        res.status(201).json({
            id: commentId,
            reportId,
            sectionId,
            sectionType,
            userId,
            userName,
            content: content.trim(),
            commentType: commentType || 'FEEDBACK',
            status: 'OPEN',
            parentCommentId,
            threadPosition,
            createdAt: now
        });
    } catch (error) {
        console.error('[Report Comments API] POST error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

/**
 * POST /api/report-comments/:reportId/:commentId/process-ai
 * Process comment with AI and generate suggestions
 */
router.post('/:reportId/:commentId/process-ai', verifyToken, async (req, res) => {
    try {
        const { reportId, commentId } = req.params;

        // Get comment and section content
        const comment = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM report_comments WHERE id = ?`, [commentId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Get report data
        const report = await new Promise((resolve, reject) => {
            db.get(`SELECT report_data FROM assessment_reports WHERE id = ?`, [reportId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        let sectionContent = {};
        if (report?.report_data) {
            try {
                const reportData = JSON.parse(report.report_data);
                sectionContent = reportData.sections?.[comment.section_id] || {};
            } catch (e) {}
        }

        // Generate AI response
        const aiResult = await ReportContentGenerator.generateCommentResponse(
            comment.content,
            sectionContent,
            {} // context - could be enriched
        );

        // Update comment with AI response
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE report_comments SET 
                    ai_response = ?, 
                    ai_suggested_edits = ?, 
                    ai_processed_at = ?,
                    updated_at = ?
                WHERE id = ?`,
                [
                    aiResult.response,
                    JSON.stringify(aiResult.suggestedEdits || []),
                    new Date().toISOString(),
                    new Date().toISOString(),
                    commentId
                ],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });

        res.json({
            commentId,
            aiResponse: aiResult.response,
            suggestedEdits: aiResult.suggestedEdits || [],
            processedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Report Comments API] AI process error:', error);
        res.status(500).json({ error: 'Failed to process comment with AI' });
    }
});

/**
 * PATCH /api/report-comments/:reportId/:commentId
 * Update comment status (resolve, dismiss, etc.)
 */
router.patch('/:reportId/:commentId', verifyToken, async (req, res) => {
    try {
        const { commentId } = req.params;
        const { status, resolutionNotes } = req.body;
        const userId = req.user.id;

        const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const updates = [];
        const params = [];

        if (status) {
            updates.push('status = ?');
            params.push(status);

            if (status === 'RESOLVED' || status === 'DISMISSED') {
                updates.push('resolved_by = ?');
                updates.push('resolved_at = ?');
                params.push(userId);
                params.push(new Date().toISOString());
            }
        }

        if (resolutionNotes) {
            updates.push('resolution_notes = ?');
            params.push(resolutionNotes);
        }

        updates.push('updated_at = ?');
        params.push(new Date().toISOString());

        params.push(commentId);

        const sql = `UPDATE report_comments SET ${updates.join(', ')} WHERE id = ?`;

        await new Promise((resolve, reject) => {
            db.run(sql, params, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        res.json({
            commentId,
            status,
            resolutionNotes,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Report Comments API] PATCH error:', error);
        res.status(500).json({ error: 'Failed to update comment' });
    }
});

/**
 * DELETE /api/report-comments/:reportId/:commentId
 * Delete a comment
 */
router.delete('/:reportId/:commentId', verifyToken, async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;

        // Check ownership or admin
        const comment = await new Promise((resolve, reject) => {
            db.get(`SELECT user_id FROM report_comments WHERE id = ?`, [commentId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        if (comment.user_id !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Not authorized to delete this comment' });
        }

        await new Promise((resolve, reject) => {
            db.run(`DELETE FROM report_comments WHERE id = ?`, [commentId], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        res.json({ deleted: true, commentId });
    } catch (error) {
        console.error('[Report Comments API] DELETE error:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

/**
 * POST /api/report-comments/:reportId/regenerate-section
 * Regenerate a section based on comments/feedback
 */
router.post('/:reportId/regenerate-section', verifyToken, async (req, res) => {
    try {
        const { reportId } = req.params;
        const { sectionId, feedback } = req.body;
        const userId = req.user.id;

        if (!sectionId) {
            return res.status(400).json({ error: 'Section ID is required' });
        }

        // Get report data
        const report = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM assessment_reports WHERE id = ?`, [reportId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        let reportData = {};
        try {
            reportData = JSON.parse(report.report_data || '{}');
        } catch (e) {}

        const currentContent = reportData.sections?.[sectionId];

        // Regenerate section with feedback
        const regenerated = await ReportContentGenerator.regenerateSection(
            sectionId,
            currentContent,
            feedback,
            {} // context
        );

        // Save to edit history
        const historyId = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO report_edit_history (
                    id, report_id, section_id, edit_type, editor_id,
                    previous_content, new_content, change_summary, created_at
                ) VALUES (?, ?, ?, 'AI_REGENERATED', ?, ?, ?, ?, ?)`,
                [
                    historyId, reportId, sectionId, userId,
                    JSON.stringify(currentContent),
                    JSON.stringify(regenerated),
                    feedback || 'AI regeneration',
                    new Date().toISOString()
                ],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });

        // Update report data
        if (!reportData.sections) reportData.sections = {};
        reportData.sections[sectionId] = regenerated;

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE assessment_reports SET report_data = ?, updated_at = ? WHERE id = ?`,
                [JSON.stringify(reportData), new Date().toISOString(), reportId],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });

        res.json({
            reportId,
            sectionId,
            regenerated: true,
            content: regenerated,
            historyId
        });
    } catch (error) {
        console.error('[Report Comments API] Regenerate error:', error);
        res.status(500).json({ error: 'Failed to regenerate section' });
    }
});

export default router;

