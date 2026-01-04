/**
 * Queue Configuration (Redis/BullMQ)
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Configuration for Redis connection used by BullMQ for job queues
 */

import { z } from 'zod';

import logger from '../utils/Logger.ts';

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
function loadQueueConfig(): QueueConfig {
    if (process.env.MOCK_REDIS === 'true') {
        return {};
    }

    const rawConfig: QueueConfig = {
        connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD || undefined,
        },
    };

    // Validate configuration
    const result = QueueConfigSchema.safeParse(rawConfig);

    if (!result.success) {
        logger.error('[Queue Config] Configuration validation failed:');
        result.error.issues.forEach((err: Error | null) => {
            logger.error(`  - ${err.path.join('.')}: ${err.message}`);
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
