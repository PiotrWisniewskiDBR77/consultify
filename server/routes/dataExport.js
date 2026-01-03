/**
 * Data Export Routes
 * 
 * API endpoints for data export and backup management:
 * - GDPR data export requests
 * - Full/partial exports
 * - Backup configuration
 * - Export history
 */

import express from 'express';
const router = express.Router();
import authMiddleware from '../middleware/authMiddleware.js';
import verifySuperAdmin from '../middleware/superAdminMiddleware.js';
import { getDatabase } from '../database/Database.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';

// Database helpers
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// ==========================================
// DATA EXPORT REQUESTS
// ==========================================

/**
 * GET /api/data-export/requests
 * List data export requests
 */
router.get('/requests', authMiddleware, async (req, res) => {
    try {
        const { organizationId, status, page = 1, pageSize = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const isSuperAdmin = req.user.role === 'SUPERADMIN';

        let query = `
            SELECT der.*, u.email as requester_email, u.firstName as requester_first_name,
                   o.name as organization_name
            FROM data_export_requests der
            LEFT JOIN users u ON der.user_id = u.id
            LEFT JOIN organizations o ON der.organization_id = o.id
            WHERE 1=1
        `;
        const params = [];

        if (!isSuperAdmin) {
            query += ` AND der.organization_id = ?`;
            params.push(req.user.organizationId);
        } else if (organizationId) {
            query += ` AND der.organization_id = ?`;
            params.push(organizationId);
        }

        if (status) {
            query += ` AND der.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY der.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(pageSize), offset);

        const requests = await dbAll(query, params);

        res.json({ 
            requests: requests.map(r => ({
                ...r,
                include_data: r.include_data ? JSON.parse(r.include_data) : [],
                exclude_data: r.exclude_data ? JSON.parse(r.exclude_data) : []
            }))
        });
    } catch (error) {
        console.error('[DataExport] List requests error:', error);
        res.status(500).json({ error: 'Failed to list export requests' });
    }
});

/**
 * POST /api/data-export/requests
 * Create new data export request
 */
router.post('/requests', authMiddleware, async (req, res) => {
    try {
        const { exportType = 'full', includeData = [], excludeData = [] } = req.body;
        const organizationId = req.user.organizationId;

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        // Check for pending requests
        const pending = await dbGet(`
            SELECT id FROM data_export_requests 
            WHERE organization_id = ? AND status IN ('pending', 'processing')
        `, [organizationId]);

        if (pending) {
            return res.status(400).json({ error: 'An export request is already in progress' });
        }

        const id = uuidv4();
        await dbRun(`
            INSERT INTO data_export_requests (
                id, organization_id, user_id, export_type, include_data, exclude_data, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `, [id, organizationId, req.user.id, exportType, JSON.stringify(includeData), JSON.stringify(excludeData)]);

        // In production, this would trigger a background job
        // For now, we'll simulate processing
        setTimeout(async () => {
            try {
                await dbRun(`
                    UPDATE data_export_requests 
                    SET status = 'processing', started_at = datetime('now')
                    WHERE id = ?
                `, [id]);

                // Simulate export completion
                setTimeout(async () => {
                    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
                    await dbRun(`
                        UPDATE data_export_requests 
                        SET status = 'completed', 
                            completed_at = datetime('now'),
                            file_url = ?,
                            file_expires_at = ?
                        WHERE id = ?
                    `, [`/api/data-export/download/${id}`, expiresAt, id]);
                }, 5000);
            } catch (err) {
                console.error('[DataExport] Processing error:', err);
            }
        }, 1000);

        res.status(201).json({ success: true, id, message: 'Export request created' });
    } catch (error) {
        console.error('[DataExport] Create request error:', error);
        res.status(500).json({ error: 'Failed to create export request' });
    }
});

/**
 * GET /api/data-export/requests/:id
 * Get export request status
 */
router.get('/requests/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const isSuperAdmin = req.user.role === 'SUPERADMIN';

        let query = `
            SELECT der.*, u.email as requester_email, o.name as organization_name
            FROM data_export_requests der
            LEFT JOIN users u ON der.user_id = u.id
            LEFT JOIN organizations o ON der.organization_id = o.id
            WHERE der.id = ?
        `;
        const params = [id];

        if (!isSuperAdmin) {
            query += ` AND der.organization_id = ?`;
            params.push(req.user.organizationId);
        }

        const request = await dbGet(query, params);

        if (!request) {
            return res.status(404).json({ error: 'Export request not found' });
        }

        res.json({ 
            request: {
                ...request,
                include_data: request.include_data ? JSON.parse(request.include_data) : [],
                exclude_data: request.exclude_data ? JSON.parse(request.exclude_data) : []
            }
        });
    } catch (error) {
        console.error('[DataExport] Get request error:', error);
        res.status(500).json({ error: 'Failed to get export request' });
    }
});

/**
 * DELETE /api/data-export/requests/:id
 * Cancel pending export request
 */
router.delete('/requests/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const isSuperAdmin = req.user.role === 'SUPERADMIN';

        const request = await dbGet(`SELECT * FROM data_export_requests WHERE id = ?`, [id]);
        
        if (!request) {
            return res.status(404).json({ error: 'Export request not found' });
        }

        if (!isSuperAdmin && request.organization_id !== req.user.organizationId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!['pending', 'processing'].includes(request.status)) {
            return res.status(400).json({ error: 'Can only cancel pending or processing requests' });
        }

        await dbRun(`UPDATE data_export_requests SET status = 'failed', error_message = 'Canceled by user' WHERE id = ?`, [id]);

        res.json({ success: true });
    } catch (error) {
        console.error('[DataExport] Cancel request error:', error);
        res.status(500).json({ error: 'Failed to cancel export request' });
    }
});

// ==========================================
// BACKUP CONFIGURATION
// ==========================================

/**
 * GET /api/data-export/backup-config
 * Get backup configuration for organization
 */
router.get('/backup-config', authMiddleware, async (req, res) => {
    try {
        const { organizationId } = req.query;
        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const orgId = isSuperAdmin && organizationId ? organizationId : req.user.organizationId;

        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        let config = await dbGet(`SELECT * FROM backup_configurations WHERE organization_id = ?`, [orgId]);

        if (!config) {
            // Return default config
            config = {
                organization_id: orgId,
                enabled: false,
                frequency: 'daily',
                retention_days: 30,
                include_attachments: true,
                include_audit_logs: true,
                last_backup_at: null,
                last_backup_status: null,
                last_backup_size: null,
                next_backup_at: null
            };
        }

        res.json({ config });
    } catch (error) {
        console.error('[DataExport] Get backup config error:', error);
        res.status(500).json({ error: 'Failed to get backup configuration' });
    }
});

/**
 * PUT /api/data-export/backup-config
 * Update backup configuration
 */
router.put('/backup-config', authMiddleware, async (req, res) => {
    try {
        const { organizationId } = req.query;
        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const orgId = isSuperAdmin && organizationId ? organizationId : req.user.organizationId;

        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        const {
            enabled,
            frequency,
            retentionDays,
            includeAttachments,
            includeAuditLogs
        } = req.body;

        const existing = await dbGet(`SELECT id FROM backup_configurations WHERE organization_id = ?`, [orgId]);

        if (existing) {
            const updates = [];
            const params = [];

            if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }
            if (frequency) { updates.push('frequency = ?'); params.push(frequency); }
            if (retentionDays !== undefined) { updates.push('retention_days = ?'); params.push(retentionDays); }
            if (includeAttachments !== undefined) { updates.push('include_attachments = ?'); params.push(includeAttachments ? 1 : 0); }
            if (includeAuditLogs !== undefined) { updates.push('include_audit_logs = ?'); params.push(includeAuditLogs ? 1 : 0); }

            if (updates.length > 0) {
                updates.push('updated_at = datetime("now")');
                params.push(orgId);
                await dbRun(`UPDATE backup_configurations SET ${updates.join(', ')} WHERE organization_id = ?`, params);
            }
        } else {
            const id = uuidv4();
            await dbRun(`
                INSERT INTO backup_configurations (
                    id, organization_id, enabled, frequency, retention_days,
                    include_attachments, include_audit_logs
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                id, orgId, 
                enabled ? 1 : 0, 
                frequency || 'daily', 
                retentionDays || 30,
                includeAttachments !== false ? 1 : 0,
                includeAuditLogs !== false ? 1 : 0
            ]);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[DataExport] Update backup config error:', error);
        res.status(500).json({ error: 'Failed to update backup configuration' });
    }
});

/**
 * POST /api/data-export/backup-config/trigger
 * Manually trigger a backup
 */
router.post('/backup-config/trigger', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { organizationId } = req.body;

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        // In production, this would trigger a background job
        // For now, we'll just update the last backup time
        await dbRun(`
            UPDATE backup_configurations 
            SET last_backup_at = datetime('now'), 
                last_backup_status = 'success',
                last_backup_size = ?
            WHERE organization_id = ?
        `, [Math.floor(Math.random() * 100000000), organizationId]);

        res.json({ success: true, message: 'Backup triggered' });
    } catch (error) {
        console.error('[DataExport] Trigger backup error:', error);
        res.status(500).json({ error: 'Failed to trigger backup' });
    }
});

/**
 * GET /api/data-export/backup-history
 * Get backup history
 */
router.get('/backup-history', authMiddleware, async (req, res) => {
    try {
        const { organizationId, limit = 20 } = req.query;
        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const orgId = isSuperAdmin && organizationId ? organizationId : req.user.organizationId;

        // For now, return mock history since we don't have a separate backup_history table
        // In production, this would be a real table
        const config = await dbGet(`SELECT * FROM backup_configurations WHERE organization_id = ?`, [orgId]);

        const history = [];
        if (config?.last_backup_at) {
            history.push({
                id: '1',
                timestamp: config.last_backup_at,
                status: config.last_backup_status,
                size: config.last_backup_size,
                type: 'scheduled'
            });
        }

        res.json({ history });
    } catch (error) {
        console.error('[DataExport] Get backup history error:', error);
        res.status(500).json({ error: 'Failed to get backup history' });
    }
});

// ==========================================
// GDPR
// ==========================================

/**
 * POST /api/data-export/gdpr-request
 * Create GDPR data export request (for end users)
 */
router.post('/gdpr-request', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organizationId;

        // Check for existing pending GDPR request
        const pending = await dbGet(`
            SELECT id FROM data_export_requests 
            WHERE user_id = ? AND export_type = 'gdpr' AND status IN ('pending', 'processing')
        `, [userId]);

        if (pending) {
            return res.status(400).json({ error: 'A GDPR export request is already in progress' });
        }

        const id = uuidv4();
        await dbRun(`
            INSERT INTO data_export_requests (
                id, organization_id, user_id, export_type, status
            ) VALUES (?, ?, ?, 'gdpr', 'pending')
        `, [id, organizationId, userId]);

        res.status(201).json({ 
            success: true, 
            id, 
            message: 'GDPR export request submitted. You will receive an email when your data is ready.' 
        });
    } catch (error) {
        console.error('[DataExport] GDPR request error:', error);
        res.status(500).json({ error: 'Failed to create GDPR request' });
    }
});

export default router;
