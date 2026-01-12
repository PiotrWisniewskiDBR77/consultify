export default IntegrationAnalyticsService;
declare namespace IntegrationAnalyticsService {
    function setDependencies(newDeps?: {}): void;
    function logApiUsage({ userId, integrationId, apiKeyId, endpoint, method, statusCode, responseTimeMs, tokensUsed, cost, requestBody, responseBody, errorMessage }: {
        userId: any;
        integrationId: any;
        apiKeyId: any;
        endpoint: any;
        method?: string | undefined;
        statusCode: any;
        responseTimeMs: any;
        tokensUsed?: number | undefined;
        cost?: number | undefined;
        requestBody?: null | undefined;
        responseBody?: null | undefined;
        errorMessage?: null | undefined;
    }): Promise<any>;
    function getUsageStats(integrationId: any, period?: string): Promise<any>;
    function getErrorLogs(integrationId: any, limit?: number): Promise<any>;
    function getPerformanceMetrics(integrationId: any, period?: string): Promise<any>;
    function aggregateDailyStats(integrationId: any, days?: number): Promise<any>;
    function logWebhookDelivery({ webhookId, eventType, status, responseCode, responseTimeMs, retryCount, errorMessage, payload, responseBody, deliveredAt }: {
        webhookId: any;
        eventType: any;
        status?: string | undefined;
        responseCode?: null | undefined;
        responseTimeMs?: null | undefined;
        retryCount?: number | undefined;
        errorMessage?: null | undefined;
        payload?: null | undefined;
        responseBody?: null | undefined;
        deliveredAt?: null | undefined;
    }): Promise<any>;
    function getWebhookDeliveries(webhookId: any, limit?: number): Promise<any>;
    function recordHealthCheck({ integrationId, status, latencyMs, errorMessage, checkType }: {
        integrationId: any;
        status?: string | undefined;
        latencyMs?: null | undefined;
        errorMessage?: null | undefined;
        checkType?: string | undefined;
    }): Promise<any>;
    function getHealthStatus(integrationId: any): Promise<any>;
    function getHealthCheckHistory(integrationId: any, limit?: number): Promise<any>;
    function getAggregatedAnalytics(integrationId: any, periodType?: string, days?: number): Promise<any>;
}
//# sourceMappingURL=integrationAnalyticsService.d.ts.map