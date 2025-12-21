import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';

const require = createRequire(import.meta.url);

describe('Baseline Service', () => {
    let BaselineService;
    let mockDb;

    beforeEach(() => {
        vi.resetModules();

        mockDb = createMockDb();

        vi.doMock('../../../server/database', () => ({ default: mockDb }));

        BaselineService = require('../../../server/services/baselineService.js');
        
        // Inject mock dependencies
        BaselineService.setDependencies({
            db: mockDb,
            uuidv4: () => 'mock-uuid-baseline'
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
    });

    describe('calculateVariance', () => {
        it('should calculate delay correctly when mocking dependencies', async () => {
            const roadmapId = 'roadmap-1';
            
            // Mock baseline
            mockDb.get.mockImplementationOnce((sql, params, cb) => {
                if (sql.includes('schedule_baselines')) {
                    cb(null, {
                        id: 'baseline-1',
                        roadmap_id: roadmapId,
                        version: 1,
                        initiative_snapshots: JSON.stringify([
                            {
                                initiativeId: 'init-1',
                                plannedStartDate: '2025-01-01',
                                plannedEndDate: '2025-01-15',
                                sequencePosition: 1
                            }
                        ])
                    });
                } else {
                    cb(null, null);
                }
            });

            // Mock actuals
            mockDb.all.mockImplementation((sql, params, cb) => {
                cb(null, [
                    {
                        initiative_id: 'init-1',
                        actual_start_date: '2025-01-01',
                        actual_end_date: '2025-01-20', // 5 days delay
                        name: 'Test Initiative'
                    }
                ]);
            });

            const result = await BaselineService.calculateVariance(roadmapId);
            
            expect(result.totalInitiatives).toBe(1);
            expect(result.delayedCount).toBeGreaterThan(0);
            expect(result.initiativeVariances[0].endVarianceDays).toBe(5);
        });

        it('should mark critical delays', async () => {
            const roadmapId = 'roadmap-1';
            
            mockDb.get.mockImplementationOnce((sql, params, cb) => {
                cb(null, {
                    id: 'baseline-1',
                    roadmap_id: roadmapId,
                    version: 1,
                    initiative_snapshots: JSON.stringify([
                        {
                            initiativeId: 'init-1',
                            plannedStartDate: '2025-01-01',
                            plannedEndDate: '2025-01-15',
                            sequencePosition: 1
                        }
                    ])
                });
            });

            mockDb.all.mockImplementation((sql, params, cb) => {
                cb(null, [
                    {
                        initiative_id: 'init-1',
                        actual_start_date: '2025-01-01',
                        actual_end_date: '2025-02-01', // 17 days delay - critical
                        name: 'Test Initiative'
                    }
                ]);
            });

            const result = await BaselineService.calculateVariance(roadmapId);
            
            expect(result.criticalDelays).toBeGreaterThan(0);
            expect(result.initiativeVariances[0].status).toBe('CRITICAL');
        });
    });

    describe('captureBaseline', () => {
        it('should create snapshot from roadmap initiatives', async () => {
            const roadmapId = 'roadmap-1';
            const projectId = 'project-1';
            const userId = 'user-1';
            
            // Mock initiatives query
            mockDb.all.mockImplementationOnce((sql, params, cb) => {
                cb(null, [
                    {
                        initiative_id: 'init-1',
                        planned_start_date: '2025-01-01',
                        planned_end_date: '2025-01-15',
                        sequence_position: 1
                    }
                ]);
            });

            // Mock version query
            mockDb.get.mockImplementationOnce((sql, params, cb) => {
                cb(null, { maxVer: 0 });
            });

            // Mock insert
            mockDb.run.mockImplementation(function (sql, params, cb) {
                if (sql.includes('INSERT')) {
                    cb.call({ changes: 1 }, null);
                } else if (sql.includes('UPDATE')) {
                    cb.call({ changes: 1 }, null);
                }
            });

            const result = await BaselineService.captureBaseline(roadmapId, projectId, userId, 'Test rationale');
            
            expect(result.version).toBe(1);
            expect(result.initiativeCount).toBe(1);
            expect(mockDb.run).toHaveBeenCalled();
        });
    });
});
