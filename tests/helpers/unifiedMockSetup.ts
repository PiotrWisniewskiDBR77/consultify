/**
 * Unified Mock Setup Helper
 * 
 * Provides standardized mock setup pattern for all tests.
 * Ensures consistent dependency injection and mock configuration.
 */

import { vi, beforeEach, afterEach } from 'vitest';
// Simplified dependency injector - create inline since dependencyInjector doesn't exist
function createUnifiedTestSetup(options: any) {
    const mocks = {
        db: createMockDb(),
        logger: createMockLogger(),
        redis: null,
        llm: null,
        ...options.customMocks
    };
    
    return {
        ...mocks,
        reset: () => {
            vi.clearAllMocks();
        },
        cleanup: async () => {
            // Cleanup if needed
        }
    };
}

function resetDependencies() {
    // Reset if needed
}
// Stub functions for testCleanup and flakyTestFixer
function setupAutoCleanup() {
    // Auto cleanup setup
}

function registerCleanup(fn: () => Promise<void>) {
    // Register cleanup function
}

function resetAllMocks() {
    vi.clearAllMocks();
}

async function flushPromises() {
    await new Promise(resolve => process.nextTick(resolve));
}
import { createMockDb, createMockLogger, createMockDependencies } from './mockDb.js';

export interface MockSetupOptions {
    /**
     * Use real database instead of mock
     */
    useRealDb?: boolean;
    
    /**
     * Use real Redis instead of mock
     */
    useRealRedis?: boolean;
    
    /**
     * Use real LLM API instead of mock
     */
    useRealLLM?: boolean;
    
    /**
     * Custom mocks to override defaults
     */
    customMocks?: Record<string, any>;
    
    /**
     * Auto cleanup after each test
     */
    autoCleanup?: boolean;
    
    /**
     * Reset mocks before each test
     */
    resetMocks?: boolean;
}

/**
 * Create unified mock setup for a test suite
 * 
 * Usage:
 * ```typescript
 * describe('MyService', () => {
 *   const { mocks, setup, teardown } = createUnifiedMockSetup();
 *   
 *   beforeEach(() => setup());
 *   afterEach(() => teardown());
 *   
 *   it('should work', () => {
 *     // Use mocks.db, mocks.redis, etc.
 *   });
 * });
 * ```
 */
export function createUnifiedMockSetup(options: MockSetupOptions = {}) {
    const {
        useRealDb = false,
        useRealRedis = false,
        useRealLLM = false,
        customMocks = {},
        autoCleanup = true,
        resetMocks = true
    } = options;

    // Create unified test setup
    const testSetup = createUnifiedTestSetup({
        useRealDb,
        useRealRedis,
        useRealLLM,
        customMocks
    });

    // Setup hooks
    if (autoCleanup) {
        beforeEach(async () => {
            if (resetMocks) {
                resetAllMocks();
                testSetup.reset();
            }
            await flushPromises();
        });

        afterEach(async () => {
            await flushPromises();
            testSetup.reset();
            resetAllMocks();
        });
    }

    // Register cleanup
    registerCleanup(async () => {
        await testSetup.cleanup();
    });

    return {
        /**
         * All mocks available in the test
         */
        mocks: testSetup,
        
        /**
         * Setup function (called in beforeEach)
         */
        setup: () => {
            if (resetMocks) {
                resetAllMocks();
                testSetup.reset();
            }
        },
        
        /**
         * Teardown function (called in afterEach)
         */
        teardown: async () => {
            await flushPromises();
            testSetup.reset();
            resetAllMocks();
        },
        
        /**
         * Reset all mocks manually
         */
        reset: () => {
            testSetup.reset();
            resetAllMocks();
        },
        
        /**
         * Cleanup all resources
         */
        cleanup: async () => {
            await testSetup.cleanup();
        }
    };
}

/**
 * Standard test setup pattern
 * Use this at the top of every test file
 * 
 * Usage:
 * ```typescript
 * const { mocks } = setupStandardTest();
 * 
 * describe('MyService', () => {
 *   it('should work', () => {
 *     // Use mocks.db, mocks.redis, etc.
 *   });
 * });
 * ```
 * 
 * This function now uses createMockDb() and createMockLogger() from mockDb.ts
 * which use vi.hoisted() for proper hoisting in Vitest.
 */
export function setupStandardTest(options: MockSetupOptions = {}) {
    // Use new mockDb helper with vi.hoisted()
    const { mockDb, mockLogger } = createMockDependencies({
        enableLogging: options.customMocks?.enableLogging || false
    });
    
    // Merge with custom mocks
    const customMocks = {
        db: mockDb,
        logger: mockLogger,
        ...options.customMocks
    };
    
    return createUnifiedMockSetup({
        autoCleanup: true,
        resetMocks: true,
        ...options,
        customMocks
    });
}

/**
 * Minimal test setup (no auto cleanup)
 * Use when you need manual control
 */
export function setupMinimalTest(options: MockSetupOptions = {}) {
    return createUnifiedMockSetup({
        autoCleanup: false,
        resetMocks: false,
        ...options
    });
}

export default {
    createUnifiedMockSetup,
    setupStandardTest,
    setupMinimalTest,
    createMockDb,
    createMockLogger,
    createMockDependencies
};




