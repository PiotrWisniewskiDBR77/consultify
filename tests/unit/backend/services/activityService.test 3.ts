/**
 * Activity Service Tests
 * Real database integration tests - no mocks, real assertions
 * 
 * @module tests/unit/backend/services/activityService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

// Import the actual service - use default export
import activityService from '../../../../server/src/services/ActivityService.js';
import type { ActivityLogParams } from '../../../../server/src/services/ActivityService.js';

describe('ActivityService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        // Create in-memory SQLite database
        db = new sqlite3.Database(':memory:');

        // Create required tables
        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS activity_logs (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        user_id TEXT,
                        action TEXT NOT NULL,
                        entity_type TEXT NOT NULL,
                        entity_id TEXT,
                        entity_name TEXT,
                        old_value TEXT,
                        new_value TEXT,
                        ip_address TEXT,
                        user_agent TEXT,
                        correlation_id TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        email TEXT,
                        first_name TEXT,
                        last_name TEXT,
                        organization_id TEXT
                    )
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });

        // Inject test database
        activityService.setDependencies({ db });
    });

    afterAll(() => {
        db.close();
    });

    beforeEach(async () => {
        // Clear activity_logs before each test
        await new Promise<void>((resolve) => {
            db.run('DELETE FROM activity_logs', () => resolve());
        });
    });

    describe('log', () => {
        it('should log an activity with all parameters', async () => {
            const params: ActivityLogParams = {
                organizationId: 'org-123',
                userId: 'user-456',
                action: 'CREATE',
                entityType: 'task',
                entityId: 'task-789',
                entityName: 'Test Task',
                oldValue: null,
                newValue: { title: 'My Task' },
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
            };

            await activityService.log(params);

            // Verify the log was created
            const logs = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM activity_logs', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(logs).toHaveLength(1);
            expect(logs[0].organization_id).toBe('org-123');
            expect(logs[0].user_id).toBe('user-456');
            expect(logs[0].action).toBe('CREATE');
            expect(logs[0].entity_type).toBe('task');
            expect(logs[0].entity_id).toBe('task-789');
            expect(logs[0].ip_address).toBe('192.168.1.1');
        });

        it('should handle minimal activity log parameters', async () => {
            const params: ActivityLogParams = {
                organizationId: 'org-minimal',
                action: 'LOGIN',
                entityType: 'session',
            };

            await activityService.log(params);

            const logs = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM activity_logs WHERE organization_id = ?', ['org-minimal'], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(logs).toHaveLength(1);
            expect(logs[0].action).toBe('LOGIN');
            expect(logs[0].user_id).toBeNull();
            expect(logs[0].entity_id).toBeNull();
        });

        it('should serialize metadata to JSON', async () => {
            const params: ActivityLogParams = {
                organizationId: 'org-meta',
                action: 'UPDATE',
                entityType: 'settings',
                metadata: { theme: 'dark', notifications: true },
            };

            await activityService.log(params);

            const logs = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM activity_logs WHERE organization_id = ?', ['org-meta'], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(logs).toHaveLength(1);
            const parsed = JSON.parse(logs[0].new_value);
            expect(parsed.theme).toBe('dark');
            expect(parsed.notifications).toBe(true);
        });
    });

    describe('getRecent', () => {
        it('should return recent activities ordered by created_at DESC', async () => {
            // Insert test data
            await activityService.log({
                organizationId: 'org-1', action: 'ACTION_1', entityType: 'type'
            });
            await activityService.log({
                organizationId: 'org-2', action: 'ACTION_2', entityType: 'type'
            });
            await activityService.log({
                organizationId: 'org-3', action: 'ACTION_3', entityType: 'type'
            });

            const recent = await activityService.getRecent(2);

            expect(recent).toHaveLength(2);
            // Most recent should be first
            expect(recent[0].action).toBe('ACTION_3');
            expect(recent[1].action).toBe('ACTION_2');
        });

        it('should respect limit parameter', async () => {
            for (let i = 0; i < 10; i++) {
                await activityService.log({
                    organizationId: `org-${i}`, action: `ACTION_${i}`, entityType: 'type'
                });
            }

            const recent = await activityService.getRecent(5);
            expect(recent).toHaveLength(5);
        });
    });

    describe('getByOrganization', () => {
        it('should filter activities by organization', async () => {
            await activityService.log({
                organizationId: 'org-A', action: 'ACTION_A1', entityType: 'type'
            });
            await activityService.log({
                organizationId: 'org-B', action: 'ACTION_B1', entityType: 'type'
            });
            await activityService.log({
                organizationId: 'org-A', action: 'ACTION_A2', entityType: 'type'
            });

            const orgALogs = await activityService.getByOrganization('org-A');

            expect(orgALogs).toHaveLength(2);
            expect(orgALogs.every(log => log.organization_id === 'org-A')).toBe(true);
        });

        it('should return empty array for non-existent organization', async () => {
            const logs = await activityService.getByOrganization('non-existent-org');
            expect(logs).toEqual([]);
        });
    });
});
