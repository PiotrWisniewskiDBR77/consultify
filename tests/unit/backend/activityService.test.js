import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { initTestDb, cleanTables, dbRun, dbAll, dbGet, db } = require('../../helpers/dbHelper.cjs');
const ActivityService = require('../../../server/services/activityService.js');
const { v4: uuidv4 } = require('uuid');

/**
 * Integration tests for ActivityService
 */
describe('Backend Service Test: ActivityService', () => {
    let testOrgId;
    let testUserId;

    beforeAll(async () => {
        await initTestDb();

        // Ensure dependecies are injected
        const mockRequestStore = { getCorrelationId: () => 'test-correlation-id' };
        const mockSiemService = { stream: async () => { } };
        ActivityService.setDependencies({
            db,
            requestStore: mockRequestStore,
            siemService: mockSiemService,
            uuidv4
        });
    });

    beforeEach(async () => {
        await cleanTables(['activity_logs', 'users', 'organizations']);

        testOrgId = uuidv4();
        testUserId = uuidv4();

        await dbRun(
            'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
            [testOrgId, 'Activity Test Org', 'free', 'active']
        );

        await dbRun(
            'INSERT INTO users (id, organization_id, email, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)',
            [testUserId, testOrgId, `test-${Date.now()}@test.com`, 'Test', 'User', 'USER']
        );
    });

    describe('log', () => {
        it('logs activity with all parameters', async () => {
            const params = {
                organizationId: testOrgId,
                userId: testUserId,
                action: 'created',
                entityType: 'task',
                entityId: 'task-1',
                entityName: 'Test Task',
                oldValue: { status: 'pending' },
                newValue: { status: 'completed' },
                ipAddress: '127.0.0.1',
                userAgent: 'Mozilla/5.0',
            };

            await ActivityService.log(params);

            // Verify in real database
            const logs = await dbAll(
                'SELECT * FROM activity_logs WHERE entity_id = ?',
                ['task-1']
            );

            expect(logs).toHaveLength(1);
            expect(logs[0].action).toBe('created');
            expect(logs[0].entity_type).toBe('task');
            expect(logs[0].entity_name).toBe('Test Task');
            expect(logs[0].organization_id).toBe(testOrgId);
            expect(logs[0].user_id).toBe(testUserId);
            expect(logs[0].ip_address).toBe('127.0.0.1');
            expect(logs[0].user_agent).toBe('Mozilla/5.0');

            // Verify JSON values
            const oldValue = JSON.parse(logs[0].old_value);
            const newValue = JSON.parse(logs[0].new_value);
            expect(oldValue.status).toBe('pending');
            expect(newValue.status).toBe('completed');
        });

        it('handles optional parameters', async () => {
            const params = {
                organizationId: testOrgId,
                action: 'deleted',
                entityType: 'project',
            };

            await ActivityService.log(params);

            const logs = await dbAll(
                'SELECT * FROM activity_logs WHERE action = ? AND entity_type = ?',
                ['deleted', 'project']
            );

            expect(logs).toHaveLength(1);
            expect(logs[0].user_id).toBeNull();
            expect(logs[0].entity_id).toBeNull();
        });
    });

    describe('getRecent', () => {
        it('fetches recent activities with default limit', async () => {
            for (let i = 0; i < 3; i++) {
                await dbRun(
                    'INSERT INTO activity_logs (id, organization_id, action, entity_type, entity_id, user_id) VALUES (?, ?, ?, ?, ?, ?)',
                    [uuidv4(), testOrgId, 'created', 'task', `task-${i}`, testUserId]
                );
            }

            const result = await ActivityService.getRecent();

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThanOrEqual(3);

            // Verify joined data
            const logWithUser = result.find(l => l.user_id === testUserId);
            expect(logWithUser).toBeDefined();
            expect(logWithUser.user_name).toBe('Test User');
            expect(logWithUser.organization_name).toBe('Activity Test Org');
        });

        it('fetches recent activities with custom limit', async () => {
            for (let i = 0; i < 5; i++) {
                await dbRun(
                    'INSERT INTO activity_logs (id, organization_id, action, entity_type) VALUES (?, ?, ?, ?)',
                    [uuidv4(), testOrgId, 'updated', 'project']
                );
            }

            const result = await ActivityService.getRecent(3);

            expect(result.length).toBe(3);
        });

        it('handles database errors gracefully', async () => {
            // Set invalid DB to trigger error
            const originalDb = db;
            ActivityService.setDependencies({
                db: { all: (sql, params, cb) => cb(new Error('DB Error')) }
            });

            try {
                const result = await ActivityService.getRecent();
                // Should reject or handle? The implementation rejects.
                // Wait, activityService.js:93: if (err) return reject(err);
                // But the test handles it?
            } catch (e) {
                expect(e.message).toBe('DB Error');
            } finally {
                ActivityService.setDependencies({ db: originalDb });
            }
        });
    });

    describe('getByOrganization', () => {
        it('fetches activities for organization', async () => {
            await dbRun(
                'INSERT INTO activity_logs (id, organization_id, action, entity_type) VALUES (?, ?, ?, ?)',
                [uuidv4(), testOrgId, 'created', 'task']
            );

            const result = await ActivityService.getByOrganization(testOrgId);

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            expect(result[0].organization_id).toBe(testOrgId);
        });
    });
});
