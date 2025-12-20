/**
 * Invitation Cleanup Job
 * 
 * Daily cron job to:
 * 1. Mark expired pending invitations as 'expired'
 * 2. Log expiration events for audit trail
 * 3. Clean up very old revoked/expired invitations (optional, disabled by default)
 * 
 * Run via: node server/jobs/invitationCleanupJob.js
 * Or schedule with cron: 0 2 * * * (daily at 2 AM)
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Configuration
const CLEANUP_OLD_INVITATIONS_AFTER_DAYS = 0; // 0 = disabled, set to e.g. 365 to clean after 1 year

/**
 * Log an expiration event for the invitation
 */
async function logExpirationEvent(invitationId) {
    const eventId = uuidv4();
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO invitation_events 
             (id, invitation_id, event_type, performed_by_user_id, metadata, created_at)
             VALUES (?, ?, 'expired', NULL, '{"source": "cron_cleanup"}', datetime('now'))`,
            [eventId, invitationId],
            function (err) {
                if (err) {
                    console.error(`[CleanupJob] Failed to log expiration for ${invitationId}:`, err.message);
                    return reject(err);
                }
                resolve();
            }
        );
    });
}

/**
 * Find and expire pending invitations past their expiry date
 */
async function expirePendingInvitations() {
    return new Promise((resolve, reject) => {
        // First, find all pending invitations that have expired
        db.all(
            `SELECT id, email, organization_id 
             FROM invitations 
             WHERE status = 'pending' AND expires_at < datetime('now')`,
            [],
            async (err, invitations) => {
                if (err) {
                    console.error('[CleanupJob] Error finding expired invitations:', err.message);
                    return reject(err);
                }

                if (!invitations || invitations.length === 0) {
                    console.log('[CleanupJob] No expired pending invitations found');
                    return resolve({ expired: 0 });
                }

                console.log(`[CleanupJob] Found ${invitations.length} expired pending invitations`);

                // Update all to expired status
                const updateResult = await new Promise((res, rej) => {
                    db.run(
                        `UPDATE invitations 
                         SET status = 'expired' 
                         WHERE status = 'pending' AND expires_at < datetime('now')`,
                        [],
                        function (updateErr) {
                            if (updateErr) return rej(updateErr);
                            res({ changes: this.changes });
                        }
                    );
                });

                console.log(`[CleanupJob] Marked ${updateResult.changes} invitations as expired`);

                // Log events for each (fire and forget, don't block)
                for (const inv of invitations) {
                    try {
                        await logExpirationEvent(inv.id);
                    } catch (e) {
                        // Continue even if logging fails
                    }
                }

                resolve({ expired: updateResult.changes });
            }
        );
    });
}

/**
 * Optionally clean up very old revoked/expired invitations (data retention)
 */
async function cleanupOldInvitations() {
    if (CLEANUP_OLD_INVITATIONS_AFTER_DAYS <= 0) {
        return { deleted: 0 };
    }

    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM invitations 
             WHERE status IN ('expired', 'revoked') 
             AND created_at < datetime('now', '-${CLEANUP_OLD_INVITATIONS_AFTER_DAYS} days')`,
            [],
            function (err) {
                if (err) {
                    console.error('[CleanupJob] Error cleaning old invitations:', err.message);
                    return reject(err);
                }
                console.log(`[CleanupJob] Deleted ${this.changes} old invitations`);
                resolve({ deleted: this.changes });
            }
        );
    });
}

/**
 * Main cleanup function
 */
async function runCleanup() {
    console.log('[CleanupJob] Starting invitation cleanup job at', new Date().toISOString());

    try {
        const expiryResult = await expirePendingInvitations();
        const cleanupResult = await cleanupOldInvitations();

        console.log('[CleanupJob] Cleanup completed:', {
            expired: expiryResult.expired,
            deleted: cleanupResult.deleted,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            expired: expiryResult.expired,
            deleted: cleanupResult.deleted
        };
    } catch (error) {
        console.error('[CleanupJob] Cleanup failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Export for programmatic use
module.exports = {
    runCleanup,
    expirePendingInvitations,
    cleanupOldInvitations
};

// Run directly if executed as script
if (require.main === module) {
    runCleanup()
        .then(result => {
            console.log('[CleanupJob] Result:', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error('[CleanupJob] Fatal error:', err);
            process.exit(1);
        });
}
