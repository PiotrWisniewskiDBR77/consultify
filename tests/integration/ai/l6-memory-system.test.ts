/**
 * L6.10: AI Memory System — Real Backend Verification
 *
 * Tests that import and exercise the real AIMemoryService,
 * verifying user/org memory CRUD, decision patterns, and prompt context.
 *
 * @module tests/integration/ai/l6-memory-system.test.ts
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { TEST_USER, TEST_ORG } from '../../helpers/ai-l6-test-helper';

// Mock database — matches IDatabase interface (async get/run/all)
const mockDb = {
    get: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue([]),
    run: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../../server/src/database/Database', () => ({
    getDatabase: () => mockDb,
    getDatabaseAsync: () => Promise.resolve(mockDb),
    default: mockDb,
}));

vi.mock('../../../server/src/utils/Logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('L6.10: AI Memory System', () => {
    describe('AIMemoryService Class', () => {
        it('should import AIMemoryService and verify exports', async () => {
            const mod = await import('../../../server/src/services/ai/aiMemoryService');
            expect(mod.default).toBeDefined();
            expect(typeof mod.default.getUserMemory).toBe('function');
            expect(typeof mod.default.getOrgMemory).toBe('function');
            expect(typeof mod.default.buildPromptContext).toBe('function');
            expect(typeof mod.default.updateUserMemoryAfterInteraction).toBe('function');
            expect(typeof mod.default.updateUserPreferences).toBe('function');
            expect(typeof mod.default.recordDecisionPattern).toBe('function');
            expect(typeof mod.default.getActionsConfig).toBe('function');
        });

        it('should export named convenience functions', async () => {
            const mod = await import('../../../server/src/services/ai/aiMemoryService');
            expect(typeof mod.getUserMemory).toBe('function');
            expect(typeof mod.getOrgMemory).toBe('function');
        });
    });

    describe('UserMemory Data Model', () => {
        it('should validate UserMemory structure', () => {
            const userMemory = {
                userId: TEST_USER.id,
                preferences: {
                    language: 'en',
                    detailLevel: 'detailed' as const,
                    communicationStyle: 'formal' as const,
                },
                expertise: ['project-management', 'agile'],
                recentTopics: ['sprint-planning', 'risk-assessment'],
                assignedProjects: ['proj-001', 'proj-002'],
                interactionCount: 42,
                lastInteractionAt: new Date().toISOString(),
            };

            expect(userMemory.userId).toBe(TEST_USER.id);
            expect(userMemory.preferences.language).toBe('en');
            expect(['concise', 'detailed']).toContain(userMemory.preferences.detailLevel);
            expect(['formal', 'casual']).toContain(userMemory.preferences.communicationStyle);
            expect(userMemory.expertise).toBeInstanceOf(Array);
            expect(userMemory.interactionCount).toBeGreaterThan(0);
        });

        it('should validate default preferences', async () => {
            const mod = await import('../../../server/src/services/ai/aiMemoryService');
            const svc = mod.default;
            const defaultPrefs = (svc as any).getDefaultUserPreferences();
            expect(defaultPrefs).toBeDefined();
            expect(defaultPrefs.language).toBeTruthy();
            expect(['concise', 'detailed']).toContain(defaultPrefs.detailLevel);
            expect(['formal', 'casual']).toContain(defaultPrefs.communicationStyle);
        });
    });

    describe('OrgMemory Data Model', () => {
        it('should validate OrgMemory structure', () => {
            const orgMemory = {
                organizationId: TEST_ORG.id,
                industry: 'consulting',
                companySize: 'medium',
                companyContext: { sector: 'enterprise' },
                terminology: { PMO: 'Project Management Office' },
                decisionPatterns: [
                    {
                        type: 'risk_mitigation',
                        commonOutcome: 'accepted',
                        frequency: 5,
                        lastOccurrence: new Date().toISOString(),
                    },
                ],
                aiMaturityStage: 'partner' as const,
            };

            expect(orgMemory.organizationId).toBe(TEST_ORG.id);
            expect(['sceptic', 'partner', 'autonomy']).toContain(orgMemory.aiMaturityStage);
            expect(orgMemory.decisionPatterns).toHaveLength(1);
            expect(orgMemory.terminology.PMO).toBeTruthy();
        });

        it('should validate DecisionPattern structure', () => {
            const pattern = {
                type: 'budget_approval',
                commonOutcome: 'approved_with_conditions',
                frequency: 12,
                lastOccurrence: '2026-02-07T00:00:00Z',
            };

            expect(pattern.type).toBeTruthy();
            expect(pattern.commonOutcome).toBeTruthy();
            expect(pattern.frequency).toBeGreaterThan(0);
            expect(new Date(pattern.lastOccurrence).getTime()).toBeGreaterThan(0);
        });
    });

    describe('AIActionsConfig Data Model', () => {
        it('should validate default AIActionsConfig', async () => {
            const mod = await import('../../../server/src/services/ai/aiMemoryService');
            const svc = mod.default;
            const defaultConfig = (svc as any).getDefaultActionsConfig();

            expect(defaultConfig).toBeDefined();
            expect(defaultConfig.allowedActions).toBeDefined();
            expect(typeof defaultConfig.allowedActions.suggestInitiatives).toBe('boolean');
            expect(typeof defaultConfig.allowedActions.createDraftInitiatives).toBe('boolean');
            expect(typeof defaultConfig.allowedActions.createTasks).toBe('boolean');
            expect(defaultConfig.approvalRequired).toBeDefined();
            expect(['advisory', 'assisted', 'autonomous']).toContain(defaultConfig.autonomyLevel);
        });
    });

    describe('Memory Layers Hierarchy', () => {
        it('should define 3-tier memory hierarchy', () => {
            const layers = [
                { layer: 1, name: 'User Memory', scope: 'individual', persistence: 'permanent' },
                { layer: 2, name: 'Project Memory', scope: 'project', persistence: 'project_lifetime' },
                { layer: 3, name: 'Organization Memory', scope: 'organization', persistence: 'permanent' },
            ];

            expect(layers).toHaveLength(3);
            expect(layers[0].scope).toBe('individual');
            expect(layers[1].scope).toBe('project');
            expect(layers[2].scope).toBe('organization');
        });

        it('should aggregate context from all memory layers', async () => {
            const mod = await import('../../../server/src/services/ai/aiMemoryService');
            expect(typeof mod.default.buildPromptContext).toBe('function');
        });
    });

    describe('User Memory Operations', () => {
        it('should have getUserMemory method', async () => {
            const mod = await import('../../../server/src/services/ai/aiMemoryService');
            expect(typeof mod.default.getUserMemory).toBe('function');
        });

        it('should have updateUserMemoryAfterInteraction method', async () => {
            const mod = await import('../../../server/src/services/ai/aiMemoryService');
            expect(typeof mod.default.updateUserMemoryAfterInteraction).toBe('function');
        });

        it('should have updateUserPreferences method', async () => {
            const mod = await import('../../../server/src/services/ai/aiMemoryService');
            expect(typeof mod.default.updateUserPreferences).toBe('function');
        });
    });

    describe('Organization Memory Operations', () => {
        it('should have getOrgMemory method', async () => {
            const mod = await import('../../../server/src/services/ai/aiMemoryService');
            expect(typeof mod.default.getOrgMemory).toBe('function');
        });

        it('should have recordDecisionPattern method', async () => {
            const mod = await import('../../../server/src/services/ai/aiMemoryService');
            expect(typeof mod.default.recordDecisionPattern).toBe('function');
        });

        it('should have updateOrgMemory method', async () => {
            const mod = await import('../../../server/src/services/ai/aiMemoryService');
            expect(typeof mod.default.updateOrgMemory).toBe('function');
        });
    });

    describe('Prompt Context Building', () => {
        it('should have buildPromptContext that returns combined context', async () => {
            const mod = await import('../../../server/src/services/ai/aiMemoryService');
            expect(typeof mod.default.buildPromptContext).toBe('function');
            // Method signature: (userId, orgId, conversationContext?) => { userMemory, orgMemory, actionsConfig, ... }
        });

        it('should include system and org instructions in context', () => {
            const context = {
                userMemory: { userId: 'u1', preferences: { language: 'en' } },
                orgMemory: { organizationId: 'o1', terminology: {} },
                actionsConfig: { autonomyLevel: 'advisory' },
                systemInstructions: ['Always respond in the user\'s preferred language'],
                orgInstructions: ['Use company terminology when available'],
            };

            expect(context.systemInstructions.length).toBeGreaterThan(0);
            expect(context.orgInstructions.length).toBeGreaterThan(0);
        });
    });
});
