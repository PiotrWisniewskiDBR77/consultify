declare const _default: UserNotificationPreferencesService;
export default _default;
declare class UserNotificationPreferencesService extends BaseService {
    NOTIFICATION_CATEGORIES: {
        tasks: {
            label: string;
            types: string[];
        };
        governance: {
            label: string;
            types: string[];
        };
        collaboration: {
            label: string;
            types: string[];
        };
        ai: {
            label: string;
            types: string[];
        };
        system: {
            label: string;
            types: string[];
        };
    };
    DEFAULT_PREFERENCES: {
        globalEnabled: boolean;
        schedule: {
            quietHoursEnabled: boolean;
            quietHoursStart: string;
            quietHoursEnd: string;
            quietDays: never[];
            timezone: string;
            respectUserStatus: boolean;
        };
        urgency: {
            criticalOverridesQuietHours: boolean;
            escalationDelayMinutes: number;
        };
        categories: {
            tasks: {
                enabled: boolean;
                channels: {
                    in_app: boolean;
                    email: boolean;
                    push: boolean;
                    slack: boolean;
                    teams: boolean;
                };
                types: {};
                dueReminders: {
                    '1_week': boolean;
                    '3_days': boolean;
                    '1_day': boolean;
                    '1_hour': boolean;
                };
            };
            governance: {
                enabled: boolean;
                channels: {
                    in_app: boolean;
                    email: boolean;
                    push: boolean;
                    slack: boolean;
                    teams: boolean;
                };
                types: {};
            };
            collaboration: {
                enabled: boolean;
                channels: {
                    in_app: boolean;
                    email: boolean;
                    push: boolean;
                    slack: boolean;
                    teams: boolean;
                };
                types: {};
            };
            ai: {
                enabled: boolean;
                channels: {
                    in_app: boolean;
                    email: boolean;
                    push: boolean;
                    slack: boolean;
                    teams: boolean;
                };
                types: {};
            };
            system: {
                enabled: boolean;
                channels: {
                    in_app: boolean;
                    email: boolean;
                    push: boolean;
                    slack: boolean;
                    teams: boolean;
                };
                types: {};
            };
        };
        digests: {
            dailyEnabled: boolean;
            dailyTime: string;
            weeklyEnabled: boolean;
            weeklyDay: string;
            weeklyTime: string;
            includeOverdue: boolean;
            includeUpcoming: boolean;
            includeAIInsights: boolean;
        };
    };
    SEVERITY: {
        INFO: string;
        WARNING: string;
        CRITICAL: string;
    };
    /**
     * Get user preferences (creates default if not exists)
     */
    getPreferences(userId: any): Promise<{
        globalEnabled: boolean;
        schedule: any;
        urgency: any;
        categories: any;
        digests: any;
    }>;
    /**
     * Create default preferences for new user
     */
    createDefaultPreferences(userId: any): Promise<{
        globalEnabled: boolean;
        schedule: {
            quietHoursEnabled: boolean;
            quietHoursStart: string;
            quietHoursEnd: string;
            quietDays: never[];
            timezone: string;
            respectUserStatus: boolean;
        };
        urgency: {
            criticalOverridesQuietHours: boolean;
            escalationDelayMinutes: number;
        };
        categories: {
            tasks: {
                enabled: boolean;
                channels: {
                    in_app: boolean;
                    email: boolean;
                    push: boolean;
                    slack: boolean;
                    teams: boolean;
                };
                types: {};
                dueReminders: {
                    '1_week': boolean;
                    '3_days': boolean;
                    '1_day': boolean;
                    '1_hour': boolean;
                };
            };
            governance: {
                enabled: boolean;
                channels: {
                    in_app: boolean;
                    email: boolean;
                    push: boolean;
                    slack: boolean;
                    teams: boolean;
                };
                types: {};
            };
            collaboration: {
                enabled: boolean;
                channels: {
                    in_app: boolean;
                    email: boolean;
                    push: boolean;
                    slack: boolean;
                    teams: boolean;
                };
                types: {};
            };
            ai: {
                enabled: boolean;
                channels: {
                    in_app: boolean;
                    email: boolean;
                    push: boolean;
                    slack: boolean;
                    teams: boolean;
                };
                types: {};
            };
            system: {
                enabled: boolean;
                channels: {
                    in_app: boolean;
                    email: boolean;
                    push: boolean;
                    slack: boolean;
                    teams: boolean;
                };
                types: {};
            };
        };
        digests: {
            dailyEnabled: boolean;
            dailyTime: string;
            weeklyEnabled: boolean;
            weeklyDay: string;
            weeklyTime: string;
            includeOverdue: boolean;
            includeUpcoming: boolean;
            includeAIInsights: boolean;
        };
    }>;
    /**
     * Update user preferences
     */
    updatePreferences(userId: any, updates: any): Promise<{
        globalEnabled: any;
        schedule: any;
        urgency: any;
        categories: any;
        digests: any;
    }>;
    /**
     * Helper to merge category updates
     */
    _mergeCategories(current: any, updates: any): any;
    /**
     * Get channels for a specific notification type
     */
    getChannelsForNotificationType(userId: any, notificationType: any): Promise<string[]>;
    /**
     * Find category for a notification type
     */
    _getCategoryForType(notificationType: any): string | null;
    /**
     * Check if user should receive notification
     */
    shouldNotify(userId: any, notificationType: any, severity?: string): Promise<boolean>;
    /**
     * Check if user is currently in quiet hours
     */
    isInQuietHours(userId: any): Promise<boolean>;
    /**
     * Check if severity should override quiet hours
     */
    shouldOverrideQuietHours(userId: any, severity: any): Promise<any>;
    /**
     * Get all objects user is watching
     */
    getWatchedObjects(userId: any): Promise<any>;
    /**
     * Get watched objects by type
     */
    getWatchedByType(userId: any, objectType: any): Promise<any>;
    /**
     * Add watcher
     */
    addWatcher(userId: any, objectType: any, objectId: any, notifyOn?: string): Promise<{
        id: string;
        objectType: any;
        objectId: any;
        notifyOn: string;
    }>;
    /**
     * Remove watcher
     */
    removeWatcher(userId: any, objectType: any, objectId: any): Promise<{
        removed: boolean;
    }>;
    /**
     * Check if user is watching an object
     */
    isWatching(userId: any, objectType: any, objectId: any): Promise<boolean>;
    /**
     * Get all users watching an object
     */
    getWatchersForObject(objectType: any, objectId: any): Promise<any>;
    /**
     * Check if reminder was already sent
     */
    wasReminderSent(userId: any, taskId: any, reminderType: any): Promise<boolean>;
    /**
     * Mark reminder as sent
     */
    markReminderSent(userId: any, taskId: any, reminderType: any, channel?: string): Promise<{
        marked: boolean;
    }>;
    /**
     * Get user's due reminder preferences
     */
    getDueReminderSettings(userId: any): Promise<any>;
    /**
     * Get digest settings
     */
    getDigestSettings(userId: any): Promise<any>;
    /**
     * Update digest settings
     */
    updateDigestSettings(userId: any, digestUpdates: any): Promise<{
        globalEnabled: any;
        schedule: any;
        urgency: any;
        categories: any;
        digests: any;
    }>;
    /**
     * Get users who should receive daily digest
     */
    getUsersForDailyDigest(currentTime: any): Promise<any>;
    /**
     * Get users who should receive weekly digest
     */
    getUsersForWeeklyDigest(currentDay: any, currentTime: any): Promise<any>;
}
import BaseService from './BaseService.js';
//# sourceMappingURL=userNotificationPreferencesService.d.ts.map