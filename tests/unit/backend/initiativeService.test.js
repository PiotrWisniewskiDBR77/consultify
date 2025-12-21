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

import InitiativeService from '../../../server/services/initiativeService.js';

describe('InitiativeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default DB mocks
        mockDb.all.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, []);
        });

        mockDb.run.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, { changes: 1 });
        });
    });

    describe('recalculateProgress', () => {
        it('should return 0 when no initiativeId provided', async () => {
            const progress = await InitiativeService.recalculateProgress(null);
            expect(progress).toBe(0);
        });

        it('should handle database error during fetch', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') cb(new Error('DB Fetch Error'));
            });

            await expect(InitiativeService.recalculateProgress('init-1')).rejects.toThrow('DB Fetch Error');
        });

        it('should set progress to 0 if no tasks found', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') cb(null, []);
            });

            const progress = await InitiativeService.recalculateProgress('init-1');

            expect(progress).toBe(0);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE initiatives'),
                [0, 'init-1'], // Changed call signature to match simplified flow in service
                expect.any(Function)
            );
            // Note: In service implementation, if no tasks, it assumes promise resolves 0 
            // but effectively mockDb.run is called. However, await logic is simpler there.
        });

        it('should calculate weighted progress correctly', async () => {
            // Task 1: High Priority (1.5), 100% progress
            // Task 2: Medium Priority (1.0), 50% progress
            // Task 3: Low Priority (0.5), 0% progress
            // Total Weight: 1.5 + 1.0 + 0.5 = 3.0
            // Weighted Progress: (100*1.5) + (50*1.0) + (0*0.5) = 150 + 50 + 0 = 200
            // Result: 200 / 3.0 = 66.66 => 67

            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [
                        { progress: 100, priority: 'High' },
                        { progress: 50, priority: 'Medium' },
                        { progress: 0, priority: 'Low' }
                    ]);
                }
            });

            const progress = await InitiativeService.recalculateProgress('init-1');

            expect(progress).toBe(67);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE initiatives'),
                [67, 'init-1'],
                expect.any(Function)
            );
        });

        it('should handle tasks with missing progress/priority', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [
                        { progress: null, priority: null } // Defaults: 0 progress, medium (1.0) weight
                    ]);
                }
            });

            const progress = await InitiativeService.recalculateProgress('init-1');

            // Weight: 1.0, Progress: 0 => 0 / 1 = 0
            expect(progress).toBe(0);
        });

        it('should handle database error during update', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [{ progress: 50, priority: 'Medium' }]);
                }
            });

            mockDb.run.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') cb(new Error('Update failed'));
            });

            await expect(InitiativeService.recalculateProgress('init-1')).rejects.toThrow('Update failed');
        });
    });
});
