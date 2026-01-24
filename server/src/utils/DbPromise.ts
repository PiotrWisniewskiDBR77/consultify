/**
 * Database Promise Wrapper for SQLite3
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * SQLite3 uses callbacks by default. This module provides Promise-based wrappers
 * with built-in resilience features:
 * - Timeout protection (prevents hanging forever)
 * - Error handling with graceful fallbacks
 * - Logging for debugging
 */

import dbProxy from '../database/Database.js';
import logger from './Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface Database {
  all: (
    sql: string,
    params: unknown[],
    callback: (err: Error | null, rows: unknown[]) => void
  ) => void;
  get: (
    sql: string,
    params: unknown[],
    callback: (err: Error | null, row: unknown) => void
  ) => void;
  run: (
    sql: string,
    params: unknown[],
    callback: (this: { lastID?: number; changes: number }, err: Error | null) => void
  ) => void;
  exec: (sql: string, callback: (err: Error | null) => void) => void;
}

interface QueryOptions {
  timeout?: number;
  fallback?: boolean;
}

export interface RunResult {
  success: boolean;
  lastID?: number;
  changes?: number;
  error?: string;
}

interface TransactionStatement {
  sql: string;
  params: unknown[];
}

interface TransactionResult {
  success: boolean;
  results: RunResult[];
  error?: string;
}

interface ExecResult {
  success: boolean;
  error?: string;
}

interface DbLogger {
  debug: (msg: string, data?: unknown) => void;
  warn: (msg: string, data?: unknown) => void;
  error: (msg: string, data?: unknown) => void;
}

// ==========================================
// CONSTANTS
// ==========================================

const DEFAULT_TIMEOUT = 5000; // 5 seconds

// ==========================================
// LOGGER
// ==========================================

const dbLogger: DbLogger = {
  debug: (msg: string, data?: unknown): void => {
    if (process.env.DEBUG_DB === 'true') {
      logger.info(`[DB:Promise] ${msg}`, data || '');
    }
  },
  warn: (msg: string, data?: unknown): void => {
    logger.warn(`[DB:Promise] ${msg}`, data || '');
  },
  error: (msg: string, data?: unknown): void => {
    logger.error(`[DB:Promise] ${msg}`, data || '');
  },
};

// ==========================================
// DATABASE INSTANCE
// ==========================================

const getDb = (): Database => {
  return dbProxy as unknown as Database;
};

// ==========================================
// FUNCTIONS
// ==========================================

/**
 * Promise wrapper for db.all() - returns array of rows
 */
export function all<T = unknown>(
  sql: string,
  params?: unknown[],
  options?: QueryOptions
): Promise<T[]>;
export function all<T = unknown>(
  db: Database,
  sql: string,
  params?: unknown[],
  options?: QueryOptions
): Promise<T[]>;
export function all<T = unknown>(
  dbOrSql: Database | string,
  sqlOrParams?: string | unknown[],
  paramsOrOptions?: unknown[] | QueryOptions,
  options?: QueryOptions
): Promise<T[]> {
  let db: Database;
  let sql: string;
  let params: unknown[];
  let queryOptions: QueryOptions;

  if (typeof dbOrSql === 'string') {
    db = getDb();
    sql = dbOrSql;
    params = (sqlOrParams as unknown[]) || [];
    queryOptions = (paramsOrOptions as QueryOptions) || {};
  } else {
    db = dbOrSql;
    sql = sqlOrParams as string;
    params = (paramsOrOptions as unknown[]) || [];
    queryOptions = options || {};
  }

  const { timeout = DEFAULT_TIMEOUT, fallback = true } = queryOptions;

  return new Promise<T[]>((resolve, reject) => {
    // Timeout protection
    const timeoutId = setTimeout(() => {
      dbLogger.warn('Query timeout', { sql: sql.substring(0, 100), timeout });
      if (fallback) {
        resolve([]);
      } else {
        reject(new Error(`Database query timeout after ${timeout}ms`));
      }
    }, timeout);

    try {
      db.all(sql, params, (err: Error | null, rows: unknown[]) => {
        clearTimeout(timeoutId);

        if (err) {
          // Don't log errors when fallback is true and it's a "table doesn't exist" type error
          const isTableNotFoundError =
            err.message.includes('no such table') ||
            err.message.includes('does not exist') ||
            err.message.includes('relation') ||
            err.message.includes('Database not initialized');

          if (!fallback || !isTableNotFoundError) {
            dbLogger.warn('Query error', {
              error: err.message,
              sql: sql.substring(0, 100),
              params,
            });
            console.error(`[DB:Promise] Error: ${err.message}`, { sql, params });
          }

          if (fallback) {
            resolve([]);
          } else {
            reject(err);
          }
        } else {
          resolve((rows || []) as T[]);
        }
      });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const err = error as Error;

      // Don't log errors when fallback is true and it's a "table doesn't exist" type error
      const isTableNotFoundError =
        err.message.includes('no such table') ||
        err.message.includes('does not exist') ||
        err.message.includes('relation') ||
        err.message.includes('Database not initialized');

      if (!fallback || !isTableNotFoundError) {
        dbLogger.error('Query exception', {
          error: err.message,
          stack: err.stack,
          sql: sql.substring(0, 100),
        });
      }

      if (fallback) {
        resolve([]);
      } else {
        reject(error);
      }
    }
  });
}

/**
 * Promise wrapper for db.get() - returns single row
 */
export function get<T = unknown>(
  sql: string,
  params?: unknown[],
  options?: QueryOptions
): Promise<T | null>;
export function get<T = unknown>(
  db: Database,
  sql: string,
  params?: unknown[],
  options?: QueryOptions
): Promise<T | null>;
export function get<T = unknown>(
  dbOrSql: Database | string,
  sqlOrParams?: string | unknown[],
  paramsOrOptions?: unknown[] | QueryOptions,
  options?: QueryOptions
): Promise<T | null> {
  let db: Database;
  let sql: string;
  let params: unknown[];
  let queryOptions: QueryOptions;

  if (typeof dbOrSql === 'string') {
    db = getDb();
    sql = dbOrSql;
    params = (sqlOrParams as unknown[]) || [];
    queryOptions = (paramsOrOptions as QueryOptions) || {};
  } else {
    db = dbOrSql;
    sql = sqlOrParams as string;
    params = (paramsOrOptions as unknown[]) || [];
    queryOptions = options || {};
  }

  const { timeout = DEFAULT_TIMEOUT, fallback = true } = queryOptions;

  return new Promise<T | null>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      dbLogger.warn('Query timeout', { sql: sql.substring(0, 100), timeout });
      if (fallback) {
        resolve(null);
      } else {
        reject(new Error(`Database query timeout after ${timeout}ms`));
      }
    }, timeout);

    try {
      db.get(sql, params, (err: Error | null, row: unknown) => {
        clearTimeout(timeoutId);

        if (err) {
          dbLogger.warn('Query error', { error: err.message, sql: sql.substring(0, 100), params });
          console.error(`[DB:Promise] Error: ${err.message}`, { sql, params });
          if (fallback) {
            resolve(null);
          } else {
            reject(err);
          }
        } else {
          resolve((row || null) as T | null);
        }
      });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const err = error as Error;
      dbLogger.error('Query exception', {
        error: err.message,
        stack: err.stack,
        sql: sql.substring(0, 100),
      });
      if (fallback) {
        resolve(null);
      } else {
        reject(error);
      }
    }
  });
}

/**
 * Promise wrapper for db.run() - executes INSERT/UPDATE/DELETE
 */
export function run(sql: string, params?: unknown[], options?: QueryOptions): Promise<RunResult>;
export function run(
  db: Database,
  sql: string,
  params?: unknown[],
  options?: QueryOptions
): Promise<RunResult>;
export function run(
  dbOrSql: Database | string,
  sqlOrParams?: string | unknown[],
  paramsOrOptions?: unknown[] | QueryOptions,
  options?: QueryOptions
): Promise<RunResult> {
  let db: Database;
  let sql: string;
  let params: unknown[];
  let queryOptions: QueryOptions;

  if (typeof dbOrSql === 'string') {
    db = getDb();
    sql = dbOrSql;
    params = (sqlOrParams as unknown[]) || [];
    queryOptions = (paramsOrOptions as QueryOptions) || {};
  } else {
    db = dbOrSql;
    sql = sqlOrParams as string;
    params = (paramsOrOptions as unknown[]) || [];
    queryOptions = options || {};
  }

  const { timeout = DEFAULT_TIMEOUT, fallback = true } = queryOptions;

  return new Promise<RunResult>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      dbLogger.warn('Statement timeout', { sql: sql.substring(0, 100), timeout });
      if (fallback) {
        resolve({ success: false, error: 'timeout' });
      }
    }, timeout);

    try {
      db.run(sql, params, function (this: { lastID?: number; changes: number }, err: Error | null) {
        clearTimeout(timeoutId);

        if (err) {
          dbLogger.warn('Statement error', {
            error: err.message,
            sql: sql.substring(0, 100),
            params,
          });
          if (fallback) {
            resolve({ success: false, error: err.message });
          } else {
            reject(err);
          }
        } else {
          resolve({
            success: true,
            lastID: this.lastID,
            changes: this.changes,
          });
        }
      });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const err = error as Error;
      dbLogger.error('Statement exception', {
        error: err.message,
        stack: err.stack,
        sql: sql.substring(0, 100),
      });
      if (fallback) {
        resolve({ success: false, error: err.message });
      } else {
        reject(error);
      }
    }
  });
}

/**
 * Execute multiple statements in a transaction
 */
export async function transaction(statements: TransactionStatement[]): Promise<TransactionResult> {
  try {
    await run('BEGIN TRANSACTION', [], { fallback: false });

    const results: RunResult[] = [];
    for (const stmt of statements) {
      const result = await run(stmt.sql, stmt.params, { fallback: false });
      results.push(result);
    }

    await run('COMMIT', [], { fallback: false });
    return { success: true, results };
  } catch (error: unknown) {
    const err = error as Error;
    dbLogger.error('Transaction failed, rolling back', { error: err.message });
    try {
      await run('ROLLBACK', [], { fallback: false });
    } catch (rollbackError) {
      const rollbackErr = rollbackError as Error;
      dbLogger.error('Rollback failed', { error: rollbackErr.message });
    }
    return { success: false, error: err.message, results: [] };
  }
}

/**
 * Check if a table exists
 */
export async function tableExists(tableName: string): Promise<boolean> {
  const result = await get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    [tableName]
  );
  return result !== null;
}

/**
 * Execute raw SQL and return result (for migrations, etc.)
 */
export async function exec(sql: string): Promise<ExecResult> {
  const db = getDb();

  return new Promise<ExecResult>((resolve) => {
    db.exec(sql, (err: Error | null) => {
      if (err) {
        dbLogger.error('Exec failed', { error: err.message });
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true });
      }
    });
  });
}

/**
 * Safe query wrapper that always returns an array (for SELECT queries)
 * Useful when you want to iterate over results without null checks
 */
export async function safeAll<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await all<T>(sql, params);
  return Array.isArray(result) ? result : [];
}

/**
 * Count rows matching a query
 */
export async function count(table: string, where = '1=1', params: unknown[] = []): Promise<number> {
  const result = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM ${table} WHERE ${where}`,
    params
  );
  return result?.count || 0;
}

// Export as a namespace object for convenient usage (as a "DbPromise" object)
export const DbPromise = {
  all,
  get,
  run,
  transaction,
  tableExists,
  exec,
  safeAll,
  count,
  logger: dbLogger,
};

export default DbPromise;
