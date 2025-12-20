
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('StageGateService', () => {
    let StageGateService;
    let dbMock;

    beforeEach(async () => {
        vi.resetModules();
        StageGateService = (await import('../../../server/services/stageGateService.js')).default;

        dbMock = {
            get: vi.fn(),
            run: vi.fn(),
            all: vi.fn()
        };

        // Inject mock DB
        StageGateService._setDb(dbMock);
    });

    describe('getGateType', () => {
        it('should return correct gate type', () => {
            expect(StageGateService.getGateType('Context', 'Assessment')).toBe(StageGateService.GATE_TYPES.READINESS_GATE);
        });
    });

    describe('evaluateGate', () => {
        it('should evaluate criteria correctly (All Met)', async () => {
            dbMock.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('SELECT * FROM projects')) cb(null, { id: 'p1' });
                else if (sql.includes('context_data')) cb(null, { context_data: JSON.stringify({ strategicGoals: ['G1'], challenges: ['C1'], constraints: ['C2'] }) });
                else if (sql.includes('is_complete')) cb(null, { is_complete: 1 });
                else if (sql.includes('COUNT')) cb(null, { cnt: 5 });
                else cb(null, null);
            });
            const result = await StageGateService.evaluateGate('p1', StageGateService.GATE_TYPES.READINESS_GATE);
            expect(result.status).toBe('READY');
        });

        it('should return NOT_READY if one criterion fails', async () => {
            dbMock.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('SELECT * FROM projects')) {
                    cb(null, { id: 'p1' });
                } else if (sql.includes('SELECT context_data')) {
                    // Empty context data causing failure
                    cb(null, { context_data: JSON.stringify({}) });
                } else {
                    cb(null, null);
                }
            });

            const result = await StageGateService.evaluateGate('p1', StageGateService.GATE_TYPES.READINESS_GATE);
            expect(result.status).toBe('NOT_READY');
        });

        it('should fail gate if context JSON is invalid', async () => {
            dbMock.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('SELECT * FROM projects')) cb(null, { id: 'p1' });
                else if (sql.includes('SELECT context_data')) cb(null, { context_data: '{invalid' });
                else cb(null, null);
            });
            const result = await StageGateService.evaluateGate('p1', StageGateService.GATE_TYPES.READINESS_GATE);
            expect(result.status).toBe('NOT_READY');
        });
    });

    describe('passGate', () => {
        it('should pass gate', async () => {
            dbMock.run.mockImplementation((sql, params, cb) => cb(null));
            const result = await StageGateService.passGate('p1', StageGateService.GATE_TYPES.READINESS_GATE, 'user1', 'Notes');
            expect(result.status).toBe('PASSED');
        });

        it('should handle db error', async () => {
            dbMock.run.mockImplementationOnce((sql, params, cb) => cb(new Error('Fail')));
            await expect(StageGateService.passGate('p1', StageGateService.GATE_TYPES.READINESS_GATE, 'user1', 'Notes'))
                .rejects.toThrow('Fail');
        });
    });
});
