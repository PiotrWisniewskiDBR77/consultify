import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mock - defined inline since imports aren't available yet
const mockDb = vi.hoisted(() => ({
    get: vi.fn((sql, params, callback) => {
        const cb = typeof params === 'function' ? params : callback;
        if (cb) process.nextTick(() => cb(null, null));
    }),
    all: vi.fn((sql, params, callback) => {
        const cb = typeof params === 'function' ? params : callback;
        if (cb) process.nextTick(() => cb(null, []));
    }),
    run: vi.fn(function(sql, params, callback) {
        const cb = typeof params === 'function' ? params : callback;
        if (cb) process.nextTick(() => cb.call({ changes: 1, lastID: 1 }, null));
    }),
    exec: vi.fn((sql, callback) => {
        if (callback) process.nextTick(() => callback(null));
    }),
    serialize: vi.fn((cb) => { if (cb) cb(); }),
    prepare: vi.fn(),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    initPromise: Promise.resolve()
}));

vi.mock('../../../server/database', () => ({ default: mockDb }));

describe('AI Executive Reporting Service', () => {
    let AIExecutiveReporting;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Dynamic import for ESM compatibility
        const module = await import('../../../server/services/aiExecutiveReporting.js');
        AIExecutiveReporting = module.default;

        // Inject mock dependencies
        AIExecutiveReporting.setDependencies({
            db: mockDb,
            uuidv4: () => 'mock-uuid-report'
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
