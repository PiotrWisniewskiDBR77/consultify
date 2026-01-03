import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Mock database
const createMockDb = () => ({
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn()
});

// Mock StageGateService
const createMockStageGateService = () => ({
    PHASE_ORDER: ['Context', 'Assessment', 'Initiatives', 'Roadmap', 'Execution', 'Stabilization'],
    getGateType: vi.fn(),
    evaluateGate: vi.fn()
});

// Import service
const PMOHealthService = require('../../../../server/services/pmoHealthService');

describe('PMOHealthService', () => {
    let mockDb;
    let mockStageGateService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockDb = createMockDb();
        mockStageGateService = createMockStageGateService();

        PMOHealthService.setDependencies({
            db: mockDb,
            StageGateService: mockStageGateService
        });
    });

    describe('getHealthSnapshot', () => {
        const projectId = 'proj-1';
        const mockProject = {
            id: projectId,
            name: 'Test Project',
            current_phase: 'Assessment'
        };

        beforeEach(() => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('projects')) {
                    cb(null, mockProject);
                } else {
                    cb(null, { overdueCount: 0, dueSoonCount: 0, blockedCount: 0 });
                }
            });

            mockDb.all.mockImplementation((sql, params, cb) => {
                cb(null, []);
            });

            mockStageGateService.getGateType.mockReturnValue('DESIGN_GATE');
            mockStageGateService.evaluateGate.mockResolvedValue({
                status: 'NOT_READY',
                completionCriteria: [
                    { criterion: 'Criterion 1', isMet: true, evidence: 'Verified' },
                    { criterion: 'Criterion 2', isMet: false, evidence: 'Not met' }
                ]
            });
        });

        it('returns complete health snapshot', async () => {
            const result = await PMOHealthService.getHealthSnapshot(projectId);

            expect(result).toHaveProperty('projectId', projectId);
            expect(result).toHaveProperty('projectName', 'Test Project');
            expect(result).toHaveProperty('phase');
            expect(result).toHaveProperty('stageGate');
            expect(result).toHaveProperty('blockers');
            expect(result).toHaveProperty('tasks');
            expect(result).toHaveProperty('decisions');
            expect(result).toHaveProperty('initiatives');
            expect(result).toHaveProperty('updatedAt');
        });

        it('includes correct phase information', async () => {
            const result = await PMOHealthService.getHealthSnapshot(projectId);

            expect(result.phase.name).toBe('Assessment');
            expect(result.phase.number).toBe(2); // Assessment is 2nd
        });

        it('evaluates stage gate', async () => {
            const result = await PMOHealthService.getHealthSnapshot(projectId);

            expect(mockStageGateService.getGateType).toHaveBeenCalledWith('Assessment', 'Initiatives');
            expect(mockStageGateService.evaluateGate).toHaveBeenCalledWith(projectId, 'DESIGN_GATE');
            expect(result.stageGate.gateType).toBe('DESIGN_GATE');
            expect(result.stageGate.isReady).toBe(false);
        });

        it('includes missing criteria in stage gate', async () => {
            const result = await PMOHealthService.getHealthSnapshot(projectId);

            expect(result.stageGate.missingCriteria).toEqual([
                { criterion: 'Criterion 2', evidence: 'Not met' }
            ]);
        });

        it('includes met criteria in stage gate', async () => {
            const result = await PMOHealthService.getHealthSnapshot(projectId);

            expect(result.stageGate.metCriteria).toEqual([
                { criterion: 'Criterion 1', evidence: 'Verified' }
            ]);
        });

        it('throws error when project not found', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('projects')) {
                    cb(null, null);
                } else {
                    cb(null, {});
                }
            });

            await expect(
                PMOHealthService.getHealthSnapshot(projectId)
            ).rejects.toThrow('Project not found');
        });

        it('handles last phase (no next gate)', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('projects')) {
                    cb(null, { ...mockProject, current_phase: 'Stabilization' });
                } else {
                    cb(null, { overdueCount: 0 });
                }
            });

            const result = await PMOHealthService.getHealthSnapshot(projectId);

            expect(result.stageGate.gateType).toBeNull();
            expect(result.stageGate.isReady).toBe(false);
        });

        it('defaults to Context phase when not set', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('projects')) {
                    cb(null, { ...mockProject, current_phase: null });
                } else {
                    cb(null, { overdueCount: 0 });
                }
            });

            const result = await PMOHealthService.getHealthSnapshot(projectId);

            expect(result.phase.name).toBe('Context');
            expect(result.phase.number).toBe(1);
        });
    });

    describe('_getTaskCounts', () => {
        const projectId = 'proj-1';

        it('returns task counts', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('tasks')) {
                    cb(null, { overdueCount: 3, dueSoonCount: 5, blockedCount: 2 });
                } else {
                    cb(null, null);
                }
            });

            const result = await PMOHealthService._getTaskCounts(projectId);

            expect(result.overdueCount).toBe(3);
            expect(result.dueSoonCount).toBe(5);
            expect(result.blockedCount).toBe(2);
        });

        it('returns zeros on error', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(new Error('DB error'));
            });

            const result = await PMOHealthService._getTaskCounts(projectId);

            expect(result.overdueCount).toBe(0);
            expect(result.dueSoonCount).toBe(0);
            expect(result.blockedCount).toBe(0);
        });

        it('returns zeros when no data', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, null);
            });

            const result = await PMOHealthService._getTaskCounts(projectId);

            expect(result.overdueCount).toBe(0);
        });
    });

    describe('_getDecisionCounts', () => {
        const projectId = 'proj-1';

        it('returns decision counts', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('decisions')) {
                    cb(null, { pendingCount: 4, overdueCount: 2 });
                } else {
                    cb(null, null);
                }
            });

            const result = await PMOHealthService._getDecisionCounts(projectId);

            expect(result.pendingCount).toBe(4);
            expect(result.overdueCount).toBe(2);
        });

        it('returns zeros on error', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(new Error('DB error'));
            });

            const result = await PMOHealthService._getDecisionCounts(projectId);

            expect(result.pendingCount).toBe(0);
            expect(result.overdueCount).toBe(0);
        });
    });

    describe('_getInitiativeCounts', () => {
        const projectId = 'proj-1';

        it('returns initiative counts', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('initiatives')) {
                    cb(null, { atRiskCount: 3, blockedCount: 1 });
                } else {
                    cb(null, null);
                }
            });

            const result = await PMOHealthService._getInitiativeCounts(projectId);

            expect(result.atRiskCount).toBe(3);
            expect(result.blockedCount).toBe(1);
        });

        it('returns zeros on error', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(new Error('DB error'));
            });

            const result = await PMOHealthService._getInitiativeCounts(projectId);

            expect(result.atRiskCount).toBe(0);
            expect(result.blockedCount).toBe(0);
        });
    });

    describe('_getBlockers', () => {
        const projectId = 'proj-1';

        beforeEach(() => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('current_phase')) {
                    cb(null, { current_phase: 'Assessment' });
                } else {
                    cb(null, null);
                }
            });

            mockDb.all.mockImplementation((sql, params, cb) => {
                cb(null, []);
            });

            mockStageGateService.getGateType.mockReturnValue('DESIGN_GATE');
            mockStageGateService.evaluateGate.mockResolvedValue({
                completionCriteria: []
            });
        });

        it('returns overdue task blockers', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => {
                if (sql.includes('tasks')) {
                    cb(null, [
                        { id: 'task-1', title: 'Overdue Task 1' },
                        { id: 'task-2', title: 'Overdue Task 2' }
                    ]);
                } else {
                    cb(null, []);
                }
            });

            const result = await PMOHealthService._getBlockers(projectId);

            expect(result).toContainEqual({
                type: 'TASK',
                message: 'Overdue: Overdue Task 1',
                ref: { entityType: 'task', entityId: 'task-1' }
            });
        });

        it('returns pending decision blockers', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => {
                if (sql.includes('decisions')) {
                    cb(null, [
                        { id: 'dec-1', title: 'Pending Decision 1' }
                    ]);
                } else {
                    cb(null, []);
                }
            });

            const result = await PMOHealthService._getBlockers(projectId);

            expect(result).toContainEqual({
                type: 'DECISION',
                message: 'Pending decision: Pending Decision 1',
                ref: { entityType: 'decision', entityId: 'dec-1' }
            });
        });

        it('returns gate blockers when criteria not met', async () => {
            mockStageGateService.evaluateGate.mockResolvedValue({
                completionCriteria: [
                    { criterion: 'Missing Criterion', isMet: false }
                ]
            });

            const result = await PMOHealthService._getBlockers(projectId);

            expect(result).toContainEqual({
                type: 'GATE',
                message: 'Gate DESIGN_GATE: 1 criteria not met',
                ref: { entityType: 'gate', entityId: 'DESIGN_GATE' }
            });
        });

        it('limits overdue tasks to 5', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => {
                if (sql.includes('tasks')) {
                    // Check that LIMIT 5 is in query
                    expect(sql).toContain('LIMIT 5');
                    cb(null, []);
                } else {
                    cb(null, []);
                }
            });

            await PMOHealthService._getBlockers(projectId);
        });

        it('limits pending decisions to 5', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => {
                if (sql.includes('decisions')) {
                    expect(sql).toContain('LIMIT 5');
                    cb(null, []);
                } else {
                    cb(null, []);
                }
            });

            await PMOHealthService._getBlockers(projectId);
        });
    });

    describe('_getCurrentPhase', () => {
        const projectId = 'proj-1';

        it('returns current phase from database', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { current_phase: 'Execution' });
            });

            const result = await PMOHealthService._getCurrentPhase(projectId);

            expect(result).toBe('Execution');
        });

        it('defaults to Context when not set', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { current_phase: null });
            });

            const result = await PMOHealthService._getCurrentPhase(projectId);

            expect(result).toBe('Context');
        });

        it('defaults to Context on error', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, null);
            });

            const result = await PMOHealthService._getCurrentPhase(projectId);

            expect(result).toBe('Context');
        });
    });

    describe('Performance', () => {
        const projectId = 'proj-1';

        it('logs snapshot generation time', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('projects')) {
                    cb(null, { id: projectId, name: 'Test', current_phase: 'Assessment' });
                } else {
                    cb(null, { overdueCount: 0 });
                }
            });
            mockDb.all.mockImplementation((sql, params, cb) => cb(null, []));
            mockStageGateService.getGateType.mockReturnValue('DESIGN_GATE');
            mockStageGateService.evaluateGate.mockResolvedValue({ completionCriteria: [] });

            await PMOHealthService.getHealthSnapshot(projectId);

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[PMOHealthService] Snapshot generated in')
            );

            consoleSpy.mockRestore();
        });
    });
});









