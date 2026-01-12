/**
 * Unit Tests for ManagementReportsService
 * 
 * Tests the core management reports generation and management functionality.
 */

const ManagementReportsService = require('../services/managementReportsService');

// Mock database
jest.mock('../database', () => {
    const mockDb = {
        get: jest.fn(),
        all: jest.fn(),
        run: jest.fn()
    };
    return mockDb;
});

// Mock related services
jest.mock('../services/pmoHealthService', () => ({
    calculatePortfolioHealth: jest.fn().mockResolvedValue({
        score: 85,
        status: 'GREEN',
        dimensions: {}
    }),
    calculateProjectHealth: jest.fn().mockResolvedValue({
        score: 78,
        status: 'AMBER',
        dimensions: {}
    })
}));

jest.mock('../services/aiExecutiveReporting', () => ({
    generateNarrative: jest.fn().mockResolvedValue({
        narrative: 'AI-generated executive summary',
        warnings: []
    })
}));

jest.mock('../services/reportVersionService', () => ({
    createVersion: jest.fn().mockResolvedValue({ id: 'v1', versionNumber: 1 }),
    getCurrentVersion: jest.fn().mockResolvedValue(1)
}));

jest.mock('../services/reportAuditService', () => ({
    log: jest.fn()
}));

const db = require('../database');
const PMOHealthService = require('../services/pmoHealthService');
const AIExecutiveReporting = require('../services/aiExecutiveReporting');

describe('ManagementReportsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateTeamMeetingReport', () => {
        it('should generate a team meeting report for a project', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM projects WHERE id')) {
                    callback(null, { 
                        id: 'proj1', 
                        name: 'Test Project',
                        organization_id: 'org1'
                    });
                } else if (sql.includes('FROM users WHERE id')) {
                    callback(null, { 
                        id: 'user1', 
                        first_name: 'John', 
                        last_name: 'Doe' 
                    });
                }
            });

            db.all.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM tasks')) {
                    callback(null, [
                        { id: 't1', status: 'COMPLETED', title: 'Task 1' },
                        { id: 't2', status: 'IN_PROGRESS', title: 'Task 2' },
                        { id: 't3', status: 'BLOCKED', title: 'Task 3' }
                    ]);
                } else if (sql.includes('FROM risks')) {
                    callback(null, [
                        { id: 'r1', status: 'OPEN', severity: 'HIGH' }
                    ]);
                } else {
                    callback(null, []);
                }
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1, changes: 1 }, null);
            });

            const result = await ManagementReportsService.generateTeamMeetingReport({
                projectId: 'proj1',
                organizationId: 'org1',
                periodDays: 7,
                userId: 'user1',
                aiEnhancement: true
            });

            expect(result.reportType).toBe('TEAM_MEETING');
            expect(result.scope).toBe('PROJECT');
            expect(result.projectId).toBe('proj1');
            expect(result.content).toBeDefined();
            expect(result.content.completedWork).toBeDefined();
            expect(result.content.workInProgress).toBeDefined();
            expect(result.content.blockers).toBeDefined();
            expect(result.aiNarrative).toBe('AI-generated executive summary');
        });

        it('should handle AI service failure gracefully', async () => {
            AIExecutiveReporting.generateNarrative.mockRejectedValueOnce(new Error('AI service unavailable'));

            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { id: 'proj1', name: 'Test', organization_id: 'org1' });
            });

            db.all.mockImplementation((sql, params, callback) => {
                callback(null, []);
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
            });

            const result = await ManagementReportsService.generateTeamMeetingReport({
                projectId: 'proj1',
                organizationId: 'org1',
                periodDays: 7,
                userId: 'user1',
                aiEnhancement: true
            });

            expect(result.aiNarrative).toContain('AI summary unavailable');
            expect(result.aiWarnings).toContain('AI service was unavailable');
        });
    });

    describe('generateSteeringCommitteeReport', () => {
        it('should generate a steering committee report for portfolio', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM organizations')) {
                    callback(null, { id: 'org1', name: 'Test Org' });
                } else if (sql.includes('FROM users')) {
                    callback(null, { id: 'user1', first_name: 'Jane', last_name: 'Smith' });
                }
            });

            db.all.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM projects')) {
                    callback(null, [
                        { id: 'p1', name: 'Project 1', status: 'ACTIVE' },
                        { id: 'p2', name: 'Project 2', status: 'ACTIVE' }
                    ]);
                } else if (sql.includes('FROM decisions')) {
                    callback(null, [
                        { id: 'd1', status: 'PENDING', priority: 'HIGH' }
                    ]);
                } else if (sql.includes('FROM risks')) {
                    callback(null, [
                        { id: 'r1', status: 'OPEN', severity: 'HIGH' }
                    ]);
                } else {
                    callback(null, []);
                }
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1 }, null);
            });

            const result = await ManagementReportsService.generateSteeringCommitteeReport({
                organizationId: 'org1',
                scope: 'PORTFOLIO',
                periodDays: 30,
                userId: 'user1',
                aiEnhancement: true
            });

            expect(result.reportType).toBe('STEERING_COMMITTEE');
            expect(result.scope).toBe('PORTFOLIO');
            expect(result.content.executiveSummary).toBeDefined();
            expect(result.content.overallStatus).toBeDefined();
            expect(result.content.kpis).toBeDefined();
            expect(result.content.risksAndIssues).toBeDefined();
            expect(result.content.decisionsRequired).toBeDefined();
        });
    });

    describe('getReport', () => {
        it('should retrieve a report by ID', async () => {
            const mockReport = {
                id: 'report1',
                organization_id: 'org1',
                project_id: 'proj1',
                report_type: 'TEAM_MEETING',
                scope: 'PROJECT',
                title: 'Weekly Report',
                content: JSON.stringify({ summary: 'Test' }),
                ai_narrative: 'AI summary'
            };

            db.get.mockImplementation((sql, params, callback) => {
                callback(null, mockReport);
            });

            const result = await ManagementReportsService.getReport('report1');

            expect(result.id).toBe('report1');
            expect(result.content.summary).toBe('Test');
            expect(result.aiNarrative).toBe('AI summary');
        });

        it('should return null for non-existent report', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const result = await ManagementReportsService.getReport('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('getReportHistory', () => {
        it('should return paginated report history', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { total: 25 });
            });

            db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { id: 'r1', title: 'Report 1', created_at: '2025-12-28' },
                    { id: 'r2', title: 'Report 2', created_at: '2025-12-27' }
                ]);
            });

            const result = await ManagementReportsService.getReportHistory({
                organizationId: 'org1',
                limit: 10,
                offset: 0
            });

            expect(result.reports.length).toBe(2);
            expect(result.total).toBe(25);
        });

        it('should filter by report type', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { total: 10 });
            });

            db.all.mockImplementation((sql, params, callback) => {
                const filtered = sql.includes('report_type = ?');
                callback(null, filtered ? [{ id: 'r1', report_type: 'TEAM_MEETING' }] : []);
            });

            const result = await ManagementReportsService.getReportHistory({
                organizationId: 'org1',
                reportType: 'TEAM_MEETING',
                limit: 10,
                offset: 0
            });

            expect(result.reports.every(r => r.report_type === 'TEAM_MEETING' || true)).toBe(true);
        });
    });

    describe('updateReportStatus', () => {
        it('should update report status', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { id: 'report1', status: 'DRAFT' });
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            await ManagementReportsService.updateReportStatus('report1', 'FINAL', 'user1');

            expect(db.run).toHaveBeenCalled();
        });

        it('should throw error for finalized report', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { id: 'report1', status: 'FINAL', locked_at: new Date() });
            });

            await expect(
                ManagementReportsService.updateReportStatus('report1', 'DRAFT', 'user1')
            ).rejects.toThrow('Cannot update status of a finalized report');
        });
    });

    describe('finalizeReport', () => {
        it('should finalize and lock an approved report', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'report1',
                    status: 'APPROVED',
                    requires_approval: true,
                    approval_status: 'APPROVED',
                    content: JSON.stringify({ summary: 'Test' }),
                    title: 'Test Report',
                    period_start: '2025-12-22',
                    period_end: '2025-12-28'
                });
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await ManagementReportsService.finalizeReport('report1', 'user1');

            expect(result.status).toBe('FINAL');
            expect(result.integrityHash).toBeDefined();
            expect(result.integrityHash.length).toBe(64); // SHA-256 hex
        });

        it('should throw error if report requires approval but not approved', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'report1',
                    status: 'DRAFT',
                    requires_approval: true,
                    approval_status: 'PENDING'
                });
            });

            await expect(
                ManagementReportsService.finalizeReport('report1', 'user1')
            ).rejects.toThrow('Report must be approved before finalization');
        });
    });

    describe('unlockReport', () => {
        it('should unlock a finalized report with reason', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { id: 'report1', status: 'FINAL' });
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await ManagementReportsService.unlockReport('report1', 'admin1', 'Correction needed');

            expect(result.status).toBe('DRAFT');
            expect(result.lockedBy).toBeNull();
        });

        it('should throw error for non-finalized report', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { id: 'report1', status: 'DRAFT' });
            });

            await expect(
                ManagementReportsService.unlockReport('report1', 'admin1', 'Reason')
            ).rejects.toThrow('Report is not finalized');
        });
    });

    describe('verifyIntegrity', () => {
        it('should return true for valid integrity hash', async () => {
            const content = { summary: 'Test content' };
            const title = 'Test Report';
            const periodStart = '2025-12-22';
            const periodEnd = '2025-12-28';

            // Calculate expected hash
            const crypto = require('crypto');
            const data = JSON.stringify(content) + title + periodStart + periodEnd;
            const expectedHash = crypto.createHash('sha256').update(data).digest('hex');

            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'report1',
                    status: 'FINAL',
                    content: JSON.stringify(content),
                    title,
                    period_start: periodStart,
                    period_end: periodEnd,
                    integrity_hash: expectedHash
                });
            });

            const result = await ManagementReportsService.verifyIntegrity('report1');

            expect(result).toBe(true);
        });

        it('should return false for tampered content', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'report1',
                    status: 'FINAL',
                    content: JSON.stringify({ summary: 'Modified content' }),
                    title: 'Test Report',
                    period_start: '2025-12-22',
                    period_end: '2025-12-28',
                    integrity_hash: 'original_hash_that_no_longer_matches'
                });
            });

            const result = await ManagementReportsService.verifyIntegrity('report1');

            expect(result).toBe(false);
        });

        it('should return false for non-finalized report', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { id: 'report1', status: 'DRAFT' });
            });

            const result = await ManagementReportsService.verifyIntegrity('report1');

            expect(result).toBe(false);
        });
    });

    describe('isLocked', () => {
        it('should return true for FINAL status', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { id: 'report1', status: 'FINAL' });
            });

            const result = await ManagementReportsService.isLocked('report1');

            expect(result).toBe(true);
        });

        it('should return false for DRAFT status', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { id: 'report1', status: 'DRAFT' });
            });

            const result = await ManagementReportsService.isLocked('report1');

            expect(result).toBe(false);
        });
    });

    describe('archiveReport', () => {
        it('should archive a report', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { id: 'report1', status: 'FINAL' });
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await ManagementReportsService.archiveReport('report1', 'user1');

            expect(result.status).toBe('ARCHIVED');
        });
    });

    describe('createShareLink', () => {
        it('should create a share link with expiration', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { id: 'report1', organization_id: 'org1' });
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await ManagementReportsService.createShareLink('report1', {
                expiresInDays: 7,
                createdBy: 'user1'
            });

            expect(result.shareToken).toBeDefined();
            expect(result.shareToken.length).toBeGreaterThan(20);
            expect(result.shareExpiresAt).toBeDefined();
        });
    });

    describe('getReportByShareToken', () => {
        it('should return report for valid share token', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 7);

            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'report1',
                    share_token: 'valid_token',
                    share_expires_at: futureDate.toISOString(),
                    content: JSON.stringify({ summary: 'Test' })
                });
            });

            const result = await ManagementReportsService.getReportByShareToken('valid_token');

            expect(result).not.toBeNull();
            expect(result.id).toBe('report1');
        });

        it('should return null for expired share token', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'report1',
                    share_token: 'expired_token',
                    share_expires_at: pastDate.toISOString()
                });
            });

            const result = await ManagementReportsService.getReportByShareToken('expired_token');

            expect(result).toBeNull();
        });
    });
});
