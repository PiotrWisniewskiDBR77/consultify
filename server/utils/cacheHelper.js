/**
 * Cache Helper Utility
 * Provides caching layer for frequently accessed data
 * Uses Redis for distributed caching
 */
import client from './redisClient.js';
export const DEFAULT_TTL = {
    SHORT: 60, // 1 minute - frequently changing data
    MEDIUM: 300, // 5 minutes - moderately stable data
    LONG: 900, // 15 minutes - stable data
    VERY_LONG: 3600 // 1 hour - rarely changing data
};
/**
 * Cache key generators
 */
export const CacheKeys = {
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
 */
export async function getCached(key, fetchFn, ttl = DEFAULT_TTL.MEDIUM) {
    try {
        const redisClient = client;
        // Try to get from cache
        const cached = await redisClient.get(key);
        if (cached) {
            return JSON.parse(cached);
        }
        // Fetch fresh data
        const data = await fetchFn();
        // Cache the data
        if (data !== null && data !== undefined) {
            if (redisClient.setEx) {
                await redisClient.setEx(key, ttl, JSON.stringify(data));
            }
            else if (redisClient.set && redisClient.expire) {
                await redisClient.set(key, JSON.stringify(data));
                await redisClient.expire(key, ttl);
            }
        }
        return data;
    }
    catch (error) {
        console.error(`[Cache] Error for key ${key}:`, error);
        // On cache error, fallback to direct fetch
        return fetchFn();
    }
}
/**
 * Invalidate cache by key pattern
 */
export async function invalidatePattern(pattern) {
    try {
        const redisClient = client;
        if (!redisClient.keys)
            return 0;
        const keys = await redisClient.keys(pattern);
        if (keys.length === 0)
            return 0;
        return await redisClient.del(keys);
    }
    catch (error) {
        console.error(`[Cache] Error invalidating pattern ${pattern}:`, error);
        return 0;
    }
}
/**
 * Invalidate cache by exact key
 */
export async function invalidate(key) {
    try {
        const redisClient = client;
        const result = await redisClient.del(key);
        return result > 0;
    }
    catch (error) {
        console.error(`[Cache] Error invalidating key ${key}:`, error);
        return false;
    }
}
/**
 * Invalidate all user-related cache
 */
export async function invalidateUserCache(userId, orgId) {
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
 */
export async function invalidateProjectCache(projectId) {
    return await invalidatePattern(`*:project:${projectId}*`);
}
/**
 * Invalidate organization-related cache
 */
export async function invalidateOrgCache(orgId) {
    return await invalidatePattern(`*:org:${orgId}*`);
}
//# sourceMappingURL=cacheHelper.js.map
