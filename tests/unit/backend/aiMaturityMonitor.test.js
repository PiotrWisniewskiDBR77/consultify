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
        it('should aggregate metrics into overall score', async () => {
            // Mock sub-query responses in order they are called (roughly)
            mockDb.all.mockImplementation((sql, params, cb) => {
                process.nextTick(() => {
                    const s = sql.toLowerCase();
                    // Planning: Initiatives
                    if (s.includes('from initiatives')) return cb(null, [{ id: 'i1', target_date: '2025-01-01', description: 'Long enough description for planning assessment' }]);
                    // Decision: Decisions
                    if (s.includes('from decisions')) return cb(null, []);
                    // Execution: Tasks
                    if (s.includes('from tasks')) return cb(null, []);
                    // Adoption: Status
                    if (s.includes('group by i.status') || s.includes('group by status')) return cb(null, []);

                    cb(null, []);
                });
            });

            mockDb.get.mockImplementation((sql, params, cb) => {
                process.nextTick(() => {
                    const s = sql.toLowerCase();
                    // Return appropriate counts for different queries
                    if (s.includes('count(*)')) {
                        return cb(null, { count: 0 }); // Default counts
                    }
                    cb(null, { count: 0 });
                });
            });

            mockDb.run.mockImplementation((sql, params, cb) => {
                if (cb) {
                    process.nextTick(() => {
                        cb.call({ changes: 1 }, null);
                    });
                }
            });

            const result = await AIMaturityMonitor.assessMaturity('p-1');

            expect(result.overall.score).toBeDefined();
            expect(result.overall.score).toBeGreaterThanOrEqual(0);
            expect(result.insights).toBeInstanceOf(Array);
        });
    });

    describe('benchmarkAgainstPractices', () => {
        it('should compare levels vs benchmarks', async () => {
            // Mock assessMaturity results by relying on mock DB flow
            mockDb.all.mockImplementation((sql, params, cb) => {
                process.nextTick(() => {
                    const s = sql.toLowerCase();
                    // Planning: Initiatives
                    if (s.includes('from initiatives')) return cb(null, [{ id: 'i1', target_date: '2025-01-01', description: 'Long enough' }]);
                    // Decision: Decisions
                    if (s.includes('from decisions')) return cb(null, []);
                    // Execution: Tasks
                    if (s.includes('from tasks')) return cb(null, []);
                    // Adoption: Status
                    if (s.includes('group by') && s.includes('status')) return cb(null, []);
                    cb(null, []);
                });
            });
            
            mockDb.get.mockImplementation((sql, params, cb) => {
                process.nextTick(() => {
                    const s = sql.toLowerCase();
                    if (s.includes('count(*)')) {
                        return cb(null, { count: 1 });
                    }
                    cb(null, { count: 1 });
                });
            });
            
            mockDb.run.mockImplementation((sql, params, cb) => {
                if (cb) {
                    process.nextTick(() => {
                        cb.call({ changes: 1 }, null);
                    });
                }
            });

            const result = await AIMaturityMonitor.benchmarkAgainstPractices('p-1');
            expect(result.comparison).toBeDefined();
            expect(result.comparison.planning).toBeDefined();
        });
    });
});
