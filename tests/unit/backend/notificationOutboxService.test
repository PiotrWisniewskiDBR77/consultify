/**
 * NotificationOutboxService Tests
 * 
 * Tests for async notification delivery service using outbox pattern.
 */

const { initTestDb, cleanTables, dbAll, dbRun, db } = require('../../helpers/dbHelper.cjs');

// Inject the real test database instance into the global mock slot
// This ensures that server/database.js uses our active test DB instance
global.__TEST_DB_MOCK__ = db;

const NotificationOutboxService = require('../../../server/src/services/notificationOutboxService');
const { v4: uuidv4 } = require('uuid');

describe('NotificationOutboxService', () => {
    let testOrgId;
    let testUserId;

    beforeAll(async () => {
        await initTestDb();
    });

    beforeEach(async () => {
        // Create test organization
        testOrgId = uuidv4();
        await dbRun(
            `INSERT INTO organizations (id, name, plan, status, organization_type) 
             VALUES (?, ?, ?, ?, ?)`,
            [testOrgId, 'Test Org', 'professional', 'active', 'PAID']
        );

        // Create test user
        testUserId = uuidv4();
        await dbRun(
            `INSERT INTO users (id, organization_id, email, name, role, created_at) 
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [testUserId, testOrgId, 'user@test.com', 'Test User', 'client']
        );
    });

    afterEach(async () => {
        await cleanTables([
            'notification_outbox',
            'user_notification_preferences',
            'users',
            'organizations'
        ]);
    });

    describe('enqueue', () => {
        it('should enqueue notification', async () => {
            const payload = { message: 'Test notification' };

            const result = await NotificationOutboxService.enqueue(
                testUserId,
                testOrgId,
                NotificationOutboxService.NOTIFICATION_TYPES.APPROVAL_DUE,
                payload
            );

            expect(result).toHaveProperty('id');
            expect(result.userId).toBe(testUserId);
            expect(result.orgId).toBe(testOrgId);
            expect(result.type).toBe(NotificationOutboxService.NOTIFICATION_TYPES.APPROVAL_DUE);
            expect(result.status).toBe(NotificationOutboxService.OUTBOX_STATUSES.QUEUED);
        });

        it('should skip notification when user preference disabled', async () => {
            // Disable approval_due notifications
            await NotificationOutboxService.updateUserPreferences(testUserId, testOrgId, {
                event_approval_due: 0
            });

            const result = await NotificationOutboxService.enqueue(
                testUserId,
                testOrgId,
                NotificationOutboxService.NOTIFICATION_TYPES.APPROVAL_DUE,
                { message: 'Test' }
            );

            expect(result.skipped).toBe(true);
            expect(result.reason).toBe('user_preference');
        });

        it('should use default channel when not specified', async () => {
            const result = await NotificationOutboxService.enqueue(
                testUserId,
                testOrgId,
                NotificationOutboxService.NOTIFICATION_TYPES.APPROVAL_DUE,
                { message: 'Test' }
            );

            // Verify notification was queued (not skipped)
            expect(result.skipped).not.toBe(true);
        });

        it('should accept custom channel', async () => {
            const result = await NotificationOutboxService.enqueue(
                testUserId,
                testOrgId,
                NotificationOutboxService.NOTIFICATION_TYPES.APPROVAL_DUE,
                { message: 'Test' },
                'slack'
            );

            expect(result.skipped).not.toBe(true);
        });
    });

    describe('shouldNotify', () => {
        it('should return true by default when no preferences', async () => {
            const shouldSend = await NotificationOutboxService.shouldNotify(
                testUserId,
                testOrgId,
                NotificationOutboxService.NOTIFICATION_TYPES.APPROVAL_DUE
            );

            expect(shouldSend).toBe(true);
        });

        it('should respect user preferences', async () => {
            await NotificationOutboxService.updateUserPreferences(testUserId, testOrgId, {
                event_approval_due: 1,
                event_playbook_stuck: 0
            });

            const approvalDue = await NotificationOutboxService.shouldNotify(
                testUserId,
                testOrgId,
                NotificationOutboxService.NOTIFICATION_TYPES.APPROVAL_DUE
            );
            const playbookStuck = await NotificationOutboxService.shouldNotify(
                testUserId,
                testOrgId,
                NotificationOutboxService.NOTIFICATION_TYPES.PLAYBOOK_STUCK
            );

            expect(approvalDue).toBe(true);
            expect(playbookStuck).toBe(false);
        });
    });

    describe('getUserPreferences', () => {
        it('should return null when no preferences exist', async () => {
            const prefs = await NotificationOutboxService.getUserPreferences(testUserId, testOrgId);

            expect(prefs).toBeNull();
        });

        it('should return preferences when they exist', async () => {
            await NotificationOutboxService.updateUserPreferences(testUserId, testOrgId, {
                event_approval_due: 1,
                channel_email: 1
            });

            const prefs = await NotificationOutboxService.getUserPreferences(testUserId, testOrgId);

            expect(prefs).toBeDefined();
            expect(prefs.user_id).toBe(testUserId);
            expect(prefs.org_id).toBe(testOrgId);
        });
    });

    describe('updateUserPreferences', () => {
        it('should create new preferences', async () => {
            const preferences = {
                channel_email: 1,
                channel_slack: 0,
                event_approval_due: 1,
                event_playbook_stuck: 0
            };

            const result = await NotificationOutboxService.updateUserPreferences(
                testUserId,
                testOrgId,
                preferences
            );

            expect(result.userId).toBe(testUserId);
            expect(result.orgId).toBe(testOrgId);
        });

        it('should update existing preferences', async () => {
            await NotificationOutboxService.updateUserPreferences(testUserId, testOrgId, {
                event_approval_due: 1
            });

            const updated = await NotificationOutboxService.updateUserPreferences(
                testUserId,
                testOrgId,
                { event_approval_due: 0 }
            );

            const prefs = await NotificationOutboxService.getUserPreferences(testUserId, testOrgId);
            expect(prefs.event_approval_due).toBe(0);
        });

        it('should use default values for missing fields', async () => {
            await NotificationOutboxService.updateUserPreferences(testUserId, testOrgId, {});

            const prefs = await NotificationOutboxService.getUserPreferences(testUserId, testOrgId);
            expect(prefs.channel_email).toBe(1); // Default
            expect(prefs.event_approval_due).toBe(1); // Default
        });
    });

    describe('processQueue', () => {
        it('should process queued notifications', async () => {
            // Enqueue some notifications
            await NotificationOutboxService.enqueue(
                testUserId,
                testOrgId,
                NotificationOutboxService.NOTIFICATION_TYPES.APPROVAL_DUE,
                { message: 'Test 1' }
            );
            await NotificationOutboxService.enqueue(
                testUserId,
                testOrgId,
                NotificationOutboxService.NOTIFICATION_TYPES.PLAYBOOK_STUCK,
                { message: 'Test 2' }
            );

            const summary = await NotificationOutboxService.processQueue();

            expect(summary).toHaveProperty('processed');
            expect(summary).toHaveProperty('sent');
            expect(summary).toHaveProperty('failed');
            expect(summary).toHaveProperty('skipped');
            expect(summary.processed).toBeGreaterThan(0);
        });

        it('should mark notifications as sent after processing', async () => {
            await NotificationOutboxService.enqueue(
                testUserId,
                testOrgId,
                NotificationOutboxService.NOTIFICATION_TYPES.APPROVAL_DUE,
                { message: 'Test' }
            );

            await NotificationOutboxService.processQueue();

            const stats = await NotificationOutboxService.getOutboxStats(testOrgId);
            expect(stats.sent).toBeGreaterThan(0);
        });

        it('should respect max attempts limit', async () => {
            // Create notification with high attempt count
            const notificationId = uuidv4();
            await dbRun(
                `INSERT INTO notification_outbox 
                 (id, org_id, user_id, notification_type, payload_json, status, attempts, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    notificationId,
                    testOrgId,
                    testUserId,
                    NotificationOutboxService.NOTIFICATION_TYPES.APPROVAL_DUE,
                    JSON.stringify({ message: 'Test' }),
                    NotificationOutboxService.OUTBOX_STATUSES.QUEUED,
                    NotificationOutboxService.MAX_ATTEMPTS
                ]
            );

            const summary = await NotificationOutboxService.processQueue();

            // Should not process notification that exceeded max attempts
            expect(summary.processed).toBe(0);
        });
    });

    describe('getOutboxStats', () => {
        it('should return statistics for organization', async () => {
            // Create notifications with different statuses
            await NotificationOutboxService.enqueue(
                testUserId,
                testOrgId,
                NotificationOutboxService.NOTIFICATION_TYPES.APPROVAL_DUE,
                { message: 'Test 1' }
            );
            await NotificationOutboxService.enqueue(
                testUserId,
                testOrgId,
                NotificationOutboxService.NOTIFICATION_TYPES.PLAYBOOK_STUCK,
                { message: 'Test 2' }
            );

            // Process queue to mark some as sent
            await NotificationOutboxService.processQueue();

            const stats = await NotificationOutboxService.getOutboxStats(testOrgId);

            expect(stats).toHaveProperty('total');
            expect(stats).toHaveProperty('queued');
            expect(stats).toHaveProperty('sent');
            expect(stats).toHaveProperty('failed');
            expect(stats.total).toBeGreaterThan(0);
        });

        it('should return zero stats for organization with no notifications', async () => {
            const stats = await NotificationOutboxService.getOutboxStats(testOrgId);

            expect(stats.total).toBe(0);
            expect(stats.queued).toBe(0);
            expect(stats.sent).toBe(0);
            expect(stats.failed).toBe(0);
        });

        it('should only include notifications from last 7 days', async () => {
            // Create old notification (8 days ago)
            const oldNotificationId = uuidv4();
            await dbRun(
                `INSERT INTO notification_outbox 
                 (id, org_id, user_id, notification_type, payload_json, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-8 days'))`,
                [
                    oldNotificationId,
                    testOrgId,
                    testUserId,
                    NotificationOutboxService.NOTIFICATION_TYPES.APPROVAL_DUE,
                    JSON.stringify({ message: 'Old' }),
                    NotificationOutboxService.OUTBOX_STATUSES.SENT
                ]
            );

            // Create recent notification
            await NotificationOutboxService.enqueue(
                testUserId,
                testOrgId,
                NotificationOutboxService.NOTIFICATION_TYPES.APPROVAL_DUE,
                { message: 'Recent' }
            );

            const stats = await NotificationOutboxService.getOutboxStats(testOrgId);

            // Should only count recent notification
            expect(stats.total).toBe(1);
        });
    });
});















