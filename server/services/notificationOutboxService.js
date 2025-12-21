/**
 * NotificationOutboxService
 * 
 * Step 16: Outbox pattern for async notification delivery.
 * Queues notifications for later processing, respects user preferences.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const auditLogger = require('../utils/auditLogger');

const NOTIFICATION_TYPES = {
    APPROVAL_DUE: 'APPROVAL_DUE',
    PLAYBOOK_STUCK: 'PLAYBOOK_STUCK',
    DEAD_LETTER: 'DEAD_LETTER',
    ESCALATION: 'ESCALATION'
};

const OUTBOX_STATUSES = {
    QUEUED: 'QUEUED',
    SENT: 'SENT',
    FAILED: 'FAILED'
};

const MAX_ATTEMPTS = 3;

const NotificationOutboxService = {
    NOTIFICATION_TYPES,
    OUTBOX_STATUSES,
    MAX_ATTEMPTS,

    /**
     * Enqueue a notification for async delivery.
     * 
     * @param {string} userId - Target user ID
     * @param {string} orgId - Organization ID
     * @param {string} type - Notification type
     * @param {Object} payload - Notification payload
     * @param {string} [channel='email'] - Delivery channel
     * @returns {Promise<Object>} Created outbox entry
     */
    enqueue: async (userId, orgId, type, payload, channel = 'email') => {
        // Check user preferences first
        const shouldSend = await NotificationOutboxService.shouldNotify(userId, orgId, type);
        if (!shouldSend) {
            console.log(`[NotificationOutbox] User ${userId} has disabled ${type} notifications`);
            return { skipped: true, reason: 'user_preference' };
        }

        return new Promise((resolve, reject) => {
            const id = uuidv4();

            db.run(
                `INSERT INTO notification_outbox 
                 (id, org_id, user_id, notification_type, payload_json, status, channel, created_at)
                 VALUES (?, ?, ?, ?, ?, 'QUEUED', ?, CURRENT_TIMESTAMP)`,
                [id, orgId, userId, type, JSON.stringify(payload), channel],
                function (err) {
                    if (err) return reject(err);

                    auditLogger.debug('NOTIFICATION_QUEUED', {
                        notification_id: id,
                        user_id: userId,
                        org_id: orgId,
                        type,
                        channel
                    });

                    resolve({ id, userId, orgId, type, status: OUTBOX_STATUSES.QUEUED });
                }
            );
        });
    },

    /**
     * Check if user wants to receive this notification type.
     * 
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @param {string} eventType - Notification type
     * @returns {Promise<boolean>} Whether to send
     */
    shouldNotify: async (userId, orgId, eventType) => {
        const prefs = await NotificationOutboxService.getUserPreferences(userId, orgId);

        // Default to true if no preferences set
        if (!prefs) return true;

        const eventMap = {
            [NOTIFICATION_TYPES.APPROVAL_DUE]: prefs.event_approval_due,
            [NOTIFICATION_TYPES.PLAYBOOK_STUCK]: prefs.event_playbook_stuck,
            [NOTIFICATION_TYPES.DEAD_LETTER]: prefs.event_dead_letter,
            [NOTIFICATION_TYPES.ESCALATION]: prefs.event_escalation
        };

        return eventMap[eventType] !== 0;
    },

    /**
     * Get user notification preferences.
     * 
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object|null>} Preferences or null
     */
    getUserPreferences: async (userId, orgId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM user_notification_preferences 
                 WHERE user_id = ? AND org_id = ?`,
                [userId, orgId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    },

    /**
     * Update user notification preferences.
     * 
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @param {Object} preferences - Preference settings
     * @returns {Promise<Object>} Updated preferences
     */
    updateUserPreferences: async (userId, orgId, preferences) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();

            db.run(
                `INSERT INTO user_notification_preferences 
                 (id, user_id, org_id, channel_email, channel_slack, channel_teams,
                  event_approval_due, event_playbook_stuck, event_dead_letter, event_escalation,
                  updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(user_id, org_id) DO UPDATE SET
                    channel_email = excluded.channel_email,
                    channel_slack = excluded.channel_slack,
                    channel_teams = excluded.channel_teams,
                    event_approval_due = excluded.event_approval_due,
                    event_playbook_stuck = excluded.event_playbook_stuck,
                    event_dead_letter = excluded.event_dead_letter,
                    event_escalation = excluded.event_escalation,
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    id, userId, orgId,
                    preferences.channel_email ?? 1,
                    preferences.channel_slack ?? 0,
                    preferences.channel_teams ?? 0,
                    preferences.event_approval_due ?? 1,
                    preferences.event_playbook_stuck ?? 1,
                    preferences.event_dead_letter ?? 1,
                    preferences.event_escalation ?? 1
                ],
                function (err) {
                    if (err) return reject(err);

                    auditLogger.info('NOTIFICATION_PREFS_UPDATED', {
                        user_id: userId,
                        org_id: orgId
                    });

                    resolve({ userId, orgId, ...preferences });
                }
            );
        });
    },

    /**
     * Process queued notifications (cron job).
     * For now, marks as SENT (actual email integration is out of scope).
     * 
     * @returns {Promise<Object>} Processing summary
     */
    processQueue: async () => {
        console.log('[NotificationOutbox] Processing queue...');
        const startTime = Date.now();

        const summary = {
            processed: 0,
            sent: 0,
            failed: 0,
            skipped: 0
        };

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM notification_outbox 
                 WHERE status = 'QUEUED' AND attempts < ?
                 ORDER BY created_at ASC
                 LIMIT 100`,
                [MAX_ATTEMPTS],
                async (err, rows) => {
                    if (err) return reject(err);

                    for (const notification of (rows || [])) {
                        summary.processed++;

                        try {
                            // Simulate sending (provider integration deferred)
                            // For now, simulate sending
                            const success = await NotificationOutboxService._sendNotification(notification);

                            if (success) {
                                await NotificationOutboxService._markSent(notification.id);
                                summary.sent++;
                            } else {
                                await NotificationOutboxService._markFailed(notification.id, 'Send failed');
                                summary.failed++;
                            }
                        } catch (sendErr) {
                            await NotificationOutboxService._incrementAttempts(notification.id, sendErr.message);
                            summary.failed++;
                        }
                    }

                    const duration = Date.now() - startTime;
                    console.log(`[NotificationOutbox] Queue processed in ${duration}ms:`, summary);

                    resolve(summary);
                }
            );
        });
    },

    /**
     * Simulate sending a notification (placeholder for real integration).
     * @private
     */
    _sendNotification: async (notification) => {
        // Simulate email sending (External provider integration deferred to future phase)
        console.log(`[NotificationOutbox] Would send ${notification.notification_type} to user ${notification.user_id}`);

        // Simulate success (in production, this would call the email API)
        return true;
    },

    /**
     * Mark notification as sent.
     * @private
     */
    _markSent: async (id) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE notification_outbox 
                 SET status = 'SENT', sent_at = CURRENT_TIMESTAMP, last_attempt_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [id],
                (err) => {
                    if (err) return reject(err);
                    resolve(true);
                }
            );
        });
    },

    /**
     * Increment attempt count and record error.
     * @private
     */
    _incrementAttempts: async (id, errorMessage) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE notification_outbox 
                 SET attempts = attempts + 1, last_attempt_at = CURRENT_TIMESTAMP, error_message = ?
                 WHERE id = ?`,
                [errorMessage, id],
                (err) => {
                    if (err) return reject(err);
                    resolve(true);
                }
            );
        });
    },

    /**
     * Mark notification as permanently failed.
     * @private
     */
    _markFailed: async (id, errorMessage) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE notification_outbox 
                 SET status = 'FAILED', error_message = ?, last_attempt_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [errorMessage, id],
                (err) => {
                    if (err) return reject(err);
                    resolve(true);
                }
            );
        });
    },

    /**
     * Get outbox statistics for monitoring.
     * 
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object>} Outbox stats
     */
    getOutboxStats: async (orgId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'QUEUED' THEN 1 ELSE 0 END) as queued,
                    SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
                 FROM notification_outbox
                 WHERE org_id = ?
                 AND created_at > datetime('now', '-7 days')`,
                [orgId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || { total: 0, queued: 0, sent: 0, failed: 0 });
                }
            );
        });
    }
};

module.exports = NotificationOutboxService;
