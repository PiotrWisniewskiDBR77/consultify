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
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: mockGetDatabase,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: mockLogger,
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
      run: vi.fn(),
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
        { id: 2, name: 'Item 2' },
      ];

      mockDb.all.mockImplementation((sql: string, params: any[], callback: Function) => {
        callback(null, mockRows);
      });

      const sql = 'SELECT * FROM items';
      const result = await queryHelpers.queryAll(sql);

      expect(mockDb.all).toHaveBeenCalledWith(sql, [], expect.any(Function));
      expect(result).toEqual(mockRows);
    });

    it('should resolve with empty array when no rows returned', async () => {
      mockDb.all.mockImplementation((sql: string, params: any[], callback: Function) => {
        callback(null, []);
      });

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

      await expect(queryHelpers.queryAll('SELECT * FROM items')).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('queryOne()', () => {
    it('should resolve with single row for successful query', async () => {
      const mockRow = { id: 1, name: 'Single Item', status: 'active' };

      mockDb.get.mockImplementation((sql: string, params: any[], callback: Function) => {
        callback(null, mockRow);
      });

      const result = await queryHelpers.queryOne('SELECT * FROM items WHERE id = ?', [1]);

      expect(result).toEqual(mockRow);
      expect(mockDb.get).toHaveBeenCalledWith(
        'SELECT * FROM items WHERE id = ?',
        [1],
        expect.any(Function)
      );
    });

    it('should resolve with null when no row found', async () => {
      mockDb.get.mockImplementation((sql: string, params: any[], callback: Function) => {
        callback(null, null);
      });

      const result = await queryHelpers.queryOne('SELECT * FROM items WHERE id = ?', [999]);

      expect(result).toBeNull();
    });

    it('should handle undefined row result', async () => {
      mockDb.get.mockImplementation((sql: string, params: any[], callback: Function) => {
        callback(null, undefined);
      });

      const result = await queryHelpers.queryOne('SELECT * FROM items WHERE id = ?', [1]);

      expect(result).toBeNull();
    });

    it('should reject with error for database errors', async () => {
      const dbError = new Error('Query syntax error');

      mockDb.get.mockImplementation((sql: string, params: any[], callback: Function) => {
        callback(dbError, null);
      });

      await expect(queryHelpers.queryOne('SELECT * FROM invalid_table')).rejects.toThrow(
        'Query syntax error'
      );
    });
  });

  describe('queryRun()', () => {
    it('should resolve with run result for successful INSERT/UPDATE/DELETE', async () => {
      const expectedResult = { lastID: 123, changes: 1 };

      mockDb.run.mockImplementation(function (
        this: any,
        sql: string,
        params: any[],
        callback: Function
      ) {
        callback.call({ lastID: 123, changes: 1 }, null);
      });

      const result = await queryHelpers.queryRun('INSERT INTO items (name) VALUES (?)', [
        'New Item',
      ]);

      expect(result).toEqual(expectedResult);
      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT INTO items (name) VALUES (?)',
        ['New Item'],
        expect.any(Function)
      );
    });

    it('should handle operations without lastID (like UPDATE)', async () => {
      mockDb.run.mockImplementation(function (
        this: any,
        sql: string,
        params: any[],
        callback: Function
      ) {
        callback.call({ changes: 5 }, null);
      });

      const result = await queryHelpers.queryRun('UPDATE items SET status = ? WHERE category = ?', [
        'active',
        'electronics',
      ]);

      expect(result).toEqual({ lastID: undefined, changes: 5 });
    });
  });

  describe('queryParallel()', () => {
    it('should execute multiple queries in parallel and return results', async () => {
      const queries: any[] = [
        { type: 'all', sql: 'SELECT * FROM users', params: [] },
        { type: 'one', sql: 'SELECT * FROM items WHERE id = ?', params: [1] },
        { type: 'run', sql: 'INSERT INTO logs (message) VALUES (?)', params: ['test'] },
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

      mockDb.run.mockImplementation(function (
        this: any,
        sql: string,
        params: any[],
        callback: Function
      ) {
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

    it('should reject if any query fails', async () => {
      const queries: any[] = [
        { type: 'all', sql: 'SELECT * FROM users' },
        { type: 'one', sql: 'SELECT * FROM invalid_table' },
      ];

      const dbError = new Error('Table does not exist');

      mockDb.all.mockImplementation((sql: string, params: any[], callback: Function) => {
        process.nextTick(() => callback(null, []));
      });

      mockDb.get.mockImplementation((sql: string, params: any[], callback: Function) => {
        process.nextTick(() => callback(dbError, null));
      });

      await expect(queryHelpers.queryParallel(queries)).rejects.toThrow('Table does not exist');
    });
  });

  describe('Helper Functions', () => {
    it('should parse JSON fields correctly', () => {
      const row = {
        id: 1,
        checklist: '["Item 1", "Item 2"]',
        attachments: '{"key": "value"}',
        tags: '["tag1"]',
        data: '{"meta": "data"}',
        normal_field: 'regular value',
      };

      const result = queryHelpers.parseJsonFields(row);

      expect(result.checklist).toEqual(['Item 1', 'Item 2']);
      expect(result.attachments).toEqual({ key: 'value' });
      expect(result.tags).toEqual(['tag1']);
      expect(result.data).toEqual({ meta: 'data' });
      expect(result.normal_field).toBe('regular value');
    });

    it('should handle invalid JSON in parseJsonFields', () => {
      const row = {
        checklist: 'invalid json',
      };

      const result = queryHelpers.parseJsonFields(row);

      expect(result.checklist).toEqual({}); // Fallback for single object-like fields
    });

    it('should transform row from snake_case to camelCase', () => {
      const row = {
        id: 1,
        user_name: 'John Doe',
        created_at: '2023-01-01',
        organization_id: 'org-1',
      };

      const result = queryHelpers.transformRow(row);

      expect(result).toEqual({
        id: 1,
        userName: 'John Doe',
        createdAt: '2023-01-01',
        organizationId: 'org-1',
      });
    });

    it('should use field map for custom transformation', () => {
      const row = {
        id: 1,
        user_name: 'John Doe',
      };
      const fieldMap = {
        user_name: 'fullName',
      };

      const result = queryHelpers.transformRow(row, fieldMap);

      expect(result).toEqual({
        id: 1,
        fullName: 'John Doe',
      });
    });

    it('should build IN clause placeholders', () => {
      const values = [1, 2, 3];
      const result = queryHelpers.buildInPlaceholders(values);
      expect(result).toBe('?, ?, ?');
    });
  });
});
