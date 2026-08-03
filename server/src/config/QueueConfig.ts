/**
 * Queue Configuration (Redis/BullMQ)
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Configuration for Redis connection used by BullMQ for job queues
 */

import { z } from 'zod';

import logger from '../utils/Logger.js';

// ==========================================
// ZOD SCHEMAS
// ==========================================

const RedisConnectionConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive().max(65535),
  password: z.string().optional(),
});

const QueueConfigSchema = z.object({
  connection: RedisConnectionConfigSchema.optional(),
});

export type RedisConnectionConfig = z.infer<typeof RedisConnectionConfigSchema>;
export type QueueConfig = z.infer<typeof QueueConfigSchema>;

// ==========================================
// CONFIGURATION LOADING
// ==========================================

/**
 * Load and validate queue configuration
 */
export function loadQueueConfig(): QueueConfig {
  if (process.env.MOCK_REDIS === 'true') {
    return {};
  }

  const redisUrlRaw = String(process.env.REDIS_URL || '').trim();
  let redisUrl: URL | null = null;
  if (redisUrlRaw) {
    try {
      redisUrl = new URL(redisUrlRaw);
    } catch {
      logger.warn('[Queue Config] Invalid REDIS_URL, falling back to REDIS_HOST/REDIS_PORT');
    }
  }

  const urlHost = redisUrl?.hostname;
  const urlPort = redisUrl?.port ? Number(redisUrl.port) : undefined;
  const urlPassword =
    redisUrl?.password && redisUrl.password.length > 0 ? redisUrl.password : undefined;

  const rawConfig: QueueConfig = {
    connection: {
      // A complete REDIS_URL is the canonical Railway connection contract.
      // Do not combine its host with a potentially stale separately managed
      // password, because that produces a valid-looking but unauthenticated
      // BullMQ connection (WRONGPASS) while other Redis clients remain healthy.
      host: urlHost || process.env.REDIS_HOST || 'localhost',
      port: urlPort || parseInt(process.env.REDIS_PORT || '6379', 10),
      password: urlPassword || process.env.REDIS_PASSWORD,
    },
  };

  // Validate configuration
  const result = QueueConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    logger.error('[Queue Config] Configuration validation failed:');
    result.error.issues.forEach((issue) => {
      logger.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });

    // In production, fail fast on invalid config
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid queue configuration. Please check your environment variables.');
    }

    // In development, use defaults
    logger.warn('[Queue Config] Using defaults for invalid values.');
    return {
      connection: {
        host: 'localhost',
        port: 6379,
      },
    };
  }

  return result.data;
}

// ==========================================
// EXPORT
// ==========================================

export const queueConfig = loadQueueConfig();
export default queueConfig;
