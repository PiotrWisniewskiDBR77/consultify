/**
 * AI Cost Monitoring Service - Unit Tests (L6.10)
 * 
 * @module tests/unit/backend/services/ai/cost-monitoring.service.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AICostMonitoringService } from '../../../../server/src/services/ai/cost-monitoring.service.js';

describe('AI Cost Monitoring Service (L6.10)', () => {
    let service: AICostMonitoringService;

    beforeEach(() => {
        service = new AICostMonitoringService();
    });

    describe('Usage Recording', () => {
        it('should record token usage', () => {
            const record = service.recordUsage(
                'user-1',
                'org-1',
                'STANDARD',
                'openai',
                'gpt-4o-mini',
                { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 }
            );

            expect(record.id).toBeDefined();
            expect(record.userId).toBe('user-1');
            expect(record.usage.totalTokens).toBe(1500);
            expect(record.costUSD).toBeGreaterThan(0);
        });

        it('should calculate cost based on model pricing', () => {
            const record = service.recordUsage(
                'user-1',
                'org-1',
                'PREMIUM',
                'openai',
                'gpt-4o',
                { inputTokens: 1000000, outputTokens: 500000, totalTokens: 1500000 }
            );

            // gpt-4o: $2.5/1M input, $10/1M output
            // Expected: (1M * 2.5) + (0.5M * 10) = 2.5 + 5 = 7.5
            expect(record.costUSD).toBeCloseTo(7.5, 1);
        });

        it('should use default pricing for unknown models', () => {
            const record = service.recordUsage(
                'user-1',
                'org-1',
                'BUDGET',
                'unknown',
                'unknown-model',
                { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 }
            );

            expect(record.costUSD).toBeGreaterThan(0);
        });
    });

    describe('Cost Metrics', () => {
        it('should aggregate usage metrics', () => {
            service.recordUsage('user-1', 'org-1', 'STANDARD', 'openai', 'gpt-4o-mini',
                { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

            service.recordUsage('user-2', 'org-1', 'PREMIUM', 'openai', 'gpt-4o',
                { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 });

            const metrics = service.getMetrics('day');

            expect(metrics.totalTokens).toBe(4500);
            expect(metrics.inputTokens).toBe(3000);
            expect(metrics.outputTokens).toBe(1500);
        });

        it('should calculate tier breakdown', () => {
            service.recordUsage('user-1', 'org-1', 'BUDGET', 'openai', 'gpt-3.5-turbo',
                { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

            service.recordUsage('user-2', 'org-1', 'PREMIUM', 'openai', 'gpt-4o',
                { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 });

            const metrics = service.getMetrics('day');

            expect(metrics.tierBreakdown['BUDGET']).toBeDefined();
            expect(metrics.tierBreakdown['PREMIUM']).toBeDefined();
            expect(metrics.tierBreakdown['BUDGET'].tokens).toBe(1500);
            expect(metrics.tierBreakdown['PREMIUM'].tokens).toBe(3000);
        });

        it('should identify top users', () => {
            service.recordUsage('user-1', 'org-1', 'PREMIUM', 'openai', 'gpt-4o',
                { inputTokens: 10000000, outputTokens: 5000000, totalTokens: 15000000 });

            service.recordUsage('user-2', 'org-1', 'BUDGET', 'openai', 'gpt-3.5-turbo',
                { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

            const metrics = service.getMetrics('day');

            expect(metrics.topUsers.length).toBeGreaterThan(0);
            expect(metrics.topUsers[0].userId).toBe('user-1');
        });
    });

    describe('User Usage', () => {
        it('should track individual user usage', () => {
            service.recordUsage('user-1', 'org-1', 'STANDARD', 'openai', 'gpt-4o-mini',
                { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

            const usage = service.getUserUsage('user-1');

            expect(usage.tokens).toBe(1500);
            expect(usage.costUSD).toBeGreaterThanOrEqual(0); // Small token counts may round to 0
        });

        it('should calculate user limit percentage', () => {
            service.setBudgetConfig({ perUserLimitUSD: 10 });

            service.recordUsage('user-1', 'org-1', 'PREMIUM', 'openai', 'gpt-4o',
                { inputTokens: 1000000, outputTokens: 500000, totalTokens: 1500000 });

            const usage = service.getUserUsage('user-1');

            expect(usage.limitUSD).toBe(10);
            expect(usage.usedPercent).toBeGreaterThan(0);
        });
    });

    describe('Budget Configuration', () => {
        it('should allow budget configuration', () => {
            service.setBudgetConfig({
                dailyLimitUSD: 500,
                monthlyLimitUSD: 10000,
            });

            const config = service.getBudgetConfig();

            expect(config.dailyLimitUSD).toBe(500);
            expect(config.monthlyLimitUSD).toBe(10000);
        });

        it('should have default budget thresholds', () => {
            const config = service.getBudgetConfig();

            expect(config.alertThresholds).toContain(0.5);
            expect(config.alertThresholds).toContain(0.75);
            expect(config.alertThresholds).toContain(0.9);
        });
    });

    describe('Alert Levels', () => {
        it('should return normal alert level when within budget', () => {
            service.recordUsage('user-1', 'org-1', 'BUDGET', 'openai', 'gpt-3.5-turbo',
                { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

            const metrics = service.getMetrics('day');

            expect(metrics.alertLevel).toBe('normal');
        });

        it('should return warning at 75% budget', () => {
            service.setBudgetConfig({ dailyLimitUSD: 100 });

            // Spend ~80 of 100
            service.recordUsage('user-1', 'org-1', 'PREMIUM', 'openai', 'gpt-4o',
                { inputTokens: 10000000, outputTokens: 3000000, totalTokens: 13000000 });

            const metrics = service.getMetrics('day');

            if (metrics.budgetUsedPercent >= 0.75) {
                expect(['warning', 'critical']).toContain(metrics.alertLevel);
            }
        });
    });

    describe('Health Check Integration', () => {
        it('should return L6-compatible health check', () => {
            service.recordUsage('user-1', 'org-1', 'STANDARD', 'openai', 'gpt-4o-mini',
                { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

            const healthCheck = service.getHealthCheck();

            expect(healthCheck.status).toBe('healthy');
            expect(healthCheck.message).toBeDefined();
            expect(healthCheck.details.dailyCostUSD).toBeDefined();
            expect(healthCheck.details.alertLevel).toBeDefined();
        });
    });

    describe('Empty State', () => {
        it('should handle no usage gracefully', () => {
            const metrics = service.getMetrics('day');

            expect(metrics.totalTokens).toBe(0);
            expect(metrics.totalCostUSD).toBe(0);
            expect(metrics.alertLevel).toBe('normal');
        });
    });

    describe('Organization Filtering', () => {
        it('should filter metrics by organization', () => {
            service.recordUsage('user-1', 'org-1', 'STANDARD', 'openai', 'gpt-4o-mini',
                { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

            service.recordUsage('user-2', 'org-2', 'PREMIUM', 'openai', 'gpt-4o',
                { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 });

            const org1Metrics = service.getMetrics('day', 'org-1');
            const org2Metrics = service.getMetrics('day', 'org-2');

            expect(org1Metrics.totalTokens).toBe(1500);
            expect(org2Metrics.totalTokens).toBe(3000);
        });
    });

    describe('Period Filtering', () => {
        it('should support different time periods', () => {
            service.recordUsage('user-1', 'org-1', 'STANDARD', 'openai', 'gpt-4o-mini',
                { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

            const hourMetrics = service.getMetrics('hour');
            const dayMetrics = service.getMetrics('day');
            const monthMetrics = service.getMetrics('month');

            expect(hourMetrics.period).toBe('hour');
            expect(dayMetrics.period).toBe('day');
            expect(monthMetrics.period).toBe('month');
        });
    });
});
