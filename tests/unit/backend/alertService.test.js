// Reliant on global describe/it from Vitest runner
const AlertService = require('../../../server/services/alertService');

describe('AlertService', () => {
    it('should detect CRITICAL response time', () => {
        const summary = { avgResponseTime: 2500, errorRate: 0, slowRequests: 0, totalRequests: 100 };
        const memory = { heapUsed: 100 };
        const alerts = AlertService.checkThresholds(summary, memory);

        const critical = alerts.find(a => a.type === 'CRITICAL' && a.component === 'API_PERFORMANCE');
        expect(critical).toBeDefined();
        expect(critical.message).toContain('2500ms');
    });

    it('should detect WARNING memory usage', () => {
        const summary = { avgResponseTime: 100, errorRate: 0, slowRequests: 0, totalRequests: 100 };
        const memory = { heapUsed: 600 }; // > 500
        const alerts = AlertService.checkThresholds(summary, memory);

        const warning = alerts.find(a => a.type === 'WARNING' && a.component === 'SYSTEM_RESOURCE');
        expect(warning).toBeDefined();
        expect(warning.message).toContain('600MB');
    });

    it('should detect High Error Rate', () => {
        const summary = { avgResponseTime: 100, errorRate: 15, slowRequests: 0, totalRequests: 100 };
        const memory = { heapUsed: 100 };
        const alerts = AlertService.checkThresholds(summary, memory);

        const critical = alerts.find(a => a.type === 'CRITICAL' && a.component === 'API_STABILITY');
        expect(critical).toBeDefined();
        expect(critical.message).toContain('15%');
    });

    it('should return empty array when everything is healthy', () => {
        const summary = { avgResponseTime: 100, errorRate: 0, slowRequests: 0, totalRequests: 100 };
        const memory = { heapUsed: 100 };
        const alerts = AlertService.checkThresholds(summary, memory);
        expect(alerts).toHaveLength(0);
    });
});
