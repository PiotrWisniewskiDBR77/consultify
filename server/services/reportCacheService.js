/**
 * Report Cache Service
 * 
 * Provides caching for management report aggregations to improve performance.
 * Uses in-memory cache with TTL for frequently accessed portfolio data.
 * 
 * PMO Standards: ISO 21500, PMBOK 7, PRINCE2
 */

const NodeCache = require('node-cache');

// Cache configuration
const DEFAULT_TTL = 300; // 5 minutes default TTL
const CHECK_PERIOD = 60; // Check for expired keys every 60 seconds

// Initialize cache
const cache = new NodeCache({ 
    stdTTL: DEFAULT_TTL, 
    checkperiod: CHECK_PERIOD,
    useClones: true // Return clones to prevent mutation
});

/**
 * Cache key generators for different data types
 */
const CacheKeys = {
    portfolioStatus: (orgId) => `portfolio_status:${orgId}`,
    projectStatus: (projectId) => `project_status:${projectId}`,
    portfolioKPIs: (orgId) => `portfolio_kpis:${orgId}`,
    projectKPIs: (projectId) => `project_kpis:${projectId}`,
    portfolioRisks: (orgId) => `portfolio_risks:${orgId}`,
    projectRisks: (projectId) => `project_risks:${projectId}`,
    portfolioTasks: (orgId) => `portfolio_tasks:${orgId}`,
    projectTasks: (projectId) => `project_tasks:${projectId}`,
    reportHistory: (orgId, filters) => `report_history:${orgId}:${JSON.stringify(filters || {})}`,
    pmoHealth: (projectId) => `pmo_health:${projectId}`
};

const ReportCacheService = {
    /**
     * Get cached value by key
     * @param {string} key - Cache key
     * @returns {any|undefined} Cached value or undefined if not found/expired
     */
    get: (key) => {
        try {
            const value = cache.get(key);
            if (value !== undefined) {
                console.log(`[ReportCache] HIT: ${key}`);
            }
            return value;
        } catch (err) {
            console.warn(`[ReportCache] Error getting key ${key}:`, err.message);
            return undefined;
        }
    },

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Optional TTL in seconds
     * @returns {boolean} Success status
     */
    set: (key, value, ttl = DEFAULT_TTL) => {
        try {
            const success = cache.set(key, value, ttl);
            if (success) {
                console.log(`[ReportCache] SET: ${key} (TTL: ${ttl}s)`);
            }
            return success;
        } catch (err) {
            console.warn(`[ReportCache] Error setting key ${key}:`, err.message);
            return false;
        }
    },

    /**
     * Delete specific key from cache
     * @param {string} key - Cache key
     * @returns {number} Number of deleted entries
     */
    del: (key) => {
        try {
            const count = cache.del(key);
            if (count > 0) {
                console.log(`[ReportCache] DEL: ${key}`);
            }
            return count;
        } catch (err) {
            console.warn(`[ReportCache] Error deleting key ${key}:`, err.message);
            return 0;
        }
    },

    /**
     * Invalidate all cache entries matching a pattern
     * @param {string} pattern - Pattern to match (substring of key)
     * @returns {number} Number of invalidated entries
     */
    invalidate: (pattern) => {
        try {
            const keys = cache.keys().filter(k => k.includes(pattern));
            if (keys.length > 0) {
                keys.forEach(k => cache.del(k));
                console.log(`[ReportCache] INVALIDATE: ${pattern} (${keys.length} keys)`);
            }
            return keys.length;
        } catch (err) {
            console.warn(`[ReportCache] Error invalidating pattern ${pattern}:`, err.message);
            return 0;
        }
    },

    /**
     * Invalidate all cache entries for an organization
     * @param {string} orgId - Organization ID
     * @returns {number} Number of invalidated entries
     */
    invalidateOrganization: (orgId) => {
        return ReportCacheService.invalidate(orgId);
    },

    /**
     * Invalidate all cache entries for a project
     * @param {string} projectId - Project ID
     * @returns {number} Number of invalidated entries
     */
    invalidateProject: (projectId) => {
        return ReportCacheService.invalidate(projectId);
    },

    /**
     * Clear all cache entries
     */
    flush: () => {
        try {
            cache.flushAll();
            console.log('[ReportCache] FLUSH: All entries cleared');
        } catch (err) {
            console.warn('[ReportCache] Error flushing cache:', err.message);
        }
    },

    /**
     * Get cache statistics
     * @returns {object} Cache stats
     */
    getStats: () => {
        return {
            keys: cache.keys().length,
            hits: cache.getStats().hits,
            misses: cache.getStats().misses,
            ksize: cache.getStats().ksize,
            vsize: cache.getStats().vsize
        };
    },

    /**
     * Get or compute cached value
     * @param {string} key - Cache key
     * @param {function} computeFn - Async function to compute value if not cached
     * @param {number} ttl - Optional TTL in seconds
     * @returns {Promise<any>} Cached or computed value
     */
    getOrCompute: async (key, computeFn, ttl = DEFAULT_TTL) => {
        // Try to get from cache
        let value = ReportCacheService.get(key);
        
        if (value !== undefined) {
            return value;
        }
        
        // Compute value
        console.log(`[ReportCache] MISS: ${key} - computing...`);
        try {
            value = await computeFn();
            
            // Cache the result
            if (value !== undefined && value !== null) {
                ReportCacheService.set(key, value, ttl);
            }
            
            return value;
        } catch (err) {
            console.error(`[ReportCache] Error computing value for ${key}:`, err.message);
            throw err;
        }
    },

    /**
     * Pre-defined cache operations for common aggregations
     */

    // Portfolio status aggregation
    getPortfolioStatus: async (orgId, computeFn, ttl = 300) => {
        return ReportCacheService.getOrCompute(
            CacheKeys.portfolioStatus(orgId),
            computeFn,
            ttl
        );
    },

    // Project status
    getProjectStatus: async (projectId, computeFn, ttl = 300) => {
        return ReportCacheService.getOrCompute(
            CacheKeys.projectStatus(projectId),
            computeFn,
            ttl
        );
    },

    // Portfolio KPIs
    getPortfolioKPIs: async (orgId, computeFn, ttl = 300) => {
        return ReportCacheService.getOrCompute(
            CacheKeys.portfolioKPIs(orgId),
            computeFn,
            ttl
        );
    },

    // Project KPIs
    getProjectKPIs: async (projectId, computeFn, ttl = 300) => {
        return ReportCacheService.getOrCompute(
            CacheKeys.projectKPIs(projectId),
            computeFn,
            ttl
        );
    },

    // PMO Health snapshot
    getPMOHealth: async (projectId, computeFn, ttl = 180) => {
        return ReportCacheService.getOrCompute(
            CacheKeys.pmoHealth(projectId),
            computeFn,
            ttl
        );
    },

    // Report history
    getReportHistory: async (orgId, filters, computeFn, ttl = 120) => {
        return ReportCacheService.getOrCompute(
            CacheKeys.reportHistory(orgId, filters),
            computeFn,
            ttl
        );
    },

    // Expose cache keys for external use
    keys: CacheKeys
};

module.exports = ReportCacheService;



