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

import { getDatabase } from '../database/Database.js';
import type { IDatabase, RunResult } from '../database/IDatabase.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface QueryOptions {
  cacheKey?: string;
  ttl?: number;
  parseJson?: boolean;
  jsonFields?: string[];
  // Compatibility for migrated code if needed, but standardizing on cacheKey
  _cacheKey?: string;
  _ttl?: number;
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
  protected async queryAll<R extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
    options: QueryOptions = {}
  ): Promise<R[]> {
    const { cacheKey, ttl, _cacheKey, _ttl, parseJson = false, jsonFields = [] } = options;

    // TODO: Implement cache integration when cacheHelper is migrated
    // if (cacheKey) {
    //     return await cacheHelper.getCached(cacheKey, async () => {
    //         const rows = await this.queryAllInternal(sql, params);
    //         return parseJson ? rows.map(r => this.parseJsonFields(r, jsonFields)) : rows;
    //     }, ttl || cacheHelper.DEFAULT_TTL.MEDIUM);
    // }

    const rows = await this.queryAllInternal<R>(sql, params);
    return parseJson ? rows.map((r) => this.parseJsonFields(r, jsonFields)) : rows;
  }

  /**
   * Execute SELECT query returning single row
   */
  protected async queryOne<R extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
    options: QueryOptions = {}
  ): Promise<R | null> {
    const { cacheKey, ttl, _cacheKey, _ttl, parseJson = false, jsonFields = [] } = options;

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
  protected async queryRun(sql: string, params: unknown[] = []): Promise<RunResult> {
    const result = await DbPromise.run(sql, params);
    return {
      lastID: result.lastID,
      changes: result.changes || 0,
    };
  }

  /**
   * Internal query all implementation
   */
  private async queryAllInternal<R extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[]
  ): Promise<R[]> {
    return await DbPromise.all<R>(sql, params);
  }

  /**
   * Internal query one implementation
   */
  private async queryOneInternal<R extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[]
  ): Promise<R | null> {
    return await DbPromise.get<R>(sql, params);
  }

  /**
   * Parse JSON fields in a row
   */
  private parseJsonFields<R extends Record<string, unknown>>(row: R, jsonFields: string[]): R {
    const parsed: any = { ...row };
    jsonFields.forEach((field) => {
      if (parsed[field] && typeof parsed[field] === 'string') {
        try {
          parsed[field] = JSON.parse(parsed[field] as string);
        } catch (e: unknown) {
          // Keep original value if parsing fails
        }
      }
    });
    return parsed as R;
  }

  // Abstract methods to be implemented by subclasses
  abstract findById(id: string): Promise<T | null>;
  abstract findMany(filters?: Record<string, unknown>): Promise<T[]>;
  abstract create(data: Partial<T>): Promise<T>;
  abstract update(id: string, data: Partial<T>): Promise<T>;
  abstract delete(id: string): Promise<boolean>;
}

export default BaseService;
