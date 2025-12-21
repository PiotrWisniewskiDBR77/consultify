/**
 * Cache Helper Utility
 * Provides caching layer for frequently accessed data
 * Uses Redis for distributed caching
 */

import client from './redisClient';

export const DEFAULT_TTL = {
    SHORT: 60,        // 1 minute - frequently changing data
    MEDIUM: 300,      // 5 minutes - moderately stable data
    LONG: 900,        // 15 minutes - stable data
    VERY_LONG: 3600   // 1 hour - rarely changing data
} as const;

/**
 * Cache key generators
 */
export const CacheKeys = {
    user: (userId: string) => `user:${userId}`,
    userTasks: (userId: string, orgId: string) => `tasks:user:${userId}:org:${orgId}`,
    userDashboard: (userId: string, orgId: string) => `dashboard:user:${userId}:org:${orgId}`,
    userInitiatives: (userId: string) => `initiatives:user:${userId}`,
    userDecisions: (userId: string) => `decisions:user:${userId}`,
    userAlerts: (userId: string) => `alerts:user:${userId}`,
    projectUsers: (projectId: string) => `project:${projectId}:users`,
    organizationUsers: (orgId: string) => `org:${orgId}:users`,
    workload: (projectId: string) => `workload:project:${projectId}`,
    overAllocation: (projectId: string) => `overallocation:project:${projectId}`
};

interface RedisClient {
    get: (key: string) => Promise<string | null>;
    setEx?: (key: string, seconds: number, value: string) => Promise<string>;
    set?: (key: string, value: string) => Promise<string>;
    expire?: (key: string, seconds: number) => Promise<boolean>;
    keys?: (pattern: string) => Promise<string[]>;
    del: (key: string | string[]) => Promise<number>;
}

/**
 * Get cached data or fetch and cache
 */
export async function getCached<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = DEFAULT_TTL.MEDIUM
): Promise<T> {
    try {
        const redisClient = client as RedisClient;
        // Try to get from cache
        const cached = await redisClient.get(key);
        if (cached) {
            return JSON.parse(cached) as T;
        }

        // Fetch fresh data
        const data = await fetchFn();

        // Cache the data
        if (data !== null && data !== undefined) {
            if (redisClient.setEx) {
                await redisClient.setEx(key, ttl, JSON.stringify(data));
            } else if (redisClient.set && redisClient.expire) {
                await redisClient.set(key, JSON.stringify(data));
                await redisClient.expire(key, ttl);
            }
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
 */
export async function invalidatePattern(pattern: string): Promise<number> {
    try {
        const redisClient = client as RedisClient;
        if (!redisClient.keys) return 0;
        
        const keys = await redisClient.keys(pattern);
        if (keys.length === 0) return 0;

        return await redisClient.del(keys);
    } catch (error) {
        console.error(`[Cache] Error invalidating pattern ${pattern}:`, error);
        return 0;
    }
}

/**
 * Invalidate cache by exact key
 */
export async function invalidate(key: string): Promise<boolean> {
    try {
        const redisClient = client as RedisClient;
        const result = await redisClient.del(key);
        return result > 0;
    } catch (error) {
        console.error(`[Cache] Error invalidating key ${key}:`, error);
        return false;
    }
}

/**
 * Invalidate all user-related cache
 */
export async function invalidateUserCache(userId: string, orgId: string): Promise<number> {
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
export async function invalidateProjectCache(projectId: string): Promise<number> {
    return await invalidatePattern(`*:project:${projectId}*`);
}

/**
 * Invalidate organization-related cache
 */
export async function invalidateOrgCache(orgId: string): Promise<number> {
    return await invalidatePattern(`*:org:${orgId}*`);
}

