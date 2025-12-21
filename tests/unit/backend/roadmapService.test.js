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

vi.mock('uuid', () => ({
    v4: () => 'uuid-1234'
}));

import RoadmapService from '../../../server/services/roadmapService.js';

describe('RoadmapService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockDb.get.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, null);
        });

        mockDb.all.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, []);
        });

        mockDb.run.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb.call({ changes: 1 }, null);
        });
    });

    describe('getWaves', () => {
        it('should return waves', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') cb(null, [{ id: 'w1', name: 'Wave 1' }]);
            });

            const waves = await RoadmapService.getWaves('proj-1');
            expect(waves).toHaveLength(1);
            expect(waves[0].id).toBe('w1');
        });
    });

    describe('createWave', () => {
        it('should create wave', async () => {
            const waveData = {
                name: 'Wave 2',
                description: 'Desc',
                startDate: '2024-01-01',
                endDate: '2024-03-31',
                sortOrder: 1
            };

            const result = await RoadmapService.createWave('proj-1', waveData);

            expect(result.id).toBe('uuid-1234');
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO roadmap_waves'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });

    describe('assignToWave', () => {
        it('should update initiative wave', async () => {
            const result = await RoadmapService.assignToWave('init-1', 'wave-1');

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE initiatives'),
                ['wave-1', 'init-1'],
                expect.any(Function)
            );
        });
    });

    describe('baselineRoadmap', () => {
        it('should baseline waves and increment version', async () => {
            const result = await RoadmapService.baselineRoadmap('proj-1');

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledTimes(2);
            // First call updates waves
            // Second call updates initiatives version
        });
    });

    describe('getRoadmapSummary', () => {
        it('should return roadmap summary with nested initiatives', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [
                        {
                            wave_id: 'w1', wave_name: 'Wave 1',
                            initiative_id: 'i1', initiative_name: 'Init 1'
                        },
                        {
                            wave_id: 'w1', wave_name: 'Wave 1',
                            initiative_id: 'i2', initiative_name: 'Init 2'
                        }
                    ]);
                }
            });

            const summary = await RoadmapService.getRoadmapSummary('proj-1');

            expect(summary).toHaveLength(1); // 1 Wave
            expect(summary[0].initiatives).toHaveLength(2); // 2 Initiatives
        });
    });

    describe('updateInitiativeSchedule', () => {
        it('should update schedule directly if not baselined', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, { is_baselined: 0 }); // Not baselined
                }
            });

            const result = await RoadmapService.updateInitiativeSchedule(
                'init-1', { plannedStartDate: '2024-01-01' }, 'user-1', 'proj-1'
            );

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE initiatives'),
                expect.arrayContaining(['2024-01-01', 'init-1']),
                expect.any(Function)
            );
        });

        it('should require CR if baselined and governance enforced', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        is_baselined: 1,
                        governance_settings: JSON.stringify({ requireChangeRequestForSchedule: true })
                    });
                }
            });

            const result = await RoadmapService.updateInitiativeSchedule(
                'init-1', { plannedStartDate: '2024-02-01' }, 'user-1', 'proj-1'
            );

            expect(result.changeRequestCreated).toBe(true);
            expect(result.proposedChanges.plannedStartDate).toBe('2024-02-01');
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO decisions'),
                expect.any(Array), // CR Insert params
                expect.any(Function)
            );
        });

        it('should allow direct update if baselined but governance relaxed', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        is_baselined: 1,
                        governance_settings: JSON.stringify({ requireChangeRequestForSchedule: false })
                    });
                }
            });

            const result = await RoadmapService.updateInitiativeSchedule(
                'init-1', { plannedStartDate: '2024-02-01' }, 'user-1', 'proj-1'
            );

            expect(result.success).toBe(true);
        });

        it('should handle no changes', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') cb(null, {});
            });

            const result = await RoadmapService.updateInitiativeSchedule(
                'init-1', {}, 'user-1', 'proj-1'
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('No changes');
        });
    });
});
