import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

// Mock DbPromise
import DbPromise from '../../../server/src/utils/DbPromise.ts';
vi.mock('../../../server/src/utils/DbPromise.ts', () => ({
    default: {
        all: vi.fn(),
        get: vi.fn(),
        run: vi.fn(),
        transaction: vi.fn()
    }
}));

// Mock BudgetService (dynamic import in source)
vi.mock('../../../server/src/services/budgetService.js', () => ({
    default: {
        getBudget: vi.fn().mockResolvedValue({
            totals: { consumedPercent: 50, isOverBudget: false, remaining: 1000 }
        })
    }
}));

// Import the service
import StatusReportService from '../../../server/src/services/statusReportService.ts';

/**
 * Status Report Service Tests
 * Tests for executive reporting and status aggregation
 * CRITICAL FOR ENTERPRISE BUSINESS INTELLIGENCE
 */
describe('StatusReportService', () => {
    let mocks;
    const testUserId = 'user-123';
    const testOrgId = 'org-123';
    const testInitId = 'init-123';

    beforeEach(() => {
        vi.clearAllMocks();

        mocks = setupStandardTest();

        // Inject dependencies using unified pattern
        StatusReportService.setDependencies({ db: mocks.db });

        // Default mock responses
        vi.mocked(DbPromise.all).mockResolvedValue([]);
        vi.mocked(DbPromise.get).mockResolvedValue(null);
        vi.mocked(DbPromise.run).mockResolvedValue({ changes: 1, lastID: 1, success: true });
    });

    describe('calculatePeriod', () => {
        it('should calculate weekly period correctly', () => {
            const testDate = new Date('2024-12-25'); // Wednesday
            const result = StatusReportService.calculatePeriod('WEEKLY', testDate);

            expect(result.periodLabel).toMatch(/Week \d+, 2024/);
            expect(new Date(result.periodStart).getDay()).toBe(1); // Monday
            expect(new Date(result.periodEnd).getDay()).toBe(0); // Sunday
        });

        it('should calculate monthly period correctly', () => {
            const testDate = new Date('2024-12-15');
            const result = StatusReportService.calculatePeriod('MONTHLY', testDate);

            expect(result.periodLabel).toBe('December 2024');
            expect(new Date(result.periodStart).getDate()).toBe(1);
            expect(new Date(result.periodEnd).getDate()).toBe(31);
        });

        it('should calculate quarterly period correctly', () => {
            const testDate = new Date('2024-11-15'); // Q4
            const result = StatusReportService.calculatePeriod('QUARTERLY', testDate);

            expect(result.periodLabel).toBe('Q4 2024');
        });
    });

    describe('calculateSectionStatuses', () => {
        it('should return GREEN schedule status when no blocked tasks', () => {
            const data = {
                tasksCompleted: 10,
                tasksTotal: 20,
                tasksBlocked: 0,
                tasksInProgress: 5,
                progress: 50,
                tasksCompletedThisPeriod: 3,
                isOverBudget: false,
                budgetConsumedPercent: 50,
                openRisks: 0,
                highPriorityItems: 0,
                status: 'EXECUTING'
            };

            const sections = StatusReportService.calculateSectionStatuses(data);

            expect(sections.SCHEDULE.status).toBe('GREEN');
            expect(sections.SCHEDULE.highlights).toContain('Completed 3 tasks this period');
        });

        it('should return RED schedule status when tasks blocked', () => {
            const data = {
                tasksCompleted: 10,
                tasksTotal: 20,
                tasksBlocked: 3,
                tasksInProgress: 5,
                progress: 50,
                tasksCompletedThisPeriod: 0
            };

            const sections = StatusReportService.calculateSectionStatuses(data);

            expect(sections.SCHEDULE.status).toBe('RED');
            expect(sections.SCHEDULE.issues).toContain('3 tasks currently blocked');
        });

        it('should return RED budget status when over budget', () => {
            const data = {
                budgetConsumedPercent: 105,
                isOverBudget: true,
                tasksBlocked: 0
            };

            const sections = StatusReportService.calculateSectionStatuses(data);

            expect(sections.BUDGET.status).toBe('RED');
            expect(sections.BUDGET.issues).toContain('Budget overrun detected');
        });

        it('should return AMBER budget status when near threshold', () => {
            const data = {
                budgetConsumedPercent: 92,
                isOverBudget: false,
                tasksBlocked: 0
            };

            const sections = StatusReportService.calculateSectionStatuses(data);

            expect(sections.BUDGET.status).toBe('AMBER');
        });

        it('should return RED risks status when multiple high-priority items', () => {
            const data = {
                openRisks: 5,
                openIssues: 2,
                highPriorityItems: 3,
                tasksBlocked: 0
            };

            const sections = StatusReportService.calculateSectionStatuses(data);

            expect(sections.RISKS.status).toBe('RED');
        });

        it('should return RED resources status when initiative blocked', () => {
            const data = {
                status: 'BLOCKED',
                blockedReason: 'Waiting for vendor',
                tasksBlocked: 0
            };

            const sections = StatusReportService.calculateSectionStatuses(data);

            expect(sections.RESOURCES.status).toBe('RED');
            expect(sections.RESOURCES.issues).toContain('Initiative is blocked');
        });
    });

    describe('calculateOverallStatus', () => {
        it('should return RED if any section is RED', () => {
            const sections = {
                SCHEDULE: { status: 'GREEN' },
                BUDGET: { status: 'RED' },
                RISKS: { status: 'GREEN' }
            };

            const result = StatusReportService.calculateOverallStatus(sections);

            expect(result).toBe('RED');
        });

        it('should return AMBER if multiple sections are AMBER', () => {
            const sections = {
                SCHEDULE: { status: 'AMBER' },
                BUDGET: { status: 'AMBER' },
                RISKS: { status: 'GREEN' }
            };

            const result = StatusReportService.calculateOverallStatus(sections);

            expect(result).toBe('AMBER');
        });

        it('should return GREEN if all sections are GREEN', () => {
            const sections = {
                SCHEDULE: { status: 'GREEN' },
                BUDGET: { status: 'GREEN' },
                RISKS: { status: 'GREEN' }
            };

            const result = StatusReportService.calculateOverallStatus(sections);

            expect(result).toBe('GREEN');
        });
    });

    describe('generateNarrative', () => {
        it('should generate accomplishments for completed tasks', async () => {
            const initiative = { name: 'Test Initiative' };
            const data = {
                tasksCompletedThisPeriod: 5,
                progress: 60,
                tasksInProgress: 3,
                pendingDecisions: 2,
                openRisks: 1,
                status: 'EXECUTING',
                trend: 'STABLE',
                tasksCompleted: 10,
                tasksTotal: 20
            };
            const sections = { SCHEDULE: { status: 'GREEN' } };

            const narrative = await StatusReportService.generateNarrative(initiative, data, sections);

            expect(narrative.accomplishments).toContain('Completed 5 tasks this period');
            expect(narrative.nextSteps).toContain('Continue work on 3 in-progress tasks');
            expect(narrative.nextSteps).toContain('Resolve 2 pending decisions');
        });

        it('should generate escalations for blocked initiative', async () => {
            const initiative = { name: 'Test Initiative' };
            const data = {
                status: 'BLOCKED',
                blockedReason: 'Vendor delay',
                tasksCompletedThisPeriod: 0,
                tasksInProgress: 0,
                pendingDecisions: 0,
                openRisks: 0,
                progress: 30
            };
            const sections = { SCHEDULE: { status: 'RED' } };

            const narrative = await StatusReportService.generateNarrative(initiative, data, sections);

            expect(narrative.escalations.length).toBeGreaterThan(0);
            expect(narrative.escalations[0].type).toBe('BLOCKER');
        });

        it('should generate executive summary with correct status word', async () => {
            const initiative = { name: 'Test Initiative' };
            const data = {
                progress: 75,
                tasksCompleted: 15,
                tasksTotal: 20,
                openIssues: 0,
                tasksCompletedThisPeriod: 2,
                tasksInProgress: 3,
                pendingDecisions: 1,
                openRisks: 0,
                status: 'EXECUTING'
            };
            const sections = { SCHEDULE: { status: 'GREEN' } };

            const narrative = await StatusReportService.generateNarrative(initiative, data, sections);

            expect(narrative.executiveSummary).toContain('on track');
            expect(narrative.executiveSummary).toContain('75%');
        });
    });

    describe('generateReport', () => {
        it('should generate a complete report', async () => {
            // Mock DbPromise.get sequence for gatherReportData
            vi.mocked(DbPromise.get)
                // 1. Initiative (generateReport)
                .mockResolvedValueOnce({
                    id: testInitId,
                    name: 'Test Initiative',
                    project_id: 'proj-1',
                    organization_id: testOrgId
                })
                // 2. Initiative (gatherReportData)
                .mockResolvedValueOnce({
                    progress: 50,
                    status: 'EXECUTING',
                    blocked_reason: null
                })
                // 3. Task Stats
                .mockResolvedValueOnce({
                    total: 20,
                    completed: 10,
                    in_progress: 5,
                    blocked: 0
                })
                // 4. Period Tasks
                .mockResolvedValueOnce({ completed_this_period: 3 })
                // 5. RAID Stats
                .mockResolvedValueOnce({
                    open_risks: 2,
                    open_issues: 1,
                    high_priority: 1
                })
                // 6. Decision Stats
                .mockResolvedValueOnce({ pending: 2 })
                // 7. Previous Report
                .mockResolvedValueOnce(null);

            const report = await StatusReportService.generateReport(
                testOrgId,
                testInitId,
                'WEEKLY',
                testUserId
            );

            expect(report).toBeDefined();
            expect(report.initiativeId).toBe(testInitId);
            expect(report.periodType).toBe('WEEKLY');
            expect(report.status).toBe('DRAFT');
            expect(report.sections).toBeDefined();
            expect(report.narrative).toBeDefined();

            // Verify inserts
            // 7 inserts expected: 1 report + 6 sections
            expect(DbPromise.run).toHaveBeenCalledTimes(7);
        });
    });

    describe('listReports', () => {
        it('should list reports for initiative', async () => {
            vi.mocked(DbPromise.all).mockResolvedValue([
                {
                    id: 'report-1',
                    period_type: 'WEEKLY',
                    period_label: 'Week 52, 2024',
                    overall_status: 'GREEN',
                    status: 'PUBLISHED',
                    progress_percent: 75,
                    first_name: 'John',
                    last_name: 'Doe',
                    created_at: '2024-12-28T10:00:00Z'
                }
            ]);

            const reports = await StatusReportService.listReports(testInitId, testOrgId);

            expect(reports).toHaveLength(1);
            expect(reports[0].periodLabel).toBe('Week 52, 2024');
            expect(reports[0].createdBy).toBe('John Doe');

            const [db, sql, params] = vi.mocked(DbPromise.all).mock.calls[0];
            expect(sql).toContain('SELECT r.id');
        });
    });

    describe('approveReport', () => {
        it('should approve a report', async () => {
            await StatusReportService.approveReport('report-1', testUserId);

            expect(DbPromise.run).toHaveBeenCalled();
            const [db, sql, params] = vi.mocked(DbPromise.run).mock.calls[0];
            expect(sql).toContain('status = \'APPROVED\'');
            expect(params).toContain(testUserId);
        });
    });

    describe('publishReport', () => {
        it('should publish a report', async () => {
            await StatusReportService.publishReport('report-1');

            expect(DbPromise.run).toHaveBeenCalled();
            const [db, sql, params] = vi.mocked(DbPromise.run).mock.calls[0];
            expect(sql).toContain('status = \'PUBLISHED\'');
        });
    });

    describe('constants', () => {
        it('should export RAG_STATUS', () => {
            expect(StatusReportService.RAG_STATUS).toBeDefined();
            expect(StatusReportService.RAG_STATUS.GREEN).toBe('GREEN');
        });

        it('should export SECTION_NAMES', () => {
            expect(StatusReportService.SECTION_NAMES).toBeDefined();
            expect(StatusReportService.SECTION_NAMES.SCHEDULE).toBe('SCHEDULE');
        });

        it('should export PERIOD_TYPES', () => {
            expect(StatusReportService.PERIOD_TYPES).toBeDefined();
            expect(StatusReportService.PERIOD_TYPES.WEEKLY).toBe('WEEKLY');
        });
    });
});

