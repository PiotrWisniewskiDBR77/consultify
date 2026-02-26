// @ts-nocheck
/**
 * Database Factory
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * PostgreSQL only. SQLite has been fully removed.
 */

import { databaseConfig } from '../config/DatabaseConfig.js';
import logger from '../utils/Logger.js';
import type { IDatabase } from './IDatabase.js';
import PostgresDatabase from './PostgresDatabase.js';

const GLOBAL_DB_KEY = '__CONSULTINITY_GLOBAL_DB_INSTANCE__';

// local cache
let dbInstance: IDatabase | null = null;
let schemaInitPromise: Promise<void> | null = null;
let creatingDbPromise: Promise<IDatabase> | null = null;
const SCHEMA_INIT_GUARD_KEY = '__CONSULTINITY_SCHEMA_INIT_IN_PROGRESS__';

async function ensureSchemaInitialized(db: IDatabase): Promise<void> {
  // Skip schema work for mock DBs
  if ((db as any)?.isMock) return;
  // Postgres schema is initialized/verified explicitly during server startup via DatabaseInitializer.
  // Calling DatabaseInitializer from here creates re-entrant initialization (and can crash the dev server).
  if (databaseConfig.type === 'postgres') return;
  // Avoid deadlocks: DatabaseInitializer calls getDatabaseAsync() internally.
  if ((globalThis as any)[SCHEMA_INIT_GUARD_KEY]) return;

  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      (globalThis as any)[SCHEMA_INIT_GUARD_KEY] = true;
      try {
        // Lazy import to avoid eager circular deps at module load time
        const mod = await import('./DatabaseInitializer.js');
        if (typeof mod.initializeDatabase === 'function') {
          await mod.initializeDatabase();
        }
      } catch (e) {
        // Don't hard-crash here; callers may handle missing schema elsewhere.
        logger.warn('[Database] Schema initialization skipped/failed:', (e as any)?.message || e);
      } finally {
        (globalThis as any)[SCHEMA_INIT_GUARD_KEY] = false;
      }
    })();
  }

  await schemaInitPromise;
}

/**
 * Ensures we have a single global instance across all module loads
 */
function getFromGlobal(): IDatabase | null {
  return (process as any)[GLOBAL_DB_KEY] || (globalThis as any)[GLOBAL_DB_KEY] || null;
}

function setToGlobal(db: IDatabase) {
  (process as any)[GLOBAL_DB_KEY] = db;
  (globalThis as any)[GLOBAL_DB_KEY] = db;
  dbInstance = db;
}

/**
 * Create database instance. PostgreSQL only.
 */
export async function createDatabase(): Promise<IDatabase> {
  const existing = getFromGlobal();
  if (existing && !(existing as any).__CLOSED__) {
    dbInstance = existing;
    return existing;
  }

  if (creatingDbPromise) {
    return creatingDbPromise;
  }

  creatingDbPromise = (async (): Promise<IDatabase> => {
    if (
      process.env.MOCK_DB === 'true' ||
      (process.env.NODE_ENV === 'test' &&
        process.env.MOCK_DB !== 'false' &&
        !process.env.DATABASE_URL)
    ) {
      const mockDb = (global as any).__TEST_DB_MOCK__ || createMockDatabase();
      setToGlobal(mockDb);
      return mockDb;
    }

    const db = PostgresDatabase as unknown as IDatabase;
    setToGlobal(db);
    return db;
  })();

  try {
    return await creatingDbPromise;
  } finally {
    creatingDbPromise = null;
  }
}

/**
 * Get database singleton instance (async)
 */
export async function getDatabaseAsync(): Promise<IDatabase> {
  const existing = getFromGlobal();
  if (existing && !(existing as any).__CLOSED__) {
    await ensureSchemaInitialized(existing);
    return existing;
  }
  const db = await createDatabase();
  await ensureSchemaInitialized(db);
  return db;
}

/**
 * Get internal database singleton instance (synchronous)
 */
export function getDatabaseInstance(): IDatabase {
  const globalDb = getFromGlobal();
  if (globalDb && !(globalDb as any).__CLOSED__) {
    return globalDb;
  }

  if (dbInstance && !(dbInstance as any).__CLOSED__) {
    return dbInstance;
  }

  if (!databaseConfig.type || databaseConfig.type === 'postgres') {
    const db = PostgresDatabase as unknown as IDatabase;
    setToGlobal(db);
    return db;
  }

  if (
    process.env.NODE_ENV === 'test' &&
    process.env.MOCK_DB !== 'false' &&
    !process.env.DATABASE_URL
  ) {
    const mockDb = createMockDatabase();
    setToGlobal(mockDb);
    return mockDb;
  }

  throw new Error('Database not initialized. Call getDatabaseAsync() first.');
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
