/**
 * Base Service Class
 * Enterprise SaaS Architecture - Abstract service pattern for all domain services
 * Implements common CRUD operations with type safety
 */

import type { BaseService as IBaseService } from '../types';

export abstract class BaseService<T extends { id: string }> implements IBaseService<T> {
    protected abstract tableName: string;
    protected abstract db: DatabaseClient;

    /**
     * Find a single record by ID
     */
    async findById(id: string): Promise<T | null> {
        const result = await this.db.query<T>(
            `SELECT * FROM ${this.tableName} WHERE id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Find multiple records with optional filters
     */
    async findMany(filters: Record<string, unknown> = {}): Promise<T[]> {
        const { where, values } = this.buildWhereClause(filters);
        const result = await this.db.query<T>(
            `SELECT * FROM ${this.tableName} ${where} ORDER BY created_at DESC`,
            values
        );
        return result.rows;
    }

    /**
     * Find records with pagination
     */
    async findPaginated(
        filters: Record<string, unknown> = {},
        page = 1,
        limit = 20
    ): Promise<{ items: T[]; total: number; hasMore: boolean }> {
        const { where, values } = this.buildWhereClause(filters);
        const offset = (page - 1) * limit;

        const [countResult, dataResult] = await Promise.all([
            this.db.query<{ count: string }>(
                `SELECT COUNT(*) as count FROM ${this.tableName} ${where}`,
                values
            ),
            this.db.query<T>(
                `SELECT * FROM ${this.tableName} ${where} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
                [...values, limit, offset]
            )
        ]);

        const total = parseInt(countResult.rows[0]?.count || '0', 10);

        return {
            items: dataResult.rows,
            total,
            hasMore: offset + dataResult.rows.length < total
        };
    }

    /**
     * Create a new record
     */
    async create(data: Partial<T>): Promise<T> {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map((_, i) => `$${i + 1}`);

        const result = await this.db.query<T>(
            `INSERT INTO ${this.tableName} (${columns.join(', ')}) 
             VALUES (${placeholders.join(', ')}) 
             RETURNING *`,
            values
        );

        return result.rows[0];
    }

    /**
     * Update an existing record
     */
    async update(id: string, data: Partial<T>): Promise<T> {
        const entries = Object.entries(data).filter(([key]) => key !== 'id');
        const setClause = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
        const values = [...entries.map(([, value]) => value), id];

        const result = await this.db.query<T>(
            `UPDATE ${this.tableName} 
             SET ${setClause}, updated_at = NOW() 
             WHERE id = $${values.length} 
             RETURNING *`,
            values
        );

        return result.rows[0];
    }

    /**
     * Delete a record by ID (soft delete if supported)
     */
    async delete(id: string): Promise<boolean> {
        const result = await this.db.query(
            `DELETE FROM ${this.tableName} WHERE id = $1`,
            [id]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Soft delete (if table has deleted_at column)
     */
    async softDelete(id: string): Promise<boolean> {
        const result = await this.db.query(
            `UPDATE ${this.tableName} SET deleted_at = NOW() WHERE id = $1`,
            [id]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Build WHERE clause from filters
     */
    protected buildWhereClause(filters: Record<string, unknown>): {
        where: string;
        values: unknown[];
    } {
        const entries = Object.entries(filters).filter(([, v]) => v !== undefined);
        
        if (entries.length === 0) {
            return { where: '', values: [] };
        }

        const conditions = entries.map(([key], i) => `${key} = $${i + 1}`);
        const values = entries.map(([, value]) => value);

        return {
            where: `WHERE ${conditions.join(' AND ')}`,
            values
        };
    }

    /**
     * Check if record exists
     */
    async exists(id: string): Promise<boolean> {
        const result = await this.db.query<{ exists: boolean }>(
            `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE id = $1) as exists`,
            [id]
        );
        return result.rows[0]?.exists ?? false;
    }

    /**
     * Count records with optional filters
     */
    async count(filters: Record<string, unknown> = {}): Promise<number> {
        const { where, values } = this.buildWhereClause(filters);
        const result = await this.db.query<{ count: string }>(
            `SELECT COUNT(*) as count FROM ${this.tableName} ${where}`,
            values
        );
        return parseInt(result.rows[0]?.count || '0', 10);
    }
}

/**
 * Database client interface (to be implemented by actual DB adapter)
 */
interface DatabaseClient {
    query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

interface QueryResult<T> {
    rows: T[];
    rowCount: number | null;
}


