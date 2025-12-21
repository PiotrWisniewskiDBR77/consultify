/**
 * Database Query Adapter
 * 
 * Provides a unified interface for both SQLite and PostgreSQL
 * This is used by services that need database-agnostic queries
 */

import dbConfig from '../config/database.config';

interface Database {
    query?: (sql: string, params: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
    all?: (sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void) => void;
    get?: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
    run?: (sql: string, params: unknown[], callback: (this: { changes: number; lastID?: number }, err: Error | null) => void) => void;
}

interface RunResult {
    changes: number;
    lastID?: number;
}

interface AdaptedQuery {
    sql: string;
    params: unknown[];
}

export class QueryAdapter {
    private db: Database;
    private type: 'sqlite' | 'postgres';

    constructor(db: Database, type: 'sqlite' | 'postgres' = 'sqlite') {
        this.db = db;
        this.type = type;
    }

    /**
     * Convert SQLite placeholder (?) to PostgreSQL ($1, $2, ...)
     */
    adaptQuery(sql: string, params: unknown[] = []): AdaptedQuery {
        if (this.type === 'postgres' && sql.includes('?')) {
            let paramIndex = 1;
            sql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        }
        return { sql, params };
    }

    /**
     * Get all rows
     */
    async all(sql: string, params: unknown[] = []): Promise<unknown[]> {
        const adapted = this.adaptQuery(sql, params);

        if (this.type === 'postgres' && this.db.query) {
            const result = await this.db.query(adapted.sql, adapted.params);
            return result.rows;
        } else if (this.db.all) {
            return new Promise((resolve, reject) => {
                this.db.all!(adapted.sql, adapted.params, (err: Error | null, rows: unknown[]) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
        throw new Error('Database method not available');
    }

    /**
     * Get single row
     */
    async get(sql: string, params: unknown[] = []): Promise<unknown> {
        const adapted = this.adaptQuery(sql, params);

        if (this.type === 'postgres' && this.db.query) {
            const result = await this.db.query(adapted.sql, adapted.params);
            return result.rows[0];
        } else if (this.db.get) {
            return new Promise((resolve, reject) => {
                this.db.get!(adapted.sql, adapted.params, (err: Error | null, row: unknown) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }
        throw new Error('Database method not available');
    }

    /**
     * Execute a statement (INSERT, UPDATE, DELETE)
     */
    async run(sql: string, params: unknown[] = []): Promise<RunResult> {
        const adapted = this.adaptQuery(sql, params);

        if (this.type === 'postgres' && this.db.query) {
            const result = await this.db.query(adapted.sql, adapted.params);
            return {
                changes: result.rowCount,
                lastID: (result.rows[0] as { id?: number })?.id // For RETURNING id
            };
        } else if (this.db.run) {
            return new Promise((resolve, reject) => {
                this.db.run!(adapted.sql, adapted.params, function (this: { changes: number; lastID?: number }, err: Error | null) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes, lastID: this.lastID });
                });
            });
        }
        throw new Error('Database method not available');
    }

    /**
     * Begin transaction
     */
    async beginTransaction(): Promise<void> {
        if (this.type === 'postgres' && this.db.query) {
            await this.db.query('BEGIN', []);
        } else {
            await this.run('BEGIN TRANSACTION');
        }
    }

    /**
     * Commit transaction
     */
    async commit(): Promise<void> {
        if (this.type === 'postgres' && this.db.query) {
            await this.db.query('COMMIT', []);
        } else {
            await this.run('COMMIT');
        }
    }

    /**
     * Rollback transaction
     */
    async rollback(): Promise<void> {
        if (this.type === 'postgres' && this.db.query) {
            await this.db.query('ROLLBACK', []);
        } else {
            await this.run('ROLLBACK');
        }
    }

    /**
     * Get placeholder syntax for the database type
     */
    placeholder(index: number): string {
        return this.type === 'postgres' ? `$${index}` : '?';
    }

    /**
     * Get RETURNING clause (PostgreSQL) or nothing (SQLite uses lastID)
     */
    returning(column = 'id'): string {
        return this.type === 'postgres' ? ` RETURNING ${column}` : '';
    }

    /**
     * JSON functions differ between databases
     */
    jsonExtract(column: string, path: string): string {
        if (this.type === 'postgres') {
            return `${column}->>'${path}'`;
        } else {
            return `json_extract(${column}, '$.${path}')`;
        }
    }
}

export default QueryAdapter;

