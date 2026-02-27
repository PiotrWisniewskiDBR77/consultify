/**
 * Database Query Adapter
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Unified interface for PostgreSQL.
 */

import type { IDatabase, RunResult } from '../database/IDatabase.js';

export type DatabaseType = 'postgres';

export interface AdaptedQuery {
  sql: string;
  params: unknown[];
}

/**
 * Database Query Adapter
 * Provides a unified interface for PostgreSQL
 */
export class QueryAdapter {
  private db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

  /**
   * Convert SQLite placeholder (?) to PostgreSQL ($1, $2, ...)
   */
  adaptQuery(sql: string, params: unknown[] = []): AdaptedQuery {
    if (sql.includes('?')) {
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
    const result = await this.db.query<T>(adapted.sql, adapted.params);
    return result.rows;
  }

  /**
   * Get single row
   */
  async get<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const adapted = this.adaptQuery(sql, params);
    const result = await this.db.query<T>(adapted.sql, adapted.params);
    return result.rows[0] || null;
  }

  /**
   * Execute a statement (INSERT, UPDATE, DELETE)
   */
  async run(sql: string, params: unknown[] = []): Promise<RunResult> {
    const adapted = this.adaptQuery(sql, params);
    const result = await this.db.query(adapted.sql, adapted.params);
    return {
      changes: result.rowCount,
      lastID: (result.rows[0] as { id?: number })?.id,
    };
  }

  /**
   * Begin transaction
   */
  async beginTransaction(): Promise<void> {
    await this.db.query('BEGIN');
  }

  /**
   * Commit transaction
   */
  async commit(): Promise<void> {
    await this.db.query('COMMIT');
  }

  /**
   * Rollback transaction
   */
  async rollback(): Promise<void> {
    await this.db.query('ROLLBACK');
  }

  /**
   * Get placeholder syntax for PostgreSQL
   */
  placeholder(index: number): string {
    return `$${index}`;
  }

  /**
   * Get RETURNING clause (PostgreSQL)
   */
  returning(column: string = 'id'): string {
    return ` RETURNING ${column}`;
  }

  /**
   * JSON extract for PostgreSQL
   */
  jsonExtract(column: string, path: string): string {
    return `${column}->>'${path}'`;
  }
}

export default QueryAdapter;
