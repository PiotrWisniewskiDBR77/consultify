import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Mock dependencies
const createMockDb = () => ({
    get: vi.fn(),
    run: vi.fn()
});

const createMockAIRoleGuard = () => ({
    getProjectRole: vi.fn(() => 'ADVISOR'),
    getRoleCapabilities: vi.fn(() => ({
        canExplain: true,
        canCreateDrafts: false,
        canExecute: false,
        canModify: false
    })),
    getRoleDescription: vi.fn(() => 'Advisory role description')
});

const createMockRegulatoryModeGuard = () => ({
    isEnabled: vi.fn(() => false),
    getRegulatoryPrompt: vi.fn(() => 'Regulatory compliance prompt')
});

const AIPolicyEngine = require('../../../../server/services/aiPolicyEngine');

describe('AI Policy Engine', () => {
    let mockDb;
    let mockAIRoleGuard;
    let mockRegulatoryModeGuard;

    beforeEach(() => {
        vi.clearAllMocks();
        mockDb = createMockDb();
        mockAIRoleGuard = createMockAIRoleGuard();
        mockRegulatoryModeGuard = createMockRegulatoryModeGuard();

        AIPolicyEngine.setDependencies({
            db: mockDb,
            AIRoleGuard: mockAIRoleGuard,
            RegulatoryModeGuard: mockRegulatoryModeGuard
        });
    });

    describe('POLICY_LEVELS', () => {
        it('defines all policy levels', () => {
            expect(AIPolicyEngine.POLICY_LEVELS.ADVISORY).toBe('ADVISORY');
            expect(AIPolicyEngine.POLICY_LEVELS.ASSISTED).toBe('ASSISTED');
            expect(AIPolicyEngine.POLICY_LEVELS.PROACTIVE).toBe('PROACTIVE');
            expect(AIPolicyEngine.POLICY_LEVELS.AUTOPILOT).toBe('AUTOPILOT');
        });
    });

    describe('AI_ROLES', () => {
        it('defines all AI roles', () => {
            expect(AIPolicyEngine.AI_ROLES.ADVISOR).toBe('ADVISOR');
            expect(AIPolicyEngine.AI_ROLES.PMO_MANAGER).toBe('PMO_MANAGER');
            expect(AIPolicyEngine.AI_ROLES.EXECUTOR).toBe('EXECUTOR');
            expect(AIPolicyEngine.AI_ROLES.EDUCATOR).toBe('EDUCATOR');
        });
    });

    describe('getEffectivePolicy', () => {
        it('returns default advisory policy when no org policy exists', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, null);
            });

            const policy = await AIPolicyEngine.getEffectivePolicy('org-1');

            expect(policy.policyLevel).toBe('ADVISORY');
        });

        it('returns organization policy level', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('ai_policies')) {
                    cb(null, {
                        policy_level: 'ASSISTED',
                        max_policy_level: 'PROACTIVE',
                        internet_enabled: 1,
                        audit_required: 1,
                        default_ai_role: 'PMO_MANAGER',
                        active_roles: '["ADVISOR","PMO_MANAGER"]'
                    });
                } else {
                    cb(null, null);
                }
            });

            const policy = await AIPolicyEngine.getEffectivePolicy('org-1');

            expect(policy.policyLevel).toBe('ASSISTED');
            expect(policy.maxPolicyLevel).toBe('PROACTIVE');
            expect(policy.internetEnabled).toBe(true);
            expect(policy.auditRequired).toBe(true);
        });

        it('respects project-level policy override (can only reduce)', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('ai_policies')) {
                    cb(null, { policy_level: 'PROACTIVE', max_policy_level: 'AUTOPILOT' });
                } else if (sql.includes('projects')) {
                    cb(null, {
                        governance_settings: JSON.stringify({ aiPolicyOverride: 'ASSISTED' })
                    });
                } else {
                    cb(null, null);
                }
            });

            const policy = await AIPolicyEngine.getEffectivePolicy('org-1', 'proj-1');

            expect(policy.policyLevel).toBe('ASSISTED');
        });

        it('ignores project override that increases level', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('ai_policies')) {
                    cb(null, { policy_level: 'ADVISORY', max_policy_level: 'ASSISTED' });
                } else if (sql.includes('projects')) {
                    cb(null, {
                        governance_settings: JSON.stringify({ aiPolicyOverride: 'PROACTIVE' })
                    });
                } else {
                    cb(null, null);
                }
            });

            const policy = await AIPolicyEngine.getEffectivePolicy('org-1', 'proj-1');

            expect(policy.policyLevel).toBe('ADVISORY');
        });

        it('includes user preferences', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('ai_user_preferences')) {
                    cb(null, {
                        preferred_tone: 'FRIENDLY',
                        education_mode: 1
                    });
                } else {
                    cb(null, null);
                }
            });

            const policy = await AIPolicyEngine.getEffectivePolicy('org-1', null, 'user-1');

            expect(policy.userTone).toBe('FRIENDLY');
            expect(policy.educationMode).toBe(true);
        });

        it('enforces max policy level', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('ai_policies')) {
                    cb(null, {
                        policy_level: 'AUTOPILOT',
                        max_policy_level: 'ASSISTED'
                    });
                } else {
                    cb(null, null);
                }
            });

            const policy = await AIPolicyEngine.getEffectivePolicy('org-1');

            expect(policy.policyLevel).toBe('ASSISTED');
        });

        it('includes project AI role', async () => {
            mockAIRoleGuard.getProjectRole.mockResolvedValue('MANAGER');
            mockAIRoleGuard.getRoleCapabilities.mockReturnValue({
                canExplain: true,
                canCreateDrafts: true,
                canExecute: false,
                canModify: false
            });

            mockDb.get.mockImplementation((sql, params, cb) => cb(null, null));

            const policy = await AIPolicyEngine.getEffectivePolicy('org-1', 'proj-1');

            expect(policy.projectAIRole).toBe('MANAGER');
            expect(policy.roleCapabilities.canCreateDrafts).toBe(true);
        });
    });

    describe('getEffectivePolicy - Regulatory Mode', () => {
        it('forces ADVISORY mode when regulatory mode enabled', async () => {
            mockRegulatoryModeGuard.isEnabled.mockResolvedValue(true);

            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('ai_policies')) {
                    cb(null, {
                        policy_level: 'AUTOPILOT',
                        max_policy_level: 'AUTOPILOT',
                        internet_enabled: 1
                    });
                } else {
                    cb(null, null);
                }
            });

            const policy = await AIPolicyEngine.getEffectivePolicy('org-1', 'proj-1');

            expect(policy.policyLevel).toBe('ADVISORY');
            expect(policy.maxPolicyLevel).toBe('ADVISORY');
            expect(policy.internetEnabled).toBe(false);
            expect(policy.regulatoryModeEnabled).toBe(true);
            expect(policy.projectAIRole).toBe('ADVISOR');
            expect(policy.roleCapabilities.canCreateDrafts).toBe(false);
            expect(policy.roleCapabilities.canExecute).toBe(false);
        });

        it('includes regulatory mode prompt', async () => {
            mockRegulatoryModeGuard.isEnabled.mockResolvedValue(true);
            mockRegulatoryModeGuard.getRegulatoryPrompt.mockReturnValue('Special regulatory prompt');

            mockDb.get.mockImplementation((sql, params, cb) => cb(null, null));

            const policy = await AIPolicyEngine.getEffectivePolicy('org-1', 'proj-1');

            expect(policy.regulatoryModePrompt).toBe('Special regulatory prompt');
        });
    });

    describe('canPerformAction', () => {
        beforeEach(() => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('ai_policies')) {
                    cb(null, {
                        policy_level: 'ASSISTED',
                        max_policy_level: 'PROACTIVE'
                    });
                } else {
                    cb(null, null);
                }
            });
        });

        it('allows EXPLAIN_CONTEXT at ADVISORY level', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { policy_level: 'ADVISORY', max_policy_level: 'ADVISORY' });
            });

            const result = await AIPolicyEngine.canPerformAction('EXPLAIN_CONTEXT', 'org-1');

            expect(result.allowed).toBe(true);
            expect(result.requiredLevel).toBe('ADVISORY');
        });

        it('allows CREATE_DRAFT_TASK at ASSISTED level', async () => {
            const result = await AIPolicyEngine.canPerformAction('CREATE_DRAFT_TASK', 'org-1');

            expect(result.allowed).toBe(true);
            expect(result.requiredLevel).toBe('ASSISTED');
        });

        it('blocks CREATE_DRAFT_TASK at ADVISORY level', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { policy_level: 'ADVISORY', max_policy_level: 'ADVISORY' });
            });

            const result = await AIPolicyEngine.canPerformAction('CREATE_DRAFT_TASK', 'org-1');

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('requires ASSISTED');
        });

        it('requires approval for CREATE_ actions unless AUTOPILOT', async () => {
            const result = await AIPolicyEngine.canPerformAction('CREATE_DRAFT_INITIATIVE', 'org-1');

            expect(result.requiresApproval).toBe(true);
        });

        it('does not require approval at AUTOPILOT level', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { policy_level: 'AUTOPILOT', max_policy_level: 'AUTOPILOT' });
            });

            const result = await AIPolicyEngine.canPerformAction('CREATE_DRAFT_TASK', 'org-1');

            expect(result.requiresApproval).toBe(false);
        });

        it('blocks non-advisory actions in regulatory mode', async () => {
            mockRegulatoryModeGuard.isEnabled.mockResolvedValue(true);
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, null));

            const result = await AIPolicyEngine.canPerformAction('CREATE_DRAFT_TASK', 'org-1', 'proj-1');

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Regulatory Mode');
        });

        it('allows advisory actions in regulatory mode', async () => {
            mockRegulatoryModeGuard.isEnabled.mockResolvedValue(true);
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, null));

            const result = await AIPolicyEngine.canPerformAction('EXPLAIN_CONTEXT', 'org-1', 'proj-1');

            expect(result.allowed).toBe(true);
        });
    });

    describe('getPolicyLevelForAction', () => {
        it('returns correct level for EXPLAIN_CONTEXT', () => {
            expect(AIPolicyEngine.getPolicyLevelForAction('EXPLAIN_CONTEXT')).toBe('ADVISORY');
        });

        it('returns correct level for CREATE_DRAFT_TASK', () => {
            expect(AIPolicyEngine.getPolicyLevelForAction('CREATE_DRAFT_TASK')).toBe('ASSISTED');
        });

        it('returns ADVISORY for unknown actions', () => {
            expect(AIPolicyEngine.getPolicyLevelForAction('UNKNOWN_ACTION')).toBe('ADVISORY');
        });
    });

    describe('isRoleActive', () => {
        it('returns true for active role', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { active_roles: '["ADVISOR","PMO_MANAGER"]' });
            });

            const isActive = await AIPolicyEngine.isRoleActive('ADVISOR', 'org-1');

            expect(isActive).toBe(true);
        });

        it('returns false for inactive role', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { active_roles: '["ADVISOR"]' });
            });

            const isActive = await AIPolicyEngine.isRoleActive('EXECUTOR', 'org-1');

            expect(isActive).toBe(false);
        });
    });

    describe('updatePolicy', () => {
        it('updates organization policy', async () => {
            mockDb.run.mockImplementation((sql, params, cb) => {
                cb.call({ changes: 1 }, null);
            });

            const result = await AIPolicyEngine.updatePolicy('org-1', {
                policyLevel: 'ASSISTED',
                internetEnabled: true,
                auditRequired: true
            });

            expect(result.updated).toBe(true);
            expect(result.organizationId).toBe('org-1');
        });

        it('rejects invalid policy level', async () => {
            await expect(
                AIPolicyEngine.updatePolicy('org-1', { policyLevel: 'INVALID' })
            ).rejects.toThrow('Invalid policy level');
        });

        it('calls database with correct parameters', async () => {
            mockDb.run.mockImplementation((sql, params, cb) => {
                cb.call({ changes: 1 }, null);
            });

            await AIPolicyEngine.updatePolicy('org-1', {
                policyLevel: 'PROACTIVE',
                internetEnabled: true,
                auditRequired: false,
                maxPolicyLevel: 'AUTOPILOT',
                defaultRole: 'PMO_MANAGER',
                activeRoles: ['ADVISOR', 'PMO_MANAGER']
            });

            expect(mockDb.run).toHaveBeenCalled();
            const callArgs = mockDb.run.mock.calls[0];
            expect(callArgs[0]).toContain('INSERT INTO ai_policies');
            expect(callArgs[0]).toContain('ON CONFLICT');
        });
    });

    describe('getPolicySummary', () => {
        it('returns policy summary', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, {
                    policy_level: 'ASSISTED',
                    internet_enabled: 1,
                    audit_required: 1
                });
            });

            const summary = await AIPolicyEngine.getPolicySummary('org-1');

            expect(summary.currentLevel).toBe('ASSISTED');
            expect(summary.description).toContain('drafts');
            expect(summary.capabilities.canCreateDrafts).toBe(true);
            expect(summary.capabilities.canExecuteActions).toBe(false);
            expect(summary.internetEnabled).toBe(true);
        });

        it('includes correct capabilities for each level', async () => {
            // Test ADVISORY
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { policy_level: 'ADVISORY' });
            });

            let summary = await AIPolicyEngine.getPolicySummary('org-1');
            expect(summary.capabilities.canExplain).toBe(true);
            expect(summary.capabilities.canCreateDrafts).toBe(false);

            // Test PROACTIVE
            mockDb.get.mockImplementation((sql, params, cb) => {
                cb(null, { policy_level: 'PROACTIVE', max_policy_level: 'PROACTIVE' });
            });

            summary = await AIPolicyEngine.getPolicySummary('org-1');
            expect(summary.capabilities.canCreateDrafts).toBe(true);
            expect(summary.capabilities.canExecuteActions).toBe(true);
        });
    });
});





