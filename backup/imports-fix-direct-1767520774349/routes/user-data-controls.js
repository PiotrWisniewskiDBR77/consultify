/**
 * User Data Controls Routes
 * 
 * Features:
 * - Data retention settings
 * - Data anonymization schedule
 * - Data export (JSON/CSV/PDF)
 * - Partial data deletion
 * - Data portability
 */

import express from 'express';
const router = express.Router();
import requireAuth from '../middleware/authMiddleware.js';
import db from '../database.js';

import { v4 as uuidv4 } from 'uuid';

router.use(requireAuth);

/**
 * GET /api/user/data-controls/retention
 * Get data retention settings
 */
router.get('/retention', async (req, res) => {
    try {
        const userId = req.user.id;

        const settings = await new Promise((resolve, reject) => {
            db.get(
                `SELECT data_retention_json, anonymization_enabled, anonymization_schedule 
                 FROM user_profile_extended WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        let retention = {
            tasks: 0,
            projects: 0,
            messages: 365,
            comments: 365,
            files: 0,
            activityLogs: 90,
            aiConversations: 30
        };

        if (settings?.data_retention_json) {
            try {
                retention = { ...retention, ...JSON.parse(settings.data_retention_json) };
            } catch (e) {}
        }

        res.json({
            success: true,
            data: {
                retention,
                anonymizationEnabled: !!settings?.anonymization_enabled,
                anonymizationSchedule: settings?.anonymization_schedule || 'monthly'
            }
        });
    } catch (error) {
        console.error('Error fetching data retention:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch data retention settings' });
    }
});

/**
 * PUT /api/user/data-controls/retention
 * Update data retention settings
 */
router.put('/retention', async (req, res) => {
    try {
        const userId = req.user.id;
        const { retention, anonymizationEnabled, anonymizationSchedule } = req.body;

        // Check if record exists
        const existing = await new Promise((resolve, reject) => {
            db.get('SELECT user_id FROM user_profile_extended WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        const retentionJson = JSON.stringify(retention);

        if (existing) {
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE user_profile_extended SET
                        data_retention_json = ?,
                        anonymization_enabled = ?,
                        anonymization_schedule = ?,
                        updated_at = datetime('now')
                     WHERE user_id = ?`,
                    [retentionJson, anonymizationEnabled ? 1 : 0, anonymizationSchedule, userId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        } else {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO user_profile_extended 
                     (user_id, data_retention_json, anonymization_enabled, anonymization_schedule)
                     VALUES (?, ?, ?, ?)`,
                    [userId, retentionJson, anonymizationEnabled ? 1 : 0, anonymizationSchedule],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        res.json({ success: true, message: 'Data retention settings updated' });
    } catch (error) {
        console.error('Error updating data retention:', error);
        res.status(500).json({ success: false, error: 'Failed to update data retention settings' });
    }
});

/**
 * GET /api/user/data-controls/categories
 * Get data categories with counts
 */
router.get('/categories', async (req, res) => {
    try {
        const userId = req.user.id;

        const [taskCount, projectCount, messageCount, commentCount, fileCount, activityCount, aiCount] = await Promise.all([
            new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ? OR created_by = ?', [userId, userId], (err, row) => {
                    if (err) resolve({ count: 0 });
                    else resolve(row || { count: 0 });
                });
            }),
            new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM projects WHERE owner_id = ?', [userId], (err, row) => {
                    if (err) resolve({ count: 0 });
                    else resolve(row || { count: 0 });
                });
            }),
            new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?', [userId], (err, row) => {
                    if (err) resolve({ count: 0 });
                    else resolve(row || { count: 0 });
                });
            }),
            new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM report_comments WHERE user_id = ?', [userId], (err, row) => {
                    if (err) resolve({ count: 0 });
                    else resolve(row || { count: 0 });
                });
            }),
            new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM assessment_attachments WHERE uploaded_by = ?', [userId], (err, row) => {
                    if (err) resolve({ count: 0 });
                    else resolve(row || { count: 0 });
                });
            }),
            new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM audit_events WHERE user_id = ?', [userId], (err, row) => {
                    if (err) resolve({ count: 0 });
                    else resolve(row || { count: 0 });
                });
            }),
            new Promise((resolve, reject) => {
                db.get('SELECT COUNT(*) as count FROM conversations WHERE user_id = ?', [userId], (err, row) => {
                    if (err) resolve({ count: 0 });
                    else resolve(row || { count: 0 });
                });
            })
        ]);

        res.json({
            success: true,
            data: [
                { id: 'tasks', name: 'Tasks', description: 'Your tasks and subtasks', count: taskCount.count, size: `${Math.round(taskCount.count * 0.5)} KB`, canDelete: true, canExport: true },
                { id: 'projects', name: 'Projects', description: 'Project data and settings', count: projectCount.count, size: `${Math.round(projectCount.count * 2)} KB`, canDelete: false, canExport: true },
                { id: 'messages', name: 'Messages', description: 'Notifications and messages', count: messageCount.count, size: `${Math.round(messageCount.count * 0.2)} KB`, canDelete: true, canExport: true },
                { id: 'comments', name: 'Comments', description: 'Comments on reports', count: commentCount.count, size: `${Math.round(commentCount.count * 0.3)} KB`, canDelete: true, canExport: true },
                { id: 'files', name: 'Files', description: 'Uploaded files', count: fileCount.count, size: `${Math.round(fileCount.count * 100)} KB`, canDelete: true, canExport: true },
                { id: 'activity', name: 'Activity Logs', description: 'Your activity history', count: activityCount.count, size: `${Math.round(activityCount.count * 0.1)} KB`, canDelete: true, canExport: true },
                { id: 'ai', name: 'AI Conversations', description: 'AI chat history', count: aiCount.count, size: `${Math.round(aiCount.count * 1)} KB`, canDelete: true, canExport: true }
            ]
        });
    } catch (error) {
        console.error('Error fetching data categories:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch data categories' });
    }
});

/**
 * POST /api/user/data-controls/export
 * Export specific data category
 */
router.post('/export', async (req, res) => {
    try {
        const userId = req.user.id;
        const { category, format } = req.body;

        // In production, this would queue a background job
        // For now, we'll create an export request record

        const exportId = uuidv4();
        
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO gdpr_requests (id, user_id, request_type, status, metadata, requested_at)
                 VALUES (?, ?, 'export', 'pending', ?, datetime('now'))`,
                [exportId, userId, JSON.stringify({ category, format })],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({
            success: true,
            message: 'Export request queued',
            exportId
        });
    } catch (error) {
        console.error('Error creating export:', error);
        res.status(500).json({ success: false, error: 'Failed to create export request' });
    }
});

/**
 * POST /api/user/data-controls/export-all
 * Export all user data
 */
router.post('/export-all', async (req, res) => {
    try {
        const userId = req.user.id;
        const { format } = req.body;

        const exportId = uuidv4();
        
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO gdpr_requests (id, user_id, request_type, status, metadata, requested_at)
                 VALUES (?, ?, 'full_export', 'pending', ?, datetime('now'))`,
                [exportId, userId, JSON.stringify({ format: format || 'json' })],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({
            success: true,
            message: 'Full export request queued. You will receive an email when ready.',
            exportId
        });
    } catch (error) {
        console.error('Error creating full export:', error);
        res.status(500).json({ success: false, error: 'Failed to create export request' });
    }
});

/**
 * DELETE /api/user/data-controls/data/:category
 * Delete specific data category
 */
router.delete('/data/:category', async (req, res) => {
    try {
        const userId = req.user.id;
        const { category } = req.params;

        // Map category to table and column
        const categoryMap = {
            messages: { table: 'notifications', column: 'user_id' },
            comments: { table: 'report_comments', column: 'user_id' },
            activity: { table: 'audit_events', column: 'user_id' },
            ai: { table: 'conversations', column: 'user_id' }
        };

        if (!categoryMap[category]) {
            return res.status(400).json({ success: false, error: 'Invalid category or deletion not allowed' });
        }

        const { table, column } = categoryMap[category];

        // Log the deletion request
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO gdpr_requests (id, user_id, request_type, status, metadata, requested_at, completed_at)
                 VALUES (?, ?, 'deletion', 'completed', ?, datetime('now'), datetime('now'))`,
                [uuidv4(), userId, JSON.stringify({ category })],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Perform deletion
        await new Promise((resolve, reject) => {
            db.run(`DELETE FROM ${table} WHERE ${column} = ?`, [userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ success: true, message: `${category} data deleted successfully` });
    } catch (error) {
        console.error('Error deleting data:', error);
        res.status(500).json({ success: false, error: 'Failed to delete data' });
    }
});

export default router;







