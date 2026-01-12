/**
 * Unit Tests for Admin Audit Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Mock database
const mockDb = {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn()
};

// Mock the service with dependency injection
vi.mock('../../../../server/database', () => ({
    default: mockDb,
    run: mockDb.run,
    get: mockDb.get,
    all: mockDb.all
}));

const adminAuditService = require('../../../../server/services/adminAuditService');
adminAuditService.setDependencies({ db: mockDb });

describe('AdminAuditService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('calculateRiskScore', () => {
        it('should return high score for delete_organization', () => {
            const score = adminAuditService.calculateRiskScore('delete_organization');
            expect(score).toBe(100);
        });

        it('should return medium score for create_user', () => {
            const score = adminAuditService.calculateRiskScore('create_user');
            expect(score).toBe(40);
        });

        it('should return low score for view_data', () => {
            const score = adminAuditService.calculateRiskScore('view_data');
            expect(score).toBe(10);
        });

        it('should adjust score based on context', () => {
            const baseScore = adminAuditService.calculateRiskScore('view_data', {});
            const adjustedScore = adminAuditService.calculateRiskScore('view_data', {
                affectedCount: 100,
                unusualHour: true,
                newIpAddress: true
            });
            expect(adjustedScore).toBeGreaterThan(baseScore);
        });

        it('should cap score at 100', () => {
            const score = adminAuditService.calculateRiskScore('delete_organization', {
                affectedCount: 1000,
                unusualHour: true,
                newIpAddress: true,
                isFirstTime: true
            });
            expect(score).toBe(100);
        });
    });

    describe('getRiskLevel', () => {
        it('should return critical for score >= 80', () => {
            expect(adminAuditService.getRiskLevel(80)).toBe('critical');
            expect(adminAuditService.getRiskLevel(100)).toBe('critical');
        });

        it('should return high for score 60-79', () => {
            expect(adminAuditService.getRiskLevel(60)).toBe('high');
            expect(adminAuditService.getRiskLevel(79)).toBe('high');
        });

        it('should return medium for score 30-59', () => {
            expect(adminAuditService.getRiskLevel(30)).toBe('medium');
            expect(adminAuditService.getRiskLevel(59)).toBe('medium');
        });

        it('should return low for score < 30', () => {
            expect(adminAuditService.getRiskLevel(0)).toBe('low');
            expect(adminAuditService.getRiskLevel(29)).toBe('low');
        });
    });

    describe('logAction', () => {
        it('should insert audit log into database', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 1 });

            const log = await adminAuditService.logAction({
                adminId: 'admin-123',
                actionType: 'create_user',
                resourceType: 'user',
                resourceId: 'user-456',
                description: 'Created new user',
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0'
            });

            expect(log).toBeDefined();
            expect(log.adminId).toBe('admin-123');
            expect(log.actionType).toBe('create_user');
            expect(log.riskScore).toBe(40); // create_user base score
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO admin_audit_logs'),
                expect.any(Array)
            );
        });

        it('should store details as JSON', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 1 });

            const details = { field: 'name', oldValue: 'Old', newValue: 'New' };
            await adminAuditService.logAction({
                adminId: 'admin-123',
                actionType: 'modify',
                resourceType: 'user',
                details
            });

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining([JSON.stringify(details)])
            );
        });
    });

    describe('getLogs', () => {
        it('should return paginated logs', async () => {
            mockDb.get.mockResolvedValueOnce({ count: 50 });
            mockDb.all.mockResolvedValueOnce([
                {
                    id: 'log-1',
                    admin_id: 'admin-1',
                    action_type: 'login',
                    risk_score: 5,
                    status: 'success',
                    created_at: '2025-01-02T10:00:00Z',
                    admin_email: 'admin@test.com',
                    first_name: 'Test',
                    last_name: 'Admin',
                    details: '{"method": "POST"}'
                }
            ]);

            const result = await adminAuditService.getLogs({ limit: 10, offset: 0 });

            expect(result.logs).toHaveLength(1);
            expect(result.total).toBe(50);
            expect(result.pageSize).toBe(10);
            expect(result.logs[0].riskLevel).toBe('low');
        });

        it('should filter by action type', async () => {
            mockDb.get.mockResolvedValueOnce({ count: 10 });
            mockDb.all.mockResolvedValueOnce([]);

            await adminAuditService.getLogs({ actionType: 'login' });

            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('l.action_type = ?'),
                expect.arrayContaining(['login'])
            );
        });

        it('should filter by risk level', async () => {
            mockDb.get.mockResolvedValueOnce({ count: 5 });
            mockDb.all.mockResolvedValueOnce([]);

            await adminAuditService.getLogs({ riskLevel: 'critical' });

            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('l.risk_score >= 80'),
                expect.any(Array)
            );
        });

        it('should filter by date range', async () => {
            mockDb.get.mockResolvedValueOnce({ count: 3 });
            mockDb.all.mockResolvedValueOnce([]);

            await adminAuditService.getLogs({ 
                fromDate: '2025-01-01', 
                toDate: '2025-01-31' 
            });

            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('l.created_at >= ?'),
                expect.arrayContaining(['2025-01-01'])
            );
        });
    });

    describe('resolveLog', () => {
        it('should mark log as resolved', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 1 });
            mockDb.get.mockResolvedValueOnce({
                id: 'log-1',
                status: 'resolved',
                resolved_at: '2025-01-02T10:00:00Z'
            });

            const result = await adminAuditService.resolveLog('log-1', 'admin-1', 'Investigation complete');

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining("SET status = 'resolved'"),
                expect.arrayContaining(['admin-1', 'Investigation complete', 'log-1'])
            );
        });
    });

    describe('getStats', () => {
        it('should return aggregated statistics', async () => {
            mockDb.get.mockResolvedValueOnce({
                total_logs: 100,
                critical_count: 5,
                high_count: 15,
                medium_count: 30,
                low_count: 50,
                unresolved_count: 10,
                unique_admins: 8,
                avg_risk_score: 35.5
            });
            mockDb.all.mockResolvedValueOnce([
                { action_type: 'login', count: 40 },
                { action_type: 'create', count: 30 }
            ]);
            mockDb.all.mockResolvedValueOnce([
                { admin_id: 'admin-1', email: 'admin1@test.com', action_count: 50, avg_risk_score: 25 }
            ]);

            const stats = await adminAuditService.getStats('week');

            expect(stats.totalLogs).toBe(100);
            expect(stats.byRiskLevel.critical).toBe(5);
            expect(stats.byRiskLevel.high).toBe(15);
            expect(stats.avgRiskScore).toBe(36); // rounded
            expect(stats.byActionType.login).toBe(40);
        });
    });

    describe('exportToCsv', () => {
        it('should generate CSV content', async () => {
            mockDb.get.mockResolvedValueOnce({ count: 1 });
            mockDb.all.mockResolvedValueOnce([
                {
                    id: 'log-1',
                    admin_id: 'admin-1',
                    action_type: 'login',
                    resource_type: 'authentication',
                    risk_score: 5,
                    status: 'success',
                    created_at: '2025-01-02T10:00:00Z',
                    admin_email: 'admin@test.com',
                    first_name: 'Test',
                    last_name: 'Admin'
                }
            ]);

            const csv = await adminAuditService.exportToCsv({});

            expect(csv).toContain('ID,Admin Email,Action Type');
            expect(csv).toContain('log-1');
            expect(csv).toContain('admin@test.com');
        });
    });

    describe('getRecentHighRisk', () => {
        it('should return high-risk actions', async () => {
            mockDb.all.mockResolvedValueOnce([
                {
                    id: 'log-1',
                    admin_id: 'admin-1',
                    action_type: 'delete_organization',
                    risk_score: 100,
                    admin_email: 'admin@test.com',
                    first_name: 'Test',
                    last_name: 'Admin'
                }
            ]);

            const logs = await adminAuditService.getRecentHighRisk(10);

            expect(logs).toHaveLength(1);
            expect(logs[0].riskLevel).toBe('critical');
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('risk_score >= 60'),
                [10]
            );
        });
    });

    describe('cleanupOldLogs', () => {
        it('should delete old resolved logs', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 50 });

            const count = await adminAuditService.cleanupOldLogs(365);

            expect(count).toBe(50);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM admin_audit_logs'),
                [365]
            );
        });
    });
});




