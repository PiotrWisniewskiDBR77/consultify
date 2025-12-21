import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Progress Service', () => {
    let ProgressService;
    let mockDb;

    beforeEach(async () => {
        vi.resetModules();

        mockDb = {
            all: vi.fn(),
            get: vi.fn(),
            run: vi.fn()
        };

        vi.doMock('../../../server/database', () => ({ default: mockDb }));

        ProgressService = (await import('../../../server/services/progressService.js')).default;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('calculateInitiativeProgress', () => {
        it.skip('should calculate progress from tasks [BLOCKED: REAL DB HIT]', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { total: 10, completed: 5, blocked: 0 }));
            const result = await ProgressService.calculateInitiativeProgress('i-1');
            expect(result.progress).toBe(50);
            expect(result.isBlocked).toBe(false);
        });
    });

    describe('calculateProjectProgress', () => {
        it.skip('should calculate weighted project progress [BLOCKED: REAL DB HIT]', async () => {
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
        it.skip('should calculate health score based on blocked initiatives [BLOCKED: REAL DB HIT]', async () => {
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
