/**
 * SQLite Async Adapter
 *
 * Provides sqliteAsync-compatible interface using IDatabase API
 * This allows legacy code to work with the new database abstraction
 */

import { getDatabaseType } from '../config/DatabaseConfig.js';
import type { IDatabase, RunResult } from './IDatabase.js';
import logger from '../utils/Logger.js';

/**
 * Execute a SQL statement that modifies data
 * Compatible with sqliteAsync.runAsync interface
 */
export async function runAsync(
  db: IDatabase,
  sql: string,
  params: unknown[] = []
): Promise<{ changes: number; lastID: number }> {
  const result = await db.run(sql, params);
  return {
    changes: result.changes,
    lastID: result.lastID || 0,
  };
}

/**
 * Get a single row
 * Compatible with sqliteAsync.getAsync interface
 */
export async function getAsync<T = unknown>(
  db: IDatabase,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  return await db.get<T>(sql, params);
}

/**
 * Get all rows
 * Compatible with sqliteAsync.allAsync interface
 */
export async function allAsync<T = unknown>(
  db: IDatabase,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  return await db.all<T>(sql, params);
}

/**
 * Execute a function within a transaction
 * Compatible with sqliteAsync.withTransaction interface
 */
export async function withTransaction<T>(db: IDatabase, fn: () => Promise<T>): Promise<T> {
  // Determine database type to use correct transaction syntax
  const dbType = getDatabaseType();
  const isPostgres = dbType === 'postgres';

  try {
    // PostgreSQL uses BEGIN, SQLite uses BEGIN IMMEDIATE for better concurrency
    if (isPostgres) {
      await db.run('BEGIN');
    } else {
      await db.run('BEGIN IMMEDIATE');
    }

    const result = await fn();

    await db.run('COMMIT');
    return result;
  } catch (e) {
    try {
      await db.run('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('[sqliteAsyncAdapter] Rollback failed:', rollbackErr);
    }
    throw e;
  }
}
