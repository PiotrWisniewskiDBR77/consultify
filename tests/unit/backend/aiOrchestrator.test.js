import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks for dependency injection
const mockAIContextBuilder = vi.hoisted(() => ({
    buildContext: vi.fn()
}));

const mockAIPolicyEngine = vi.hoisted(() => ({
    getEffectivePolicy: vi.fn()
}));

const mockAIMemoryManager = vi.hoisted(() => ({
    getUserPreferences: vi.fn(),
    buildProjectMemorySummary: vi.fn()
}));

const mockAIRoleGuard = vi.hoisted(() => ({
    getRoleConfig: vi.fn(),
    getRoleCapabilities: vi.fn(() => []),
    getRoleDescription: vi.fn(() => 'Test role')
}));

const mockRegulatoryModeGuard = vi.hoisted(() => ({
    getRegulatoryPrompt: vi.fn(() => 'REGULATORY PROMPT')
}));

const mockAIExplainabilityService = vi.hoisted(() => ({
    buildAIExplanation: vi.fn(() => ({
        confidenceLevel: 'HIGH',
        reasoning: 'Test reasoning'
    })),
    buildExplainabilityFooter: vi.fn(() => 'Confidence: HIGH')
}));

const mockAccessPolicyService = vi.hoisted(() => ({
    getAIAccessContext: vi.fn(),
    incrementUsage: vi.fn(() => Promise.resolve())
}));

const mockUuidv4 = vi.hoisted(() => vi.fn(() => 'uuid-1234'));

vi.mock('../../../server/services/aiContextBuilder', () => ({
    default: mockAIContextBuilder
}));

vi.mock('../../../server/services/aiPolicyEngine', () => ({
    default: mockAIPolicyEngine
}));

vi.mock('../../../server/services/aiMemoryManager', () => ({
    default: mockAIMemoryManager
}));

vi.mock('../../../server/services/aiRoleGuard', () => ({
    default: mockAIRoleGuard
}));

vi.mock('../../../server/services/regulatoryModeGuard', () => ({
    default: mockRegulatoryModeGuard
}));

vi.mock('../../../server/services/aiExplainabilityService', () => ({
    default: mockAIExplainabilityService
}));

vi.mock('../../../server/services/accessPolicyService', () => ({
    default: mockAccessPolicyService
}));

vi.mock('uuid', () => ({
    v4: mockUuidv4
}));

import AIOrchestrator from '../../../server/services/aiOrchestrator.js';

describe('AIOrchestrator', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Inject mocked dependencies
        AIOrchestrator._setDependencies({
            AIContextBuilder: mockAIContextBuilder,
            AIPolicyEngine: mockAIPolicyEngine,
            AIMemoryManager: mockAIMemoryManager,
            AIRoleGuard: mockAIRoleGuard,
            RegulatoryModeGuard: mockRegulatoryModeGuard,
            AIExplainabilityService: mockAIExplainabilityService,
            AccessPolicyService: mockAccessPolicyService,
            uuidv4: mockUuidv4
        });

        // Default mocks
        mockAccessPolicyService.getAIAccessContext.mockResolvedValue({
            trialStatus: { expired: false },
            isPaid: true,
            isDemo: false,
            isTrial: false,
            allowedAIRoles: ['ADVISOR', 'PMO_MANAGER', 'EXECUTOR', 'EDUCATOR'],
            organizationType: 'PAID',
            aiResponseBadge: null,
            dailyAIUsage: { remaining: 1000, limit: 1000 }
        });

        mockAIContextBuilder.buildContext.mockResolvedValue({
            platform: { 
                user: { id: 'u1' },
                role: 'PMO_MANAGER'
            },
            organization: {
                organizationName: 'Test Org',
                activeProjectCount: 5
            },
            project: {
                projectName: 'Test Project',
                currentPhase: 'Context',
                phaseNumber: 1,
                completedInitiatives: 2,
                initiativeCount: 5
            },
            execution: {
                userTasks: [],
                pendingDecisions: [],
                blockers: []
            },
            knowledge: {
                previousDecisions: []
            },
            external: {
                internetEnabled: false
            },
            contextHash: 'ctx-hash'
        });

        mockAIPolicyEngine.getEffectivePolicy.mockResolvedValue({
            level: 'ASSISTED',
            allowedActions: ['EXPLAIN', 'SUGGEST'],
            activeRoles: ['ADVISOR', 'PMO_MANAGER', 'EXECUTOR', 'EDUCATOR'],
            regulatoryModeEnabled: false
        });

        mockAIMemoryManager.getUserPreferences.mockResolvedValue({
            preferred_tone: 'EXPERT',
            education_mode: false
        });

        mockAIMemoryManager.buildProjectMemorySummary.mockResolvedValue({
            memoryCount: 0,
            majorDecisions: [],
            phaseTransitions: []
        });

        mockAIRoleGuard.getRoleConfig.mockResolvedValue(null);
    });

    describe('processMessage', () => {
        it('should process user message successfully', async () => {
            const result = await AIOrchestrator.processMessage(
                'How is the project going?',
                'user-1',
                'org-1',
                'proj-1'
            );

            expect(result).toBeDefined();
            expect(result.responseContext).toBeDefined();
            expect(result.prompt).toBeDefined();
            expect(result.policyAllows).toBe(true);
            expect(result.role).toBe('ADVISOR');
            expect(result.intent).toBe('EXPLAIN');
            expect(mockAIContextBuilder.buildContext).toHaveBeenCalled();
            expect(mockAIPolicyEngine.getEffectivePolicy).toHaveBeenCalled();
        });

        it('should handle context building failure', async () => {
            mockAIContextBuilder.buildContext.mockRejectedValue(new Error('Context Error'));

            await expect(
                AIOrchestrator.processMessage('Hi', 'u1', 'o1')
            ).rejects.toThrow('Context Error');
        });

        it('should block if trial expired', async () => {
            mockAccessPolicyService.getAIAccessContext.mockResolvedValue({
                trialStatus: { expired: true },
                isPaid: false,
                isDemo: false,
                isTrial: true,
                allowedAIRoles: ['ADVISOR'],
                organizationType: 'TRIAL',
                aiResponseBadge: null,
                dailyAIUsage: { remaining: 0, limit: 10 }
            });

            const result = await AIOrchestrator.processMessage('Hi', 'u1', 'o1');

            expect(result.blocked).toBe(true);
            expect(result.errorCode).toBe('TRIAL_EXPIRED');
        });

        it('should block if daily AI limit reached', async () => {
            mockAccessPolicyService.getAIAccessContext.mockResolvedValue({
                trialStatus: { expired: false },
                isPaid: false,
                isDemo: false,
                isTrial: true,
                allowedAIRoles: ['ADVISOR'],
                organizationType: 'TRIAL',
                aiResponseBadge: null,
                dailyAIUsage: { remaining: 0, limit: 10 }
            });

            const result = await AIOrchestrator.processMessage('Hi', 'u1', 'o1');

            expect(result.blocked).toBe(true);
            expect(result.errorCode).toBe('AI_LIMIT_REACHED');
        });
    });

    describe('_detectIntent', () => {
        it('should detect intent from message keywords', () => {
            const intent = AIOrchestrator._detectIntent('Create a task for me');
            expect(intent).toBe('DO');
        });

        it('should default to EXPLAIN intent', () => {
            const intent = AIOrchestrator._detectIntent('What implies this?');
            expect(intent).toBe('EXPLAIN');
        });
    });

    describe('_selectRole', () => {
        it('should select role based on intent', () => {
            const policy = {
                regulatoryModeEnabled: false,
                activeRoles: ['ADVISOR', 'PMO_MANAGER', 'EXECUTOR', 'EDUCATOR']
            };
            const role = AIOrchestrator._selectRole('DO', policy);
            expect(role).toBe('EXECUTOR');
        });

        it('should downgrade role if policy restricts', () => {
            const policy = {
                regulatoryModeEnabled: false,
                activeRoles: ['ADVISOR'] // Only ADVISOR allowed
            };
            const role = AIOrchestrator._selectRole('DO', policy);
            // ADVISORY cannot DO, so fallback to ADVISOR
            expect(role).toBe('ADVISOR');
        });

        it('should force ADVISOR in regulatory mode', () => {
            const policy = {
                regulatoryModeEnabled: true,
                activeRoles: ['ADVISOR', 'PMO_MANAGER', 'EXECUTOR', 'EDUCATOR']
            };
            const role = AIOrchestrator._selectRole('DO', policy);
            expect(role).toBe('ADVISOR');
        });
    });

    describe('_buildPrompt', () => {
        it('should include context and user message', () => {
            const responseContext = {
                role: 'ADVISOR',
                intent: 'EXPLAIN',
                context: {
                    platform: { role: 'PMO_MANAGER' },
                    organization: { organizationName: 'Test Org', activeProjectCount: 5 },
                    project: { projectName: 'Test Project' },
                    execution: { userTasks: [], pendingDecisions: [], blockers: [] },
                    knowledge: { previousDecisions: [] },
                    external: { internetEnabled: false }
                },
                policy: {
                    regulatoryModeEnabled: false
                },
                projectMemory: null,
                preferences: {
                    preferred_tone: 'EXPERT',
                    education_mode: false
                },
                aiGovernance: {
                    activeRole: 'ADVISOR'
                }
            };

            const prompt = AIOrchestrator._buildPrompt('Hello', responseContext);

            expect(prompt).toContain('Hello');
            expect(prompt).toContain('Test Org');
        });
    });

    describe('postProcessResponse', () => {
        it('should add standard footer', () => {
            const rawResponse = 'Here is the analysis.';
            const responseContext = {
                explanation: {
                    confidenceLevel: 'HIGH',
                    reasoning: 'Test reasoning'
                },
                context: {
                    pmo: {},
                    knowledge: {},
                    external: {},
                    execution: {}
                }
            };

            const processed = AIOrchestrator.postProcessResponse(rawResponse, responseContext);

            expect(processed).toContain('Here is the analysis.');
            expect(processed).toContain('Confidence: HIGH');
        });

        it('should handle missing explanation', () => {
            const rawResponse = 'Here is the analysis.';
            const responseContext = {
                context: {
                    pmo: {},
                    knowledge: {},
                    external: {},
                    execution: {}
                }
            };

            const processed = AIOrchestrator.postProcessResponse(rawResponse, responseContext);

            expect(processed).toContain('Here is the analysis.');
        });
    });
});
