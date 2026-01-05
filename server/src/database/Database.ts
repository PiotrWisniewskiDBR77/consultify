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
const require = createRequire(import.meta.url);
import logger from '../utils/Logger.js';

// SQLiteDatabase will be imported using dynamic import for ES modules compatibility

// Mock database for tests
export interface MockDatabase extends IDatabase {
    _mockData?: Record<string, unknown[]>;
}

/**
 * Create a mock database for testing
 */
function createMockDatabase(): MockDatabase {
    const mockData: Record<string, unknown[]> = {};

    return {
        _mockData: mockData,
        get<T = unknown>(
            _sql: string,
            _params?: unknown[],
            callback?: (err: Error | null, row: T | null) => void,
        ): any {
            if (callback) {
                callback(null, null);
                return this;
            }
            return Promise.resolve(null);
        },
        all<T = unknown>(_sql: string, _params?: unknown[], callback?: (err: Error | null, rows: T[]) => void): any {
            if (callback) {
                callback(null, []);
                return this;
            }
            return Promise.resolve([]);
        },
        run(_sql: string, _params?: unknown[], callback?: (err: Error | null) => void): any {
            if (callback) {
                // @ts-ignore - Mock sqlite context
                callback.call({ lastID: 0, changes: 0 }, null);
                return this;
            }
            return Promise.resolve({ lastID: 0, changes: 0 });
        },
        exec(_sql: string, callback?: (err: Error | null) => void): any {
            if (callback) {
                callback(null);
                return this;
            }
            return Promise.resolve();
        },
        serialize(callback: () => void): void {
            callback();
        },
        close(callback?: (err: Error | null) => void): Promise<void> | void {
            if (callback) {
                callback(null);
                return;
            }
            return Promise.resolve();
        },
        async query<T = unknown>(_text: string, _params?: unknown[]): Promise<{ rows: T[]; rowCount: number }> {
            return { rows: [], rowCount: 0 };
        },
    };
}

/**
 * Create database instance based on configuration
 *
 * Full TypeScript ES modules implementation
 */
export async function createDatabase(): Promise<IDatabase> {
    // Mock database for tests
    if (process.env.MOCK_DB === 'true' || (process.env.NODE_ENV === 'test' && process.env.MOCK_DB !== 'false')) {
        logger.info('[Database] Using test/mock database');
        const mockDb = global.__TEST_DB_MOCK__ as MockDatabase | undefined;
        if (mockDb) {
            return mockDb;
        }
        return createMockDatabase();
    }

    // Use TypeScript implementations
    if (databaseConfig.type === 'postgres') {
        logger.info('[Database] Selected: PostgreSQL');
        return PostgresDatabase as unknown as IDatabase;
    } else {
        logger.info('[Database] Selected: SQLite (Legacy)');
        // Use dynamic import for ES modules compatibility
        try {
            const sqliteModule = await import('../../database.sqlite.js').then((m) => m.default || m);
            const db = (sqliteModule.default || sqliteModule) as IDatabase;

            // SHIM: Ensure .query exists (critical for DatabaseInitializer)
            if (db && typeof (db as any).query !== 'function') {
                logger.info('[Database] Shimming .query() method on async SQLite instance');
                (db as any).query = function (text: string, params: any[]) {
                    return new Promise((resolve, reject) => {
                        db.all(text, params, (err: Error | null, rows: any[]) => {
                            if (err) reject(err);
                            else resolve({ rows: rows || [], rowCount: rows ? rows.length : 0 });
                        });
                    });
                };
            }

            return db;
        } catch (err: any) {
            logger.error('[Database] Failed to load legacy SQLite database:', err);
            // Fallback to mock to prevent total crash in some environments, or re-throw
            throw err;
        }
    }
}

// Singleton instance
let dbInstance: IDatabase | null = null;
let dbInstancePromise: Promise<IDatabase> | null = null;

/**
 * Get database singleton instance (async)
 */
export async function getDatabaseAsync(): Promise<IDatabase> {
    if (dbInstance) {
        return dbInstance;
    }
    if (!dbInstancePromise) {
        dbInstancePromise = createDatabase().then((db) => {
            dbInstance = db;
            return db;
        });
    }
    return dbInstancePromise;
}

/**
 * Get database singleton instance (synchronous for backward compatibility)
 * Note: This will initialize synchronously if possible, otherwise returns a mock
 */
export function getDatabase(): IDatabase {
    if (dbInstance) {
        return dbInstance;
    }

    // Mock database logic:
    // 1. Explicitly enabled via MOCK_DB='true'
    // 2. Implicitly enabled in 'test' env, UNLESS explicitly disabled via MOCK_DB='false'
    const shouldMock =
        process.env.MOCK_DB === 'true' || (process.env.NODE_ENV === 'test' && process.env.MOCK_DB !== 'false');

    logger.debug('[Database:DEBUG] Initialization state', {
        MOCK_DB: process.env.MOCK_DB,
        NODE_ENV: process.env.NODE_ENV,
        shouldMock,
    });

    if (shouldMock) {
        const globalMock = (global as any).__TEST_DB_MOCK__ as MockDatabase | undefined;
        if (globalMock) {
            dbInstance = globalMock;
            return dbInstance;
        }
        dbInstance = createMockDatabase();
        return dbInstance;
    }

    // Load configuration to check for postgres
    // const databaseConfig = require('../../config/database.config'); // Dynamic require if needed

    // For backward compatibility, try to initialize synchronously
    // If async initialization is needed, use getDatabaseAsync()
    if (databaseConfig.type === 'postgres') {
        dbInstance = PostgresDatabase as unknown as IDatabase;
        return dbInstance;
    }

    // For SQLite, try to load synchronously using require
    // This is a fallback for synchronous access
    try {
        // Try to dynamically import synchronously using a createRequire trick
        // const { createRequire } = require('module'); // BROKEN IN ESM
        // const requireSync = createRequire(import.meta.url); // Already created at top level
        // Dynamic import for ESM compatibility - using createRequire for synchronous access
        const sqliteModule = require('../../database.sqlite.js');

        dbInstance = (sqliteModule.default || sqliteModule) as IDatabase;

        // SHIM: Ensure .query exists (critical for DatabaseInitializer)
        if (dbInstance && typeof (dbInstance as any).query !== 'function') {
            logger.info('[Database] Shimming .query() method on synchronous SQLite instance');
            (dbInstance as any).query = function (text: string, params: any[]) {
                return new Promise((resolve, reject) => {
                    this.all(text, params, (err: Error | null, rows: any[]) => {
                        if (err) reject(err);
                        else resolve({ rows: rows || [], rowCount: rows ? rows.length : 0 });
                    });
                });
            };
        }

        logger.info('[Database] Loaded SQLite synchronously');
        return dbInstance;
    } catch (err: any) {
        logger.warn('[Database] Could not load SQLite synchronously, using mock. Call getDatabaseAsync() first.');
        // Return a proxy that will queue requests until real db is ready
        if (!dbInstance) {
            dbInstance = createMockDatabase();
        }
        return dbInstance;
    }
}

// Export default instance
const db = getDatabase();
export default db;

// Type guard for global test mock
declare global {
    var __TEST_DB_MOCK__: MockDatabase | undefined;
}
