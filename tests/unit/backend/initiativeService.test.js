import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock queryHelpers before import
const mockQueryHelpers = vi.hoisted(() => ({
    queryAll: vi.fn(),
    queryOne: vi.fn(),
    queryRun: vi.fn(),
    parseJsonFields: vi.fn((row) => row)
}));

vi.mock('../../../server/utils/queryHelpers', () => mockQueryHelpers);

// Mock dependencies
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
};

import InitiativeService from '../../../server/services/initiativeService.js';

describe('InitiativeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        InitiativeService.setDependencies({ db: mockDb });

        // Default queryHelpers mocks
        mockQueryHelpers.queryAll.mockResolvedValue([]);
        mockQueryHelpers.queryRun.mockResolvedValue({ changes: 1, lastID: 0 });
    });

    describe('recalculateProgress', () => {
        it('should return 0 when no initiativeId provided', async () => {
            const progress = await InitiativeService.recalculateProgress(null);
            expect(progress).toBe(0);
        });

        it('should handle database error during fetch', async () => {
            mockQueryHelpers.queryAll.mockRejectedValue(new Error('DB Fetch Error'));

            await expect(InitiativeService.recalculateProgress({ organizationId: 'org-1', initiativeId: 'init-1' })).rejects.toThrow('DB Fetch Error');
        });

        it('should set progress to 0 if no tasks found', async () => {
            mockQueryHelpers.queryAll.mockResolvedValue([]);

            const progress = await InitiativeService.recalculateProgress({ organizationId: 'org-1', initiativeId: 'init-1' });

            expect(progress).toBe(0);
            expect(mockQueryHelpers.queryRun).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE initiatives'),
                expect.arrayContaining(['org-1', 'init-1'])
            );
        });

        it('should calculate weighted progress correctly', async () => {
            // Task 1: High Priority (1.5), 100% progress
            // Task 2: Medium Priority (1.0), 50% progress
            // Task 3: Low Priority (0.5), 0% progress
            // Total Weight: 1.5 + 1.0 + 0.5 = 3.0
            // Weighted Progress: (100*1.5) + (50*1.0) + (0*0.5) = 150 + 50 + 0 = 200
            // Result: 200 / 3.0 = 66.66 => 67

            mockQueryHelpers.queryAll.mockResolvedValue([
                { progress: 100, priority: 'High' },
                { progress: 50, priority: 'Medium' },
                { progress: 0, priority: 'Low' }
            ]);

            const progress = await InitiativeService.recalculateProgress({ organizationId: 'org-1', initiativeId: 'init-1' });

            expect(progress).toBe(67);
            expect(mockQueryHelpers.queryRun).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE initiatives'),
                expect.arrayContaining([67, 'org-1', 'init-1'])
            );
        });

        it('should handle tasks with missing progress/priority', async () => {
            mockQueryHelpers.queryAll.mockResolvedValue([
                { progress: null, priority: null } // Defaults: 0 progress, medium (1.0) weight
            ]);

            const progress = await InitiativeService.recalculateProgress({ organizationId: 'org-1', initiativeId: 'init-1' });

            // Weight: 1.0, Progress: 0 => 0 / 1 = 0
            expect(progress).toBe(0);
        });

        it('should handle database error during update', async () => {
            mockQueryHelpers.queryAll.mockResolvedValue([{ progress: 50, priority: 'Medium' }]);
            mockQueryHelpers.queryRun.mockRejectedValue(new Error('Update failed'));

            await expect(InitiativeService.recalculateProgress({ organizationId: 'org-1', initiativeId: 'init-1' })).rejects.toThrow('Update failed');
        });
    });
});
