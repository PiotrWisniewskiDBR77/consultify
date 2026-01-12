/**
 * Initialize Redis connection
 * @param {string} redisUrl - Redis connection URL (e.g., redis://localhost:6379)
 * @returns {Promise<object|null>} Redis client or null if unavailable
 */
export function initRedis(redisUrl: string): Promise<object | null>;
/**
 * Get the Redis client (or null if not connected)
 */
export function getRedisClient(): any;
/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean;
/**
 * Gracefully close Redis connection
 */
export function closeRedis(): Promise<void>;
/**
 * Health check for Redis
 */
export function healthCheck(): Promise<{
    status: string;
    latency: null;
    error?: undefined;
} | {
    status: string;
    latency: number;
    error?: undefined;
} | {
    status: string;
    error: any;
    latency?: undefined;
}>;
//# sourceMappingURL=redisClient.d.ts.map