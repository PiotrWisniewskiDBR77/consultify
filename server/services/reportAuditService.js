/**
 * Report Audit Service
 * 
 * Immutable audit trail for all Management Report actions.
 * Provides full traceability for compliance and governance.
 * 
 * PMO Standards:
 * - ISO 21500: Audit and compliance requirements
 * - PRINCE2: Audit trail requirements
 * - PMBOK 7: Governance and transparency
 */

import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';



// Audit action types
const AUDIT_ACTIONS = {
    CREATED: 'CREATED',
    UPDATED: 'UPDATED',
    VERSION_CREATED: 'VERSION_CREATED',
    SUBMITTED_FOR_APPROVAL: 'SUBMITTED_FOR_APPROVAL',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    FINALIZED: 'FINALIZED',
    UNLOCKED: 'UNLOCKED',
    SHARED: 'SHARED',
    SHARE_VIEWED: 'SHARE_VIEWED',
    EXPORTED_PDF: 'EXPORTED_PDF',
    EXPORTED_PPTX: 'EXPORTED_PPTX',
    COMMENT_ADDED: 'COMMENT_ADDED',
    COMMENT_RESOLVED: 'COMMENT_RESOLVED',
    COMMENT_DELETED: 'COMMENT_DELETED',
    SCHEDULE_CREATED: 'SCHEDULE_CREATED',
    EMAIL_SENT: 'EMAIL_SENT'
};

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

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

const ReportAuditService = {
    AUDIT_ACTIONS,

    /**
     * Log an audit event
     * 
     * @param {string} reportId - Report ID
     * @param {string} action - Action type (from AUDIT_ACTIONS)
     * @param {string} actorId - User performing action
     * @param {Object} details - Action-specific details
     * @param {Object} req - Express request (optional, for IP/UA)
     * @returns {Promise<Object>} Created audit entry
     */
    log: async (reportId, action, actorId, details = {}, req = null) => {
        const id = uuidv4();

        // Get actor info
        let actorName = null;
        let actorEmail = null;
        if (actorId) {
            const user = await dbGet(
                'SELECT first_name, last_name, email FROM users WHERE id = ?',
                [actorId]
            );
            if (user) {
                actorName = user.first_name && user.last_name 
                    ? `${user.first_name} ${user.last_name}` 
                    : user.email;
                actorEmail = user.email;
            }
        }

        // Extract IP and User Agent from request
        let ipAddress = null;
        let userAgent = null;
        if (req) {
            ipAddress = req.ip || 
                req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || 
                req.connection?.remoteAddress;
            userAgent = req.headers?.['user-agent'];
        }

        // Get version ID if exists
        let versionId = details.versionId || null;
        if (!versionId) {
            const version = await dbGet(
                'SELECT id FROM management_report_versions WHERE report_id = ? ORDER BY version_number DESC LIMIT 1',
                [reportId]
            );
            versionId = version?.id || null;
        }

        await dbRun(`
            INSERT INTO management_report_audit_log 
            (id, report_id, version_id, action, actor_id, actor_name, actor_email, details, ip_address, user_agent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            id,
            reportId,
            versionId,
            action,
            actorId,
            actorName,
            actorEmail,
            JSON.stringify(details),
            ipAddress,
            userAgent
        ]);

        // Also log to global activity_logs if available
        try {
            const report = await dbGet('SELECT organization_id, project_id, title FROM management_reports WHERE id = ?', [reportId]);
            if (report) {
                await dbRun(`
                    INSERT INTO activity_logs 
                    (id, organization_id, project_id, user_id, action, entity_type, entity_id, entity_name, details, created_at)
                    VALUES (?, ?, ?, ?, ?, 'MANAGEMENT_REPORT', ?, ?, ?, CURRENT_TIMESTAMP)
                `, [
                    uuidv4(),
                    report.organization_id,
                    report.project_id,
                    actorId,
                    `report.${action.toLowerCase()}`,
                    reportId,
                    report.title,
                    JSON.stringify({ action, ...details })
                ]);
            }
        } catch (e) {
            // Global activity log is optional, don't fail if table doesn't exist
            console.warn('[ReportAuditService] Failed to log to global activity_logs:', e.message);
        }

        return {
            id,
            reportId,
            versionId,
            action,
            actorId,
            actorName,
            actorEmail,
            details,
            ipAddress,
            createdAt: new Date().toISOString()
        };
    },

    /**
     * Get audit log for a report
     * 
     * @param {string} reportId - Report ID
     * @param {Object} filters - Filter options
     * @returns {Promise<Object>} Audit log entries
     */
    getAuditLog: async (reportId, filters = {}) => {
        const {
            actions,
            actorId,
            fromDate,
            toDate,
            limit = 100,
            offset = 0
        } = filters;

        let query = `
            SELECT * FROM management_report_audit_log
            WHERE report_id = ?
        `;
        const params = [reportId];

        if (actions && actions.length > 0) {
            query += ` AND action IN (${actions.map(() => '?').join(',')})`;
            params.push(...actions);
        }

        if (actorId) {
            query += ' AND actor_id = ?';
            params.push(actorId);
        }

        if (fromDate) {
            query += ' AND created_at >= ?';
            params.push(fromDate);
        }

        if (toDate) {
            query += ' AND created_at <= ?';
            params.push(toDate);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const entries = await dbAll(query, params);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total FROM management_report_audit_log
            WHERE report_id = ?
        `;
        const countParams = [reportId];

        if (actions && actions.length > 0) {
            countQuery += ` AND action IN (${actions.map(() => '?').join(',')})`;
            countParams.push(...actions);
        }
        if (actorId) {
            countQuery += ' AND actor_id = ?';
            countParams.push(actorId);
        }
        if (fromDate) {
            countQuery += ' AND created_at >= ?';
            countParams.push(fromDate);
        }
        if (toDate) {
            countQuery += ' AND created_at <= ?';
            countParams.push(toDate);
        }

        const countResult = await dbGet(countQuery, countParams);

        return {
            entries: entries.map(e => ({
                id: e.id,
                reportId: e.report_id,
                versionId: e.version_id,
                action: e.action,
                actorId: e.actor_id,
                actorName: e.actor_name,
                actorEmail: e.actor_email,
                details: e.details ? JSON.parse(e.details) : {},
                ipAddress: e.ip_address,
                userAgent: e.user_agent,
                createdAt: e.created_at
            })),
            total: countResult?.total || 0,
            limit,
            offset
        };
    },

    /**
     * Export audit log
     * 
     * @param {string} reportId - Report ID
     * @param {string} format - 'json' or 'csv'
     * @param {Object} filters - Filter options
     * @returns {Promise<string|Object>} Exported data
     */
    exportAuditLog: async (reportId, format = 'json', filters = {}) => {
        const { entries } = await ReportAuditService.getAuditLog(reportId, {
            ...filters,
            limit: 10000 // Max export limit
        });

        if (format === 'csv') {
            const headers = [
                'ID', 'Report ID', 'Version ID', 'Action', 
                'Actor ID', 'Actor Name', 'Actor Email',
                'Details', 'IP Address', 'User Agent', 'Created At'
            ];

            const rows = entries.map(e => [
                e.id,
                e.reportId,
                e.versionId || '',
                e.action,
                e.actorId,
                e.actorName || '',
                e.actorEmail || '',
                JSON.stringify(e.details),
                e.ipAddress || '',
                e.userAgent || '',
                e.createdAt
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            return csvContent;
        }

        return {
            reportId,
            exportedAt: new Date().toISOString(),
            totalEntries: entries.length,
            entries
        };
    },

    /**
     * Get activity summary for a report
     * 
     * @param {string} reportId - Report ID
     * @returns {Promise<Object>} Activity summary
     */
    getActivitySummary: async (reportId) => {
        // Get action counts
        const actionCounts = await dbAll(`
            SELECT action, COUNT(*) as count 
            FROM management_report_audit_log 
            WHERE report_id = ?
            GROUP BY action
        `, [reportId]);

        // Get unique actors
        const actors = await dbAll(`
            SELECT DISTINCT actor_id, actor_name, actor_email
            FROM management_report_audit_log 
            WHERE report_id = ?
        `, [reportId]);

        // Get first and last activity
        const timeline = await dbGet(`
            SELECT 
                MIN(created_at) as first_activity,
                MAX(created_at) as last_activity,
                COUNT(*) as total_actions
            FROM management_report_audit_log 
            WHERE report_id = ?
        `, [reportId]);

        // Get recent activity (last 10)
        const recentActivity = await dbAll(`
            SELECT action, actor_name, created_at
            FROM management_report_audit_log 
            WHERE report_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        `, [reportId]);

        // Calculate activity by day (last 30 days)
        const activityByDay = await dbAll(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM management_report_audit_log 
            WHERE report_id = ? 
              AND created_at >= DATE('now', '-30 days')
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `, [reportId]);

        return {
            reportId,
            totalActions: timeline?.total_actions || 0,
            firstActivity: timeline?.first_activity,
            lastActivity: timeline?.last_activity,
            actionBreakdown: actionCounts.reduce((acc, { action, count }) => {
                acc[action] = count;
                return acc;
            }, {}),
            uniqueActors: actors.length,
            actors: actors.map(a => ({
                id: a.actor_id,
                name: a.actor_name,
                email: a.actor_email
            })),
            recentActivity: recentActivity.map(a => ({
                action: a.action,
                actorName: a.actor_name,
                createdAt: a.created_at
            })),
            activityByDay
        };
    },

    /**
     * Get audit log for share link access
     * Tracks who viewed shared reports
     * 
     * @param {string} reportId - Report ID
     * @returns {Promise<Array>} Share view entries
     */
    getShareViewLog: async (reportId) => {
        const entries = await dbAll(`
            SELECT * FROM management_report_audit_log
            WHERE report_id = ? AND action = 'SHARE_VIEWED'
            ORDER BY created_at DESC
        `, [reportId]);

        return entries.map(e => ({
            id: e.id,
            viewedAt: e.created_at,
            ipAddress: e.ip_address,
            userAgent: e.user_agent,
            details: e.details ? JSON.parse(e.details) : {}
        }));
    },

    /**
     * Log a share link view
     * For tracking anonymous/external access
     * 
     * @param {string} reportId - Report ID
     * @param {string} shareToken - Share token used
     * @param {Object} req - Express request
     * @returns {Promise<Object>} Audit entry
     */
    logShareView: async (reportId, shareToken, req) => {
        // Update recipients view tracking
        await dbRun(`
            UPDATE management_report_recipients 
            SET 
                view_count = view_count + 1,
                viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP),
                last_viewed_at = CURRENT_TIMESTAMP
            WHERE report_id = ? AND share_token = ?
        `, [reportId, shareToken]);

        // Log audit entry (actor is null for external views)
        return ReportAuditService.log(
            reportId,
            AUDIT_ACTIONS.SHARE_VIEWED,
            null,
            { shareToken },
            req
        );
    },

    /**
     * Search audit logs across reports
     * For organization-wide audit queries
     * 
     * @param {string} orgId - Organization ID
     * @param {Object} filters - Search filters
     * @returns {Promise<Object>} Search results
     */
    searchAuditLogs: async (orgId, filters = {}) => {
        const {
            actions,
            actorId,
            reportType,
            fromDate,
            toDate,
            limit = 100,
            offset = 0
        } = filters;

        let query = `
            SELECT mral.*, mr.title as report_title, mr.report_type
            FROM management_report_audit_log mral
            JOIN management_reports mr ON mral.report_id = mr.id
            WHERE mr.organization_id = ?
        `;
        const params = [orgId];

        if (actions && actions.length > 0) {
            query += ` AND mral.action IN (${actions.map(() => '?').join(',')})`;
            params.push(...actions);
        }
        if (actorId) {
            query += ' AND mral.actor_id = ?';
            params.push(actorId);
        }
        if (reportType) {
            query += ' AND mr.report_type = ?';
            params.push(reportType);
        }
        if (fromDate) {
            query += ' AND mral.created_at >= ?';
            params.push(fromDate);
        }
        if (toDate) {
            query += ' AND mral.created_at <= ?';
            params.push(toDate);
        }

        query += ' ORDER BY mral.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const entries = await dbAll(query, params);

        return {
            entries: entries.map(e => ({
                id: e.id,
                reportId: e.report_id,
                reportTitle: e.report_title,
                reportType: e.report_type,
                action: e.action,
                actorId: e.actor_id,
                actorName: e.actor_name,
                details: e.details ? JSON.parse(e.details) : {},
                createdAt: e.created_at
            })),
            limit,
            offset
        };
    }
};

export default ReportAuditService;









