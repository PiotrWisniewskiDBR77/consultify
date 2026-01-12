import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
};

const mockDependencyService = {
    buildDependencyGraph: vi.fn(),
    detectDeadlocks: vi.fn()
};

import CriticalPathService from '../../../server/services/criticalPathService.js';

describe('CriticalPathService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        CriticalPathService.setDependencies({
            db: mockDb,
            DependencyService: mockDependencyService
        });

        mockDb.run.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null);
        });
    });

    describe('calculateCriticalPath', () => {
        it('should identify critical path correctly', async () => {
            // Setup simple linear dependency A (5d) -> B (10d) -> C (2d)
            // Path: A, B, C. Duration: 17d.

            mockDependencyService.buildDependencyGraph.mockResolvedValue({
                edges: [
                    { type: 'FINISH_TO_START', from_initiative_id: 'A', to_initiative_id: 'B' },
                    { type: 'FINISH_TO_START', from_initiative_id: 'B', to_initiative_id: 'C' }
                ]
            });

            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    // Mock fetching initiatives with duration
                    cb(null, [
                        { id: 'A', name: 'Init A', planned_start_date: '2024-01-01', planned_end_date: '2024-01-06', status: 'active' },
                        { id: 'B', name: 'Init B', planned_start_date: '2024-01-06', planned_end_date: '2024-01-16', status: 'active' },
                        { id: 'C', name: 'Init C', planned_start_date: '2024-01-16', planned_end_date: '2024-01-18', status: 'active' }
                    ]);
                }
            });

            const result = await CriticalPathService.calculateCriticalPath('proj-1');

            expect(result.criticalPath.map(n => n.id)).toEqual(['A', 'B', 'C']);
            expect(result.totalDuration).toBe(17);
        });

        it('should handle disjoint paths logic', async () => {
            // A -> B (10)
            // C (5)
            // Longest path is A->B

            mockDependencyService.buildDependencyGraph.mockResolvedValue({
                edges: [
                    { type: 'FINISH_TO_START', from_initiative_id: 'A', to_initiative_id: 'B' }
                ]
            });

            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [
                        { id: 'A', name: 'Init A', planned_start_date: '2024-01-01', planned_end_date: '2024-01-06', status: 'active' },
                        { id: 'B', name: 'Init B', planned_start_date: '2024-01-06', planned_end_date: '2024-01-16', status: 'active' },
                        { id: 'C', name: 'Init C', planned_start_date: '2024-01-01', planned_end_date: '2024-01-06', status: 'active' }
                    ]);
                }
            });

            const result = await CriticalPathService.calculateCriticalPath('proj-1');
            expect(result.criticalPath.map(n => n.id)).toEqual(['A', 'B']);
            expect(result.totalDuration).toBe(15);
        });
    });
});
