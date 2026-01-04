import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDatabaseWithResults } from '../../../server/tests/helpers/mockDatabase.ts';
import StageGateService from '../../../server/src/services/stageGateService.js';

// Minimal mock to prevent real DB connection on import
vi.mock('../../../server/src/database/Database.js', () => ({
    getDatabase: () => ({
        get: vi.fn(),
        all: vi.fn(),
        run: vi.fn(),
        exec: vi.fn(),
        close: vi.fn()
    }),
    default: {
        getDatabase: () => ({})
    }
}));

describe('StageGateService', () => {
    let mockDb;

    beforeEach(() => {
        vi.clearAllMocks();
        // Use standard helper
        mockDb = createMockDatabaseWithResults();

        // Inject standardized mock
        if (StageGateService._setDb) StageGateService._setDb(mockDb);
    });

    // ... rest of tests use mockDb variable freely ...

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
            mockDb.get.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('SELECT * FROM projects')) {
                        return cb(null, { id: 'proj-1' });
                    }
                    if (query.includes('SELECT context_data FROM projects')) {
                        return cb(null, {
                            context_data: JSON.stringify({
                                strategicGoals: ['Goal 1'],
                                challenges: ['Challenge 1'],
                                constraints: ['Constraint 1']
                            })
                        });
                    }
                    // Default: no rows
                    return cb(null, null);
                }
            });

            const result = await StageGateService.evaluateGate('proj-1', 'READINESS_GATE');

            expect(result.gateType).toBe('READINESS_GATE');
            expect(result.completionCriteria).toBeDefined();
            expect(result.completionCriteria.length).toBeGreaterThan(0);
            expect(result.status).toBe('READY');
        });

        it('should report failure if criteria missing', async () => {
            mockDb.get.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('SELECT * FROM projects')) {
                        return cb(null, { id: 'proj-1' });
                    }
                    if (query.includes('SELECT context_data FROM projects')) {
                        return cb(null, { context_data: JSON.stringify({}) });
                    }
                    return cb(null, null);
                }
            });

            const result = await StageGateService.evaluateGate('proj-1', 'READINESS_GATE');
            expect(result.status).toBe('NOT_READY');
            expect(result.missingElements.length).toBeGreaterThan(0);
        });
    });

    describe('passGate', () => {
        it('should record gate passage', async () => {
            mockDb.run.mockImplementation(function (...args) {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') cb.call({ changes: 1 }, null);
            });

            const result = await StageGateService.passGate('proj-1', 'READINESS_GATE', 'user-1', 'Approved');

            expect(result.status).toBe('PASSED');
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO stage_gates'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });
});
