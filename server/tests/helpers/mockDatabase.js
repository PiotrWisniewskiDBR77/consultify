/**
 * Mock Database Helper for Server Tests
 * 
 * Provides mock database instances for testing server services.
 * Compatible with both callback-style (SQLite3) and Promise-style (Postgres) APIs.
 */

import { vi } from 'vitest';
import { createMockDb } from '../../../tests/helpers/mockDb.js';

/**
 * Create a mock database with default results
 * @returns {Object} Mock database instance
 */
export function createMockDatabaseWithResults() {
    return createMockDb({
        defaultGetResult: null,
        defaultAllResult: [],
        defaultRunResult: { lastID: 1, changes: 1 },
        enableLogging: false
    });
}

/**
 * Create a mock database with custom results
 * @param {Object} options - Configuration options
 * @param {any} options.defaultGetResult - Default result for get() calls
 * @param {Array} options.defaultAllResult - Default result for all() calls
 * @param {Object} options.defaultRunResult - Default result for run() calls
 * @returns {Object} Mock database instance
 */
export function createMockDatabase(options = {}) {
    return createMockDb({
        defaultGetResult: options.defaultGetResult || null,
        defaultAllResult: options.defaultAllResult || [],
        defaultRunResult: options.defaultRunResult || { lastID: 1, changes: 1 },
        enableLogging: options.enableLogging || false
    });
}

export default {
    createMockDatabaseWithResults,
    createMockDatabase
};

