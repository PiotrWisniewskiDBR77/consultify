/**
 * Base Service Class
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Provides common functionality for all services:
 * - Database query helpers
 * - Cache integration
 * - Error handling
 * - Logging
 */

import type { IDatabase, RunResult } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface QueryOptions {
    cacheKey?: string;
    ttl?: number;
    parseJson?: boolean;
    jsonFields?: string[];
}

export interface QueryParallelItem {
    sql: string;
    params?: unknown[];
    type: 'select' | 'insert' | 'update' | 'delete';
}

// ==========================================
// BASE SERVICE
// ==========================================

/**
 * Abstract base service class
 * Provides common CRUD operations and query helpers
 */
export abstract class BaseService<T extends { id: string }> {
    protected db: IDatabase;
    protected logger: typeof logger;

    constructor(dbInstance?: IDatabase) {
        this.db = dbInstance || getDatabase();
        this.logger = logger;
    }

    /**
     * Execute SELECT query returning multiple rows
     */
    protected async queryAll<R = unknown>(
        sql: string,
        params: unknown[] = [],
        options: QueryOptions = {}
    ): Promise<R[]> {
        const { cacheKey, ttl, parseJson = false, jsonFields = [] } = options;

        // TODO: Implement cache integration when cacheHelper is migrated
        // if (cacheKey) {
        //     return await cacheHelper.getCached(cacheKey, async () => {
        //         const rows = await this.queryAllInternal(sql, params);
        //         return parseJson ? rows.map(r => this.parseJsonFields(r, jsonFields)) : rows;
        //     }, ttl || cacheHelper.DEFAULT_TTL.MEDIUM);
        // }

        const rows = await this.queryAllInternal<R>(sql, params);
        return parseJson ? rows.map(r => this.parseJsonFields(r, jsonFields)) : rows;
    }

    /**
     * Execute SELECT query returning single row
     */
    protected async queryOne<R = unknown>(
        sql: string,
        params: unknown[] = [],
        options: QueryOptions = {}
    ): Promise<R | null> {
        const { cacheKey, ttl, parseJson = false, jsonFields = [] } = options;

        // TODO: Implement cache integration when cacheHelper is migrated
        // if (cacheKey) {
        //     return await cacheHelper.getCached(cacheKey, async () => {
        //         const row = await this.queryOneInternal(sql, params);
        //         return parseJson && row ? this.parseJsonFields(row, jsonFields) : row;
        //     }, ttl || cacheHelper.DEFAULT_TTL.MEDIUM);
        // }

        const row = await this.queryOneInternal<R>(sql, params);
        return parseJson && row ? this.parseJsonFields(row, jsonFields) : row;
    }

    /**
     * Execute INSERT/UPDATE/DELETE query
     */
    protected async queryRun(
        sql: string,
        params: unknown[] = []
    ): Promise<RunResult> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                // Get result from context (SQLite) or from query result (PostgreSQL)
                const result: RunResult = {
                    lastID: (this.db as unknown as { lastID?: number }).lastID,
                    changes: (this.db as unknown as { changes?: number }).changes || 0,
                };
                resolve(result);
            });
        });
    }

    /**
     * Internal query all implementation
     */
    private async queryAllInternal<R = unknown>(sql: string, params: unknown[]): Promise<R[]> {
        return new Promise((resolve, reject) => {
            this.db.all<R>(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows || []);
            });
        });
    }

    /**
     * Internal query one implementation
     */
    private async queryOneInternal<R = unknown>(sql: string, params: unknown[]): Promise<R | null> {
        return new Promise((resolve, reject) => {
            this.db.get<R>(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row || null);
            });
        });
    }

    /**
     * Parse JSON fields in a row
     */
    private parseJsonFields(row: Record<string, unknown>, jsonFields: string[]): Record<string, unknown> {
        const parsed = { ...row };
        jsonFields.forEach(field => {
            if (parsed[field] && typeof parsed[field] === 'string') {
                try {
                    parsed[field] = JSON.parse(parsed[field] as string);
                } catch (e) {
                    // Keep original value if parsing fails
                }
            }
        });
        return parsed;
    }

    // Abstract methods to be implemented by subclasses
    abstract findById(id: string): Promise<T | null>;
    abstract findMany(filters?: Record<string, unknown>): Promise<T[]>;
    abstract create(data: Partial<T>): Promise<T>;
    abstract update(id: string, data: Partial<T>): Promise<T>;
    abstract delete(id: string): Promise<boolean>;
}

export default BaseService;
