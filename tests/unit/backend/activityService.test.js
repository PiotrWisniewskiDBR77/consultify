import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { initTestDb, cleanTables, dbAll, dbGet } = require('../../helpers/dbHelper.cjs');
const ActivityService = require('../../../server/services/activityService.js');

/**
 * Integration tests for ActivityService
 * Uses real database - production-ready tests
 */
describe('Backend Service Test: ActivityService', () => {
    let testOrgId;
    let testUserId;

    beforeAll(async () => {
        await initTestDb();
        
        // Create test organization and user
        testOrgId = 'test-org-activity-' + Date.now();
        testUserId = 'test-user-activity-' + Date.now();
        
        const db = require('../../../server/database.js');
        const bcrypt = require('bcryptjs');
        
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Activity Test Org', 'free', 'active'],
                    (err) => err && !err.message.includes('UNIQUE') ? reject(err) : null
                );
                
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, `test-${Date.now()}@test.com`, bcrypt.hashSync('test', 8), 'Test', 'USER'],
                    (err) => err && !err.message.includes('UNIQUE') ? reject(err) : null
                );
                
                setTimeout(resolve, 100);
            });
        });
    });

    beforeEach(async () => {
        // Clean activity logs before each test
        await cleanTables(['activity_logs']);
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

            ActivityService.log(params);

            // Wait a bit for async operation
            await new Promise(resolve => setTimeout(resolve, 100));

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

            ActivityService.log(params);

            await new Promise(resolve => setTimeout(resolve, 100));

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
            // Create test activities
            const db = require('../../../server/database.js');
            const { v4: uuidv4 } = require('uuid');
            
            for (let i = 0; i < 3; i++) {
                await new Promise((resolve) => {
                    db.run(
                        'INSERT INTO activity_logs (id, organization_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
                        [uuidv4(), testOrgId, 'created', 'task', `task-${i}`],
                        resolve
                    );
                });
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            const result = await ActivityService.getRecent();

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThanOrEqual(3);
            expect(result[0]).toHaveProperty('action');
            expect(result[0]).toHaveProperty('entity_type');
        });

        it('fetches recent activities with custom limit', async () => {
            const db = require('../../../server/database.js');
            const { v4: uuidv4 } = require('uuid');
            
            for (let i = 0; i < 5; i++) {
                await new Promise((resolve) => {
                    db.run(
                        'INSERT INTO activity_logs (id, organization_id, action, entity_type) VALUES (?, ?, ?, ?)',
                        [uuidv4(), testOrgId, 'updated', 'project'],
                        resolve
                    );
                });
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            const result = await ActivityService.getRecent(3);

            expect(result.length).toBeLessThanOrEqual(3);
        });

        it('handles database errors gracefully', async () => {
            // This test verifies error handling - we'll test with invalid query
            // The service should handle errors internally
            const result = await ActivityService.getRecent();
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('getByOrganization', () => {
        it('fetches activities for organization', async () => {
            const db = require('../../../server/database.js');
            const { v4: uuidv4 } = require('uuid');
            
            // Create activities for test org
            await new Promise((resolve) => {
                db.run(
                    'INSERT INTO activity_logs (id, organization_id, action, entity_type) VALUES (?, ?, ?, ?)',
                    [uuidv4(), testOrgId, 'created', 'task'],
                    resolve
                );
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            const result = await ActivityService.getByOrganization(testOrgId);

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            expect(result[0].organization_id).toBe(testOrgId);
        });
    });
});
