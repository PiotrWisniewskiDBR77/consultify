// @ts-nocheck
/**
 * Database Factory
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Factory pattern for creating database instances (SQLite or PostgreSQL)
 * Full TypeScript ES modules implementation
 */

import { createRequire } from 'module';

import { databaseConfig } from '../config/DatabaseConfig.js';
import logger from '../utils/Logger.js';
import type { IDatabase } from './IDatabase.js';
import PostgresDatabase from './PostgresDatabase.js';

const require = createRequire(import.meta.url);
const GLOBAL_DB_KEY = '__CONSULTINITY_GLOBAL_DB_INSTANCE__';
const SQLITE_GLOBAL_KEY = '__CONSULTINITY_SQLITE_INSTANCE__';

// local cache
let dbInstance: IDatabase | null = null;

/**
 * Ensures we have a single global instance across all module loads
 */
function getFromGlobal(): IDatabase | null {
  return (
    (process as any)[GLOBAL_DB_KEY] ||
    (globalThis as any)[GLOBAL_DB_KEY] ||
    (process as any)[SQLITE_GLOBAL_KEY] ||
    (globalThis as any)[SQLITE_GLOBAL_KEY] ||
    null
  );
}

function setToGlobal(db: IDatabase) {
  (process as any)[GLOBAL_DB_KEY] = db;
  (globalThis as any)[GLOBAL_DB_KEY] = db;
  (process as any)[SQLITE_GLOBAL_KEY] = db;
  (globalThis as any)[SQLITE_GLOBAL_KEY] = db;
  dbInstance = db;
}

/**
 * Shims the .query method onto a database handle if it doesn't have it
 */
function shimQuery(db: any) {
  if (db && typeof db.query !== 'function') {
    db.query = function (text: string, params: any[]) {
      return new Promise((resolve, reject) => {
        db.all(text, params, (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve({ rows: rows || [], rowCount: rows ? rows.length : 0 });
        });
      });
    };
  }
}

/**
 * Create database instance based on configuration
 */
export async function createDatabase(): Promise<IDatabase> {
  const existing = getFromGlobal();
  if (existing && !(existing as any).__CLOSED__) {
    dbInstance = existing;
    return existing;
  }

  console.log('[Database] createDatabase() called. MOCK_DB:', process.env.MOCK_DB);

  if (
    process.env.MOCK_DB === 'true' ||
    (process.env.NODE_ENV === 'test' && process.env.MOCK_DB !== 'false' && !process.env.SQLITE_PATH)
  ) {
    console.log('[Database] Using MOCK database.');
    const mockDb = (global as any).__TEST_DB_MOCK__ || createMockDatabase();
    setToGlobal(mockDb);
    return mockDb;
  }

  if (databaseConfig.type === 'postgres') {
    const db = PostgresDatabase as unknown as IDatabase;
    setToGlobal(db);
    return db;
  }

  // Default to SQLite (direct sqlite3 connection)
  console.log('[Database] Initializing SQLite connection...');
  const sqlite3Module: any = await import('sqlite3').then((m) => (m as any).default || m);
  const sqlite3 = sqlite3Module?.verbose ? sqlite3Module.verbose() : sqlite3Module;
  const sqlitePath = databaseConfig.sqlite?.path || process.env.SQLITE_PATH;
  if (!sqlitePath) {
    throw new Error('SQLITE_PATH is not set');
  }

  const db = (await new Promise((resolve, reject) => {
    const handle = new sqlite3.Database(sqlitePath, (err: any) => {
      if (err) reject(err);
      else resolve(handle);
    });
  })) as IDatabase;

  shimQuery(db);
  setToGlobal(db);
  return db;
}

/**
 * Get database singleton instance (async)
 */
export async function getDatabaseAsync(): Promise<IDatabase> {
  const existing = getFromGlobal();
  if (existing && !(existing as any).__CLOSED__) {
    return existing;
  }
  return createDatabase();
}

/**
 * Get internal database singleton instance (synchronous)
 */
export function getDatabaseInstance(): IDatabase {
  const existing = getFromGlobal();
  if (existing && !(existing as any).__CLOSED__) {
    return existing;
  }

  console.log('[Database] getDatabaseInstance() (SYNC) needs initialization.');

  if (
    process.env.NODE_ENV === 'test' &&
    process.env.MOCK_DB !== 'false' &&
    !process.env.SQLITE_PATH
  ) {
    const mockDb = createMockDatabase();
    setToGlobal(mockDb);
    return mockDb;
  }

  // SQLite Sync Fallback (direct sqlite3 connection)
  try {
    const sqlite3Module: any = require('sqlite3');
    const sqlite3 = sqlite3Module?.verbose ? sqlite3Module.verbose() : sqlite3Module;
    const sqlitePath = (databaseConfig as any).sqlite?.path || process.env.SQLITE_PATH;
    if (!sqlitePath) {
      throw new Error('SQLITE_PATH is not set');
    }
    const db = new sqlite3.Database(sqlitePath, (err: any) => {
      if (err) {
        console.error('[Database] SQLite sync open error:', err);
      }
    }) as unknown as IDatabase;
    shimQuery(db);
    setToGlobal(db);
    return db;
  } catch (e) {
    console.error('[Database] Sync initialization failed:', e);
    throw new Error('Database not initialized. Call getDatabaseAsync() first.');
  }
}

/**
 * Mock database for tests
 */
export interface MockDatabase extends IDatabase {
  _mockData?: Record<string, unknown[]>;
  isMock: boolean;
}

function createMockDatabase(): MockDatabase {
  const mock: MockDatabase = {
    isMock: true,
    get: (_sql, _params, callback) => {
      // sqlite3 compatibility: support (sql, cb) and (sql, params, cb)
      if (typeof _params === 'function') {
        // @ts-ignore
        _params(null, null);
        return mock;
      }
      if (callback) callback(null, null);
      return mock;
    },
    all: (_sql, _params, callback) => {
      if (typeof _params === 'function') {
        // @ts-ignore
        _params(null, []);
        return mock;
      }
      if (callback) callback(null, []);
      return mock;
    },
    run(_sql, _params, callback) {
      if (typeof _params === 'function') {
        // @ts-ignore
        _params.call({ lastID: 0, changes: 0 }, null);
        return mock;
      }
      if (callback) {
        // @ts-ignore
        callback.call({ lastID: 0, changes: 0 }, null);
      }
      return mock;
    },
    exec(_sql, callback) {
      if (callback) callback(null);
      return mock;
    },
    serialize: (cb) => cb(),
    close: (callback) => {
      if (callback) callback(null);
      return Promise.resolve();
    },
    async query(_text, _params) {
      return { rows: [], rowCount: 0 };
    },
  };

  return mock;
}

/**
 * Global Database Instance Proxy
 */
function createProxyMethod(prop: string) {
  return (...args: any[]) => {
    const callWithRetry = (retryCount = 0): any => {
      const currentDb = getDatabaseInstance();
      const fn = (currentDb as any)[prop];

      if (!fn) {
        throw new Error(`Database instance does not have method: ${String(prop)}`);
      }

      const lastArgIndex = args.length - 1;
      const lastArg = args[lastArgIndex];

      if (typeof lastArg === 'function') {
        const originalCallback = lastArg;
        const wrappedArgs = [...args];
        wrappedArgs[lastArgIndex] = function (this: any, err: any, ...results: any[]) {
          if (err && err.message && err.message.includes('Database is closed') && retryCount < 1) {
            resetConnectionLocally();
            return callWithRetry(retryCount + 1);
          }
          return originalCallback.apply(this, [err, ...results]);
        };
        return fn.apply(currentDb, wrappedArgs);
      }

      if (['get', 'all', 'run', 'exec'].includes(prop)) {
        return new Promise((resolve, reject) => {
          const callback = function (this: any, err: any, result: any) {
            if (err) {
              if (err.message && err.message.includes('Database is closed') && retryCount < 1) {
                resetConnectionLocally();
                return resolve(callWithRetry(retryCount + 1));
              }
              return reject(err);
            }
            if (prop === 'run') {
              return resolve({ lastID: this.lastID, changes: this.changes });
            }
            return resolve(result);
          };
          fn.apply(currentDb, [...args, callback]);
        });
      }

      try {
        const result = fn.apply(currentDb, args);
        if (result instanceof Promise) {
          return result.catch((err: any) => {
            if (err.message && err.message.includes('Database is closed') && retryCount < 1) {
              resetConnectionLocally();
              return callWithRetry(retryCount + 1);
            }
            throw err;
          });
        }
        return result;
      } catch (err: any) {
        if (err.message && err.message.includes('Database is closed') && retryCount < 1) {
          resetConnectionLocally();
          return callWithRetry(retryCount + 1);
        }
        throw err;
      }
    };

    return callWithRetry();
  };
}

const dbProxyTarget = {
  get: createProxyMethod('get'),
  all: createProxyMethod('all'),
  run: createProxyMethod('run'),
  exec: createProxyMethod('exec'),
} as IDatabase;

export const dbProxy = new Proxy(dbProxyTarget, {
  get(_, prop) {
    if (prop === '__CLOSED__') {
      const current = getFromGlobal();
      return current ? (current as any).__CLOSED__ : false;
    }

    if (typeof prop === 'string' && prop in dbProxyTarget) {
      return (dbProxyTarget as any)[prop];
    }

    const instance = getDatabaseInstance();
    const value = (instance as any)[prop];

    if (typeof value === 'function') {
      return createProxyMethod(String(prop));
    }
    return value;
  },
});

function resetConnectionLocally() {
  dbInstance = null;
  (process as any)[GLOBAL_DB_KEY] = null;
  (globalThis as any)[GLOBAL_DB_KEY] = null;
  (process as any)[SQLITE_GLOBAL_KEY] = null;
  (globalThis as any)[SQLITE_GLOBAL_KEY] = null;
}

/**
 * Force close connection and reset singleton
 */
export async function resetConnection(): Promise<void> {
  const db = getFromGlobal();
  resetConnectionLocally();

  if (db) {
    console.log('[Database] Closing database handle...');
    (db as any).__CLOSED__ = true;
    if ((db as any).close) {
      await new Promise<void>((resolve) => {
        (db as any).close((err: any) => {
          if (err) console.error('[Database] Error closing DB handle', err);
          resolve();
        });
      });
    }
  }
}

export function getDatabase(): IDatabase {
  return dbProxy;
}

export default dbProxy;

declare global {
  var __TEST_DB_MOCK__: any;
}
