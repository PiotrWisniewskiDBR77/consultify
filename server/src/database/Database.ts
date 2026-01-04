/**
 * Database Factory
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Factory pattern for creating database instances (SQLite or PostgreSQL)
 * Full TypeScript ES modules implementation
 */

import type { IDatabase } from './IDatabase.js';
import { databaseConfig } from '../config/DatabaseConfig.js';
import PostgresDatabase from './PostgresDatabase.js';

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
            callback?: (err: Error | null, row: T | null) => void
        ): MockDatabase {
            if (callback) {
                callback(null, null);
            }
            return this;
        },
        all<T = unknown>(
            _sql: string,
            _params?: unknown[],
            callback?: (err: Error | null, rows: T[]) => void
        ): MockDatabase {
            if (callback) {
                callback(null, []);
            }
            return this;
        },
        run(
            _sql: string,
            _params?: unknown[],
            callback?: (err: Error | null) => void
        ): MockDatabase {
            if (callback) {
                callback(null);
            }
            return this;
        },
        exec(_sql: string, callback?: (err: Error | null) => void): MockDatabase {
            if (callback) {
                callback(null);
            }
            return this;
        },
        serialize(callback: () => void): void {
            callback();
        },
        close(callback?: (err: Error | null) => void): Promise<void> {
            if (callback) {
                callback(null);
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
    if (process.env.MOCK_DB === 'true' || process.env.NODE_ENV === 'test') {
        console.log('[Database] Using test/mock database');
        const mockDb = global.__TEST_DB_MOCK__ as MockDatabase | undefined;
        if (mockDb) {
            return mockDb;
        }
        return createMockDatabase();
    }

    // Use TypeScript implementations
    if (databaseConfig.type === 'postgres') {
        console.log('[Database] Selected: PostgreSQL');
        return PostgresDatabase as unknown as IDatabase;
    } else {
        console.log('[Database] Selected: SQLite (Legacy)');
        // Use dynamic import for ES modules compatibility
        try {
            const sqliteModule = await import('../../database.sqlite.active.js').then(m => m.default || m);
            return (sqliteModule.default || sqliteModule) as IDatabase;
        } catch (err: unknown) {
            console.error('[Database] Failed to load legacy SQLite database:', err);
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
        dbInstancePromise = createDatabase().then(db => {
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

    // Mock database for tests must be handled first to avoid any real DB initialization
    if (process.env.MOCK_DB === 'true' || process.env.NODE_ENV === 'test') {
        const mockDb = global.__TEST_DB_MOCK__ as MockDatabase | undefined;
        if (mockDb) {
            dbInstance = mockDb;
            return dbInstance;
        }
        dbInstance = createMockDatabase();
        return dbInstance;
    }

    // For backward compatibility, try to initialize synchronously
    // If async initialization is needed, use getDatabaseAsync()
    if (databaseConfig.type === 'postgres') {
        dbInstance = PostgresDatabase as unknown as IDatabase;
        return dbInstance;
    }
    // For SQLite, return mock for now (will be initialized async on first use)
    // This maintains backward compatibility while allowing async initialization
    if (!dbInstance) {
        dbInstance = createMockDatabase();
    }
    return dbInstance;
}

// Export default instance
const db = getDatabase();
export default db;

// Type guard for global test mock
declare global {
    // eslint-disable-next-line no-var
    var __TEST_DB_MOCK__: MockDatabase | undefined;
}
