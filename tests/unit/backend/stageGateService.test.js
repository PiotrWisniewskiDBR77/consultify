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

import StageGateService from '../../../server/services/stageGateService.js';

describe('StageGateService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        if (StageGateService._setDb) StageGateService._setDb(mockDb);

        // Default DB responses
        mockDb.get.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, null);
        });
    });

    describe('getGateType', () => {
        it('should return correct gate for transition', () => {
            const gate = StageGateService.getGateType('Idea', 'Assessment');
            expect(gate).toBe('READINESS_GATE');
        });

        it('should return null for unknown transition', () => {
            const gate = StageGateService.getGateType('Unknown', 'Void');
            expect(gate).toBeNull(); // Or undefined depending on impl, let's assume falsy or check impl
            // Impl returns GATE_TYPES[...] or undefined
        });
    });

    describe('evaluateGate', () => {
        it('should evaluate readiness gate criteria', async () => {
            // Mock specific criterion checks
            // _checkContextField logic: db.get query on projects/assessments

            mockDb.get.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('FROM projects')) {
                        // Mock field checks
                        cb(null, {
                            strategic_goals: 'Goals',
                            challenges: 'Challenges',
                            risk_level: 'Low'
                        });
                    } else {
                        cb(null, null);
                    }
                }
            });

            // Using READINESS_GATE which checks hasStrategicGoals, hasChallenges, hasRisksIdentified
            const result = await StageGateService.evaluateGate('proj-1', 'READINESS_GATE');

            // Check fail/pass based on criteria
            // We mocked goals/challenges/risk => should pass those 3 criteria
            // Criteria list might be longer, let's verify result structure
            expect(result.gateType).toBe('READINESS_GATE');
            expect(result.criteriaResults).toBeDefined();
            expect(result.criteriaResults.length).toBeGreaterThan(0);

            const passedInfo = result.criteriaResults.find(c => c.field === 'hasStrategicGoals');
            expect(passedInfo.passed).toBe(true);
        });

        it('should report failure if criteria missing', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') cb(null, {}); // Empty project data
            });

            const result = await StageGateService.evaluateGate('proj-1', 'READINESS_GATE');
            const failedInfo = result.criteriaResults.find(c => c.field === 'hasStrategicGoals');
            expect(failedInfo.passed).toBe(false);
            expect(result.ready).toBe(false);
        });
    });

    describe('passGate', () => {
        it('should record gate passage', async () => {
            mockDb.run.mockImplementation(function (...args) {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') cb.call({ changes: 1 }, null);
            });

            const result = await StageGateService.passGate('proj-1', 'READINESS_GATE', 'user-1', 'Approved');

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO stage_gates'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });
});
