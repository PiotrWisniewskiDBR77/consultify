/**
 * Professional Database Mock Factory
 *
 * Enterprise-grade database mocking for repository testing
 */
import { vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

export interface QueryResult<T = unknown> {
    rows: T[];
    rowCount: number;
    fields?: { name: string; dataTypeID: number }[];
}

export interface MockDatabaseConfig {
    latency?: number;
    failOnQuery?: string | RegExp;
    errorMessage?: string;
}

export interface Transaction {
    query: <T>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>;
    commit: () => Promise<void>;
    rollback: () => Promise<void>;
}

type QueryHandler = (sql: string, params?: unknown[]) => QueryResult | Promise<QueryResult>;

// ============================================================================
// Database Mock Factory
// ============================================================================

export class DatabaseMockFactory {
    private queries: { sql: string; params?: unknown[] }[] = [];
    private handlers: Map<string | RegExp, QueryHandler> = new Map();
    private defaultHandler: QueryHandler = () => ({ rows: [], rowCount: 0 });
    private config: MockDatabaseConfig = {};
    private inTransaction = false;
    private transactionQueries: { sql: string; params?: unknown[] }[] = [];

    /**
     * Configure mock behavior
     */
    configure(config: MockDatabaseConfig): this {
        this.config = { ...this.config, ...config };
        return this;
    }

    /**
     * Register a query handler
     */
    onQuery(pattern: string | RegExp, handler: QueryHandler | QueryResult): this {
        const handlerFn = typeof handler === 'function' ? handler : () => handler;
        this.handlers.set(pattern, handlerFn);
        return this;
    }

    /**
     * Set default handler for unmatched queries
     */
    setDefaultHandler(handler: QueryHandler): this {
        this.defaultHandler = handler;
        return this;
    }

    /**
     * Get recorded queries
     */
    getQueries(): { sql: string; params?: unknown[] }[] {
        return [...this.queries];
    }

    /**
     * Assert query was executed
     */
    assertQueryExecuted(pattern: string | RegExp): void {
        const found = this.queries.some((q) =>
            typeof pattern === 'string' ? q.sql.includes(pattern) : pattern.test(q.sql)
        );
        if (!found) {
            throw new Error(`Expected query matching "${pattern}" to be executed`);
        }
    }

    /**
     * Reset all mocks
     */
    reset(): void {
        this.queries = [];
        this.handlers.clear();
        this.transactionQueries = [];
        this.inTransaction = false;
    }

    /**
     * Execute a query
     */
    async query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
        // Record query
        const record = { sql, params };
        this.queries.push(record);
        if (this.inTransaction) {
            this.transactionQueries.push(record);
        }

        // Apply latency
        if (this.config.latency) {
            await new Promise((r) => setTimeout(r, this.config.latency));
        }

        // Check for forced failures
        if (this.config.failOnQuery) {
            const shouldFail =
                typeof this.config.failOnQuery === 'string'
                    ? sql.includes(this.config.failOnQuery)
                    : this.config.failOnQuery.test(sql);
            if (shouldFail) {
                throw new Error(this.config.errorMessage || 'Database error');
            }
        }

        // Find matching handler
        for (const [pattern, handler] of this.handlers) {
            const matches =
                typeof pattern === 'string' ? sql.includes(pattern) : pattern.test(sql);
            if (matches) {
                const result = await handler(sql, params);
                return result as QueryResult<T>;
            }
        }

        // Use default handler
        return this.defaultHandler(sql, params) as QueryResult<T>;
    }

    /**
     * Begin a transaction
     */
    async beginTransaction(): Promise<Transaction> {
        this.inTransaction = true;
        this.transactionQueries = [];

        const self = this;

        return {
            query: <T>(sql: string, params?: unknown[]) => self.query<T>(sql, params),
            commit: async () => {
                self.inTransaction = false;
                self.transactionQueries = [];
            },
            rollback: async () => {
                self.inTransaction = false;
                // Remove transaction queries from main log
                for (const tq of self.transactionQueries) {
                    const idx = self.queries.findIndex(
                        (q) => q.sql === tq.sql && q.params === tq.params
                    );
                    if (idx >= 0) self.queries.splice(idx, 1);
                }
                self.transactionQueries = [];
            },
        };
    }

    /**
     * Create mock database client
     */
    createClient(): {
        query: typeof this.query;
        beginTransaction: typeof this.beginTransaction;
        close: () => Promise<void>;
    } {
        return {
            query: this.query.bind(this),
            beginTransaction: this.beginTransaction.bind(this),
            close: vi.fn().mockResolvedValue(undefined),
        };
    }
}

// ============================================================================
// Query Result Builders
// ============================================================================

export const DbResults = {
    /**
     * Create empty result
     */
    empty: (): QueryResult => ({
        rows: [],
        rowCount: 0,
    }),

    /**
     * Create single row result
     */
    single: <T>(row: T): QueryResult<T> => ({
        rows: [row],
        rowCount: 1,
    }),

    /**
     * Create multiple rows result
     */
    many: <T>(rows: T[]): QueryResult<T> => ({
        rows,
        rowCount: rows.length,
    }),

    /**
     * Create insert result
     */
    inserted: <T>(row: T): QueryResult<T> => ({
        rows: [row],
        rowCount: 1,
    }),

    /**
     * Create update result
     */
    updated: (count: number): QueryResult => ({
        rows: [],
        rowCount: count,
    }),

    /**
     * Create delete result
     */
    deleted: (count: number): QueryResult => ({
        rows: [],
        rowCount: count,
    }),
};

// ============================================================================
// SQL Matchers
// ============================================================================

export const SqlMatchers = {
    select: (table: string) => new RegExp(`SELECT.*FROM\\s+${table}`, 'i'),
    insert: (table: string) => new RegExp(`INSERT\\s+INTO\\s+${table}`, 'i'),
    update: (table: string) => new RegExp(`UPDATE\\s+${table}\\s+SET`, 'i'),
    delete: (table: string) => new RegExp(`DELETE\\s+FROM\\s+${table}`, 'i'),
    selectById: (table: string) =>
        new RegExp(`SELECT.*FROM\\s+${table}.*WHERE.*id\\s*=`, 'i'),
    count: (table: string) => new RegExp(`SELECT\\s+COUNT.*FROM\\s+${table}`, 'i'),
};

// ============================================================================
// Factory Instance
// ============================================================================

export function createDbMock(): DatabaseMockFactory {
    return new DatabaseMockFactory();
}

// ============================================================================
// Common Repository Mock Setup
// ============================================================================

export function setupUserRepositoryMocks(mock: DatabaseMockFactory): void {
    mock
        .onQuery(SqlMatchers.select('users'), DbResults.many([
            { id: 'usr-001', email: 'user1@example.com', role: 'admin' },
            { id: 'usr-002', email: 'user2@example.com', role: 'member' },
        ]))
        .onQuery(SqlMatchers.selectById('users'), (sql, params) =>
            DbResults.single({
                id: params?.[0] || 'usr-001',
                email: 'user@example.com',
                role: 'member',
            })
        )
        .onQuery(SqlMatchers.insert('users'), (sql, params) =>
            DbResults.inserted({ id: 'usr-new', ...(params as object) })
        )
        .onQuery(SqlMatchers.update('users'), DbResults.updated(1))
        .onQuery(SqlMatchers.delete('users'), DbResults.deleted(1));
}

export function setupProjectRepositoryMocks(mock: DatabaseMockFactory): void {
    mock
        .onQuery(SqlMatchers.select('projects'), DbResults.many([
            { id: 'prj-001', name: 'Project 1', status: 'active' },
            { id: 'prj-002', name: 'Project 2', status: 'completed' },
        ]))
        .onQuery(SqlMatchers.selectById('projects'), (sql, params) =>
            DbResults.single({
                id: params?.[0] || 'prj-001',
                name: 'Sample Project',
                status: 'active',
            })
        )
        .onQuery(SqlMatchers.insert('projects'), (sql, params) =>
            DbResults.inserted({ id: 'prj-new', ...(params as object) })
        )
        .onQuery(SqlMatchers.update('projects'), DbResults.updated(1))
        .onQuery(SqlMatchers.delete('projects'), DbResults.deleted(1));
}
