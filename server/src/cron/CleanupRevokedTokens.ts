/**
 * Cron: Cleanup Revoked Tokens
 * Removes expired entries from the revoked_tokens table
 * 
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import { getConfig } from '../config/Config.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface Dependencies {
    db: IDatabase;
    config: ReturnType<typeof getConfig>;
}

// ==========================================
// CLEANUP REVOKED TOKENS CRON
// ==========================================

class CleanupRevokedTokensCron {
    private deps: Dependencies;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(deps?: Partial<Dependencies>) {
        this.deps = {
            db: deps?.db || getDatabase(),
            config: deps?.config || getConfig(),
        };
    }

    /**
     * Clean up expired revoked tokens
     */
    async cleanupRevokedTokens(): Promise<number> {
        logger.info('[Cron] Cleaning up expired revoked tokens...');

        return new Promise((resolve, reject) => {
            this.deps.db.run(
                "DELETE FROM revoked_tokens WHERE expires_at < datetime('now')",
                [],
                function (err) {
                    if (err) {
                        logger.error('[Cron] Error cleaning up revoked tokens:', err);
                        reject(err);
                    } else {
                        const deleted = this.changes || 0;
                        if (deleted > 0) {
                            logger.info(`[Cron] Removed ${deleted} expired revoked tokens`);
                        }
                        resolve(deleted);
                    }
                }
            );
        });
    }

    /**
     * Start the cleanup job
     */
    startCleanupJob(): void {
        // Delay first run to allow database initialization
        setTimeout(async () => {
            try {
                await this.cleanupRevokedTokens();
            } catch (err) {
                logger.error('[Cron] Initial token cleanup failed:', err);
            }
        }, 5000);

        // Then run periodically
        this.cleanupInterval = setInterval(async () => {
            try {
                await this.cleanupRevokedTokens();
            } catch (err) {
                logger.error('[Cron] Periodic token cleanup failed:', err);
            }
        }, this.deps.config.TOKEN_CLEANUP_INTERVAL);

        logger.info(`[Cron] Token cleanup job started (interval: ${this.deps.config.TOKEN_CLEANUP_INTERVAL}ms)`);
    }

    /**
     * Stop the cleanup job
     */
    stopCleanupJob(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            logger.info('[Cron] Token cleanup job stopped');
        }
    }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

let instance: CleanupRevokedTokensCron | null = null;

export function getCleanupRevokedTokensCron(deps?: Partial<Dependencies>): CleanupRevokedTokensCron {
    if (!instance) {
        instance = new CleanupRevokedTokensCron(deps);
    }
    return instance;
}

// ==========================================
// EXPORTS
// ==========================================

export const startCleanupJob = (deps?: Partial<Dependencies>): void => {
    getCleanupRevokedTokensCron(deps).startCleanupJob();
};

export const stopCleanupJob = (deps?: Partial<Dependencies>): void => {
    getCleanupRevokedTokensCron(deps).stopCleanupJob();
};

export const cleanupRevokedTokens = async (deps?: Partial<Dependencies>): Promise<number> => {
    return getCleanupRevokedTokensCron(deps).cleanupRevokedTokens();
};

export default CleanupRevokedTokensCron;

