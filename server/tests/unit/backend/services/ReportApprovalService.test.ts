/**
 * ReportApprovalService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// Use vi.hoisted to ensure mock data is available to vi.mock
const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        get: vi.fn(),
        all: vi.fn(),
        run: vi.fn().mockImplementation((sql: string, params: any[], callback: (err: Error | null) => void) => {
            if (callback) callback.call({ lastID: 1, changes: 1 }, null);
            return { lastID: 1, changes: 1 };
        }),
        exec: vi.fn(),
        serialize: vi.fn(),
        close: vi.fn(),
        query: vi.fn(),
    }
}));

// Mock the Database module
vi.mock('../../../../src/database/Database.ts', () => ({
    getDatabase: () => mockDb,
    default: mockDb
}));

import ReportApprovalService from '../../../../src/services/reportApprovalService.js';

describe('ReportApprovalService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('initializeApprovalWorkflow', () => {
        it('should create approval records for each level', async () => {
            (mockDb.get as Mock).mockImplementation((sql: string, params: any[], callback: (err: Error | null, row: any) => void) => {
                if (sql.includes('FROM management_reports')) {
                    callback(null, { id: 'report1', organization_id: 'org1' });
                } else if (sql.includes('FROM management_report_versions')) {
                    callback(null, { id: 'version1' });
                } else {
                    callback(null, null);
                }
            });

            const config = {
                levels: [
                    { level: 1, role: 'MANAGER', required: true, slaHours: 24 },
                    { level: 2, role: 'PMO_LEAD', required: true, slaHours: 48 }
                ]
            };

            const result = await ReportApprovalService.initializeApprovalWorkflow('report1', config, 'user1');

            expect(result.reportId).toBe('report1');
            expect(result.totalLevels).toBe(2);
        });
    });

    describe('approve', () => {
        it('should approve at current level and advance workflow', async () => {
            (mockDb.get as Mock).mockImplementation((sql: string, params: any[], callback: (err: Error | null, row: any) => void) => {
                if (sql.includes('FROM management_reports')) {
                    callback(null, {
                        id: 'report1',
                        approval_status: 'PENDING',
                        organization_id: 'org1'
                    });
                } else if (sql.includes('FROM users')) {
                    callback(null, { role: 'ADMIN', project_role: 'ADMIN' });
                } else if (sql.includes('FROM management_report_approvals') && sql.includes('PENDING')) {
                    if (sql.includes('approval_level >')) {
                        callback(null, null);
                    } else {
                        callback(null, {
                            id: 'approval1',
                            approval_level: 1,
                            required_role: 'MANAGER'
                        });
                    }
                } else {
                    callback(null, null);
                }
            });

            const result = await ReportApprovalService.approve('report1', 'user1', 'LGTM');

            expect(result.success).toBe(true);
            expect(result.approvedLevel).toBe(1);
        });
    });

    describe('getApprovalStatus', () => {
        it('should return complete approval chain', async () => {
            (mockDb.get as Mock).mockImplementation((sql: string, params: any[], callback: (err: Error | null, row: any) => void) => {
                callback(null, {
                    id: 'report1',
                    approval_status: 'PENDING',
                    organization_id: 'org1'
                });
            });

            (mockDb.all as Mock).mockImplementation((sql: string, params: any[], callback: (err: Error | null, rows: any[]) => void) => {
                callback(null, [
                    { id: 'a1', approval_level: 1, required_role: 'MANAGER', status: 'APPROVED' },
                    { id: 'a2', approval_level: 2, required_role: 'PMO_LEAD', status: 'PENDING' }
                ]);
            });

            const result = await ReportApprovalService.getApprovalStatus('report1');

            expect(result.totalLevels).toBe(2);
            expect(result.levels.length).toBe(2);
            expect(result.overallStatus).toBe('PENDING');
        });
    });
});
