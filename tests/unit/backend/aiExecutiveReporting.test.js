import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';

const require = createRequire(import.meta.url);

describe('AI Executive Reporting Service', () => {
    let AIExecutiveReporting;
    let mockDb;

    beforeEach(() => {
        vi.resetModules();

        mockDb = createMockDb();

        vi.doMock('../../../server/database', () => ({ default: mockDb }));

        AIExecutiveReporting = require('../../../server/services/aiExecutiveReporting.js');
        
        // Inject mock dependencies
        AIExecutiveReporting.setDependencies({
            db: mockDb,
            uuidv4: () => 'mock-uuid-report'
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
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
                    cb(null, [{ status: 'IN_EXECUTION', count: 5 }]);
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
                    cb(null, [{ status: 'COMPLETED', count: 5 }]);
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
