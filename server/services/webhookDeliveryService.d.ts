export default webhookDeliveryServiceInstance;
declare const webhookDeliveryServiceInstance: WebhookDeliveryService;
declare class WebhookDeliveryService {
    /**
     * Trigger an event to be sent to all subscribed webhooks
     * @param {string} orgId - Organization ID the event belongs to
     * @param {string} eventType - e.g., 'initiative.created'
     * @param {object} payload - The data to send
     */
    triggerEvent(orgId: string, eventType: string, payload: object): Promise<void>;
    getSubscriptions(orgId: any, eventType: any): Promise<any>;
    queueDelivery(sub: any, eventType: any, payload: any): Promise<void>;
    processDelivery(attemptId: any, sub: any, payload: any): Promise<void>;
    updateStatus(attemptId: any, status: any, code: any, body: any): Promise<any>;
    createSubscription(orgId: any, name: any, targetUrl: any, eventTypes: any): Promise<{
        id: any;
        secret: any;
    }>;
    /**
     * List all subscriptions for organization
     */
    listSubscriptions(orgId: any): Promise<any>;
    /**
     * Get subscription by ID
     */
    getSubscription(subscriptionId: any): Promise<any>;
    /**
     * Update subscription
     */
    updateSubscription(subscriptionId: any, updates: any): Promise<any>;
    /**
     * Delete subscription
     */
    deleteSubscription(subscriptionId: any): Promise<any>;
    /**
     * Test webhook URL
     */
    testWebhook(targetUrl: any, secret?: null): Promise<{
        success: boolean;
        statusCode: number;
        duration: number;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        statusCode: any;
        error: any;
        message: string;
        duration?: undefined;
    }>;
    /**
     * Get delivery logs for subscription
     */
    getDeliveryLogs(subscriptionId: any, limit?: number): Promise<any>;
    /**
     * Get available event types
     */
    getAvailableEvents(): {
        category: string;
        events: {
            type: string;
            description: string;
        }[];
    }[];
}
//# sourceMappingURL=webhookDeliveryService.d.ts.map