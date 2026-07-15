import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

// Import the TS source directly
import InitiativeService from '../../../server/src/services/initiativeService.ts';

describe('InitiativeService - Multi-Tenant Isolation', () => {
    let mocks;

    beforeEach(() => {
        mocks = setupStandardTest();
        vi.clearAllMocks();

        // Set dependencies on the singleton instance using unified pattern
        InitiativeService.setDependencies({ db: mocks.db });

        // Default DB mocks using unified infrastructure
        mocks.db.all.mockResolvedValue([]);
        mocks.db.run.mockResolvedValue({ changes: 1, lastID: 0 });
    });

    describe('recalculateProgress with organizationId', () => {
        it('should filter tasks by organization_id AND initiative_id', async () => {
            // Simulate tasks from DB
            mocks.db.all.mockImplementation((query, params) => {
                // Verify the query includes org_id filter
                if (query.includes('FROM tasks')) {
                    expect(query).toContain('organization_id = ?');
                    expect(query).toContain('initiative_id = ?');
                    expect(params).toContain('org-a');
                    expect(params).toContain('init-1');
                    return Promise.resolve([{ progress: 100, priority: 'medium' }]);
                }
                return Promise.resolve([]);
            });

            const progress = await InitiativeService.recalculateProgress({
                organizationId: 'org-a',
                initiativeId: 'init-1'
            });

            expect(progress).toBe(100);
        });

        it('should update initiative with org-scoped WHERE clause', async () => {
            mocks.db.all.mockResolvedValue([{ progress: 50, priority: 'high' }]);

            let updateQuery = '';
            let updateParams = [];
            mocks.db.run.mockImplementation((query, params) => {
                if (query.includes('UPDATE initiatives')) {
                    updateQuery = query;
                    updateParams = params;
                }
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

            mocks.db.all.mockImplementation((query, params) => {
                if (query.includes('FROM tasks')) {
                    const orgId = params.find(p => p === 'org-a' || p === 'org-b');
                    if (orgId === 'org-a') {
                        return Promise.resolve(orgATasks);
                    } else if (orgId === 'org-b') {
                        return Promise.resolve(orgBTasks);
                    }
                }
                return Promise.resolve([]);
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
