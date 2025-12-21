import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';

const require = createRequire(import.meta.url);

describe('AI Analytics Service', () => {
    let AIAnalyticsService;
    let mockDb;
    let mockRoiService;

    beforeEach(() => {
        vi.resetModules();

        mockDb = createMockDb();

        mockRoiService = {
            estimateHoursSaved: vi.fn().mockResolvedValue({ hours_saved: 100 }),
            estimateCostReduction: vi.fn().mockResolvedValue({ cost_saved: 5000 }),
            calculateProjectROI: vi.fn(),
            calculateTaskROI: vi.fn()
        };

        vi.doMock('../../../server/database', () => ({ default: mockDb }));
        vi.doMock('../../../server/services/roiService', () => ({ default: mockRoiService }));

        AIAnalyticsService = require('../../../server/services/aiAnalyticsService.js');

        // Inject mock dependencies
        AIAnalyticsService.setDependencies({
            db: mockDb,
            ROIService: mockRoiService
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
        vi.doUnmock('../../../server/services/roiService');
    });

    describe('getActionStats', () => {
        it('should aggregate action counts correctly', async () => {
            const mockRows = [
                { action_type: 'create_task', status: 'SUCCESS', count: 10 },
                { action_type: 'create_task', status: 'FAILED', count: 2 },
                { action_type: 'update_status', status: 'SUCCESS', count: 5 }
            ];

            mockDb.all.mockImplementation((sql, params, cb) => cb(null, mockRows));

            const stats = await AIAnalyticsService.getActionStats('org-1');

            expect(stats.total_executions).toBe(17);
            expect(stats.success_count).toBe(15);
            expect(stats.failed_count).toBe(2);
            expect(stats.by_action_type['create_task']).toBeDefined();
        });
    });

    describe('getApprovalStats', () => {
        it('should distinguish between auto and manual approvals', async () => {
            // Service runs multiple queries:
            // 1. Total, Approved, Rejected
            // 2. Auto-approved (user_id IS NULL)
            const mockRows = [
                { decision: 'APPROVED', approval_type: 'auto', count: 20 },
                { decision: 'APPROVED', approval_type: 'manual', count: 5 },
                { decision: 'REJECTED', approval_type: 'manual', count: 3 }
            ];

            mockDb.all.mockImplementation((sql, params, cb) => cb(null, mockRows));

            const stats = await AIAnalyticsService.getApprovalStats('org-1');

            expect(stats.total_decisions).toBe(28);
            expect(stats.approved).toBe(25);
            expect(stats.auto_approved).toBe(20);
            expect(stats.manual_approved).toBe(5);
        });
    });

    describe('getPlaybookStats', () => {
        it('should calculate completion rates and average duration', async () => {
            const mockRows = [
                { playbook_name: 'Onboard', playbook_key: 'pb_onboard', status: 'COMPLETED', count: 10, avg_duration_mins: 120 },
                { playbook_name: 'Onboard', playbook_key: 'pb_onboard', status: 'FAILED', count: 2, avg_duration_mins: 0 }
            ];

            mockDb.all.mockImplementation((sql, params, cb) => cb(null, mockRows));

            const stats = await AIAnalyticsService.getPlaybookStats('org-1');

            expect(stats.total_runs).toBe(12);
            expect(stats.completed).toBe(10);
            expect(stats.by_playbook['pb_onboard'].completion_rate).toBeCloseTo(83.33, 1);
        });
    });

    describe('getDeadLetterStats', () => {
        it('should aggregate dead letter jobs by error code', async () => {
            const mockRows = [
                { type: 'ai_task', status: 'DEAD_LETTER', last_error_code: 'RATE_LIMIT', count: 5 },
                { type: 'ai_task', status: 'FAILED', last_error_code: 'TIMEOUT', count: 3 },
                { type: 'ai_task', status: 'COMPLETED', last_error_code: null, count: 7 }
            ];

            mockDb.all.mockImplementation((sql, params, cb) => cb(null, mockRows));

            const stats = await AIAnalyticsService.getDeadLetterStats('org-1');

            expect(stats.dead_letter_count).toBe(5);
            expect(stats.total_jobs).toBe(15);
            expect(stats.by_error_code['RATE_LIMIT']).toBe(5);
        });
    });

    describe('getROISummary', () => {
        it('should combine metrics from multiple sources', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => {
                if (sql.includes('action_executions')) {
                    cb(null, [{ action_type: 'create_task', status: 'SUCCESS', count: 10 }]);
                } else if (sql.includes('ai_playbook_runs')) {
                    cb(null, [{ playbook_name: 'Test', playbook_key: 'test', status: 'COMPLETED', count: 5, avg_duration_mins: 60 }]);
                } else {
                    cb(null, []);
                }
            });

            const summary = await AIAnalyticsService.getROISummary('org-1');

            expect(summary).toHaveProperty('hours_saved');
            expect(summary).toHaveProperty('cost_saved');
            expect(summary).toHaveProperty('actions_executed');
            expect(summary).toHaveProperty('playbooks_completed');
        });
    });

    describe('exportData', () => {
        it('should export CSV format correctly', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => cb(null, []));

            const result = await AIAnalyticsService.exportData('org-1', 'csv');

            expect(result.content_type).toBe('text/csv');
            expect(result.content).toContain('Metric,Value');
            expect(result.filename).toContain('.csv');
        });

        it('should export JSON format correctly', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => cb(null, []));

            const result = await AIAnalyticsService.exportData('org-1', 'json');

            expect(result).toHaveProperty('exported_at');
            expect(result).toHaveProperty('organization_id');
            expect(result).toHaveProperty('actions');
            expect(result).toHaveProperty('approvals');
        });
    });
});
