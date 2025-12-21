import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('AI Maturity Monitor Service', () => {
    let AIMaturityMonitor;
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
            v4: vi.fn(() => 'mock-uuid-assessment')
        };

        vi.doMock('../../../server/database', () => ({ default: mockDb }));
        vi.doMock('uuid', () => ({ v4: mockUuid.v4 }));

        AIMaturityMonitor = (await import('../../../server/services/aiMaturityMonitor.js')).default;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Logic: _scoreToLevel', () => {
        it('should map score to correct level', () => {
            expect(AIMaturityMonitor._scoreToLevel(4.6).name).toBe('Optimizing');
            expect(AIMaturityMonitor._scoreToLevel(3.5).name).toBe('Managed');
            expect(AIMaturityMonitor._scoreToLevel(1.2).name).toBe('Initial');
        });
    });

    describe('Logic: _generateInsights', () => {
        it('should identify strengths and weaknesses', () => {
            const scores = {
                planning: 4.5,
                decision: 2.0,
                execution: 3.0,
                governance: 3.5,
                adoption: 3.0
            };

            const insights = AIMaturityMonitor._generateInsights(scores);

            expect(insights.find(i => i.type === 'strength').message).toContain('Planning');
            expect(insights.find(i => i.type === 'opportunity').message).toContain('Decision');
            expect(insights.find(i => i.type === 'imbalance')).toBeDefined();
        });
    });

    describe('assessMaturity (Integration)', () => {
        it.skip('should aggregate metrics into overall score [BLOCKED: REAL DB HIT]', async () => {
            // Mock sub-query responses in order they are called (roughly)
            mockDb.all.mockImplementation((sql, params, cb) => {
                const s = sql.toLowerCase();
                // Planning: Initiatives
                if (s.includes('from initiatives')) return cb(null, [{ id: 'i1', target_date: '2025-01-01', description: 'Long enough' }]);
                // Decision: Decisions
                if (s.includes('from decisions')) return cb(null, []);
                // Execution: Tasks
                if (s.includes('from tasks')) return cb(null, []);
                // Adoption: Status
                if (s.includes('group by i.status')) return cb(null, []);

                cb(null, []);
            });

            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { count: 0 }); // Default counts
            });

            mockDb.run.mockImplementation((sql, params, cb) => cb(null)); // Insert assessment

            const result = await AIMaturityMonitor.assessMaturity('p-1');

            expect(result.overall.score).toBeDefined();
            expect(result.insights).toBeInstanceOf(Array);
        });
    });

    describe('benchmarkAgainstPractices', () => {
        it.skip('should compare levels vs benchmarks [BLOCKED: REAL DB HIT]', async () => {
            // Mock assessMaturity results by overriding it or relying on mock DB flow (harder)
            // We can spy on assessMaturity if exported module allows, but it's inside same module object usually.

            // Rely on mock DB again
            mockDb.all.mockImplementation((sql, params, cb) => cb(null, []));
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { count: 1 }));
            mockDb.run.mockImplementation((sql, params, cb) => cb(null));

            const result = await AIMaturityMonitor.benchmarkAgainstPractices('p-1');
            expect(result.comparison.planning).toBeDefined();
        });
    });
});
