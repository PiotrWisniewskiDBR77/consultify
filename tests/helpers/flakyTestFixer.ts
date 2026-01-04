/**
 * Flaky Test Fixer Utilities
 * 
 * Provides utilities to fix common flaky test issues:
 * - Race conditions
 * - Async timing issues
 * - Cleanup problems
 * - Deterministic mocks
 */

import { vi } from 'vitest';

/**
 * Wait for a condition with retry logic
 * More reliable than standard waitFor for flaky tests
 */
export async function waitForCondition(
    condition: () => boolean | Promise<boolean>,
    options: {
        timeout?: number;
        interval?: number;
        retries?: number;
    } = {}
): Promise<void> {
    const {
        timeout = 5000,
        interval = 100,
        retries = 50
    } = options;

    const startTime = Date.now();
    let attempts = 0;

    while (attempts < retries && Date.now() - startTime < timeout) {
        try {
            const result = await condition();
            if (result) {
                return;
            }
        } catch (error) {
            // Continue retrying on error
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met after ${attempts} attempts (${Date.now() - startTime}ms)`);
}

/**
 * Create a deterministic mock that always returns the same value
 * Prevents race conditions from non-deterministic mocks
 */
export function createDeterministicMock<T>(value: T): () => T {
    return vi.fn(() => value);
}

/**
 * Create a sequential mock that returns values in order
 * Useful for testing async operations that need specific ordering
 */
export function createSequentialMock<T>(values: T[]): () => T {
    let index = 0;
    return vi.fn(() => {
        if (index >= values.length) {
            throw new Error(`Sequential mock exhausted. Requested index ${index} but only ${values.length} values available.`);
        }
        return values[index++];
    });
}

/**
 * Cleanup helper that ensures all async operations complete
 */
export async function cleanupAsync(): Promise<void> {
    // Wait for all pending promises to resolve
    await new Promise(resolve => setImmediate(resolve));
    // Wait for next tick
    await new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Create a mock with proper cleanup
 * Ensures mocks are reset between tests
 */
export function createMockWithCleanup<T extends (...args: any[]) => any>(
    implementation: T
): ReturnType<typeof vi.fn<T>> {
    const mock = vi.fn(implementation);
    
    // Store original implementation for cleanup
    (mock as any).__originalImplementation = implementation;
    
    return mock;
}

/**
 * Reset all mocks and clear timers
 * Use in beforeEach/afterEach to prevent test pollution
 */
export function resetAllMocks(): void {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.useRealTimers();
}

/**
 * Wait for all pending promises to resolve
 * Useful for fixing race conditions in async tests
 */
export async function flushPromises(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
}

/**
 * Create a debounced mock that waits before executing
 * Useful for testing debounced operations
 */
export function createDebouncedMock<T extends (...args: any[]) => any>(
    implementation: T,
    delay: number = 100
): ReturnType<typeof vi.fn<T>> {
    let timeoutId: NodeJS.Timeout | null = null;
    
    return vi.fn((...args: Parameters<T>) => {
        return new Promise<ReturnType<T>>((resolve) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            timeoutId = setTimeout(() => {
                const result = implementation(...args);
                resolve(result);
                timeoutId = null;
            }, delay);
        });
    });
}

/**
 * Create a mock that simulates network delay
 * Useful for testing race conditions in network requests
 */
export function createNetworkMock<T>(
    response: T,
    delay: number = 100
): () => Promise<T> {
    return vi.fn(() => {
        return new Promise<T>((resolve) => {
            setTimeout(() => resolve(response), delay);
        });
    });
}

/**
 * Run test with retry logic
 * Automatically retries flaky tests
 */
export async function withRetry<T>(
    testFn: () => Promise<T> | T,
    options: {
        retries?: number;
        delay?: number;
    } = {}
): Promise<T> {
    const { retries = 3, delay = 100 } = options;
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
        try {
            return await testFn();
        } catch (error) {
            lastError = error as Error;
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError || new Error('Test failed after retries');
}

/**
 * Create a test that automatically handles cleanup
 */
export function createTestWithCleanup(
    name: string,
    testFn: () => Promise<void> | void,
    cleanupFn?: () => Promise<void> | void
) {
    return async () => {
        try {
            await testFn();
        } finally {
            if (cleanupFn) {
                await cleanupFn();
            }
            await cleanupAsync();
            resetAllMocks();
        }
    };
}

/**
 * Wait for multiple conditions to be true
 * Useful for testing multiple async operations
 */
export async function waitForAll(
    conditions: Array<() => boolean | Promise<boolean>>,
    options: {
        timeout?: number;
        interval?: number;
    } = {}
): Promise<void> {
    const { timeout = 5000, interval = 100 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const results = await Promise.all(
            conditions.map(condition => Promise.resolve(condition()).catch(() => false))
        );

        if (results.every(result => result === true)) {
            return;
        }

        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('Not all conditions met within timeout');
}






