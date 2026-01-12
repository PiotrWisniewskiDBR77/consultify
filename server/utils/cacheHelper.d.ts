/**
 * Cache Helper Utility
 * Provides caching layer for frequently accessed data
 * Uses Redis for distributed caching
 */
export declare const DEFAULT_TTL: {
    readonly SHORT: 60;
    readonly MEDIUM: 300;
    readonly LONG: 900;
    readonly VERY_LONG: 3600;
};
/**
 * Cache key generators
 */
export declare const CacheKeys: {
    user: (userId: string) => string;
    userTasks: (userId: string, orgId: string) => string;
    userDashboard: (userId: string, orgId: string) => string;
    userInitiatives: (userId: string) => string;
    userDecisions: (userId: string) => string;
    userAlerts: (userId: string) => string;
    projectUsers: (projectId: string) => string;
    organizationUsers: (orgId: string) => string;
    workload: (projectId: string) => string;
    overAllocation: (projectId: string) => string;
};
/**
 * Get cached data or fetch and cache
 */
export declare function getCached<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T>;
/**
 * Invalidate cache by key pattern
 */
export declare function invalidatePattern(pattern: string): Promise<number>;
/**
 * Invalidate cache by exact key
 */
export declare function invalidate(key: string): Promise<boolean>;
/**
 * Invalidate all user-related cache
 */
export declare function invalidateUserCache(userId: string, orgId: string): Promise<number>;
/**
 * Invalidate project-related cache
 */
export declare function invalidateProjectCache(projectId: string): Promise<number>;
/**
 * Invalidate organization-related cache
 */
export declare function invalidateOrgCache(orgId: string): Promise<number>;
//# sourceMappingURL=cacheHelper.d.ts.map