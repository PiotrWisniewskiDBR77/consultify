import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const mockDb = vi.hoisted(() => ({
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
}));

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

        mockDb.get.mockImplementation((sql, params, callback) => {
            const cb = typeof callback === 'function' ? callback : (typeof params === 'function' ? params : null);
            if (typeof cb === 'function') cb(null, null);
        });

        mockDb.all.mockImplementation((sql, params, callback) => {
            const cb = typeof callback === 'function' ? callback : (typeof params === 'function' ? params : null);
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
            mockDb.get.mockImplementation((sql, params, callback) => {
                const cb = typeof callback === 'function' ? callback : (typeof params === 'function' ? params : null);
                if (typeof cb === 'function') {
                    cb(null, {
                        user_id: 'user-1',
                        week_start: '2024-01-01',
                        allocated_hours: 30,
                        available_hours: 40,
                        is_overloaded: 0,
                        initiative_allocations: '[]'
                    });
                }
            });

            const capacity = await CapacityService.getUserCapacity('user-1', '2024-01-01');
            expect(capacity.allocated_hours).toBe(30);
        });
    });

    describe('calculateUserCapacity', () => {
        it('should calculate capacity based on tasks', async () => {
            // Calculate Monday of this week to ensure tasks fall in the right week
            const today = new Date();
            const mondayThisWeek = new Date(today);
            mondayThisWeek.setDate(today.getDate() - today.getDay() + 1);
            mondayThisWeek.setHours(0, 0, 0, 0);
            
            // Use a date that's definitely in this week (Monday + 2 days = Wednesday)
            const thisWeekDate = new Date(mondayThisWeek);
            thisWeekDate.setDate(mondayThisWeek.getDate() + 2);

            mockDb.all.mockImplementation((sql, params, callback) => {
                const cb = typeof callback === 'function' ? callback : (typeof params === 'function' ? params : null);
                if (typeof cb === 'function') {
                    cb(null, [
                        { id: 't1', effort_estimate: 10, due_date: thisWeekDate.toISOString(), initiative_id: null, initiative_name: null },
                        { id: 't2', effort_estimate: 50, due_date: thisWeekDate.toISOString(), initiative_id: null, initiative_name: null }
                    ]);
                }
            });

            const capacity = await CapacityService.calculateUserCapacity('user-1', 'proj-1');

            expect(capacity).toHaveLength(4); // 4 weeks
            // This week should have both tasks (due this week) so 60 hours
            const thisWeek = capacity.find(w => w.allocatedHours > 0);
            expect(thisWeek).toBeDefined();
            if (thisWeek) {
                expect(thisWeek.allocatedHours).toBe(60);
                expect(thisWeek.isOverloaded).toBe(true); // 60 > 48 (40*1.2)
            }
        });
    });

    describe('detectOverloads', () => {
        it('should identify users with overloaded weeks', async () => {
            // Calculate Monday of this week to ensure tasks fall in the right week
            const today = new Date();
            const mondayThisWeek = new Date(today);
            mondayThisWeek.setDate(today.getDate() - today.getDay() + 1);
            mondayThisWeek.setHours(0, 0, 0, 0);
            
            // Use a date that's definitely in this week (Monday + 2 days = Wednesday)
            const thisWeekDate = new Date(mondayThisWeek);
            thisWeekDate.setDate(mondayThisWeek.getDate() + 2);

            // Mock users with tasks - use intelligent routing based on SQL and params
            mockDb.all.mockImplementation((sql, params, callback) => {
                const cb = typeof callback === 'function' ? callback : (typeof params === 'function' ? params : null);
                const actualParams = Array.isArray(params) ? params : [];
                const sqlStr = typeof sql === 'string' ? sql : '';
                
                if (typeof cb === 'function') {
                    // First query: SELECT DISTINCT assignee_id FROM tasks WHERE project_id = ?
                    if (sqlStr.includes('DISTINCT assignee_id') && actualParams[0] === 'proj-1') {
                        cb(null, [{ assignee_id: 'user-1' }]);
                        return;
                    }
                    // Second query: SELECT t.id... FROM tasks WHERE assignee_id = ? AND project_id = ?
                    // Check if it's the tasks query with both userId and projectId
                    if (sqlStr.includes('SELECT t.id') && sqlStr.includes('effort_estimate') && actualParams.length >= 2 && actualParams[0] === 'user-1' && actualParams[1] === 'proj-1') {
                        // Mock tasks for calculateUserCapacity - 60 hours will overload (40 * 1.2 = 48)
                        cb(null, [
                            { id: 't1', effort_estimate: 60, due_date: thisWeekDate.toISOString(), initiative_id: null, initiative_name: null }
                        ]);
                        return;
                    }
                    // Default: return empty array
                    cb(null, []);
                }
            });

            mockDb.get.mockImplementation((sql, params, callback) => {
                const cb = typeof callback === 'function' ? callback : (typeof params === 'function' ? params : null);
                if (typeof cb === 'function') {
                    cb(null, { first_name: 'John', last_name: 'Doe' });
                }
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
