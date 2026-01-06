/**
 * Database Interface
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Common interface for both SQLite and PostgreSQL implementations
 */

export interface QueryResult<T = unknown> {
    rows: T[];
    rowCount: number;
}

export interface RunResult {
    lastID?: number;
    changes: number;
}

/**
 * Database interface compatible with both SQLite and PostgreSQL
 */
export interface IDatabase {
    /**
     * Get a single row
     */
    get<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
    get<T = unknown>(sql: string, params: unknown[], callback: (err: Error | null, row: T | null) => void): this;
    get<T = unknown>(
        sql: string,
        params?: unknown[],
        callback?: (err: Error | null, row: T | null) => void,
    ): this | Promise<T | null>;

    /**
     * Get all rows
     */
    all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    all<T = unknown>(sql: string, params: unknown[], callback: (err: Error | null, rows: T[]) => void): this;
    all<T = unknown>(
        sql: string,
        params?: unknown[],
        callback?: (err: Error | null, rows: T[]) => void,
    ): this | Promise<T[]>;

    /**
     * Execute a query (INSERT/UPDATE/DELETE)
     */
    run(sql: string, params?: unknown[]): Promise<RunResult>;
    run(sql: string, params: unknown[], callback: (err: Error | null) => void): this;
    run(sql: string, params?: unknown[], callback?: (err: Error | null) => void): this | Promise<RunResult>;

    /**
     * Execute SQL script (multiple statements)
     */
    exec(sql: string, callback?: (err: Error | null) => void): this | Promise<void>;

    /**
     * Serialize database operations
     */
    serialize(callback: () => void): void;

    /**
     * Close database connection
     */
    close(callback?: (err: Error | null) => void): Promise<void> | void;

    /**
     * Query method (PostgreSQL style, polyfilled for SQLite)
     */
    query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}


