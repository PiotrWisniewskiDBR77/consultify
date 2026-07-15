/**
 * AI Context Builder Tests
 * 
 * HIGH PRIORITY AI SERVICE - Must have 85%+ coverage
 * Tests context building, multi-layer context assembly, and PMO health integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AIContextBuilder from '../../../server/src/services/aiContextBuilder.js';
import { createUnifiedTestSetup } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';

describe('AIContextBuilder', () => {
    let mocks;

    beforeEach(() => {
        mocks = createUnifiedTestSetup();
        // Not provided by createUnifiedTestSetup — this service isn't covered by a
        // dedicated factory there; stub the two methods buildContext() calls.
        mocks.aiActionExecutor = {
            getPendingActions: vi.fn(),
            getPatternInfo: vi.fn()
        };

        // Setup specific AI service mocks with correct responses
        mocks.pmoHealthService.getHealthSnapshot.mockResolvedValue({
            projectId: 'test-project',
            projectName: 'Test Project',
            phase: { id: 1, name: 'Planning' },
            overall: 'healthy',
            metrics: {
                tasks: { overdueCount: 0, dueSoonCount: 1, blockedCount: 0 },
                decisions: { pendingCount: 2, overdueCount: 0 },
                initiatives: { atRiskCount: 0, blockedCount: 0 }
            },
            recommendations: []
        });

        mocks.aiSettingsService.getEffectiveSettings.mockResolvedValue({
            policyLevel: 'ASSISTED',
            proactivityMode: 'BALANCED',
            contextDepth: 'DETAILED',
            actionThreshold: 'MEDIUM'
        });

        mocks.aiActionExecutor.getPendingActions.mockResolvedValue([]);
        mocks.aiActionExecutor.getPatternInfo.mockResolvedValue(null);

        // Setup database mocks
        mocks.db.get.mockResolvedValue(null);
        mocks.db.all.mockResolvedValue([]);
        mocks.db.run.mockResolvedValue({ lastID: 1, changes: 1 });

        // Inject mock dependencies using unified pattern
        AIContextBuilder.setDependencies({
            db: mocks.db,
            PMOHealthService: mocks.pmoHealthService,
            AISettingsService: mocks.aiSettingsService,
            AIActionExecutor: mocks.aiActionExecutor
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('buildContext()', () => {
        it('should build complete context with all layers', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;

            // Mock all DB queries using the standardized mocks.db
            mocks.db.get.mockImplementation(async (query, params) => {
                if (query.includes('users')) {
                    if (userId === testUsers.admin.id) return { role: 'ADMIN' };
                    if (userId === testUsers.superadmin.id) return { role: 'SUPERADMIN' };
                    return { role: 'USER' };
                } else if (query.includes('ai_policies')) {
                    return {
                        policy_level: 'ASSISTED',
                        internet_enabled: 1,
                        audit_required: 1
                    };
                } else if (query.includes('organizations')) {
                    return { name: 'Test Org', plan: 'free', status: 'active' };
                } else if (query.includes('projects')) {
                    return {
                        id: projectId,
                        name: 'Test Project',
                        status: 'active',
                        current_phase: 'Assessment',
                        organization_id: orgId
                    };
                } else if (query.includes('initiatives')) {
                    return { total: 5, completed: 2 };
                } else if (query.includes('ai_organization_memory')) {
                    return { pmo_maturity: 'BASIC' };
                } else if (query.includes('rag_enabled')) {
                    return { rag_enabled: 1 };
                } else if (query.includes('phase_history')) {
                    return { phase_history: '[]' };
                }
                return null;
            });

            mocks.db.all.mockImplementation(async (query, params) => {
                if (query.includes('due_date') || query.includes('tasks')) return [];
                if (query.includes('initiatives')) return [];
                if (query.includes('decisions')) return [];
                if (query.includes('projects')) return [{ id: 'proj-1' }, { id: 'proj-2' }];
                return [];
            });

            const context = await AIContextBuilder.buildContext(userId, orgId, projectId);

            expect(context).toBeDefined();
            expect(context.platform).toBeDefined();
            expect(context.organization).toBeDefined();
            expect(context.project).toBeDefined();
            expect(context.execution).toBeDefined();
            expect(context.knowledge).toBeDefined();
            expect(context.external).toBeDefined();
            expect(context.pmo).toBeDefined();
            expect(context.builtAt).toBeDefined();
            expect(context.contextHash).toBeDefined();
        });

        it('should build context without projectId', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;

            mocks.db.get.mockImplementation(async (query, params) => {
                if (query.includes('users')) return { role: 'USER' };
                if (query.includes('ai_policies')) return { policy_level: 'ASSISTED' };
                if (query.includes('organizations')) return { name: 'Test Org' };
                return null;
            });

            const context = await AIContextBuilder.buildContext(userId, orgId, null);

            expect(context.project).toBeNull();
            expect(context.pmo.healthSnapshot).toBeNull();
        });

        it('should include PMO health snapshot when projectId provided', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;

            const healthSnapshot = {
                overall: 'healthy',
                metrics: {
                    initiatives: { total: 5, active: 3 },
                    tasks: { total: 20, completed: 10 }
                }
            };

            mocks.pmoHealthService.getHealthSnapshot.mockResolvedValue(healthSnapshot);

            mocks.db.get.mockImplementation(async () => ({}));

            const context = await AIContextBuilder.buildContext(userId, orgId, projectId);

            expect(context.pmo.healthSnapshot).toEqual(healthSnapshot);
            expect(mocks.pmoHealthService.getHealthSnapshot).toHaveBeenCalledWith(projectId);
        });

        it('should handle PMO health service errors gracefully', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;

            mocks.pmoHealthService.getHealthSnapshot.mockRejectedValue(new Error('Service unavailable'));

            mocks.db.get.mockImplementation(async () => ({}));

            const context = await AIContextBuilder.buildContext(userId, orgId, projectId);

            // Should still build context, but with null health snapshot
            expect(context).toBeDefined();
            expect(context.pmo.healthSnapshot).toBeNull();
        });

        it('should include options in context', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const options = {
                currentScreen: 'dashboard',
                selectedObjectId: 'obj-123',
                selectedObjectType: 'initiative'
            };

            mocks.db.get.mockImplementation(async () => ({}));

            const context = await AIContextBuilder.buildContext(userId, orgId, null, options);

            expect(context.currentScreen).toBe('dashboard');
            expect(context.selectedObjectId).toBe('obj-123');
            expect(context.selectedObjectType).toBe('initiative');
        });

        it('should filter context for PMO Docs focus mode', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;
            const options = { focusMode: 'pmo-docs' };

            mocks.db.get.mockImplementation(async () => ({}));

            const context = await AIContextBuilder.buildContext(userId, orgId, projectId, options);

            expect(context.focusMode).toBe('pmo-docs');
            // PMO docs mode should filter out project and execution data
            expect(context.project).toBeNull();
            expect(context.execution).toBeNull();
            expect(context.external).toBeNull();
        });

        it('should filter context for Project Data focus mode', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;
            const options = { focusMode: 'project-data' };

            mocks.db.get.mockImplementation(async () => ({}));

            const context = await AIContextBuilder.buildContext(userId, orgId, projectId, options);

            expect(context.focusMode).toBe('project-data');
            // Project data mode should keep project but filter knowledge and external
            expect(context.project).toBeDefined();
            expect(context.external).toBeNull();
        });

        it('should filter context for Research focus mode', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;
            const options = { focusMode: 'research' };

            mocks.db.get.mockImplementation(async () => ({}));

            const context = await AIContextBuilder.buildContext(userId, orgId, projectId, options);

            expect(context.focusMode).toBe('research');
            // Research mode should filter out external sources
            expect(context.external).toBeNull();
        });

        it('should filter context for Web focus mode', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;
            const options = { focusMode: 'web' };

            mocks.db.get.mockImplementation(async () => ({}));

            const context = await AIContextBuilder.buildContext(userId, orgId, projectId, options);

            expect(context.focusMode).toBe('web');
            // Web mode should filter out knowledge and execution
            expect(context.knowledge).toBeNull();
            expect(context.execution).toBeNull();
            expect(context.external).toBeDefined();
        });

        it('should not filter context for All focus mode', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;
            const options = { focusMode: 'all' };

            mocks.db.get.mockImplementation(async () => ({}));

            const context = await AIContextBuilder.buildContext(userId, orgId, projectId, options);

            expect(context.focusMode).toBe('all');
            // All mode should include all context layers
            expect(context.platform).toBeDefined();
            expect(context.organization).toBeDefined();
            expect(context.project).toBeDefined();
            expect(context.execution).toBeDefined();
            expect(context.knowledge).toBeDefined();
            expect(context.external).toBeDefined();
        });
    });

    describe('_buildPlatformContext()', () => {
        it('should build platform context with user role', async () => {
            const userId = testUsers.admin.id;
            const orgId = testOrganizations.org1.id;

            mocks.db.get.mockImplementation(async (query) => {
                if (query.includes('users')) return { role: 'ADMIN' };
                if (query.includes('ai_policies')) return {
                    policy_level: 'ASSISTED',
                    internet_enabled: 1,
                    audit_required: 1
                };
                return null;
            });

            const platform = await AIContextBuilder._buildPlatformContext(userId, orgId);

            expect(platform.role).toBe('ADMIN');
            expect(platform.tenantId).toBe(orgId);
            expect(platform.userId).toBe(userId);
            expect(platform.policyLevel).toBe('ASSISTED');
        });

        it('should map SUPERADMIN role correctly', async () => {
            const userId = testUsers.superadmin.id;
            const orgId = testOrganizations.org1.id;

            mocks.db.get.mockImplementation(async (query) => {
                if (query.includes('users')) return { role: 'SUPERADMIN' };
                return {};
            });

            const platform = await AIContextBuilder._buildPlatformContext(userId, orgId);

            expect(platform.role).toBe('SUPERADMIN');
        });
    });

    describe('_buildOrganizationContext()', () => {
        it('should build organization context', async () => {
            const orgId = testOrganizations.org1.id;

            mocks.db.get.mockImplementation(async () => ({
                name: 'Test Org',
                plan: 'enterprise',
                status: 'active'
            }));

            mocks.db.all.mockImplementation(async () => [{ id: 'proj-1' }, { id: 'proj-2' }]);

            const org = await AIContextBuilder._buildOrganizationContext(orgId);

            expect(org.organizationName).toBe('Test Org');
            expect(org.organizationId).toBe(orgId);
            expect(org.activeProjectCount).toBe(2);
        });
    });

    describe('_buildProjectContext()', () => {
        it('should build project context', async () => {
            const projectId = testProjects.project1.id;

            mocks.db.get.mockImplementation(async (query) => {
                if (query.includes('SELECT * FROM projects')) {
                    return {
                        id: projectId,
                        name: 'Test Project',
                        status: 'active',
                        current_phase: 'Assessment',
                        ai_role: 'MANAGER'
                    };
                } else if (query.includes('initiatives')) {
                    return { total: 5, completed: 2 };
                }
                return null;
            });

            const project = await AIContextBuilder._buildProjectContext(projectId);

            expect(project.projectName).toBe('Test Project');
            expect(project.projectId).toBe(projectId);
            expect(project.currentPhase).toBe('Assessment');
            expect(project.initiativeCount).toBe(5);
        });
    });
});
