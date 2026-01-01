import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const mockDb = {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn()
};

vi.mock('../../../server/database', () => ({
    default: mockDb
}));

describe('NotificationService', () => {
    let NotificationService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();

        mockDb.run.mockImplementation((sql, params, callback) => {
            callback(null, { lastID: 'notification-123', changes: 1 });
        });

        mockDb.get.mockImplementation((sql, params, callback) => {
            // Mock mute settings check - return false (don't mute)
            callback(null, null);
        });

        mockDb.all.mockImplementation((sql, params, callback) => {
            callback(null, []);
        });

        NotificationService = require('../../../server/services/notificationService');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('create', () => {
        it('should create a notification', async () => {
            const notification = {
                userId: 'user-123',
                organizationId: 'org-456',
                projectId: 'project-789',
                type: NotificationService.NOTIFICATION_TYPES.TASK_ASSIGNED,
                severity: NotificationService.SEVERITY.INFO,
                title: 'Test Notification',
                message: 'Test message',
                relatedObjectType: 'TASK',
                relatedObjectId: 'task-123'
            };

            const result = await NotificationService.create(notification);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should not create notification if muted', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                // Mock mute settings - return true (mute)
                callback(null, { mute: 1 });
            });

            const notification = {
                userId: 'user-123',
                organizationId: 'org-456',
                type: NotificationService.NOTIFICATION_TYPES.TASK_ASSIGNED,
                title: 'Test',
                message: 'Test'
            };

            const result = await NotificationService.create(notification);
            expect(result).toBeNull();
        });
    });

    describe('getForUser', () => {
        it('should get notifications for user', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    {
                        id: 'notif-1',
                        type: 'TASK_ASSIGNED',
                        title: 'Task Assigned',
                        is_read: 0
                    }
                ]);
            });

            const notifications = await NotificationService.getForUser('user-123');

            expect(notifications).toBeDefined();
            expect(Array.isArray(notifications)).toBe(true);
        });

        it('should filter unread notifications', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, []);
            });

            await NotificationService.getForUser('user-123', { unreadOnly: true });
            expect(mockDb.all).toHaveBeenCalled();
        });
    });

    describe('NOTIFICATION_TYPES', () => {
        it('should have all notification types defined', () => {
            expect(NotificationService.NOTIFICATION_TYPES.TASK_ASSIGNED).toBe('TASK_ASSIGNED');
            expect(NotificationService.NOTIFICATION_TYPES.DECISION_REQUIRED).toBe('DECISION_REQUIRED');
            expect(NotificationService.NOTIFICATION_TYPES.AI_RISK_DETECTED).toBe('AI_RISK_DETECTED');
        });
    });
});


