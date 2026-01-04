export default notificationServiceInstance;
declare const notificationServiceInstance: NotificationService;
/**
 * Notification Service - Enterprise-grade notification engine
 */
declare class NotificationService extends BaseService {
    NOTIFICATION_TYPES: {
        TASK_ASSIGNED: string;
        TASK_OVERDUE: string;
        TASK_BLOCKED: string;
        TASK_ESCALATED: string;
        TASK_SLA_WARNING: string;
        INITIATIVE_STARTED: string;
        INITIATIVE_STALLED: string;
        INITIATIVE_COMPLETED: string;
        DECISION_REQUIRED: string;
        DECISION_OVERDUE: string;
        CHANGE_REQUEST_SUBMITTED: string;
        CHANGE_REQUEST_DECIDED: string;
        GATE_PENDING_APPROVAL: string;
        AI_RISK_DETECTED: string;
        AI_OVERLOAD_DETECTED: string;
        AI_DEPENDENCY_CONFLICT: string;
        AI_RECOMMENDATION: string;
        AI_HEALTH_DEGRADED: string;
        AI_HEALTH_CRITICAL: string;
        AI_CHAT_UNAVAILABLE: string;
        TRIAL_WARNING: string;
        TRIAL_EXPIRED: string;
        TRIAL_UPGRADED: string;
        PERMISSION_REQUEST_SUBMITTED: string;
        PERMISSION_REQUEST_APPROVED: string;
        PERMISSION_REQUEST_REJECTED: string;
    };
    SEVERITY: {
        INFO: string;
        WARNING: string;
        CRITICAL: string;
    };
    _slackService: any;
    _userIntegrationService: any;
    _userNotificationPreferencesService: any;
    _slackUserIntegration: any;
    _teamsUserIntegration: any;
    /**
     * Initialize service dependencies
     */
    init(): Promise<this>;
    /**
     * Set dependencies manually (for testing)
     */
    setDependencies(customDeps: any): void;
    /**
     * Create a notification
     */
    create(notification: any): Promise<{
        id: string;
        type: any;
        severity: any;
        title: any;
    } | null>;
    /**
     * Get notifications for a user
     */
    getForUser(userId: any, options?: {}): Promise<any>;
    /**
     * Mark notification as read
     */
    markRead(notificationId: any, userId: any): Promise<{
        updated: boolean;
    }>;
    /**
     * Mark all as read for a user
     */
    markAllRead(userId: any): Promise<{
        updated: any;
    }>;
    /**
     * Delete a notification
     */
    delete(notificationId: any, userId: any): Promise<{
        deleted: boolean;
    }>;
    /**
     * Get notification counts
     */
    getCounts(userId: any): Promise<{
        total: any;
        unread: any;
        critical: any;
    }>;
    /**
     * Check if notification should be muted
     */
    _checkMuteSettings(userId: any, type: any, severity: any): Promise<boolean>;
    /**
     * Check for duplicate notification
     */
    _checkDuplicate(userId: any, organizationId: any, type: any, relatedObjectId: any): Promise<boolean>;
    /**
     * Deliver notification through user's preferred channels
     */
    deliverNotification(userId: any, notification: any): Promise<{
        id: string;
        type: any;
        severity: any;
        title: any;
    } | {
        channels: never[];
        queued: boolean;
        delivered: boolean;
    } | {
        delivered: boolean;
        reason: string;
    } | null>;
    /**
     * Deliver to a specific channel
     */
    _deliverToChannel(userId: any, channel: any, notification: any): Promise<{
        success: boolean;
        notificationId: string | undefined;
        method?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        method: string;
        notificationId?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        notificationId?: undefined;
        method?: undefined;
    }>;
    /**
     * Notify all watchers of an object
     */
    notifyWatchers(objectType: any, objectId: any, notification: any): Promise<{
        notified: number;
        results?: undefined;
        error?: undefined;
    } | {
        notified: number;
        results: ({
            userId: any;
        } | {
            id: string;
            type: any;
            severity: any;
            title: any;
            userId: any;
        } | {
            channels: never[];
            queued: boolean;
            delivered: boolean;
            userId: any;
        } | {
            delivered: boolean;
            reason: string;
            userId: any;
        })[];
        error?: undefined;
    } | {
        notified: number;
        error: any;
        results?: undefined;
    }>;
    /**
     * Send due date reminder
     */
    sendDueReminder(userId: any, organizationId: any, taskId: any, taskTitle: any, reminderType: any, dueDate: any): Promise<{
        sent: boolean;
        reason: string;
        error?: undefined;
    } | {
        sent: any;
        reason?: undefined;
        error?: undefined;
    } | {
        id: string;
        type: any;
        severity: any;
        title: any;
        sent: any;
        reason?: undefined;
        error?: undefined;
    } | {
        channels: never[];
        queued: boolean;
        delivered: boolean;
        sent: any;
        reason?: undefined;
        error?: undefined;
    } | {
        delivered: boolean;
        reason: string;
        sent: any;
        error?: undefined;
    } | {
        sent: boolean;
        error: any;
        reason?: undefined;
    }>;
    /**
     * Get user's notification preferences summary
     */
    getUserPreferencesSummary(userId: any): Promise<{
        globalEnabled: any;
        quietHoursEnabled: any;
        connectedChannels: any;
        watchingCount: any;
        digestsEnabled: any;
    } | null>;
}
import BaseService from './BaseService.js';
//# sourceMappingURL=notificationService.d.ts.map