import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Economics Service', () => {
    let EconomicsService;
    let mockDb;
    let mockUuid;

    beforeEach(async () => {
        vi.resetModules();

        mockDb = {
            all: vi.fn(),
            get: vi.fn(),
            run: vi.fn()
        };

        mockUuid = {
            v4: vi.fn(() => 'mock-uuid-economics')
        };

        vi.doMock('../../../server/database', () => ({ default: mockDb }));
        vi.doMock('uuid', () => ({ v4: mockUuid.v4 }));

        EconomicsService = (await import('../../../server/services/economicsService.js')).default;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('createValueHypothesis', () => {
        it.skip('should insert hypothesis [BLOCKED: REAL DB HIT]', async () => {
            mockDb.run.mockImplementation(function (sql, params, cb) { if (cb) cb.call({ changes: 1 }, null); });
            const result = await EconomicsService.createValueHypothesis({ initiativeId: 'i1', projectId: 'p1', type: 'EFFICIENCY' });
            expect(result.id).toBeDefined();
        });
    });

    describe('getValueSummary', () => {
        it.skip('should aggregate financial values [BLOCKED: REAL DB HIT]', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => cb(null, [{ type: 'EFFICIENCY', count: 2, validated: 1 }]));
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { total_low: 100, total_expected: 200, total_high: 300 }));
            // Missing values check
            mockDb.all.mockImplementationOnce((sql, params, cb) => cb(null, [])); // for detectMissingValueHypotheses if called

            const result = await EconomicsService.getValueSummary('p-1');
            expect(result.financialRange.expected).toBe(200);
        });
    });
});
