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
import { recordQueryPerformance } from './queryHelpers.js';

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

const DEFAULT_TIMEOUT = Number(process.env.DB_QUERY_TIMEOUT) || 15000;

// ==========================================
// SINGLE-SETTLEMENT GUARD
// ==========================================

interface SettleGuard {
  /**
   * Marks the query as settled and reports whether the caller won the race.
   * Returns `true` exactly once per query; every later caller gets `false`
   * and must return immediately without logging, recording metrics or
   * touching resolve/reject.
   */
  claim: () => boolean;
}

/**
 * A query settles exactly once: either the driver callback fires, or the
 * timeout does. Whichever loses the race must be completely inert — the
 * promise itself would silently swallow a second resolve/reject, but the
 * surrounding code also logs and calls `recordQueryPerformance`, and those
 * side effects must not double-fire.
 */
function createSettleGuard(): SettleGuard {
  let settled = false;
  return {
    claim: (): boolean => {
      if (settled) return false;
      settled = true;
      return true;
    },
  };
}

// ==========================================
// PLACEHOLDER TRANSLATION
// ==========================================

/**
 * Translates SQLite-style `?` placeholders to Postgres-style `$1`, `$2`, ...
 * Only translates `?` that are NOT inside string literals (single quotes).
 * If the SQL already contains `$1` (Postgres-style), it's returned unchanged.
 */
function translatePlaceholders(sql: string): string {
  if (/\$\d+/.test(sql)) return sql;

  let counter = 0;
  let inString = false;
  let result = '';

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    if (char === "'" && sql[i - 1] !== '\\') {
      inString = !inString;
      result += char;
    } else if (char === '?' && !inString) {
      counter++;
      result += `$${counter}`;
    } else {
      result += char;
    }
  }

  return result;
}

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
export function all<T = any>(sql: string, params?: unknown[], options?: QueryOptions): Promise<T[]>;
export function all<T = any>(
  db: Database,
  sql: string,
  params?: unknown[],
  options?: QueryOptions
): Promise<T[]>;
export function all<T = any>(
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
  sql = translatePlaceholders(sql);
  const startedAt = Date.now();

  return new Promise<T[]>((resolve, reject) => {
    const guard = createSettleGuard();

    // Timeout protection
    const timeoutId = setTimeout(() => {
      if (!guard.claim()) return;
      recordQueryPerformance('all', Date.now() - startedAt);
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
        if (!guard.claim()) return;
        recordQueryPerformance('all', Date.now() - startedAt);

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
            logger.error(`[DB:Promise] Error: ${err.message}`, { sql, params });
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
      if (!guard.claim()) return;
      recordQueryPerformance('all', Date.now() - startedAt);
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
export function get<T = any>(
  sql: string,
  params?: unknown[],
  options?: QueryOptions
): Promise<T | null>;
export function get<T = any>(
  db: Database,
  sql: string,
  params?: unknown[],
  options?: QueryOptions
): Promise<T | null>;
export function get<T = any>(
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
  sql = translatePlaceholders(sql);
  const startedAt = Date.now();

  return new Promise<T | null>((resolve, reject) => {
    const guard = createSettleGuard();

    const timeoutId = setTimeout(() => {
      if (!guard.claim()) return;
      recordQueryPerformance('get', Date.now() - startedAt);
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
        if (!guard.claim()) return;
        recordQueryPerformance('get', Date.now() - startedAt);

        if (err) {
          dbLogger.warn('Query error', { error: err.message, sql: sql.substring(0, 100), params });
          logger.error(`[DB:Promise] Error: ${err.message}`, { sql, params });
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
      if (!guard.claim()) return;
      recordQueryPerformance('get', Date.now() - startedAt);
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
  sql = translatePlaceholders(sql);
  const startedAt = Date.now();

  return new Promise<RunResult>((resolve, reject) => {
    const guard = createSettleGuard();

    const timeoutId = setTimeout(() => {
      if (!guard.claim()) return;
      recordQueryPerformance('run', Date.now() - startedAt);
      dbLogger.warn('Statement timeout', { sql: sql.substring(0, 100), timeout });
      if (fallback) {
        resolve({ success: false, error: 'timeout' });
      } else {
        reject(new Error(`Database query timeout after ${timeout}ms`));
      }
    }, timeout);

    try {
      db.run(sql, params, function (this: { lastID?: number; changes: number }, err: Error | null) {
        clearTimeout(timeoutId);
        if (!guard.claim()) return;
        recordQueryPerformance('run', Date.now() - startedAt);

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
      if (!guard.claim()) return;
      recordQueryPerformance('run', Date.now() - startedAt);
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
 * Check if a table exists (PostgreSQL).
 * Tables prefixed with `v8_` are looked up in the `v8` schema first,
 * then fall back to `public`. All other tables check `public` only.
 */
export async function tableExists(tableName: string): Promise<boolean> {
  const schemas = tableName.startsWith('v8_') ? ['v8', 'public'] : ['public'];
  const result = await get<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = ANY($1) AND table_type = 'BASE TABLE' AND table_name = $2`,
    [schemas, tableName]
  );
  return result !== null;
}

/**
 * Check if a column exists in a table (PostgreSQL).
 * Tables prefixed with `v8_` are looked up in the `v8` schema first,
 * then fall back to `public`. All other tables check `public` only.
 */
export async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const schemas = tableName.startsWith('v8_') ? ['v8', 'public'] : ['public'];
  const result = await get<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = ANY($1) AND table_name = $2 AND column_name = $3`,
    [schemas, tableName, columnName]
  );
  return result !== null;
}

/**
 * Execute raw SQL and return result (for migrations, etc.)
 */
export async function exec(sql: string): Promise<ExecResult> {
  const db = getDb();
  const startedAt = Date.now();

  return new Promise<ExecResult>((resolve) => {
    db.exec(sql, (err: Error | null) => {
      recordQueryPerformance('exec', Date.now() - startedAt);
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
  columnExists,
  exec,
  safeAll,
  count,
  logger: dbLogger,
};

export default DbPromise;
