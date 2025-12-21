/**
 * Roadmap Service Tests
 * 
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests wave management, initiative assignment, baselining, and governance integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb, createMockUuid } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);

describe('RoadmapService', () => {
    let mockDb;
    let RoadmapService;
    let mockUuid;

    beforeEach(() => {
        mockDb = createMockDb();
        mockUuid = createMockUuid('wave');

        RoadmapService = require('../../../server/services/roadmapService.js');
        RoadmapService.setDependencies({
            db: mockDb,
            uuidv4: mockUuid
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getWaves()', () => {
        it('should retrieve all waves for a project', async () => {
            const projectId = testProjects.project1.id;
            const mockWaves = [
                { id: 'wave-1', name: 'Wave 1', sort_order: 1 },
                { id: 'wave-2', name: 'Wave 2', sort_order: 2 }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('SELECT * FROM roadmap_waves');
                expect(query).toContain('project_id = ?');
                expect(query).toContain('ORDER BY sort_order');
                expect(params[0]).toBe(projectId);
                callback(null, mockWaves);
            });

            const result = await RoadmapService.getWaves(projectId);

            expect(result).toEqual(mockWaves);
            expect(result.length).toBe(2);
        });

        it('should return empty array when no waves exist', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            const result = await RoadmapService.getWaves(projectId);

            expect(result).toEqual([]);
        });

        it('should handle database errors', async () => {
            const projectId = testProjects.project1.id;
            const dbError = new Error('Database error');

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(dbError, null);
            });

            await expect(
                RoadmapService.getWaves(projectId)
            ).rejects.toThrow('Database error');
        });
    });

    describe('createWave()', () => {
        it('should create a new wave', async () => {
            const projectId = testProjects.project1.id;
            const waveData = {
                name: 'Q1 2024',
                description: 'First quarter initiatives',
                startDate: '2024-01-01',
                endDate: '2024-03-31',
                sortOrder: 1
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('INSERT INTO roadmap_waves');
                expect(params[0]).toBe('wave-1'); // UUID
                expect(params[1]).toBe(projectId);
                expect(params[2]).toBe(waveData.name);
                expect(params[6]).toBe(waveData.sortOrder);
                callback.call({ changes: 1, lastID: 1 }, null);
            });

            const result = await RoadmapService.createWave(projectId, waveData);

            expect(result.id).toBe('wave-1');
            expect(result.projectId).toBe(projectId);
            expect(result.name).toBe(waveData.name);
        });

        it('should default sortOrder to 0 if not provided', async () => {
            const projectId = testProjects.project1.id;
            const waveData = {
                name: 'Wave 1',
                description: 'Test',
                startDate: '2024-01-01',
                endDate: '2024-03-31'
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(params[6]).toBe(0); // sortOrder default
                callback.call({ changes: 1 }, null);
            });

            await RoadmapService.createWave(projectId, waveData);
        });

        it('should handle database errors', async () => {
            const projectId = testProjects.project1.id;
            const waveData = { name: 'Wave 1' };
            const dbError = new Error('Database error');

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 0 }, dbError);
            });

            await expect(
                RoadmapService.createWave(projectId, waveData)
            ).rejects.toThrow('Database error');
        });
    });

    describe('assignToWave()', () => {
        it('should assign initiative to wave', async () => {
            const initiativeId = 'init-123';
            const waveId = 'wave-1';

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('UPDATE initiatives');
                expect(query).toContain('wave_id = ?');
                expect(query).toContain('WHERE id = ?');
                expect(params[0]).toBe(waveId);
                expect(params[1]).toBe(initiativeId);
                callback.call({ changes: 1 }, null);
            });

            const result = await RoadmapService.assignToWave(initiativeId, waveId);

            expect(result.initiativeId).toBe(initiativeId);
            expect(result.waveId).toBe(waveId);
            expect(result.success).toBe(true);
        });

        it('should handle database errors', async () => {
            const initiativeId = 'init-123';
            const waveId = 'wave-1';
            const dbError = new Error('Database error');

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 0 }, dbError);
            });

            await expect(
                RoadmapService.assignToWave(initiativeId, waveId)
            ).rejects.toThrow('Database error');
        });
    });

    describe('baselineRoadmap()', () => {
        it('should baseline all waves and increment initiative baseline version', async () => {
            const projectId = testProjects.project1.id;

            let callCount = 0;
            mockDb.run.mockImplementation((query, params, callback) => {
                callCount++;
                if (callCount === 1) {
                    // First call: mark waves as baselined
                    expect(query).toContain('UPDATE roadmap_waves');
                    expect(query).toContain('is_baselined = 1');
                    expect(params[0]).toBe(projectId);
                    callback.call({ changes: 3 }, null);
                } else if (callCount === 2) {
                    // Second call: increment baseline version
                    expect(query).toContain('UPDATE initiatives');
                    expect(query).toContain('baseline_version = baseline_version + 1');
                    expect(params[0]).toBe(projectId);
                    callback.call({ changes: 5 }, null);
                }
            });

            const result = await RoadmapService.baselineRoadmap(projectId);

            expect(result.projectId).toBe(projectId);
            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledTimes(2);
        });

        it('should handle database errors on wave update', async () => {
            const projectId = testProjects.project1.id;
            const dbError = new Error('Database error');

            mockDb.run.mockImplementation((query, params, callback) => {
                if (query.includes('roadmap_waves')) {
                    callback.call({ changes: 0 }, dbError);
                }
            });

            await expect(
                RoadmapService.baselineRoadmap(projectId)
            ).rejects.toThrow('Database error');
        });
    });

    describe('getRoadmapSummary()', () => {
        it('should return roadmap summary with waves and initiatives', async () => {
            const projectId = testProjects.project1.id;
            const mockRows = [
                {
                    wave_id: 'wave-1',
                    wave_name: 'Wave 1',
                    start_date: '2024-01-01',
                    end_date: '2024-03-31',
                    status: 'ACTIVE',
                    initiative_id: 'init-1',
                    initiative_name: 'Initiative 1',
                    initiative_status: 'IN_PROGRESS',
                    priority: 'HIGH'
                },
                {
                    wave_id: 'wave-1',
                    wave_name: 'Wave 1',
                    start_date: '2024-01-01',
                    end_date: '2024-03-31',
                    status: 'ACTIVE',
                    initiative_id: 'init-2',
                    initiative_name: 'Initiative 2',
                    initiative_status: 'PLANNED',
                    priority: 'MEDIUM'
                },
                {
                    wave_id: 'wave-2',
                    wave_name: 'Wave 2',
                    start_date: '2024-04-01',
                    end_date: '2024-06-30',
                    status: 'PLANNED',
                    initiative_id: null,
                    initiative_name: null,
                    initiative_status: null,
                    priority: null
                }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('LEFT JOIN initiatives');
                expect(params[0]).toBe(projectId);
                callback(null, mockRows);
            });

            const result = await RoadmapService.getRoadmapSummary(projectId);

            expect(result.length).toBe(2);
            expect(result[0].id).toBe('wave-1');
            expect(result[0].initiatives.length).toBe(2);
            expect(result[1].id).toBe('wave-2');
            expect(result[1].initiatives.length).toBe(0);
        });

        it('should handle empty roadmap', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            const result = await RoadmapService.getRoadmapSummary(projectId);

            expect(result).toEqual([]);
        });
    });

    describe('updateInitiativeSchedule()', () => {
        it('should update schedule directly when not baselined', async () => {
            const initiativeId = 'init-123';
            const updates = {
                plannedStartDate: '2024-02-01',
                plannedEndDate: '2024-02-28'
            };
            const userId = testUsers.admin.id;
            const projectId = testProjects.project1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    wave_id: 'wave-1',
                    is_baselined: 0,
                    governance_settings: '{}'
                });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('UPDATE initiatives');
                expect(query).toContain('start_date = ?');
                expect(query).toContain('end_date = ?');
                callback.call({ changes: 1 }, null);
            });

            const result = await RoadmapService.updateInitiativeSchedule(
                initiativeId,
                updates,
                userId,
                projectId
            );

            expect(result.success).toBe(true);
            expect(result.initiativeId).toBe(initiativeId);
        });

        it('should create Change Request when baselined and governance requires CR', async () => {
            const initiativeId = 'init-123';
            const updates = {
                plannedStartDate: '2024-02-01'
            };
            const userId = testUsers.admin.id;
            const projectId = testProjects.project1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    wave_id: 'wave-1',
                    is_baselined: 1,
                    governance_settings: JSON.stringify({
                        requireChangeRequestForSchedule: true
                    })
                });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                if (query.includes('INSERT INTO decisions')) {
                    expect(query).toContain('decision_type');
                    expect(query).toContain('SCHEDULE_CHANGE');
                    callback.call({ changes: 1 }, null);
                }
            });

            const result = await RoadmapService.updateInitiativeSchedule(
                initiativeId,
                updates,
                userId,
                projectId
            );

            expect(result.changeRequestCreated).toBe(true);
            expect(result.crId).toBeDefined();
            expect(result.message).toContain('Change request created');
        });

        it('should allow direct update when baselined but governance does not require CR', async () => {
            const initiativeId = 'init-123';
            const updates = {
                plannedStartDate: '2024-02-01'
            };
            const userId = testUsers.admin.id;
            const projectId = testProjects.project1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    wave_id: 'wave-1',
                    is_baselined: 1,
                    governance_settings: JSON.stringify({
                        requireChangeRequestForSchedule: false
                    })
                });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await RoadmapService.updateInitiativeSchedule(
                initiativeId,
                updates,
                userId,
                projectId
            );

            expect(result.success).toBe(true);
            expect(result.changeRequestCreated).toBeUndefined();
        });

        it('should handle waveId update', async () => {
            const initiativeId = 'init-123';
            const updates = {
                waveId: 'wave-2'
            };
            const userId = testUsers.admin.id;
            const projectId = testProjects.project1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    wave_id: 'wave-1',
                    is_baselined: 0,
                    governance_settings: '{}'
                });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('wave_id = ?');
                expect(params[0]).toBe('wave-2');
                callback.call({ changes: 1 }, null);
            });

            const result = await RoadmapService.updateInitiativeSchedule(
                initiativeId,
                updates,
                userId,
                projectId
            );

            expect(result.success).toBe(true);
        });

        it('should return success message when no changes to apply', async () => {
            const initiativeId = 'init-123';
            const updates = {};
            const userId = testUsers.admin.id;
            const projectId = testProjects.project1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    wave_id: 'wave-1',
                    is_baselined: 0,
                    governance_settings: '{}'
                });
            });

            const result = await RoadmapService.updateInitiativeSchedule(
                initiativeId,
                updates,
                userId,
                projectId
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('No changes');
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should filter waves by project_id', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(params[0]).toBe(projectId);
                callback(null, []);
            });

            await RoadmapService.getWaves(projectId);
        });

        it('should ensure initiatives belong to correct project in summary', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('WHERE w.project_id = ?');
                expect(params[0]).toBe(projectId);
                callback(null, []);
            });

            await RoadmapService.getRoadmapSummary(projectId);
        });
    });
});
