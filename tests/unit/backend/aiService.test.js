import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const AIService = require('../../../server/services/aiService.js');

// Mock dependencies
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
};

const mockTokenBillingService = {
    hasSufficientBalance: vi.fn(),
    deductTokens: vi.fn()
};

const mockAnalyticsService = {
    logUsage: vi.fn().mockResolvedValue(true)
};

const mockFeedbackService = {
    getLearningExamples: vi.fn().mockResolvedValue('')
};

const mockGoogleGenerativeAI = vi.fn();
const mockGenerativeModel = {
    startChat: vi.fn(),
    getGenerativeModel: vi.fn()
};
const mockChatSession = {
    sendMessage: vi.fn(),
    sendMessageStream: vi.fn()
};

// Setup Google Mock Chain
mockGoogleGenerativeAI.mockImplementation(function () {
    return {
        getGenerativeModel: () => mockGenerativeModel
    };
});
mockGenerativeModel.startChat.mockReturnValue(mockChatSession);
mockChatSession.sendMessage.mockResolvedValue({
    response: { text: () => 'Mock Gemini Response' }
});

describe('AIService Unit Tests', () => {

    beforeAll(() => {
        // Inject mocks
        AIService.setDependencies({
            db: mockDb,
            TokenBillingService: mockTokenBillingService,
            AnalyticsService: mockAnalyticsService,
            FeedbackService: mockFeedbackService,
            GoogleGenerativeAI: mockGoogleGenerativeAI
        });

        // Mock Global Fetch
        global.fetch = vi.fn();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockTokenBillingService.hasSufficientBalance.mockResolvedValue(true);
        mockTokenBillingService.deductTokens.mockResolvedValue(true);

        const handleCallback = (args, result) => {
            // Find callback: checking last argument
            const cb = args.length > 0 && typeof args[args.length - 1] === 'function'
                ? args[args.length - 1]
                : null;
            if (cb) cb(null, result);
        };

        // Default DB mocks
        mockDb.get.mockImplementation((...args) => {
            const query = args[0];
            let result = null;

            if (typeof query === 'string') {
                if (query.includes('FROM llm_providers')) {
                    // Return default provider config
                    result = { id: 'default', provider: 'gemini', api_key: 'test-key', is_active: 1 };
                } else if (query.includes('FROM system_prompts')) {
                    result = { content: 'System Prompt' };
                }
            }
            handleCallback(args, result);
        });

        mockDb.all.mockImplementation((...args) => {
            handleCallback(args, []);
        });
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('callLLM', () => {
        it('should use Google Gemini by default if checks pass', async () => {
            const result = await AIService.callLLM('Test Prompt');
            expect(result).toBe('Mock Gemini Response');
            expect(mockTokenBillingService.deductTokens).toHaveBeenCalled();
        });

        it('should block if balance is insufficient', async () => {
            mockTokenBillingService.hasSufficientBalance.mockResolvedValue(false);

            // Mock provider config to be 'platform' so balance check runs (requires logic in getContext)
            // But our mockDb.get returns 'gemini' which might be 'platform' or 'local' depending on implementation
            // Actually aiService.js line 153: providerConfig.provider === 'ollama' ? 'local' : 'platform'
            // So gemini is 'platform'. Balance check runs.

            await expect(AIService.callLLM('Test Prompt', '', [], null, 'user-1')).rejects.toThrow('Insufficient token balance');
        });

        it('should call OpenAI via fetch when provider is openai', async () => {
            // Override DB mock to return openai
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        provider: 'openai',
                        api_key: 'sk-open',
                        endpoint: 'https://api.openai.com/v1',
                        model_id: 'gpt-4'
                    });
                }
            });

            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: 'OpenAI Response' } }] })
            });

            const result = await AIService.callLLM('Hello GPT', '', [], 'provider-openai', 'user-1');
            expect(result).toBe('OpenAI Response');
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('openai.com'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('should call Anthropic via fetch when provider is anthropic', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        provider: 'anthropic',
                        api_key: 'sk-anth',
                        endpoint: 'https://api.anthropic.com/v1',
                        model_id: 'claude-3'
                    });
                }
            });

            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ content: [{ text: 'Claude Response' }] })
            });

            const result = await AIService.callLLM('Hello Claude', '', [], 'provider-anthropic', 'user-1');
            expect(result).toBe('Claude Response');
        });
    });

    describe('generateInitiatives', () => {
        it('should parse JSON response correctly', async () => {
            const mockJson = JSON.stringify([{ title: 'Initiative 1', description: 'Test' }]);

            // Override behavior for this specific test
            mockChatSession.sendMessage.mockResolvedValueOnce({
                response: {
                    text: () => '```json' + String.fromCharCode(10) + mockJson + String.fromCharCode(10) + '```'
                }
            });

            // generateInitiatives calls enhancePrompt -> db.all. Check db.all mock handles callback.
            // Our robust mockDb.all does this.

            const initiatives = await AIService.generateInitiatives({ gap: 5 }, 'user-1');
            expect(initiatives).toHaveLength(1);
            expect(initiatives[0].title).toBe('Initiative 1');
        });

        it('should return empty array on JSON parse error', async () => {
            mockChatSession.sendMessage.mockResolvedValueOnce({
                // Invalid JSON
                response: { text: () => 'Invalid JSON' }
            });

            const initiatives = await AIService.generateInitiatives({}, 'user-1');
            expect(initiatives).toEqual([]);
        });
    });
    describe('streamLLM', () => {
        it('should yield chunks from Gemini stream', async () => {
            mockChatSession.sendMessageStream.mockResolvedValueOnce({
                stream: {
                    [Symbol.asyncIterator]: async function* () {
                        yield { text: () => 'Chunk 1' };
                        yield { text: () => 'Chunk 2' };
                    }
                }
            });

            const stream = AIService.streamLLM('Test', '', [], null, 'user-1');
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            expect(chunks).toEqual(['Chunk 1', 'Chunk 2']);
        });

        it('should handle errors in stream', async () => {
            mockChatSession.sendMessageStream.mockRejectedValueOnce(new Error('Stream Error'));

            const stream = AIService.streamLLM('Test', '', [], null, 'user-1');
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            expect(chunks[0]).toContain('[Error generating response]');
        });
    });
    describe('Generation Methods', () => {
        let callLLMSpy;

        beforeEach(() => {
            callLLMSpy = vi.spyOn(AIService, 'callLLM');
        });

        afterEach(() => {
            callLLMSpy.mockRestore();
        });

        describe('buildRoadmap', () => {
            it('should return roadmap object on success', async () => {
                const mockRoadmap = { year1: { q1: ['Task'] } };
                const mockResponse = '```json' + JSON.stringify(mockRoadmap) + '```';
                callLLMSpy.mockResolvedValue(mockResponse);

                const result = await AIService.buildRoadmap([{ title: 'Init 1' }], 'user-1');
                expect(result).toEqual(mockRoadmap);
            });

            it('should return empty object on error', async () => {
                callLLMSpy.mockRejectedValue(new Error('LLM Fail'));
                const result = await AIService.buildRoadmap([], 'user-1');
                expect(result).toEqual({});
            });
        });

        describe('suggestTasks', () => {
            it('should return tasks array on success', async () => {
                const mockTasks = [{ title: 'Task 1', stepPhase: 'design' }];
                const mockResponse = JSON.stringify(mockTasks);
                callLLMSpy.mockResolvedValue(mockResponse);

                const result = await AIService.suggestTasks({ name: 'Init 1' }, 'user-1');
                expect(result).toHaveLength(1);
                expect(result[0].title).toBe('Task 1');
            });
        });

        describe('deepDiagnose', () => {
            it('should execute chain of thought and return diagnosis', async () => {
                // Mock RagService
                const mockRagService = {
                    getAxisDefinitions: vi.fn().mockResolvedValue('Definition')
                };
                AIService.setDependencies({ RagService: mockRagService });

                const mockDiagnosis = { score: 4, summary: 'Good', gaps: [], recommendations: [] };
                const mockResponse = JSON.stringify(mockDiagnosis);

                // Chain of thought calls callLLM multiple times. 
                // We can mock it to return the final JSON on the last call, or generic on others.
                callLLMSpy.mockResolvedValue(mockResponse);

                const result = await AIService.deepDiagnose('Security', 'Input', 'user-1');
                expect(result.score).toBe(4);
            });
        });

        describe('enrichInitiative', () => {
            it('should maintain structure and fallback to LLM', async () => {
                // Mock WebSearch fail
                const mockWebSearchService = {
                    verifyFact: vi.fn().mockRejectedValue(new Error('Web Fail'))
                };
                AIService.setDependencies({ WebSearchService: mockWebSearchService });

                callLLMSpy.mockResolvedValue('Enriched Context');

                const result = await AIService.enrichInitiative({ name: 'Test' });
                expect(result).toBe('Enriched Context'); // Fallback to LLM
            });
        });

        describe('generateObservations', () => {
            it('should return observations from feedback', async () => {
                // Mock DB response for feedback
                mockDb.all.mockImplementation((query, params, cb) => {
                    if (query.includes('ai_feedback')) {
                        cb(null, [{ context: 'ctx', rating: 5, prompt: 'p' }]);
                    } else {
                        cb(null, []);
                    }
                });

                const mockObs = { app_improvements: ['Fix UI'], content_gaps: [] };
                callLLMSpy.mockResolvedValue(JSON.stringify(mockObs));

                const result = await AIService.generateObservations('user-1');
                expect(result.app_improvements).toContain('Fix UI');
            });
        });

        describe('testProviderConnection', () => {
            it('should test OpenAI connection', async () => {
                // Mock OpenAI dependency
                const mockOpenAI = class {
                    constructor() {
                        this.chat = {
                            completions: {
                                create: vi.fn().mockResolvedValue({
                                    choices: [{ message: { content: 'OK' } }]
                                })
                            }
                        };
                    }
                };
                AIService.setDependencies({ OpenAI: mockOpenAI });

                const result = await AIService.testProviderConnection({ provider: 'openai', api_key: 'sk-test' });
                expect(result.success).toBe(true);
                expect(result.response).toBe('OK');
            });
        });
    });
});
