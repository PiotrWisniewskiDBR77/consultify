/**
 * Professional Test Helpers & Utilities
 *
 * Common utilities for async testing, timing, and cleanup
 */
import { vi, afterEach, beforeEach } from 'vitest';

// ============================================================================
// Async Utilities
// ============================================================================

/**
 * Wait for a condition to be true
 */
export async function waitFor(
    condition: () => boolean | Promise<boolean>,
    options: { timeout?: number; interval?: number } = {}
): Promise<void> {
    const { timeout = 5000, interval = 50 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        if (await condition()) {
            return;
        }
        await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(`waitFor timed out after ${timeout}ms`);
}

/**
 * Wait for a value to be defined
 */
export async function waitForValue<T>(
    getter: () => T | undefined | null,
    options: { timeout?: number; interval?: number } = {}
): Promise<T> {
    const { timeout = 5000, interval = 50 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const value = getter();
        if (value !== undefined && value !== null) {
            return value;
        }
        await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(`waitForValue timed out after ${timeout}ms`);
}

/**
 * Wait for a specific duration
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run with timeout
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    message?: string
): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(message || `Operation timed out after ${ms}ms`));
        }, ms);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timeoutId!);
    }
}

/**
 * Retry an operation
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: { attempts?: number; delay?: number; backoff?: number } = {}
): Promise<T> {
    const { attempts = 3, delay = 100, backoff = 2 } = options;
    let lastError: Error | undefined;

    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            if (i < attempts - 1) {
                await sleep(delay * Math.pow(backoff, i));
            }
        }
    }

    throw lastError;
}

// ============================================================================
// Timer Utilities
// ============================================================================

/**
 * Setup fake timers with common configuration
 */
export function useFakeTimers(): void {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });
}

/**
 * Advance timers and flush promises
 */
export async function advanceTimersAndFlush(ms: number): Promise<void> {
    vi.advanceTimersByTime(ms);
    await vi.runAllTimersAsync();
}

/**
 * Run all timers to completion
 */
export async function runAllTimers(): Promise<void> {
    await vi.runAllTimersAsync();
}

// ============================================================================
// Mock Cleanup Utilities
// ============================================================================

/**
 * Auto-cleanup mocks between tests
 */
export function useAutoCleanup(): void {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });
}

/**
 * Reset all modules between tests
 */
export function useModuleReset(): void {
    beforeEach(() => {
        vi.resetModules();
    });
}

// ============================================================================
// Error Testing Utilities
// ============================================================================

/**
 * Expect async function to throw
 */
export async function expectToThrow(
    fn: () => Promise<unknown>,
    expectedError?: string | RegExp | typeof Error
): Promise<Error> {
    let thrownError: Error | undefined;

    try {
        await fn();
    } catch (error) {
        thrownError = error as Error;
    }

    if (!thrownError) {
        throw new Error('Expected function to throw, but it did not');
    }

    if (expectedError) {
        if (typeof expectedError === 'string') {
            if (!thrownError.message.includes(expectedError)) {
                throw new Error(
                    `Expected error message to include "${expectedError}", got "${thrownError.message}"`
                );
            }
        } else if (expectedError instanceof RegExp) {
            if (!expectedError.test(thrownError.message)) {
                throw new Error(
                    `Expected error message to match ${expectedError}, got "${thrownError.message}"`
                );
            }
        } else if (!(thrownError instanceof expectedError)) {
            throw new Error(
                `Expected error to be instance of ${expectedError.name}, got ${thrownError.constructor.name}`
            );
        }
    }

    return thrownError;
}

/**
 * Expect function to throw synchronously
 */
export function expectToThrowSync(
    fn: () => unknown,
    expectedError?: string | RegExp | typeof Error
): Error {
    let thrownError: Error | undefined;

    try {
        fn();
    } catch (error) {
        thrownError = error as Error;
    }

    if (!thrownError) {
        throw new Error('Expected function to throw, but it did not');
    }

    if (expectedError) {
        if (typeof expectedError === 'string') {
            if (!thrownError.message.includes(expectedError)) {
                throw new Error(
                    `Expected error message to include "${expectedError}", got "${thrownError.message}"`
                );
            }
        } else if (expectedError instanceof RegExp) {
            if (!expectedError.test(thrownError.message)) {
                throw new Error(
                    `Expected error message to match ${expectedError}, got "${thrownError.message}"`
                );
            }
        } else if (!(thrownError instanceof expectedError)) {
            throw new Error(
                `Expected error to be instance of ${expectedError.name}, got ${thrownError.constructor.name}`
            );
        }
    }

    return thrownError;
}

// ============================================================================
// Snapshot Utilities
// ============================================================================

/**
 * Normalize data for snapshots (remove dates, IDs, etc.)
 */
export function normalizeForSnapshot<T extends object>(
    data: T,
    options: { removeDates?: boolean; removeIds?: boolean; removeTimestamps?: boolean } = {}
): T {
    const { removeDates = true, removeIds = false, removeTimestamps = true } = options;

    const normalize = (obj: unknown): unknown => {
        if (obj === null || obj === undefined) return obj;

        if (obj instanceof Date) {
            return removeDates ? '[DATE]' : obj.toISOString();
        }

        if (Array.isArray(obj)) {
            return obj.map(normalize);
        }

        if (typeof obj === 'object') {
            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj)) {
                if (removeIds && (key === 'id' || key.endsWith('Id'))) {
                    result[key] = '[ID]';
                } else if (removeTimestamps && (key.endsWith('At') || key.endsWith('Date'))) {
                    result[key] = '[TIMESTAMP]';
                } else {
                    result[key] = normalize(value);
                }
            }
            return result;
        }

        return obj;
    };

    return normalize(data) as T;
}

// ============================================================================
// Console Capture
// ============================================================================

interface ConsoleSpy {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    restore: () => void;
    getCalls: (method: 'log' | 'warn' | 'error' | 'info') => unknown[][];
}

/**
 * Capture console output
 */
export function captureConsole(): ConsoleSpy {
    const log = vi.spyOn(console, 'log').mockImplementation(() => { });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
    const error = vi.spyOn(console, 'error').mockImplementation(() => { });
    const info = vi.spyOn(console, 'info').mockImplementation(() => { });

    return {
        log,
        warn,
        error,
        info,
        restore: () => {
            log.mockRestore();
            warn.mockRestore();
            error.mockRestore();
            info.mockRestore();
        },
        getCalls: (method) => {
            const spy = { log, warn, error, info }[method];
            return spy.mock.calls;
        },
    };
}

// ============================================================================
// Performance Testing
// ============================================================================

interface PerformanceResult {
    duration: number;
    memoryUsed?: number;
}

/**
 * Measure execution time
 */
export async function measurePerformance(
    fn: () => Promise<void> | void
): Promise<PerformanceResult> {
    const startMemory = (globalThis as { process?: { memoryUsage?: () => { heapUsed: number } } }).process?.memoryUsage?.()?.heapUsed;
    const startTime = performance.now();

    await fn();

    const endTime = performance.now();
    const endMemory = (globalThis as { process?: { memoryUsage?: () => { heapUsed: number } } }).process?.memoryUsage?.()?.heapUsed;

    return {
        duration: endTime - startTime,
        memoryUsed: startMemory && endMemory ? endMemory - startMemory : undefined,
    };
}

/**
 * Assert execution time is within limit
 */
export async function assertPerformance(
    fn: () => Promise<void> | void,
    maxDuration: number,
    message?: string
): Promise<void> {
    const result = await measurePerformance(fn);

    if (result.duration > maxDuration) {
        throw new Error(
            message ||
            `Expected execution to take less than ${maxDuration}ms, but took ${result.duration.toFixed(2)}ms`
        );
    }
}

// ============================================================================
// Test Data Cleanup
// ============================================================================

const cleanupFunctions: (() => void | Promise<void>)[] = [];

/**
 * Register a cleanup function
 */
export function addCleanup(fn: () => void | Promise<void>): void {
    cleanupFunctions.push(fn);
}

/**
 * Run all cleanup functions
 */
export async function runCleanup(): Promise<void> {
    for (const fn of cleanupFunctions.reverse()) {
        await fn();
    }
    cleanupFunctions.length = 0;
}

/**
 * Setup automatic cleanup after each test
 */
export function useCleanup(): void {
    afterEach(async () => {
        await runCleanup();
    });
}
