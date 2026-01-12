/**
 * Redisclient Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

// Re-export named exports from JS module
export { getRedisClient, isRedisConnected, initRedis, closeRedis, healthCheck } from '../../services/ai/redisClient.js';

// Default export for backward compatibility
import redisClientModule from '../../services/ai/redisClient.js';
export default redisClientModule;
