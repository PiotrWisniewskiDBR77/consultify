export default service;
declare const service: NotificationOutboxService;
/**
 * NotificationOutboxService
 *
 * Step 16: Outbox pattern for async notification delivery.
 * Queues notifications for later processing, respects user preferences.
 */
declare class NotificationOutboxService extends BaseService {
    _auditLogger: any;
    NOTIFICATION_TYPES: {
        APPROVAL_DUE: string;
        PLAYBOOK_STUCK: string;
        DEAD_LETTER: string;
        ESCALATION: string;
    };
    OUTBOX_STATUSES: {
        QUEUED: string;
        SENT: string;
        FAILED: string;
    };
    MAX_ATTEMPTS: number;
    /**
     * Initialize dependencies
     */
    init(): Promise<this>;
    /**
     * Set dependencies for testing
     */
    setDependencies(newDeps: any): void;
    /**
     * Enqueue a notification for async delivery.
     */
    enqueue(userId: any, orgId: any, type: any, payload: any, channel?: string): Promise<{
        skipped: boolean;
        reason: string;
        id?: undefined;
        userId?: undefined;
        orgId?: undefined;
        type?: undefined;
        status?: undefined;
    } | {
        id: string;
        userId: any;
        orgId: any;
        type: any;
        status: string;
        skipped?: undefined;
        reason?: undefined;
    }>;
    /**
     * Check if user wants to receive this notification type.
     */
    shouldNotify(userId: any, orgId: any, eventType: any): Promise<boolean>;
    /**
     * Get user notification preferences.
     */
    getUserPreferences(userId: any, orgId: any): Promise<any>;
    /**
     * Update user notification preferences.
     */
    updateUserPreferences(userId: any, orgId: any, preferences: any): Promise<any>;
    /**
     * Process queued notifications (cron job).
     */
    processQueue(): Promise<{
        processed: number;
        sent: number;
        failed: number;
        skipped: number;
    }>;
    /**
     * Simulate sending a notification (placeholder for real integration).
     * @private
     */
    private _sendNotification;
    /**
     * Mark notification as sent.
     * @private
     */
    private _markSent;
    /**
     * Increment attempt count and record error.
     * @private
     */
    private _incrementAttempts;
    /**
     * Mark notification as permanently failed.
     * @private
     */
    private _markFailed;
    /**
     * Get outbox statistics for monitoring.
     */
    getOutboxStats(orgId: any): Promise<any>;
}
import BaseService from './BaseService.js';
//# sourceMappingURL=notificationOutboxService.d.ts.map