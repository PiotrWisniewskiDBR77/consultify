/**
 * Test Cleanup Utilities
 *
 * Provides standardized cleanup patterns to prevent test pollution
 * and race conditions between tests.
 */

import { vi, beforeEach, afterEach } from 'vitest';

let rtlCleanup: null | (() => void) = null;

async function ensureRtlCleanupLoaded(): Promise<void> {
  if (rtlCleanup) return;
  try {
    const mod = await import('@testing-library/react');
    rtlCleanup = typeof mod.cleanup === 'function' ? mod.cleanup : null;
  } catch {
    rtlCleanup = null;
  }
}

/**
 * Global cleanup registry
 * Tracks cleanup functions that need to be called
 */
const cleanupRegistry: Array<() => void | Promise<void>> = [];

/**
 * Register a cleanup function
 * Will be called automatically in afterEach
 */
export function registerCleanup(fn: () => void | Promise<void>): void {
  cleanupRegistry.push(fn);
}

/**
 * Clear all registered cleanup functions
 */
export function clearCleanupRegistry(): void {
  cleanupRegistry.length = 0;
}

/**
 * Run all registered cleanup functions
 */
export async function runCleanup(): Promise<void> {
  // Run cleanup in reverse order (LIFO)
  for (let i = cleanupRegistry.length - 1; i >= 0; i--) {
    try {
      await Promise.resolve(cleanupRegistry[i]());
    } catch (error) {
      console.error('Cleanup function failed:', error);
    }
  }
  clearCleanupRegistry();
}

/**
 * Setup automatic cleanup for all tests
 * Call this in your test setup file
 */
export function setupAutoCleanup(): void {
  beforeEach(() => {
    // Clear registry before each test
    clearCleanupRegistry();
  });

  afterEach(async () => {
    // Ensure DOM from React Testing Library doesn't accumulate across tests (memory leak / OOM)
    if (typeof window !== 'undefined') {
      await ensureRtlCleanupLoaded();
      rtlCleanup?.();
    }

    // Run cleanup after each test
    await runCleanup();

    // Reset all mocks
    vi.clearAllMocks();
    vi.restoreAllMocks();

    // Clear timers
    vi.useRealTimers();

    // Clear any pending timeouts/intervals
    // This prevents test pollution from timers
    if (typeof global !== 'undefined') {
      // IMPORTANT:
      // Avoid an unbounded O(n) loop here (which becomes O(n^2) across a large suite).
      // In JSDOM, timer IDs are numeric and monotonically increasing; iterating from 0
      // to the highest seen ID can balloon to millions and contribute to OOM/timeouts.
      //
      // Instead, clear only a bounded "tail window" of recent IDs (the ones most likely
      // to still be pending due to test leaks). This keeps cleanup cost bounded.
      const highestTimeoutId = setTimeout(() => {}, 0) as unknown;
      clearTimeout(highestTimeoutId as any);

      if (typeof highestTimeoutId === 'number') {
        const MAX_IDS_TO_CLEAR = 5_000;
        const start = Math.max(0, highestTimeoutId - MAX_IDS_TO_CLEAR);
        for (let i = start; i <= highestTimeoutId; i++) {
          clearTimeout(i);
          // Intervals share the same id space in JSDOM, so clear both.
          clearInterval(i);
        }
      }
    }
  });
}

/**
 * Create a resource that automatically cleans up
 */
export class TestResource<T> {
  private value: T;
  private cleanupFn: (value: T) => void | Promise<void>;

  constructor(value: T, cleanupFn: (value: T) => void | Promise<void>) {
    this.value = value;
    this.cleanupFn = cleanupFn;
    registerCleanup(() => this.cleanupFn(this.value));
  }

  get(): T {
    return this.value;
  }

  async cleanup(): Promise<void> {
    await Promise.resolve(this.cleanupFn(this.value));
  }
}

/**
 * Create a test database connection with automatic cleanup
 */
export function createTestDb(): TestResource<any> {
  // This would be implemented based on your database setup
  // For now, it's a placeholder
  const db = {}; // Your database connection

  return new TestResource(db, async (db) => {
    // Close database connection
    if (db && typeof db.close === 'function') {
      await Promise.resolve(db.close());
    }
  });
}

/**
 * Create a test file with automatic cleanup
 */
export function createTestFile(path: string): TestResource<string> {
  // Create test file
  const fs = require('fs');
  fs.writeFileSync(path, 'test content');

  return new TestResource(path, (path) => {
    // Cleanup: delete test file
    try {
      if (fs.existsSync(path)) {
        fs.unlinkSync(path);
      }
    } catch (error) {
      console.error(`Failed to delete test file ${path}:`, error);
    }
  });
}

/**
 * Wait for all async operations to complete
 * Useful before assertions in async tests
 */
export async function waitForAsync(): Promise<void> {
  // Wait for next tick
  await new Promise((resolve) => setImmediate(resolve));
  // Wait for next microtask
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Create a test that ensures proper cleanup
 */
export function withCleanup<T extends (...args: any[]) => any>(testFn: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await testFn(...args);
    } finally {
      await waitForAsync();
      await runCleanup();
    }
  }) as T;
}
