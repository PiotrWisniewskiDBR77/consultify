/**
 * AI Policy Engine Tests
 * 
 * HIGH PRIORITY AI SERVICE - Must have 85%+ coverage
 * Tests policy enforcement, regulatory mode, and action permissions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AIPolicyEngine from '../../../server/src/services/aiPolicyEngine.js';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';

describe('AIPolicyEngine', () => {
    let mocks;

    beforeEach(() => {
        mocks = setupStandardTest();

        // Setup specific service mocks
        mocks.regulatoryModeGuard = {
            isEnabled: vi.fn().mockResolvedValue(false),
            getRegulatoryPrompt: vi.fn().mockReturnValue('Regulatory prompt')
        };

        mocks.aiRoleGuard = {
            getProjectRole: vi.fn().mockResolvedValue('ADVISOR'),
            getRoleCapabilities: vi.fn().mockReturnValue({
                canExplain: true,
                canCreateDrafts: false,
                canExecute: false
            }),
            getRoleDescription: vi.fn().mockReturnValue('Advisor role')
        };

        // Inject dependencies using unified pattern
        AIPolicyEngine.setDependencies({
            db: mocks.db,
            RegulatoryModeGuard: mocks.regulatoryModeGuard,
            AIRoleGuard: mocks.aiRoleGuard
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getEffectivePolicy()', () => {
        it('should return ADVISORY policy when regulatory mode is enabled', async () => {
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;
            const userId = testUsers.user.id;

            mockRegulatoryModeGuard.isEnabled.mockResolvedValue(true);

            const policy = await AIPolicyEngine.getEffectivePolicy(orgId, projectId, userId);

            expect(policy.policyLevel).toBe('ADVISORY');
            expect(policy.maxPolicyLevel).toBe('ADVISORY');
            expect(policy.regulatoryModeEnabled).toBe(true);
            expect(policy.projectAIRole).toBe('ADVISOR');
            expect(policy.roleCapabilities.canCreateDrafts).toBe(false);
        });

        it('should return organization policy when no project override', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = testUsers.user.id;

            mockDb.get.mockImplementation(async (query, params) => {
                if (query.includes('ai_policies')) {
                    return {
                        policy_level: 'ASSISTED',
                        max_policy_level: 'PROACTIVE',
                        internet_enabled: 1,
                        audit_required: 1,
                        default_ai_role: 'PMO_MANAGER'
                    };
                }
                return null;
            });

            const policy = await AIPolicyEngine.getEffectivePolicy(orgId, null, userId);

            expect(policy.policyLevel).toBe('ASSISTED');
            expect(policy.maxPolicyLevel).toBe('PROACTIVE');
            expect(policy.internetEnabled).toBe(true);
            expect(policy.auditRequired).toBe(true);
        });

        it('should apply project-level override (can only reduce)', async () => {
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;
            const userId = testUsers.user.id;

            mockDb.get.mockImplementation(async (query, params) => {
                if (query.includes('ai_policies')) {
                    return {
                        policy_level: 'PROACTIVE',
                        max_policy_level: 'AUTOPILOT'
                    };
                } else if (query.includes('projects')) {
                    return {
                        governance_settings: JSON.stringify({
                            aiPolicyOverride: 'ASSISTED'
                        })
                    };
                }
                return null;
            });

            const policy = await AIPolicyEngine.getEffectivePolicy(orgId, projectId, userId);

            // Project override should reduce from PROACTIVE to ASSISTED
            expect(policy.policyLevel).toBe('ASSISTED');
        });

        it('should not allow project override to exceed max level', async () => {
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;
            const userId = testUsers.user.id;

            mockDb.get.mockImplementation(async (query, params) => {
                if (query.includes('ai_policies')) {
                    return {
                        policy_level: 'ASSISTED',
                        max_policy_level: 'ASSISTED' // Max is ASSISTED
                    };
                } else if (query.includes('projects')) {
                    return {
                        governance_settings: JSON.stringify({
                            aiPolicyOverride: 'PROACTIVE' // Try to exceed max
                        })
                    };
                }
                return null;
            });

            const policy = await AIPolicyEngine.getEffectivePolicy(orgId, projectId, userId);

            // Should be capped at max level
            expect(policy.policyLevel).toBe('ASSISTED');
        });

        it('should include user preferences', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = testUsers.user.id;

            mockDb.get.mockImplementation(async (query, params) => {
                if (query.includes('ai_policies')) {
                    return { policy_level: 'ASSISTED' };
                } else if (query.includes('ai_user_preferences')) {
                    return {
                        preferred_tone: 'FRIENDLY',
                        education_mode: 1
                    };
                }
                return null;
            });

            const policy = await AIPolicyEngine.getEffectivePolicy(orgId, null, userId);

            expect(policy.userTone).toBe('FRIENDLY');
            expect(policy.educationMode).toBe(true);
        });
    });

    describe('canPerformAction()', () => {
        it('should allow EXPLAIN_CONTEXT for ADVISORY policy', async () => {
            const actionType = 'EXPLAIN_CONTEXT';
            const orgId = testOrganizations.org1.id;

            mockDb.get.mockImplementation(async (query, params) => {
                return { policy_level: 'ADVISORY' };
            });

            const result = await AIPolicyEngine.canPerformAction(actionType, orgId);

            expect(result.allowed).toBe(true);
        });

        it('should allow CREATE_DRAFT_TASK for ASSISTED policy', async () => {
            const actionType = 'CREATE_DRAFT_TASK';
            const orgId = testOrganizations.org1.id;

            mockDb.get.mockImplementation(async (query, params) => {
                return { policy_level: 'ASSISTED' };
            });

            const result = await AIPolicyEngine.canPerformAction(actionType, orgId);

            expect(result.allowed).toBe(true);
        });

        it('should deny CREATE_DRAFT_TASK for ADVISORY policy', async () => {
            const actionType = 'CREATE_DRAFT_TASK';
            const orgId = testOrganizations.org1.id;

            mockDb.get.mockImplementation(async (query, params) => {
                return { policy_level: 'ADVISORY' };
            });

            const result = await AIPolicyEngine.canPerformAction(actionType, orgId);

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('ASSISTED');
        });

        it('should check regulatory mode first', async () => {
            const actionType = 'CREATE_DRAFT_TASK';
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;

            mockRegulatoryModeGuard.isEnabled.mockResolvedValue(true);

            const result = await AIPolicyEngine.canPerformAction(actionType, orgId, projectId);

            expect(result.allowed).toBe(false);
            expect(result.reason.toLowerCase()).toContain('regulatory');
        });
    });

    describe('getPolicyLevelForAction()', () => {
        it('should return correct policy level for action', () => {
            expect(AIPolicyEngine.getPolicyLevelForAction('EXPLAIN_CONTEXT')).toBe('ADVISORY');
            expect(AIPolicyEngine.getPolicyLevelForAction('CREATE_DRAFT_TASK')).toBe('ASSISTED');
            expect(AIPolicyEngine.getPolicyLevelForAction('UNKNOWN_ACTION')).toBe('ADVISORY');
        });
    });
});
