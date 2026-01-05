import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

describe('AI Executive Reporting Service', () => {
    let AIExecutiveReporting;
    let mocks;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();

        mocks = setupStandardTest();

        // Dynamic import for ESM compatibility
        const module = await import('../../../server/src/services/aiExecutiveReporting.js');
        AIExecutiveReporting = module.default;

        // Inject mock dependencies using unified pattern
        AIExecutiveReporting.setDependencies({
            db: mocks.db,
            uuidv4: mocks.uuid
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('generateReport', () => {
        it('should dispatch to project status report handler', async () => {
            mockDb.get
                .mockImplementationOnce((sql, params, cb) => {
                    // Project query
                    cb(null, { id: 'p-1', name: 'Project X', owner_id: 'user-1' });
                })
                .mockImplementationOnce((sql, params, cb) => {
                    // Task metrics
                    cb(null, { total: 10, completed: 5, blocked: 0, overdue: 0 });
                })
                .mockImplementationOnce((sql, params, cb) => {
                    // Decision count
                    cb(null, { count: 1 });
                });

            mockDb.all
                .mockImplementationOnce((sql, params, cb) => {
                    // Initiatives status
                    cb(null, [{ status: 'EXECUTING', count: 5 }]);
                })
                .mockImplementationOnce((sql, params, cb) => {
                    // Risks
                    cb(null, []);
                });

            const report = await AIExecutiveReporting.generateReport('project_status', { projectId: 'p-1' });

            expect(report.reportType).toBe('project_status');
            expect(report.project.name).toBe('Project X');
        });

        it('should dispatch to portfolio overview handler', async () => {
            mockDb.all
                .mockImplementationOnce((sql, params, cb) => {
                    // Projects
                    cb(null, [{ id: 'p-1', name: 'Project 1', status: 'ACTIVE' }]);
                })
                .mockImplementationOnce((sql, params, cb) => {
                    // Initiatives
                    cb(null, [{ status: 'DONE', count: 5 }]);
                });

            mockDb.get.mockImplementation((sql, params, cb) => {
                // Portfolio metrics
                cb(null, { total_projects: 1, active: 1, avg_progress: 75 });
            });

            const report = await AIExecutiveReporting.generateReport('portfolio_overview', { organizationId: 'org-1' });

            expect(report.reportType).toBe('portfolio_overview');
            expect(report.summary.totalProjects).toBe(1);
        });
    });
});
