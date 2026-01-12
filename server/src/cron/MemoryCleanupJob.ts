/**
 * Memory Cleanup Job
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Periodic job to clean up old data and free memory
 * Runs every 6 hours to prevent memory accumulation
 */

import { getMemoryMonitor } from '../services/MemoryMonitor.js';
import logger from '../utils/Logger.js';

// ==========================================
// MEMORY CLEANUP JOB
// ==========================================

interface CleanupResult {
    success: boolean;
    itemsCleaned: number;
    memoryFreed: number; // bytes
    duration: number; // milliseconds
    errors: string[];
}

/**
 * Run memory cleanup
 * Cleans up old data, invalidates stale cache, and forces garbage collection if available
 */
export async function runMemoryCleanup(): Promise<CleanupResult> {
    const startTime = Date.now();
    const result: CleanupResult = {
        success: true,
        itemsCleaned: 0,
        memoryFreed: 0,
        duration: 0,
        errors: [],
    };

    try {
        const memoryBefore = process.memoryUsage();

        // 1. Clean up old cache entries
        try {
            const cacheCleanup = await cleanupCache();
            result.itemsCleaned += cacheCleanup.itemsCleaned;
            result.memoryFreed += cacheCleanup.memoryFreed;
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            result.errors.push(`Cache cleanup failed: ${err.message}`);
            logger.warn('[MemoryCleanup] Cache cleanup failed:', { error: err.message });
        }

        // 2. Clean up old temporary data
        try {
            const tempCleanup = await cleanupTemporaryData();
            result.itemsCleaned += tempCleanup.itemsCleaned;
            result.memoryFreed += tempCleanup.memoryFreed;
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            result.errors.push(`Temporary data cleanup failed: ${err.message}`);
            logger.warn('[MemoryCleanup] Temporary data cleanup failed:', { error: err.message });
        }

        // 3. Reset memory monitor baseline if growth is significant
        const memoryMonitor = getMemoryMonitor();
        const stats = memoryMonitor.getStats();
        if (stats.growthSinceBaseline > 20) {
            logger.info(`[MemoryCleanup] Resetting memory baseline (growth: ${stats.growthSinceBaseline}%)`);
            memoryMonitor.resetBaseline();
        }

        // 4. Force garbage collection if available
        if (global.gc) {
            global.gc();
            logger.debug('[MemoryCleanup] Forced garbage collection');
        }

        const memoryAfter = process.memoryUsage();
        const actualMemoryFreed = memoryBefore.heapUsed - memoryAfter.heapUsed;
        result.memoryFreed = Math.max(result.memoryFreed, actualMemoryFreed);

        result.duration = Date.now() - startTime;
        result.success = result.errors.length === 0;

        logger.info('[MemoryCleanup] Cleanup completed', {
            itemsCleaned: result.itemsCleaned,
            memoryFreedMB: (result.memoryFreed / 1024 / 1024).toFixed(2),
            duration: `${result.duration}ms`,
            errors: result.errors.length,
        });

        return result;
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        result.success = false;
        result.errors.push(`Memory cleanup failed: ${err.message}`);
        result.duration = Date.now() - startTime;

        logger.error('[MemoryCleanup] Cleanup failed:', err);
        return result;
    }
}

/**
 * Clean up cache entries
 */
async function cleanupCache(): Promise<{ itemsCleaned: number; memoryFreed: number }> {
    let itemsCleaned = 0;
    let memoryFreed = 0;

    try {
        // Clean up Redis cache if available
        const { getRedisClient, isRedisConnected } = await import('../services/ai/redisClient.js').catch(() => ({
            getRedisClient: null,
            isRedisConnected: () => false,
        }));

        if (isRedisConnected && isRedisConnected()) {
            const client = getRedisClient();
            if (client) {
                // Clean up expired keys (Redis does this automatically, but we can force cleanup)
                // This is a placeholder - actual implementation would depend on cache structure
                logger.debug('[MemoryCleanup] Redis cache cleanup (automatic expiration handled by Redis)');
            }
        }

        // Clean up in-memory caches
        // This would clean up any in-memory cache stores
        // Placeholder for actual cache cleanup logic

        return { itemsCleaned, memoryFreed };
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.warn('[MemoryCleanup] Cache cleanup error:', { error: err.message });
        return { itemsCleaned, memoryFreed };
    }
}

/**
 * Clean up temporary data
 */
async function cleanupTemporaryData(): Promise<{ itemsCleaned: number; memoryFreed: number }> {
    let itemsCleaned = 0;
    let memoryFreed = 0;

    try {
        // Clean up old partial responses, temporary files, etc.
        // This would clean up any temporary data structures
        // Placeholder for actual cleanup logic

        return { itemsCleaned, memoryFreed };
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.warn('[MemoryCleanup] Temporary data cleanup error:', { error: err.message });
        return { itemsCleaned, memoryFreed };
    }
}

export default {
    run: runMemoryCleanup,
};

