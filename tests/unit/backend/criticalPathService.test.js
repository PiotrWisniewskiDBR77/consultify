
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('CriticalPathService', () => {
    let CriticalPathService;
    let dbMock;
    let DependencyServiceMock;

    beforeEach(async () => {
        vi.resetModules();

        // Mock DependencyService (CJS mock via doMock)
        DependencyServiceMock = {
            buildDependencyGraph: vi.fn(),
            detectDeadlocks: vi.fn()
        };
        vi.doMock('../../../server/services/dependencyService', () => ({
            default: DependencyServiceMock,
            ...DependencyServiceMock
        }));

        CriticalPathService = (await import('../../../server/services/criticalPathService.js')).default;

        dbMock = {
            all: vi.fn(),
            run: vi.fn()
        };
        CriticalPathService._setDb(dbMock);
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
        it('should detect conflicts', async () => {
            DependencyServiceMock.buildDependencyGraph.mockResolvedValue({ edges: [] });
            dbMock.all.mockImplementation((sql, params, cb) => cb(null, [])); // no inits
            DependencyServiceMock.detectDeadlocks.mockResolvedValue({ hasDeadlocks: false });

            const result = await CriticalPathService.detectSchedulingConflicts('proj1');
            expect(result.hasConflicts).toBe(false);
        });
    });
});
