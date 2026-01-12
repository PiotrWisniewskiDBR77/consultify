/**
 * AI Context Builder Tests
 * 
 * HIGH PRIORITY AI SERVICE - Must have 85%+ coverage
 * Tests context building, multi-layer context assembly, and PMO health integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AIContextBuilder from '../../../server/services/aiContextBuilder.js';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';

describe('AIContextBuilder', () => {
    let mockDb;
    let mockPMOHealthService;
    let mockAISettingsService;
    let mockAIActionExecutor;

    beforeEach(() => {
        mockDb = createMockDb();

        mockPMOHealthService = {
            getHealthSnapshot: vi.fn().mockResolvedValue({
                overall: 'healthy',
                metrics: {}
            })
        };

        mockAISettingsService = {
            getEffectiveSettings: vi.fn().mockResolvedValue({
                policyLevel: 'ASSISTED',
                proactivityMode: 'BALANCED'
            })
        };

        mockAIActionExecutor = {
            getPendingActions: vi.fn().mockResolvedValue([]),
            getPatternInfo: vi.fn().mockResolvedValue(null)
        };

        // Inject mock dependencies
        AIContextBuilder.setDependencies({
            db: mockDb,
            PMOHealthService: mockPMOHealthService,
            AISettingsService: mockAISettingsService,
            AIActionExecutor: mockAIActionExecutor
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

            // Mock all DB queries using the standardized mockDb
            mockDb.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (query.includes('users')) {
                    process.nextTick(() => cb(null, { role: 'USER' }));
                } else if (query.includes('ai_policies')) {
                    process.nextTick(() => cb(null, { policy_level: 'ASSISTED' }));
                } else if (query.includes('organizations')) {
                    process.nextTick(() => cb(null, { name: 'Test Org', plan: 'free' }));
                } else if (query.includes('projects')) {
                    process.nextTick(() => cb(null, { name: 'Test Project', status: 'active' }));
                } else {
                    process.nextTick(() => cb(null, null));
                }
                return mockDb;
            });

            mockDb.all.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                process.nextTick(() => cb(null, []));
                return mockDb;
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

            mockDb.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (query.includes('users')) {
                    process.nextTick(() => cb(null, { role: 'USER' }));
                } else if (query.includes('ai_policies')) {
                    process.nextTick(() => cb(null, { policy_level: 'ASSISTED' }));
                } else if (query.includes('organizations')) {
                    process.nextTick(() => cb(null, { name: 'Test Org' }));
                } else {
                    process.nextTick(() => cb(null, null));
                }
                return mockDb;
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

            mockPMOHealthService.getHealthSnapshot.mockResolvedValue(healthSnapshot);

            mockDb.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                process.nextTick(() => cb(null, {}));
                return mockDb;
            });

            const context = await AIContextBuilder.buildContext(userId, orgId, projectId);

            expect(context.pmo.healthSnapshot).toEqual(healthSnapshot);
            expect(mockPMOHealthService.getHealthSnapshot).toHaveBeenCalledWith(projectId);
        });

        it('should handle PMO health service errors gracefully', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;

            mockPMOHealthService.getHealthSnapshot.mockRejectedValue(new Error('Service unavailable'));

            mockDb.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                process.nextTick(() => cb(null, {}));
                return mockDb;
            });

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

            mockDb.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                process.nextTick(() => cb(null, {}));
                return mockDb;
            });

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

            mockDb.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                process.nextTick(() => cb(null, {}));
                return mockDb;
            });

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

            mockDb.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                process.nextTick(() => cb(null, {}));
                return mockDb;
            });

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

            mockDb.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                process.nextTick(() => cb(null, {}));
                return mockDb;
            });

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

            mockDb.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                process.nextTick(() => cb(null, {}));
                return mockDb;
            });

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

            mockDb.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                process.nextTick(() => cb(null, {}));
                return mockDb;
            });

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

            mockDb.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (query.includes('users')) {
                    process.nextTick(() => cb(null, { role: 'ADMIN' }));
                } else if (query.includes('ai_policies')) {
                    process.nextTick(() => cb(null, {
                        policy_level: 'ASSISTED',
                        internet_enabled: 1,
                        audit_required: 1
                    }));
                } else {
                    process.nextTick(() => cb(null, null));
                }
                return mockDb;
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

            mockDb.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (query.includes('users')) {
                    process.nextTick(() => cb(null, { role: 'SUPERADMIN' }));
                } else {
                    process.nextTick(() => cb(null, {}));
                }
                return mockDb;
            });

            const platform = await AIContextBuilder._buildPlatformContext(userId, orgId);

            expect(platform.role).toBe('SUPERADMIN');
        });
    });

    describe('_buildOrganizationContext()', () => {
        it('should build organization context', async () => {
            const orgId = testOrganizations.org1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                process.nextTick(() => cb(null, {
                    name: 'Test Org',
                    plan: 'enterprise',
                    status: 'active'
                }));
                return mockDb;
            });

            mockDb.all.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                process.nextTick(() => cb(null, [{ id: 'proj-1' }, { id: 'proj-2' }]));
                return mockDb;
            });

            const org = await AIContextBuilder._buildOrganizationContext(orgId);

            expect(org.organizationName).toBe('Test Org');
            expect(org.organizationId).toBe(orgId);
            expect(org.activeProjectCount).toBe(2);
        });
    });

    describe('_buildProjectContext()', () => {
        it('should build project context', async () => {
            const projectId = testProjects.project1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                if (query.includes('SELECT * FROM projects')) {
                    process.nextTick(() => cb(null, {
                        id: projectId,
                        name: 'Test Project',
                        status: 'active',
                        current_phase: 'Assessment',
                        ai_role: 'MANAGER'
                    }));
                } else if (query.includes('initiatives')) {
                    process.nextTick(() => cb(null, { total: 5, completed: 2 }));
                } else {
                    process.nextTick(() => cb(null, null));
                }
                return mockDb;
            });

            const project = await AIContextBuilder._buildProjectContext(projectId);

            expect(project.projectName).toBe('Test Project');
            expect(project.projectId).toBe(projectId);
            expect(project.currentPhase).toBe('Assessment');
            expect(project.initiativeCount).toBe(5);
        });
    });
});
