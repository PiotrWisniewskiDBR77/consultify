import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Define mocks using vi.hoisted to ensure they are available for top-level module imports
const mocks = vi.hoisted(() => {
    return {
        db: {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn()
        },
        logger: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        },
        stageGateService: {
            PHASE_ORDER: ['Context', 'Assessment', 'Initiatives', 'Roadmap', 'Execution', 'Stabilization'],
            getGateType: vi.fn(),
            evaluateGate: vi.fn()
        }
    };
});

// Mock the modules
vi.mock('../../../../server/src/database/Database.js', () => ({
    getDatabase: () => mocks.db,
    default: mocks.db
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
    default: mocks.logger,
    logger: mocks.logger
}));

vi.mock('../../../../server/src/services/stageGateService.js', () => ({
    ...mocks.stageGateService,
    getGateType: mocks.stageGateService.getGateType,
    evaluateGate: mocks.stageGateService.evaluateGate,
    PHASE_ORDER: mocks.stageGateService.PHASE_ORDER
}));

let PMOHealthService;

describe('PMOHealthService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Setup mock implementations to handle BOTH Promise-based and Callback-based calls
        // This is needed because DbPromise uses callbacks internally
        
        mocks.db.get.mockImplementation((sql, params, cb) => {
            const callback = typeof params === 'function' ? params : cb;
            if (typeof callback === 'function') {
                process.nextTick(() => callback(null, null));
                return;
            }
            return Promise.resolve(null);
        });

        mocks.db.all.mockImplementation((sql, params, cb) => {
            const callback = typeof params === 'function' ? params : cb;
            if (typeof callback === 'function') {
                process.nextTick(() => callback(null, []));
                return;
            }
            return Promise.resolve([]);
        });

        // Import the service
        const module = await import('../../../../server/src/services/pmoHealthService.js');
        PMOHealthService = module.default || module;

        if (PMOHealthService.setDependencies) {
            PMOHealthService.setDependencies({
                db: mocks.db,
                stageGateService: mocks.stageGateService
            });
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getHealthSnapshot', () => {
        const projectId = 'proj-1';
        const mockProject = {
            id: projectId,
            name: 'Test Project',
            current_phase: 'Assessment'
        };

        beforeEach(() => {
            // Setup project mock for callback-style call
            mocks.db.get.mockImplementation((sql, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                if (sql.includes('projects')) {
                    process.nextTick(() => callback(null, mockProject));
                } else {
                    process.nextTick(() => callback(null, { overdueCount: 0, dueSoonCount: 0, blockedCount: 0 }));
                }
            });

            mocks.stageGateService.getGateType.mockReturnValue('DESIGN_GATE');
            mocks.stageGateService.evaluateGate.mockResolvedValue({
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
            expect(result.phase.name).toBe('Assessment');
        });

        it('evaluates stage gate', async () => {
            const result = await PMOHealthService.getHealthSnapshot(projectId);

            expect(mocks.stageGateService.getGateType).toHaveBeenCalledWith('Assessment', 'Initiatives');
            expect(mocks.stageGateService.evaluateGate).toHaveBeenCalledWith(projectId, 'DESIGN_GATE');
            expect(result.stageGate.gateType).toBe('DESIGN_GATE');
        });
    });
});
