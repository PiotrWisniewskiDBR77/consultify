/**
 * Redisclient Service Bridge
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Bridge between legacy service locations and the unified RedisClient
 */

import { redisClient } from '../redis/RedisClient.js';

/**
 * Get internal ioredis instance
 */
export const getRedisClient = () => redisClient.getRedisClient();

/**
 * Check if Redis is connected
 */
export const isRedisConnected = () => redisClient.isRedisConnected();

// Default export for generic module loading
export default {
    getRedisClient,
    isRedisConnected,
};
