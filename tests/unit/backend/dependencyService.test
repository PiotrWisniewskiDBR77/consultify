import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Dependency Service Tests
 * Tests for dependency management and graph building
 * CRITICAL FOR ENTERPRISE PROJECT DEPENDENCY TRACKING
 */

import DependencyService from '../../../server/src/services/dependencyService.js';

describe('DependencyService', () => {
    let mocks;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks = setupStandardTest();

        DependencyService.setDependencies({
            db: mocks.db,
            uuidv4: mocks.uuid || (() => 'uuid-1234')
        });

        mocks.db.all.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, []);
        });

        mocks.db.run.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb.call({ changes: 1 }, null);
        });

        // Keep compatibility for legacy tests
        if (DependencyService._setDb) DependencyService._setDb(mocks.db);
    });

    describe('addDependency', () => {
        it('should add dependency', async () => {
            const result = await DependencyService.addDependency('i1', 'i2');

            expect(result.id).toBe('uuid-1234');
            expect(result.fromInitiativeId).toBe('i1');
            expect(mocks.db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO initiative_dependencies'),
                expect.any(Array),
                expect.any(Function)
            );
        });

        it('should prevent self-dependency', async () => {
            await expect(DependencyService.addDependency('i1', 'i1'))
                .rejects.toThrow('Self-dependency not allowed');
        });
    });

    describe('removeDependency', () => {
        it('should remove dependency', async () => {
            const result = await DependencyService.removeDependency('dep-1');
            expect(result.deleted).toBe(true);
        });
    });

    describe('getDependencies', () => {
        it('should return dependencies', async () => {
            mocks.db.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [{ id: 'd1', from_initiative_id: 'i1', to_initiative_id: 'i2' }]);
                }
            });

            const deps = await DependencyService.getDependencies('i1');
            expect(deps).toHaveLength(1);
        });
    });

    describe('buildDependencyGraph', () => {
        it('should build graph structure', async () => {
            mocks.db.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [
                        { from_initiative_id: 'A', to_initiative_id: 'B' },
                        { from_initiative_id: 'B', to_initiative_id: 'C' }
                    ]);
                }
            });

            const { graph, nodes } = await DependencyService.buildDependencyGraph('proj-1');

            expect(nodes).toContain('A');
            expect(nodes).toContain('B');
            expect(nodes).toContain('C');
            expect(graph['A']).toHaveLength(1);
            expect(graph['A'][0].to).toBe('B');
        });
    });

    describe('detectDeadlocks', () => {
        it('should detect cycles', async () => {
            // A -> B -> A cycle
            mocks.db.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [
                        { from_initiative_id: 'A', to_initiative_id: 'B' },
                        { from_initiative_id: 'B', to_initiative_id: 'A' }
                    ]);
                }
            });

            const result = await DependencyService.detectDeadlocks('proj-1');

            expect(result.hasDeadlocks).toBe(true);
            expect(result.cycles).toHaveLength(1); // One cycle detected (could be multiple refs to same cycle depending on impl, but logic finds at least one)
        });

        it('should return false for acyclic graph', async () => {
            // A -> B -> C
            mocks.db.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [
                        { from_initiative_id: 'A', to_initiative_id: 'B' },
                        { from_initiative_id: 'B', to_initiative_id: 'C' }
                    ]);
                }
            });

            const result = await DependencyService.detectDeadlocks('proj-1');
            expect(result.hasDeadlocks).toBe(false);
        });
    });

    describe('canStart', () => {
        it('should be true if no blockers', async () => {
            const result = await DependencyService.canStart('i1');
            expect(result.canStart).toBe(true);
        });

        it('should be false if blockers exist', async () => {
            mocks.db.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [
                        { id: 'dep-1', name: 'Blocker Init', status: 'IN_PROGRESS' }
                    ]);
                }
            });

            const result = await DependencyService.canStart('i1');
            expect(result.canStart).toBe(false);
            expect(result.blockedBy).toHaveLength(1);
        });
    });
});
