import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockDb } = vi.hoisted(() => {
    return {
        mockDb: {
            run: vi.fn(),
            get: vi.fn(),
            all: vi.fn(),
            exec: vi.fn(),
            query: vi.fn(),
            serialize: vi.fn((cb) => cb()),
            on: vi.fn(),
        }
    };
});

// Inject the mock into the global object so server/database.js can pick it up
global.__TEST_DB_MOCK__ = mockDb;

describe('NotificationService', () => {
    let NotificationService;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();

        // Default mock implementations - MUST USE CALLBACKS
        mockDb.run.mockImplementation((sql, params, callback) => {
            const cb = typeof params === 'function' ? params : callback;
            if (typeof cb === 'function') cb(null, { lastID: 'notification-123', changes: 1 });
        });

        mockDb.get.mockImplementation((sql, params, callback) => {
            const cb = typeof params === 'function' ? params : callback;
            if (typeof cb === 'function') cb(null, null);
        });

        mockDb.all.mockImplementation((sql, params, callback) => {
            const cb = typeof params === 'function' ? params : callback;
            if (typeof cb === 'function') cb(null, []);
        });

        // We use require to ensure it picked up the mocks
        const mod = require('../../../server/services/notificationService');
        NotificationService = mod.default || mod;
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
                const cb = typeof params === 'function' ? params : callback;
                if (typeof cb === 'function') cb(null, { mute_info: 1 });
            });

            const notification = {
                userId: 'user-123',
                organizationId: 'org-456',
                type: NotificationService.NOTIFICATION_TYPES.TASK_ASSIGNED,
                title: 'Test',
                message: 'Test',
                severity: 'INFO'
            };

            const result = await NotificationService.create(notification);
            expect(result).toBeNull();
        });
    });

    describe('getForUser', () => {
        it('should get notifications for user', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (typeof cb === 'function') cb(null, [
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
                const cb = typeof params === 'function' ? params : callback;
                if (typeof cb === 'function') cb(null, []);
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
