// Notification Service - Enterprise-grade notification engine
// Step 5: Execution Control, My Work & Notifications

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const NOTIFICATION_TYPES = {
    // Execution
    TASK_ASSIGNED: 'TASK_ASSIGNED',
    TASK_OVERDUE: 'TASK_OVERDUE',
    TASK_BLOCKED: 'TASK_BLOCKED',
    TASK_ESCALATED: 'TASK_ESCALATED',
    TASK_SLA_WARNING: 'TASK_SLA_WARNING',
    INITIATIVE_STARTED: 'INITIATIVE_STARTED',
    INITIATIVE_STALLED: 'INITIATIVE_STALLED',
    INITIATIVE_COMPLETED: 'INITIATIVE_COMPLETED',
    // Governance
    DECISION_REQUIRED: 'DECISION_REQUIRED',
    DECISION_OVERDUE: 'DECISION_OVERDUE',
    CHANGE_REQUEST_SUBMITTED: 'CHANGE_REQUEST_SUBMITTED',
    CHANGE_REQUEST_DECIDED: 'CHANGE_REQUEST_DECIDED',
    GATE_PENDING_APPROVAL: 'GATE_PENDING_APPROVAL',
    // AI
    AI_RISK_DETECTED: 'AI_RISK_DETECTED',
    AI_OVERLOAD_DETECTED: 'AI_OVERLOAD_DETECTED',
    AI_DEPENDENCY_CONFLICT: 'AI_DEPENDENCY_CONFLICT',
    AI_RECOMMENDATION: 'AI_RECOMMENDATION',
    // Trial lifecycle
    TRIAL_WARNING: 'TRIAL_WARNING',
    TRIAL_EXPIRED: 'TRIAL_EXPIRED',
    TRIAL_UPGRADED: 'TRIAL_UPGRADED'
};

const SEVERITY = {
    INFO: 'INFO',
    WARNING: 'WARNING',
    CRITICAL: 'CRITICAL'
};

const NotificationService = {
    NOTIFICATION_TYPES,
    SEVERITY,

    /**
     * Create a notification
     */
    create: async (notification) => {
        const {
            userId, organizationId, projectId, type, severity,
            title, message, relatedObjectType, relatedObjectId,
            isActionable, actionUrl, expiresAt
        } = notification;

        // Check user settings for muting
        const shouldMute = await NotificationService._checkMuteSettings(userId, type, severity);
        if (shouldMute) return null;

        // Deduplicate - don't create if identical notification exists in last hour (org-scoped)
        const isDupe = await NotificationService._checkDuplicate(userId, organizationId, type, relatedObjectId);
        if (isDupe) return null;

        const id = uuidv4();

        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO notifications 
                (id, user_id, organization_id, project_id, type, severity, title, message,
                 related_object_type, related_object_id, is_actionable, action_url, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            db.run(sql, [
                id, userId, organizationId, projectId, type, severity || 'INFO',
                title, message, relatedObjectType, relatedObjectId,
                isActionable ? 1 : 0, actionUrl, expiresAt
            ], function (err) {
                if (err) return reject(err);
                resolve({ id, type, severity, title });
            });
        });
    },

    /**
     * Get notifications for a user
     * Returns notifications with mapped fields for frontend compatibility
     */
    getForUser: async (userId, options = {}) => {
        const { unreadOnly, limit, projectId } = options;

        let sql = `SELECT 
            n.id, n.user_id, n.organization_id, n.project_id,
            n.type, n.title, n.message, n.priority, n.severity,
            n.related_object_type, n.related_object_id,
            n.is_read, n.is_actionable, n.action_url, n.created_at, n.read_at,
            p.name as project_name
            FROM notifications n
            LEFT JOIN projects p ON n.project_id = p.id
            WHERE n.user_id = ?`;
        const params = [userId];

        if (unreadOnly) {
            sql += ` AND n.is_read = 0`;
        }

        if (projectId) {
            sql += ` AND n.project_id = ?`;
            params.push(projectId);
        }

        sql += ` ORDER BY n.created_at DESC`;

        if (limit) {
            sql += ` LIMIT ?`;
            params.push(limit);
        }

        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                // Transform to frontend-compatible format
                const transformed = (rows || []).map(row => {
                    // Determine severity: use actual severity if exists, else map from priority
                    let severity = row.severity;
                    if (!severity) {
                        severity = row.priority === 'urgent' ? 'CRITICAL' 
                                : row.priority === 'high' ? 'WARNING' 
                                : 'INFO';
                    }
                    
                    return {
                        id: row.id,
                        userId: row.user_id,
                        organizationId: row.organization_id,
                        projectId: row.project_id,
                        projectName: row.project_name,
                        type: row.type,
                        title: row.title,
                        message: row.message,
                        severity,
                        isRead: !!row.is_read,
                        read: !!row.is_read, // For backwards compatibility
                        readAt: row.read_at,
                        createdAt: row.created_at,
                        relatedObjectType: row.related_object_type,
                        relatedObjectId: row.related_object_id,
                        isActionable: !!row.is_actionable,
                        actionUrl: row.action_url,
                        // Determine scope based on data
                        scope: row.project_id ? 'PROJECT' : 'PERSONAL'
                    };
                });
                resolve(transformed);
            });
        });
    },

    /**
     * Mark notification as read
     */
    markRead: async (notificationId, userId) => {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP 
                    WHERE id = ? AND user_id = ?`, [notificationId, userId], function (err) {
                if (err) return reject(err);
                resolve({ updated: this.changes > 0 });
            });
        });
    },

    /**
     * Mark all as read for a user
     */
    markAllRead: async (userId) => {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP 
                    WHERE user_id = ? AND is_read = 0`, [userId], function (err) {
                if (err) return reject(err);
                resolve({ updated: this.changes });
            });
        });
    },

    /**
     * Delete a notification
     */
    delete: async (notificationId, userId) => {
        return new Promise((resolve, reject) => {
            db.run(`DELETE FROM notifications WHERE id = ? AND user_id = ?`,
                [notificationId, userId], function (err) {
                    if (err) return reject(err);
                    resolve({ deleted: this.changes > 0 });
                });
        });
    },

    /**
     * Get notification counts
     */
    getCounts: async (userId) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
                SUM(CASE WHEN severity = 'CRITICAL' AND is_read = 0 THEN 1 ELSE 0 END) as critical
            FROM notifications WHERE user_id = ?`, [userId], (err, row) => {
                if (err) return reject(err);
                resolve({
                    total: row?.total || 0,
                    unread: row?.unread || 0,
                    critical: row?.critical || 0
                });
            });
        });
    },

    /**
     * Check if notification should be muted
     */
    _checkMuteSettings: async (userId, type, severity) => {
        return new Promise((resolve) => {
            db.get(`SELECT * FROM user_notification_settings WHERE user_id = ?`, [userId], (err, settings) => {
                if (err || !settings) return resolve(false);

                if (severity === 'INFO' && settings.mute_info) return resolve(true);
                if (severity === 'WARNING' && settings.mute_warning) return resolve(true);
                if (severity === 'CRITICAL' && settings.mute_critical) return resolve(true);

                try {
                    const mutedTypes = JSON.parse(settings.muted_types || '[]');
                    if (mutedTypes.includes(type)) return resolve(true);
                } catch { }

                resolve(false);
            });
        });
    },

    /**
     * Check for duplicate notification (org-scoped for multi-tenant safety)
     */
    _checkDuplicate: async (userId, organizationId, type, relatedObjectId) => {
        if (!relatedObjectId) return false;

        return new Promise((resolve) => {
            db.get(`SELECT id FROM notifications 
                    WHERE user_id = ? AND organization_id = ? AND type = ? AND related_object_id = ? 
                    AND created_at > datetime('now', '-1 hour')`,
                [userId, organizationId, type, relatedObjectId], (err, row) => {
                    resolve(!!row);
                });
        });
    },

    // Convenience methods for common notifications
    notifyTaskAssigned: (userId, orgId, projectId, taskId, taskTitle) =>
        NotificationService.create({
            userId, organizationId: orgId, projectId,
            type: NOTIFICATION_TYPES.TASK_ASSIGNED,
            severity: SEVERITY.INFO,
            title: 'Task Assigned',
            message: `You have been assigned: ${taskTitle}`,
            relatedObjectType: 'TASK',
            relatedObjectId: taskId,
            isActionable: true,
            actionUrl: `/tasks/${taskId}`
        }),

    notifyDecisionRequired: (userId, orgId, projectId, decisionId, title) =>
        NotificationService.create({
            userId, organizationId: orgId, projectId,
            type: NOTIFICATION_TYPES.DECISION_REQUIRED,
            severity: SEVERITY.WARNING,
            title: 'Decision Required',
            message: `Your decision is needed: ${title}`,
            relatedObjectType: 'DECISION',
            relatedObjectId: decisionId,
            isActionable: true,
            actionUrl: `/decisions/${decisionId}`
        }),

    notifyAIRisk: (userId, orgId, projectId, riskMessage) =>
        NotificationService.create({
            userId, organizationId: orgId, projectId,
            type: NOTIFICATION_TYPES.AI_RISK_DETECTED,
            severity: SEVERITY.WARNING,
            title: 'Risk Detected',
            message: riskMessage,
            isActionable: false
        })
};

module.exports = NotificationService;
