/**
 * Database Query Adapter
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Full TypeScript migration of queryAdapter.js
 * Provides a unified interface for both SQLite and PostgreSQL
 */

import type { IDatabase, RunResult } from '../database/IDatabase.js';
import { run as dbRunPromise } from './DbPromise.js';

export type DatabaseType = 'sqlite' | 'postgres';

export interface AdaptedQuery {
    sql: string;
    params: unknown[];
}

/**
 * Database Query Adapter
 * Provides a unified interface for both SQLite and PostgreSQL
 */
export class QueryAdapter {
    private db: IDatabase;
    private type: DatabaseType;

    constructor(db: IDatabase, type: DatabaseType = 'sqlite') {
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
    async all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
        const adapted = this.adaptQuery(sql, params);

        if (this.type === 'postgres') {
            const result = await this.db.query<T>(adapted.sql, adapted.params);
            return result.rows;
        } else {
            return new Promise<T[]>((resolve, reject) => {
                this.db.all<T>(adapted.sql, adapted.params, (err: Error | null, rows: unknown) => {
                    if (err) reject(err);
                    else resolve((rows as T[]) || []);
                });
            });
        }
    }

    /**
     * Get single row
     */
    async get<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
        const adapted = this.adaptQuery(sql, params);

        if (this.type === 'postgres') {
            const result = await this.db.query<T>(adapted.sql, adapted.params);
            return result.rows[0] || null;
        } else {
            return new Promise<T | null>((resolve, reject) => {
                this.db.get<T>(adapted.sql, adapted.params, (err: Error | null, row: unknown) => {
                    if (err) reject(err);
                    else resolve((row as T) || null);
                });
            });
        }
    }

    /**
     * Execute a statement (INSERT, UPDATE, DELETE)
     */
    async run(sql: string, params: unknown[] = []): Promise<RunResult> {
        const adapted = this.adaptQuery(sql, params);

        if (this.type === 'postgres') {
            const result = await this.db.query(adapted.sql, adapted.params);
            return {
                changes: result.rowCount,
                lastID: (result.rows[0] as { id?: number })?.id, // For RETURNING id
            };
        } else {
            const result = await dbRunPromise(adapted.sql, adapted.params);
            if (!result.success) {
                throw new Error(result.error || 'Database operation failed');
            }
            return {
                changes: result.changes || 0,
                lastID: result.lastID,
            };
        }
    }

    /**
     * Begin transaction
     */
    async beginTransaction(): Promise<void> {
        if (this.type === 'postgres') {
            await this.db.query('BEGIN');
        } else {
            await this.run('BEGIN TRANSACTION');
        }
    }

    /**
     * Commit transaction
     */
    async commit(): Promise<void> {
        if (this.type === 'postgres') {
            await this.db.query('COMMIT');
        } else {
            await this.run('COMMIT');
        }
    }

    /**
     * Rollback transaction
     */
    async rollback(): Promise<void> {
        if (this.type === 'postgres') {
            await this.db.query('ROLLBACK');
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
    returning(column: string = 'id'): string {
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
