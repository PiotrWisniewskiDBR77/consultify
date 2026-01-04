// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';

// Explicitly mock Google Generative AI to ensure it works in this ESM context
vi.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: vi.fn().mockImplementation(function () {
            return {
                getGenerativeModel: vi.fn().mockReturnValue({
                    getGenerativeModel: vi.fn().mockReturnThis(),
                    generateContent: vi.fn().mockResolvedValue({
                        response: {
                            text: () => 'Mock AI Response',
                            candidates: [{ content: { parts: [{ text: 'Mock AI Response' }] } }]
                        }
                    }),
                    countTokens: vi.fn().mockResolvedValue({ totalTokens: 100 })
                })
            };
        }),
        HarmCategory: { HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT' },
        HarmBlockThreshold: { BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE' }
    };
});

// Mock dependencies that cause side effects or are hardcoded
vi.mock('../../../server/services/ai/enhancedContextBuilder.js', () => ({
    enhancedContextBuilder: {
        build: vi.fn().mockResolvedValue({ narrative: 'Mock Context', metadata: {} }),
        formatSessionContext: vi.fn().mockReturnValue('User: Hello')
    }
}));

vi.mock('../../../server/services/ai/intelligentResearch.js', () => ({
    intelligentResearch: {
        research: vi.fn(),
        supportConversation: vi.fn()
    }
}));

vi.mock('../../../server/services/ai/aiGateway.js', () => ({
    AIGateway: vi.fn().mockImplementation(function () {
        return {
            process: vi.fn().mockResolvedValue({ allowed: true })
        };
    })
}));

vi.mock('../../../server/services/ai/promptAssembler.js', () => ({
    PromptAssembler: vi.fn().mockImplementation(function () {
        return {
            assemble: vi.fn().mockResolvedValue({ systemPromise: Promise.resolve('Sys'), messages: [] }),
            build: vi.fn().mockResolvedValue({ systemPromise: Promise.resolve('Sys'), messages: [] })
        };
    }),
    FALLBACK_ROLES: { ANALYST: 'analyst' }
}));

vi.mock('../../../server/services/ai/modelRouter.js', () => ({
    ModelRouter: vi.fn().mockImplementation(function () {
        return {
            route: vi.fn().mockReturnValue({ id: 'gemini-pro', provider: 'google' }),
            select: vi.fn().mockReturnValue({ id: 'gemini-pro', provider: 'google' })
        };
    })
}));

vi.mock('../../../server/services/ai/qualityChecker.js', () => ({
    qualityChecker: { check: vi.fn().mockResolvedValue({ passed: true }) }
}));

vi.mock('../../../server/services/ai/performanceOptimizer.js', () => ({
    performanceOptimizer: {
        optimize: vi.fn().mockReturnValue({}),
        recordMetrics: vi.fn().mockReturnValue(true)
    }
}));

vi.mock('../../../server/services/ai/learningSystem.js', () => ({
    learningSystem: { learn: vi.fn().mockResolvedValue(true) }
}));

// Mock lazy-loaded dependencies
vi.mock('../../../server/services/ai/cacheService.js', () => ({
    cacheService: { get: vi.fn(), set: vi.fn() }
}));

vi.mock('../../../server/services/ragService.js', () => ({
    default: {
        retrieveContext: vi.fn().mockResolvedValue([]),
        searchRelevantChunks: vi.fn().mockResolvedValue({ chunks: [] })
    }
}));

vi.mock('../../../server/services/aiSettingsService.js', () => ({
    default: { getEffectiveSettings: vi.fn().mockResolvedValue({}) }
}));

vi.mock('../../../server/services/ai/observability.js', () => ({
    createTrace: vi.fn().mockImplementation(() => ({
        complete: vi.fn(),
        error: vi.fn(),
        addEvent: vi.fn(),
        recordError: vi.fn(),
        startSpan: vi.fn().mockReturnValue({}),
        endSpan: vi.fn(),
        recordGeneration: vi.fn(),
        setAttributes: vi.fn(),
        setStatus: vi.fn()
    })),
    calculateCost: vi.fn().mockReturnValue(0)
}));

vi.mock('../../../server/services/ai/metrics.js', () => {
    return {
        default: {
            recordRequest: vi.fn(),
            recordError: vi.fn()
        }
    };
});

vi.mock('../../../server/services/ai/adaptiveResponseService.js', () => ({
    adaptiveResponseService: {
        adaptResponse: vi.fn().mockImplementation((r) => r)
    }
}));

vi.mock('../../../server/services/ai/logger.js', () => ({
    aiLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        cache: vi.fn(),
        pipeline: vi.fn()
    }
}));

describe('AIPipeline', () => {
    let AIPipeline;
    let mockDb;
    let pipeline;

    beforeEach(async () => {
        vi.clearAllMocks(); // Use clearAllMocks instead of resetModules to preserve mocks

        mockDb = createMockDb();

        // Mock database module
        vi.doMock('../../../server/database', () => ({
            default: mockDb,
            getDatabase: () => mockDb
        }));

        // Dynamically import the class
        const module = await import('../../../server/services/ai/aiPipeline.js');
        const AIPipelineClass = module.AIPipeline;

        // Create instance with injected dependencies
        pipeline = new AIPipelineClass({
            llmService: {
                generate: vi.fn().mockResolvedValue({ content: "Mock AI Response", usage: { total_tokens: 10 } }),
                stream: vi.fn(),
                call: vi.fn().mockResolvedValue({ content: "Mock AI Response", usage: { total_tokens: 10 } })
            },
            memoryManager: {
                retrieve: vi.fn().mockResolvedValue({ chunks: [], totalTokens: 0 }),
                store: vi.fn().mockResolvedValue(true),
                serializeForPrompt: vi.fn().mockReturnValue('')
            },
            quotaService: {
                checkQuota: vi.fn().mockResolvedValue({ allowed: true })
            },
            enterpriseSecurity: {
                checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
                logAudit: vi.fn().mockResolvedValue(true)
            },
            qualityChecker: {
                check: vi.fn().mockResolvedValue({ passed: true })
            },
            performanceOptimizer: {
                optimize: vi.fn().mockReturnValue({}),
                recordMetrics: vi.fn().mockReturnValue(true)
            },
            learningSystem: {
                learn: vi.fn().mockResolvedValue(true)
            }
        });

        // Initialize dependencies if needed (aiPipeline loads some lazily)
        if (pipeline.initDeps) await pipeline.initDeps();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should process a basic chat request successfully', async () => {
        const request = {
            type: 'chat',
            userId: 'user-1',
            organizationId: 'org-1',
            capability: 'chat',
            messages: [{ role: 'user', content: 'Hello' }]
        };

        const response = await pipeline.process(request);

        expect(response).toBeDefined();
        expect(response.content).toBe("Mock AI Response");
        expect(response.metadata).toBeDefined();
        expect(response.metadata.model).toBe('gemini-pro');
    });

    it('should handle errors gracefully', async () => {
        // Mock gateway failure
        pipeline.gateway.process = vi.fn().mockRejectedValue(new Error('Security blocked'));

        const request = { userId: 'bad-user' };

        await expect(pipeline.process(request)).rejects.toThrow('Security blocked');
    });
});
