import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMockDb, createMockLogger } from '../../../helpers/mockDb.js';

// Mock dependencies
const mockDb = vi.hoisted(() => ({
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn()
}));

const mockLogger = vi.hoisted(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
}));

// Mock the database module
vi.mock('../../../../server/src/database/index.js', () => ({
    getDatabase: () => mockDb,
    default: mockDb
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
    default: mockLogger
}));

let stageGateService;

describe('StageGateService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Setup mock implementations to handle BOTH Promise-based and Callback-based calls
        // This is needed because DbPromise uses callbacks internally
        
        mockDb.get.mockImplementation((sql, params, cb) => {
            const callback = typeof params === 'function' ? params : cb;
            const actualParams = typeof params === 'function' ? [] : params;
            
            // If it's a callback-style call (used by DbPromise)
            if (typeof callback === 'function') {
                // Return null by default, specific tests will override this
                process.nextTick(() => callback(null, null));
                return;
            }
            // If it's a Promise-style call
            return Promise.resolve(null);
        });

        mockDb.all.mockImplementation((sql, params, cb) => {
            const callback = typeof params === 'function' ? params : cb;
            if (typeof callback === 'function') {
                process.nextTick(() => callback(null, []));
                return;
            }
            return Promise.resolve([]);
        });

        mockDb.run.mockImplementation(function(sql, params, cb) {
            const callback = typeof params === 'function' ? params : cb;
            if (typeof callback === 'function') {
                const result = { lastID: 1, changes: 1 };
                process.nextTick(() => callback.call(result, null));
                return;
            }
            return Promise.resolve({ lastID: 1, changes: 1 });
        });

        // Import service
        const module = await import('../../../../server/src/services/stageGateService.js');
        stageGateService = module.default || module;

        if (stageGateService.setDependencies) {
            stageGateService.setDependencies({ db: mockDb, logger: mockLogger });
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('GATE_TYPES', () => {
        it('defines all required gate types', () => {
            expect(stageGateService.GATE_TYPES).toHaveProperty('READINESS_GATE');
            expect(stageGateService.GATE_TYPES).toHaveProperty('DESIGN_GATE');
            expect(stageGateService.GATE_TYPES).toHaveProperty('PLANNING_GATE');
            expect(stageGateService.GATE_TYPES).toHaveProperty('EXECUTION_GATE');
            expect(stageGateService.GATE_TYPES).toHaveProperty('CLOSURE_GATE');
        });
    });

    describe('PHASE_ORDER', () => {
        it('defines correct phase sequence', () => {
            expect(stageGateService.PHASE_ORDER).toEqual([
                'Context', 'Assessment', 'Initiatives', 'Roadmap', 'Execution', 'Stabilization'
            ]);
        });
    });

    describe('getGateType', () => {
        it('returns READINESS_GATE for Context to Assessment', () => {
            const result = stageGateService.getGateType('Context', 'Assessment');
            expect(result).toBe(stageGateService.GATE_TYPES.READINESS_GATE);
        });

        it('returns null for unknown transitions', () => {
            const result = stageGateService.getGateType('Context', 'Execution');
            expect(result).toBeNull();
        });
    });

    describe('evaluateGate', () => {
        it('should evaluate a gate successfully', async () => {
            const projectId = 'proj-123';
            const gateType = stageGateService.GATE_TYPES.READINESS_GATE;
            
            // Mock project record for callback-style call (DbPromise.get)
            mockDb.get.mockImplementationOnce((sql, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                process.nextTick(() => callback(null, { id: projectId, organization_id: 'org-1' }));
            });

            // Mock other calls for evaluateCriterion
            mockDb.get.mockImplementation((sql, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                process.nextTick(() => callback(null, { strategicGoals: '[]', challenges: '[]' }));
            });

            const result = await stageGateService.evaluateGate(projectId, gateType);

            expect(result).toBeDefined();
            expect(result.projectId).toBe(projectId);
            expect(result.status).toBeDefined();
        });

        it('should fail evaluation when project not found', async () => {
            mockDb.get.mockImplementationOnce((sql, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                process.nextTick(() => callback(null, null));
            });

            await expect(stageGateService.evaluateGate('invalid', stageGateService.GATE_TYPES.READINESS_GATE))
                .rejects.toThrow('Project not found');
        });
    });

    describe('passGate', () => {
        it('should record evaluation and update project phase', async () => {
            const projectId = 'proj-123';
            const gateType = stageGateService.GATE_TYPES.READINESS_GATE;
            const userId = 'user-456';

            const result = await stageGateService.passGate(projectId, gateType, userId, 'Test notes');

            expect(result).toBeDefined();
            expect(result.status).toBe('PASSED');
            expect(result.projectId || result.id).toBeDefined();
            expect(mockDb.run).toHaveBeenCalled();
        });
    });
});
