/**
 * Cron: Cleanup Revoked Tokens
 * Removes expired entries from the revoked_tokens table
 */

import { getDatabase } from '../src/database/Database.js';
const db = getDatabase();

// Default interval: 24 hours
const TOKEN_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;

let cleanupInterval: NodeJS.Timeout | null = null;

function cleanupRevokedTokens() {
    console.log('[Cron] Cleaning up expired revoked tokens...');

    db.run("DELETE FROM revoked_tokens WHERE expires_at < datetime('now')", [], function (this: { changes: number }, err: Error | null) {
        if (err) {
            console.error('[Cron] Error cleaning up revoked tokens:', err);
        } else if (this.changes > 0) {
            console.log(`[Cron] Removed ${this.changes} expired revoked tokens`);
        }
    });
}

function startCleanupJob() {
    // Delay first run to allow database initialization
    setTimeout(() => {
        cleanupRevokedTokens();
    }, 5000);

    // Then run periodically
    cleanupInterval = setInterval(cleanupRevokedTokens, TOKEN_CLEANUP_INTERVAL);
    console.log(`[Cron] Token cleanup job started (interval: ${TOKEN_CLEANUP_INTERVAL}ms)`);
}

function stopCleanupJob() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
        console.log('[Cron] Token cleanup job stopped');
    }
}

export default {
    startCleanupJob,
    stopCleanupJob,
    cleanupRevokedTokens,
};
