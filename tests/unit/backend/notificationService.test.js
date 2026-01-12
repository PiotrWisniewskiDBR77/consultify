import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { initTestDb, cleanTables, dbRun, dbAll, db } = require('../../helpers/dbHelper.cjs');
const NotificationService = require('../../../server/services/notificationService.js');
const { v4: uuidv4 } = require('uuid');

// Mock SlackService
const mockSlackService = {
    sendSystemAlert: vi.fn(),
    sendClientTicket: vi.fn(),
    sendNewFeedbackAlert: vi.fn()
};

describe('Backend Service Test: NotificationService', () => {
    let testUserId;
    let testOrgId;

    beforeAll(async () => {
        await initTestDb();
    });

    beforeEach(async () => {
        // Clean all related tables in correct order (respecting foreign keys)
        await cleanTables([
            'notifications', 
            'tasks', 
            'decisions', 
            'projects', 
            'users', 
            'organizations', 
            'notification_preferences', 
            'user_notification_settings'
        ]);

        testOrgId = uuidv4();
        testUserId = uuidv4();

        // Create organization first
        await dbRun('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [testOrgId, 'Test Org', 'free', 'active']);
        
        // Create user (depends on organization)
        await dbRun('INSERT INTO users (id, organization_id, email, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)', 
            [testUserId, testOrgId, `test-${Date.now()}@example.com`, 'Test', 'User', 'USER']);
        
        // Create project (depends on organization)
        await dbRun('INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)', 
            ['proj-1', testOrgId, 'Test Project', 'active']);

        // Inject DB for all tests by default
        NotificationService.setTestDependencies({ db, SlackService: mockSlackService });
    });

    afterEach(() => {
        vi.clearAllMocks();
        NotificationService.setTestDependencies({
            UserIntegrationService: null,
            UserNotificationPreferencesService: null,
            SlackUserIntegration: null,
            TeamsUserIntegration: null,
            SlackService: null
        });
    });

    describe('create', () => {
        it('creates a basic notification', async () => {
            const result = await NotificationService.create({
                userId: testUserId,
                organizationId: testOrgId,
                type: 'TEST_ALERT',
                title: 'Test Title',
                message: 'Test Message'
            });

            expect(result.id).toBeDefined();

            const rows = await dbAll('SELECT * FROM notifications WHERE id = ?', [result.id]);
            expect(rows).toHaveLength(1);
            expect(rows[0].title).toBe('Test Title');
        });

        it('prevents duplicates within 1 hour', async () => {
            const relatedId = 'obj-1';
            const result1 = await NotificationService.create({
                userId: testUserId,
                organizationId: testOrgId,
                type: 'DUPE_CHECK',
                relatedObjectId: relatedId,
                title: 'Title',
                message: 'Msg'
            });
            expect(result1.id).toBeDefined();

            await new Promise(r => setTimeout(r, 10));

            const result2 = await NotificationService.create({
                userId: testUserId,
                organizationId: testOrgId,
                type: 'DUPE_CHECK',
                relatedObjectId: relatedId,
                title: 'Title',
                message: 'Msg'
            });

            expect(result2).toBeNull();
        });

        it('triggers Slack system alert for SYSTEM_ALERT type', async () => {
            await NotificationService.create({
                userId: testUserId,
                organizationId: testOrgId,
                type: 'SYSTEM_ALERT',
                title: 'System Down',
                message: 'Panic'
            });

            expect(mockSlackService.sendSystemAlert).toHaveBeenCalledWith('System Down', 'Panic', 'CRITICAL');
        });
    });

    describe('getForUser', () => {
        beforeEach(async () => {
            await NotificationService.create({
                userId: testUserId,
                organizationId: testOrgId,
                type: 'N1',
                title: 'N1',
                message: 'M1'
            });
            await NotificationService.create({
                userId: testUserId,
                organizationId: testOrgId,
                type: 'N2',
                title: 'N2',
                message: 'M2'
            });
        });

        it('fetches all notifications for user', async () => {
            await new Promise(r => setTimeout(r, 10));
            const notifs = await NotificationService.getForUser(testUserId);
            expect(notifs).toHaveLength(2);
        });

        it('filters by unread', async () => {
            const all = await NotificationService.getForUser(testUserId);
            await NotificationService.markRead(all[1].id, testUserId);

            const unread = await NotificationService.getForUser(testUserId, { unreadOnly: true });
            expect(unread).toHaveLength(1);
        });
    });

    describe('Status Management', () => {
        beforeEach(async () => {
            await NotificationService.create({
                userId: testUserId,
                organizationId: testOrgId,
                type: 'N1',
                title: 'N1',
                message: 'M1'
            });
        });

        it('marks single notification as read', async () => {
            const [notif] = await NotificationService.getForUser(testUserId);
            expect(notif.isRead).toBe(false);

            await NotificationService.markRead(notif.id, testUserId);

            const [updated] = await NotificationService.getForUser(testUserId);
            expect(updated.isRead).toBe(true);
            expect(updated.readAt).toBeDefined();
        });

        it('marks all as read', async () => {
            await NotificationService.create({
                userId: testUserId,
                organizationId: testOrgId,
                type: 'N2',
                title: 'N2',
                message: 'M2'
            });

            const initial = await NotificationService.getForUser(testUserId);
            expect(initial.filter(n => !n.isRead)).toHaveLength(2);

            await NotificationService.markAllRead(testUserId);

            const updated = await NotificationService.getForUser(testUserId);
            expect(updated.filter(n => !n.isRead)).toHaveLength(0);
        });

        it('deletes a notification', async () => {
            const [notif] = await NotificationService.getForUser(testUserId);

            await NotificationService.delete(notif.id, testUserId);

            const updated = await NotificationService.getForUser(testUserId);
            expect(updated).toHaveLength(0);
        });

        it('gets correct counts', async () => {
            await NotificationService.create({
                userId: testUserId,
                organizationId: testOrgId,
                type: 'CRIT',
                severity: 'CRITICAL',
                title: 'Critical',
                message: 'Msg'
            });

            const counts = await NotificationService.getCounts(testUserId);
            // 1 normal (from beforeEach) + 1 critical = 2 total
            expect(counts).toEqual({
                total: 2,
                unread: 2,
                critical: 1
            });
        });
    });

    describe('User-Level Delivery (V2)', () => {
        let mockPrefsService;
        let mockSlackIntegration;

        beforeEach(() => {
            mockPrefsService = {
                shouldNotify: vi.fn(),
                isInQuietHours: vi.fn(),
                getChannelsForNotificationType: vi.fn()
            };
            mockSlackIntegration = {
                sendNotification: vi.fn()
            };

            NotificationService.setTestDependencies({
                UserIntegrationService: {},
                UserNotificationPreferencesService: mockPrefsService,
                SlackUserIntegration: mockSlackIntegration,
                SlackService: mockSlackService,
                db
            });
        });

        it('delivers to in_app and slack channels', async () => {
            mockPrefsService.shouldNotify.mockResolvedValue(true);
            mockPrefsService.getChannelsForNotificationType.mockResolvedValue(['in_app', 'slack']);
            mockSlackIntegration.sendNotification.mockResolvedValue(true);

            const result = await NotificationService.deliverNotification(testUserId, {
                type: 'TEST_MSG',
                title: 'V2 Test',
                message: 'Hello',
                organizationId: testOrgId
            });

            expect(result.delivered).toBe(true);
            expect(result.channels).toHaveLength(2);
            expect(mockSlackIntegration.sendNotification).toHaveBeenCalled();

            const dbNotifs = await NotificationService.getForUser(testUserId);
            const found = dbNotifs.find(n => n.title === 'V2 Test');
            expect(found).toBeDefined();
        });

        it('respects quiet hours', async () => {
            mockPrefsService.shouldNotify.mockResolvedValue(false);
            mockPrefsService.isInQuietHours.mockResolvedValue(true);

            const result = await NotificationService.deliverNotification(testUserId, {
                type: 'LOUD_NOISE',
                title: 'Wake Up',
                message: 'Nowait'
            });

            expect(result.queued).toBe(true);
            expect(result.reason).toBe('quiet_hours');
        });

        it('handles missing preferences service (fallback to create)', async () => {
            NotificationService.setTestDependencies({
                UserNotificationPreferencesService: null,
                db,
                SlackService: mockSlackService
            });

            const result = await NotificationService.deliverNotification(testUserId, {
                organizationId: testOrgId,
                type: 'FALLBACK',
                title: 'Legacy',
                message: 'Fallback'
            });

            expect(result.id).toBeDefined();
        });
    });

    describe('Watchers & Reminders', () => {
        it('notifies watchers based on preferences', async () => {
            const mockPrefs = {
                getWatchersForObject: vi.fn(),
                shouldNotify: vi.fn(), // Internal usage
                getChannelsForNotificationType: vi.fn().mockResolvedValue(['in_app']),
                isInQuietHours: vi.fn().mockResolvedValue(false)
            };

            NotificationService.setTestDependencies({
                // We don't fully mock UserIntegrationService but we need loadUserServices to pass check
                UserIntegrationService: {},
                UserNotificationPreferencesService: mockPrefs,
                db // Keep DB for in_app creation
            });

            // Mock watchers. Watcher 1 gets notification, Watcher 2 filters it out.
            await dbRun('INSERT INTO users (id, organization_id, email) VALUES (?, ?, ?)', ['watcher-1', testOrgId, 'watcher1@example.com']);
            await dbRun('INSERT INTO users (id, organization_id, email) VALUES (?, ?, ?)', ['watcher-2', testOrgId, 'watcher2@example.com']);
            mockPrefs.getWatchersForObject.mockResolvedValue([
                { user_id: 'watcher-1', notify_on: 'all' },
                { user_id: 'watcher-2', notify_on: 'mentions' }
            ]);

            // For deliverNotification to work, shouldNotify must be true
            mockPrefs.shouldNotify.mockResolvedValue(true);

            // Create notification that is NOT a mention
            const result = await NotificationService.notifyWatchers('TASK', 't-1', {
                type: 'UPDATE',
                title: 'Task Updated',
                message: 'Changed',
                organizationId: testOrgId,
                severity: 'INFO'
            });

            // Expect 1 successful notification
            expect(result.notified).toBe(1);
            expect(result.results.find(r => r.userId === 'watcher-1').delivered).toBe(true);
        });

        it('sends due reminder if not sent before', async () => {
            const mockPrefs = {
                wasReminderSent: vi.fn().mockResolvedValue(false),
                getDueReminderSettings: vi.fn().mockResolvedValue({ '1_hour': true }),
                markReminderSent: vi.fn(),
                shouldNotify: vi.fn().mockResolvedValue(true),
                getChannelsForNotificationType: vi.fn().mockResolvedValue(['in_app']),
                isInQuietHours: vi.fn().mockResolvedValue(false)
            };

            NotificationService.setTestDependencies({
                UserIntegrationService: {},
                UserNotificationPreferencesService: mockPrefs,
                db
            });

            const result = await NotificationService.sendDueReminder(
                testUserId, testOrgId, 'task-1', 'My Task', '1_hour', new Date().toISOString()
            );

            expect(result.sent).toBe(true);
            expect(mockPrefs.markReminderSent).toHaveBeenCalledWith(testUserId, 'task-1', '1_hour');
        });
    });

    describe('Convenience Methods', () => {
        beforeEach(async () => {
            // Create required entities for convenience methods
            // Task for notifyTaskAssigned (tasks table uses 'title', not 'name', and 'assignee_id', not 'assigned_to')
            await dbRun(
                'INSERT OR IGNORE INTO tasks (id, project_id, organization_id, title, status, assignee_id) VALUES (?, ?, ?, ?, ?, ?)',
                ['task-1', 'proj-1', testOrgId, 'My Task', 'todo', testUserId]
            );
            
            // Decision for notifyDecisionRequired (decisions table doesn't have organization_id column)
            await dbRun(
                'INSERT OR IGNORE INTO decisions (id, project_id, decision_type, related_object_type, related_object_id, title, status, decision_owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                ['dec-1', 'proj-1', 'OTHER', 'TASK', 'task-1', 'My Decision', 'PENDING', testUserId]
            );
        });

        it('creates task assigned notification', async () => {
            const result = await NotificationService.notifyTaskAssigned(testUserId, testOrgId, 'proj-1', 'task-1', 'My Task');
            expect(result.id).toBeDefined();
            expect(result.type).toBe('TASK_ASSIGNED');
            expect(result.title).toBe('Task Assigned');
        });

        it('creates decision required notification', async () => {
            const result = await NotificationService.notifyDecisionRequired(testUserId, testOrgId, 'proj-1', 'dec-1', 'My Decision');
            expect(result.id).toBeDefined();
            expect(result.type).toBe('DECISION_REQUIRED');
            expect(result.severity).toBe('WARNING');
        });

        it('creates AI risk notification', async () => {
            const result = await NotificationService.notifyAIRisk(testUserId, testOrgId, 'proj-1', 'Risk found');
            expect(result.id).toBeDefined();
            expect(result.type).toBe('AI_RISK_DETECTED');
        });
    });

    describe('Preferences Summary', () => {
        it('aggregates preferences and integrations', async () => {
            const mockPrefs = {
                getPreferences: vi.fn().mockResolvedValue({
                    globalEnabled: true,
                    schedule: { quietHoursEnabled: false },
                    digests: { dailyEnabled: true, weeklyEnabled: false }
                }),
                getWatchedObjects: vi.fn().mockResolvedValue([1, 2, 3])
            };
            const mockIntegrations = {
                getUserIntegrations: vi.fn().mockResolvedValue([
                    { provider: 'slack', status: 'active' },
                    { provider: 'teams', status: 'inactive' }
                ])
            };

            NotificationService.setTestDependencies({
                UserNotificationPreferencesService: mockPrefs,
                UserIntegrationService: mockIntegrations,
                db
            });

            const summary = await NotificationService.getUserPreferencesSummary(testUserId);

            expect(summary).toBeDefined();
            expect(summary.watchingCount).toBe(3);
            expect(summary.connectedChannels).toContain('slack');
            expect(summary.connectedChannels).not.toContain('teams');
            expect(summary.digestsEnabled).toBe(true);
        });
    });
});
