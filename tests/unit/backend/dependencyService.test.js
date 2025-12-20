
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('DependencyService', () => {
    let DependencyService;
    let dbMock;

    beforeEach(async () => {
        vi.resetModules();

        dbMock = {
            run: vi.fn(),
            all: vi.fn()
        };
        // Mock globally
        vi.doMock('../../../server/database', () => dbMock);

        DependencyService = (await import('../../../server/services/dependencyService.js')).default;
        if (DependencyService._setDb) DependencyService._setDb(dbMock);
    });


    describe('addDependency', () => {
        it('should prevent self-dependency', async () => {
            await expect(DependencyService.addDependency('A', 'A')).rejects.toThrow();
        });

        it('should insert dependency correctly', async () => {
            dbMock.run.mockImplementation((sql, params, cb) => cb(null));
            const result = await DependencyService.addDependency('A', 'B');
            expect(result).toBeDefined();
        });
    });

    describe('buildDependencyGraph', () => {
        it('should return graph', async () => {
            dbMock.all.mockImplementation((sql, params, cb) => cb(null, []));
            const graph = await DependencyService.buildDependencyGraph('proj1');
            expect(graph.nodes).toEqual([]);
        });
    });

    describe('detectDeadlocks', () => {
        it('should detect cycles', async () => {
            const rows = [
                { from_initiative_id: 'A', to_initiative_id: 'B', type: 'FINISH_TO_START' },
                { from_initiative_id: 'B', to_initiative_id: 'A', type: 'FINISH_TO_START' }
            ];
            dbMock.all.mockImplementation((sql, params, cb) => cb(null, rows));
            const result = await DependencyService.detectDeadlocks('proj1');
            expect(result.hasDeadlocks).toBe(true);
        });
    });
});
