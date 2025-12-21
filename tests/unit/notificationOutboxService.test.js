import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit Tests for NotificationOutboxService
 * Step 16: Tests notification outbox pattern and user preferences
 */

describe('NotificationOutboxService Constants and Logic', () => {
    let NotificationOutboxService;

    beforeEach(async () => {
        vi.resetModules();

        // Mock database
        vi.doMock('../../server/database', () => ({
            default: {
                run: vi.fn((sql, params, cb) => {
                    if (typeof params === 'function') params(null);
                    else if (cb) cb.call({ changes: 1 }, null);
                }),
                get: vi.fn((sql, params, cb) => cb(null, null)),
                all: vi.fn((sql, params, cb) => cb(null, []))
            }
        }));

        vi.doMock('../../server/utils/auditLogger', () => ({
            default: {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
                debug: vi.fn()
            }
        }));

        vi.doMock('uuid', () => ({
            v4: () => 'test-uuid-notif'
        }));

        NotificationOutboxService = (await import('../../server/services/notificationOutboxService')).default;
    });

    describe('NOTIFICATION_TYPES Constants', () => {
        it('should export APPROVAL_DUE type', () => {
            expect(NotificationOutboxService.NOTIFICATION_TYPES).toBeDefined();
            expect(NotificationOutboxService.NOTIFICATION_TYPES.APPROVAL_DUE).toBe('APPROVAL_DUE');
        });

        it('should export PLAYBOOK_STUCK type', () => {
            expect(NotificationOutboxService.NOTIFICATION_TYPES.PLAYBOOK_STUCK).toBe('PLAYBOOK_STUCK');
        });

        it('should export DEAD_LETTER type', () => {
            expect(NotificationOutboxService.NOTIFICATION_TYPES.DEAD_LETTER).toBe('DEAD_LETTER');
        });

        it('should export ESCALATION type', () => {
            expect(NotificationOutboxService.NOTIFICATION_TYPES.ESCALATION).toBe('ESCALATION');
        });

        it('should have 4 notification types', () => {
            expect(Object.keys(NotificationOutboxService.NOTIFICATION_TYPES)).toHaveLength(4);
        });
    });

    describe('OUTBOX_STATUSES Constants', () => {
        it('should export QUEUED status', () => {
            expect(NotificationOutboxService.OUTBOX_STATUSES.QUEUED).toBe('QUEUED');
        });

        it('should export SENT status', () => {
            expect(NotificationOutboxService.OUTBOX_STATUSES.SENT).toBe('SENT');
        });

        it('should export FAILED status', () => {
            expect(NotificationOutboxService.OUTBOX_STATUSES.FAILED).toBe('FAILED');
        });
    });

    describe('MAX_ATTEMPTS', () => {
        it('should be 3', () => {
            expect(NotificationOutboxService.MAX_ATTEMPTS).toBe(3);
        });
    });

    describe('Service Methods Existence', () => {
        it('should export enqueue', () => {
            expect(typeof NotificationOutboxService.enqueue).toBe('function');
        });

        it('should export shouldNotify', () => {
            expect(typeof NotificationOutboxService.shouldNotify).toBe('function');
        });

        it('should export getUserPreferences', () => {
            expect(typeof NotificationOutboxService.getUserPreferences).toBe('function');
        });

        it('should export updateUserPreferences', () => {
            expect(typeof NotificationOutboxService.updateUserPreferences).toBe('function');
        });

        it('should export processQueue', () => {
            expect(typeof NotificationOutboxService.processQueue).toBe('function');
        });

        it('should export getOutboxStats', () => {
            expect(typeof NotificationOutboxService.getOutboxStats).toBe('function');
        });
    });
});

describe('NotificationOutboxService User Preferences', () => {
    it('should return true when no preferences set (default behavior)', async () => {
        vi.resetModules();

        const mockDb = {
            get: vi.fn((sql, params, cb) => cb(null, null)), // No prefs found
            all: vi.fn(),
            run: vi.fn()
        };

        vi.doMock('../../server/database', () => ({ default: mockDb }));
        vi.doMock('../../server/utils/auditLogger', () => ({
            default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
        }));
        vi.doMock('uuid', () => ({ v4: () => 'test-uuid' }));

        const NotificationOutboxService = (await import('../../server/services/notificationOutboxService')).default;
        const result = await NotificationOutboxService.shouldNotify('user-1', 'org-1', 'APPROVAL_DUE');

        expect(result).toBe(true);
    });
});
