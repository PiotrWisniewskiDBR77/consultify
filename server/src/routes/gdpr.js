/**
 * GDPR Routes
 * 
 * API endpoints for GDPR compliance features:
 * - Consent management
 * - Data retention settings
 * - Data export requests
 * - Account deletion (right to be forgotten)
 * 
 * Endpoints:
 * - GET/PUT /api/gdpr/consents
 * - GET/PUT /api/gdpr/retention
 * - GET /api/gdpr/export-status
 * - POST /api/gdpr/export-request
 * - POST /api/gdpr/deletion-request
 * - POST /api/gdpr/cancel-deletion
 */

import express from 'express';
const router = express.Router();
import db from '../database.js';
import verifyToken from '../middleware/authMiddleware.js';
import { v4 as uuidv4 } from 'uuid';

// Apply auth middleware to all routes
router.use(verifyToken);

// ==========================================
// CONSENT MANAGEMENT
// ==========================================

/**
 * GET /api/gdpr/consents
 * Get user consent preferences
 */
router.get('/consents', async (req, res) => {
    try {
        const userId = req.user.id;

        const row = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    analytics, personalization, marketing,
                    third_party_sharing as thirdPartySharing,
                    ai_training as aiTraining
                FROM user_gdpr_consents
                WHERE user_id = ?`,
                [userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (row) {
            res.json({
                success: true,
                consents: {
                    analytics: !!row.analytics,
                    personalization: !!row.personalization,
                    marketing: !!row.marketing,
                    thirdPartySharing: !!row.thirdPartySharing,
                    aiTraining: !!row.aiTraining
                }
            });
        } else {
            // Return defaults
            res.json({
                success: true,
                consents: {
                    analytics: true,
                    personalization: true,
                    marketing: false,
                    thirdPartySharing: false,
                    aiTraining: true
                }
            });
        }
    } catch (err) {
        console.error('[GDPR] Consents error:', err);
        res.status(500).json({ error: 'Failed to get consents' });
    }
});

/**
 * PUT /api/gdpr/consents
 * Update user consent preferences
 */
router.put('/consents', async (req, res) => {
    try {
        const userId = req.user.id;
        const { consents } = req.body;

        if (!consents) {
            return res.status(400).json({ error: 'Consents data required' });
        }

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_gdpr_consents (
                    user_id, analytics, personalization, marketing,
                    third_party_sharing, ai_training, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(user_id) DO UPDATE SET
                    analytics = excluded.analytics,
                    personalization = excluded.personalization,
                    marketing = excluded.marketing,
                    third_party_sharing = excluded.third_party_sharing,
                    ai_training = excluded.ai_training,
                    updated_at = datetime('now')`,
                [
                    userId,
                    consents.analytics ? 1 : 0,
                    consents.personalization ? 1 : 0,
                    consents.marketing ? 1 : 0,
                    consents.thirdPartySharing ? 1 : 0,
                    consents.aiTraining ? 1 : 0
                ],
                (err) => err ? reject(err) : resolve()
            );
        });

        res.json({ success: true, message: 'Consents updated' });
    } catch (err) {
        console.error('[GDPR] Update consents error:', err);
        res.status(500).json({ error: 'Failed to update consents' });
    }
});

// ==========================================
// DATA RETENTION
// ==========================================

/**
 * GET /api/gdpr/retention
 * Get data retention settings
 */
router.get('/retention', async (req, res) => {
    try {
        const userId = req.user.id;

        const row = await new Promise((resolve, reject) => {
            db.get(
                `SELECT retention_period as period, auto_delete as autoDelete
                FROM user_data_retention
                WHERE user_id = ?`,
                [userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (row) {
            res.json({
                success: true,
                retention: {
                    period: row.period,
                    autoDelete: !!row.autoDelete
                }
            });
        } else {
            res.json({
                success: true,
                retention: {
                    period: '365',
                    autoDelete: false
                }
            });
        }
    } catch (err) {
        console.error('[GDPR] Retention error:', err);
        res.status(500).json({ error: 'Failed to get retention settings' });
    }
});

/**
 * PUT /api/gdpr/retention
 * Update data retention settings
 */
router.put('/retention', async (req, res) => {
    try {
        const userId = req.user.id;
        const { retention } = req.body;

        if (!retention) {
            return res.status(400).json({ error: 'Retention data required' });
        }

        const validPeriods = ['30', '90', '180', '365', 'forever'];
        if (!validPeriods.includes(retention.period)) {
            return res.status(400).json({ error: 'Invalid retention period' });
        }

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_data_retention (
                    user_id, retention_period, auto_delete, updated_at
                ) VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(user_id) DO UPDATE SET
                    retention_period = excluded.retention_period,
                    auto_delete = excluded.auto_delete,
                    updated_at = datetime('now')`,
                [userId, retention.period, retention.autoDelete ? 1 : 0],
                (err) => err ? reject(err) : resolve()
            );
        });

        res.json({ success: true, message: 'Retention settings updated' });
    } catch (err) {
        console.error('[GDPR] Update retention error:', err);
        res.status(500).json({ error: 'Failed to update retention' });
    }
});

// ==========================================
// DATA EXPORT
// ==========================================

/**
 * GET /api/gdpr/export-status
 * Get current export request status
 */
router.get('/export-status', async (req, res) => {
    try {
        const userId = req.user.id;

        const request = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, status, requested_at as requestedAt,
                        expires_at as expiresAt, download_url as downloadUrl
                FROM data_export_requests
                WHERE user_id = ?
                ORDER BY requested_at DESC
                LIMIT 1`,
                [userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        res.json({
            success: true,
            request: request || null
        });
    } catch (err) {
        console.error('[GDPR] Export status error:', err);
        res.status(500).json({ error: 'Failed to get export status' });
    }
});

/**
 * POST /api/gdpr/export-request
 * Request data export
 */
router.post('/export-request', async (req, res) => {
    try {
        const userId = req.user.id;
        const userEmail = req.user.email;

        // Check for existing pending request
        const existing = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM data_export_requests
                WHERE user_id = ? AND status IN ('pending', 'processing')`,
                [userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (existing) {
            return res.status(400).json({ 
                error: 'An export request is already in progress' 
            });
        }

        const requestId = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO data_export_requests (
                    id, user_id, status, requested_at, expires_at
                ) VALUES (?, ?, 'pending', datetime('now'), ?)`,
                [requestId, userId, expiresAt.toISOString()],
                (err) => err ? reject(err) : resolve()
            );
        });

        // In a real implementation, this would queue a background job
        // For now, we'll simulate processing
        setTimeout(async () => {
            try {
                // Generate export data
                const userData = await collectUserData(userId);
                
                // In production, this would be stored in cloud storage
                // For now, we mark as ready
                await new Promise((resolve, reject) => {
                    db.run(
                        `UPDATE data_export_requests 
                        SET status = 'ready', 
                            download_url = '/api/gdpr/download-export/${requestId}'
                        WHERE id = ?`,
                        [requestId],
                        (err) => err ? reject(err) : resolve()
                    );
                });
            } catch (err) {
                console.error('[GDPR] Export processing error:', err);
            }
        }, 2000);

        res.json({
            success: true,
            request: {
                id: requestId,
                status: 'pending',
                requestedAt: new Date().toISOString(),
                expiresAt: expiresAt.toISOString()
            }
        });
    } catch (err) {
        console.error('[GDPR] Export request error:', err);
        res.status(500).json({ error: 'Failed to request export' });
    }
});

/**
 * GET /api/gdpr/download-export/:requestId
 * Download export file
 */
router.get('/download-export/:requestId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { requestId } = req.params;

        const request = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM data_export_requests
                WHERE id = ? AND user_id = ? AND status = 'ready'`,
                [requestId, userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!request) {
            return res.status(404).json({ error: 'Export not found or not ready' });
        }

        // Check expiration
        if (new Date(request.expires_at) < new Date()) {
            return res.status(410).json({ error: 'Export has expired' });
        }

        // Generate fresh export data
        const userData = await collectUserData(userId);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=consultify-data-export-${new Date().toISOString().split('T')[0]}.json`);
        res.send(JSON.stringify(userData, null, 2));
    } catch (err) {
        console.error('[GDPR] Download export error:', err);
        res.status(500).json({ error: 'Failed to download export' });
    }
});

// ==========================================
// ACCOUNT DELETION
// ==========================================

/**
 * POST /api/gdpr/deletion-request
 * Request account deletion
 */
router.post('/deletion-request', async (req, res) => {
    try {
        const userId = req.user.id;

        // Check for existing pending deletion
        const existing = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM account_deletion_requests
                WHERE user_id = ? AND status IN ('pending', 'scheduled')`,
                [userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (existing) {
            return res.status(400).json({ 
                error: 'A deletion request is already pending' 
            });
        }

        const requestId = uuidv4();
        const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days grace period

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO account_deletion_requests (
                    id, user_id, status, requested_at, scheduled_for
                ) VALUES (?, ?, 'scheduled', datetime('now'), ?)`,
                [requestId, userId, scheduledFor.toISOString()],
                (err) => err ? reject(err) : resolve()
            );
        });

        res.json({
            success: true,
            request: {
                id: requestId,
                status: 'scheduled',
                requestedAt: new Date().toISOString(),
                scheduledFor: scheduledFor.toISOString()
            }
        });
    } catch (err) {
        console.error('[GDPR] Deletion request error:', err);
        res.status(500).json({ error: 'Failed to request deletion' });
    }
});

/**
 * POST /api/gdpr/cancel-deletion
 * Cancel pending deletion request
 */
router.post('/cancel-deletion', async (req, res) => {
    try {
        const userId = req.user.id;
        const { requestId } = req.body;

        const result = await new Promise((resolve, reject) => {
            db.run(
                `UPDATE account_deletion_requests 
                SET status = 'cancelled'
                WHERE id = ? AND user_id = ? AND status = 'scheduled'`,
                [requestId, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Deletion request not found' });
        }

        res.json({ success: true, message: 'Deletion cancelled' });
    } catch (err) {
        console.error('[GDPR] Cancel deletion error:', err);
        res.status(500).json({ error: 'Failed to cancel deletion' });
    }
});

/**
 * GET /api/gdpr/deletion-status
 * Get deletion request status
 */
router.get('/deletion-status', async (req, res) => {
    try {
        const userId = req.user.id;

        const request = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, status, requested_at as requestedAt,
                        scheduled_for as scheduledFor
                FROM account_deletion_requests
                WHERE user_id = ?
                ORDER BY requested_at DESC
                LIMIT 1`,
                [userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        res.json({
            success: true,
            request: request || null
        });
    } catch (err) {
        console.error('[GDPR] Deletion status error:', err);
        res.status(500).json({ error: 'Failed to get deletion status' });
    }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Collect all user data for export
 */
async function collectUserData(userId) {
    const data = {
        exportDate: new Date().toISOString(),
        user: null,
        profile: null,
        preferences: null,
        projects: [],
        tasks: [],
        assessments: [],
        notifications: [],
        securityEvents: []
    };

    // Get user basic info
    data.user = await new Promise((resolve, reject) => {
        db.get(
            `SELECT id, email, first_name, last_name, phone, role, 
                    created_at, last_login_at
            FROM users WHERE id = ?`,
            [userId],
            (err, row) => err ? reject(err) : resolve(row)
        );
    });

    // Get extended preferences
    data.preferences = await new Promise((resolve, reject) => {
        db.get(
            `SELECT extended_preferences FROM users WHERE id = ?`,
            [userId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row?.extended_preferences ? JSON.parse(row.extended_preferences) : null);
            }
        );
    });

    // Get projects
    data.projects = await new Promise((resolve, reject) => {
        db.all(
            `SELECT id, name, description, status, created_at, updated_at
            FROM projects WHERE owner_id = ? OR id IN (
                SELECT project_id FROM project_members WHERE user_id = ?
            )`,
            [userId, userId],
            (err, rows) => err ? reject(err) : resolve(rows || [])
        );
    });

    // Get tasks
    data.tasks = await new Promise((resolve, reject) => {
        db.all(
            `SELECT id, title, description, status, priority, due_date, created_at
            FROM tasks WHERE assignee_id = ? OR created_by = ?`,
            [userId, userId],
            (err, rows) => err ? reject(err) : resolve(rows || [])
        );
    });

    // Get security events
    data.securityEvents = await new Promise((resolve, reject) => {
        db.all(
            `SELECT type, title, description, ip_address, created_at
            FROM security_events WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 100`,
            [userId],
            (err, rows) => err ? reject(err) : resolve(rows || [])
        );
    });

    return data;
}

export default router;
