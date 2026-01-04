/**
 * Base Service Class
 * 
 * Provides common functionality for all services:
 * - Database query helpers
 * - Cache integration
 * - Error handling
 * - Logging
 */

import * as cacheHelperMod from '../utils/cacheHelper.js';
const cacheHelper = cacheHelperMod.default || cacheHelperMod;
import * as queryHelpersMod from '../utils/queryHelpers.js';
const queryHelpers = queryHelpersMod.default || queryHelpersMod;
import logger from '../utils/logger.js';

class BaseService {
    constructor() {
        this._db = null;
        this._cache = cacheHelper;
        this._queryHelpers = queryHelpers;
    }

    /**
     * Initialize dependencies lazily
     */
    async init() {
        if (!this._db) {
            const dbModule = await import('../src/database/Database.ts')
            this._db = dbModule.default || dbModule;
        }
        return this;
    }

    /**
     * Set dependencies manually (useful for testing)
     */
    setDependencies(deps = {}) {
        if (deps.db) this._db = deps.db;
        if (deps.cache) this._cache = deps.cache;
        if (deps.queryHelpers) this._queryHelpers = deps.queryHelpers;
    }

    /**
     * Execute SELECT query returning multiple rows
     */
    async queryAll(sql, params = [], options = {}) {
        await this.init();
        const { cacheKey, ttl, parseJson = false, jsonFields = [] } = options;

        if (cacheKey && this._cache) {
            return await this._cache.getCached(cacheKey, async () => {
                const rows = await this._queryHelpers.queryAll(sql, params);
                return parseJson ? rows.map(r => this._queryHelpers.parseJsonFields(r, jsonFields)) : rows;
            }, ttl || this._cache.DEFAULT_TTL.MEDIUM);
        }

        const rows = await this._queryHelpers.queryAll(sql, params);
        return parseJson ? rows.map(r => this._queryHelpers.parseJsonFields(r, jsonFields)) : rows;
    }

    /**
     * Execute SELECT query returning single row
     */
    async queryOne(sql, params = [], options = {}) {
        await this.init();
        const { cacheKey, ttl, parseJson = false, jsonFields = [] } = options;

        if (cacheKey && this._cache) {
            return await this._cache.getCached(cacheKey, async () => {
                const row = await this._queryHelpers.queryOne(sql, params);
                return parseJson && row ? this._queryHelpers.parseJsonFields(row, jsonFields) : row;
            }, ttl || this._cache.DEFAULT_TTL.MEDIUM);
        }

        const row = await this._queryHelpers.queryOne(sql, params);
        return parseJson && row ? this._queryHelpers.parseJsonFields(row, jsonFields) : row;
    }

    /**
     * Execute INSERT/UPDATE/DELETE query
     */
    async queryRun(sql, params = []) {
        await this.init();
        return await this._queryHelpers.queryRun(sql, params);
    }

    /**
     * Log info message
     */
    logInfo(message, meta = {}) {
        logger.info(`[${this.constructor.name}] ${message}`, meta);
    }

    /**
     * Log error message
     */
    logError(message, error = {}) {
        logger.error(`[${this.constructor.name}] ${message}`, error);
    }
}

export default BaseService;








