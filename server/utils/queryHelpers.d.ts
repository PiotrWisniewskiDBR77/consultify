/**
 * Query Helpers Utility
 *
 * Provides Promise-based wrappers and helpers for database queries.
 * Eliminates callback hell and provides consistent error handling.
 */
interface Database {
    all: (sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void) => void;
    get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
    run: (sql: string, params: unknown[], callback: (this: {
        lastID?: number;
        changes: number;
    }, err: Error | null) => void) => void;
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
export declare function queryAll(sql: string, params?: unknown[]): Promise<unknown[]>;
/**
 * Promise-based wrapper for db.get
 */
export declare function queryOne(sql: string, params?: unknown[]): Promise<unknown | null>;
/**
 * Promise-based wrapper for db.run
 */
export declare function queryRun(sql: string, params?: unknown[]): Promise<QueryResult>;
/**
 * Execute multiple queries in parallel
 */
export declare function queryParallel(queries: Query[]): Promise<unknown[]>;
/**
 * Build IN clause placeholders for array of values
 */
export declare function buildInPlaceholders(values: unknown[]): string;
/**
 * Build WHERE clause for organization filtering
 */
export declare function buildOrgFilter(tableAlias: string, _orgId: string): string;
/**
 * Build WHERE clause for user filtering (assignee or reporter)
 */
export declare function buildUserFilter(tableAlias: string, _userId: string): string;
/**
 * Execute transaction (for databases that support it)
 */
export declare function transaction<T>(callback: (db: Database) => Promise<T>): Promise<T>;
/**
 * Parse JSON fields safely
 */
export declare function parseJsonFields(row: Record<string, unknown>, jsonFields?: string[]): Record<string, unknown>;
/**
 * Transform database row to API format (snake_case to camelCase)
 */
export declare function transformRow(row: Record<string, unknown> | null, fieldMap?: Record<string, string>): Record<string, unknown> | null;
export {};
//# sourceMappingURL=queryHelpers.d.ts.map