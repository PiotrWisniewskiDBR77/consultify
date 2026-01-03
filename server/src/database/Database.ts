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
// SQLiteDatabase will be imported once migration is complete
// For now, we'll use dynamic import for SQLite during migration

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
export function createDatabase(): IDatabase {
    // Mock database for tests
    if (process.env.MOCK_DB === 'true') {
        console.log('[Database] Mocking database for tests');
        const mockDb = global.__TEST_DB_MOCK__ as MockDatabase | undefined;
        if (mockDb) {
            return mockDb;
        }
        return createMockDatabase();
    }

    // Use TypeScript implementations
    if (databaseConfig.type === 'postgres') {
        console.log('[Database] Selected: PostgreSQL');
        return PostgresDatabase;
    } else {
        console.log('[Database] Selected: SQLite');
        // During migration, use dynamic import for SQLite
        // Once SQLiteDatabase.ts is fully migrated, we can use static import
        // For now, we'll import the existing JS file as ES module
        // Note: database.sqlite.active.js still uses createRequire() internally
        // This will be replaced with SQLiteDatabase.ts once full migration is complete
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqliteModule = require('../../database.sqlite.active.js');
        return sqliteModule.default as IDatabase;
    }
}

// Singleton instance
let dbInstance: IDatabase | null = null;

/**
 * Get database singleton instance
 */
export function getDatabase(): IDatabase {
    if (!dbInstance) {
        dbInstance = createDatabase();
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

