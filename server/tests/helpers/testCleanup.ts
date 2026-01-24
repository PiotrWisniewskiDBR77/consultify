/**
 * Test Cleanup Helper
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Helper functions for proper test cleanup to prevent flaky tests
 */

import { getDatabase } from '../../src/database/Database.js';
import type { IDatabase } from '../../src/database/IDatabase.js';

/**
 * Clean up test data from database
 */
export async function cleanupTestData(db: IDatabase, tables: string[]): Promise<void> {
  for (const table of tables) {
    await new Promise<void>((resolve, reject) => {
      db.run(`DELETE FROM ${table} WHERE id LIKE 'test-%'`, [], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

/**
 * Reset database state for tests
 */
export async function resetDatabase(db: IDatabase): Promise<void> {
  // Clean up test data
  const testTables = [
    'users',
    'organizations',
    'projects',
    'tasks',
    'initiatives',
    'invoices',
    'subscriptions',
    'webhooks',
  ];

  await cleanupTestData(db, testTables);
}

/**
 * Wait for async operations to complete
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 100
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await waitFor(delay * Math.pow(2, attempt - 1));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}
