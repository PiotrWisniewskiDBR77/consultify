/**
 * SQLite Async Helpers
 *
 * Provides promisified wrappers for sqlite3 operations
 * and a proper transaction helper with single COMMIT/ROLLBACK.
 */
/**
 * Execute a SQL statement that modifies data
 * @param {object} db - sqlite3 database instance
 * @param {string} sql - SQL statement
 * @param {array} params - Parameters for prepared statement
 * @returns {Promise<{changes: number, lastID: number}>}
 */
export function runAsync(db: object, sql: string, params?: array): Promise<{
    changes: number;
    lastID: number;
}>;
export function getAsync(db: any, sql: any, params?: any[]): Promise<any>;
export function allAsync(db: any, sql: any, params?: any[]): Promise<any>;
export function withTransaction(db: any, fn: any): Promise<any>;
//# sourceMappingURL=sqliteAsync.d.ts.map