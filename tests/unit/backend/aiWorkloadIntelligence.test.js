import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('AI Workload Intelligence Service', () => {
    let AIWorkloadIntelligence;
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
            v4: vi.fn(() => 'mock-snapshot-id')
        };

        vi.doMock('../../../server/database', () => ({ default: mockDb }));
        vi.doMock('uuid', () => ({ v4: mockUuid.v4 }));

        AIWorkloadIntelligence = (await import('../../../server/services/aiWorkloadIntelligence.js')).default;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Logic: _getWorkloadStatus', () => {
        it('should classify utilization correctly', () => {
            expect(AIWorkloadIntelligence._getWorkloadStatus(40)).toBe('underutilized');
            expect(AIWorkloadIntelligence._getWorkloadStatus(60)).toBe('optimal');
            expect(AIWorkloadIntelligence._getWorkloadStatus(90)).toBe('high');
            expect(AIWorkloadIntelligence._getWorkloadStatus(110)).toBe('overloaded');
            expect(AIWorkloadIntelligence._getWorkloadStatus(130)).toBe('critical');
        });
    });

    describe('Logic: _calculateBurnoutRisk', () => {
        it('should calculate risk score based on factors', () => {
            expect(AIWorkloadIntelligence._calculateBurnoutRisk(121, 2, 2)).toBe('high');
            expect(AIWorkloadIntelligence._calculateBurnoutRisk(50, 0, 0)).toBe('low');
        });
    });

    describe('getPortfolioWorkload', () => {
        it.skip('should calculate workload metrics from DB data [BLOCKED: REAL DB HIT]', async () => {
            const mockUsers = [
                { id: 'u1', first_name: 'John', last_name: 'Doe', role: 'Dev', active_tasks: 5, active_initiatives: 1, blocked_tasks: 0, overdue_tasks: 0 }
            ];
            const mockProfiles = [{ user_id: 'u1', default_weekly_hours: 40 }];

            mockDb.all.mockImplementation((sql, params, cb) => {
                const s = sql.toLowerCase();
                if (s.includes('from users')) return cb(null, mockUsers);
                if (s.includes('user_capacity_profile')) return cb(null, mockProfiles);
                cb(null, []);
            });

            const result = await AIWorkloadIntelligence.getPortfolioWorkload('org-1');

            expect(result.summary.totalUsers).toBe(1);
            expect(result.users[0].userId).toBe('u1');
            expect(result.users[0].utilizationPercent).toBe(55);
        });
    });

    describe('detectOverAllocation', () => {
        it.skip('should detect users with weeks exceeding capacity [BLOCKED: REAL DB HIT]', async () => {
            const mockProjectUsers = [{ id: 'u1', task_count: 5 }];
            const mockWeeklyTasks = [{ week: '2025-01', effort: 50 }]; // > 40
            const mockProfile = { default_weekly_hours: 40 };

            mockDb.all.mockImplementation((sql, params, cb) => {
                const s = sql.toLowerCase();
                if (s.includes('select distinct')) return cb(null, mockProjectUsers);
                if (s.includes('group by strftime')) return cb(null, mockWeeklyTasks);
                cb(null, []);
            });
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, mockProfile));

            const result = await AIWorkloadIntelligence.detectOverAllocation('p-1');

            expect(result.hasOverAllocation).toBe(true);
        });
    });

    describe('suggestRebalancing', () => {
        it.skip('should return no suggestions if no over-allocation [BLOCKED: REAL DB HIT]', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => cb(null, []));
            const result = await AIWorkloadIntelligence.suggestRebalancing('p-1');
            expect(result.suggestionsNeeded).toBe(false);
        });

        it.skip('should suggest reassignment when capacity exists [BLOCKED: REAL DB HIT]', async () => {
            mockDb.all.mockImplementation((sql, params, cb) => {
                const s = sql.toLowerCase();
                if (s.includes('select distinct') && s.includes('from tasks')) return cb(null, [{ id: 'u1', first_name: 'Over', last_name: 'Loaded', task_count: 5 }]);
                if (s.includes('group by strftime')) return cb(null, [{ week: '2025-01', effort: 60 }]);
                if (s.includes('u.id in (select distinct assignee_id')) return cb(null, [{ id: 'u2', first_name: 'Free', last_name: 'Man', task_count: 1, capacity: 40 }]);
                if (s.includes('from tasks') && s.includes('limit 5')) return cb(null, [{ id: 't1', effort_estimate: 8 }]);
                cb(null, []);
            });
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { default_weekly_hours: 40 }));

            const result = await AIWorkloadIntelligence.suggestRebalancing('p-1');
            expect(result.suggestionsNeeded).toBe(true);
        });
    });
});
