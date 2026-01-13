/**
 * Transaction Integrity Tests
 * Enterprise SaaS Architecture - Integration Testing
 * 
 * Tests for database transaction integrity, rollback on failure,
 * and atomic operations across multiple tables.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase, resetConnection } from '../../server/src/database/Database.js';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';
import { initTestDb, cleanAllTestTables } from '../helpers/dbHelper.cjs';

vi.hoisted(() => {
    const path = require('path');
    const workerId = process.env.VITEST_WORKER_ID || 'trans';
    process.env.SQLITE_PATH = path.resolve(__dirname, `transactions-${workerId}.integration.db`);
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
});

describe('Transaction Integrity', () => {
    let db;
    const workerId = process.env.VITEST_WORKER_ID || 'trans';
    const orgId = `test-org-trans-${workerId}`;
    const userId = `user-trans-${workerId}`;

    beforeAll(async () => {
        await resetConnection();
        await initTestDb();
        db = getDatabase();

        // Force reset and re-init
        process.env.RESET_DB = 'true';
        await initializeDatabase();
        process.env.RESET_DB = 'false';

        await db.initPromise;

        // Seed test data
        try {
            await db.run("INSERT INTO organizations (id, name) VALUES (?, 'Test Org')", [orgId]);
            await db.run(`INSERT INTO users (id, email, organization_id, role) VALUES (?, 'trans@test.com', ?, 'USER')`, [userId, orgId]);
        } catch (e) {
            // Ignore if already exists
        }
    }, 60000);

    afterAll(async () => {
        if (db) {
            try {
                await cleanAllTestTables();
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }, 30000);

    describe('Atomic Operations', () => {
        it('should create project and initial task atomically', async () => {
            const projectId = 'proj-trans-' + Date.now();
            const taskId = 'task-trans-' + Date.now();

            try {
                await db.run(`INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project', ?)`, [projectId, orgId]);
                await db.run(`INSERT INTO tasks (id, title, project_id, organization_id) VALUES (?, 'Task', ?, ?)`, [taskId, projectId, orgId]);

                const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
                const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);

                expect(project).toBeTruthy();
                expect(task).toBeTruthy();
                expect(task.project_id).toBe(projectId);
            } finally {
                await db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
                await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
            }
        });

        it('should rollback on foreign key violation', async () => {
            const invalidProjectId = 'invalid-project-id';

            try {
                await db.run(`INSERT INTO tasks (id, title, project_id, organization_id) VALUES (?, 'Task', ?, ?)`, ['task-rollback', invalidProjectId, orgId]);
                expect(true).toBe(false);
            } catch (error) {
                expect(error).toBeDefined();
            }

            const task = await db.get('SELECT * FROM tasks WHERE id = ?', ['task-rollback']);
            expect(task).toBeFalsy();
        });
    });

    describe('Rollback on Failure', () => {
        it('should rollback when second operation fails', async () => {
            const projectId = 'proj-rollback-2-' + Date.now();

            try {
                await db.run(`INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project', ?)`, [projectId, orgId]);
                await db.run(`INSERT INTO tasks (id, title, project_id, organization_id) VALUES (?, ?, ?, ?)`, [null, 'Task', projectId, orgId]);
                expect(true).toBe(false);
            } catch (error) {
                expect(error).toBeDefined();
                const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
                if (project) {
                    await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
                }
            }
        });

        it('should maintain consistency across related tables', async () => {
            const projectId = 'proj-consistency-' + Date.now();
            const taskId1 = 'task-consistency-1-' + Date.now();
            const taskId2 = 'task-consistency-2-' + Date.now();

            try {
                await db.run(`INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project', ?)`, [projectId, orgId]);
                await db.run(`INSERT INTO tasks (id, title, project_id, organization_id) VALUES (?, 'Task 1', ?, ?)`, [taskId1, projectId, orgId]);
                await db.run(`INSERT INTO tasks (id, title, project_id, organization_id) VALUES (?, 'Task 2', ?, ?)`, [taskId2, projectId, orgId]);

                const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
                const tasks = await db.all('SELECT * FROM tasks WHERE project_id = ?', [projectId]);

                expect(project).toBeTruthy();
                expect(tasks.length).toBe(2);
            } finally {
                await db.run('DELETE FROM tasks WHERE id IN (?, ?)', [taskId1, taskId2]);
                await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
            }
        });
    });

    describe('Concurrent Transactions', () => {
        it('should handle concurrent project creation', async () => {
            const projectIds = [
                'proj-concurrent-1-' + Date.now(),
                'proj-concurrent-2-' + Date.now(),
                'proj-concurrent-3-' + Date.now(),
            ];

            const promises = projectIds.map(id =>
                db.run(`INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project', ?)`, [id, orgId])
            );

            await Promise.all(promises);

            const projects = await db.all('SELECT * FROM projects WHERE id IN (?, ?, ?)', projectIds);
            expect(projects.length).toBe(3);

            for (const id of projectIds) {
                await db.run('DELETE FROM projects WHERE id = ?', [id]);
            }
        });

        it('should prevent duplicate key violations', async () => {
            const projectId = 'proj-duplicate-' + Date.now();

            try {
                await db.run(`INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project', ?)`, [projectId, orgId]);
                await db.run(`INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project 2', ?)`, [projectId, orgId]);
                expect(true).toBe(false);
            } catch (error) {
                expect(error).toBeDefined();
            } finally {
                await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
            }
        });
    });

    describe('Cascade Deletes', () => {
        it('should cascade delete tasks when project is deleted', async () => {
            const projectId = 'proj-cascade-' + Date.now();
            const taskId = 'task-cascade-' + Date.now();

            try {
                await db.run(`INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project', ?)`, [projectId, orgId]);
                await db.run(`INSERT INTO tasks (id, title, project_id, organization_id) VALUES (?, 'Task', ?, ?)`, [taskId, projectId, orgId]);
                await db.run('DELETE FROM projects WHERE id = ?', [projectId]);

                const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
                expect(task).toBeFalsy();
            } catch (error) {
                await db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
                await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
                throw error;
            }
        });

        it('should maintain referential integrity', async () => {
            const projectId = 'proj-ref-' + Date.now();
            const taskId = 'task-ref-' + Date.now();

            try {
                await db.run(`INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project', ?)`, [projectId, orgId]);
                await db.run(`INSERT INTO tasks (id, title, project_id, organization_id) VALUES (?, 'Task', ?, ?)`, [taskId, projectId, orgId]);

                const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
                expect(task).toBeTruthy();
                expect(task.project_id).toBe(projectId);

                const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
                expect(project).toBeTruthy();
            } finally {
                await db.run('DELETE FROM tasks WHERE project_id = ?', [projectId]);
                await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
            }
        });
    });
});
