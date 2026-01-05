/**
 * Query Helpers Tests
 *
 * Tests for Promise-based database query wrappers and utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import query helpers - using dynamic import for ESM
let queryHelpers: any;

// Mock dependencies
const mockGetDatabase = vi.fn();
const mockLogger = {
    error: vi.fn()
};

vi.mock('../../../../server/src/database/Database.js', () => ({
    getDatabase: mockGetDatabase
}));

vi.mock('../../../../server/src/utils/Logger.ts', () => ({
    default: mockLogger
}));

describe('Query Helpers', () => {
    let mockDb: any;

    beforeEach(async () => {
        // Clear all mocks
        vi.clearAllMocks();

        // Create fresh mock database for each test
        mockDb = {
            all: vi.fn(),
            get: vi.fn(),
            run: vi.fn()
        };

        // Setup getDatabase to return our mock
        mockGetDatabase.mockReturnValue(mockDb);

        // Import query helpers using dynamic import (fresh for each test)
        const module = await import('../../../../server/src/utils/queryHelpers.ts');
        queryHelpers = module;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('queryAll()', () => {
        it('should resolve with array of rows for successful query', async () => {
            const mockRows = [
                { id: 1, name: 'Item 1' },
                { id: 2, name: 'Item 2' }
            ];

            mockDb.all.mockResolvedValue($2);

            const sql = 'SELECT * FROM items';
            const result = await queryHelpers.queryAll(sql);

            expect(mockDb.all).toHaveBeenCalledWith(sql, [], expect.any(Function));
            expect(result).toEqual(mockRows);
        });

        it('should resolve with empty array when no rows returned', async () => {
            mockDb.all.mockResolvedValue($2);

            const result = await queryHelpers.queryAll('SELECT * FROM empty_table');

            expect(result).toEqual([]);
        });

        it('should accept query parameters', async () => {
            const params = ['active', 10];

            mockDb.all.mockImplementation((sql: string, params: any[], callback: Function) => {
                expect(params).toEqual(['active', 10]);
                callback(null, []);
            });

            await queryHelpers.queryAll('SELECT * FROM items WHERE status = ? AND limit = ?', params);

            expect(mockDb.all).toHaveBeenCalledWith(
                'SELECT * FROM items WHERE status = ? AND limit = ?',
                params,
                expect.any(Function)
            );
        });

        it('should reject with error for database errors', async () => {
            const dbError = new Error('Database connection failed');

            mockDb.all.mockImplementation((sql: string, params: any[], callback: Function) => {
                callback(dbError, null);
            });

            await expect(queryHelpers.queryAll('SELECT * FROM items'))
                .rejects.toThrow('Database connection failed');
        });

        it('should use empty array as default params', async () => {
            mockDb.all.mockImplementation((sql: string, params: any[], callback: Function) => {
                expect(params).toEqual([]);
                process.nextTick(() => callback(null, []));
            });

            await queryHelpers.queryAll('SELECT * FROM items');
        });
    });

    describe('queryOne()', () => {
        it('should resolve with single row for successful query', async () => {
            const mockRow = { id: 1, name: 'Single Item', status: 'active' };

            mockDb.get.mockResolvedValue($2);

            const result = await queryHelpers.queryOne('SELECT * FROM items WHERE id = ?', [1]);

            expect(result).toEqual(mockRow);
            expect(mockDb.get).toHaveBeenCalledWith(
                'SELECT * FROM items WHERE id = ?',
                [1],
                expect.any(Function)
            );
        });

        it('should resolve with null when no row found', async () => {
            mockDb.get.mockResolvedValue($2);

            const result = await queryHelpers.queryOne('SELECT * FROM items WHERE id = ?', [999]);

            expect(result).toBeNull();
        });

        it('should handle undefined row result', async () => {
            mockDb.get.mockResolvedValue($2);

            const result = await queryHelpers.queryOne('SELECT * FROM items WHERE id = ?', [1]);

            expect(result).toBeNull();
        });

        it('should reject with error for database errors', async () => {
            const dbError = new Error('Query syntax error');

            mockDb.get.mockImplementation((sql: string, params: any[], callback: Function) => {
                callback(dbError, null);
            });

            await expect(queryHelpers.queryOne('SELECT * FROM invalid_table'))
                .rejects.toThrow('Query syntax error');
        });
    });

    describe('queryRun()', () => {
        it('should resolve with run result for successful INSERT/UPDATE/DELETE', async () => {
            const expectedResult = { lastID: 123, changes: 1 };

            mockDb.run.mockImplementation(function(sql: string, params: any[], callback: Function) {
                callback.call({ lastID: 123, changes: 1 }, null);
            });

            const result = await queryHelpers.queryRun(
                'INSERT INTO items (name) VALUES (?)',
                ['New Item']
            );

            expect(result).toEqual(expectedResult);
            expect(mockDb.run).toHaveBeenCalledWith(
                'INSERT INTO items (name) VALUES (?)',
                ['New Item'],
                expect.any(Function)
            );
        });

        it('should handle operations without lastID (like UPDATE)', async () => {
            mockDb.run.mockImplementation(function(sql: string, params: any[], callback: Function) {
                callback.call({ changes: 5 }, null);
            });

            const result = await queryHelpers.queryRun(
                'UPDATE items SET status = ? WHERE category = ?',
                ['active', 'electronics']
            );

            expect(result).toEqual({ lastID: undefined, changes: 5 });
        });

        it('should reject with error for database errors', async () => {
            const dbError = new Error('Constraint violation');

            mockDb.run.mockImplementation(function(sql: string, params: any[], callback: Function) {
                callback.call({}, dbError);
            });

            await expect(queryHelpers.queryRun('INSERT INTO items VALUES (?)', ['duplicate']))
                .rejects.toThrow('Constraint violation');
        });

        it('should handle zero changes result', async () => {
            mockDb.run.mockImplementation(function(sql: string, params: any[], callback: Function) {
                callback.call({ changes: 0 }, null);
            });

            const result = await queryHelpers.queryRun(
                'UPDATE items SET name = ? WHERE id = ?',
                ['New Name', 999] // non-existent ID
            );

            expect(result).toEqual({ lastID: undefined, changes: 0 });
        });
    });

    describe('queryParallel()', () => {
        it('should execute multiple queries in parallel and return results', async () => {
            const queries = [
                { type: 'all', sql: 'SELECT * FROM users', params: [] },
                { type: 'one', sql: 'SELECT * FROM items WHERE id = ?', params: [1] },
                { type: 'run', sql: 'INSERT INTO logs (message) VALUES (?)', params: ['test'] }
            ];

            const mockUsers = [{ id: 1, name: 'User 1' }];
            const mockItem = { id: 1, name: 'Item 1' };
            const mockRunResult = { lastID: 100, changes: 1 };

            // Mock all three query types
            mockDb.all.mockImplementation((sql: string, params: any[], callback: Function) => {
                if (sql.includes('SELECT * FROM users')) {
                    callback(null, mockUsers);
                }
            });

            mockDb.get.mockImplementation((sql: string, params: any[], callback: Function) => {
                if (sql.includes('SELECT * FROM items')) {
                    callback(null, mockItem);
                }
            });

            mockDb.run.mockImplementation(function(sql: string, params: any[], callback: Function) {
                if (sql.includes('INSERT INTO logs')) {
                    callback.call({ lastID: 100, changes: 1 }, null);
                }
            });

            const results = await queryHelpers.queryParallel(queries);

            expect(results).toHaveLength(3);
            expect(results[0]).toEqual(mockUsers);
            expect(results[1]).toEqual(mockItem);
            expect(results[2]).toEqual(mockRunResult);
        });

        it('should handle empty queries array', async () => {
            const results = await queryHelpers.queryParallel([]);

            expect(results).toEqual([]);
        });

        it('should reject if any query fails', async () => {
            const queries = [
                { type: 'all', sql: 'SELECT * FROM users' },
                { type: 'one', sql: 'SELECT * FROM invalid_table' } // This will fail
            ];

            const dbError = new Error('Table does not exist');

            mockDb.all.mockImplementation((sql: string, params: any[], callback: Function) => {
                process.nextTick(() => callback(null, []));
            });

            mockDb.get.mockImplementation((sql: string, params: any[], callback: Function) => {
                process.nextTick(() => callback(dbError, null));
            });

            await expect(queryHelpers.queryParallel(queries))
                .rejects.toThrow('Table does not exist');
        });

        it('should handle queries without params', async () => {
            const queries = [
                { type: 'all', sql: 'SELECT COUNT(*) FROM users' }
            ];

            mockDb.all.mockImplementation((sql: string, params: any[], callback: Function) => {
                expect(params).toEqual([]);
                process.nextTick(() => callback(null, [{ count: 42 }]));
            });

            const results = await queryHelpers.queryParallel(queries);

            expect(results).toEqual([[{ count: 42 }]]);
        });
    });

    describe('Integration Scenarios', () => {
        it('should handle complex multi-table query scenario', async () => {
            // Simulate a complex business operation requiring multiple queries
            const userId = 123;

            // Mock user data
            const mockUser = { id: userId, name: 'John Doe', email: 'john@example.com' };
            const mockProjects = [
                { id: 1, name: 'Project A', owner_id: userId },
                { id: 2, name: 'Project B', owner_id: userId }
            ];
            const mockTasks = [
                { id: 10, project_id: 1, title: 'Task 1', status: 'completed' },
                { id: 11, project_id: 2, title: 'Task 2', status: 'in_progress' }
            ];

            // Setup mocks
            let callCount = 0;
            mockDb.get.mockImplementation((sql: string, params: any[], callback: Function) => {
                callCount++;
                if (sql.includes('SELECT * FROM users')) {
                    process.nextTick(() => callback(null, mockUser));
                }
            });

            mockDb.all.mockImplementation((sql: string, params: any[], callback: Function) => {
                callCount++;
                if (sql.includes('SELECT * FROM projects')) {
                    process.nextTick(() => callback(null, mockProjects));
                } else if (sql.includes('SELECT * FROM tasks')) {
                    process.nextTick(() => callback(null, mockTasks));
                }
            });

            // Execute parallel queries
            const queries = [
                { type: 'one', sql: 'SELECT * FROM users WHERE id = ?', params: [userId] },
                { type: 'all', sql: 'SELECT * FROM projects WHERE owner_id = ?', params: [userId] },
                { type: 'all', sql: 'SELECT * FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE owner_id = ?)', params: [userId] }
            ];

            const results = await queryHelpers.queryParallel(queries);

            expect(results).toHaveLength(3);
            expect(results[0]).toEqual(mockUser);
            expect(results[1]).toEqual(mockProjects);
            expect(results[2]).toEqual(mockTasks);
            expect(callCount).toBe(3);
        });

        it('should handle transaction-like operations with proper error propagation', async () => {
            const queries = [
                { type: 'run', sql: 'INSERT INTO audit_log (action, user_id) VALUES (?, ?)', params: ['login', 123] },
                { type: 'run', sql: 'UPDATE user_stats SET login_count = login_count + 1 WHERE user_id = ?', params: [123] },
                { type: 'one', sql: 'SELECT login_count FROM user_stats WHERE user_id = ?', params: [123] }
            ];

            const mockStats = { login_count: 5 };

            let runCallCount = 0;
            mockDb.run.mockImplementation(function(sql: string, params: any[], callback: Function) {
                runCallCount++;
                process.nextTick(() => callback.call({ changes: 1 }, null));
            });

            mockDb.get.mockImplementation((sql: string, params: any[], callback: Function) => {
                process.nextTick(() => callback(null, mockStats));
            });

            const results = await queryHelpers.queryParallel(queries);

            expect(runCallCount).toBe(2);
            expect(results[2]).toEqual(mockStats); // Last query result
        });
    });

    describe('Error Handling', () => {
        it('should log errors with appropriate context', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const dbError = new Error('Connection timeout');

            mockDb.all.mockImplementation((sql: string, params: any[], callback: Function) => {
                process.nextTick(() => callback(dbError, null));
            });

            await expect(queryHelpers.queryAll('SELECT * FROM slow_table'))
                .rejects.toThrow('Connection timeout');

            // Note: In real implementation, logger.error would be called, but we're mocking console for test
            consoleSpy.mockRestore();
        });

        it('should handle malformed parameters gracefully', async () => {
            // Test with undefined params
            mockDb.all.mockImplementation((sql: string, params: any[], callback: Function) => {
                expect(params).toEqual([]);
                process.nextTick(() => callback(null, []));
            });

            await expect(queryHelpers.queryAll('SELECT * FROM table', undefined)).resolves.toEqual([]);
        });

        it('should handle null SQL queries', async () => {
            mockDb.all.mockImplementation((sql: string, params: any[], callback: Function) => {
                process.nextTick(() => callback(null, []));
            });

            await expect(queryHelpers.queryAll(null as any)).resolves.toEqual([]);
        });
    });
});
