/**
 * UserNotificationPreferencesService Tests
 * 
 * Tests for user-level notification preferences management
 */

const UserNotificationPreferencesService = require('../../../server/services/userNotificationPreferencesService');

// Mock the database
jest.mock('../../../server/database', () => ({
    run: jest.fn((sql, params, callback) => {
        if (callback) callback.call({ lastID: 1, changes: 1 }, null);
    }),
    get: jest.fn((sql, params, callback) => {
        if (sql.includes('user_notification_preferences_v2')) {
            callback(null, {
                id: 'pref-1',
                user_id: 'test-user-id',
                global_enabled: 1,
                schedule_json: JSON.stringify({
                    quietHoursEnabled: true,
                    quietHoursStart: '22:00',
                    quietHoursEnd: '08:00',
                    quietDays: ['saturday', 'sunday'],
                    timezone: 'UTC'
                }),
                urgency_json: JSON.stringify({
                    criticalOverridesQuietHours: true,
                    escalationDelayMinutes: 30
                }),
                categories_json: JSON.stringify({
                    tasks: {
                        enabled: true,
                        channels: { in_app: true, email: true, slack: true }
                    },
                    governance: {
                        enabled: true,
                        channels: { in_app: true, email: true, teams: true }
                    }
                }),
                digests_json: JSON.stringify({
                    dailyEnabled: false,
                    weeklyEnabled: true,
                    weeklyDay: 'monday'
                })
            });
        } else if (sql.includes('user_watchers')) {
            callback(null, { id: 'watcher-1' });
        } else if (sql.includes('due_date_reminders_sent')) {
            callback(null, null);
        } else {
            callback(null, null);
        }
    }),
    all: jest.fn((sql, params, callback) => {
        if (sql.includes('user_watchers')) {
            callback(null, [
                { id: 'w1', user_id: 'test-user-id', object_type: 'task', object_id: 'task-1', notify_on: 'all' },
                { id: 'w2', user_id: 'test-user-id', object_type: 'initiative', object_id: 'init-1', notify_on: 'status_changes' }
            ]);
        } else {
            callback(null, []);
        }
    })
}));

describe('UserNotificationPreferencesService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('NOTIFICATION_CATEGORIES', () => {
        it('should have all categories defined', () => {
            const categories = UserNotificationPreferencesService.NOTIFICATION_CATEGORIES;
            
            expect(categories.tasks).toBeDefined();
            expect(categories.governance).toBeDefined();
            expect(categories.collaboration).toBeDefined();
            expect(categories.ai).toBeDefined();
            expect(categories.system).toBeDefined();
        });

        it('should have types for each category', () => {
            const categories = UserNotificationPreferencesService.NOTIFICATION_CATEGORIES;
            
            Object.values(categories).forEach(category => {
                expect(category).toHaveProperty('label');
                expect(category).toHaveProperty('types');
                expect(Array.isArray(category.types)).toBe(true);
                expect(category.types.length).toBeGreaterThan(0);
            });
        });
    });

    describe('SEVERITY', () => {
        it('should have all severity levels', () => {
            expect(UserNotificationPreferencesService.SEVERITY.INFO).toBe('INFO');
            expect(UserNotificationPreferencesService.SEVERITY.WARNING).toBe('WARNING');
            expect(UserNotificationPreferencesService.SEVERITY.CRITICAL).toBe('CRITICAL');
        });
    });

    describe('getPreferences', () => {
        it('should return user preferences', async () => {
            const prefs = await UserNotificationPreferencesService.getPreferences('test-user-id');
            
            expect(prefs).toBeDefined();
            expect(prefs.globalEnabled).toBe(true);
            expect(prefs.schedule).toBeDefined();
            expect(prefs.schedule.quietHoursEnabled).toBe(true);
        });

        it('should return categories preferences', async () => {
            const prefs = await UserNotificationPreferencesService.getPreferences('test-user-id');
            
            expect(prefs.categories).toBeDefined();
            expect(prefs.categories.tasks).toBeDefined();
            expect(prefs.categories.tasks.enabled).toBe(true);
        });
    });

    describe('getChannelsForNotificationType', () => {
        it('should return channels for notification type', async () => {
            const channels = await UserNotificationPreferencesService.getChannelsForNotificationType(
                'test-user-id',
                'TASK_ASSIGNED'
            );
            
            expect(Array.isArray(channels)).toBe(true);
        });

        it('should return empty array if category disabled', async () => {
            // Mock disabled category
            jest.requireMock('../../../server/database').get.mockImplementationOnce(
                (sql, params, callback) => {
                    callback(null, {
                        global_enabled: 0,
                        categories_json: '{}'
                    });
                }
            );
            
            const channels = await UserNotificationPreferencesService.getChannelsForNotificationType(
                'test-user-id',
                'TASK_ASSIGNED'
            );
            
            expect(channels).toEqual([]);
        });
    });

    describe('getWatchedObjects', () => {
        it('should return watched objects', async () => {
            const watchers = await UserNotificationPreferencesService.getWatchedObjects('test-user-id');
            
            expect(watchers).toHaveLength(2);
            expect(watchers[0].objectType).toBe('task');
            expect(watchers[1].objectType).toBe('initiative');
        });
    });

    describe('isWatching', () => {
        it('should return true for watched object', async () => {
            const watching = await UserNotificationPreferencesService.isWatching(
                'test-user-id',
                'task',
                'task-1'
            );
            
            expect(watching).toBe(true);
        });
    });

    describe('wasReminderSent', () => {
        it('should return false for unsent reminder', async () => {
            const sent = await UserNotificationPreferencesService.wasReminderSent(
                'test-user-id',
                'task-1',
                '1_day'
            );
            
            expect(sent).toBe(false);
        });
    });

    describe('_getCategoryForType', () => {
        it('should return category for task types', () => {
            const category = UserNotificationPreferencesService._getCategoryForType('TASK_ASSIGNED');
            expect(category).toBe('tasks');
        });

        it('should return category for governance types', () => {
            const category = UserNotificationPreferencesService._getCategoryForType('DECISION_REQUIRED');
            expect(category).toBe('governance');
        });

        it('should return category for AI types', () => {
            const category = UserNotificationPreferencesService._getCategoryForType('AI_RISK_DETECTED');
            expect(category).toBe('ai');
        });

        it('should return null for unknown types', () => {
            const category = UserNotificationPreferencesService._getCategoryForType('UNKNOWN_TYPE');
            expect(category).toBeNull();
        });
    });
});





