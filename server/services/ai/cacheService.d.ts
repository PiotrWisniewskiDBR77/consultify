declare namespace _default {
    export { CacheService };
    export { cacheService };
    export { CACHE_CONFIG };
}
export default _default;
export class CacheService {
    redis: object | null;
    enabled: boolean;
    stats: {
        hits: number;
        misses: number;
    };
    /**
     * Generate cache key from query and context
     */
    generateKey(query: any, context?: {}): string;
    /**
     * Detect cache type based on query content
     */
    detectCacheType(query: any): "data" | "methodology" | "general";
    /**
     * Get cached response
     * @returns {object|null} Cached response or null
     */
    get(query: any, context?: {}): object | null;
    /**
     * Cache a response
     */
    set(query: any, context: any, response: any): Promise<void>;
    /**
     * Invalidate cache entries matching a pattern
     */
    invalidate(pattern: any): Promise<void>;
    /**
     * Clean up expired entries
     */
    cleanup(): void;
    /**
     * Get cache statistics
     */
    getStats(): {
        hits: number;
        misses: number;
        hitRate: number;
        memoryCacheSize: number;
        redisConnected: boolean;
    };
    /**
     * Connect to Redis using shared client
     * @param {object} redisClient - Redis client from redisClient.js
     */
    connectRedis(redisClient: object): void;
    /**
     * Check if Redis is connected
     */
    isRedisConnected(): boolean;
    hashObject(obj: any): string;
}
export const cacheService: CacheService;
export namespace CACHE_CONFIG {
    namespace methodology {
        let ttl: number;
        let prefix: string;
    }
    namespace data {
        let ttl_1: number;
        export { ttl_1 as ttl };
        let prefix_1: string;
        export { prefix_1 as prefix };
    }
    namespace general {
        let ttl_2: number;
        export { ttl_2 as ttl };
        let prefix_2: string;
        export { prefix_2 as prefix };
    }
}
//# sourceMappingURL=cacheService.d.ts.map