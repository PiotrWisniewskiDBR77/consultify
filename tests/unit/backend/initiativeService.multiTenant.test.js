import { describe, it, expect, vi, beforeEach } from 'vitest';

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

        mockDb.run.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, { changes: 1 });
        });
    });

    describe('recalculateProgress with organizationId', () => {
        it('should filter tasks by organization_id AND initiative_id', async () => {
            // Simulate tasks only from orgA
            mockDb.all.mockImplementation((query, params, cb) => {
                // Verify the query includes org_id filter
                expect(query).toContain('organization_id = ?');
                expect(query).toContain('initiative_id = ?');
                expect(params[0]).toBe('org-a');
                expect(params[1]).toBe('init-1');
                cb(null, [{ progress: 100, priority: 'medium' }]);
            });

            const progress = await InitiativeService.recalculateProgress({
                organizationId: 'org-a',
                initiativeId: 'init-1'
            });

            expect(progress).toBe(100);
        });

        it('should update initiative with org-scoped WHERE clause', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                cb(null, [{ progress: 50, priority: 'high' }]);
            });

            let updateQuery = '';
            let updateParams = [];
            mockDb.run.mockImplementation((query, params, cb) => {
                updateQuery = query;
                updateParams = params;
                if (typeof cb === 'function') cb(null);
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

            mockDb.all.mockImplementation((query, params, cb) => {
                const [orgId, initId] = params;
                if (orgId === 'org-a') {
                    cb(null, orgATasks);
                } else if (orgId === 'org-b') {
                    cb(null, orgBTasks);
                } else {
                    cb(null, []);
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
