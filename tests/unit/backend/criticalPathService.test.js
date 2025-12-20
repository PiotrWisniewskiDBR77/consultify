
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('CriticalPathService', () => {
    let CriticalPathService;
    let dbMock;
    let DependencyServiceMock;

    beforeEach(async () => {
        vi.resetModules();

        dbMock = {
            all: vi.fn(),
            run: vi.fn()
        };

        // Mock database module globally for this test
        vi.doMock('../../../server/database', () => dbMock);

        // Mock DependencyService (CJS mock via doMock)
        DependencyServiceMock = {
            buildDependencyGraph: vi.fn(),
            detectDeadlocks: vi.fn(),
            // Ensure other methods are present if needed, but these are main ones used
            addDependency: vi.fn(),
            removeDependency: vi.fn(),
            canStart: vi.fn()
        };

        // Mock both with and without extension to be safe
        vi.doMock('../../../server/services/dependencyService', () => ({
            default: DependencyServiceMock,
            ...DependencyServiceMock
        }));
        vi.doMock('../../../server/services/dependencyService.js', () => ({
            default: DependencyServiceMock,
            ...DependencyServiceMock
        }));

        CriticalPathService = (await import('../../../server/services/criticalPathService.js')).default;

        // We mocked database globally, so _setDb might be redundant but harmless
        if (CriticalPathService._setDb) CriticalPathService._setDb(dbMock);
    });

    describe('calculateCriticalPath', () => {
        it('should calculate path', async () => {
            dbMock.all.mockImplementation((sql, params, cb) => cb(null, []));
            DependencyServiceMock.buildDependencyGraph.mockResolvedValue({ edges: [] });

            const result = await CriticalPathService.calculateCriticalPath('proj1');
            expect(result.criticalPath).toEqual([]);
        });
    });

    describe('detectSchedulingConflicts', () => {
        it.skip('should detect conflicts', async () => {
            DependencyServiceMock.buildDependencyGraph.mockResolvedValue({ edges: [] });
            dbMock.all.mockImplementation((sql, params, cb) => cb(null, [])); // no inits
            DependencyServiceMock.detectDeadlocks.mockResolvedValue({ hasDeadlocks: false });

            const result = await CriticalPathService.detectSchedulingConflicts('proj1');
            expect(result.hasConflicts).toBe(false);
        });
    });
});
