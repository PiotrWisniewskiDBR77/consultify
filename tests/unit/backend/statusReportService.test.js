import { describe, it, expect, vi, beforeEach } from 'vitest';
import queryHelpers from '../../../server/utils/queryHelpers';

let StatusReportService;

vi.mock('../../../server/utils/queryHelpers', () => {
    const mockHelpers = {
        queryOne: vi.fn(),
        queryAll: vi.fn(),
        queryRun: vi.fn(),
        queryParallel: vi.fn(),
        buildInPlaceholders: vi.fn(),
        buildOrgFilter: vi.fn(),
        buildUserFilter: vi.fn(),
        transaction: vi.fn(),
        checkOrgContext: vi.fn(() => true)
    };
    return {
        __esModule: true,
        ...mockHelpers,
        default: mockHelpers,
    };
});

vi.mock('../../../server/database', () => ({ default: {} }));
vi.mock('uuid', () => ({ v4: () => 'test-uuid-123' }));

describe('StatusReportService', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        StatusReportService = (await import('../../../server/services/statusReportService')).default;
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
                tasksCompletedThisPeriod: 3
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
                tasksCompleted: 0,
                tasksTotal: 10,
                tasksBlocked: 0,
                tasksInProgress: 5,
                progress: 50
            };

            const sections = StatusReportService.calculateSectionStatuses(data);

            expect(sections.BUDGET.status).toBe('RED');
            expect(sections.BUDGET.issues).toContain('Budget overrun detected');
        });

        it('should return AMBER budget status when near threshold', () => {
            const data = {
                budgetConsumedPercent: 92,
                isOverBudget: false,
                tasksCompleted: 0,
                tasksTotal: 10,
                tasksBlocked: 0,
                tasksInProgress: 5,
                progress: 50
            };

            const sections = StatusReportService.calculateSectionStatuses(data);

            expect(sections.BUDGET.status).toBe('AMBER');
        });

        it('should return RED risks status when multiple high-priority items', () => {
            const data = {
                openRisks: 5,
                openIssues: 2,
                highPriorityItems: 3,
                tasksCompleted: 10,
                tasksTotal: 20,
                tasksBlocked: 0,
                tasksInProgress: 5,
                progress: 50
            };

            const sections = StatusReportService.calculateSectionStatuses(data);

            expect(sections.RISKS.status).toBe('RED');
        });

        it('should return RED resources status when initiative blocked', () => {
            const data = {
                status: 'BLOCKED',
                blockedReason: 'Waiting for vendor',
                tasksCompleted: 10,
                tasksTotal: 20,
                tasksBlocked: 0,
                tasksInProgress: 5,
                progress: 50
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
                status: 'EXECUTING'
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
            // Mock initiative
            queryHelpers.queryOne
                .mockResolvedValueOnce({
                    id: 'init-1',
                    name: 'Test Initiative',
                    organization_id: 'org-1',
                    progress: 50,
                    status: 'EXECUTING'
                })
                // Initiative progress
                .mockResolvedValueOnce({
                    progress: 50,
                    status: 'EXECUTING'
                })
                // Task stats
                .mockResolvedValueOnce({
                    total: 20,
                    completed: 10,
                    in_progress: 5,
                    blocked: 0
                })
                // Period tasks
                .mockResolvedValueOnce({ completed_this_period: 3 })
                // RAID stats
                .mockResolvedValueOnce({
                    open_risks: 2,
                    open_issues: 1,
                    high_priority: 1
                })
                // Decision stats
                .mockResolvedValueOnce({ pending: 2 })
                // Previous report
                .mockResolvedValueOnce(null);

            // Mock queryRun for INSERT and section history (6 sections + 1 main INSERT)
            queryHelpers.queryRun.mockResolvedValue(undefined);

            const report = await StatusReportService.generateReport(
                'org-1',
                'init-1',
                'WEEKLY',
                'user-1'
            );

            expect(report).toBeDefined();
            expect(report.initiativeId).toBe('init-1');
            expect(report.periodType).toBe('WEEKLY');
            expect(report.status).toBe('DRAFT');
            expect(report.sections).toBeDefined();
            expect(report.narrative).toBeDefined();
        });
    });

    describe('listReports', () => {
        it('should list reports for initiative', async () => {
            queryHelpers.queryAll.mockResolvedValue([
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

            const reports = await StatusReportService.listReports('init-1', 'org-1');

            expect(reports).toHaveLength(1);
            expect(reports[0].periodLabel).toBe('Week 52, 2024');
            expect(reports[0].createdBy).toBe('John Doe');
        });
    });

    describe('approveReport', () => {
        it('should approve a report', async () => {
            queryHelpers.queryRun.mockResolvedValue();

            await StatusReportService.approveReport('report-1', 'user-1');

            expect(queryHelpers.queryRun).toHaveBeenCalledWith(
                expect.stringContaining('APPROVED'),
                expect.arrayContaining(['user-1'])
            );
        });
    });

    describe('publishReport', () => {
        it('should publish a report', async () => {
            queryHelpers.queryRun.mockResolvedValue();

            await StatusReportService.publishReport('report-1');

            expect(queryHelpers.queryRun).toHaveBeenCalledWith(
                expect.stringContaining('PUBLISHED'),
                expect.any(Array)
            );
        });
    });

    describe('constants', () => {
        it('should export RAG_STATUS', () => {
            expect(StatusReportService.RAG_STATUS).toBeDefined();
            expect(StatusReportService.RAG_STATUS.GREEN).toBe('GREEN');
            expect(StatusReportService.RAG_STATUS.AMBER).toBe('AMBER');
            expect(StatusReportService.RAG_STATUS.RED).toBe('RED');
        });

        it('should export SECTION_NAMES', () => {
            expect(StatusReportService.SECTION_NAMES).toBeDefined();
            expect(StatusReportService.SECTION_NAMES.SCHEDULE).toBe('SCHEDULE');
            expect(StatusReportService.SECTION_NAMES.BUDGET).toBe('BUDGET');
        });

        it('should export PERIOD_TYPES', () => {
            expect(StatusReportService.PERIOD_TYPES).toBeDefined();
            expect(StatusReportService.PERIOD_TYPES.WEEKLY).toBe('WEEKLY');
            expect(StatusReportService.PERIOD_TYPES.MONTHLY).toBe('MONTHLY');
            expect(StatusReportService.PERIOD_TYPES.QUARTERLY).toBe('QUARTERLY');
        });
    });
});

