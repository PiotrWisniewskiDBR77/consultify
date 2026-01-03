/**
 * Organization Data Management Routes
 * 
 * GDPR-compliant organization data export, retention, and deletion.
 * Features:
 * - Full organization data export
 * - Category-based data export
 * - Data retention policies
 * - Organization deletion requests
 * - Data statistics
 */

import express from 'express';
const router = express.Router();
import requireAuth from '../middleware/authMiddleware.js';
const { requireRole } = require('../middleware/rbac');
import { getDatabase } from '../database/Database.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';
const archiver = require('archiver');

/**
 * Helper: Run promise-based database query
 */
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

/**
 * GET /api/organization-data/stats
 * Get data statistics for organization
 */
router.get('/stats', requireAuth, requireRole(['admin', 'owner', 'super_admin']), async (req, res) => {
    try {
        const organizationId = req.user.organization_id;

        const stats = {
            users: await dbGet('SELECT COUNT(*) as count FROM users WHERE organization_id = ?', [organizationId]),
            projects: await dbGet('SELECT COUNT(*) as count FROM projects WHERE organization_id = ?', [organizationId]),
            tasks: await dbGet('SELECT COUNT(*) as count FROM tasks WHERE organization_id = ?', [organizationId]),
            decisions: await dbGet('SELECT COUNT(*) as count FROM decisions WHERE organization_id = ?', [organizationId]),
            documents: await dbGet('SELECT COUNT(*) as count FROM documents WHERE organization_id = ?', [organizationId]),
            auditLogs: await dbGet('SELECT COUNT(*) as count FROM ai_audit_log WHERE organization_id = ?', [organizationId])
        };

        res.json({
            success: true,
            stats: {
                users: stats.users?.count || 0,
                projects: stats.projects?.count || 0,
                tasks: stats.tasks?.count || 0,
                decisions: stats.decisions?.count || 0,
                documents: stats.documents?.count || 0,
                auditLogs: stats.auditLogs?.count || 0
            }
        });
    } catch (error) {
        console.error('[Org Data] Stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/organization-data/export/:category
 * Export specific category of organization data
 */
router.post('/export/:category', requireAuth, requireRole(['admin', 'owner', 'super_admin']), async (req, res) => {
    try {
        const organizationId = req.user.organization_id;
        const { category } = req.params;

        let data;
        let filename;

        switch (category) {
            case 'users':
                data = await dbAll(`
                    SELECT id, email, first_name, last_name, role, status, created_at, last_login
                    FROM users WHERE organization_id = ?
                `, [organizationId]);
                filename = 'users';
                break;

            case 'projects':
                data = await dbAll(`
                    SELECT id, name, description, status, methodology, start_date, end_date, created_at
                    FROM projects WHERE organization_id = ?
                `, [organizationId]);
                filename = 'projects';
                break;

            case 'tasks':
                data = await dbAll(`
                    SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, t.created_at,
                           p.name as project_name
                    FROM tasks t
                    LEFT JOIN projects p ON t.project_id = p.id
                    WHERE t.organization_id = ?
                `, [organizationId]);
                filename = 'tasks';
                break;

            case 'decisions':
                data = await dbAll(`
                    SELECT id, title, description, status, outcome, decided_at, created_at
                    FROM decisions WHERE organization_id = ?
                `, [organizationId]);
                filename = 'decisions';
                break;

            case 'documents':
                data = await dbAll(`
                    SELECT id, name, file_path, file_type, file_size, created_at
                    FROM documents WHERE organization_id = ?
                `, [organizationId]);
                filename = 'documents';
                break;

            case 'audit':
                data = await dbAll(`
                    SELECT id, timestamp, user_id, action, resource_type, resource_id, 
                           risk_level, flagged, flag_reason
                    FROM ai_audit_log WHERE organization_id = ?
                    ORDER BY timestamp DESC LIMIT 10000
                `, [organizationId]);
                filename = 'audit_logs';
                break;

            default:
                return res.status(400).json({ success: false, error: 'Invalid category' });
        }

        // Add export metadata
        const exportData = {
            exportMetadata: {
                category,
                organizationId,
                exportDate: new Date().toISOString(),
                recordCount: data.length,
                gdprArticle: 'Article 20 - Right to data portability'
            },
            data
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}_${new Date().toISOString().split('T')[0]}.json"`);
        res.json(exportData);

    } catch (error) {
        console.error('[Org Data] Export error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/organization-data/export/all
 * Export all organization data
 */
router.post('/export/all', requireAuth, requireRole(['admin', 'owner', 'super_admin']), async (req, res) => {
    try {
        const organizationId = req.user.organization_id;
        const userId = req.user.id;

        // Collect all data
        const allData = {
            organization: await dbGet('SELECT * FROM organizations WHERE id = ?', [organizationId]),
            users: await dbAll('SELECT id, email, first_name, last_name, role, status, created_at FROM users WHERE organization_id = ?', [organizationId]),
            projects: await dbAll('SELECT * FROM projects WHERE organization_id = ?', [organizationId]),
            tasks: await dbAll('SELECT * FROM tasks WHERE organization_id = ?', [organizationId]),
            decisions: await dbAll('SELECT * FROM decisions WHERE organization_id = ?', [organizationId]),
            initiatives: await dbAll('SELECT * FROM initiatives WHERE organization_id = ?', [organizationId]),
            documents: await dbAll('SELECT id, name, file_path, file_type, file_size, created_at FROM documents WHERE organization_id = ?', [organizationId]),
            teams: await dbAll('SELECT * FROM teams WHERE organization_id = ?', [organizationId]),
            assessments: await dbAll('SELECT * FROM assessments WHERE organization_id = ?', [organizationId]),
            auditLogs: await dbAll('SELECT * FROM ai_audit_log WHERE organization_id = ? ORDER BY timestamp DESC LIMIT 50000', [organizationId])
        };

        // Add metadata
        allData.exportMetadata = {
            organizationId,
            exportDate: new Date().toISOString(),
            exportedBy: userId,
            gdprArticle: 'Article 20 - Right to data portability',
            format: 'JSON',
            sections: Object.keys(allData).filter(k => k !== 'exportMetadata'),
            totalRecords: Object.values(allData)
                .filter(v => Array.isArray(v))
                .reduce((sum, arr) => sum + arr.length, 0)
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="organization_full_export_${new Date().toISOString().split('T')[0]}.json"`);
        res.json(allData);

    } catch (error) {
        console.error('[Org Data] Full export error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/organization-data/retention
 * Get data retention settings
 */
router.get('/retention', requireAuth, requireRole(['admin', 'owner', 'super_admin']), async (req, res) => {
    try {
        const organizationId = req.user.organization_id;

        let retention = await dbGet('SELECT * FROM data_retention_policies WHERE organization_id = ?', [organizationId]);

        if (!retention) {
            // Return defaults
            retention = {
                organization_id: organizationId,
                activity_retention_days: 365,
                audit_log_retention_days: 730,
                chat_history_retention_days: 90,
                document_retention_days: 0,
                auto_delete_enabled: false
            };
        }

        res.json({
            success: true,
            retention: {
                activityRetentionDays: retention.activity_retention_days,
                auditLogRetentionDays: retention.audit_log_retention_days,
                chatHistoryRetentionDays: retention.chat_history_retention_days,
                documentRetentionDays: retention.document_retention_days,
                autoDeleteEnabled: retention.auto_delete_enabled,
                lastCleanupAt: retention.last_cleanup_at
            }
        });
    } catch (error) {
        console.error('[Org Data] Get retention error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/organization-data/retention
 * Update data retention settings
 */
router.put('/retention', requireAuth, requireRole(['admin', 'owner', 'super_admin']), async (req, res) => {
    try {
        const organizationId = req.user.organization_id;
        const {
            activityRetentionDays,
            auditLogRetentionDays,
            chatHistoryRetentionDays,
            documentRetentionDays,
            autoDeleteEnabled
        } = req.body;

        // Check if policy exists
        const existing = await dbGet('SELECT id FROM data_retention_policies WHERE organization_id = ?', [organizationId]);

        if (existing) {
            await dbRun(`
                UPDATE data_retention_policies SET
                    activity_retention_days = ?,
                    audit_log_retention_days = ?,
                    chat_history_retention_days = ?,
                    document_retention_days = ?,
                    auto_delete_enabled = ?,
                    updated_at = datetime('now')
                WHERE organization_id = ?
            `, [
                activityRetentionDays || 365,
                auditLogRetentionDays || 730,
                chatHistoryRetentionDays || 90,
                documentRetentionDays || 0,
                autoDeleteEnabled ? 1 : 0,
                organizationId
            ]);
        } else {
            await dbRun(`
                INSERT INTO data_retention_policies (
                    id, organization_id, activity_retention_days, audit_log_retention_days,
                    chat_history_retention_days, document_retention_days, auto_delete_enabled
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(),
                organizationId,
                activityRetentionDays || 365,
                auditLogRetentionDays || 730,
                chatHistoryRetentionDays || 90,
                documentRetentionDays || 0,
                autoDeleteEnabled ? 1 : 0
            ]);
        }

        res.json({ success: true, message: 'Retention policy updated' });
    } catch (error) {
        console.error('[Org Data] Update retention error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/organization-data/gdpr-request
 * Create a GDPR deletion request
 */
router.post('/gdpr-request', requireAuth, requireRole(['admin', 'owner', 'super_admin']), async (req, res) => {
    try {
        const organizationId = req.user.organization_id;
        const userId = req.user.id;
        const { requestType, targetUserId, targetDataTypes } = req.body;

        const validTypes = ['user_data', 'organization_data', 'specific_data'];
        if (!validTypes.includes(requestType)) {
            return res.status(400).json({ success: false, error: 'Invalid request type' });
        }

        const requestId = uuidv4();

        await dbRun(`
            INSERT INTO gdpr_deletion_requests (
                id, organization_id, requested_by, request_type,
                target_user_id, target_data_types, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `, [
            requestId,
            organizationId,
            userId,
            requestType,
            targetUserId || null,
            targetDataTypes ? JSON.stringify(targetDataTypes) : null
        ]);

        res.json({
            success: true,
            message: 'GDPR deletion request submitted',
            requestId
        });
    } catch (error) {
        console.error('[Org Data] GDPR request error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/organization-data/gdpr-requests
 * List GDPR deletion requests
 */
router.get('/gdpr-requests', requireAuth, requireRole(['admin', 'owner', 'super_admin']), async (req, res) => {
    try {
        const organizationId = req.user.organization_id;

        const requests = await dbAll(`
            SELECT g.*, u.email as requested_by_email, u.first_name, u.last_name
            FROM gdpr_deletion_requests g
            LEFT JOIN users u ON g.requested_by = u.id
            WHERE g.organization_id = ?
            ORDER BY g.created_at DESC
        `, [organizationId]);

        res.json({
            success: true,
            requests: requests.map(r => ({
                id: r.id,
                requestType: r.request_type,
                targetUserId: r.target_user_id,
                targetDataTypes: r.target_data_types ? JSON.parse(r.target_data_types) : null,
                status: r.status,
                requestedBy: r.first_name ? `${r.first_name} ${r.last_name}` : r.requested_by_email,
                rejectionReason: r.rejection_reason,
                completedAt: r.completed_at,
                createdAt: r.created_at
            }))
        });
    } catch (error) {
        console.error('[Org Data] Get GDPR requests error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;







