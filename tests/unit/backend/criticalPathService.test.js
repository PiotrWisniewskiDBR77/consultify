import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
};

vi.mock('../../../server/database', () => ({
    default: mockDb
}));

const mockDependencyService = {
    buildDependencyGraph: vi.fn(),
};

vi.mock('../../../server/services/dependencyService', () => ({
    default: mockDependencyService
}));

import CriticalPathService from '../../../server/services/criticalPathService.js';

describe('CriticalPathService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Inject mocks if helper exists
        if (CriticalPathService._setDb) CriticalPathService._setDb(mockDb);
    });

    describe('calculateCriticalPath', () => {
        it('should identify critical path correctly', async () => {
            // Setup simple linear dependency A (5d) -> B (10d) -> C (2d)
            // Path: A, B, C. Duration: 17d.

            mockDependencyService.buildDependencyGraph.mockResolvedValue({
                nodes: ['A', 'B', 'C'],
                graph: {
                    'A': [{ to: 'B' }],
                    'B': [{ to: 'C' }]
                },
                edges: []
            });

            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    // Mock fetching initiatives with duration
                    cb(null, [
                        { id: 'A', name: 'Init A', duration_days: 5 },
                        { id: 'B', name: 'Init B', duration_days: 10 },
                        { id: 'C', name: 'Init C', duration_days: 2 }
                    ]);
                }
            });

            const result = await CriticalPathService.calculateCriticalPath('proj-1');

            expect(result.nodes).toEqual(['A', 'B', 'C']);
            expect(result.totalDuration).toBe(17);
        });

        it('should handle disjoint paths logic', async () => {
            // A -> B (10)
            // C (5)
            // Longest path is A->B

            mockDependencyService.buildDependencyGraph.mockResolvedValue({
                nodes: ['A', 'B', 'C'],
                graph: { 'A': [{ to: 'B' }] },
                edges: []
            });

            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [
                        { id: 'A', duration_days: 5 },
                        { id: 'B', duration_days: 10 },
                        { id: 'C', duration_days: 5 }
                    ]);
                }
            });

            const result = await CriticalPathService.calculateCriticalPath('proj-1');
            // Assuming implementation returns nodes on the critical path
            expect(result.nodes).toEqual(['A', 'B']); // Order might vary implementation dependent if just set of nodes
            expect(result.totalDuration).toBe(15);
        });
    });
});
