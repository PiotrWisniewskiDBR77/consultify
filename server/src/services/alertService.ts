/**
 * Service to handle active alerting based on performance metrics.
 */

type AlertSeverity = 'CRITICAL' | 'WARNING';

type Alert = {
    type: AlertSeverity;
    component: 'API_PERFORMANCE' | 'API_STABILITY' | 'SYSTEM_RESOURCE';
    message: string;
    timestamp: string;
};

type MetricsSummary = {
    avgResponseTime: number;
    errorRate: number;
    slowRequests: number;
    totalRequests: number;
};

type MemoryMetrics = {
    heapUsed: number;
};

const AlertService = {
    checkThresholds(summary: MetricsSummary, memory: MemoryMetrics): Alert[] {
        const alerts: Alert[] = [];
        const timestamp = new Date().toISOString();

        if (summary.avgResponseTime > 2000) {
            alerts.push({
                type: 'CRITICAL',
                component: 'API_PERFORMANCE',
                message: `Critical: Average response time is ${summary.avgResponseTime}ms`,
                timestamp,
            });
        } else if (summary.avgResponseTime > 1000) {
            alerts.push({
                type: 'WARNING',
                component: 'API_PERFORMANCE',
                message: `Warning: Average response time is high (${summary.avgResponseTime}ms)`,
                timestamp,
            });
        }

        if (summary.errorRate > 10) {
            alerts.push({
                type: 'CRITICAL',
                component: 'API_STABILITY',
                message: `Critical: API Error rate is ${summary.errorRate}%`,
                timestamp,
            });
        } else if (summary.errorRate > 5) {
            alerts.push({
                type: 'WARNING',
                component: 'API_STABILITY',
                message: `Warning: API Error rate is elevated (${summary.errorRate}%)`,
                timestamp,
            });
        }

        if (memory.heapUsed > 1024) {
            alerts.push({
                type: 'CRITICAL',
                component: 'SYSTEM_RESOURCE',
                message: `Critical: Heap usage is ${memory.heapUsed}MB`,
                timestamp,
            });
        } else if (memory.heapUsed > 500) {
            alerts.push({
                type: 'WARNING',
                component: 'SYSTEM_RESOURCE',
                message: `Warning: High memory usage (${memory.heapUsed}MB)`,
                timestamp,
            });
        }

        if (summary.slowRequests > 50 && summary.slowRequests / summary.totalRequests > 0.2) {
            alerts.push({
                type: 'WARNING',
                component: 'API_PERFORMANCE',
                message: 'Warning: 20%+ of requests are slow (>1s)',
                timestamp,
            });
        }

        return alerts;
    },

    async dispatchAlerts(alerts: Alert[]): Promise<void> {
        if (!alerts || alerts.length === 0) return;

        // Lazy import to avoid circular dependencies
        const { default: NotificationService } = await import('./notificationService.js');

        for (const alert of alerts) {
            if (alert.type === 'CRITICAL') {
                console.error(`[ALERT SERVICE] ${alert.message}`);

                try {
                    // Create system alert notification
                    if (NotificationService && typeof NotificationService.create === 'function') {
                        await NotificationService.create({
                            userId: 'system', // System-level alert
                            organizationId: 'system',
                            type: 'SYSTEM_ALERT',
                            title: `System Alert: ${alert.component}`,
                            message: alert.message,
                            severity: 'CRITICAL',
                            isActionable: false,
                            expiresAt: undefined
                        });
                    }
                } catch (error) {
                    console.error('[ALERT SERVICE] Failed to dispatch notification:', error);
                }
            } else {
                console.warn(`[ALERT SERVICE] ${alert.message}`);
            }
        }
    },
};

export default AlertService;
