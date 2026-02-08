/**
 * AI Quality Monitoring Service - Unit Tests (L6.9)
 * 
 * @module tests/unit/backend/services/ai/quality-monitoring.service.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AIQualityMonitoringService } from '../../../../server/src/services/ai/quality-monitoring.service.js';

describe('AI Quality Monitoring Service (L6.9)', () => {
    let service: AIQualityMonitoringService;

    beforeEach(() => {
        service = new AIQualityMonitoringService();
    });

    describe('Request Tracking', () => {
        it('should start and end a request', () => {
            const requestId = 'test-request-1';

            service.startRequest(requestId, 'STANDARD');
            service.endRequest(requestId, true, { responseLength: 500 });

            const metrics = service.getMetrics('hour');
            expect(metrics.totalRequests).toBe(1);
            expect(metrics.successRate).toBe(1);
        });

        it('should track failed requests', () => {
            service.startRequest('req-1', 'PREMIUM');
            service.endRequest('req-1', false, { errorMessage: 'API Error' });

            const metrics = service.getMetrics('hour');
            expect(metrics.totalRequests).toBe(1);
            expect(metrics.errorRate).toBe(1);
            expect(metrics.successRate).toBe(0);
        });

        it('should track retried requests', () => {
            service.startRequest('req-1', 'BUDGET');
            service.endRequest('req-1', true, { retried: true });

            const metrics = service.getMetrics('hour');
            expect(metrics.retryRate).toBe(1);
        });

        it('should track multiple requests', () => {
            // 3 successful, 1 failed, 1 retried
            service.startRequest('req-1', 'STANDARD');
            service.endRequest('req-1', true);

            service.startRequest('req-2', 'STANDARD');
            service.endRequest('req-2', true);

            service.startRequest('req-3', 'STANDARD');
            service.endRequest('req-3', true, { retried: true });

            service.startRequest('req-4', 'STANDARD');
            service.endRequest('req-4', false);

            const metrics = service.getMetrics('hour');
            expect(metrics.totalRequests).toBe(4);
            expect(metrics.successRate).toBe(0.75);
            expect(metrics.errorRate).toBe(0.25);
            expect(metrics.retryRate).toBe(0.25);
        });
    });

    describe('Response Time Metrics', () => {
        it('should calculate response time percentiles', () => {
            // Simulate requests with varying response times
            const requestIds = ['req-1', 'req-2', 'req-3', 'req-4', 'req-5'];

            for (const id of requestIds) {
                service.startRequest(id, 'STANDARD');
            }

            // Complete them (instant completion for testing)
            for (const id of requestIds) {
                service.endRequest(id, true);
            }

            const metrics = service.getMetrics('hour');
            expect(metrics.responseTime.p50).toBeGreaterThanOrEqual(0);
            expect(metrics.responseTime.p95).toBeGreaterThanOrEqual(0);
            expect(metrics.responseTime.p99).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Response Length Stats', () => {
        it('should track response lengths', () => {
            service.startRequest('req-1', 'STANDARD');
            service.endRequest('req-1', true, { responseLength: 100 });

            service.startRequest('req-2', 'STANDARD');
            service.endRequest('req-2', true, { responseLength: 300 });

            service.startRequest('req-3', 'STANDARD');
            service.endRequest('req-3', true, { responseLength: 200 });

            const metrics = service.getMetrics('hour');
            expect(metrics.responseLength.min).toBe(100);
            expect(metrics.responseLength.max).toBe(300);
            expect(metrics.responseLength.avg).toBe(200);
        });
    });

    describe('Health Status', () => {
        it('should return healthy when no issues', () => {
            service.startRequest('req-1', 'STANDARD');
            service.endRequest('req-1', true);

            const metrics = service.getMetrics('hour');
            expect(metrics.healthStatus).toBe('healthy');
        });

        it('should return degraded on high error rate', () => {
            // Create many failed requests to trigger degraded status
            for (let i = 0; i < 10; i++) {
                service.startRequest(`req-${i}`, 'STANDARD');
                service.endRequest(`req-${i}`, false);
            }

            const metrics = service.getMetrics('hour');
            expect(metrics.healthStatus).toBe('critical');
        });

        it('should check if service is healthy', () => {
            service.startRequest('req-1', 'STANDARD');
            service.endRequest('req-1', true);

            expect(service.isHealthy()).toBe(true);
        });
    });

    describe('Alerts', () => {
        it('should return no alerts when healthy', () => {
            service.startRequest('req-1', 'STANDARD');
            service.endRequest('req-1', true);

            const alerts = service.getAlerts();
            expect(alerts).toHaveLength(0);
        });

        it('should generate alerts for high error rate', () => {
            for (let i = 0; i < 10; i++) {
                service.startRequest(`req-${i}`, 'STANDARD');
                service.endRequest(`req-${i}`, false);
            }

            const alerts = service.getAlerts();
            expect(alerts.length).toBeGreaterThan(0);
            expect(alerts[0]).toContain('Error rate');
        });
    });

    describe('Health Check Integration', () => {
        it('should return L6-compatible health check', () => {
            service.startRequest('req-1', 'STANDARD');
            service.endRequest('req-1', true);

            const healthCheck = service.getHealthCheck();

            expect(healthCheck.status).toBe('healthy');
            expect(healthCheck.message).toBeDefined();
            expect(healthCheck.details).toBeDefined();
            expect(healthCheck.details.p95ResponseTime).toBeDefined();
        });
    });

    describe('Empty State', () => {
        it('should handle no requests gracefully', () => {
            const metrics = service.getMetrics('hour');

            expect(metrics.totalRequests).toBe(0);
            expect(metrics.healthStatus).toBe('healthy');
            expect(metrics.responseTime.p50).toBe(0);
        });
    });

    describe('Period Filtering', () => {
        it('should support different time periods', () => {
            service.startRequest('req-1', 'STANDARD');
            service.endRequest('req-1', true);

            const hourMetrics = service.getMetrics('hour');
            const dayMetrics = service.getMetrics('day');
            const weekMetrics = service.getMetrics('week');

            expect(hourMetrics.period).toBe('hour');
            expect(dayMetrics.period).toBe('day');
            expect(weekMetrics.period).toBe('week');
        });
    });
});
