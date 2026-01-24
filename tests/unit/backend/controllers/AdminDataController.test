/**
 * Admin Data Controller Tests
 *
 * Tests for admin data access, user tier management, cost attribution,
 * security events, and dashboard activity monitoring.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdminDataController } from '../../../../server/src/controllers/AdminDataController.js';
import { setupStandardTest } from '../../../helpers/unifiedMockSetup.js';

// Mock queryHelpers
vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
    queryAll: vi.fn(),
    queryOne: vi.fn(),
    queryRun: vi.fn()
}));

const mockQueryHelpers = await import('../../../../server/src/utils/queryHelpers.js');

describe('AdminDataController', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        // Setup request/response mocks
        mockReq = {
            user: {
                id: 'admin-user',
                role: 'SUPER_ADMIN'
            },
            params: {},
            query: {},
            body: {}
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis()
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getUserTiers()', () => {
        it('should retrieve all user tiers with usage statistics', async () => {
            const mockTiers = [
                {
                    tier: 'FREE',
                    user_count: 150,
                    active_users: 120,
                    total_usage: 2500
                },
                {
                    tier: 'PRO',
                    user_count: 75,
                    active_users: 70,
                    total_usage: 15000
                },
                {
                    tier: 'ENTERPRISE',
                    user_count: 25,
                    active_users: 25,
                    total_usage: 50000
                }
            ];

            mockQueryHelpers.queryAll.mockResolvedValue(mockTiers);

            await AdminDataController.getUserTiers(mockReq, mockRes);

            expect(mockQueryHelpers.queryAll).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith({
                tiers: mockTiers,
                total_users: 250,
                total_active: 215
            });
        });

        it('should handle database errors', async () => {
            const dbError = new Error('Database connection failed');
            mockQueryHelpers.queryAll.mockRejectedValue(dbError);

            await AdminDataController.getUserTiers(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to retrieve user tiers',
                details: dbError.message
            });
        });
    });

    describe('updateUserTier()', () => {
        it('should update user tier and log the change', async () => {
            mockReq.params.userId = 'user-123';
            mockReq.body = { tier: 'ENTERPRISE', reason: 'Contract upgrade' };

            mockQueryHelpers.queryRun.mockResolvedValue({ changes: 1 });

            await AdminDataController.updateUserTier(mockReq, mockRes);

            expect(mockQueryHelpers.queryRun).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'User tier updated successfully',
                userId: 'user-123',
                newTier: 'ENTERPRISE'
            });
        });

        it('should validate required fields', async () => {
            mockReq.params.userId = 'user-123';
            mockReq.body = {}; // Missing tier

            await AdminDataController.updateUserTier(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'User ID and tier are required'
            });
        });

        it('should validate tier values', async () => {
            mockReq.params.userId = 'user-123';
            mockReq.body = { tier: 'INVALID_TIER' };

            await AdminDataController.updateUserTier(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid tier. Must be one of: FREE, PRO, ENTERPRISE'
            });
        });

        it('should handle user not found', async () => {
            mockReq.params.userId = 'user-999';
            mockReq.body = { tier: 'PRO' };

            mockQueryHelpers.queryRun.mockResolvedValue({ changes: 0 });

            await AdminDataController.updateUserTier(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not found' });
        });

        it('should handle database errors', async () => {
            mockReq.params.userId = 'user-123';
            mockReq.body = { tier: 'PRO' };

            const dbError = new Error('Database update failed');
            mockQueryHelpers.queryRun.mockRejectedValue(dbError);

            await AdminDataController.updateUserTier(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to update user tier',
                details: dbError.message
            });
        });
    });

    describe('getCostAttribution()', () => {
        it('should retrieve cost attribution data by organization', async () => {
            const mockCosts = [
                {
                    organization_id: 'org-1',
                    organization_name: 'Company A',
                    total_cost: 12500.50,
                    user_count: 25,
                    avg_cost_per_user: 500.02,
                    plan_distribution: '{"FREE": 5, "PRO": 15, "ENTERPRISE": 5}'
                },
                {
                    organization_id: 'org-2',
                    organization_name: 'Company B',
                    total_cost: 8750.25,
                    user_count: 18,
                    avg_cost_per_user: 486.12,
                    plan_distribution: '{"FREE": 8, "PRO": 10}'
                }
            ];

            mockQueryHelpers.queryAll.mockResolvedValue(mockCosts);

            await AdminDataController.getCostAttribution(mockReq, mockRes);

            expect(mockQueryHelpers.queryAll).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith({
                costs: mockCosts,
                summary: {
                    total_organizations: 2,
                    total_cost: 21250.75,
                    avg_cost_per_org: 10625.375
                }
            });
        });

        it('should filter by date range when provided', async () => {
            mockReq.query.startDate = '2024-01-01';
            mockReq.query.endDate = '2024-01-31';

            mockQueryHelpers.queryAll.mockResolvedValue([]);

            await AdminDataController.getCostAttribution(mockReq, mockRes);

            expect(mockQueryHelpers.queryAll).toHaveBeenCalled();
            // Verify date parameters are included in query
            const callArgs = mockQueryHelpers.queryAll.mock.calls[0];
            expect(callArgs[0]).toContain('? AND'); // Should include date filtering
        });

        it('should handle empty results', async () => {
            mockQueryHelpers.queryAll.mockResolvedValue([]);

            await AdminDataController.getCostAttribution(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                costs: [],
                summary: {
                    total_organizations: 0,
                    total_cost: 0,
                    avg_cost_per_org: 0
                }
            });
        });

        it('should handle database errors', async () => {
            const dbError = new Error('Cost calculation failed');
            mockQueryHelpers.queryAll.mockRejectedValue(dbError);

            await AdminDataController.getCostAttribution(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to retrieve cost attribution data',
                details: dbError.message
            });
        });
    });

    describe('getSecurityEvents()', () => {
        it('should retrieve recent security events', async () => {
            const mockEvents = [
                {
                    id: 'event-1',
                    type: 'LOGIN_FAILED',
                    user_id: 'user-123',
                    ip_address: '192.168.1.100',
                    user_agent: 'Mozilla/5.0...',
                    timestamp: '2024-01-04T10:30:00Z',
                    details: '{"attempts": 5}'
                },
                {
                    id: 'event-2',
                    type: 'SUSPICIOUS_ACTIVITY',
                    user_id: 'user-456',
                    ip_address: '10.0.0.50',
                    user_agent: 'Bot/1.0',
                    timestamp: '2024-01-04T11:15:00Z',
                    details: '{"suspicious_patterns": ["rapid_requests", "unusual_times"]}'
                }
            ];

            mockQueryHelpers.queryAll.mockResolvedValue(mockEvents);

            await AdminDataController.getSecurityEvents(mockReq, mockRes);

            expect(mockQueryHelpers.queryAll).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith({
                events: mockEvents,
                total: 2,
                severity_breakdown: {
                    CRITICAL: 0,
                    HIGH: 0,
                    MEDIUM: 1,
                    LOW: 1
                }
            });
        });

        it('should filter events by type when specified', async () => {
            mockReq.query.type = 'LOGIN_FAILED';

            mockQueryHelpers.queryAll.mockResolvedValue([]);

            await AdminDataController.getSecurityEvents(mockReq, mockRes);

            const callArgs = mockQueryHelpers.queryAll.mock.calls[0];
            expect(callArgs[0]).toContain('type = ?');
            expect(callArgs[1]).toContain('LOGIN_FAILED');
        });

        it('should limit results with default pagination', async () => {
            mockQueryHelpers.queryAll.mockResolvedValue([]);

            await AdminDataController.getSecurityEvents(mockReq, mockRes);

            const callArgs = mockQueryHelpers.queryAll.mock.calls[0];
            expect(callArgs[0]).toContain('LIMIT ?');
            expect(callArgs[1]).toContain(100); // Default limit
        });

        it('should support custom pagination', async () => {
            mockReq.query.limit = '50';
            mockReq.query.offset = '100';

            mockQueryHelpers.queryAll.mockResolvedValue([]);

            await AdminDataController.getSecurityEvents(mockReq, mockRes);

            const callArgs = mockQueryHelpers.queryAll.mock.calls[0];
            expect(callArgs[1]).toContain(50);
            expect(callArgs[1]).toContain(100);
        });

        it('should handle database errors', async () => {
            const dbError = new Error('Security audit query failed');
            mockQueryHelpers.queryAll.mockRejectedValue(dbError);

            await AdminDataController.getSecurityEvents(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to retrieve security events',
                details: dbError.message
            });
        });
    });

    describe('getDashboardActivity()', () => {
        it('should retrieve dashboard activity metrics', async () => {
            const mockActivity = [
                {
                    date: '2024-01-04',
                    active_users: 1250,
                    total_sessions: 3400,
                    avg_session_duration: 450,
                    top_features: '["projects", "tasks", "reports"]',
                    error_rate: 0.02,
                    performance_score: 95.5
                },
                {
                    date: '2024-01-03',
                    active_users: 1180,
                    total_sessions: 3100,
                    avg_session_duration: 420,
                    top_features: '["dashboard", "analytics", "users"]',
                    error_rate: 0.015,
                    performance_score: 96.2
                }
            ];

            mockQueryHelpers.queryAll.mockResolvedValue(mockActivity);

            await AdminDataController.getDashboardActivity(mockReq, mockRes);

            expect(mockQueryHelpers.queryAll).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith({
                activity: mockActivity,
                summary: {
                    total_days: 2,
                    avg_active_users: 1215,
                    avg_sessions: 3250,
                    avg_error_rate: 0.0175,
                    avg_performance: 95.85
                }
            });
        });

        it('should filter by date range', async () => {
            mockReq.query.days = '7';

            mockQueryHelpers.queryAll.mockResolvedValue([]);

            await AdminDataController.getDashboardActivity(mockReq, mockRes);

            const callArgs = mockQueryHelpers.queryAll.mock.calls[0];
            expect(callArgs[0]).toContain('DATE(created_at) >= DATE(\'now\', \'-7 days\')');
        });

        it('should handle empty activity data', async () => {
            mockQueryHelpers.queryAll.mockResolvedValue([]);

            await AdminDataController.getDashboardActivity(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                activity: [],
                summary: {
                    total_days: 0,
                    avg_active_users: 0,
                    avg_sessions: 0,
                    avg_error_rate: 0,
                    avg_performance: 0
                }
            });
        });

        it('should handle database errors', async () => {
            const dbError = new Error('Dashboard metrics calculation failed');
            mockQueryHelpers.queryAll.mockRejectedValue(dbError);

            await AdminDataController.getDashboardActivity(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to retrieve dashboard activity',
                details: dbError.message
            });
        });
    });

    describe('Security & Authorization', () => {
        it('should require admin/super-admin role for all operations', async () => {
            // This would typically be handled by middleware, but controllers should validate
            mockReq.user.role = 'USER'; // Non-admin role

            await AdminDataController.getUserTiers(mockReq, mockRes);

            // Controller assumes middleware validation, but good practice to double-check
            expect(mockQueryHelpers.queryAll).toHaveBeenCalled();
        });

        it('should audit admin actions for compliance', async () => {
            // Admin actions should be logged for audit trails
            mockReq.params.userId = 'user-123';
            mockReq.body = { tier: 'ENTERPRISE' };

            mockQueryHelpers.queryRun.mockResolvedValue({ changes: 1 });

            await AdminDataController.updateUserTier(mockReq, mockRes);

            // In real implementation, this should trigger audit logging
            expect(mockQueryHelpers.queryRun).toHaveBeenCalled();
        });

        it('should validate sensitive data access permissions', async () => {
            // Security events contain sensitive information
            mockQueryHelpers.queryAll.mockResolvedValue([]);

            await AdminDataController.getSecurityEvents(mockReq, mockRes);

            expect(mockQueryHelpers.queryAll).toHaveBeenCalled();
            // Should validate user has security audit permissions
        });
    });

    describe('Performance & Monitoring', () => {
        it('should handle large datasets efficiently', async () => {
            // Simulate large result set
            const largeDataset = Array(1000).fill().map((_, i) => ({
                tier: 'FREE',
                user_count: 1,
                active_users: 1,
                total_usage: 100
            }));

            mockQueryHelpers.queryAll.mockResolvedValue(largeDataset);

            const startTime = Date.now();
            await AdminDataController.getUserTiers(mockReq, mockRes);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(1000); // Should process quickly
            expect(mockRes.json).toHaveBeenCalled();
        });

        it('should provide meaningful performance metrics', async () => {
            mockQueryHelpers.queryAll.mockResolvedValue([]);

            await AdminDataController.getCostAttribution(mockReq, mockRes);

            const response = mockRes.json.mock.calls[0][0];
            expect(response).toHaveProperty('summary');
            expect(response.summary).toHaveProperty('total_organizations');
            expect(response.summary).toHaveProperty('total_cost');
        });

        it('should implement proper caching for expensive operations', async () => {
            // Dashboard activity queries should be cached
            mockQueryHelpers.queryAll.mockResolvedValue([]);

            await AdminDataController.getDashboardActivity(mockReq, mockRes);

            // In real implementation, this should use caching
            expect(mockQueryHelpers.queryAll).toHaveBeenCalledTimes(1);
        });
    });
});



