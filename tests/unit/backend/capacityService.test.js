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

vi.mock('uuid', () => ({
    v4: () => 'uuid-1234'
}));

import CapacityService from '../../../server/services/capacityService.js';

describe('CapacityService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockDb.get.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, null);
        });

        mockDb.all.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, []);
        });
    });

    describe('getUserCapacity', () => {
        it('should return default capacity if not found', async () => {
            const capacity = await CapacityService.getUserCapacity('user-1', '2024-01-01');

            expect(capacity.allocatedHours).toBe(0);
            expect(capacity.availableHours).toBe(40);
        });

        it('should return stored capacity', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        user_id: 'user-1',
                        allocated_hours: 30,
                        available_hours: 40,
                        is_overloaded: 0
                    });
                }
            });

            const capacity = await CapacityService.getUserCapacity('user-1', '2024-01-01');
            expect(capacity.allocated_hours).toBe(30);
        });
    });

    describe('calculateUserCapacity', () => {
        it('should calculate capacity based on tasks', async () => {
            // Mock current date to ensure deterministic week buckets
            // But implementation uses `new Date()`, so we might have minor bucket shifts
            // We'll rely on relative week logic

            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [
                        { id: 't1', effort_estimate: 10, due_date: new Date().toISOString() }, // This week
                        { id: 't2', effort_estimate: 50, due_date: new Date().toISOString() }  // Overload
                    ]);
                }
            });

            const capacity = await CapacityService.calculateUserCapacity('user-1', 'proj-1');

            expect(capacity).toHaveLength(4); // 4 weeks
            // This week should have both tasks (due today) so 60 hours
            const thisWeek = capacity.find(w => w.allocatedHours > 0);
            expect(thisWeek.allocatedHours).toBe(60);
            expect(thisWeek.isOverloaded).toBe(true); // 60 > 48 (40*1.2)
        });
    });

    describe('detectOverloads', () => {
        it('should identify users with overloaded weeks', async () => {
            // Mock users with tasks
            mockDb.all.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('DISTINCT assignee_id')) {
                        cb(null, [{ assignee_id: 'user-1' }]);
                    } else if (query.includes('effort_estimate')) {
                        // Mock tasks for calculateUserCapacity
                        cb(null, [
                            { id: 't1', effort_estimate: 60, due_date: new Date().toISOString() }
                        ]);
                    } else {
                        cb(null, []);
                    }
                }
            });

            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') cb(null, { first_name: 'John', last_name: 'Doe' });
            });

            const result = await CapacityService.detectOverloads('proj-1');

            expect(result.hasOverloads).toBe(true);
            expect(result.overloadedUsers).toHaveLength(1);
            expect(result.overloadedUsers[0].userName).toBe('John Doe');
        });
    });

    describe('suggestResolutions', () => {
        it('should suggest REASSIGN for sustained overload', () => {
            const overloads = {
                overloadedUsers: [{
                    userId: 'u1',
                    userName: 'John',
                    sustainedOverload: true,
                    overloadedWeeks: [{}, {}]
                }]
            };

            const suggestions = CapacityService.suggestResolutions(overloads);
            expect(suggestions[0].type).toBe('REASSIGN');
        });

        it('should suggest RESEQUENCE for peak overload', () => {
            const overloads = {
                overloadedUsers: [{
                    userId: 'u1',
                    userName: 'John',
                    sustainedOverload: false, // Single week
                    overloadedWeeks: [{}]
                }]
            };

            const suggestions = CapacityService.suggestResolutions(overloads);
            expect(suggestions[0].type).toBe('RESEQUENCE');
        });
    });
});
