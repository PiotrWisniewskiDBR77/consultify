declare namespace _default {
    export { AlertingService };
    export { alertingService };
    export { alerts };
    export { SEVERITY };
    export { ALERT_TYPE };
}
export default _default;
export class AlertingService {
    slackWebhook: string | undefined;
    discordWebhook: string | undefined;
    genericWebhook: string | undefined;
    enabled: boolean;
    /**
     * Send an alert through all configured channels
     */
    send(alertType: any, data?: {}): Promise<void>;
    /**
     * Format alert based on type
     */
    formatAlert(alertType: any, data: any): {
        type: any;
        severity: string;
        emoji: string;
        title: string;
        message: string;
        timestamp: string;
        data: any;
        environment: string;
    };
    /**
     * Log alert to console
     */
    logToConsole(alert: any): void;
    /**
     * Send alert to Slack
     */
    sendToSlack(alert: any): Promise<any>;
    /**
     * Send alert to Discord
     */
    sendToDiscord(alert: any): Promise<any>;
    /**
     * Send alert to generic webhook (PagerDuty, Opsgenie, etc.)
     */
    sendToWebhook(alert: any): Promise<any>;
    /**
     * Post to a webhook URL
     */
    postWebhook(url: any, payload: any): Promise<any>;
    /**
     * Get Slack color for severity
     */
    getSeverityColor(severity: any): "#dc3545" | "#fd7e14" | "#ffc107" | "#17a2b8" | "#6c757d";
    /**
     * Get Discord color (integer) for severity
     */
    getSeverityColorHex(severity: any): 14431557 | 16612884 | 16761095 | 1548984 | 7107965;
    /**
     * Clear throttle cache (for testing)
     */
    clearThrottle(): void;
    /**
     * Get alerting status
     */
    getStatus(): {
        enabled: boolean;
        channels: {
            slack: boolean;
            discord: boolean;
            webhook: boolean;
        };
        throttledAlerts: number;
    };
}
export const alertingService: AlertingService;
export namespace alerts {
    function circuitOpen(providerId: any, failures: any, cooldown: any): Promise<void>;
    function circuitClosed(providerId: any): Promise<void>;
    function budgetWarning(organizationId: any, percentUsed: any): Promise<void>;
    function budgetExceeded(organizationId: any, percentUsed: any): Promise<void>;
    function rateLimitExceeded(userId: any, organizationId: any, capability: any): Promise<void>;
    function providerDown(providerId: any, error: any): Promise<void>;
    function providerRecovered(providerId: any): Promise<void>;
    function highLatency(providerId: any, latencyMs: any, threshold: any): Promise<void>;
    function errorSpike(errorCount: any, errorRate: any, windowMinutes: any): Promise<void>;
}
export namespace SEVERITY {
    let INFO: string;
    let WARNING: string;
    let ERROR: string;
    let CRITICAL: string;
}
export namespace ALERT_TYPE {
    let CIRCUIT_OPEN: string;
    let CIRCUIT_CLOSED: string;
    let BUDGET_WARNING: string;
    let BUDGET_EXCEEDED: string;
    let RATE_LIMIT_EXCEEDED: string;
    let PROVIDER_DOWN: string;
    let PROVIDER_RECOVERED: string;
    let HIGH_LATENCY: string;
    let ERROR_SPIKE: string;
}
//# sourceMappingURL=alerting.d.ts.map