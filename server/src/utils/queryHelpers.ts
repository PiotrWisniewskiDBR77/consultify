/**
 * Query Helpers Utility
 *
 * Provides Promise-based wrappers and helpers for database queries.
 * Eliminates callback hell and provides consistent error handling.
 */

import { getDatabaseType } from '../config/DatabaseConfig.js';
import { getDatabase } from '../database/Database.js';
import logger from './Logger.js';

interface Database {
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
  serialize: (callback: () => void) => void;
}

interface QueryResult {
  lastID?: number;
  changes: number;
}

interface Query {
  type: 'all' | 'one' | 'run';
  sql: string;
  params?: unknown[];
}

/**
 * Promise-based wrapper for db.all
 */
export function queryAll<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    getDatabase().all(sql, params, (err: Error | null, rows: unknown[]) => {
      if (err) {
        logger.error('[QueryHelper] Error in queryAll:', err);
        reject(err);
      } else {
        resolve((rows as T[]) || []);
      }
    });
  });
}

/**
 * Promise-based wrapper for db.get
 */
export function queryOne<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    getDatabase().get(sql, params, (err: Error | null, row: unknown) => {
      if (err) {
        logger.error('[QueryHelper] Error in queryOne:', err);
        reject(err);
      } else {
        resolve((row as T) || null);
      }
    });
  });
}

/**
 * Promise-based wrapper for db.run
 */
export function queryRun(sql: string, params: unknown[] = []): Promise<QueryResult> {
  return new Promise((resolve, reject) => {
    getDatabase().run(
      sql,
      params,
      function (this: { lastID?: number; changes: number }, err: Error | null) {
        if (err) {
          logger.error('[QueryHelper] Error in queryRun:', err);
          reject(err);
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes,
          });
        }
      }
    );
  });
}

/**
 * Execute multiple queries in parallel
 */
export async function queryParallel(queries: Query[]): Promise<unknown[]> {
  const promises = queries.map((q) => {
    if (q.type === 'all') {
      return queryAll(q.sql, q.params || []);
    } else if (q.type === 'one') {
      return queryOne(q.sql, q.params || []);
    } else {
      return queryRun(q.sql, q.params || []);
    }
  });

  return Promise.all(promises);
}

/**
 * Build IN clause placeholders for array of values
 */
export function buildInPlaceholders(values: unknown[]): string {
  return values.map(() => '?').join(', ');
}

/**
 * Build WHERE clause for organization filtering
 */
export function buildOrgFilter(tableAlias: string, _orgId: string): string {
  return `${tableAlias}.organization_id = ?`;
}

/**
 * Build WHERE clause for user filtering (assignee or reporter)
 */
export function buildUserFilter(tableAlias: string, _userId: string): string {
  return `(${tableAlias}.assignee_id = ? OR ${tableAlias}.reporter_id = ?)`;
}

/**
 * Execute transaction (for databases that support it)
 */
export async function transaction<T>(callback: (db: Database) => Promise<T>): Promise<T> {
  // SQLite transaction support
  return new Promise((resolve, reject) => {
    const db = getDatabase() as unknown as Database;
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', [], (err: Error | null) => {
        if (err) return reject(err);

        callback(db)
          .then((result) => {
            db.run('COMMIT', [], (commitErr: Error | null) => {
              if (commitErr) {
                db.run('ROLLBACK', [], () => {});
                reject(commitErr);
              } else {
                resolve(result);
              }
            });
          })
          .catch((error) => {
            db.run('ROLLBACK', [], () => {});
            reject(error);
          });
      });
    });
  });
}

/**
 * Parse JSON fields safely
 */
export function parseJsonFields(
  row: Record<string, unknown>,
  jsonFields: string[] = ['checklist', 'attachments', 'tags', 'data']
): Record<string, unknown> {
  if (!row) return row;

  const parsed = { ...row };
  jsonFields.forEach((field) => {
    if (parsed[field] && typeof parsed[field] === 'string') {
      try {
        parsed[field] = JSON.parse(parsed[field] as string);
      } catch (e: unknown) {
        logger.warn(`[QueryHelper] Failed to parse JSON field ${field}:`, e);
        parsed[field] = field.includes('[]') ? [] : {};
      }
    }
  });

  return parsed;
}

/**
 * Transform database row to API format (snake_case to camelCase)
 */
export function transformRow(
  row: Record<string, unknown> | null,
  fieldMap: Record<string, string> = {}
): Record<string, unknown> | null {
  if (!row) return null;

  const transformed: Record<string, unknown> = {};
  Object.keys(row).forEach((key) => {
    // Use custom mapping if provided
    if (fieldMap[key]) {
      transformed[fieldMap[key]] = row[key];
    } else {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      transformed[camelKey] = row[key];
    }
  });

  return transformed;
}

/**
 * Enable performance tracking for database queries
 */
let trackingCallback: ((type: string, duration: number) => void) | null = null;

export function enablePerformanceTracking(
  callback: (type: string, duration: number) => void
): void {
  trackingCallback = callback;
}

export function disablePerformanceTracking(): void {
  trackingCallback = null;
}

export function recordQueryPerformance(type: string, duration: number): void {
  if (trackingCallback) {
    trackingCallback(type, duration);
  }
}

/**
 * Get table column information (database-agnostic)
 * Returns column names for a given table, compatible with both PostgreSQL and SQLite
 */
export interface TableColumnInfo {
  name: string;
  type?: string;
  notnull?: number;
  dflt_value?: unknown;
  pk?: number;
}

export async function getTableColumns(tableName: string): Promise<TableColumnInfo[]> {
  const dbType = getDatabaseType();

  if (dbType === 'postgres') {
    // PostgreSQL: Query information_schema
    const sql = `SELECT 
      column_name as name,
      data_type as type,
      CASE WHEN is_nullable = 'NO' THEN 1 ELSE 0 END as notnull,
      column_default as dflt_value,
      CASE WHEN column_name IN (
        SELECT column_name 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1 
          AND tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
      ) THEN 1 ELSE 0 END as pk
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position`;

    return queryAll<TableColumnInfo>(sql, [tableName]);
  } else {
    // SQLite: Use PRAGMA table_info
    return queryAll<TableColumnInfo>(`PRAGMA table_info(${tableName})`, []);
  }
}
