/**
 * Standard Test Patterns
 * 
 * Provides standardized patterns for common test scenarios to ensure consistency.
 */

import { vi } from 'vitest';
import { createMockDb } from './dependencyInjector.js';

/**
 * Standard pattern for mocking database in tests
 * Uses hoisted vi.mock for proper module isolation
 * @returns {Object} Mock database instance
 */
export function setupDatabaseMock() {
    const mockDb = vi.hoisted(() => createMockDb());
    
    vi.mock('../../../server/database', () => ({
        default: mockDb
    }));
    
    return mockDb;
}

/**
 * Standard pattern for services with dependency injection
 * @param {string} servicePath - Path to service module
 * @param {Object} dependencies - Additional dependencies to inject
 * @returns {Object} Service instance and mock database
 */
export function setupServiceWithDI(servicePath, dependencies = {}) {
    const mockDb = dependencies.db || vi.hoisted(() => createMockDb());
    
    vi.mock('../../../server/database', () => ({
        default: mockDb
    }));
    
    // Import service (will be hoisted)
    // Note: Actual import should happen after vi.mock in test file
    
    return { mockDb, dependencies: { db: mockDb, ...dependencies } };
}

/**
 * Standard pattern for resetting mocks between tests
 * @param {Object} mocks - Object containing all mocks to reset
 */
export function resetMocks(mocks) {
    Object.values(mocks).forEach(mock => {
        if (mock && typeof mock === 'object') {
            if (mock.mockClear) mock.mockClear();
            if (mock.mockReset) mock.mockReset();
            
            // Reset nested mocks
            Object.values(mock).forEach(nested => {
                if (nested && typeof nested === 'object' && nested.mockClear) {
                    nested.mockClear();
                }
            });
        }
    });
}

export default {
    setupDatabaseMock,
    setupServiceWithDI,
    resetMocks
};





