// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../server/database.js');

/**
 * Level 5: Performance Tests - Database Performance
 * Tests database query performance and scalability
 */
describe('Performance Test: Database', () => {
    let testOrgId;
    let testUserIds = [];

    beforeAll(async () => {
        await db.initPromise;

        // Create test data
        testOrgId = 'perf-org-' + Date.now();
        await new Promise((resolve) => {
            db.run(
                'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                [testOrgId, 'Performance Test Org', 'free', 'active'],
                resolve
            );
        });

        // Create test users
        for (let i = 0; i < 100; i++) {
            const userId = `perf-user-${i}-${Date.now()}`;
            testUserIds.push(userId);
            await new Promise((resolve) => {
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name) VALUES (?, ?, ?, ?, ?)',
                    [userId, testOrgId, `user${i}@test.com`, 'hash', `User${i}`],
                    resolve
                );
            });
        }

        // Create test projects
        for (let i = 0; i < 50; i++) {
            const projectId = `perf-project-${i}-${Date.now()}`;
            await new Promise((resolve) => {
                db.run(
                    'INSERT INTO projects (id, organization_id, name) VALUES (?, ?, ?)',
                    [projectId, testOrgId, `Project ${i}`],
                    resolve
                );
            });
        }
    });

    describe('Query Performance Benchmarks', () => {
        it('should execute simple SELECT in < 10ms', async () => {
            const startTime = Date.now();
            
            await new Promise((resolve) => {
                db.get('SELECT COUNT(*) as count FROM organizations', [], resolve);
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(10);
        });

        it('should execute JOIN query in < 50ms', async () => {
            const startTime = Date.now();

            await new Promise((resolve) => {
                db.all(
                    `SELECT u.*, o.name as org_name 
                     FROM users u 
                     LEFT JOIN organizations o ON u.organization_id = o.id 
                     WHERE u.organization_id = ? 
                     LIMIT 10`,
                    [testOrgId],
                    resolve
                );
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(50);
        });

        it('should execute aggregation query in < 100ms', async () => {
            const startTime = Date.now();

            await new Promise((resolve) => {
                db.all(
                    `SELECT organization_id, COUNT(*) as user_count 
                     FROM users 
                     GROUP BY organization_id 
                     HAVING COUNT(*) > 0`,
                    [],
                    resolve
                );
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(100);
        });

        it('should execute complex query with multiple JOINs in < 200ms', async () => {
            const startTime = Date.now();

            await new Promise((resolve) => {
                db.all(
                    `SELECT 
                        p.id, p.name, 
                        o.name as org_name,
                        COUNT(t.id) as task_count
                     FROM projects p
                     LEFT JOIN organizations o ON p.organization_id = o.id
                     LEFT JOIN tasks t ON t.project_id = p.id
                     WHERE p.organization_id = ?
                     GROUP BY p.id, p.name, o.name
                     LIMIT 20`,
                    [testOrgId],
                    resolve
                );
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(200);
        });
    });

    describe('Concurrent Operations', () => {
        it('should handle 50 concurrent SELECT queries', async () => {
            const queries = Array(50).fill(null).map(() =>
                new Promise((resolve) => {
                    db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
                        resolve(row?.count || 0);
                    });
                })
            );

            const startTime = Date.now();
            const results = await Promise.all(queries);
            const duration = Date.now() - startTime;

            expect(results.length).toBe(50);
            expect(duration).toBeLessThan(1000); // Should complete in < 1s
        });

        it('should handle 20 concurrent INSERT operations', async () => {
            const inserts = Array(20).fill(null).map((_, i) =>
                new Promise((resolve, reject) => {
                    const taskId = `perf-task-${i}-${Date.now()}`;
                    db.run(
                        'INSERT INTO tasks (id, organization_id, title, status) VALUES (?, ?, ?, ?)',
                        [taskId, testOrgId, `Task ${i}`, 'todo'],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                })
            );

            const startTime = Date.now();
            await Promise.all(inserts);
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(500); // Should complete in < 500ms
        });
    });

    describe('Bulk Operations', () => {
        it('should insert 100 records efficiently', async () => {
            const startTime = Date.now();

            await new Promise((resolve) => {
                db.serialize(() => {
                    const stmt = db.prepare(
                        'INSERT INTO tasks (id, organization_id, title, status) VALUES (?, ?, ?, ?)'
                    );

                    for (let i = 0; i < 100; i++) {
                        stmt.run(`bulk-task-${i}-${Date.now()}`, testOrgId, `Bulk Task ${i}`, 'todo');
                    }

                    stmt.finalize();
                    resolve();
                });
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(1000); // Should complete in < 1s
        });

        it('should update 100 records efficiently', async () => {
            // First create records
            const taskIds = [];
            for (let i = 0; i < 100; i++) {
                const taskId = `update-task-${i}-${Date.now()}`;
                taskIds.push(taskId);
                await new Promise((resolve) => {
                    db.run(
                        'INSERT INTO tasks (id, organization_id, title, status) VALUES (?, ?, ?, ?)',
                        [taskId, testOrgId, `Update Task ${i}`, 'todo'],
                        resolve
                    );
                });
            }

            const startTime = Date.now();

            await new Promise((resolve) => {
                db.serialize(() => {
                    const stmt = db.prepare('UPDATE tasks SET status = ? WHERE id = ?');
                    taskIds.forEach(id => {
                        stmt.run('completed', id);
                    });
                    stmt.finalize();
                    resolve();
                });
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(500); // Should complete in < 500ms
        });
    });

    describe('Index Performance', () => {
        it('should use indexes for WHERE clauses', async () => {
            const startTime = Date.now();

            await new Promise((resolve) => {
                db.all(
                    'SELECT * FROM users WHERE organization_id = ? LIMIT 10',
                    [testOrgId],
                    resolve
                );
            });

            const duration = Date.now() - startTime;
            // With index, should be fast
            expect(duration).toBeLessThan(50);
        });

        it('should use indexes for JOIN operations', async () => {
            const startTime = Date.now();

            await new Promise((resolve) => {
                db.all(
                    `SELECT u.*, o.name as org_name 
                     FROM users u 
                     JOIN organizations o ON u.organization_id = o.id 
                     WHERE u.organization_id = ?`,
                    [testOrgId],
                    resolve
                );
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(100);
        });
    });
});

