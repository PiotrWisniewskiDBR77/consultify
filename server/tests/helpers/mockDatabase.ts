/**
 * Mock Database Helper
 * Enterprise SaaS Architecture - TypeScript Backend Tests
 *
 * Advanced database mocking utilities
 */

import { vi } from 'vitest';

import type { IDatabase } from '../../src/database/IDatabase.js';

/**
 * Database query result type
 */
export interface QueryResult {
    rows?: unknown[];
    row?: unknown;
    changes?: number;
    lastInsertRowid?: number;
}

/**
 * Create a mock database with query result tracking
 */
export function createMockDatabaseWithResults(results: Record<string, QueryResult> = {}): IDatabase {
    const mockDb: IDatabase = {
        get: vi.fn((sql: string, params: unknown[], callback?: (err: Error | null, row: unknown) => void) => {
            const key = sql.trim().toLowerCase();
            const result = results[key] || results['*'] || { row: null };

            if (callback) {
                callback(null, result.row || null);
            }
            return mockDb;
        }),
        all: vi.fn((sql: string, params: unknown[], callback?: (err: Error | null, rows: unknown[]) => void) => {
            const key = sql.trim().toLowerCase();
            const result = results[key] || results['*'] || { rows: [] };

            if (callback) {
                callback(null, result.rows || []);
            }
            return mockDb;
        }),
        run: vi.fn((sql: string, params: unknown[], callback?: (err: Error | null) => void) => {
            const key = sql.trim().toLowerCase();
            const result = results[key] || results['*'] || { changes: 1 };

            if (callback) {
                callback(null);
            }
            return mockDb;
        }),
        exec: vi.fn((sql: string, callback?: (err: Error | null) => void) => {
            if (callback) {
                callback(null);
            }
            return mockDb;
        }),
        serialize: vi.fn((callback: () => void) => {
            callback();
        }),
        close: vi.fn((callback?: (err: Error | null) => void) => {
            if (callback) {
                callback(null);
            }
        }),
        query: vi.fn(),
    };

    return mockDb;
}

/**
 * Create a mock database that throws errors
 */
export function createMockDatabaseWithErrors(errorMessage: string = 'Database error'): IDatabase {
    const error = new Error(errorMessage);

    const mockDb: IDatabase = {
        get: vi.fn((sql: string, params: unknown[], callback?: (err: Error | null, row: unknown) => void) => {
            if (callback) {
                callback(error, null);
            }
            return mockDb;
        }),
        all: vi.fn((sql: string, params: unknown[], callback?: (err: Error | null, rows: unknown[]) => void) => {
            if (callback) {
                callback(error, []);
            }
            return mockDb;
        }),
        run: vi.fn((sql: string, params: unknown[], callback?: (err: Error | null) => void) => {
            if (callback) {
                callback(error);
            }
            return mockDb;
        }),
        exec: vi.fn((sql: string, callback?: (err: Error | null) => void) => {
            if (callback) {
                callback(error);
            }
            return mockDb;
        }),
        serialize: vi.fn((callback: () => void) => {
            callback();
        }),
        close: vi.fn((callback?: (err: Error | null) => void) => {
            if (callback) {
                callback(error);
            }
        }),
        query: vi.fn(),
    };

    return mockDb;
}


