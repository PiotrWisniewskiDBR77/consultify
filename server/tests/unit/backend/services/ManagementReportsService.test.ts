/**
 * ManagementReportsService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// Use vi.hoisted to ensure mock data is available to vi.mock
const {
    mockDb,
    mockPMOHealthService,
    mockAIExecutiveReporting,
    mockReportVersionService,
    mockReportAuditService,
    mockManagementReportRepository
} = vi.hoisted(() => ({
    mockDb: {
        get: vi.fn(),
        all: vi.fn(),
        run: vi.fn().mockImplementation((sql: string, params: any[], callback: (err: Error | null) => void) => {
            const result = { lastID: 1, changes: 1 };
            if (callback) callback.call(result, null);
            return result;
        }),
    },
    mockPMOHealthService: {
        getPMOHealthSnapshot: vi.fn().mockResolvedValue({ tasks: { total: 10 }, initiatives: { total: 2 } }),
    },
    mockAIExecutiveReporting: {
        translateToNarrative: vi.fn().mockReturnValue('AI-generated executive summary'),
        generateReport: vi.fn().mockResolvedValue({ narrative: 'AI-generated steering summary', warnings: [] }),
        REPORT_TYPES: { PROJECT_STATUS: 'PROJECT_STATUS' }
    },
    mockReportVersionService: {
        createVersion: vi.fn().mockResolvedValue({ id: 'v1', versionNumber: 1 }),
        getCurrentVersion: vi.fn().mockResolvedValue(1)
    },
    mockReportAuditService: {
        log: vi.fn().mockResolvedValue({ success: true })
    },
    mockManagementReportRepository: {
        getProjectById: vi.fn(),
        getTaskStatistics: vi.fn().mockResolvedValue({ total: 10, completed: 5, inProgress: 3, blocked: 1, overdue: 1 }),
        getInitiativeStatistics: vi.fn().mockResolvedValue({ total: 2, onTrack: 1, atRisk: 1 }),
        getDecisionStatistics: vi.fn().mockResolvedValue({ approved: 2, pending: 1 }),
        getCompletedTasks: vi.fn().mockResolvedValue([]),
        getInProgressTasks: vi.fn().mockResolvedValue([]),
        getBlockedTasks: vi.fn().mockResolvedValue([]),
        getPendingProjectDecisions: vi.fn().mockResolvedValue([]),
        getUpcomingTasks: vi.fn().mockResolvedValue([]),
        getBasicTaskMetrics: vi.fn().mockResolvedValue({ totalTasks: 10, completedTasks: 5, overdueTasks: 1 }),
        getRiskStatistics: vi.fn().mockResolvedValue({ total: 5, critical: 0, high: 1 }),
        getBudgetMetrics: vi.fn().mockResolvedValue(null),
        getCustomKPIs: vi.fn().mockResolvedValue([]),
        getActiveRisksAndIssues: vi.fn().mockResolvedValue([]),
        getBoardDecisions: vi.fn().mockResolvedValue([]),
        getMilestones: vi.fn().mockResolvedValue([]),
        getStageGates: vi.fn().mockResolvedValue([]),
        getReportById: vi.fn(),
        getReports: vi.fn(),
        saveReport: vi.fn().mockResolvedValue({ success: true }),
        updateStatus: vi.fn().mockResolvedValue({ success: true }),
        createShareLink: vi.fn().mockResolvedValue(true),
        getByShareToken: vi.fn(),
        finalizeReport: vi.fn().mockResolvedValue({ success: true })
    }
}));

// Mock the Database module (if needed by other things, though repository is mocked)
vi.mock('../../../../src/database/index.js', () => ({
    getDatabase: () => mockDb,
    default: mockDb
}));

// Mock repositories
vi.mock('../../../../repositories/ManagementReportRepository.js', () => ({
    default: mockManagementReportRepository
}));

// Mock related services
vi.mock('../../../../services/pmoHealthService.js', () => ({ default: mockPMOHealthService }));
vi.mock('../../../../services/aiExecutiveReporting.js', () => ({ default: mockAIExecutiveReporting }));
vi.mock('../../../../services/reportVersionService.js', () => ({ default: mockReportVersionService }));
vi.mock('../../../../services/reportAuditService.js', () => ({ default: mockReportAuditService }));

import ManagementReportsService from '../../../../src/services/managementReportsService.js';

describe('ManagementReportsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateTeamMeetingReport', () => {
        it('should generate a team meeting report for a project', async () => {
            (mockManagementReportRepository.getProjectById as Mock).mockResolvedValue({
                id: 'proj1',
                name: 'Test Project',
                organization_id: 'org1'
            });

            const result = await ManagementReportsService.generateTeamMeetingReport('proj1', {
                userId: 'user1',
                aiEnhancement: true
            });

            expect(result.reportType).toBe('TEAM_MEETING');
            expect(result.projectId).toBe('proj1');
            expect(result.aiNarrative).toBe('AI-generated executive summary');
            expect(mockManagementReportRepository.saveReport).toHaveBeenCalled();
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
                content: { summary: 'Test' },
                ai_narrative: 'AI summary'
            };

            (mockManagementReportRepository.getReportById as Mock).mockResolvedValue(mockReport);

            const result = await ManagementReportsService.getReport('report1');

            expect(result.id).toBe('report1');
            expect(result.content.summary).toBe('Test');
        });
    });

    describe('generateSteeringCommitteeReport', () => {
        it('should generate a steering committee report for a project', async () => {
            (mockManagementReportRepository.getProjectById as Mock).mockResolvedValue({
                id: 'proj1',
                name: 'Test Project',
                organization_id: 'org1'
            });

            const result = await ManagementReportsService.generateSteeringCommitteeReport('proj1', {
                userId: 'user1',
                aiEnhancement: true
            });

            expect(result.reportType).toBe('STEERING_COMMITTEE');
            expect(result.projectId).toBe('proj1');
            expect(result.aiNarrative).toBe('AI-generated steering summary');
        });
    });
});
