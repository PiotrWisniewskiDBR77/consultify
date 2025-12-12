// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../server/database.js');

/**
 * Level 5: Performance Tests - Stress Tests
 * Tests system behavior under high load and stress conditions
 */
describe('Performance Test: Stress', () => {
    beforeAll(async () => {
        await db.initPromise;
    });

    describe('High Volume Operations', () => {
        it('should handle 1000 sequential inserts', async () => {
            const orgId = 'stress-org-' + Date.now();
            
            // Create org first
            await new Promise((resolve) => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [orgId, 'Stress Test Org', 'free', 'active'],
                    resolve
                );
            });

            const startTime = Date.now();

            await new Promise((resolve) => {
                db.serialize(() => {
                    const stmt = db.prepare(
                        'INSERT INTO tasks (id, organization_id, title, status) VALUES (?, ?, ?, ?)'
                    );

                    for (let i = 0; i < 1000; i++) {
                        stmt.run(`stress-task-${i}-${Date.now()}`, orgId, `Stress Task ${i}`, 'todo');
                    }

                    stmt.finalize();
                    resolve();
                });
            });

            const duration = Date.now() - startTime;
            
            // Should complete in reasonable time (< 10 seconds)
            expect(duration).toBeLessThan(10000);
            
            // Verify count
            const count = await new Promise((resolve) => {
                db.get(
                    'SELECT COUNT(*) as count FROM tasks WHERE organization_id = ?',
                    [orgId],
                    (err, row) => resolve(row?.count || 0)
                );
            });
            expect(count).toBeGreaterThanOrEqual(1000);
        });

        it('should handle 500 concurrent queries', async () => {
            const queries = Array(500).fill(null).map(() =>
                new Promise((resolve) => {
                    db.get('SELECT COUNT(*) as count FROM organizations', [], (err, row) => {
                        resolve(row?.count || 0);
                    });
                })
            );

            const startTime = Date.now();
            const results = await Promise.all(queries);
            const duration = Date.now() - startTime;

            expect(results.length).toBe(500);
            expect(duration).toBeLessThan(5000); // Should complete in < 5s
        });
    });

    describe('Memory Leak Detection', () => {
        it('should not leak memory with repeated queries', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Run many queries
            for (let i = 0; i < 100; i++) {
                await new Promise((resolve) => {
                    db.all('SELECT * FROM organizations LIMIT 10', [], resolve);
                });
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // Memory increase should be reasonable (< 50MB)
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        });
    });

    describe('Connection Pool Stress', () => {
        it('should handle many concurrent connections', async () => {
            const connections = Array(100).fill(null).map(() =>
                new Promise((resolve) => {
                    db.get('SELECT 1 as test', [], (err, row) => {
                        resolve(row?.test || null);
                    });
                })
            );

            const results = await Promise.all(connections);
            
            expect(results.length).toBe(100);
            results.forEach(result => {
                expect(result).toBe(1);
            });
        });
    });
});

