/**
 * Unified Mock Setup
 * 
 * Standardized test setup helper for all unit tests.
 * Provides consistent mock initialization using dependency injection pattern.
 */

import { createMockDb, createMockUuid } from './dependencyInjector.js';

/**
 * Setup standard test mocks
 * Returns a standardized set of mocks for use in tests
 * @returns {Object} Standard test mocks
 */
export function setupStandardTest() {
    return {
        db: createMockDb(),
        uuid: createMockUuid('test-uuid'),
        // Add other standard mocks as needed
    };
}

export default setupStandardTest;

