/**
 * Unit Tests for ReportAuditService
 * 
 * Tests the comprehensive auditing system for Management Reports.
 */

const ReportAuditService = require('../services/reportAuditService');

// Mock database
jest.mock('../database', () => {
    const mockDb = {
        get: jest.fn(),
        all: jest.fn(),
        run: jest.fn()
    };
    return mockDb;
});

// Mock ActivityLogService
jest.mock('../services/activityLogService', () => ({
    logActivity: jest.fn()
}));

const db = require('../database');
const ActivityLogService = require('../services/activityLogService');

describe('ReportAuditService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('log', () => {
        it('should log an action with full details', async () => {
            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1, changes: 1 }, null);
            });

            const req = {
                ip: '192.168.1.1',
                headers: { 'user-agent': 'Mozilla/5.0' },
                user: { 
                    first_name: 'John', 
                    last_name: 'Doe',
                    organization_id: 'org1' 
                }
            };

            await ReportAuditService.log(
                'report1',
                'CREATED',
                'user1',
                { reportType: 'TEAM_MEETING' },
                req
            );

            expect(db.run).toHaveBeenCalled();
            const callParams = db.run.mock.calls[0][1];
            expect(callParams).toContain('report1');
            expect(callParams).toContain('CREATED');
            expect(callParams).toContain('user1');
            expect(callParams).toContain('John Doe');
            expect(callParams).toContain('192.168.1.1');

            expect(ActivityLogService.logActivity).toHaveBeenCalled();
        });

        it('should log action with version ID', async () => {
            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
            });

            await ReportAuditService.log(
                'report1',
                'VERSION_CREATED',
                'user1',
                { versionNumber: 2 },
                {},
                'version2'
            );

            const callParams = db.run.mock.calls[0][1];
            expect(callParams).toContain('version2');
        });

        it('should handle missing request data gracefully', async () => {
            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
            });

            await ReportAuditService.log('report1', 'VIEWED', 'user1', {}, {});

            const callParams = db.run.mock.calls[0][1];
            expect(callParams[7]).toBeNull(); // ip_address
            expect(callParams[8]).toBeNull(); // user_agent
        });
    });

    describe('getAuditLog', () => {
        it('should return filtered audit log entries', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { total: 50 });
            });

            db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { id: 'log1', action: 'CREATED', actor_id: 'user1', created_at: '2025-12-20' },
                    { id: 'log2', action: 'UPDATED', actor_id: 'user1', created_at: '2025-12-21' }
                ]);
            });

            const result = await ReportAuditService.getAuditLog('report1', {
                action: 'CREATED',
                limit: 20,
                offset: 0
            });

            expect(result.entries.length).toBe(2);
            expect(result.total).toBe(50);
        });

        it('should filter by date range', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { total: 10 });
            });

            db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { id: 'log1', action: 'APPROVED', created_at: '2025-12-15' }
                ]);
            });

            const result = await ReportAuditService.getAuditLog('report1', {
                fromDate: '2025-12-01',
                toDate: '2025-12-31',
                limit: 20,
                offset: 0
            });

            expect(result.entries.length).toBe(1);
        });

        it('should filter by actor ID', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { total: 5 });
            });

            db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { id: 'log1', action: 'SUBMITTED', actor_id: 'user2' }
                ]);
            });

            const result = await ReportAuditService.getAuditLog('report1', {
                actorId: 'user2'
            });

            expect(result.entries.length).toBe(1);
            expect(result.entries[0].actor_id).toBe('user2');
        });
    });

    describe('exportAuditLog', () => {
        it('should export audit log as JSON', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { id: 'log1', action: 'CREATED', actor_name: 'John Doe', created_at: '2025-12-20' },
                    { id: 'log2', action: 'APPROVED', actor_name: 'Jane Smith', created_at: '2025-12-21' }
                ]);
            });

            const result = await ReportAuditService.exportAuditLog('report1', 'json');

            expect(result.format).toBe('json');
            expect(result.data).toContain('CREATED');
            expect(result.data).toContain('APPROVED');
        });

        it('should export audit log as CSV', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { 
                        id: 'log1', 
                        action: 'CREATED', 
                        actor_name: 'John Doe',
                        details: JSON.stringify({ reportType: 'TEAM_MEETING' }),
                        ip_address: '192.168.1.1',
                        created_at: '2025-12-20T10:00:00Z'
                    }
                ]);
            });

            const result = await ReportAuditService.exportAuditLog('report1', 'csv');

            expect(result.format).toBe('csv');
            expect(result.data).toContain('id,action,actor_name');
            expect(result.data).toContain('CREATED');
            expect(result.data).toContain('John Doe');
        });
    });

    describe('getActivitySummary', () => {
        it('should return aggregated activity summary', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('MIN(created_at)')) {
                    callback(null, { 
                        first_activity: '2025-12-01',
                        last_activity: '2025-12-28',
                        total_actions: 25
                    });
                } else if (sql.includes('FROM management_reports WHERE id')) {
                    callback(null, { id: 'report1', status: 'APPROVED' });
                }
            });

            db.all.mockImplementation((sql, params, callback) => {
                if (sql.includes('GROUP BY action')) {
                    callback(null, [
                        { action: 'CREATED', count: 1 },
                        { action: 'UPDATED', count: 10 },
                        { action: 'VIEWED', count: 8 },
                        { action: 'APPROVED', count: 2 },
                        { action: 'EXPORTED', count: 4 }
                    ]);
                } else if (sql.includes('GROUP BY actor_id')) {
                    callback(null, [
                        { actor_id: 'user1', actor_name: 'John Doe', count: 15 },
                        { actor_id: 'user2', actor_name: 'Jane Smith', count: 10 }
                    ]);
                }
            });

            const result = await ReportAuditService.getActivitySummary('report1');

            expect(result.totalActions).toBe(25);
            expect(result.firstActivity).toBe('2025-12-01');
            expect(result.lastActivity).toBe('2025-12-28');
            expect(result.actionBreakdown.length).toBe(5);
            expect(result.topActors.length).toBe(2);
        });
    });

    describe('logStandardActions', () => {
        beforeEach(() => {
            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
            });
        });

        it('should log CREATED action', async () => {
            await ReportAuditService.log('report1', 'CREATED', 'user1', { reportType: 'TEAM_MEETING' });

            expect(db.run).toHaveBeenCalled();
            const sql = db.run.mock.calls[0][0];
            expect(sql).toContain('INSERT INTO management_report_audit_log');
        });

        it('should log SUBMITTED action', async () => {
            await ReportAuditService.log('report1', 'SUBMITTED', 'user1', { submittedFor: 'approval' });

            expect(db.run).toHaveBeenCalled();
        });

        it('should log APPROVED action', async () => {
            await ReportAuditService.log('report1', 'APPROVED', 'user1', { level: 1, comment: 'LGTM' });

            expect(db.run).toHaveBeenCalled();
        });

        it('should log REJECTED action', async () => {
            await ReportAuditService.log('report1', 'REJECTED', 'user1', { level: 1, reason: 'Needs revision' });

            expect(db.run).toHaveBeenCalled();
        });

        it('should log FINALIZED action', async () => {
            await ReportAuditService.log('report1', 'FINALIZED', 'user1', { integrityHash: 'abc123' });

            expect(db.run).toHaveBeenCalled();
        });

        it('should log SHARED action', async () => {
            await ReportAuditService.log('report1', 'SHARED', 'user1', { shareToken: 'token123', expiresAt: '2025-01-05' });

            expect(db.run).toHaveBeenCalled();
        });

        it('should log VIEWED action', async () => {
            await ReportAuditService.log('report1', 'VIEWED', 'user1', { via: 'share_link' });

            expect(db.run).toHaveBeenCalled();
        });

        it('should log EXPORTED action', async () => {
            await ReportAuditService.log('report1', 'EXPORTED', 'user1', { format: 'PDF' });

            expect(db.run).toHaveBeenCalled();
        });
    });

    describe('getRecentActivityForDashboard', () => {
        it('should return recent activity for organization dashboard', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { 
                        id: 'log1', 
                        report_id: 'r1',
                        report_title: 'Q4 Report',
                        action: 'APPROVED',
                        actor_name: 'John Doe',
                        created_at: '2025-12-28T10:00:00Z'
                    },
                    {
                        id: 'log2',
                        report_id: 'r2',
                        report_title: 'Weekly Update',
                        action: 'CREATED',
                        actor_name: 'Jane Smith',
                        created_at: '2025-12-27T15:00:00Z'
                    }
                ]);
            });

            const result = await ReportAuditService.getRecentActivityForDashboard('org1', 10);

            expect(result.length).toBe(2);
            expect(result[0].action).toBe('APPROVED');
            expect(result[1].action).toBe('CREATED');
        });
    });

    describe('getActionsByTimeRange', () => {
        it('should return actions grouped by time period', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { date: '2025-12-26', count: 5 },
                    { date: '2025-12-27', count: 8 },
                    { date: '2025-12-28', count: 12 }
                ]);
            });

            const result = await ReportAuditService.getActionsByTimeRange(
                'report1',
                '2025-12-20',
                '2025-12-28',
                'day'
            );

            expect(result.length).toBe(3);
            expect(result[2].count).toBe(12);
        });
    });
});











