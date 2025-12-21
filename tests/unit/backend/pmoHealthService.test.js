import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';

const require = createRequire(import.meta.url);

describe('PMOHealthService', () => {
    let PMOHealthService;
    let mockDb;
    let mockStageGateService;

    beforeEach(() => {
        vi.resetModules();

        mockDb = createMockDb();
        mockStageGateService = {
            getGateType: vi.fn(),
            evaluateGate: vi.fn(),
            GATE_TYPES: { READINESS_GATE: 'READINESS_GATE' },
            PHASE_ORDER: ['Context', 'Planning', 'Execution']
        };

        vi.doMock('../../../server/database', () => ({ default: mockDb }));
        vi.doMock('../../../server/services/stageGateService', () => ({ default: mockStageGateService }));

        PMOHealthService = require('../../../server/services/pmoHealthService.js');
        
        // Inject mock dependencies
        PMOHealthService.setDependencies({
            db: mockDb,
            StageGateService: mockStageGateService
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
        vi.doUnmock('../../../server/services/stageGateService');
    });

    describe('getHealthSnapshot', () => {
        const mockProject = {
            id: 'proj1',
            name: 'Test Project',
            current_phase: 'Planning'
        };

        it('should return complete snapshot', async () => {
            mockDb.get
                .mockImplementationOnce((sql, params, cb) => cb(null, mockProject))
                .mockImplementationOnce((sql, params, cb) => cb(null, { overdueCount: 1, dueSoonCount: 0, blockedCount: 0 }))
                .mockImplementationOnce((sql, params, cb) => cb(null, { pendingCount: 3, overdueCount: 0 }))
                .mockImplementationOnce((sql, params, cb) => cb(null, { atRiskCount: 0, blockedCount: 0 }))
                .mockImplementationOnce((sql, params, cb) => cb(null, mockProject)); // Phase check

            mockDb.all
                .mockImplementationOnce((sql, params, cb) => cb(null, [{ id: 't1', title: 'Task' }]))
                .mockImplementationOnce((sql, params, cb) => cb(null, []));

            mockStageGateService.getGateType.mockReturnValue('GATE_1');
            mockStageGateService.evaluateGate.mockResolvedValue({ 
                status: 'READY', 
                completionCriteria: [] 
            });

            const snapshot = await PMOHealthService.getHealthSnapshot('proj1');
            expect(snapshot.tasks.overdueCount).toBe(1);
            expect(snapshot.blockers).toHaveLength(1);
        });

        it('should handle DB errors', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(new Error('DB Error')));
            await expect(PMOHealthService.getHealthSnapshot('proj1')).rejects.toThrow('DB Error');
        });
    });
});
