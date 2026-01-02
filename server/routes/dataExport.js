/**
 * Data Export Routes
 * 
 * GDPR-compliant data export and retention management.
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/authMiddleware');
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/user/data-export
 * Request a data export (GDPR Article 20)
 */
router.post('/data-export', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const userEmail = req.user.email;

        // Collect all user data
        const userData = {};

        // User profile
        userData.profile = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, email, name, role, company_name, preferences, extended_preferences, created_at
                 FROM users WHERE id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        // User's assessments
        userData.assessments = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM assessments WHERE user_id = ?`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // User's tasks
        userData.tasks = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM tasks WHERE assignee_id = ? OR created_by = ?`,
                [userId, userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // User's AI memory
        userData.aiMemory = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM user_ai_memory WHERE user_id = ?`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // Login history
        userData.loginHistory = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM login_history WHERE user_id = ?`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // Sessions
        userData.sessions = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM active_sessions WHERE user_id = ?`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // Add metadata
        userData.exportMetadata = {
            exportDate: new Date().toISOString(),
            userId: userId,
            email: userEmail,
            format: 'JSON',
            gdprArticle: 'Article 20 - Right to data portability'
        };

        // In production, you might want to email the export or provide a download link
        res.json({
            success: true,
            message: 'Data export generated',
            data: userData
        });
    } catch (error) {
        console.error('Error exporting user data:', error);
        res.status(500).json({ success: false, error: 'Failed to export data' });
    }
});

/**
 * PUT /api/user/data-retention
 * Update data retention preferences
 */
router.put('/data-retention', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { retentionPeriod, trainingOptOut } = req.body;

        // Valid retention periods: '30', '90', '365', 'forever'
        const validPeriods = ['30', '90', '365', 'forever'];
        if (retentionPeriod && !validPeriods.includes(retentionPeriod)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid retention period. Valid values: 30, 90, 365, forever' 
            });
        }

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE users SET 
                    extended_preferences = json_set(
                        COALESCE(extended_preferences, '{}'),
                        '$.dataRetentionPeriod', ?,
                        '$.trainingOptOut', ?
                    )
                 WHERE id = ?`,
                [retentionPeriod, trainingOptOut ? 1 : 0, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });

        res.json({
            success: true,
            message: 'Data retention settings updated'
        });
    } catch (error) {
        console.error('Error updating data retention:', error);
        res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
});

/**
 * DELETE /api/user/data
 * Request account deletion (GDPR Article 17 - Right to erasure)
 */
router.delete('/data', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { confirmEmail } = req.body;

        // Verify email confirmation
        if (confirmEmail !== req.user.email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email confirmation does not match' 
            });
        }

        // In production, you might want to:
        // 1. Schedule deletion for 30 days (grace period)
        // 2. Send confirmation email
        // 3. Notify admins

        // For now, we'll just mark the account for deletion
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE users SET 
                    extended_preferences = json_set(
                        COALESCE(extended_preferences, '{}'),
                        '$.deletionRequested', 1,
                        '$.deletionRequestedAt', datetime('now')
                    )
                 WHERE id = ?`,
                [userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });

        res.json({
            success: true,
            message: 'Account deletion requested. Your data will be deleted within 30 days.'
        });
    } catch (error) {
        console.error('Error requesting account deletion:', error);
        res.status(500).json({ success: false, error: 'Failed to request deletion' });
    }
});

/**
 * GET /api/user/data-retention
 * Get current data retention settings
 */
router.get('/data-retention', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT extended_preferences FROM users WHERE id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        let preferences = {};
        try {
            preferences = JSON.parse(user?.extended_preferences || '{}');
        } catch (e) {
            preferences = {};
        }

        res.json({
            success: true,
            data: {
                dataRetentionPeriod: preferences.dataRetentionPeriod || '365',
                trainingOptOut: preferences.trainingOptOut || false,
                deletionRequested: preferences.deletionRequested || false,
                deletionRequestedAt: preferences.deletionRequestedAt || null
            }
        });
    } catch (error) {
        console.error('Error fetching data retention settings:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
});

module.exports = router;

