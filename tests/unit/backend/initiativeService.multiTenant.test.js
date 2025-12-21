import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock queryHelpers before import
const mockQueryHelpers = vi.hoisted(() => ({
    queryAll: vi.fn(),
    queryOne: vi.fn(),
    queryRun: vi.fn()
}));

vi.doMock('../../../server/utils/queryHelpers', () => mockQueryHelpers);

// Mock dependencies
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
};

import InitiativeService from '../../../server/services/initiativeService.js';

describe('InitiativeService - Multi-Tenant Isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        InitiativeService.setDependencies({ db: mockDb });

        // Default queryHelpers mocks
        mockQueryHelpers.queryAll.mockResolvedValue([]);
        mockQueryHelpers.queryRun.mockResolvedValue({ changes: 1, lastID: 0 });
    });

    describe('recalculateProgress with organizationId', () => {
        it('should filter tasks by organization_id AND initiative_id', async () => {
            // Simulate tasks only from orgA
            mockQueryHelpers.queryAll.mockImplementation((query, params) => {
                // Verify the query includes org_id filter
                expect(query).toContain('organization_id = ?');
                expect(query).toContain('initiative_id = ?');
                expect(params[0]).toBe('org-a');
                expect(params[1]).toBe('init-1');
                return Promise.resolve([{ progress: 100, priority: 'medium' }]);
            });

            const progress = await InitiativeService.recalculateProgress({
                organizationId: 'org-a',
                initiativeId: 'init-1'
            });

            expect(progress).toBe(100);
        });

        it('should update initiative with org-scoped WHERE clause', async () => {
            mockQueryHelpers.queryAll.mockResolvedValue([{ progress: 50, priority: 'high' }]);

            let updateQuery = '';
            let updateParams = [];
            mockQueryHelpers.queryRun.mockImplementation((query, params) => {
                updateQuery = query;
                updateParams = params;
                return Promise.resolve({ changes: 1, lastID: 0 });
            });

            await InitiativeService.recalculateProgress({
                organizationId: 'org-b',
                initiativeId: 'init-2'
            });

            // Verify UPDATE includes org_id in WHERE
            expect(updateQuery).toContain('organization_id = ?');
            expect(updateParams).toContain('org-b');
            expect(updateParams).toContain('init-2');
        });

        it('should NOT mix tasks from different orgs', async () => {
            // This is the critical isolation test
            // Even if an initiative_id exists in multiple orgs, each org should only see their tasks

            const orgATasks = [{ progress: 100, priority: 'high' }];
            const orgBTasks = [{ progress: 0, priority: 'low' }];

            mockQueryHelpers.queryAll.mockImplementation((query, params) => {
                const [orgId, initId] = params;
                if (orgId === 'org-a') {
                    return Promise.resolve(orgATasks);
                } else if (orgId === 'org-b') {
                    return Promise.resolve(orgBTasks);
                } else {
                    return Promise.resolve([]);
                }
            });

            const progressA = await InitiativeService.recalculateProgress({
                organizationId: 'org-a',
                initiativeId: 'shared-init'
            });

            const progressB = await InitiativeService.recalculateProgress({
                organizationId: 'org-b',
                initiativeId: 'shared-init'
            });

            // Org A has 100% completion, Org B has 0%
            expect(progressA).toBe(100);
            expect(progressB).toBe(0);
        });
    });
});
