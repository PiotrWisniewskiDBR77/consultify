declare namespace _default {
    export { RateLimiter };
    export { rateLimiter };
    export { RATE_LIMITS };
}
export default _default;
export class RateLimiter {
    store: MemoryRateLimitStore;
    redis: any;
    /**
     * Connect to Redis for distributed rate limiting
     */
    connectRedis(redisClient: any): void;
    /**
     * Check if request is within rate limits
     * @param {Object} params - { userId, organizationId, capability, ip }
     * @returns {Object} { allowed: boolean, remaining: number, resetIn: number, reason?: string }
     */
    check(params: Object): Object;
    /**
     * Check and consume a rate limit
     */
    checkLimit(key: any, config: any): Promise<{
        allowed: boolean;
        remaining: number;
        resetIn: number;
    }>;
    /**
     * Get current rate limit status without consuming
     */
    getStatus(params: any): Promise<{
        user: {
            used: any;
            limit: any;
            remaining: number;
        };
        organization: {
            used: any;
            limit: number;
            remaining: number;
        };
    }>;
    /**
     * Reset rate limit for a specific key (admin function)
     */
    reset(key: any): Promise<void>;
}
export const rateLimiter: RateLimiter;
export namespace RATE_LIMITS {
    namespace user {
        export namespace chat {
            let points: number;
            let duration: number;
        }
        export namespace generation {
            let points_1: number;
            export { points_1 as points };
            let duration_1: number;
            export { duration_1 as duration };
        }
        export namespace magic_wand {
            let points_2: number;
            export { points_2 as points };
            let duration_2: number;
            export { duration_2 as duration };
        }
        namespace _default {
            let points_3: number;
            export { points_3 as points };
            let duration_3: number;
            export { duration_3 as duration };
        }
        export { _default as default };
    }
    namespace organization {
        namespace _default_1 {
            let points_4: number;
            export { points_4 as points };
            let duration_4: number;
            export { duration_4 as duration };
        }
        export { _default_1 as default };
    }
    namespace ip {
        namespace _default_2 {
            let points_5: number;
            export { points_5 as points };
            let duration_5: number;
            export { duration_5 as duration };
        }
        export { _default_2 as default };
    }
}
declare class MemoryRateLimitStore {
    store: Map<any, any>;
    get(key: any): Promise<any>;
    set(key: any, value: any, ttlSeconds: any): Promise<void>;
    increment(key: any, ttlSeconds: any): Promise<any>;
    cleanup(): void;
}
//# sourceMappingURL=rateLimiter.d.ts.map