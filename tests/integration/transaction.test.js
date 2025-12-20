// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../server/database.js');

/**
 * Level 2: Integration Tests - Database Transactions
 * Tests transaction handling, rollback, and consistency
 */
describe('Integration Test: Database Transactions', () => {
    let testOrgId;

    beforeAll(async () => {
        await db.initPromise;
        // Enable FKs for this test suite to ensure rollback works on constraint violation
        await new Promise(resolve => db.run('PRAGMA foreign_keys = ON;', resolve));
        testOrgId = 'tx-org-' + Date.now();
    });

    describe('Transaction Commit', () => {
        it('should commit multi-step transaction successfully', async () => {
            const userId = 'tx-user-' + Date.now();
            const projectId = 'tx-project-' + Date.now();

            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');

                    db.run(
                        'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                        [testOrgId, 'TX Org', 'free', 'active']
                    );

                    db.run(
                        'INSERT INTO users (id, organization_id, email, password, first_name) VALUES (?, ?, ?, ?, ?)',
                        [userId, testOrgId, 'tx@test.com', 'hash', 'TX User']
                    );

                    db.run(
                        'INSERT INTO projects (id, organization_id, name) VALUES (?, ?, ?)',
                        [projectId, testOrgId, 'TX Project']
                    );

                    db.run('COMMIT', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });

            // Verify all records exist
            const org = await new Promise((resolve) => {
                db.get('SELECT * FROM organizations WHERE id = ?', [testOrgId], (err, row) => {
                    resolve(row);
                });
            });
            const user = await new Promise((resolve) => {
                db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                    resolve(row);
                });
            });
            const project = await new Promise((resolve) => {
                db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, row) => {
                    resolve(row);
                });
            });

            expect(org).toBeDefined();
            expect(user).toBeDefined();
            expect(project).toBeDefined();
        });
    });

    describe('Transaction Rollback', () => {
        it('should rollback transaction on error', async () => {
            const orgId = 'rollback-org-' + Date.now();
            const userId = 'rollback-user-' + Date.now();

            // First, clean up any existing test org
            await new Promise((resolve) => {
                db.run('DELETE FROM organizations WHERE id = ?', [orgId], resolve);
            });

            let rollbackCompleted = false;

            try {
                await new Promise((resolve, reject) => {
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');

                        db.run(
                            'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                            [orgId, 'Rollback Org', 'free', 'active']
                        );

                        // Intentionally cause error with invalid FK
                        db.run(
                            'INSERT INTO users (id, organization_id, email, password, first_name) VALUES (?, ?, ?, ?, ?)',
                            [userId, 'non-existent-org', 'rollback@test.com', 'hash', 'User'],
                            function (err) {
                                if (err) {
                                    // Rollback and wait for completion
                                    db.run('ROLLBACK', function (rollbackErr) {
                                        rollbackCompleted = true;
                                        reject(err);
                                    });
                                } else {
                                    db.run('COMMIT', resolve);
                                }
                            }
                        );
                    });
                });
            } catch (error) {
                // Expected error - FK constraint violation
                expect(error.message).toMatch(/FOREIGN KEY/i);
            }

            // Ensure rollback was attempted
            expect(rollbackCompleted).toBe(true);

            // Verify org was rolled back - give a small delay for SQLite to finalize
            await new Promise(resolve => setTimeout(resolve, 50));

            const org = await new Promise((resolve) => {
                db.get('SELECT * FROM organizations WHERE id = ?', [orgId], (err, row) => {
                    resolve(row);
                });
            });
            expect(org).toBeUndefined();
        });
    });

    describe('Nested Transactions', () => {
        it('should handle savepoints correctly', async () => {
            const orgId = 'savepoint-org-' + Date.now();
            const userId1 = 'savepoint-user1-' + Date.now();
            const userId2 = 'savepoint-user2-' + Date.now();

            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');

                    db.run(
                        'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                        [orgId, 'Savepoint Org', 'free', 'active']
                    );

                    db.run(
                        'INSERT INTO users (id, organization_id, email, password, first_name) VALUES (?, ?, ?, ?, ?)',
                        [userId1, orgId, 'savepoint1@test.com', 'hash', 'User1']
                    );

                    // Create savepoint
                    db.run('SAVEPOINT sp1');

                    db.run(
                        'INSERT INTO users (id, organization_id, email, password, first_name) VALUES (?, ?, ?, ?, ?)',
                        [userId2, orgId, 'savepoint2@test.com', 'hash', 'User2']
                    );

                    // Rollback to savepoint (undo user2 insert)
                    db.run('ROLLBACK TO SAVEPOINT sp1');

                    db.run('COMMIT', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });

            // Verify user1 exists but user2 doesn't
            const user1 = await new Promise((resolve) => {
                db.get('SELECT * FROM users WHERE id = ?', [userId1], (err, row) => {
                    resolve(row);
                });
            });
            const user2 = await new Promise((resolve) => {
                db.get('SELECT * FROM users WHERE id = ?', [userId2], (err, row) => {
                    resolve(row);
                });
            });

            expect(user1).toBeDefined();
            expect(user2).toBeUndefined();
        });
    });

    describe('Concurrent Transactions', () => {
        it('should handle concurrent transactions without deadlock', async () => {
            const orgId1 = 'concurrent-org1-' + Date.now();
            const orgId2 = 'concurrent-org2-' + Date.now();

            const tx1 = new Promise((resolve) => {
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    db.run(
                        'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                        [orgId1, 'Concurrent 1', 'free', 'active']
                    );
                    db.run('COMMIT', resolve);
                });
            });

            const tx2 = new Promise((resolve) => {
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    db.run(
                        'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                        [orgId2, 'Concurrent 2', 'free', 'active']
                    );
                    db.run('COMMIT', resolve);
                });
            });

            await Promise.all([tx1, tx2]);

            // Verify both transactions completed
            const org1 = await new Promise((resolve) => {
                db.get('SELECT * FROM organizations WHERE id = ?', [orgId1], (err, row) => {
                    resolve(row);
                });
            });
            const org2 = await new Promise((resolve) => {
                db.get('SELECT * FROM organizations WHERE id = ?', [orgId2], (err, row) => {
                    resolve(row);
                });
            });

            expect(org1).toBeDefined();
            expect(org2).toBeDefined();
        });
    });
});

