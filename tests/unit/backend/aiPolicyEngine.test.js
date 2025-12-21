/**
 * AI Policy Engine Tests
 * 
 * HIGH PRIORITY AI SERVICE - Must have 85%+ coverage
 * Tests policy enforcement, regulatory mode, and action permissions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);

describe('AIPolicyEngine', () => {
    let mockDb;
    let AIPolicyEngine;
    let mockRegulatoryModeGuard;
    let mockAIRoleGuard;

    beforeEach(() => {
        vi.resetModules();
        
        mockDb = createMockDb();
        
        // Mock dependencies
        mockRegulatoryModeGuard = {
            isEnabled: vi.fn().mockResolvedValue(false),
            getRegulatoryPrompt: vi.fn().mockReturnValue('Regulatory prompt')
        };
        
        mockAIRoleGuard = {
            getProjectRole: vi.fn().mockResolvedValue('ADVISOR'),
            getRoleCapabilities: vi.fn().mockReturnValue({
                canExplain: true,
                canCreateDrafts: false,
                canExecute: false
            }),
            getRoleDescription: vi.fn().mockReturnValue('Advisor role')
        };

        // Mock database before importing
        vi.doMock('../../../server/database', () => ({
            default: mockDb
        }));

        vi.doMock('../../../server/services/regulatoryModeGuard', () => ({
            default: mockRegulatoryModeGuard
        }));

        vi.doMock('../../../server/services/aiRoleGuard', () => ({
            default: mockAIRoleGuard
        }));

        AIPolicyEngine = require('../../../server/services/aiPolicyEngine.js');
        
        // Inject dependencies if supported
        if (AIPolicyEngine.setDependencies) {
            AIPolicyEngine.setDependencies({
                db: mockDb,
                RegulatoryModeGuard: mockRegulatoryModeGuard,
                AIRoleGuard: mockAIRoleGuard
            });
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
        vi.doUnmock('../../../server/services/regulatoryModeGuard');
        vi.doUnmock('../../../server/services/aiRoleGuard');
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

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('ai_policies')) {
                    callback(null, {
                        policy_level: 'ASSISTED',
                        max_policy_level: 'PROACTIVE',
                        internet_enabled: 1,
                        audit_required: 1,
                        default_ai_role: 'PMO_MANAGER'
                    });
                } else {
                    callback(null, null);
                }
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

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('ai_policies')) {
                    callback(null, {
                        policy_level: 'PROACTIVE',
                        max_policy_level: 'AUTOPILOT'
                    });
                } else if (query.includes('projects')) {
                    callback(null, {
                        governance_settings: JSON.stringify({
                            aiPolicyOverride: 'ASSISTED'
                        })
                    });
                } else {
                    callback(null, null);
                }
            });

            const policy = await AIPolicyEngine.getEffectivePolicy(orgId, projectId, userId);

            // Project override should reduce from PROACTIVE to ASSISTED
            expect(policy.policyLevel).toBe('ASSISTED');
        });

        it('should not allow project override to exceed max level', async () => {
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;
            const userId = testUsers.user.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('ai_policies')) {
                    callback(null, {
                        policy_level: 'ASSISTED',
                        max_policy_level: 'ASSISTED' // Max is ASSISTED
                    });
                } else if (query.includes('projects')) {
                    callback(null, {
                        governance_settings: JSON.stringify({
                            aiPolicyOverride: 'PROACTIVE' // Try to exceed max
                        })
                    });
                } else {
                    callback(null, null);
                }
            });

            const policy = await AIPolicyEngine.getEffectivePolicy(orgId, projectId, userId);

            // Should be capped at max level
            expect(policy.policyLevel).toBe('ASSISTED');
        });

        it('should include user preferences', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = testUsers.user.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('ai_policies')) {
                    callback(null, { policy_level: 'ASSISTED' });
                } else if (query.includes('ai_user_preferences')) {
                    callback(null, {
                        preferred_tone: 'FRIENDLY',
                        education_mode: 1
                    });
                } else {
                    callback(null, null);
                }
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

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { policy_level: 'ADVISORY' });
            });

            const result = await AIPolicyEngine.canPerformAction(actionType, orgId);

            expect(result.allowed).toBe(true);
        });

        it('should allow CREATE_DRAFT_TASK for ASSISTED policy', async () => {
            const actionType = 'CREATE_DRAFT_TASK';
            const orgId = testOrganizations.org1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { policy_level: 'ASSISTED' });
            });

            const result = await AIPolicyEngine.canPerformAction(actionType, orgId);

            expect(result.allowed).toBe(true);
        });

        it('should deny CREATE_DRAFT_TASK for ADVISORY policy', async () => {
            const actionType = 'CREATE_DRAFT_TASK';
            const orgId = testOrganizations.org1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { policy_level: 'ADVISORY' });
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
