
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../server/services/aiContextBuilder.js', () => ({
    default: { buildContext: vi.fn() }
}));
vi.mock('../../../server/services/aiPolicyEngine.js', () => ({
    default: {
        getEffectivePolicy: vi.fn(),
        POLICY_LEVELS: { ADVISORY: 'ADVISORY' },
        AI_ROLES: { ADVISOR: 'ADVISOR', PMO_MANAGER: 'PMO_MANAGER', EXECUTOR: 'EXECUTOR', EDUCATOR: 'EDUCATOR' }
    }
}));
vi.mock('../../../server/services/aiMemoryManager.js', () => ({
    default: {
        getUserPreferences: vi.fn(),
        buildProjectMemorySummary: vi.fn()
    }
}));
vi.mock('../../../server/services/aiRoleGuard.js', () => ({
    default: {
        getRoleConfig: vi.fn(),
        getRoleCapabilities: vi.fn(),
        getRoleDescription: vi.fn(),
        AI_PROJECT_ROLES: { ADVISOR: 'ADVISOR', MANAGER: 'MANAGER', OPERATOR: 'OPERATOR' }
    }
}));
vi.mock('../../../server/services/aiExplainabilityService.js', () => ({
    default: {
        buildAIExplanation: vi.fn(),
        buildExplainabilityFooter: vi.fn()
    }
}));
vi.mock('../../../server/services/regulatoryModeGuard.js', () => ({
    default: { getRegulatoryPrompt: vi.fn() }
}));
vi.mock('../../../server/services/aiResponsePostProcessor.js', () => ({
    aiResponsePostProcessor: vi.fn((text) => `Processed: ${text}`)
}));

describe('AIOrchestrator', () => {
    let AIOrchestrator;
    let AIContextBuilder;
    let AIPolicyEngine;
    let AIMemoryManager;
    let AIRoleGuard;
    let AIExplainabilityService;
    let RegulatoryModeGuard;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        AIOrchestrator = (await import('../../../server/services/aiOrchestrator.js')).default;

        AIContextBuilder = (await import('../../../server/services/aiContextBuilder.js')).default;
        AIPolicyEngine = (await import('../../../server/services/aiPolicyEngine.js')).default;
        AIMemoryManager = (await import('../../../server/services/aiMemoryManager.js')).default;
        AIRoleGuard = (await import('../../../server/services/aiRoleGuard.js')).default;
        AIExplainabilityService = (await import('../../../server/services/aiExplainabilityService.js')).default;
        RegulatoryModeGuard = (await import('../../../server/services/regulatoryModeGuard.js')).default;
    });

    describe('_detectIntent', () => {
        it('should detect EXPLAIN intent correctly', () => {
            expect(AIOrchestrator._detectIntent('Explain the project phase')).toBe(AIOrchestrator.CHAT_MODES.EXPLAIN);
            expect(AIOrchestrator._detectIntent('What is this?')).toBe(AIOrchestrator.CHAT_MODES.EXPLAIN);
        });

        it('should detect GUIDE intent correctly', () => {
            expect(AIOrchestrator._detectIntent('What should I do next?')).toBe(AIOrchestrator.CHAT_MODES.GUIDE);
        });

        it('should detect ANALYZE intent correctly', () => {
            expect(AIOrchestrator._detectIntent('Analyze the risks')).toBe(AIOrchestrator.CHAT_MODES.ANALYZE);
        });

        it('should detect DO intent correctly', () => {
            expect(AIOrchestrator._detectIntent('Draft a task')).toBe(AIOrchestrator.CHAT_MODES.DO);
        });

        it('should detect TEACH intent correctly', () => {
            expect(AIOrchestrator._detectIntent('Why is this important?')).toBe(AIOrchestrator.CHAT_MODES.TEACH);
        });

        it('should default to EXPLAIN for unclear intent', () => {
            expect(AIOrchestrator._detectIntent('Hello there')).toBe(AIOrchestrator.CHAT_MODES.EXPLAIN);
        });
    });

    describe('_selectRole', () => {
        const mockPolicy = {
            regulatoryModeEnabled: false,
            activeRoles: ['ADVISOR', 'PMO_MANAGER', 'EXECUTOR', 'EDUCATOR']
        };

        it('should force ADVISOR role if regulatory mode is enabled', () => {
            const regPolicy = { ...mockPolicy, regulatoryModeEnabled: true };
            expect(AIOrchestrator._selectRole(AIOrchestrator.CHAT_MODES.DO, regPolicy)).toBe(AIOrchestrator.AI_ROLES.ADVISOR);
        });

        it('should select PMO_MANAGER for GUIDE intent', () => {
            expect(AIOrchestrator._selectRole(AIOrchestrator.CHAT_MODES.GUIDE, mockPolicy)).toBe(AIOrchestrator.AI_ROLES.PMO_MANAGER);
        });

        it('should fallback to ADVISOR if selected role is not active', () => {
            const limitedPolicy = { ...mockPolicy, activeRoles: ['ADVISOR'] };
            expect(AIOrchestrator._selectRole(AIOrchestrator.CHAT_MODES.DO, limitedPolicy)).toBe(AIOrchestrator.AI_ROLES.ADVISOR);
        });
    });

    describe('processMessage', () => {
        const mockContext = {
            platform: { role: 'Admin' },
            organization: { organizationName: 'Test Org', activeProjectCount: 1 },
            project: { projectName: 'Test Project', currentPhase: 'Planning', phaseNumber: 2, completedInitiatives: 0, initiativeCount: 5 },
            execution: { userTasks: [], pendingDecisions: [], blockers: [] },
            knowledge: { previousDecisions: [] },
            external: { internetEnabled: false }
        };

        const mockPolicy = {
            regulatoryModeEnabled: false,
            activeRoles: ['ADVISOR', 'PMO_MANAGER', 'EXECUTOR']
        };

        const mockPreferences = { preferred_tone: 'PROFESSIONAL' };
        const mockProjectMemory = { memoryCount: 5, majorDecisions: [], phaseTransitions: [] };
        const mockRoleConfig = { activeRole: 'PMO_MANAGER' };

        beforeEach(() => {
            AIContextBuilder.buildContext.mockResolvedValue(mockContext);
            AIPolicyEngine.getEffectivePolicy.mockResolvedValue(mockPolicy);
            AIMemoryManager.getUserPreferences.mockResolvedValue(mockPreferences);
            AIMemoryManager.buildProjectMemorySummary.mockResolvedValue(mockProjectMemory);
            AIRoleGuard.getRoleConfig.mockResolvedValue(mockRoleConfig);

            AIExplainabilityService.buildAIExplanation.mockReturnValue({
                confidenceLevel: 85,
                reasoning: ['Test reasoning']
            });

            AIRoleGuard.getRoleCapabilities.mockReturnValue(['cap1']);
            AIRoleGuard.getRoleDescription.mockReturnValue('Test Description');

            RegulatoryModeGuard.getRegulatoryPrompt.mockReturnValue('Regulatory Prompt');
        });

        it('should process a message successfully', async () => {
            const result = await AIOrchestrator.processMessage('What is the status?', 'user1', 'org1', 'proj1');
            expect(result.role).toBe(AIOrchestrator.AI_ROLES.ADVISOR);
        });

        it('should include regulatory prompt when regulatory mode is enabled', async () => {
            AIPolicyEngine.getEffectivePolicy.mockResolvedValue({ ...mockPolicy, regulatoryModeEnabled: true });
            const result = await AIOrchestrator.processMessage('Execute this', 'user1', 'org1', 'proj1');
            expect(result.prompt).toContain('Regulatory Prompt');
        });

        it('should handle context building errors gracefully', async () => {
            AIContextBuilder.buildContext.mockRejectedValue(new Error('Context Fail'));
            await expect(AIOrchestrator.processMessage('msg', 'u', 'o', 'p')).rejects.toThrow('Context Fail');
        });

        it('should default to ADVISOR if role selection returns null', async () => {
            // Mock scenario where _selectRole fallback logic is triggered
            AIPolicyEngine.getEffectivePolicy.mockResolvedValue({ activeRoles: [] });
            // Logic in _selectRole handles fallback, checked earlier. 
            // But we verify processMessage uses it.
            const result = await AIOrchestrator.processMessage('Do it', 'u', 'o', 'p');
            expect(result.role).toBe('ADVISOR');
        });

        it('should handle missing project ID (General Chat)', async () => {
            const result = await AIOrchestrator.processMessage('General question', 'user1', 'org1', null);
            expect(result.responseContext.projectMemory).toBeNull();
            // Role config logic is skipped for null project in processMessage
            // but defaults are used for aiGovernance
            expect(result.responseContext.aiGovernance.activeRole).toBe('ADVISOR');
        });
    });
});
