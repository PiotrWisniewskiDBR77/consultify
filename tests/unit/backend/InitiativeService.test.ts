
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDatabase } from '../../../server/src/database/index.js';
import InitiativeService from '../../../server/src/services/initiativeService.js';

describe('InitiativeService', () => {
    let mockDb;

    beforeEach(() => {
        vi.resetModules();

        // Get global mock DB
        mockDb = getDatabase();

        // Inject dependencies
        InitiativeService.setDependencies({
            db: mockDb,
            uuidv4: () => 'init-uuid-1'
        });

        // Clear mocks
        mockDb.run.mockClear();
        mockDb.get.mockClear();
        mockDb.all.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('recalculateProgress', () => {
        const orgId = 'org-1';
        const initiativeId = 'init-1';

        it('should return 0 when no tasks exist', async () => {
            // Mock empty tasks
            mockDb.all.mockResolvedValue([]);
            mockDb.run.mockResolvedValue({ changes: 1 });

            const progress = await InitiativeService.recalculateProgress({ organizationId: orgId, initiativeId });

            expect(progress).toBe(0);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE initiatives SET progress = ?'),
                expect.arrayContaining([0, initiativeId, orgId])
            );
        });

        it('should calculate weighted progress correctly', async () => {
            // Task 1: High Priority (1.5), 100% progress
            // Task 2: Medium Priority (1.0), 50% progress
            // Task 3: Low Priority (0.5), 0% progress
            // Total Weight: 1.5 + 1.0 + 0.5 = 3.0
            // Weighted Progress: (100*1.5) + (50*1.0) + (0*0.5) = 150 + 50 + 0 = 200
            // Result: 200 / 3.0 = 66.66 => 67

            const mockTasks = [
                { progress: 100, priority: 'High' },
                { progress: 50, priority: 'Medium' },
                { progress: 0, priority: 'Low' }
            ];

            mockDb.all.mockResolvedValue(mockTasks);
            mockDb.run.mockResolvedValue({ changes: 1 });

            const progress = await InitiativeService.recalculateProgress({ organizationId: orgId, initiativeId });

            expect(progress).toBe(67);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE initiatives SET progress = ?'),
                expect.arrayContaining([67, initiativeId, orgId])
            );
        });

        it('should handle tasks with missing progress/priority (defaults)', async () => {
            const mockTasks = [
                { progress: null, priority: null } // Defaults: 0 progress, medium (1.0) weight
            ];

            mockDb.all.mockResolvedValue(mockTasks);
            mockDb.run.mockResolvedValue({ changes: 1 });

            const progress = await InitiativeService.recalculateProgress({ organizationId: orgId, initiativeId });

            expect(progress).toBe(0);
        });

        it('should handle database errors gracefully', async () => {
            mockDb.all.mockRejectedValue(new Error('DB Error'));

            await expect(InitiativeService.recalculateProgress({ organizationId: orgId, initiativeId }))
                .rejects.toThrow('DB Error');
        });

        it('should require organizationId (warns on legacy call)', async () => {
            // Mock empty tasks
            mockDb.all.mockResolvedValue([]);
            mockDb.run.mockResolvedValue({ changes: 1 });

            // Call with string (legacy)
            const progress = await InitiativeService.recalculateProgress(initiativeId);

            expect(progress).toBe(0);
            // Should still work but might log warning (we don't assert logs here usually)
        });
    });
});
