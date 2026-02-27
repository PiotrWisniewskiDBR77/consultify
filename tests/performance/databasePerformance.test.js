// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import db from '../../server/database.js';

/**
 * Level 5: Performance Tests - Database Performance
 * Tests database query performance and scalability
 */
const getLimit = (name, fallback) => {
    const raw = process.env[name];
    const value = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

const LIMITS = {
    simpleSelectMs: getLimit('PERF_DB_SIMPLE_SELECT_MS', 50),
    joinMs: getLimit('PERF_DB_JOIN_MS', 150),
    aggregationMs: getLimit('PERF_DB_AGG_MS', 300),
    complexJoinMs: getLimit('PERF_DB_COMPLEX_JOIN_MS', 500),
    concurrentSelectsMs: getLimit('PERF_DB_CONCURRENT_SELECTS_MS', 2000),
    concurrentInsertsMs: getLimit('PERF_DB_CONCURRENT_INSERTS_MS', 1000),
    bulkInsertMs: getLimit('PERF_DB_BULK_INSERT_MS', 2000),
    bulkUpdateMs: getLimit('PERF_DB_BULK_UPDATE_MS', 2000),
    indexWhereMs: getLimit('PERF_DB_INDEX_WHERE_MS', 150),
    indexJoinMs: getLimit('PERF_DB_INDEX_JOIN_MS', 200),
};

const dbIsMock = Boolean(db && db.isMock);
const describeIfRealDb = dbIsMock ? describe.skip : describe;

describeIfRealDb('Performance Test: Database', () => {
    let testOrgId;
    let testUserIds = [];

    beforeAll(async () => {
        if (dbIsMock) return;
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
        it(`should execute simple SELECT in < ${LIMITS.simpleSelectMs}ms`, async () => {
            const startTime = Date.now();

            await new Promise((resolve) => {
                db.get('SELECT COUNT(*) as count FROM organizations', [], resolve);
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(LIMITS.simpleSelectMs);
        });

        it(`should execute JOIN query in < ${LIMITS.joinMs}ms`, async () => {
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
            expect(duration).toBeLessThan(LIMITS.joinMs);
        });

        it(`should execute aggregation query in < ${LIMITS.aggregationMs}ms`, async () => {
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
            expect(duration).toBeLessThan(LIMITS.aggregationMs);
        });

        it(`should execute complex query with multiple JOINs in < ${LIMITS.complexJoinMs}ms`, async () => {
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
            expect(duration).toBeLessThan(LIMITS.complexJoinMs);
        });
    });

    describe('Concurrent Operations', () => {
        it(`should handle 50 concurrent SELECT queries in < ${LIMITS.concurrentSelectsMs}ms`, async () => {
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
            expect(duration).toBeLessThan(LIMITS.concurrentSelectsMs);
        });

        it(`should handle 20 concurrent INSERT operations in < ${LIMITS.concurrentInsertsMs}ms`, async () => {
            // Use deterministic IDs to prevent race conditions
            const baseTime = Date.now();
            const inserts = Array(20).fill(null).map((_, i) =>
                new Promise((resolve, reject) => {
                    // Use index-based ID to ensure uniqueness and prevent race conditions
                    const taskId = `perf-task-${baseTime}-${i}`;
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

            expect(duration).toBeLessThan(LIMITS.concurrentInsertsMs);
        });
    });

    describe('Bulk Operations', () => {
        it(`should insert 100 records efficiently in < ${LIMITS.bulkInsertMs}ms`, async () => {
            const startTime = Date.now();

            await new Promise((resolve) => {
                db.serialize(() => {
                    let pending = 100;
                    for (let i = 0; i < 100; i++) {
                        db.run(
                            'INSERT INTO tasks (id, organization_id, title, status) VALUES (?, ?, ?, ?)',
                            [`bulk-task-${i}-${Date.now()}`, testOrgId, `Bulk Task ${i}`, 'todo'],
                            () => {
                                pending -= 1;
                                if (pending === 0) resolve();
                            }
                        );
                    }
                });
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(LIMITS.bulkInsertMs);
        });

        it(`should update 100 records efficiently in < ${LIMITS.bulkUpdateMs}ms`, async () => {
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
                    let pending = taskIds.length;
                    taskIds.forEach((id) => {
                        db.run('UPDATE tasks SET status = ? WHERE id = ?', ['completed', id], () => {
                            pending -= 1;
                            if (pending === 0) resolve();
                        });
                    });
                });
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(LIMITS.bulkUpdateMs);
        });
    });

    describe('Index Performance', () => {
        it(`should use indexes for WHERE clauses in < ${LIMITS.indexWhereMs}ms`, async () => {
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
            expect(duration).toBeLessThan(LIMITS.indexWhereMs);
        });

        it(`should use indexes for JOIN operations in < ${LIMITS.indexJoinMs}ms`, async () => {
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
            expect(duration).toBeLessThan(LIMITS.indexJoinMs);
        });
    });
});
