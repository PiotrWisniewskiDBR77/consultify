
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock dependencies BEFORE import
vi.mock('../../server/services/ai/llmService', () => {
    return {
        LLMService: class {
            async call(params) {
                return {
                    response: {
                        content: 'AI Response Content',
                        usage: { totalTokens: 100 }
                    },
                    modelConfig: { id: 'mock-model' }
                };
            }
        }
    };
});

vi.mock('../../server/services/ai/aiGateway', () => ({
    AIGateway: class {
        async process() { return true; }
    }
}));

vi.mock('../../server/services/ai/promptAssembler', () => ({
    PromptAssembler: class {
        async build() { return { systemPrompt: 'sys', messages: [] }; }
    },
    FALLBACK_ROLES: {}
}));

vi.mock('../../server/services/ai/modelRouter', () => ({
    ModelRouter: class {
        async select() { return { id: 'mock-gpt-4', tier: 'STANDARD' }; }
    }
}));

vi.mock('../../server/services/ai/quotaService', () => ({
    quotaService: {
        checkQuota: vi.fn().mockResolvedValue({ allowed: true }),
        consumeTokens: vi.fn().mockResolvedValue()
    }
}));

vi.mock('../../server/services/ai/enterpriseSecurity', () => ({
    enterpriseSecurity: {
        checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
        logAudit: vi.fn().mockResolvedValue()
    }
}));

vi.mock('../../server/services/ai/learningSystem', () => ({
    learningSystem: {
        recordWithAutoFeedback: vi.fn().mockResolvedValue()
    }
}));

vi.mock('../../server/services/ai/performanceOptimizer', () => ({
    performanceOptimizer: {
        recordMetrics: vi.fn()
    }
}));

vi.mock('../../server/services/ai/observability', () => ({
    createTrace: vi.fn().mockReturnValue({
        traceId: 'trace-123',
        startSpan: vi.fn().mockReturnValue('span-1'),
        endSpan: vi.fn(),
        recordGeneration: vi.fn(),
        recordError: vi.fn(),
        complete: vi.fn()
    }),
    calculateCost: vi.fn().mockReturnValue({ totalCost: 0, totalTokens: 100 })
}));

vi.mock('../../server/services/ai/metrics', () => ({
    recordRequest: vi.fn()
}));

vi.mock('../../server/services/ai/cacheService', () => ({
    cacheService: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue()
    }
}));

vi.mock('../../server/services/ai/adaptiveResponseService', () => ({
    adaptiveResponseService: {
        determineResponseMode: vi.fn().mockResolvedValue({ mode: 'standard' }),
        buildResponseModePrompt: vi.fn().mockReturnValue('')
    }
}));

vi.mock('../../server/services/ai/memoryManager', () => ({
    memoryManager: {
        stores: {
            session: { getRecent: vi.fn().mockResolvedValue([]) },
            organization: { retrieve: vi.fn().mockResolvedValue({}) }
        },
        retrieve: vi.fn().mockResolvedValue({ chunks: [], totalTokens: 0 }),
        serializeForPrompt: vi.fn().mockReturnValue('Serialized Memory'),
        sessionStore: { addMessage: vi.fn().mockResolvedValue() },
        recordIfSignificant: vi.fn().mockResolvedValue()
    }
}));

vi.mock('../../server/services/ragService', () => ({
    searchRelevantChunks: vi.fn().mockResolvedValue([])
}));

// Mock IntelligentResearch to avoid loading real dependencies
vi.mock('../../server/services/ai/intelligentResearch', () => ({
    intelligentResearch: {
        supportConversation: vi.fn(),
        deepResearch: vi.fn()
    }
}));

// Mock Database to prevent initialization side-effects
vi.mock('../../server/database', () => ({
    run: vi.fn((sql, params, cb) => cb && cb(null)),
    all: vi.fn(),
    get: vi.fn()
}));

// 2. Import System Under Test (SUT)
import { AIPipeline } from '../../server/services/ai/aiPipeline';
import { enhancedContextBuilder } from '../../server/services/ai/enhancedContextBuilder';
import { intelligentResearch } from '../../server/services/ai/intelligentResearch';
import { actionExecutor } from '../../server/services/ai/actionExecutor';
import { LLMService } from '../../server/services/ai/llmService';

describe('AIPipeline Integration - "The Great Wiring"', () => {
    let pipeline;

    beforeEach(() => {
        vi.clearAllMocks();

        // Manual Dependency Injection Setup

        // 1. Setup ActionExecutor with mocked IntelligentResearch
        // Note: We import the CLASS from the module if possible, but here we likely got the instance.
        // Since we refactored ActionExecutor to be a class that we can instantiate:

        // Override the singleton's intelligentResearch property directly for the test
        actionExecutor.intelligentResearch = intelligentResearch;

        // 2. Setup AIPipeline
        pipeline = new AIPipeline();
        // Inject mocks into pipeline instance
        pipeline.contextBuilder = enhancedContextBuilder;
        pipeline.llmService = new LLMService(); // Inject mocked service
        // pipeline.intelligentResearch = intelligentResearch;  // Pipeline doesn't use it directly, contextBuilder does

        // 3. Setup EnhancedContextBuilder dependencies
        // enhancedContextBuilder is an instance. We can override its properties if they are exposed,
        // or we rely on the fact that we mocked its dependencies via vi.mock earlier?
        // Actually, enhancedContextBuilder imports intelligentResearch via require.
        // vi.mock('./intelligentResearch') ONLY works if we verified it worked.
        // It failed earlier.

        // So we MUST inject intelligentResearch into enhancedContextBuilder as well?
        // EnhancedContextBuilder has a constructor too! works with DI!
        // But the exported instance `enhancedContextBuilder` was already created in the module scope.
        // So we can try to override it:
        if (enhancedContextBuilder.intelligentResearch) {
            enhancedContextBuilder.intelligentResearch = intelligentResearch;
        }

        // Also inject actionExecutor into pipeline if needed (pipeline uses require ActionExecutor)
        // But pipeline uses ACTION_EXECUTOR global.
    });

    it('should use EnhancedContextBuilder during process()', async () => {
        const buildSpy = vi.spyOn(enhancedContextBuilder, 'build');

        const request = {
            userId: 'user-123',
            organizationId: 'org-123',
            projectId: 'proj-123',
            prompt: 'Test prompt',
            capability: 'chat',
            includeWebResearch: true
        };

        await pipeline.process(request);

        expect(buildSpy).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user-123',
            currentMessage: 'Test prompt',
            includeResearch: true
        }));
    });

    it('should integrate IntelligentResearch via ContextBuilder when needed', async () => {
        const researchSpy = vi.spyOn(intelligentResearch, 'supportConversation');

        // Mock research returning enabled and needed
        researchSpy.mockResolvedValue({
            needed: true,
            available: true,
            synthesis: { summary: 'Research Summary', keyInsights: [] },
            citations: []
        });

        const request = {
            userId: 'user-123',
            organizationId: 'org-123',
            prompt: 'Tell me about Poland digital trends',
            capability: 'chat',
            includeWebResearch: true
        };

        await pipeline.process(request);

        expect(researchSpy).toHaveBeenCalled();
    });

    it('ActionExecutor should handle TRIGGER_RESEARCH action', async () => {
        const deepResearchSpy = vi.spyOn(intelligentResearch, 'deepResearch');
        deepResearchSpy.mockResolvedValue({
            summary: 'Deep Research Summary',
            keyInsights: [],
            sources: []
        });

        const action = {
            type: 'trigger_research',
            payload: {
                topic: 'Advanced AI',
                depth: 'deep'
            }
        };

        const context = {
            userId: 'user-123',
            organizationId: 'org-123',
            projectId: 'proj-123'
        };

        const result = await actionExecutor.execute(action, context);
        console.log('ActionExecutor Result:', JSON.stringify(result, null, 2));

        expect(result.status).toBe('success');
        expect(result.type).toBe('trigger_research');
        expect(deepResearchSpy).toHaveBeenCalledWith(
            'Advanced AI',
            expect.objectContaining({
                depth: 'deep',
                organizationId: 'org-123'
            })
        );
    });
});
