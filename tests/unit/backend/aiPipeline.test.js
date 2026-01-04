// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

describe('AIPipeline', () => {
    let pipeline;
    let AIPipelineClass;
    let mockCacheService;
    let mockRagService;
    let mockSettingsService;
    let mocks;

    beforeEach(async () => {
        vi.resetModules(); // Ensure fresh module registry

        mocks = setupStandardTest();

        // Setup database mock for audit logging
        mocks.db.run = vi.fn();
        mocks.db.run.mockImplementation((sql, params, cb) => {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) {
                callback.call({ lastID: 1, changes: 1 }, null);
            }
            return mocks.db; // Ensure it returns mockDb for chaining
        });

        // 1. Mock Database dependencies FIRST
        vi.doMock('../../../server/database', () => ({
            default: mocks.db,
            getDatabase: () => mocks.db
        }));

        vi.doMock('../../../server/src/database/Database.ts', () => ({
            getDatabase: () => mocks.db,
            default: mocks.db
        }));

        // 2. Mock Google Generative AI
        vi.doMock('@google/generative-ai', () => ({
            GoogleGenerativeAI: vi.fn(),
            HarmCategory: {},
            HarmBlockThreshold: {}
        }));

        // 3. Mock Service Dependencies
        vi.doMock('../../../server/services/ai/enhancedContextBuilder.js', () => ({
            enhancedContextBuilder: {
                build: vi.fn().mockResolvedValue({ narrative: 'Mock Context', metadata: {} }),
                formatSessionContext: vi.fn().mockReturnValue('User: Hello')
            },
            EnhancedContextBuilder: vi.fn()
        }));

        vi.doMock('../../../server/services/ai/intelligentResearch.js', () => ({
            intelligentResearch: { research: vi.fn(), supportConversation: vi.fn() }
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
                    build: vi.fn().mockResolvedValue({ systemPromise: Promise.resolve('Sys'), messages: [] })
                };
            }),
            FALLBACK_ROLES: { ANALYST: 'analyst' }
        }));

        vi.mock('../../../server/services/ai/modelRouter.js', () => ({
            ModelRouter: vi.fn().mockImplementation(function () {
                return {
                    route: vi.fn().mockReturnValue({ id: 'gemini-pro', provider: 'google', tier: 'standard' }),
                    select: vi.fn().mockReturnValue({ id: 'gemini-pro', provider: 'google', tier: 'standard' }),
                    getFallbackChain: vi.fn().mockReturnValue(['gpt-4']),
                    getProviderConfig: vi.fn().mockResolvedValue({ id: 'gpt-4', provider: 'openai', tier: 'standard' })
                };
            })
        }));

        vi.doMock('../../../server/services/ai/qualityChecker.js', () => ({
            qualityChecker: { check: vi.fn().mockResolvedValue({ passed: true, overallScore: 0.9 }) }
        }));

        vi.doMock('../../../server/services/ai/performanceOptimizer.js', () => ({
            performanceOptimizer: { optimize: vi.fn(), recordMetrics: vi.fn() }
        }));

        vi.doMock('../../../server/services/ai/learningSystem.js', () => ({
            learningSystem: { recordWithAutoFeedback: vi.fn() }
        }));

        // Lazy deps
        mockCacheService = { get: vi.fn(), set: vi.fn() };
        mockRagService = { searchRelevantChunks: vi.fn().mockResolvedValue([]) };
        mockSettingsService = { getEffectiveSettings: vi.fn().mockResolvedValue({}) };

        vi.doMock('../../../server/services/ai/cacheService.js', () => ({ cacheService: mockCacheService }));
        vi.doMock('../../../server/services/ragService.js', () => ({ default: mockRagService }));
        vi.doMock('../../../server/services/aiSettingsService.js', () => ({ default: mockSettingsService }));

        // Mock LLMService just in case
        vi.doMock('../../../server/services/ai/llmService.js', () => ({
            LLMService: vi.fn().mockImplementation(function () {
                return { call: vi.fn() };
            })
        }));

        // Observability
        const mockTrace = {
            startSpan: vi.fn().mockReturnValue({}),
            endSpan: vi.fn(),
            complete: vi.fn(),
            recordError: vi.fn(),
            recordGeneration: vi.fn()
        };
        vi.doMock('../../../server/services/ai/observability.js', () => ({
            createTrace: vi.fn().mockReturnValue(mockTrace),
            calculateCost: vi.fn().mockReturnValue({ totalCost: 0.001, totalTokens: 100 })
        }));

        vi.doMock('../../../server/services/ai/metrics.js', () => ({
            default: { recordRequest: vi.fn() }
        }));

        vi.doMock('../../../server/services/ai/adaptiveResponseService.js', () => ({
            adaptiveResponseService: {
                determineResponseMode: vi.fn().mockResolvedValue({ mode: 'concise' }),
                buildResponseModePrompt: vi.fn().mockReturnValue('')
            }
        }));

        vi.doMock('../../../server/services/ai/logger.js', () => ({
            aiLogger: {
                info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(),
                cache: vi.fn(), pipeline: vi.fn(), rag: vi.fn()
            }
        }));

        // Finally Import Module
        const module = await import('../../../server/services/ai/aiPipeline.js');
        AIPipelineClass = module.AIPipeline;

        pipeline = new AIPipelineClass({
            llmService: {
                call: vi.fn().mockResolvedValue({
                    content: "Mock Content",
                    usage: { total_tokens: 50 },
                    finishReason: 'stop'
                })
            },
            memoryManager: {
                retrieve: vi.fn().mockResolvedValue({ chunks: [], totalTokens: 0 }),
                store: vi.fn().mockResolvedValue(true),
                serializeForPrompt: vi.fn().mockReturnValue('')
            },
            quotaService: {
                checkQuota: vi.fn().mockResolvedValue({ allowed: true }),
                consumeTokens: vi.fn().mockResolvedValue(true)
            },
            enterpriseSecurity: {
                checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
                logAudit: vi.fn().mockResolvedValue(true)
            }
        });

        // Initialize lazy deps with mocks
        pipeline.cacheService = mockCacheService;
        pipeline.ragService = mockRagService;
        pipeline.settingsService = mockSettingsService;
        pipeline.observability = {
            createTrace: vi.fn().mockReturnValue({ startSpan: vi.fn(), endSpan: vi.fn() }),
            recordError: vi.fn(),
            recordMetric: vi.fn()
        };

        if (pipeline.initDeps) await pipeline.initDeps();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should process a basic chat request from start to finish', async () => {
        const result = await pipeline.process({
            type: 'chat',
            userId: 'u1',
            organizationId: 'o1',
            capability: 'chat',
            messages: [{ role: 'user', content: 'Hello' }]
        });

        expect(result.content).toBe('Mock Content');
        expect(result.metadata.model).toBe('gemini-pro');
        expect(pipeline.llmService.call).toHaveBeenCalled();
    });

    it('should block request if rate limit exceeded', async () => {
        pipeline.enterpriseSecurity.checkRateLimit.mockResolvedValue({ allowed: false, limitType: 'RPM' });

        await expect(pipeline.process({
            userId: 'u1', organizationId: 'o1'
        })).rejects.toThrow('Rate limit exceeded');
    });

    it('should block request if quota exceeded', async () => {
        pipeline.quotaService.checkQuota.mockResolvedValue({ allowed: false, reason: 'Monthly limit' });

        await expect(pipeline.process({
            userId: 'u1', organizationId: 'o1', projectId: 'p1'
        })).rejects.toThrow('Quota exceeded');
    });

    it('should return cached response if available', async () => {
        mockCacheService.get.mockResolvedValue({
            content: 'Cached Content',
            metadata: { model: 'cached-model' }
        });

        const result = await pipeline.process({
            userId: 'u1', organizationId: 'o1',
            prompt: 'Cached Query'
        });

        expect(result.content).toBe('Cached Content');
        expect(result.metadata.cached).toBe(true);
        expect(pipeline.llmService.call).not.toHaveBeenCalled();
    });

    it('should include RAG chunks when available', async () => {
        mockRagService.searchRelevantChunks.mockResolvedValue([
            { source: 'doc1', content: 'Relevant Info', similarity: 0.9 }
        ]);

        await pipeline.process({
            userId: 'u1', organizationId: 'o1',
            prompt: 'Question about doc1'
        });

        // Verify RAG service called
        expect(mockRagService.searchRelevantChunks).toHaveBeenCalled();
    });

    it('should use fallback model on failure', async () => {
        // First call fails
        pipeline.llmService.call.mockRejectedValueOnce(new Error('API Timeout'));
        // Second call succeeds
        pipeline.llmService.call.mockResolvedValueOnce({
            content: 'Fallback Content',
            usage: { total_tokens: 60 }
        });

        const result = await pipeline.process({
            userId: 'u1', organizationId: 'o1',
            prompt: 'Retry Me'
        });

        expect(result.content).toBe('Fallback Content');
        expect(pipeline.llmService.call).toHaveBeenCalledTimes(2);
    });

    it('should fail if all models in chain fail', async () => {
        pipeline.llmService.call.mockRejectedValue(new Error('All Failed'));

        await expect(pipeline.process({
            userId: 'u1', organizationId: 'o1',
            prompt: 'Fail Me'
        })).rejects.toThrow('All Failed');
    });

    it('should handle quality check warnings', async () => {
        // We need to access the qualityChecker referenced by the pipeline
        // Since we mocked the module, aiPipeline constructor loaded it.
        // But we passed instances in constructor too?
        // Note: In constructor we did NOT pass qualityChecker, so it uses the mocked import.

        // However, we can't easily access the internal 'qualityChecker' plain object import from here unless we assigned it to `pipeline`
        // But the pipeline assigns `this.qualityChecker = injectedQualityChecker || qualityChecker;`

        // Let's use `vi.doMock` return value capture or just verify behavior log
        // Better: mock the import return value to fail for specific call
        // Currently doMock sets it to always pass 0.9.
        // We can't change `vi.doMock` mid-test easily.
        // BUT, `check` is a jest mock function (vi.fn). We can change its implementation!

        // We need reference to the mocked quality checker.
        const { qualityChecker } = await import('../../../server/services/ai/qualityChecker.js');
        qualityChecker.check.mockResolvedValueOnce({
            passed: false,
            overallScore: 0.4,
            warnings: ['Low relevance']
        });

        const result = await pipeline.process({
            userId: 'u1', organizationId: 'o1',
            prompt: 'Bad Quality Response'
        });

        expect(result.content).toBe('Mock Content');
        expect(result.metadata.quality.score).toBe(0.4);
    });

    it('should record audit logs and metrics', async () => {
        await pipeline.process({
            userId: 'u1', organizationId: 'o1'
        });

        expect(pipeline.enterpriseSecurity.logAudit).toHaveBeenCalled();
    });

    describe('Resilient Wrappers (Fail-Open)', () => {
        it('should allow request if rate limit check throws error', async () => {
            pipeline.enterpriseSecurity.checkRateLimit.mockRejectedValue(new Error('DB Down'));

            const result = await pipeline.process({
                userId: 'u1', organizationId: 'o1',
                capability: 'chat',
                messages: [{ role: 'user', content: 'Hi' }]
            });

            expect(result.content).toBe('Mock Content');
            // Should log error but proceed
        });

        it('should allow request if quota check throws error', async () => {
            pipeline.quotaService.checkQuota.mockRejectedValue(new Error('Service Unavailable'));

            const result = await pipeline.process({
                userId: 'u1', organizationId: 'o1',
                capability: 'chat'
            });

            expect(result.content).toBe('Mock Content');
        });

        it('should proceed if quality check throws error', async () => {
            // Need to mock implementation to throw
            const { qualityChecker } = await import('../../../server/services/ai/qualityChecker.js');
            qualityChecker.check.mockRejectedValueOnce(new Error('Checker Failed'));

            const result = await pipeline.process({
                userId: 'u1', organizationId: 'o1'
            });

            expect(result.content).toBe('Mock Content');
            expect(result.metadata.quality.passed).toBe(true); // Default assumption
        });
    });

    describe('Domain Methods', () => {
        it('should execute suggestTasks wrapper', async () => {
            const { suggestTasks } = await import('../../../server/services/ai/aiPipeline.js');
            const result = await suggestTasks('init-123', 'u1', 'o1', pipeline);
            expect(result).toBeDefined();
            expect(pipeline.llmService.call).toHaveBeenCalled();
        });

        it('should execute generateStructuredContent wrapper', async () => {
            const { generateStructuredContent } = await import('../../../server/services/ai/aiPipeline.js');
            const result = await generateStructuredContent('Generate Risk Log', { type: 'table' }, 'u1', 'o1', pipeline);
            expect(result).toBeDefined();
        });

        it('should execute chat wrapper', async () => {
            const { chat } = await import('../../../server/services/ai/aiPipeline.js');
            const result = await chat([{ role: 'user', content: 'Hi' }], [], 'CONSULTANT', 'u1', 'o1', pipeline);
            expect(result).toBe('Mock Content');
        });
    });

    describe('Streaming', () => {
        it('should handle streamChat request via class method', async () => {
            // Mock stream response
            const mockStream = {
                async *[Symbol.asyncIterator]() {
                    yield { content: 'Chunk 1' };
                    yield { content: 'Chunk 2' };
                }
            };

            // Setup mock BEFORE calling function
            pipeline.llmService.stream = vi.fn().mockResolvedValue(mockStream);

            // Use the CLASS METHOD streamChat
            const iterator = await pipeline.streamChat([{ role: 'user', content: 'Stream Me' }], {
                userId: 'u1',
                organizationId: 'o1'
            });

            const chunks = [];
            for await (const chunk of iterator) {
                chunks.push(chunk);
            }

            expect(chunks.length).toBe(2);
            expect(pipeline.llmService.stream).toHaveBeenCalled();
        });
    });
});
