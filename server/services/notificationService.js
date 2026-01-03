import BaseService from './BaseService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Notification Service - Enterprise-grade notification engine
 */
class NotificationService extends BaseService {
    constructor() {
        super();
        this.NOTIFICATION_TYPES = {
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
        this.SEVERITY = {
            INFO: 'INFO',
            WARNING: 'WARNING',
            CRITICAL: 'CRITICAL'
        };
        this._slackService = null;
        this._userIntegrationService = null;
        this._userNotificationPreferencesService = null;
        this._slackUserIntegration = null;
        this._teamsUserIntegration = null;
    }

    /**
     * Initialize service dependencies
     */
    async init() {
        await super.init();
        if (!this._slackService) {
            const { default: slackService } = await import('./slackService.js');
            this._slackService = slackService;
        }
        if (!this._userIntegrationService) {
            const { default: service } = await import('./userIntegrationService.js');
            this._userIntegrationService = service;
        }
        if (!this._userNotificationPreferencesService) {
            const { default: service } = await import('./userNotificationPreferencesService.js');
            this._userNotificationPreferencesService = service;
        }
        if (!this._slackUserIntegration) {
            try {
                const { default: integration } = await import('./integrations/slackUserIntegration.js');
                this._slackUserIntegration = integration;
            } catch (e) {
                console.log('[NotificationService] Slack user integration not available');
            }
        }
        if (!this._teamsUserIntegration) {
            try {
                const { default: integration } = await import('./integrations/teamsUserIntegration.js');
                this._teamsUserIntegration = integration;
            } catch (e) {
                console.log('[NotificationService] Teams user integration not available');
            }
        }
        return this;
    }

    /**
     * Set dependencies manually (for testing)
     */
    setDependencies(customDeps) {
        super.setDependencies(customDeps);
        if (customDeps.slackService) this._slackService = customDeps.slackService;
        if (customDeps.userIntegrationService) this._userIntegrationService = customDeps.userIntegrationService;
        if (customDeps.userNotificationPreferencesService) this._userNotificationPreferencesService = customDeps.userNotificationPreferencesService;
        if (customDeps.slackUserIntegration) this._slackUserIntegration = customDeps.slackUserIntegration;
        if (customDeps.teamsUserIntegration) this._teamsUserIntegration = customDeps.teamsUserIntegration;
    }

    /**
     * Create a notification
     */
    async create(notification) {
        await this.init();
        const {
            userId, organizationId, projectId, type, severity,
            title, message, relatedObjectType, relatedObjectId,
            isActionable, actionUrl, expiresAt
        } = notification;

        // Check user settings for muting
        const shouldMute = await this._checkMuteSettings(userId, type, severity);
        if (shouldMute) return null;

        // Deduplicate - don't create if identical notification exists in last hour (org-scoped)
        const isDupe = await this._checkDuplicate(userId, organizationId, type, relatedObjectId);
        if (isDupe) return null;

        const id = uuidv4();
        const now = new Date().toISOString();

        await this.queryRun(
            `INSERT INTO notifications 
            (id, user_id, organization_id, project_id, type, severity, title, message, related_object_type, related_object_id, is_actionable, action_url, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, userId, organizationId, projectId, type, severity || 'INFO',
                title, message, relatedObjectType, relatedObjectId,
                isActionable ? 1 : 0, actionUrl, expiresAt
            ]
        );

        // --- SLACK INTEGRATION TRIGGERS ---
        if (type === 'SYSTEM_ALERT' && this._slackService) {
            this._slackService.sendSystemAlert(title, message, severity || 'CRITICAL');
        } else if (type === 'CLIENT_TICKET' && this._slackService) {
            this._slackService.sendClientTicket(title, message, 'Consultify Client');
        } else if (type === 'USER_FEEDBACK' && this._slackService) {
            this._slackService.sendNewFeedbackAlert({ type: 'FEEDBACK', userEmail: userId, message });
        }

        return { id, type, severity, title };
    }

    /**
     * Get notifications for a user
     */
    async getForUser(userId, options = {}) {
        await this.init();
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

        const rows = await this.queryAll(sql, params);

        return (rows || []).map(row => {
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
                read: !!row.is_read,
                readAt: row.read_at,
                createdAt: row.created_at,
                relatedObjectType: row.related_object_type,
                relatedObjectId: row.related_object_id,
                isActionable: !!row.is_actionable,
                actionUrl: row.action_url,
                scope: row.project_id ? 'PROJECT' : 'PERSONAL'
            };
        });
    }

    /**
     * Mark notification as read
     */
    async markRead(notificationId, userId) {
        await this.init();
        const result = await this.queryRun(
            `UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP 
             WHERE id = ? AND user_id = ?`,
            [notificationId, userId]
        );
        return { updated: result.changes > 0 };
    }

    /**
     * Mark all as read for a user
     */
    async markAllRead(userId) {
        await this.init();
        const result = await this.queryRun(
            `UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP 
             WHERE user_id = ? AND is_read = 0`,
            [userId]
        );
        return { updated: result.changes };
    }

    /**
     * Delete a notification
     */
    async delete(notificationId, userId) {
        await this.init();
        const result = await this.queryRun(
            `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
            [notificationId, userId]
        );
        return { deleted: result.changes > 0 };
    }

    /**
     * Get notification counts
     */
    async getCounts(userId) {
        await this.init();
        const row = await this.queryOne(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
                SUM(CASE WHEN severity = 'CRITICAL' AND is_read = 0 THEN 1 ELSE 0 END) as critical
            FROM notifications WHERE user_id = ?`,
            [userId]
        );

        return {
            total: row?.total || 0,
            unread: row?.unread || 0,
            critical: row?.critical || 0
        };
    }

    /**
     * Check if notification should be muted
     */
    async _checkMuteSettings(userId, type, severity) {
        const settings = await this.queryOne(
            `SELECT * FROM user_notification_settings WHERE user_id = ?`,
            [userId]
        );
        if (!settings) return false;

        if (severity === 'INFO' && settings.mute_info) return true;
        if (severity === 'WARNING' && settings.mute_warning) return true;
        if (severity === 'CRITICAL' && settings.mute_critical) return true;

        try {
            const mutedTypes = JSON.parse(settings.muted_types || '[]');
            if (mutedTypes.includes(type)) return true;
        } catch { }

        return false;
    }

    /**
     * Check for duplicate notification
     */
    async _checkDuplicate(userId, organizationId, type, relatedObjectId) {
        if (!relatedObjectId) return false;

        const row = await this.queryOne(
            `SELECT id FROM notifications 
             WHERE user_id = ? AND organization_id = ? AND type = ? AND related_object_id = ? 
             AND created_at > datetime('now', '-1 hour')`,
            [userId, organizationId, type, relatedObjectId]
        );
        return !!row;
    }

    /**
     * Deliver notification through user's preferred channels
     */
    async deliverNotification(userId, notification) {
        await this.init();

        if (!this._userNotificationPreferencesService || !this._userIntegrationService) {
            return this.create({
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
            const shouldNotify = await this._userNotificationPreferencesService.shouldNotify(
                userId, notification.type, notification.severity
            );

            if (!shouldNotify) {
                const inQuietHours = await this._userNotificationPreferencesService.isInQuietHours(userId);
                if (inQuietHours) {
                    results.queued = true;
                    results.reason = 'quiet_hours';
                    return results;
                }
                return { delivered: false, reason: 'disabled' };
            }

            const channels = await this._userNotificationPreferencesService.getChannelsForNotificationType(
                userId, notification.type
            );

            if (channels.length === 0) {
                return { delivered: false, reason: 'no_channels' };
            }

            for (const channel of channels) {
                try {
                    const channelResult = await this._deliverToChannel(
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
    }

    /**
     * Deliver to a specific channel
     */
    async _deliverToChannel(userId, channel, notification) {
        switch (channel) {
            case 'in_app':
                const created = await this.create({
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

            case 'slack':
                if (this._slackUserIntegration) {
                    try {
                        await this._slackUserIntegration.sendNotification(userId, notification);
                        return { success: true, method: 'slack_user' };
                    } catch (error) {
                        console.error('[NotificationService] Slack delivery failed:', error);
                        return { success: false, error: error.message };
                    }
                }
                return { success: false, error: 'Slack integration not available' };

            case 'teams':
                if (this._teamsUserIntegration) {
                    try {
                        await this._teamsUserIntegration.sendNotification(userId, notification);
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
    }

    /**
     * Notify all watchers of an object
     */
    async notifyWatchers(objectType, objectId, notification) {
        await this.init();

        if (!this._userNotificationPreferencesService) {
            return { notified: 0 };
        }

        try {
            const watchers = await this._userNotificationPreferencesService.getWatchersForObject(objectType, objectId);
            const results = [];

            for (const watcher of watchers) {
                if (watcher.notify_on === 'mentions' && notification.type !== 'MENTION') {
                    continue;
                }
                if (watcher.notify_on === 'status_changes' && !notification.type.includes('STATUS')) {
                    continue;
                }

                const result = await this.deliverNotification(
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
    }

    /**
     * Send due date reminder
     */
    async sendDueReminder(userId, organizationId, taskId, taskTitle, reminderType, dueDate) {
        await this.init();

        if (!this._userNotificationPreferencesService) {
            return { sent: false, reason: 'services_not_available' };
        }

        try {
            const alreadySent = await this._userNotificationPreferencesService.wasReminderSent(
                userId, taskId, reminderType
            );

            if (alreadySent) {
                return { sent: false, reason: 'already_sent' };
            }

            const reminderSettings = await this._userNotificationPreferencesService.getDueReminderSettings(userId);

            if (!reminderSettings[reminderType]) {
                return { sent: false, reason: 'reminder_disabled' };
            }

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
                organizationId: organizationId,
                relatedObjectType: 'TASK',
                relatedObjectId: taskId,
                isActionable: true,
                actionUrl: `/tasks/${taskId}`
            };

            const result = await this.deliverNotification(userId, notification);

            if (result.delivered) {
                await this._userNotificationPreferencesService.markReminderSent(userId, taskId, reminderType);
            }

            return { sent: result.delivered, ...result };
        } catch (error) {
            console.error('[NotificationService] sendDueReminder error:', error);
            return { sent: false, error: error.message };
        }
    }

    /**
     * Get user's notification preferences summary
     */
    async getUserPreferencesSummary(userId) {
        await this.init();

        if (!this._userNotificationPreferencesService || !this._userIntegrationService) {
            return null;
        }

        try {
            const prefs = await this._userNotificationPreferencesService.getPreferences(userId);
            const integrations = await this._userIntegrationService.getUserIntegrations(userId);
            const watchers = await this._userNotificationPreferencesService.getWatchedObjects(userId);

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
}

const notificationServiceInstance = new NotificationService();
export default notificationServiceInstance;

