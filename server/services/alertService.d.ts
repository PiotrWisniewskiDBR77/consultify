export default AlertService;
declare namespace AlertService {
    /**
     * Checks current metrics against defined thresholds
     * @param {Object} summary - Metrics summary from performanceMiddleware
     * @param {Object} memory - Memory metrics
     * @returns {Array} List of active alerts
     */
    function checkThresholds(summary: Object, memory: Object): any[];
    /**
     * Persists alerts to notification system (mocked for now)
     * In a real implementation, this would insert into 'notifications' table or send emails
     */
    function dispatchAlerts(alerts: any): Promise<void>;
}
//# sourceMappingURL=alertService.d.ts.map