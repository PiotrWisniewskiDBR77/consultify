/**
 * Organization Metrics Service Tests
 * Tests for the organizationMetricsService which provides business metrics for organizations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database
vi.mock('../../../../server/src/database/Database.js', () => ({
    createDatabase: vi.fn(),
}));

// Mock the logger
vi.mock('../../../../server/src/utils/Logger.js', () => ({
    default: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('OrganizationMetricsService', () => {
    let mockDb: any;
    let service: any;

    beforeEach(async () => {
        // Reset modules before each test
        vi.resetModules();

        // Setup mock database
        mockDb = {
            query: vi.fn(),
        };

        const { createDatabase } = await import('../../../../server/src/database/Database.js');
        (createDatabase as any).mockResolvedValue(mockDb);

        // Import the service after mocks are set up
        const { getOrganizationMetricsService } = await import(
            '../../../../server/src/services/organizationMetricsService.js'
        );
        service = getOrganizationMetricsService();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getOverview', () => {
        it('should return organization overview with active users', async () => {
            const orgId = 'test-org-123';

            // Mock active users query
            mockDb.query
                .mockResolvedValueOnce({ rows: [{ count: 5 }] }) // active users
                .mockResolvedValueOnce({ rows: [{ count: 10 }] }) // total users
                .mockResolvedValueOnce({ rows: [{ status: 'active', plan: 'enterprise', trial_ends_at: null }] }) // org status
                .mockResolvedValueOnce({ rows: [{ seats_used: 5, total_seats: 20 }] }); // seat config

            const result = await service.getOverview(orgId);

            expect(result).toHaveProperty('activeUsers');
            expect(result).toHaveProperty('selfServeUsers');
            expect(result).toHaveProperty('orgStatus');
            expect(result.orgStatus).toBe('enterprise');
        });

        it('should return defaults on database error', async () => {
            const orgId = 'test-org-123';

            // Mock database to throw at createDatabase level to trigger outer catch
            const { createDatabase } = await import('../../../../server/src/database/Database.js');
            (createDatabase as any).mockRejectedValueOnce(new Error('Database connection failed'));

            const result = await service.getOverview(orgId);

            // When outer catch triggers, service returns actual default values
            expect(result).toEqual({
                activeUsers: 0,
                selfServeUsers: 0,
                orgStatus: 'trial',
                conversionTarget: 'Paid',
            });
        });

        it('should calculate days left for trial accounts', async () => {
            const orgId = 'test-org-123';
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 10);

            mockDb.query
                .mockResolvedValueOnce({ rows: [{ count: 5 }] })
                .mockResolvedValueOnce({ rows: [{ count: 10 }] })
                .mockResolvedValueOnce({
                    rows: [{ status: 'trial', plan: 'trial', trial_ends_at: futureDate.toISOString() }],
                })
                .mockResolvedValueOnce({ rows: [{ seats_used: 0, total_seats: 0 }] });

            const result = await service.getOverview(orgId);

            expect(result.orgStatus).toBe('trial');
            expect(result.daysLeft).toBeGreaterThanOrEqual(9);
            expect(result.daysLeft).toBeLessThanOrEqual(11);
        });
    });

    describe('getHelpMetrics', () => {
        it('should return help metrics with playbook completion rates', async () => {
            const orgId = 'test-org-123';

            mockDb.query.mockResolvedValueOnce({
                rows: [
                    { playbook_key: 'getting_started', started: 100, completed: 80 },
                    { playbook_key: 'advanced', started: 50, completed: 25 },
                ],
            });

            const result = await service.getHelpMetrics(orgId);

            expect(result).toHaveProperty('byPlaybook');
            expect(result.byPlaybook).toHaveLength(2);
            expect(result.byPlaybook[0].completionRate).toBe(80);
            expect(result.byPlaybook[1].completionRate).toBe(50);
            expect(result.totalStarted).toBe(150);
            expect(result.totalCompleted).toBe(105);
        });

        it('should return empty metrics when no data', async () => {
            const orgId = 'test-org-123';
            mockDb.query.mockResolvedValueOnce({ rows: [] });

            const result = await service.getHelpMetrics(orgId);

            expect(result).toEqual({
                byPlaybook: [],
                totalStarted: 0,
                totalCompleted: 0,
                overallCompletionRate: 0,
            });
        });
    });

    describe('getTeamMetrics', () => {
        it('should return team metrics with invitation stats', async () => {
            const orgId = 'test-org-123';

            mockDb.query
                .mockResolvedValueOnce({ rows: [{ count: 20 }] }) // total members
                .mockResolvedValueOnce({ rows: [{ count: 15 }] }) // active users
                .mockResolvedValueOnce({ rows: [{ seats_used: 15, total_seats: 25 }] }); // seats

            const result = await service.getTeamMetrics(orgId);

            expect(result).toHaveProperty('invitations');
            expect(result.invitations.sent).toBe(20);
            expect(result.invitations.accepted).toBe(15);
            expect(result.invitations.pending).toBe(5);
            expect(result.invitations.acceptanceRate).toBe(75);
        });

        it('should include seat management when available', async () => {
            const orgId = 'test-org-123';

            mockDb.query
                .mockResolvedValueOnce({ rows: [{ count: 10 }] })
                .mockResolvedValueOnce({ rows: [{ count: 8 }] })
                .mockResolvedValueOnce({ rows: [{ seats_used: 8, total_seats: 20 }] });

            const result = await service.getTeamMetrics(orgId);

            expect(result.seatManagement).toBeDefined();
            expect(result.seatManagement?.seatsUsed).toBe(8);
            expect(result.seatManagement?.totalSeats).toBe(20);
            expect(result.seatManagement?.seatsRemaining).toBe(12);
            expect(result.seatManagement?.utilizationPercent).toBe(40);
        });
    });

    describe('getAIAnalytics', () => {
        it('should return AI analytics with usage stats', async () => {
            const orgId = 'test-org-123';

            mockDb.query
                .mockResolvedValueOnce({
                    rows: [{ total_calls: 1000, success_calls: 950, total_tokens: 500000, avg_latency: 150 }],
                })
                .mockResolvedValueOnce({
                    rows: [
                        { date: '2025-01-20', tokens: 50000 },
                        { date: '2025-01-21', tokens: 60000 },
                    ],
                })
                .mockResolvedValueOnce({
                    rows: [
                        { provider: 'openai', tokens: 300000, success_count: 600, total_count: 620 },
                        { provider: 'anthropic', tokens: 200000, success_count: 350, total_count: 380 },
                    ],
                })
                .mockResolvedValueOnce({
                    rows: [
                        { mode: 'Rate limit exceeded', count: 30 },
                        { mode: 'Timeout', count: 20 },
                    ],
                });

            const result = await service.getAIAnalytics(orgId);

            expect(result).toHaveProperty('successRate');
            expect(result.successRate).toBeCloseTo(0.95, 2);
            expect(result).toHaveProperty('avgResponseTime');
            expect(result.avgResponseTime).toBeCloseTo(0.15, 2);
            expect(result).toHaveProperty('totalTokens');
            expect(result.totalTokens).toBe(500000);
            expect(result).toHaveProperty('estCost');
            expect(result).toHaveProperty('usageTrend');
            expect(result.usageTrend).toHaveLength(2);
            expect(result).toHaveProperty('byProvider');
            expect(result.byProvider).toHaveLength(2);
            expect(result).toHaveProperty('topFailureModes');
            expect(result.topFailureModes).toHaveLength(2);
        });

        it('should return empty defaults when no AI usage data', async () => {
            const orgId = 'test-org-123';

            mockDb.query
                .mockResolvedValueOnce({ rows: [{ total_calls: 0, success_calls: 0, total_tokens: 0, avg_latency: 0 }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            const result = await service.getAIAnalytics(orgId);

            expect(result.successRate).toBe(0);
            expect(result.avgResponseTime).toBe(0);
            expect(result.totalTokens).toBe(0);
            expect(result.usageTrend).toEqual([]);
            expect(result.byProvider).toEqual([]);
            expect(result.topFailureModes).toEqual([]);
        });
    });
});
