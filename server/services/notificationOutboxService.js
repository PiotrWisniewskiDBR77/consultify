import BaseService from './BaseService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * NotificationOutboxService
 * 
 * Step 16: Outbox pattern for async notification delivery.
 * Queues notifications for later processing, respects user preferences.
 */
class NotificationOutboxService extends BaseService {
    constructor() {
        super();
        this._auditLogger = null;
        this.NOTIFICATION_TYPES = {
            APPROVAL_DUE: 'APPROVAL_DUE',
            PLAYBOOK_STUCK: 'PLAYBOOK_STUCK',
            DEAD_LETTER: 'DEAD_LETTER',
            ESCALATION: 'ESCALATION'
        };
        this.OUTBOX_STATUSES = {
            QUEUED: 'QUEUED',
            SENT: 'SENT',
            FAILED: 'FAILED'
        };
        this.MAX_ATTEMPTS = 3;
    }

    /**
     * Initialize dependencies
     */
    async init() {
        await super.init();
        if (!this._auditLogger) {
            const auditLogger = await import('../utils/auditLogger.js');
            this._auditLogger = auditLogger.default || auditLogger;
        }
        return this;
    }

    /**
     * Set dependencies for testing
     */
    setDependencies(newDeps) {
        super.setDependencies(newDeps);
        if (newDeps.auditLogger) this._auditLogger = newDeps.auditLogger;
    }

    /**
     * Enqueue a notification for async delivery.
     */
    async enqueue(userId, orgId, type, payload, channel = 'email') {
        await this.init();

        // Check user preferences first
        const shouldSend = await this.shouldNotify(userId, orgId, type);
        if (!shouldSend) {
            console.log(`[NotificationOutbox] User ${userId} has disabled ${type} notifications`);
            return { skipped: true, reason: 'user_preference' };
        }

        const id = uuidv4();

        await this.queryRun(
            `INSERT INTO notification_outbox 
             (id, org_id, user_id, notification_type, payload_json, status, channel, created_at)
             VALUES (?, ?, ?, ?, ?, 'QUEUED', ?, CURRENT_TIMESTAMP)`,
            [id, orgId, userId, type, JSON.stringify(payload), channel]
        );

        if (this._auditLogger) {
            this._auditLogger.debug('NOTIFICATION_QUEUED', {
                notification_id: id,
                user_id: userId,
                org_id: orgId,
                type,
                channel
            });
        }

        return { id, userId, orgId, type, status: this.OUTBOX_STATUSES.QUEUED };
    }

    /**
     * Check if user wants to receive this notification type.
     */
    async shouldNotify(userId, orgId, eventType) {
        await this.init();
        const prefs = await this.getUserPreferences(userId, orgId);

        // Default to true if no preferences set
        if (!prefs) return true;

        const eventMap = {
            [this.NOTIFICATION_TYPES.APPROVAL_DUE]: prefs.event_approval_due,
            [this.NOTIFICATION_TYPES.PLAYBOOK_STUCK]: prefs.event_playbook_stuck,
            [this.NOTIFICATION_TYPES.DEAD_LETTER]: prefs.event_dead_letter,
            [this.NOTIFICATION_TYPES.ESCALATION]: prefs.event_escalation
        };

        return eventMap[eventType] !== 0;
    }

    /**
     * Get user notification preferences.
     */
    async getUserPreferences(userId, orgId) {
        await this.init();
        return this.queryOne(
            `SELECT * FROM user_notification_preferences 
             WHERE user_id = ? AND org_id = ?`,
            [userId, orgId]
        );
    }

    /**
     * Update user notification preferences.
     */
    async updateUserPreferences(userId, orgId, preferences) {
        await this.init();
        const id = uuidv4();

        await this.queryRun(
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
            ]
        );

        if (this._auditLogger) {
            this._auditLogger.info('NOTIFICATION_PREFS_UPDATED', {
                user_id: userId,
                org_id: orgId
            });
        }

        return { userId, orgId, ...preferences };
    }

    /**
     * Process queued notifications (cron job).
     */
    async processQueue() {
        await this.init();
        console.log('[NotificationOutbox] Processing queue...');
        const startTime = Date.now();

        const summary = {
            processed: 0,
            sent: 0,
            failed: 0,
            skipped: 0
        };

        const rows = await this.queryAll(
            `SELECT * FROM notification_outbox 
             WHERE status = 'QUEUED' AND attempts < ?
             ORDER BY created_at ASC
             LIMIT 100`,
            [this.MAX_ATTEMPTS]
        );

        for (const notification of (rows || [])) {
            summary.processed++;

            try {
                // Simulate sending
                const success = await this._sendNotification(notification);

                if (success) {
                    await this._markSent(notification.id);
                    summary.sent++;
                } else {
                    await this._markFailed(notification.id, 'Send failed');
                    summary.failed++;
                }
            } catch (sendErr) {
                await this._incrementAttempts(notification.id, sendErr.message);
                summary.failed++;
            }
        }

        const duration = Date.now() - startTime;
        console.log(`[NotificationOutbox] Queue processed in ${duration}ms:`, summary);

        return summary;
    }

    /**
     * Simulate sending a notification (placeholder for real integration).
     * @private
     */
    async _sendNotification(notification) {
        console.log(`[NotificationOutbox] Would send ${notification.notification_type} to user ${notification.user_id}`);
        return true;
    }

    /**
     * Mark notification as sent.
     * @private
     */
    async _markSent(id) {
        await this.init();
        return this.queryRun(
            `UPDATE notification_outbox 
             SET status = 'SENT', sent_at = CURRENT_TIMESTAMP, last_attempt_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [id]
        );
    }

    /**
     * Increment attempt count and record error.
     * @private
     */
    async _incrementAttempts(id, errorMessage) {
        await this.init();
        return this.queryRun(
            `UPDATE notification_outbox 
             SET attempts = attempts + 1, last_attempt_at = CURRENT_TIMESTAMP, error_message = ?
             WHERE id = ?`,
            [errorMessage, id]
        );
    }

    /**
     * Mark notification as permanently failed.
     * @private
     */
    async _markFailed(id, errorMessage) {
        await this.init();
        return this.queryRun(
            `UPDATE notification_outbox 
             SET status = 'FAILED', error_message = ?, last_attempt_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [errorMessage, id]
        );
    }

    /**
     * Get outbox statistics for monitoring.
     */
    async getOutboxStats(orgId) {
        await this.init();
        const row = await this.queryOne(
            `SELECT 
                COUNT(*) as total,
                COALESCE(SUM(CASE WHEN status = 'QUEUED' THEN 1 ELSE 0 END), 0) as queued,
                COALESCE(SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END), 0) as sent,
                COALESCE(SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END), 0) as failed
             FROM notification_outbox
             WHERE org_id = ?
             AND created_at > datetime('now', '-7 days')`,
            [orgId]
        );
        return row || { total: 0, queued: 0, sent: 0, failed: 0 };
    }
}

const service = new NotificationOutboxService();
export default service;

