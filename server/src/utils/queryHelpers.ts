/**
 * Query Helpers Utility
 *
 * Provides Promise-based wrappers and helpers for database queries.
 * Eliminates callback hell and provides consistent error handling.
 */

import { Client as PgClient } from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

import databaseConfig from '../config/DatabaseConfig.js';
import { getDatabase } from '../database/Database.js';
import { adaptQuery } from '../database/PostgresDatabase.js';
import logger from './Logger.js';
import { getCorrelationId } from './RequestStore.js';

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

interface RunQueryResult {
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
  const pinned = getCurrentPgTransactionClient();
  if (pinned) return pinned.query<T>(sql, params).then((result) => result.rows || []);
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
  const pinned = getCurrentPgTransactionClient();
  if (pinned) return pinned.query<T>(sql, params).then((result) => result.rows[0] ?? null);
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
 * Back-compat alias used by newer enterprise services.
 */
export function queryFirst<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
  return queryOne<T>(sql, params);
}

/**
 * Promise-based wrapper for db.run
 */
export function queryRun(sql: string, params: unknown[] = []): Promise<RunQueryResult> {
  const pinned = getCurrentPgTransactionClient();
  if (pinned) {
    return pinned.query(sql, params).then((result) => ({
      lastID: undefined,
      changes: result.rowCount,
    }));
  }
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
 * Legacy aliases kept for older route/service call sites.
 */
export const query = queryAll;
export const run = queryRun;

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
 * A single query method bound to ONE pinned PostgreSQL connection, for use inside
 * {@link withPgTransaction}. SQL is written in the same `?`-placeholder house style
 * used everywhere else in this codebase (queryAll/queryOne/queryRun) and is adapted
 * to Postgres `$1,$2,…` positional params internally — callers should NOT pass `$n`
 * placeholders themselves.
 */
export interface PgTransactionClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}

const pgTransactionContext = new AsyncLocalStorage<PgTransactionClient>();

/** Current request-scoped pinned client, if the caller is already in a UoW. */
export function getCurrentPgTransactionClient(): PgTransactionClient | undefined {
  return pgTransactionContext.getStore();
}

/**
 * Run `fn` inside a single, pinned PostgreSQL transaction (BEGIN … COMMIT/ROLLBACK
 * on ONE dedicated `pg` connection).
 *
 * WHY THIS EXISTS — do not use `transaction()` above for Postgres work (it drives
 * SQLite's `db.serialize()`/`db.run('BEGIN TRANSACTION')` API and this codebase is
 * PostgreSQL-only per server/src/database/Database.ts), and do not assume
 * queryAll/queryOne/queryRun can be composed into a transaction either: those go
 * through PostgresDatabase's shared connection POOL (`getPool()`/`getReadPool()`),
 * grabbing a *different* physical connection on every call, so a `BEGIN` issued via
 * `queryRun` and a later `UPDATE`/`COMMIT` via `queryRun` are not guaranteed to land
 * on the same session. This is a documented, previously-hit-in-production footgun in
 * this codebase — see the comments at services/notificationService.ts (~line 711,
 * "DLACZEGO NIE TRANSAKCJA") and services/tablePlatform/RecordsService.ts (~line
 * 931, batch-insert atomicity incident on migration Z19: `recordsMigrated=N` was
 * reported but 0 rows actually landed, because COMMIT silently ran on a connection
 * that never saw the INSERT). `ExtensionService.installExtension` (~line 111)
 * attempts `(db as any).connect()` for the same pinned-client need, but
 * `PostgresDatabase` does not actually implement a `connect()` method (only
 * `get`/`all`/`run`/`exec`/`query`/`serialize`/`close` — see
 * server/src/database/PostgresDatabase.ts:1060-1303) — that call throws at runtime.
 * It is dead/broken code, not a working precedent to copy.
 *
 * This helper opens its OWN short-lived `pg.Client` — a single dedicated connection
 * that is NOT pulled from PostgresDatabase's shared pool — issues `BEGIN`, hands the
 * caller a `.query()` bound to that one connection (see {@link PgTransactionClient}),
 * then `COMMIT`s on success or `ROLLBACK`s if `fn` throws, and always closes the
 * connection in a `finally`. Reuses the same `databaseConfig.postgres` connection
 * config and the same `?` → `$n` / boolean-column `adaptQuery()` adapter that
 * PostgresDatabase itself uses, so SQL written here matches the rest of the codebase.
 */
export async function withPgTransaction<T>(
  fn: (client: PgTransactionClient) => Promise<T>
): Promise<T> {
  const inherited = pgTransactionContext.getStore();
  if (inherited) return fn(inherited);
  const client = new PgClient(databaseConfig.postgres as ConstructorParameters<typeof PgClient>[0]);
  // node-postgres emits connection-level failures on the Client in addition to
  // rejecting the in-flight query. An EventEmitter `error` without a listener
  // terminates the whole Node process, so every dedicated transaction client
  // must install this listener before connect(). The query rejection remains
  // authoritative for rollback/caller error handling; this listener only
  // prevents a second, process-fatal propagation path.
  const handleClientError = (error: Error) => {
    logger.error('[QueryHelper] withPgTransaction: client connection error:', error);
  };
  client.on('error', handleClientError);
  await client.connect();

  const wrapped: PgTransactionClient = {
    query: async <R = unknown>(sql: string, params: unknown[] = []) => {
      const result = await client.query(adaptQuery(sql), params as unknown[]);
      return { rows: (result.rows as R[]) || [], rowCount: result.rowCount ?? 0 };
    },
  };

  try {
    // Best-effort parity with the shared pool's per-connection setup
    // (PostgresDatabase.ts sets this on every new pool connection). Not fatal if the
    // `v8` schema doesn't exist in a given environment — `public` is always present.
    await client.query('SET search_path TO public, v8').catch(() => undefined);

    await wrapped.query('BEGIN');
    const result = await pgTransactionContext.run(wrapped, () => fn(wrapped));
    await wrapped.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await wrapped.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('[QueryHelper] withPgTransaction: ROLLBACK failed:', rollbackErr);
      // Original error is more actionable to the caller than the rollback failure.
    }
    throw err;
  } finally {
    await client.end().catch((closeErr) => {
      logger.error('[QueryHelper] withPgTransaction: failed to close client:', closeErr);
    });
    client.off('error', handleClientError);
  }
}

/**
 * Raw PostgreSQL transaction for call sites that intentionally use `$1` style
 * placeholders and the native PoolClient result shape. Keep this separate
 * from `withPgTransaction`, whose established contract adapts `?` placeholders.
 */
export async function withRawPgTransaction<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  const { acquirePgClient } = await import('../database/PostgresDatabase.js');
  const client = await acquirePgClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error('[QueryHelper] withRawPgTransaction: ROLLBACK failed:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
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
const requestTrackingCallbacks = new Map<string, (type: string, duration: number) => void>();

export function enablePerformanceTracking(
  callback: (type: string, duration: number) => void
): void {
  const correlationId = getCorrelationId();
  if (correlationId) {
    requestTrackingCallbacks.set(correlationId, callback);
    return;
  }
  trackingCallback = callback;
}

export function disablePerformanceTracking(): void {
  const correlationId = getCorrelationId();
  if (correlationId) {
    requestTrackingCallbacks.delete(correlationId);
    return;
  }
  trackingCallback = null;
}

export function recordQueryPerformance(type: string, duration: number): void {
  const correlationId = getCorrelationId();
  if (correlationId) {
    const callback = requestTrackingCallbacks.get(correlationId);
    if (callback) {
      callback(type, duration);
      return;
    }
  }

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
}
