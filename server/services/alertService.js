/**
 * Service to handle active alerting based on performance metrics
 */
const AlertService = {
    /**
     * Checks current metrics against defined thresholds
     * @param {Object} summary - Metrics summary from performanceMiddleware
     * @param {Object} memory - Memory metrics
     * @returns {Array} List of active alerts
     */
    checkThresholds(summary, memory) {
        const alerts = [];
        const timestamp = new Date().toISOString();

        // 1. Response Time Thresholds
        if (summary.avgResponseTime > 2000) { // > 2s critical
            alerts.push({
                type: 'CRITICAL',
                component: 'API_PERFORMANCE',
                message: `Critical: Average response time is ${summary.avgResponseTime}ms`,
                timestamp
            });
        } else if (summary.avgResponseTime > 1000) { // > 1s warning
            alerts.push({
                type: 'WARNING',
                component: 'API_PERFORMANCE',
                message: `Warning: Average response time is high (${summary.avgResponseTime}ms)`,
                timestamp
            });
        }

        // 2. Error Rate Thresholds
        if (summary.errorRate > 10) { // > 10% critical
            alerts.push({
                type: 'CRITICAL',
                component: 'API_STABILITY',
                message: `Critical: API Error rate is ${summary.errorRate}%`,
                timestamp
            });
        } else if (summary.errorRate > 5) { // > 5% warning
            alerts.push({
                type: 'WARNING',
                component: 'API_STABILITY',
                message: `Warning: API Error rate is elevated (${summary.errorRate}%)`,
                timestamp
            });
        }

        // 3. Memory Thresholds
        if (memory.heapUsed > 1024) { // > 1GB critical
            alerts.push({
                type: 'CRITICAL',
                component: 'SYSTEM_RESOURCE',
                message: `Critical: Heap usage is ${memory.heapUsed}MB`,
                timestamp
            });
        } else if (memory.heapUsed > 500) { // > 500MB warning
            alerts.push({
                type: 'WARNING',
                component: 'SYSTEM_RESOURCE',
                message: `Warning: High memory usage (${memory.heapUsed}MB)`,
                timestamp
            });
        }

        // 4. Slow Request Volume
        if (summary.slowRequests > 50 && (summary.slowRequests / summary.totalRequests > 0.2)) {
            alerts.push({
                type: 'WARNING',
                component: 'API_PERFORMANCE',
                message: `Warning: 20%+ of requests are slow (>1s)`,
                timestamp
            });
        }

        return alerts;
    },

    /**
     * Persists alerts to notification system (mocked for now)
     * In a real implementation, this would insert into 'notifications' table or send emails
     */
    async dispatchAlerts(alerts) {
        if (!alerts || alerts.length === 0) return;

        alerts.forEach(alert => {
            if (alert.type === 'CRITICAL') {
                console.error(`[ALERT SERVICE] ${alert.message}`);
                // TODO: Integration with email/Slack service
            } else {
                console.warn(`[ALERT SERVICE] ${alert.message}`);
            }
        });
    }
};

export default AlertService;
