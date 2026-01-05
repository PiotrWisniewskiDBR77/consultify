/**
 * ReportAuditService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// Use vi.hoisted to ensure mock data is available to vi.mock
const { mockDb, mockActivityLogService } = vi.hoisted(() => ({
    mockDb: {
        get: vi.fn().mockImplementation((sql, params, callback) => {
            if (callback) callback(null, null);
        }),
        all: vi.fn().mockImplementation((sql, params, callback) => {
            if (callback) callback(null, []);
        }),
        run: vi.fn().mockImplementation((sql: string, params: any[], callback: (err: Error | null) => void) => {
            if (callback) callback.call({ lastID: 1, changes: 1 }, null);
            return { lastID: 1, changes: 1 };
        }),
        exec: vi.fn(),
        serialize: vi.fn(),
        close: vi.fn(),
        query: vi.fn(),
    },
    mockActivityLogService: {
        logActivity: vi.fn()
    }
}));

// Mock the Database module
vi.mock('../../../../src/database/Database.ts', () => ({
    getDatabase: () => mockDb,
    default: mockDb
}));

// Mock ActivityLogService
vi.mock('../../../../src/services/activityLogService.js', () => ({
    default: mockActivityLogService
}));

import ReportAuditService from '../../../../src/services/reportAuditService.js';

describe('ReportAuditService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('log', () => {
        it('should log an action with full details', async () => {
            (mockDb.get as Mock).mockImplementation((sql: string, params: any[], callback: (err: Error | null, row: any) => void) => {
                if (sql.includes('FROM users')) {
                    callback(null, { first_name: 'John', last_name: 'Doe', email: 'john@example.com' });
                } else if (sql.includes('FROM management_reports')) {
                    callback(null, { organization_id: 'org1', project_id: 'p1', title: 'Test' });
                } else {
                    callback(null, null);
                }
            });

            const req = {
                ip: '192.168.1.1',
                headers: { 'user-agent': 'Mozilla/5.0' },
                user: {
                    first_name: 'John',
                    last_name: 'Doe',
                    organization_id: 'org1'
                }
            } as any;

            await ReportAuditService.log(
                'report1',
                'CREATED',
                'user1',
                { reportType: 'TEAM_MEETING' },
                req
            );

            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should handle missing request data gracefully', async () => {
            await ReportAuditService.log('report1', 'VIEWED', 'user1', {}, {});

            expect(mockDb.run).toHaveBeenCalled();
        });
    });

    describe('getAuditLog', () => {
        it('should return filtered audit log entries', async () => {
            (mockDb.get as Mock).mockImplementation((sql: string, params: any[], callback: (err: Error | null, row: any) => void) => {
                callback(null, { total: 50 });
            });

            (mockDb.all as Mock).mockImplementation((sql: string, params: any[], callback: (err: Error | null, rows: any[]) => void) => {
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
    });
});
