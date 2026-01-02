/**
 * UserNotificationPreferencesService
 * 
 * User-level notification preferences management.
 * Handles channel routing, quiet hours, watchers, and digest settings.
 * 
 * Part of: User-Level Notifications & Integrations System
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

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

const UserNotificationPreferencesService = {
    NOTIFICATION_CATEGORIES,
    DEFAULT_PREFERENCES,
    SEVERITY,

    // ==========================================
    // PREFERENCES MANAGEMENT
    // ==========================================

    /**
     * Get user preferences (creates default if not exists)
     */
    getPreferences: async (userId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM user_notification_preferences_v2 WHERE user_id = ?`,
                [userId],
                async (err, row) => {
                    if (err) return reject(err);
                    
                    if (!row) {
                        // Create default preferences
                        const prefs = await UserNotificationPreferencesService.createDefaultPreferences(userId);
                        return resolve(prefs);
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
                    
                    resolve(preferences);
                }
            );
        });
    },

    /**
     * Create default preferences for new user
     */
    createDefaultPreferences: async (userId) => {
        const id = uuidv4();
        
        return new Promise((resolve, reject) => {
            db.run(
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
                ],
                function(err) {
                    if (err) return reject(err);
                    resolve(DEFAULT_PREFERENCES);
                }
            );
        });
    },

    /**
     * Update user preferences
     */
    updatePreferences: async (userId, updates) => {
        // Get current preferences first
        const current = await UserNotificationPreferencesService.getPreferences(userId);
        
        // Merge updates
        const merged = {
            globalEnabled: updates.globalEnabled ?? current.globalEnabled,
            schedule: { ...current.schedule, ...(updates.schedule || {}) },
            urgency: { ...current.urgency, ...(updates.urgency || {}) },
            categories: updates.categories ? 
                UserNotificationPreferencesService._mergeCategories(current.categories, updates.categories) : 
                current.categories,
            digests: { ...current.digests, ...(updates.digests || {}) }
        };

        return new Promise((resolve, reject) => {
            db.run(
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
                ],
                function(err) {
                    if (err) return reject(err);
                    resolve(merged);
                }
            );
        });
    },

    /**
     * Helper to merge category updates
     */
    _mergeCategories: (current, updates) => {
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
    },

    // ==========================================
    // CHANNEL ROUTING
    // ==========================================

    /**
     * Get channels for a specific notification type
     */
    getChannelsForNotificationType: async (userId, notificationType) => {
        const prefs = await UserNotificationPreferencesService.getPreferences(userId);
        
        if (!prefs.globalEnabled) {
            return [];
        }
        
        // Find which category this type belongs to
        const category = UserNotificationPreferencesService._getCategoryForType(notificationType);
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
    },

    /**
     * Find category for a notification type
     */
    _getCategoryForType: (notificationType) => {
        for (const [category, config] of Object.entries(NOTIFICATION_CATEGORIES)) {
            if (config.types.includes(notificationType)) {
                return category;
            }
        }
        return null;
    },

    /**
     * Check if user should receive notification
     */
    shouldNotify: async (userId, notificationType, severity = SEVERITY.INFO) => {
        const prefs = await UserNotificationPreferencesService.getPreferences(userId);
        
        // Global check
        if (!prefs.globalEnabled) {
            return false;
        }
        
        // Check quiet hours
        const inQuietHours = await UserNotificationPreferencesService.isInQuietHours(userId);
        if (inQuietHours) {
            // Check if severity overrides quiet hours
            const actualSeverity = TYPE_SEVERITY_MAP[notificationType] || severity;
            if (actualSeverity === SEVERITY.CRITICAL && prefs.urgency.criticalOverridesQuietHours) {
                return true;
            }
            return false;
        }
        
        // Check category
        const category = UserNotificationPreferencesService._getCategoryForType(notificationType);
        if (!category || !prefs.categories[category]?.enabled) {
            return false;
        }
        
        // Check specific type
        const categoryPrefs = prefs.categories[category];
        if (categoryPrefs.types && categoryPrefs.types[notificationType] === false) {
            return false;
        }
        
        return true;
    },

    // ==========================================
    // SCHEDULE / QUIET HOURS
    // ==========================================

    /**
     * Check if user is currently in quiet hours
     */
    isInQuietHours: async (userId) => {
        const prefs = await UserNotificationPreferencesService.getPreferences(userId);
        
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
    },

    /**
     * Check if severity should override quiet hours
     */
    shouldOverrideQuietHours: async (userId, severity) => {
        if (severity !== SEVERITY.CRITICAL) {
            return false;
        }
        
        const prefs = await UserNotificationPreferencesService.getPreferences(userId);
        return prefs.urgency.criticalOverridesQuietHours;
    },

    // ==========================================
    // WATCHERS
    // ==========================================

    /**
     * Get all objects user is watching
     */
    getWatchedObjects: async (userId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM user_watchers WHERE user_id = ? ORDER BY created_at DESC`,
                [userId],
                (err, rows) => {
                    if (err) return reject(err);
                    
                    const watchers = (rows || []).map(row => ({
                        id: row.id,
                        objectType: row.object_type,
                        objectId: row.object_id,
                        notifyOn: row.notify_on,
                        createdAt: row.created_at
                    }));
                    
                    resolve(watchers);
                }
            );
        });
    },

    /**
     * Get watched objects by type
     */
    getWatchedByType: async (userId, objectType) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT object_id FROM user_watchers 
                WHERE user_id = ? AND object_type = ?`,
                [userId, objectType],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(r => r.object_id));
                }
            );
        });
    },

    /**
     * Add watcher
     */
    addWatcher: async (userId, objectType, objectId, notifyOn = 'all') => {
        const id = uuidv4();
        
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_watchers (id, user_id, object_type, object_id, notify_on)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id, object_type, object_id) DO UPDATE SET
                    notify_on = excluded.notify_on`,
                [id, userId, objectType, objectId, notifyOn],
                function(err) {
                    if (err) return reject(err);
                    resolve({ id, objectType, objectId, notifyOn });
                }
            );
        });
    },

    /**
     * Remove watcher
     */
    removeWatcher: async (userId, objectType, objectId) => {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM user_watchers 
                WHERE user_id = ? AND object_type = ? AND object_id = ?`,
                [userId, objectType, objectId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ removed: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Check if user is watching an object
     */
    isWatching: async (userId, objectType, objectId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM user_watchers 
                WHERE user_id = ? AND object_type = ? AND object_id = ?`,
                [userId, objectType, objectId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(!!row);
                }
            );
        });
    },

    /**
     * Get all users watching an object
     */
    getWatchersForObject: async (objectType, objectId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT user_id, notify_on FROM user_watchers 
                WHERE object_type = ? AND object_id = ?`,
                [objectType, objectId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    // ==========================================
    // DUE DATE REMINDERS
    // ==========================================

    /**
     * Check if reminder was already sent
     */
    wasReminderSent: async (userId, taskId, reminderType) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM due_date_reminders_sent 
                WHERE user_id = ? AND task_id = ? AND reminder_type = ?`,
                [userId, taskId, reminderType],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(!!row);
                }
            );
        });
    },

    /**
     * Mark reminder as sent
     */
    markReminderSent: async (userId, taskId, reminderType, channel = 'in_app') => {
        const id = uuidv4();
        
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO due_date_reminders_sent (id, user_id, task_id, reminder_type, channel)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id, task_id, reminder_type) DO NOTHING`,
                [id, userId, taskId, reminderType, channel],
                function(err) {
                    if (err) return reject(err);
                    resolve({ marked: true });
                }
            );
        });
    },

    /**
     * Get user's due reminder preferences
     */
    getDueReminderSettings: async (userId) => {
        const prefs = await UserNotificationPreferencesService.getPreferences(userId);
        return prefs.categories.tasks?.dueReminders || DEFAULT_PREFERENCES.categories.tasks.dueReminders;
    },

    // ==========================================
    // DIGEST SETTINGS
    // ==========================================

    /**
     * Get digest settings
     */
    getDigestSettings: async (userId) => {
        const prefs = await UserNotificationPreferencesService.getPreferences(userId);
        return prefs.digests;
    },

    /**
     * Update digest settings
     */
    updateDigestSettings: async (userId, digestUpdates) => {
        return UserNotificationPreferencesService.updatePreferences(userId, {
            digests: digestUpdates
        });
    },

    /**
     * Get users who should receive daily digest
     */
    getUsersForDailyDigest: async (currentTime) => {
        // currentTime format: "HH:MM"
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT user_id FROM user_notification_preferences_v2 
                WHERE json_extract(digests_json, '$.dailyEnabled') = 1
                AND json_extract(digests_json, '$.dailyTime') = ?`,
                [currentTime],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(r => r.user_id));
                }
            );
        });
    },

    /**
     * Get users who should receive weekly digest
     */
    getUsersForWeeklyDigest: async (currentDay, currentTime) => {
        // currentDay: 'monday', 'tuesday', etc.
        // currentTime format: "HH:MM"
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT user_id FROM user_notification_preferences_v2 
                WHERE json_extract(digests_json, '$.weeklyEnabled') = 1
                AND json_extract(digests_json, '$.weeklyDay') = ?
                AND json_extract(digests_json, '$.weeklyTime') = ?`,
                [currentDay, currentTime],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(r => r.user_id));
                }
            );
        });
    }
};

module.exports = UserNotificationPreferencesService;


