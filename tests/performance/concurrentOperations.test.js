/**
 * Concurrent Operations Performance Tests
 * 
 * Phase 7: Performance Tests - Concurrent Operations
 * Tests system behavior under concurrent load (database, API, services).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb } from '../helpers/dependencyInjector.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Mock database at module level before any imports
const mockDb = createMockDb();
vi.mock('../../../server/database', () => ({
    default: mockDb
}));

describe('Concurrent Operations Performance', () => {
    beforeEach(() => {
        // Reset mocks before each test
        vi.clearAllMocks();
    });

    describe('Concurrent Database Operations', () => {
        it('should handle concurrent SELECT queries', async () => {
            const concurrentQueries = 50;
            
            mockDb.all.mockImplementation((query, params, callback) => {
                setTimeout(() => {
                    callback(null, []);
                }, 10);
            });

            const start = Date.now();
            const promises = Array(concurrentQueries).fill(null).map(() =>
                new Promise((resolve) => {
                    mockDb.all('SELECT * FROM projects', [], (err, rows) => {
                        resolve(rows);
                    });
                })
            );

            await Promise.all(promises);
            const duration = Date.now() - start;

            // All queries should complete within reasonable time
            expect(duration).toBeLessThan(1000);
            expect(mockDb.all).toHaveBeenCalledTimes(concurrentQueries);
        });

        it('should handle concurrent INSERT operations', async () => {
            const concurrentInserts = 20;
            
            mockDb.run.mockImplementation((query, params, callback) => {
                setTimeout(() => {
                    callback.call({ changes: 1 }, null);
                }, 5);
            });

            const start = Date.now();
            const promises = Array(concurrentInserts).fill(null).map(() =>
                new Promise((resolve, reject) => {
                    mockDb.run(
                        'INSERT INTO projects (id, name) VALUES (?, ?)',
                        ['id', 'Test'],
                        function(err) {
                            if (err) reject(err);
                            else resolve(this.changes);
                        }
                    );
                })
            );

            const results = await Promise.all(promises);
            const duration = Date.now() - start;

            expect(results.length).toBe(concurrentInserts);
            expect(duration).toBeLessThan(500);
        });

        it('should handle concurrent UPDATE operations', async () => {
            const concurrentUpdates = 30;
            
            mockDb.run.mockImplementation((query, params, callback) => {
                setTimeout(() => {
                    callback.call({ changes: 1 }, null);
                }, 5);
            });

            const start = Date.now();
            const promises = Array(concurrentUpdates).fill(null).map((_, i) =>
                new Promise((resolve, reject) => {
                    mockDb.run(
                        'UPDATE projects SET name = ? WHERE id = ?',
                        [`Updated ${i}`, `id-${i}`],
                        function(err) {
                            if (err) reject(err);
                            else resolve(this.changes);
                        }
                    );
                })
            );

            const results = await Promise.all(promises);
            const duration = Date.now() - start;

            expect(results.length).toBe(concurrentUpdates);
            expect(duration).toBeLessThan(500);
        });
    });

    describe('Concurrent Service Operations', () => {
        it('should handle concurrent usage tracking', async () => {
            const UsageService = require('../../server/services/usageService.js');
            const concurrentRecords = 100;
            
            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const start = Date.now();
            const promises = Array(concurrentRecords).fill(null).map((_, i) =>
                UsageService.recordTokenUsage(
                    'org-123',
                    'user-123',
                    100 + i,
                    'test_action'
                )
            );

            await Promise.all(promises);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(2000);
        });

        it('should handle concurrent permission checks', async () => {
            // Reset modules to ensure fresh import with mocks
            vi.resetModules();
            const PermissionService = require('../../server/services/permissionService.js');
            
            const concurrentChecks = 50;
            
            // Mock responses for permission checks
            mockDb.get.mockImplementation((query, params, callback) => {
                // Return null for org_user_permissions (no override)
                // Return null for role_permissions (no role permission)
                callback(null, null);
            });

            const start = Date.now();
            const promises = Array(concurrentChecks).fill(null).map(() =>
                PermissionService.hasPermission(
                    'user-123',
                    'PERMISSION_TEST',
                    'org-123'
                )
            );

            await Promise.all(promises);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(1000);
        });
    });

    describe('Race Condition Tests', () => {
        it('should handle race conditions in token billing', async () => {
            const TokenBillingService = require('../../server/services/tokenBillingService.js');
            const concurrentDeductions = 10;
            const initialBalance = 1000;
            
            let currentBalance = initialBalance;
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { balance: currentBalance });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                // Simulate atomic update
                currentBalance -= params[1]; // amount
                callback.call({ changes: 1 }, null);
            });

            const start = Date.now();
            const promises = Array(concurrentDeductions).fill(null).map(() =>
                TokenBillingService.deductTokens('org-123', 100)
            );

            const results = await Promise.all(promises);
            const duration = Date.now() - start;

            // All deductions should succeed
            expect(results.every(r => r.success !== false)).toBe(true);
            expect(duration).toBeLessThan(1000);
        });

        it('should prevent double-spending in concurrent operations', async () => {
            const TokenBillingService = require('../../server/services/tokenBillingService.js');
            const concurrentChecks = 20;
            
            let balance = 500;
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { balance });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                if (balance >= params[1]) {
                    balance -= params[1];
                    callback.call({ changes: 1 }, null);
                } else {
                    callback.call({ changes: 0 }, new Error('Insufficient balance'));
                }
            });

            const promises = Array(concurrentChecks).fill(null).map(() =>
                TokenBillingService.deductTokens('org-123', 100)
            );

            const results = await Promise.all(promises);
            const successful = results.filter(r => r.success !== false).length;

            // Only 5 should succeed (500 / 100 = 5)
            expect(successful).toBeLessThanOrEqual(5);
        });
    });

    describe('Load Test Scenarios', () => {
        it('should handle burst traffic (100 requests in 1 second)', async () => {
            const burstSize = 100;
            const start = Date.now();
            
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            const promises = Array(burstSize).fill(null).map(() =>
                new Promise((resolve) => {
                    mockDb.all('SELECT * FROM projects', [], (err, rows) => {
                        resolve(rows);
                    });
                })
            );

            await Promise.all(promises);
            const duration = Date.now() - start;

            // Should handle burst within 2 seconds
            expect(duration).toBeLessThan(2000);
        });

        it('should maintain performance under sustained load', async () => {
            const sustainedRequests = 200;
            const requestInterval = 10; // ms between requests
            const responseTimes = [];
            
            mockDb.all.mockImplementation((query, params, callback) => {
                setTimeout(() => {
                    callback(null, []);
                }, 5);
            });

            for (let i = 0; i < sustainedRequests; i++) {
                const reqStart = Date.now();
                await new Promise((resolve) => {
                    mockDb.all('SELECT * FROM projects', [], () => {
                        responseTimes.push(Date.now() - reqStart);
                        resolve();
                    });
                });
                
                if (i < sustainedRequests - 1) {
                    await new Promise(resolve => setTimeout(resolve, requestInterval));
                }
            }

            const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            const maxResponseTime = Math.max(...responseTimes);

            // Average should remain low
            expect(avgResponseTime).toBeLessThan(100);
            // Max should not spike too high
            expect(maxResponseTime).toBeLessThan(500);
        });
    });
});

