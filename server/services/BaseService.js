/**
 * Base Service Class
 * 
 * Provides common functionality for all services:
 * - Database query helpers
 * - Cache integration
 * - Error handling
 * - Logging
 * 
 * Usage:
 * ```javascript
 * const MyService = Object.assign({}, BaseService, {
 *   async getData(id) {
 *     return await this.queryOne('SELECT * FROM table WHERE id = ?', [id]);
 *   }
 * });
 * ```
 */

const db = require('../database');
const cacheHelper = require('../utils/cacheHelper');
const queryHelpers = require('../utils/queryHelpers');
const logger = require('../utils/logger');

const BaseService = {
    /**
     * Database instance (can be overridden in tests)
     */
    db,

    /**
     * Cache helper (can be overridden in tests)
     */
    cache: cacheHelper,

    /**
     * Query helpers (can be overridden in tests)
     */
    query: queryHelpers,

    /**
     * Execute SELECT query returning multiple rows
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @param {Object} options - Options { cacheKey, ttl, parseJson }
     * @returns {Promise<Array>}
     */
    async queryAll(sql, params = [], options = {}) {
        const { cacheKey, ttl, parseJson = false, jsonFields = [] } = options;

        if (cacheKey) {
            return await cacheHelper.getCached(cacheKey, async () => {
                const rows = await queryHelpers.queryAll(sql, params);
                return parseJson ? rows.map(r => queryHelpers.parseJsonFields(r, jsonFields)) : rows;
            }, ttl || cacheHelper.DEFAULT_TTL.MEDIUM);
        }

        const rows = await queryHelpers.queryAll(sql, params);
        return parseJson ? rows.map(r => queryHelpers.parseJsonFields(r, jsonFields)) : rows;
    },

    /**
     * Execute SELECT query returning single row
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @param {Object} options - Options { cacheKey, ttl, parseJson }
     * @returns {Promise<Object|null>}
     */
    async queryOne(sql, params = [], options = {}) {
        const { cacheKey, ttl, parseJson = false, jsonFields = [] } = options;

        if (cacheKey) {
            return await cacheHelper.getCached(cacheKey, async () => {
                const row = await queryHelpers.queryOne(sql, params);
                return parseJson && row ? queryHelpers.parseJsonFields(row, jsonFields) : row;
            }, ttl || cacheHelper.DEFAULT_TTL.MEDIUM);
        }

        const row = await queryHelpers.queryOne(sql, params);
        return parseJson && row ? queryHelpers.parseJsonFields(row, jsonFields) : row;
    },

    /**
     * Execute INSERT/UPDATE/DELETE query
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<{lastID: number, changes: number}>}
     */
    async queryRun(sql, params = []) {
        return await queryHelpers.queryRun(sql, params);
    },

    /**
     * Execute multiple queries in parallel
     * @param {Array<{sql: string, params: Array, type: string}>} queries
     * @returns {Promise<Array>}
     */
    async queryParallel(queries) {
        return await queryHelpers.queryParallel(queries);
    },

    /**
     * Invalidate cache for user
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     */
    async invalidateUserCache(userId, orgId) {
        await cacheHelper.invalidateUserCache(userId, orgId);
    },

    /**
     * Invalidate cache for project
     * @param {string} projectId - Project ID
     */
    async invalidateProjectCache(projectId) {
        await cacheHelper.invalidateProjectCache(projectId);
    },

    /**
     * Invalidate cache for organization
     * @param {string} orgId - Organization ID
     */
    async invalidateOrgCache(orgId) {
        await cacheHelper.invalidateOrgCache(orgId);
    },

    /**
     * Log info message
     * @param {string} message - Log message
     * @param {Object} meta - Additional metadata
     */
    logInfo(message, meta = {}) {
        logger.info(`[${this.constructor?.name || 'BaseService'}] ${message}`, meta);
    },

    /**
     * Log error message
     * @param {string} message - Log message
     * @param {Error|Object} error - Error object or metadata
     */
    logError(message, error = {}) {
        logger.error(`[${this.constructor?.name || 'BaseService'}] ${message}`, error);
    },

    /**
     * Set database instance (for testing)
     * @param {Object} mockDb - Mock database
     */
    setDb(mockDb) {
        this.db = mockDb;
    },

    /**
     * Set cache helper (for testing)
     * @param {Object} mockCache - Mock cache
     */
    setCache(mockCache) {
        this.cache = mockCache;
    }
};

module.exports = BaseService;


