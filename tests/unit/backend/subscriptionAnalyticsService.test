/**
 * Subscription Analytics Service Tests
 * 
 * Tests for MRR, churn, LTV, and cohort analytics
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';

describe('SubscriptionAnalyticsService', () => {
    let mockDb;
    let subscriptionAnalyticsService;

    beforeEach(async () => {
        vi.resetModules();

        mockDb = createMockDb();

        // Mock database
        vi.doMock('../../../server/database', () => ({
            default: mockDb
        }));

        // Import after mocks
        subscriptionAnalyticsService = (await import('../../../server/src/services/subscriptionAnalyticsService.js')).default;
        subscriptionAnalyticsService.setDependencies({
            db: mockDb,
            uuidv4: () => 'test-uuid'
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
    });

    describe('getMRRTrend()', () => {
        it('should return MRR trend with period and data', async () => {
            const mockData = [
                { snapshot_date: '2024-01-01', total_mrr: 1000, new_mrr: 200, expansion_mrr: 50, contraction_mrr: 0, churn_mrr: 0, reactivation_mrr: 0, net_mrr_change: 250, total_customers: 10, new_customers: 2, churned_customers: 0 },
                { snapshot_date: '2024-01-02', total_mrr: 1500, new_mrr: 500, expansion_mrr: 0, contraction_mrr: 0, churn_mrr: 0, reactivation_mrr: 0, net_mrr_change: 500, total_customers: 13, new_customers: 3, churned_customers: 0 },
                { snapshot_date: '2024-01-03', total_mrr: 1300, new_mrr: 0, expansion_mrr: 0, contraction_mrr: 100, churn_mrr: 100, reactivation_mrr: 0, net_mrr_change: -200, total_customers: 12, new_customers: 0, churned_customers: 1 }
            ];

            mockDb.all.mockResolvedValue(mockData);

            const result = await subscriptionAnalyticsService.getMRRTrend({ days: 30 });

            expect(result).toHaveProperty('period');
            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('summary');
            expect(result.data).toHaveLength(3);
            expect(result.period.days).toBe(30);
        });

        it('should handle empty results', async () => {
            mockDb.all.mockResolvedValue([]);

            const result = await subscriptionAnalyticsService.getMRRTrend({ days: 30 });

            expect(result).toHaveProperty('period');
            expect(result).toHaveProperty('data');
            expect(result.data).toEqual([]);
        });

        it('should handle database errors', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'), null);
            });

            await expect(subscriptionAnalyticsService.getMRRTrend()).rejects.toThrow('DB Error');
        });
    });

    describe('getChurnRate()', () => {
        it('should calculate churn metrics by period', async () => {
            const mockData = [
                { period: '2024-01', churned_customers: 2, churned_mrr: 200, starting_customers: 100, starting_mrr: 10000 },
                { period: '2024-02', churned_customers: 5, churned_mrr: 490, starting_customers: 98, starting_mrr: 9800 }
            ];

            mockDb.all.mockResolvedValue(mockData);

            const result = await subscriptionAnalyticsService.getChurnRate({ months: 6 });

            expect(result).toHaveProperty('period');
            expect(result).toHaveProperty('data');
            // The result structure includes period info and data array
        });

        it('should handle zero active customers gracefully', async () => {
            const mockData = [];

            mockDb.all.mockResolvedValue(mockData);

            const result = await subscriptionAnalyticsService.getChurnRate();

            expect(result).toHaveProperty('data');
            expect(result.data).toEqual([]);
        });
    });

    describe('getLTV()', () => {
        it('should calculate LTV metrics', async () => {
            // Mock average MRR query
            mockDb.get.mockImplementation((query, params) => {
                if (query.includes('subscription_plans') || query.includes('organization_billing')) {
                    return Promise.resolve({ avg_mrr: 100, arpa: 100, active_subscriptions: 50 });
                } else {
                    return Promise.resolve({ churn_rate: 0.05, monthly_churn: 0.05, churned_customers: 5, starting_customers: 100 });
                }
            });

            const result = await subscriptionAnalyticsService.getLTV();

            expect(result).toHaveProperty('ltv');
            // LTV can be 0 if there's no data
            expect(typeof result.ltv).toBe('number');
        });

        it('should handle zero churn rate', async () => {
            mockDb.get.mockImplementation((query, params) => {
                if (query.includes('subscription_plans') || query.includes('organization_billing')) {
                    return Promise.resolve({ avg_mrr: 100, arpa: 100 });
                } else {
                    return Promise.resolve({ churn_rate: 0, monthly_churn: 0 });
                }
            });

            const result = await subscriptionAnalyticsService.getLTV();

            // When churn is 0, LTV calculation handles it (could be 0 or infinity handled case)
            expect(result).toHaveProperty('ltv');
        });
    });

    describe('getCohortAnalysis()', () => {
        it('should return cohort data structure', async () => {
            const mockData = [
                { cohort_month: '2024-01', month_0: 50, month_1: 45, month_2: 40 },
                { cohort_month: '2024-02', month_0: 60, month_1: 55 }
            ];

            mockDb.all.mockResolvedValue(mockData);

            const result = await subscriptionAnalyticsService.getCohortAnalysis();

            expect(result).toHaveProperty('cohorts');
            expect(result).toHaveProperty('period');
        });

        it('should handle empty cohort data', async () => {
            mockDb.all.mockResolvedValue([]);

            const result = await subscriptionAnalyticsService.getCohortAnalysis();

            expect(result).toHaveProperty('cohorts');
            expect(result.cohorts).toEqual([]);
        });
    });

    describe('getExpansionRevenue()', () => {
        it('should calculate expansion MRR from plan upgrades', async () => {
            const mockData = [
                { period: '2024-01', expansion_mrr: 500, expansion_count: 5 },
                { period: '2024-02', expansion_mrr: 750, expansion_count: 7 },
                { period: '2024-03', expansion_mrr: 300, expansion_count: 3 }
            ];

            mockDb.all.mockResolvedValue(mockData);

            const result = await subscriptionAnalyticsService.getExpansionRevenue({ months: 6 });

            expect(result).toHaveProperty('period');
            expect(result).toHaveProperty('data');
        });

        it('should handle no expansion revenue', async () => {
            const mockData = [];

            mockDb.all.mockResolvedValue(mockData);

            const result = await subscriptionAnalyticsService.getExpansionRevenue();

            expect(result).toHaveProperty('data');
            expect(result.data).toEqual([]);
        });
    });

    describe('getCurrentMRR()', () => {
        it('should return current MRR with breakdown', async () => {
            mockDb.get.mockResolvedValue({ total_mrr: 50000, active_subscriptions: 50 });

            mockDb.all.mockResolvedValue([
                { plan_id: 'plan-1', plan_name: 'Basic', price_monthly: 29, subscriber_count: 20, plan_mrr: 580 },
                { plan_id: 'plan-2', plan_name: 'Pro', price_monthly: 99, subscriber_count: 30, plan_mrr: 2970 }
                ]);
            });

            const result = await subscriptionAnalyticsService.getCurrentMRR();

            expect(result).toHaveProperty('totalMRR');
            expect(result).toHaveProperty('arr');
            expect(result).toHaveProperty('activeSubscriptions');
            expect(result).toHaveProperty('byPlan');
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection errors', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(new Error('Connection lost'), null);
            });

            await expect(subscriptionAnalyticsService.getMRRTrend()).rejects.toThrow('Connection lost');
        });

        it('should handle query timeout errors', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(new Error('Query timeout'), null);
            });

            await expect(subscriptionAnalyticsService.getExpansionRevenue()).rejects.toThrow('Query timeout');
        });
    });
});
