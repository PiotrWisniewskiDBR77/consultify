/**
 * Shutdown Manager
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Manages graceful shutdown of the application
 * Handles cleanup of connections, jobs, and resources
 */

import logger from './Logger.js';

// ==========================================
// TYPES
// ==========================================

type CleanupHandler = () => Promise<void> | void;
type CleanupHandlerWithName = {
    name: string;
    handler: CleanupHandler;
    timeout?: number; // Custom timeout in ms
};

// ==========================================
// SHUTDOWN MANAGER CLASS
// ==========================================

class ShutdownManager {
    private cleanupHandlers: CleanupHandlerWithName[] = [];
    private isShuttingDown = false;
    private shutdownTimeout: number;
    private shutdownStartTime: number | null = null;

    constructor(shutdownTimeoutMs = 30000) {
        this.shutdownTimeout = shutdownTimeoutMs;
    }

    /**
     * Register a cleanup handler
     * Handlers are executed in reverse order (LIFO)
     */
    registerCleanup(name: string, handler: CleanupHandler, timeout?: number): void {
        this.cleanupHandlers.push({
            name,
            handler,
            timeout,
        });
        logger.debug(`[ShutdownManager] Registered cleanup handler: ${name}`);
    }

    /**
     * Check if shutdown is in progress
     */
    isShuttingDownNow(): boolean {
        return this.isShuttingDown;
    }

    /**
     * Execute graceful shutdown
     */
    async shutdown(signal?: string): Promise<void> {
        if (this.isShuttingDown) {
            logger.warn('[ShutdownManager] Shutdown already in progress');
            return;
        }

        this.isShuttingDown = true;
        this.shutdownStartTime = Date.now();

        logger.info(`[ShutdownManager] Starting graceful shutdown (signal: ${signal || 'unknown'})`);

        // Execute cleanup handlers in reverse order (LIFO)
        const handlers = [...this.cleanupHandlers].reverse();

        for (const { name, handler, timeout } of handlers) {
            const handlerTimeout = timeout || this.shutdownTimeout;
            const startTime = Date.now();

            try {
                logger.info(`[ShutdownManager] Executing cleanup: ${name}`);

                // Execute handler with timeout
                await Promise.race([
                    Promise.resolve(handler()),
                    new Promise<void>((_, reject) =>
                        setTimeout(() => reject(new Error(`Timeout after ${handlerTimeout}ms`)), handlerTimeout),
                    ),
                ]);

                const duration = Date.now() - startTime;
                logger.info(`[ShutdownManager] Cleanup completed: ${name} (${duration}ms)`);
            } catch (error: unknown) {
                const err = error instanceof Error ? error : new Error(String(error));
                const duration = Date.now() - startTime;
                logger.error(`[ShutdownManager] Cleanup failed: ${name} (${duration}ms) - ${err.message}`);

                // Continue with other handlers even if one fails
            }
        }

        const totalDuration = this.shutdownStartTime ? Date.now() - this.shutdownStartTime : 0;
        logger.info(`[ShutdownManager] Graceful shutdown completed (${totalDuration}ms)`);
    }

    /**
     * Force shutdown (immediate)
     */
    async forceShutdown(): Promise<void> {
        logger.warn('[ShutdownManager] Force shutdown initiated');
        this.isShuttingDown = true;
        process.exit(1);
    }

    /**
     * Get registered cleanup handlers count
     */
    getHandlerCount(): number {
        return this.cleanupHandlers.length;
    }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

let instance: ShutdownManager | null = null;

export function getShutdownManager(timeoutMs?: number): ShutdownManager {
    if (!instance) {
        instance = new ShutdownManager(timeoutMs);
    }
    return instance;
}

// ==========================================
// EXPORTS
// ==========================================

export default ShutdownManager;


