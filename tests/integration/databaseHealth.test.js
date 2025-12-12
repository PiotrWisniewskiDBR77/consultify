// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../server/database.js');

/**
 * Level 2: Integration Tests - Database Health & Performance
 * Tests database connectivity, integrity, and performance
 */
describe('Integration Test: Database Health', () => {
    beforeAll(async () => {
        await db.initPromise;
    });

    describe('Connection Health', () => {
        it('should connect to database successfully', async () => {
            const result = await new Promise((resolve, reject) => {
                db.get('SELECT 1 as test', [], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(result).toBeDefined();
            expect(result.test).toBe(1);
        });

        it('should have all required tables', async () => {
            const requiredTables = [
                'organizations',
                'users',
                'projects',
                'tasks',
                'initiatives',
                'sessions',
                'notifications',
                'activity_logs',
                'ai_feedback',
                'llm_providers',
                'subscription_plans',
                'organization_billing',
            ];

            for (const table of requiredTables) {
                const exists = await new Promise((resolve) => {
                    db.get(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                        [table],
                        (err, row) => resolve(!!row)
                    );
                });
                expect(exists).toBe(true);
            }
        });
    });

    describe('Referential Integrity', () => {
        it('should enforce foreign key constraints', async () => {
            // Try to insert user with non-existent organization
            const invalidOrgId = 'non-existent-org-' + Date.now();
            const userId = 'test-user-' + Date.now();

            await expect(
                new Promise((resolve, reject) => {
                    db.run(
                        'INSERT INTO users (id, organization_id, email, password, first_name) VALUES (?, ?, ?, ?, ?)',
                        [userId, invalidOrgId, 'test@test.com', 'hash', 'Test'],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                })
            ).rejects.toThrow();
        });

        it('should cascade delete correctly', async () => {
            const orgId = 'test-org-cascade-' + Date.now();
            const userId = 'test-user-cascade-' + Date.now();
            const projectId = 'test-project-cascade-' + Date.now();

            // Create org, user, and project
            await new Promise((resolve) => {
                db.serialize(() => {
                    db.run(
                        'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                        [orgId, 'Cascade Test', 'free', 'active']
                    );
                    db.run(
                        'INSERT INTO users (id, organization_id, email, password, first_name) VALUES (?, ?, ?, ?, ?)',
                        [userId, orgId, 'cascade@test.com', 'hash', 'Test']
                    );
                    db.run(
                        'INSERT INTO projects (id, organization_id, name) VALUES (?, ?, ?)',
                        [projectId, orgId, 'Test Project'],
                        resolve
                    );
                });
            });

            // Verify project exists
            const projectBefore = await new Promise((resolve) => {
                db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, row) => {
                    resolve(row);
                });
            });
            expect(projectBefore).toBeDefined();

            // Delete organization (should cascade delete project)
            await new Promise((resolve) => {
                db.run('DELETE FROM organizations WHERE id = ?', [orgId], resolve);
            });

            // Verify project was deleted
            const projectAfter = await new Promise((resolve) => {
                db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, row) => {
                    resolve(row);
                });
            });
            expect(projectAfter).toBeUndefined();
        });
    });

    describe('Query Performance', () => {
        it('should execute simple SELECT queries quickly', async () => {
            const startTime = Date.now();
            
            await new Promise((resolve) => {
                db.all('SELECT * FROM organizations LIMIT 10', [], resolve);
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(100); // Should complete in < 100ms
        });

        it('should execute JOIN queries efficiently', async () => {
            const startTime = Date.now();

            await new Promise((resolve) => {
                db.all(
                    `SELECT u.*, o.name as org_name 
                     FROM users u 
                     LEFT JOIN organizations o ON u.organization_id = o.id 
                     LIMIT 10`,
                    [],
                    resolve
                );
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(200); // Should complete in < 200ms
        });

        it('should handle concurrent queries', async () => {
            const queries = Array(10).fill(null).map(() => 
                new Promise((resolve) => {
                    db.get('SELECT COUNT(*) as count FROM organizations', [], (err, row) => {
                        resolve(row?.count || 0);
                    });
                })
            );

            const results = await Promise.all(queries);
            expect(results.length).toBe(10);
            results.forEach(count => {
                expect(typeof count).toBe('number');
            });
        });
    });

    describe('Transaction Integrity', () => {
        it('should commit transactions successfully', async () => {
            const orgId = 'test-org-tx-' + Date.now();
            const userId = 'test-user-tx-' + Date.now();

            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    db.run(
                        'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                        [orgId, 'TX Test', 'free', 'active']
                    );
                    db.run(
                        'INSERT INTO users (id, organization_id, email, password, first_name) VALUES (?, ?, ?, ?, ?)',
                        [userId, orgId, 'tx@test.com', 'hash', 'Test']
                    );
                    db.run('COMMIT', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });

            // Verify both records exist
            const org = await new Promise((resolve) => {
                db.get('SELECT * FROM organizations WHERE id = ?', [orgId], (err, row) => {
                    resolve(row);
                });
            });
            const user = await new Promise((resolve) => {
                db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                    resolve(row);
                });
            });

            expect(org).toBeDefined();
            expect(user).toBeDefined();
        });

        it('should rollback transactions on error', async () => {
            const orgId = 'test-org-rollback-' + Date.now();

            try {
                await new Promise((resolve, reject) => {
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');
                        db.run(
                            'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                            [orgId, 'Rollback Test', 'free', 'active']
                        );
                        // Intentionally cause error with invalid FK
                        db.run(
                            'INSERT INTO users (id, organization_id, email, password, first_name) VALUES (?, ?, ?, ?, ?)',
                            ['invalid-user', 'non-existent-org', 'test@test.com', 'hash', 'Test'],
                            (err) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    reject(err);
                                } else {
                                    db.run('COMMIT', resolve);
                                }
                            }
                        );
                    });
                });
            } catch (error) {
                // Expected error
            }

            // Verify org was rolled back
            const org = await new Promise((resolve) => {
                db.get('SELECT * FROM organizations WHERE id = ?', [orgId], (err, row) => {
                    resolve(row);
                });
            });
            expect(org).toBeUndefined();
        });
    });

    describe('Data Consistency', () => {
        it('should prevent duplicate emails', async () => {
            const email = 'duplicate@test.com';
            const orgId = 'test-org-dup-' + Date.now();
            const userId1 = 'test-user-dup1-' + Date.now();
            const userId2 = 'test-user-dup2-' + Date.now();

            // Create org first
            await new Promise((resolve) => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [orgId, 'Dup Test', 'free', 'active'],
                    resolve
                );
            });

            // Insert first user
            await new Promise((resolve) => {
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name) VALUES (?, ?, ?, ?, ?)',
                    [userId1, orgId, email, 'hash', 'Test1'],
                    resolve
                );
            });

            // Try to insert duplicate email
            await expect(
                new Promise((resolve, reject) => {
                    db.run(
                        'INSERT INTO users (id, organization_id, email, password, first_name) VALUES (?, ?, ?, ?, ?)',
                        [userId2, orgId, email, 'hash', 'Test2'],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                })
            ).rejects.toThrow();
        });

        it('should maintain referential integrity on updates', async () => {
            const orgId1 = 'test-org-ref1-' + Date.now();
            const orgId2 = 'test-org-ref2-' + Date.now();
            const userId = 'test-user-ref-' + Date.now();

            // Create both orgs
            await new Promise((resolve) => {
                db.serialize(() => {
                    db.run(
                        'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                        [orgId1, 'Ref Test 1', 'free', 'active']
                    );
                    db.run(
                        'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                        [orgId2, 'Ref Test 2', 'free', 'active']
                    );
                    db.run(
                        'INSERT INTO users (id, organization_id, email, password, first_name) VALUES (?, ?, ?, ?, ?)',
                        [userId, orgId1, 'ref@test.com', 'hash', 'Test'],
                        resolve
                    );
                });
            });

            // Update user's org (should succeed)
            await new Promise((resolve) => {
                db.run(
                    'UPDATE users SET organization_id = ? WHERE id = ?',
                    [orgId2, userId],
                    resolve
                );
            });

            // Verify update
            const user = await new Promise((resolve) => {
                db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                    resolve(row);
                });
            });
            expect(user.organization_id).toBe(orgId2);
        });
    });
});

