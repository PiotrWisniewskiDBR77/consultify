/**
 * UserNotificationPreferencesService
 * 
 * User-level notification preferences management.
 * Handles channel routing, quiet hours, watchers, and digest settings.
 * 
 * Part of: User-Level Notifications & Integrations System
 */

import BaseService from './BaseService.js';
import { v4 as uuidv4 } from 'uuid';

// Notification types organized by category
const NOTIFICATION_CATEGORIES = {
    tasks: {
        label: 'Tasks',
        types: [
            'TASK_ASSIGNED',
            'TASK_UNASSIGNED',
            'TASK_STATUS_CHANGED',
            'TASK_PRIORITY_CHANGED',
            'TASK_DUE_SOON',
            'TASK_DUE_TODAY',
            'TASK_DUE_NOW',
            'TASK_OVERDUE',
            'TASK_COMPLETED',
            'TASK_BLOCKED',
            'TASK_UNBLOCKED',
            'TASK_COMMENT_ADDED',
            'TASK_ATTACHMENT_ADDED',
            'TASK_DEPENDENCY_RESOLVED',
            'TASK_ESCALATED',
            'TASK_WATCHER_ADDED'
        ]
    },
    governance: {
        label: 'Governance',
        types: [
            'DECISION_REQUIRED',
            'DECISION_MADE',
            'DECISION_OVERDUE',
            'CHANGE_REQUEST_SUBMITTED',
            'CHANGE_REQUEST_DECIDED',
            'GATE_PENDING_APPROVAL',
            'GATE_APPROVED',
            'GATE_REJECTED',
            'RISK_IDENTIFIED',
            'RISK_MITIGATED'
        ]
    },
    collaboration: {
        label: 'Collaboration',
        types: [
            'MENTION',
            'COMMENT_REPLY',
            'DOCUMENT_SHARED',
            'DOCUMENT_EDITED',
            'PROJECT_MEMBER_ADDED',
            'PROJECT_MEMBER_REMOVED'
        ]
    },
    ai: {
        label: 'AI Insights',
        types: [
            'AI_RISK_DETECTED',
            'AI_RECOMMENDATION',
            'AI_WORKLOAD_WARNING',
            'AI_BOTTLENECK_DETECTED',
            'AI_DEADLINE_AT_RISK'
        ]
    },
    system: {
        label: 'System',
        types: [
            'SYSTEM_MAINTENANCE',
            'FEATURE_ANNOUNCEMENT',
            'PERMISSION_CHANGED',
            'TRIAL_WARNING',
            'TRIAL_EXPIRED'
        ]
    }
};

// Default preferences template
const DEFAULT_PREFERENCES = {
    globalEnabled: true,
    schedule: {
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        quietDays: [],
        timezone: 'UTC',
        respectUserStatus: false
    },
    urgency: {
        criticalOverridesQuietHours: true,
        escalationDelayMinutes: 30
    },
    categories: {
        tasks: {
            enabled: true,
            channels: { in_app: true, email: true, push: false, slack: true, teams: false },
            types: {},
            dueReminders: { '1_week': false, '3_days': true, '1_day': true, '1_hour': true }
        },
        governance: {
            enabled: true,
            channels: { in_app: true, email: true, push: true, slack: true, teams: true },
            types: {}
        },
        collaboration: {
            enabled: true,
            channels: { in_app: true, email: true, push: true, slack: true, teams: true },
            types: {}
        },
        ai: {
            enabled: true,
            channels: { in_app: true, email: false, push: false, slack: true, teams: false },
            types: {}
        },
        system: {
            enabled: true,
            channels: { in_app: true, email: true, push: false, slack: false, teams: false },
            types: {}
        }
    },
    digests: {
        dailyEnabled: false,
        dailyTime: '09:00',
        weeklyEnabled: true,
        weeklyDay: 'monday',
        weeklyTime: '09:00',
        includeOverdue: true,
        includeUpcoming: true,
        includeAIInsights: true
    }
};

// Severity levels
const SEVERITY = {
    INFO: 'INFO',
    WARNING: 'WARNING',
    CRITICAL: 'CRITICAL'
};

// Map notification types to severities
const TYPE_SEVERITY_MAP = {
    // Critical
    'TASK_OVERDUE': SEVERITY.CRITICAL,
    'DECISION_OVERDUE': SEVERITY.CRITICAL,
    'GATE_REJECTED': SEVERITY.CRITICAL,
    'AI_RISK_DETECTED': SEVERITY.CRITICAL,
    'AI_DEADLINE_AT_RISK': SEVERITY.CRITICAL,
    'TRIAL_EXPIRED': SEVERITY.CRITICAL,
    // Warning
    'TASK_BLOCKED': SEVERITY.WARNING,
    'TASK_DUE_TODAY': SEVERITY.WARNING,
    'TASK_DUE_NOW': SEVERITY.WARNING,
    'DECISION_REQUIRED': SEVERITY.WARNING,
    'GATE_PENDING_APPROVAL': SEVERITY.WARNING,
    'RISK_IDENTIFIED': SEVERITY.WARNING,
    'AI_WORKLOAD_WARNING': SEVERITY.WARNING,
    'AI_BOTTLENECK_DETECTED': SEVERITY.WARNING,
    'TRIAL_WARNING': SEVERITY.WARNING,
    'TASK_ESCALATED': SEVERITY.WARNING,
    // Info (default)
};

class UserNotificationPreferencesService extends BaseService {
    constructor() {
        super();
        this.NOTIFICATION_CATEGORIES = NOTIFICATION_CATEGORIES;
        this.DEFAULT_PREFERENCES = DEFAULT_PREFERENCES;
        this.SEVERITY = SEVERITY;
    }

    // ==========================================
    // PREFERENCES MANAGEMENT
    // ==========================================

    /**
     * Get user preferences (creates default if not exists)
     */
    async getPreferences(userId) {
        const row = await this.queryOne(
            `SELECT * FROM user_notification_preferences_v2 WHERE user_id = ?`,
            [userId]
        );

        if (!row) {
            // Create default preferences
            return await this.createDefaultPreferences(userId);
        }

        // Parse and merge with defaults (for any new fields)
        const preferences = {
            globalEnabled: !!row.global_enabled,
            schedule: {
                ...DEFAULT_PREFERENCES.schedule,
                ...(row.schedule_json ? JSON.parse(row.schedule_json) : {})
            },
            urgency: {
                ...DEFAULT_PREFERENCES.urgency,
                ...(row.urgency_json ? JSON.parse(row.urgency_json) : {})
            },
            categories: {
                ...DEFAULT_PREFERENCES.categories,
                ...(row.categories_json ? JSON.parse(row.categories_json) : {})
            },
            digests: {
                ...DEFAULT_PREFERENCES.digests,
                ...(row.digests_json ? JSON.parse(row.digests_json) : {})
            }
        };

        return preferences;
    }

    /**
     * Create default preferences for new user
     */
    async createDefaultPreferences(userId) {
        const id = uuidv4();

        await this.queryRun(
            `INSERT INTO user_notification_preferences_v2 
            (id, user_id, global_enabled, schedule_json, urgency_json, categories_json, digests_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                userId,
                1,
                JSON.stringify(DEFAULT_PREFERENCES.schedule),
                JSON.stringify(DEFAULT_PREFERENCES.urgency),
                JSON.stringify(DEFAULT_PREFERENCES.categories),
                JSON.stringify(DEFAULT_PREFERENCES.digests)
            ]
        );
        return DEFAULT_PREFERENCES;
    }

    /**
     * Update user preferences
     */
    async updatePreferences(userId, updates) {
        // Get current preferences first
        const current = await this.getPreferences(userId);

        // Merge updates
        const merged = {
            globalEnabled: updates.globalEnabled ?? current.globalEnabled,
            schedule: { ...current.schedule, ...(updates.schedule || {}) },
            urgency: { ...current.urgency, ...(updates.urgency || {}) },
            categories: updates.categories ?
                this._mergeCategories(current.categories, updates.categories) :
                current.categories,
            digests: { ...current.digests, ...(updates.digests || {}) }
        };

        await this.queryRun(
            `UPDATE user_notification_preferences_v2 
            SET global_enabled = ?,
                schedule_json = ?,
                urgency_json = ?,
                categories_json = ?,
                digests_json = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?`,
            [
                merged.globalEnabled ? 1 : 0,
                JSON.stringify(merged.schedule),
                JSON.stringify(merged.urgency),
                JSON.stringify(merged.categories),
                JSON.stringify(merged.digests),
                userId
            ]
        );
        return merged;
    }

    /**
     * Helper to merge category updates
     */
    _mergeCategories(current, updates) {
        const merged = { ...current };
        for (const [category, categoryUpdates] of Object.entries(updates)) {
            if (merged[category]) {
                merged[category] = {
                    ...merged[category],
                    ...categoryUpdates,
                    channels: {
                        ...merged[category].channels,
                        ...(categoryUpdates.channels || {})
                    },
                    types: {
                        ...merged[category].types,
                        ...(categoryUpdates.types || {})
                    }
                };
            }
        }
        return merged;
    }

    // ==========================================
    // CHANNEL ROUTING
    // ==========================================

    /**
     * Get channels for a specific notification type
     */
    async getChannelsForNotificationType(userId, notificationType) {
        const prefs = await this.getPreferences(userId);

        if (!prefs.globalEnabled) {
            return [];
        }

        // Find which category this type belongs to
        const category = this._getCategoryForType(notificationType);
        if (!category || !prefs.categories[category]?.enabled) {
            return [];
        }

        const categoryPrefs = prefs.categories[category];

        // Check if this specific type is disabled
        if (categoryPrefs.types && categoryPrefs.types[notificationType] === false) {
            return [];
        }

        // Return enabled channels
        const channels = [];
        if (categoryPrefs.channels) {
            for (const [channel, enabled] of Object.entries(categoryPrefs.channels)) {
                if (enabled) {
                    channels.push(channel);
                }
            }
        }

        return channels;
    }

    /**
     * Find category for a notification type
     */
    _getCategoryForType(notificationType) {
        for (const [category, config] of Object.entries(NOTIFICATION_CATEGORIES)) {
            if (config.types.includes(notificationType)) {
                return category;
            }
        }
        return null;
    }

    /**
     * Check if user should receive notification
     */
    async shouldNotify(userId, notificationType, severity = SEVERITY.INFO) {
        const prefs = await this.getPreferences(userId);

        // Global check
        if (!prefs.globalEnabled) {
            return false;
        }

        // Check quiet hours
        const inQuietHours = await this.isInQuietHours(userId);
        if (inQuietHours) {
            // Check if severity overrides quiet hours
            const actualSeverity = TYPE_SEVERITY_MAP[notificationType] || severity;
            if (actualSeverity === SEVERITY.CRITICAL && prefs.urgency.criticalOverridesQuietHours) {
                return true;
            }
            return false;
        }

        // Check category
        const category = this._getCategoryForType(notificationType);
        if (!category || !prefs.categories[category]?.enabled) {
            return false;
        }

        // Check specific type
        const categoryPrefs = prefs.categories[category];
        if (categoryPrefs.types && categoryPrefs.types[notificationType] === false) {
            return false;
        }

        return true;
    }

    // ==========================================
    // SCHEDULE / QUIET HOURS
    // ==========================================

    /**
     * Check if user is currently in quiet hours
     */
    async isInQuietHours(userId) {
        const prefs = await this.getPreferences(userId);

        if (!prefs.schedule.quietHoursEnabled) {
            return false;
        }

        const now = new Date();
        const timezone = prefs.schedule.timezone || 'UTC';

        // Get current time in user's timezone
        const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        const currentHour = userTime.getHours();
        const currentMinute = userTime.getMinutes();
        const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][userTime.getDay()];

        // Check if current day is a quiet day
        if (prefs.schedule.quietDays?.includes(currentDay)) {
            return true;
        }

        // Parse quiet hours
        const [startHour, startMinute] = prefs.schedule.quietHoursStart.split(':').map(Number);
        const [endHour, endMinute] = prefs.schedule.quietHoursEnd.split(':').map(Number);

        const currentMinutes = currentHour * 60 + currentMinute;
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;

        // Handle overnight quiet hours (e.g., 22:00 - 08:00)
        if (startMinutes > endMinutes) {
            // Quiet hours span midnight
            return currentMinutes >= startMinutes || currentMinutes < endMinutes;
        } else {
            // Quiet hours within same day
            return currentMinutes >= startMinutes && currentMinutes < endMinutes;
        }
    }

    /**
     * Check if severity should override quiet hours
     */
    async shouldOverrideQuietHours(userId, severity) {
        if (severity !== SEVERITY.CRITICAL) {
            return false;
        }

        const prefs = await this.getPreferences(userId);
        return prefs.urgency.criticalOverridesQuietHours;
    }

    // ==========================================
    // WATCHERS
    // ==========================================

    /**
     * Get all objects user is watching
     */
    async getWatchedObjects(userId) {
        const rows = await this.queryAll(
            `SELECT * FROM user_watchers WHERE user_id = ? ORDER BY created_at DESC`,
            [userId]
        );

        return (rows || []).map(row => ({
            id: row.id,
            objectType: row.object_type,
            objectId: row.object_id,
            notifyOn: row.notify_on,
            createdAt: row.created_at
        }));
    }

    /**
     * Get watched objects by type
     */
    async getWatchedByType(userId, objectType) {
        const rows = await this.queryAll(
            `SELECT object_id FROM user_watchers 
            WHERE user_id = ? AND object_type = ?`,
            [userId, objectType]
        );
        return (rows || []).map(r => r.object_id);
    }

    /**
     * Add watcher
     */
    async addWatcher(userId, objectType, objectId, notifyOn = 'all') {
        const id = uuidv4();

        await this.queryRun(
            `INSERT INTO user_watchers (id, user_id, object_type, object_id, notify_on)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, object_type, object_id) DO UPDATE SET
                notify_on = excluded.notify_on`,
            [id, userId, objectType, objectId, notifyOn]
        );
        return { id, objectType, objectId, notifyOn };
    }

    /**
     * Remove watcher
     */
    async removeWatcher(userId, objectType, objectId) {
        const result = await this.queryRun(
            `DELETE FROM user_watchers 
            WHERE user_id = ? AND object_type = ? AND object_id = ?`,
            [userId, objectType, objectId]
        );
        return { removed: result.changes > 0 };
    }

    /**
     * Check if user is watching an object
     */
    async isWatching(userId, objectType, objectId) {
        const row = await this.queryOne(
            `SELECT id FROM user_watchers 
            WHERE user_id = ? AND object_type = ? AND object_id = ?`,
            [userId, objectType, objectId]
        );
        return !!row;
    }

    /**
     * Get all users watching an object
     */
    async getWatchersForObject(objectType, objectId) {
        return await this.queryAll(
            `SELECT user_id, notify_on FROM user_watchers 
            WHERE object_type = ? AND object_id = ?`,
            [objectType, objectId]
        );
    }

    // ==========================================
    // DUE DATE REMINDERS
    // ==========================================

    /**
     * Check if reminder was already sent
     */
    async wasReminderSent(userId, taskId, reminderType) {
        const row = await this.queryOne(
            `SELECT id FROM due_date_reminders_sent 
            WHERE user_id = ? AND task_id = ? AND reminder_type = ?`,
            [userId, taskId, reminderType]
        );
        return !!row;
    }

    /**
     * Mark reminder as sent
     */
    async markReminderSent(userId, taskId, reminderType, channel = 'in_app') {
        const id = uuidv4();

        await this.queryRun(
            `INSERT INTO due_date_reminders_sent (id, user_id, task_id, reminder_type, channel)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, task_id, reminder_type) DO NOTHING`,
            [id, userId, taskId, reminderType, channel]
        );
        return { marked: true };
    }

    /**
     * Get user's due reminder preferences
     */
    async getDueReminderSettings(userId) {
        const prefs = await this.getPreferences(userId);
        return prefs.categories.tasks?.dueReminders || DEFAULT_PREFERENCES.categories.tasks.dueReminders;
    }

    // ==========================================
    // DIGEST SETTINGS
    // ==========================================

    /**
     * Get digest settings
     */
    async getDigestSettings(userId) {
        const prefs = await this.getPreferences(userId);
        return prefs.digests;
    }

    /**
     * Update digest settings
     */
    async updateDigestSettings(userId, digestUpdates) {
        return await this.updatePreferences(userId, {
            digests: digestUpdates
        });
    }

    /**
     * Get users who should receive daily digest
     */
    async getUsersForDailyDigest(currentTime) {
        // currentTime format: "HH:MM"
        const rows = await this.queryAll(
            `SELECT user_id FROM user_notification_preferences_v2 
            WHERE json_extract(digests_json, '$.dailyEnabled') = 1
            AND json_extract(digests_json, '$.dailyTime') = ?`,
            [currentTime]
        );
        return (rows || []).map(r => r.user_id);
    }

    /**
     * Get users who should receive weekly digest
     */
    async getUsersForWeeklyDigest(currentDay, currentTime) {
        // currentDay: 'monday', 'tuesday', etc.
        // currentTime format: "HH:MM"
        const rows = await this.queryAll(
            `SELECT user_id FROM user_notification_preferences_v2 
            WHERE json_extract(digests_json, '$.weeklyEnabled') = 1
            AND json_extract(digests_json, '$.weeklyDay') = ?
            AND json_extract(digests_json, '$.weeklyTime') = ?`,
            [currentDay, currentTime]
        );
        return (rows || []).map(r => r.user_id);
    }
}

export default new UserNotificationPreferencesService();
