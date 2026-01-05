/**
 * Database Factory
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Factory pattern for creating database instances (SQLite or PostgreSQL)
 * Full TypeScript ES modules implementation
 */

import { createRequire } from 'module';
import { databaseConfig } from '../config/DatabaseConfig.js';
import type { IDatabase } from './IDatabase.js';
import PostgresDatabase from './PostgresDatabase.js';
import logger from '../utils/Logger.js';

const require = createRequire(import.meta.url);
const GLOBAL_DB_KEY = '__CONSULTIFY_GLOBAL_DB_INSTANCE__';

// Local references to the global singleton
let dbInstance: IDatabase | null = (process as any)[GLOBAL_DB_KEY] || (globalThis as any)[GLOBAL_DB_KEY] || null;
let dbInstancePromise: Promise<IDatabase> | null = null;

if (dbInstance) {
    console.log('[Database] Initialized from global.');
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
 * Ensures we have a single global instance across all module loads
 */
function syncWithGlobal() {
    const globalHandle = (process as any)[GLOBAL_DB_KEY] || (globalThis as any)[GLOBAL_DB_KEY];
    if (globalHandle && (!dbInstance || (dbInstance as any).__CLOSED__)) {
        dbInstance = globalHandle;
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
    return {
        isMock: true,
        get: (_sql, _params, callback) => {
            if (callback) callback(null, null);
            return Promise.resolve(null);
        },
        all: (_sql, _params, callback) => {
            if (callback) callback(null, []);
            return Promise.resolve([]);
        },
        run(_sql, _params, callback) {
            if (callback) {
                // @ts-ignore
                callback.call({ lastID: 0, changes: 0 }, null);
            }
            return Promise.resolve({ lastID: 0, changes: 0 });
        },
        exec(_sql, callback) {
            if (callback) callback(null);
            return Promise.resolve();
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
}

/**
 * Create database instance based on configuration
 */
export async function createDatabase(): Promise<IDatabase> {
    syncWithGlobal();
    if (dbInstance && !(dbInstance as any).__CLOSED__ && !(dbInstance as any).isMock) {
        return dbInstance;
    }

    console.log('[Database] createDatabase() called. MOCK_DB:', process.env.MOCK_DB);

    // BRUTAL TEST ISOLATION
    if (process.env.NODE_ENV === 'test' && process.env.MOCK_DB === 'false' && process.env.SQLITE_PATH) {
        console.log('[Database] FORCING SQLITE_PATH FOR TEST:', process.env.SQLITE_PATH);
        const sqliteModule = await import('../../legacy_archive/database.sqlite.js').then((m) => m.default || m);
        const db = (sqliteModule.getDatabaseInstance ? sqliteModule.getDatabaseInstance() : sqliteModule) as IDatabase;
        shimQuery(db);
        dbInstance = db;
        (process as any)[GLOBAL_DB_KEY] = db;
        (globalThis as any)[GLOBAL_DB_KEY] = db;
        return db;
    }

    if (process.env.MOCK_DB === 'true' || (process.env.NODE_ENV === 'test' && process.env.MOCK_DB !== 'false')) {
        console.log('[Database] Using MOCK database.');
        const mockDb = (global as any).__TEST_DB_MOCK__ || createMockDatabase();
        dbInstance = mockDb;
        (process as any)[GLOBAL_DB_KEY] = mockDb;
        (globalThis as any)[GLOBAL_DB_KEY] = mockDb;
        return mockDb;
    }

    const { type } = databaseConfig;
    if (type === 'postgres') {
        const db = PostgresDatabase as unknown as IDatabase;
        dbInstance = db;
        (process as any)[GLOBAL_DB_KEY] = db;
        (globalThis as any)[GLOBAL_DB_KEY] = db;
        return db;
    }

    // Default to SQLite
    const sqliteModule = await import('../../legacy_archive/database.sqlite.js').then((m) => m.default || m);
    const db = (sqliteModule.getDatabaseInstance ? sqliteModule.getDatabaseInstance() : sqliteModule) as IDatabase;
    shimQuery(db);
    dbInstance = db;
    (process as any)[GLOBAL_DB_KEY] = db;
    (globalThis as any)[GLOBAL_DB_KEY] = db;
    return db;
}

/**
 * Get database singleton instance (async)
 */
export async function getDatabaseAsync(): Promise<IDatabase> {
    syncWithGlobal();
    if (dbInstance && !(dbInstance as any).__CLOSED__) {
        return dbInstance;
    }

    if (dbInstancePromise) {
        const resolved = await dbInstancePromise;
        dbInstance = resolved;
        (process as any)[GLOBAL_DB_KEY] = resolved;
        (globalThis as any)[GLOBAL_DB_KEY] = resolved;
        return resolved;
    }

    dbInstancePromise = createDatabase();
    const resolved = await dbInstancePromise;
    dbInstance = resolved;
    (process as any)[GLOBAL_DB_KEY] = resolved;
    (globalThis as any)[GLOBAL_DB_KEY] = resolved;
    return resolved;
}

/**
 * Get internal database singleton instance (synchronous)
 */
export function getDatabaseInstance(): IDatabase {
    // FORCE SYNC with global on every access
    const globalHandle = (process as any)[GLOBAL_DB_KEY] || (globalThis as any)[GLOBAL_DB_KEY];
    if (globalHandle && !(globalHandle as any).__CLOSED__) {
        if (dbInstance !== globalHandle) {
            dbInstance = globalHandle;
        }
        return globalHandle;
    }

    if (dbInstance && !(dbInstance as any).__CLOSED__) {
        return dbInstance;
    }

    console.log('[Database] getDatabaseInstance() (SYNC) needs initialization.');

    // BRUTAL SYNC FALLBACK FOR TESTS
    if (process.env.NODE_ENV === 'test' && process.env.SQLITE_PATH && process.env.MOCK_DB === 'false') {
        console.log('[Database] Sync fallback to legacy. PATH:', process.env.SQLITE_PATH);
        const sqliteModule = require('../../legacy_archive/database.sqlite.js');
        const db = (sqliteModule.getDatabaseInstance ? sqliteModule.getDatabaseInstance() : sqliteModule) as IDatabase;
        shimQuery(db);
        dbInstance = db;
        (process as any)[GLOBAL_DB_KEY] = db;
        (globalThis as any)[GLOBAL_DB_KEY] = db;
        return db;
    }


    if (databaseConfig.type === 'sqlite') {
        const sqliteModule = require('../../legacy_archive/database.sqlite.js');
        const db = (sqliteModule.getDatabaseInstance ? sqliteModule.getDatabaseInstance() : sqliteModule) as IDatabase;
        shimQuery(db);
        dbInstance = db;
        (process as any)[GLOBAL_DB_KEY] = db;
        (globalThis as any)[GLOBAL_DB_KEY] = db;
        dbInstancePromise = Promise.resolve(db);
        return db;
    }

    // Fallback for tests if not initialized
    if (process.env.NODE_ENV === 'test') {
        const mockDb = createMockDatabase();
        dbInstance = mockDb;
        (process as any)[GLOBAL_DB_KEY] = mockDb;
        (globalThis as any)[GLOBAL_DB_KEY] = mockDb;
        return mockDb;
    }

    throw new Error('Database not initialized. Call getDatabaseAsync() first.');
}

/**
 * Global Database Instance Proxy
 */
export const dbProxy = new Proxy({} as IDatabase, {
    get(_, prop) {
        if (prop === '__CLOSED__') {
            syncWithGlobal();
            return dbInstance ? (dbInstance as any).__CLOSED__ : false;
        }

        const instance = getDatabaseInstance();
        const value = (instance as any)[prop];

        if (typeof value === 'function') {
            return (...args: any[]) => {
                const callWithRetry = (retryCount = 0): any => {
                    const currentDb = getDatabaseInstance();
                    const fn = (currentDb as any)[prop];

                    if (!fn) {
                        throw new Error(`Database instance does not have method: ${String(prop)}`);
                    }

                    // Handle callback-based methods
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

                    // Handle Promise-based methods
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
        return value;
    },
});

function resetConnectionLocally() {
    dbInstance = null;
    (process as any)[GLOBAL_DB_KEY] = null;
    (globalThis as any)[GLOBAL_DB_KEY] = null;
    dbInstancePromise = null;

    // Also clear legacy module internal key
    const SQLITE_GLOBAL_KEY = '__CONSULTIFY_SQLITE_INSTANCE__';
    (process as any)[SQLITE_GLOBAL_KEY] = null;
    (globalThis as any)[SQLITE_GLOBAL_KEY] = null;
    (global as any)[SQLITE_GLOBAL_KEY] = null;
}

/**
 * Force close connection and reset singleton
 */
export async function resetConnection(): Promise<void> {
    syncWithGlobal();
    const db = dbInstance;

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
