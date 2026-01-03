// Notification Service - Enterprise-grade notification engine
// Step 5: Execution Control, My Work & Notifications
// Extended: User-Level Notifications & Integrations System

let db = require('../database');
const { v4: uuidv4 } = require('uuid');
let SlackService = require('./slackService');

// User-level services (lazy-loaded to avoid circular deps)
let UserIntegrationService = null;
let UserNotificationPreferencesService = null;
let SlackUserIntegration = null;
let TeamsUserIntegration = null;

const loadUserServices = () => {
    if (!UserIntegrationService) {
        UserIntegrationService = require('./userIntegrationService');
        UserNotificationPreferencesService = require('./userNotificationPreferencesService');
        try {
            SlackUserIntegration = require('./integrations/slackUserIntegration');
            TeamsUserIntegration = require('./integrations/teamsUserIntegration');
        } catch (e) {
            console.log('[NotificationService] User integration services not available');
        }
    }
};

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
    // AI Health Alerts (v2)
    AI_HEALTH_DEGRADED: 'AI_HEALTH_DEGRADED',
    AI_HEALTH_CRITICAL: 'AI_HEALTH_CRITICAL',
    AI_CHAT_UNAVAILABLE: 'AI_CHAT_UNAVAILABLE',
    // Trial lifecycle
    TRIAL_WARNING: 'TRIAL_WARNING',
    TRIAL_EXPIRED: 'TRIAL_EXPIRED',
    TRIAL_UPGRADED: 'TRIAL_UPGRADED',
    // Permission Requests
    PERMISSION_REQUEST_SUBMITTED: 'PERMISSION_REQUEST_SUBMITTED',
    PERMISSION_REQUEST_APPROVED: 'PERMISSION_REQUEST_APPROVED',
    PERMISSION_REQUEST_REJECTED: 'PERMISSION_REQUEST_REJECTED'
};

const SEVERITY = {
    INFO: 'INFO',
    WARNING: 'WARNING',
    CRITICAL: 'CRITICAL'
};

const NotificationService = {
    setTestDependencies: (mocks) => {
        if (mocks.UserIntegrationService !== undefined) UserIntegrationService = mocks.UserIntegrationService;
        if (mocks.UserNotificationPreferencesService !== undefined) UserNotificationPreferencesService = mocks.UserNotificationPreferencesService;
        if (mocks.SlackUserIntegration !== undefined) SlackUserIntegration = mocks.SlackUserIntegration;
        if (mocks.TeamsUserIntegration !== undefined) TeamsUserIntegration = mocks.TeamsUserIntegration;
        if (mocks.SlackService !== undefined) SlackService = mocks.SlackService;
        if (mocks.db) db = mocks.db;
    },
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
            // Insert full notification record
            const sql = `INSERT INTO notifications 
                (id, user_id, organization_id, project_id, type, severity, title, message, related_object_type, related_object_id, is_actionable, action_url, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            db.run(sql, [
                id, userId, organizationId, projectId, type, severity || 'INFO',
                title, message, relatedObjectType, relatedObjectId,
                isActionable ? 1 : 0, actionUrl, expiresAt
            ], function (err) {
                if (err) {
                    console.error('[NotificationService] Create failed:', err.message);
                    return reject(err);
                }

                // --- SLACK INTEGRATION TRIGGERS ---
                if (type === 'SYSTEM_ALERT') {
                    SlackService.sendSystemAlert(title, message, severity || 'CRITICAL');
                } else if (type === 'CLIENT_TICKET') {
                    SlackService.sendClientTicket(title, message, 'Consultify Client');
                } else if (type === 'USER_FEEDBACK') {
                    // Feedback usually comes via dedicated feedback endpoint, but if feedback generates a notification,
                    // we can trigger here too. However, feedbackService typically handles the main alert.
                    // keeping here as backup or for manual feedback notifications.
                    SlackService.sendNewFeedbackAlert({ type: 'FEEDBACK', userEmail: userId, message });
                }

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
        }),

    // ==========================================
    // USER-LEVEL NOTIFICATION DELIVERY (V2)
    // ==========================================

    /**
     * Deliver notification through user's preferred channels
     * This is the main entry point for the V2 user-level notification system
     */
    deliverNotification: async (userId, notification) => {
        loadUserServices();

        if (!UserNotificationPreferencesService || !UserIntegrationService) {
            // Fall back to legacy behavior
            return NotificationService.create({
                userId,
                ...notification
            });
        }

        const results = {
            channels: [],
            queued: false,
            delivered: false
        };

        try {
            // 1. Check if user should receive notification
            const shouldNotify = await UserNotificationPreferencesService.shouldNotify(
                userId, notification.type, notification.severity
            );

            if (!shouldNotify) {
                // Check if in quiet hours
                const inQuietHours = await UserNotificationPreferencesService.isInQuietHours(userId);
                if (inQuietHours) {
                    results.queued = true;
                    results.reason = 'quiet_hours';
                    // Could queue for later delivery here
                    return results;
                }
                return { delivered: false, reason: 'disabled' };
            }

            // 2. Get channels for this notification type
            const channels = await UserNotificationPreferencesService.getChannelsForNotificationType(
                userId, notification.type
            );

            if (channels.length === 0) {
                return { delivered: false, reason: 'no_channels' };
            }

            // 3. Deliver to each channel
            for (const channel of channels) {
                try {
                    const channelResult = await NotificationService._deliverToChannel(
                        userId, channel, notification
                    );
                    results.channels.push({ channel, ...channelResult });
                } catch (channelError) {
                    console.error(`[NotificationService] Channel ${channel} delivery failed:`, channelError);
                    results.channels.push({
                        channel,
                        success: false,
                        error: channelError.message
                    });
                }
            }

            results.delivered = results.channels.some(c => c.success);

        } catch (error) {
            console.error('[NotificationService] deliverNotification error:', error);
            results.error = error.message;
        }

        return results;
    },

    /**
     * Deliver to a specific channel
     */
    _deliverToChannel: async (userId, channel, notification) => {
        loadUserServices();

        switch (channel) {
            case 'in_app':
                // Create in-app notification
                const created = await NotificationService.create({
                    userId,
                    organizationId: notification.organizationId,
                    projectId: notification.projectId,
                    type: notification.type,
                    severity: notification.severity,
                    title: notification.title,
                    message: notification.message,
                    relatedObjectType: notification.relatedObjectType,
                    relatedObjectId: notification.relatedObjectId,
                    isActionable: notification.isActionable,
                    actionUrl: notification.actionUrl
                });
                return { success: !!created, notificationId: created?.id };

            case 'email':
                // Email notification - would integrate with emailService
                // For now, just log
                console.log(`[NotificationService] Email notification for user ${userId}:`, notification.title);
                return { success: true, method: 'email' };

            case 'push':
                // Push notification - would integrate with push service
                console.log(`[NotificationService] Push notification for user ${userId}:`, notification.title);
                return { success: true, method: 'push' };

            case 'slack':
                // Slack via user integration
                if (SlackUserIntegration) {
                    try {
                        await SlackUserIntegration.sendNotification(userId, notification);
                        return { success: true, method: 'slack_user' };
                    } catch (error) {
                        console.error('[NotificationService] Slack delivery failed:', error);
                        return { success: false, error: error.message };
                    }
                }
                return { success: false, error: 'Slack integration not available' };

            case 'teams':
                // Teams via user integration
                if (TeamsUserIntegration) {
                    try {
                        await TeamsUserIntegration.sendNotification(userId, notification);
                        return { success: true, method: 'teams_user' };
                    } catch (error) {
                        console.error('[NotificationService] Teams delivery failed:', error);
                        return { success: false, error: error.message };
                    }
                }
                return { success: false, error: 'Teams integration not available' };

            default:
                console.warn(`[NotificationService] Unknown channel: ${channel}`);
                return { success: false, error: 'Unknown channel' };
        }
    },

    /**
     * Notify all watchers of an object
     */
    notifyWatchers: async (objectType, objectId, notification) => {
        loadUserServices();

        if (!UserNotificationPreferencesService) {
            console.log('[NotificationService] User services not available for watcher notifications');
            return { notified: 0 };
        }

        try {
            const watchers = await UserNotificationPreferencesService.getWatchersForObject(objectType, objectId);
            const results = [];

            for (const watcher of watchers) {
                // Check if watcher wants this type of notification
                if (watcher.notify_on === 'mentions' && notification.type !== 'MENTION') {
                    continue;
                }
                if (watcher.notify_on === 'status_changes' && !notification.type.includes('STATUS')) {
                    continue;
                }

                const result = await NotificationService.deliverNotification(
                    watcher.user_id,
                    {
                        ...notification,
                        relatedObjectType: objectType,
                        relatedObjectId: objectId
                    }
                );
                results.push({ userId: watcher.user_id, ...result });
            }

            return { notified: results.filter(r => r.delivered).length, results };
        } catch (error) {
            console.error('[NotificationService] notifyWatchers error:', error);
            return { notified: 0, error: error.message };
        }
    },

    /**
     * Send due date reminder
     */
    sendDueReminder: async (userId, organizationId, taskId, taskTitle, reminderType, dueDate) => {
        loadUserServices();

        if (!UserNotificationPreferencesService) {
            return { sent: false, reason: 'services_not_available' };
        }

        try {
            // Check if reminder already sent
            const alreadySent = await UserNotificationPreferencesService.wasReminderSent(
                userId, taskId, reminderType
            );

            if (alreadySent) {
                return { sent: false, reason: 'already_sent' };
            }

            // Get user's reminder preferences
            const reminderSettings = await UserNotificationPreferencesService.getDueReminderSettings(userId);

            if (!reminderSettings[reminderType]) {
                return { sent: false, reason: 'reminder_disabled' };
            }

            // Build reminder notification
            const reminderLabels = {
                '1_week': '1 week',
                '3_days': '3 days',
                '1_day': 'tomorrow',
                '1_hour': '1 hour',
                'at_due': 'now'
            };

            const notification = {
                type: 'TASK_DUE_SOON',
                severity: reminderType === '1_hour' || reminderType === 'at_due' ? 'WARNING' : 'INFO',
                title: `Task Due ${reminderLabels[reminderType]}`,
                message: `"${taskTitle}" is due ${reminderLabels[reminderType]}${dueDate ? ` (${new Date(dueDate).toLocaleString()})` : ''}`,
                organizationId: organizationId, // Added
                relatedObjectType: 'TASK',
                relatedObjectId: taskId,
                isActionable: true,
                actionUrl: `/tasks/${taskId}`
            };

            // Deliver notification
            const result = await NotificationService.deliverNotification(userId, notification);

            // Mark reminder as sent
            if (result.delivered) {
                await UserNotificationPreferencesService.markReminderSent(userId, taskId, reminderType);
            }

            return { sent: result.delivered, ...result };
        } catch (error) {
            console.error('[NotificationService] sendDueReminder error:', error);
            return { sent: false, error: error.message };
        }
    },

    /**
     * Get user's notification preferences summary
     */
    getUserPreferencesSummary: async (userId) => {
        loadUserServices();

        if (!UserNotificationPreferencesService || !UserIntegrationService) {
            return null;
        }

        try {
            const prefs = await UserNotificationPreferencesService.getPreferences(userId);
            const integrations = await UserIntegrationService.getUserIntegrations(userId);
            const watchers = await UserNotificationPreferencesService.getWatchedObjects(userId);

            return {
                globalEnabled: prefs.globalEnabled,
                quietHoursEnabled: prefs.schedule.quietHoursEnabled,
                connectedChannels: integrations.filter(i => i.status === 'active').map(i => i.provider),
                watchingCount: watchers.length,
                digestsEnabled: prefs.digests.dailyEnabled || prefs.digests.weeklyEnabled
            };
        } catch (error) {
            console.error('[NotificationService] getUserPreferencesSummary error:', error);
            return null;
        }
    }
};

module.exports = NotificationService;
