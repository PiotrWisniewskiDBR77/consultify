import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mock - defined inline
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

describe('Progress Service', () => {
    let ProgressService;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Dynamic import for ESM compatibility
        const module = await import('../../../server/services/progressService.js');
        ProgressService = module.default;

        // Inject mock dependencies
        if (ProgressService.setDependencies) {
            ProgressService.setDependencies({
                db: mockDb
            });
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('calculateInitiativeProgress', () => {
        it('should calculate progress from tasks', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { total: 10, completed: 5, blocked: 0 }));
            const result = await ProgressService.calculateInitiativeProgress('i-1');
            expect(result.progress).toBe(50);
            expect(result.isBlocked).toBe(false);
        });

        it('should detect blocked initiatives', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { total: 10, completed: 5, blocked: 2 }));
            const result = await ProgressService.calculateInitiativeProgress('i-1');
            expect(result.isBlocked).toBe(true);
            expect(result.blockedTasks).toBe(2);
        });
    });

    describe('calculateProjectProgress', () => {
        it('should calculate weighted project progress', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, {
                total: 2,
                completed: 1,
                blocked: 0,
                in_progress: 1,
                avg_progress: 50
            }));
            // Logic: ((1 * 100) + (1 * 50)) / 2 = 150 / 2 = 75

            const result = await ProgressService.calculateProjectProgress('p-1');
            expect(result.progress).toBe(75);
            expect(result.healthStatus).toBe('ON_TRACK');
        });
    });

    describe('calculatePortfolioMetrics', () => {
        it('should calculate health score based on blocked initiatives', async () => {
            // Mock first query (Projects)
            mockDb.get.mockImplementationOnce((sql, params, cb) => cb(null, { total_projects: 4, active: 4, avg_progress: 60 }));
            // Mock second query (Initiatives)
            mockDb.get.mockImplementationOnce((sql, params, cb) => cb(null, { total: 10, completed: 5, blocked: 2 }));

            // Logic: Blocked % = 20%. Score = 100 - (20 * 0.5) = 90.
            const result = await ProgressService.calculatePortfolioMetrics('org-1');
            expect(result.healthScore).toBe(90);
        });
    });
});
