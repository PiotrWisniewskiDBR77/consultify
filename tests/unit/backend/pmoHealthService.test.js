
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('PMOHealthService', () => {
    let PMOHealthService;
    let StageGateService;
    let dbMock;

    beforeEach(async () => {
        vi.resetModules();
        vi.doMock('../../../server/services/stageGateService', () => ({
            default: {
                getGateType: vi.fn(),
                evaluateGate: vi.fn(),
                GATE_TYPES: { READINESS_GATE: 'READINESS_GATE' },
                PHASE_ORDER: ['Context', 'Planning', 'Execution']
            }
        }));

        PMOHealthService = (await import('../../../server/services/pmoHealthService.js')).default;
        StageGateService = (await import('../../../server/services/stageGateService.js')).default;

        dbMock = {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn()
        };
        PMOHealthService._setDb(dbMock);
    });

    describe('getHealthSnapshot', () => {
        const mockProject = {
            id: 'proj1',
            name: 'Test Project',
            current_phase: 'Planning'
        };

        it('should return complete snapshot', async () => {
            dbMock.get
                .mockImplementationOnce((sql, params, cb) => cb(null, mockProject))
                .mockImplementationOnce((sql, params, cb) => cb(null, { overdueCount: 1 }))
                .mockImplementationOnce((sql, params, cb) => cb(null, { pendingCount: 3 }))
                .mockImplementationOnce((sql, params, cb) => cb(null, { atRiskCount: 0 }))
                .mockImplementationOnce((sql, params, cb) => cb(null, mockProject)); // Phase check

            dbMock.all
                .mockImplementationOnce((sql, params, cb) => cb(null, [{ id: 't1', title: 'Task' }]))
                .mockImplementationOnce((sql, params, cb) => cb(null, []));

            StageGateService.getGateType.mockReturnValue('GATE_1');
            StageGateService.evaluateGate.mockResolvedValue({ status: 'READY', missingElements: [] });

            const snapshot = await PMOHealthService.getHealthSnapshot('proj1');
            expect(snapshot.tasks.overdueCount).toBe(1);
            expect(snapshot.blockers).toHaveLength(1);
        });

        it('should handle DB errors', async () => {
            dbMock.get.mockImplementation((sql, params, cb) => cb(new Error('DB Error')));
            await expect(PMOHealthService.getHealthSnapshot('proj1')).rejects.toThrow('DB Error');
        });
    });
});
