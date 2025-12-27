/**
 * Cache Helper Utility
 * Provides caching layer for frequently accessed data
 * Uses Redis for distributed caching
 */

const redis = require('./redisClient');

const DEFAULT_TTL = {
    SHORT: 60,        // 1 minute - frequently changing data
    MEDIUM: 300,      // 5 minutes - moderately stable data
    LONG: 900,        // 15 minutes - stable data
    VERY_LONG: 3600   // 1 hour - rarely changing data
};

/**
 * Cache key generators
 */
const CacheKeys = {
    user: (userId) => `user:${userId}`,
    userTasks: (userId, orgId) => `tasks:user:${userId}:org:${orgId}`,
    userDashboard: (userId, orgId) => `dashboard:user:${userId}:org:${orgId}`,
    userInitiatives: (userId) => `initiatives:user:${userId}`,
    userDecisions: (userId) => `decisions:user:${userId}`,
    userAlerts: (userId) => `alerts:user:${userId}`,
    projectUsers: (projectId) => `project:${projectId}:users`,
    organizationUsers: (orgId) => `org:${orgId}:users`,
    workload: (projectId) => `workload:project:${projectId}`,
    overAllocation: (projectId) => `overallocation:project:${projectId}`
};

/**
 * Get cached data or fetch and cache
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if not cached
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<any>}
 */
async function getCached(key, fetchFn, ttl = DEFAULT_TTL.MEDIUM) {
    try {
        // Try to get from cache
        const cached = await redis.get(key);
        if (cached) {
            return JSON.parse(cached);
        }

        // Fetch fresh data
        const data = await fetchFn();

        // Cache the data
        if (data !== null && data !== undefined) {
            await redis.setEx(key, ttl, JSON.stringify(data));
        }

        return data;
    } catch (error) {
        console.error(`[Cache] Error for key ${key}:`, error);
        // On cache error, fallback to direct fetch
        return fetchFn();
    }
}

/**
 * Invalidate cache by key pattern
 * @param {string} pattern - Redis key pattern (e.g., 'tasks:user:*')
 * @returns {Promise<number>} Number of keys deleted
 */
async function invalidatePattern(pattern) {
    try {
        const keys = await redis.keys(pattern);
        if (keys.length === 0) return 0;

        return await redis.del(keys);
    } catch (error) {
        console.error(`[Cache] Error invalidating pattern ${pattern}:`, error);
        return 0;
    }
}

/**
 * Invalidate cache by exact key
 * @param {string} key - Cache key
 * @returns {Promise<boolean>}
 */
async function invalidate(key) {
    try {
        const result = await redis.del(key);
        return result > 0;
    } catch (error) {
        console.error(`[Cache] Error invalidating key ${key}:`, error);
        return false;
    }
}

/**
 * Invalidate all user-related cache
 * @param {string} userId - User ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<number>} Number of keys deleted
 */
async function invalidateUserCache(userId, orgId) {
    const patterns = [
        CacheKeys.user(userId),
        CacheKeys.userTasks(userId, orgId),
        CacheKeys.userDashboard(userId, orgId),
        CacheKeys.userInitiatives(userId),
        CacheKeys.userDecisions(userId),
        CacheKeys.userAlerts(userId)
    ];

    let deleted = 0;
    for (const key of patterns) {
        if (await invalidate(key)) {
            deleted++;
        }
    }

    // Also invalidate pattern-based keys
    deleted += await invalidatePattern(`tasks:user:${userId}:*`);
    deleted += await invalidatePattern(`dashboard:user:${userId}:*`);

    return deleted;
}

/**
 * Invalidate project-related cache
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Number of keys deleted
 */
async function invalidateProjectCache(projectId) {
    return await invalidatePattern(`*:project:${projectId}*`);
}

/**
 * Invalidate organization-related cache
 * @param {string} orgId - Organization ID
 * @returns {Promise<number>} Number of keys deleted
 */
async function invalidateOrgCache(orgId) {
    return await invalidatePattern(`*:org:${orgId}*`);
}

module.exports = {
    getCached,
    invalidate,
    invalidatePattern,
    invalidateUserCache,
    invalidateProjectCache,
    invalidateOrgCache,
    CacheKeys,
    DEFAULT_TTL
};






