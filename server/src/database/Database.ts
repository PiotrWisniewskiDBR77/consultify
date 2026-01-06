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
const GLOBAL_DB_KEY = '__CONSULTIFY_GLOBAL_DB_INSTANCE__';
const SQLITE_GLOBAL_KEY = '__CONSULTIFY_SQLITE_INSTANCE__';

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

    // Default to SQLite
    console.log('[Database] Loading SQLite legacy module...');
    const sqliteModule = await import('../../legacy_archive/database.sqlite.js').then((m) => m.default || m);
    const db = (sqliteModule.getDatabaseInstance ? sqliteModule.getDatabaseInstance() : sqliteModule) as IDatabase;
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

    if (process.env.NODE_ENV === 'test' && process.env.MOCK_DB !== 'false' && !process.env.SQLITE_PATH) {
        const mockDb = createMockDatabase();
        setToGlobal(mockDb);
        return mockDb;
    }

    // SQLite Sync Fallback
    try {
        const sqliteModule = require('../../legacy_archive/database.sqlite.js');
        const db = (sqliteModule.getDatabaseInstance ? sqliteModule.getDatabaseInstance() : sqliteModule) as IDatabase;
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
 * Global Database Instance Proxy
 */
export const dbProxy = new Proxy({} as IDatabase, {
    get(_, prop) {
        if (prop === '__CLOSED__') {
            const current = getFromGlobal();
            return current ? (current as any).__CLOSED__ : false;
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

                    // If a callback is provided, use the original function
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

                    // If NO callback is provided, and it's a common method, wrap in a Promise
                    if (['get', 'all', 'run', 'exec'].includes(prop as string)) {
                        return new Promise((resolve, reject) => {
                            const callback = function (this: any, err: any, result: any) {
                                if (err) {
                                    if (err.message && err.message.includes('Database is closed') && retryCount < 1) {
                                        resetConnectionLocally();
                                        // This is tricky inside a callback, but we try
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

                    // Handle already Promise-based methods or other methods
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
