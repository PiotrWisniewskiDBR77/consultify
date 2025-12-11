import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
// Determine absolute paths for robust mocking
const serverDir = path.resolve(__dirname, '../../../server');

// Mock Google Generative AI globally - MUST BE TOP LEVEL
vi.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
            getGenerativeModel: vi.fn().mockReturnValue({
                generateContent: vi.fn().mockResolvedValue({
                    response: { text: () => "Google Test Response" }
                })
            })
        }))
    };
});

// Mock OpenAI globally for testProviderConnection - MUST BE TOP LEVEL
vi.mock('openai', () => {
    const MockOpenAI = vi.fn();
    MockOpenAI.prototype.chat = {
        completions: {
            create: vi.fn().mockResolvedValue({
                choices: [{ message: { content: "OpenAI Test Response" } }]
            })
        }
    };
    return { default: MockOpenAI };
});

describe('AiService Tests', () => {
    let AiService;
    let mockDb;
    let mockTokenBilling;
    let mockAnalytics;
    let mockGoogleGenerativeAI;
    let mockGenModel;
    let mockChatSession;
    let mockRagService;
    let mockFeedback;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        process.env.GEMINI_API_KEY = 'test-key';

        // 1. Define Mocks
        mockDb = {
            get: vi.fn((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                if (callback) callback(null, null); // Default: not found
            }),
            all: vi.fn((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                if (callback) callback(null, []); // Default: empty list
            }),
            run: vi.fn(),
        };

        mockTokenBilling = {
            hasSufficientBalance: vi.fn().mockResolvedValue(true),
            deductTokens: vi.fn().mockResolvedValue(true)
        };

        mockAnalytics = {
            logUsage: vi.fn().mockResolvedValue(true),
            saveMaturityScore: vi.fn().mockResolvedValue(true)
        };

        // Mock Gemini
        mockChatSession = {
            sendMessage: vi.fn().mockResolvedValue({ response: Promise.resolve({ text: () => "Mock Response" }) }),
            sendMessageStream: vi.fn().mockResolvedValue({
                stream: (async function* () { yield { text: () => "Mock Chunk" }; })()
            })
        };
        mockGenModel = {
            startChat: vi.fn().mockReturnValue(mockChatSession),
            generateContent: vi.fn().mockResolvedValue({ response: { text: () => "Mock Content" } })
        };
        mockGoogleGenerativeAI = vi.fn().mockImplementation(function () {
            return {
                getGenerativeModel: vi.fn().mockReturnValue(mockGenModel)
            };
        });

        // Mock RagService
        mockRagService = {
            getAxisDefinitions: vi.fn().mockResolvedValue("Mock Axis Definition"),
            getContext: vi.fn().mockResolvedValue("Mock Context")
        };

        // Mock FeedbackService (Default)
        mockFeedback = {
            getLearningExamples: vi.fn().mockResolvedValue("Long enough example text to satisfy the condition > 50 chars.")
        };

        // 2. Import SUT (System Under Test)
        const module = await import('../../../server/services/aiService');
        AiService = module.default || module;

        // 3. Inject Dependencies
        AiService.setDependencies({
            db: mockDb,
            TokenBillingService: mockTokenBilling,
            AnalyticsService: mockAnalytics,
            GoogleGenerativeAI: mockGoogleGenerativeAI,
            RagService: mockRagService,
            FeedbackService: mockFeedback,
            OpenAI: class {
                constructor() {
                    this.chat = {
                        completions: {
                            create: vi.fn().mockResolvedValue({
                                choices: [{ message: { content: "OpenAI Test Response" } }]
                            })
                        }
                    };
                }
            }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete global.fetch;
    });

    describe('callLLM', () => {
        it('should fallback to Gemini (default) when no provider configured', async () => {
            // Setup DB to return nothing (no provider, no user pref)
            mockDb.get.mockImplementation((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                callback(null, null);
            });

            // Call
            const result = await AiService.callLLM("Test prompt", "", [], null, 1); // userId 1 to trigger balance check

            expect(result).toBe("Mock Response");
            expect(mockTokenBilling.hasSufficientBalance).toHaveBeenCalledWith(1, expect.any(Number));
            expect(mockTokenBilling.deductTokens).toHaveBeenCalled();
        });

        it('should use OpenAI when provider is configured', async () => {
            // Mock DB to return OpenAI provider
            mockDb.get.mockImplementation((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                if (query.includes('FROM llm_providers')) {
                    callback(null, {
                        id: 1,
                        provider: 'openai',
                        api_key: 'sk-test',
                        model_id: 'gpt-4',
                        markup_multiplier: 1.5
                    });
                } else {
                    callback(null, null);
                }
            });

            // Mock fetch for OpenAI
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: "OpenAI Response" } }] })
            });

            const result = await AiService.callLLM("Test prompt", "", [], 1);

            expect(result).toBe("OpenAI Response");
            expect(mockTokenBilling.hasSufficientBalance).toHaveBeenCalled();
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('openai.com'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({ 'Authorization': 'Bearer sk-test' })
                })
            );
        });

        it('should handle OpenAI error gracefully', async () => {
            // Mock DB to return OpenAI provider
            mockDb.get.mockImplementation((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                callback(null, { id: 1, provider: 'openai', api_key: 'sk-test' });
            });

            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                statusText: "Server Error"
            });

            await expect(AiService.callLLM("Test", "", [], 1)).rejects.toThrow("OpenAI error: Server Error");
        });

        it('should use Anthropic when provider is configured', async () => {
            mockDb.get.mockImplementation((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                callback(null, { id: 2, provider: 'anthropic', api_key: 'sk-ant' });
            });

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ content: [{ text: "Claude Response" }] })
            });

            const result = await AiService.callLLM("Test", "", [], 2);
            expect(result).toBe("Claude Response");
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('anthropic.com'),
                expect.anything()
            );
        });

        it('should use Ollama when provider is configured', async () => {
            mockDb.get.mockImplementation((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                callback(null, { id: 3, provider: 'ollama', endpoint: 'http://localhost:11434' });
            });

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ message: { content: "Llama Response" } })
            });

            const result = await AiService.callLLM("Test", "", [], 3);
            expect(result).toBe("Llama Response");
        });

        it('should use DeepSeek provider', async () => {
            mockDb.get.mockImplementation((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                callback(null, { id: 4, provider: 'deepseek', api_key: 'sk-deep' });
            });

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: "DS Response" } }] })
            });

            const result = await AiService.callLLM("Test", "", [], 4);
            expect(result).toBe("DS Response");
        });
    });

    describe('Provider Coverage', () => {
        const providers = [
            { name: 'deepseek', modelId: 'deepseek-chat', endpoint: 'https://api.deepseek.com/v1', expectedUrl: 'https://api.deepseek.com/v1' },
            { name: 'qwen', modelId: 'qwen-turbo', endpoint: 'https://api.qwen.ai/v1', expectedUrl: 'https://api.qwen.ai/v1' },
            { name: 'mistral', modelId: 'mistral-large-latest', endpoint: 'https://api.mistral.ai/v1/chat/completions', expectedUrl: 'https://api.mistral.ai/v1/chat/completions' },
            { name: 'anthropic', modelId: 'claude-3-opus-20240229', endpoint: 'https://api.anthropic.com/v1/messages', expectedUrl: 'https://api.anthropic.com/v1/messages' },
            { name: 'groq', modelId: 'llama3-70b-8192', endpoint: 'https://api.groq.com/openai/v1/chat/completions', expectedUrl: 'https://api.groq.com/openai/v1/chat/completions' },
            { name: 'together', modelId: 'meta-llama/Llama-3-700b', endpoint: 'https://api.together.xyz/v1/chat/completions', expectedUrl: 'https://api.together.xyz/v1/chat/completions' },
            { name: 'nvidia_nim', modelId: 'llama-3.1-405b-instruct', endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions', expectedUrl: 'https://integrate.api.nvidia.com/v1/chat/completions' },
            { name: 'zhipu', modelId: 'glm-4', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', expectedUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions' },
            { name: 'cohere', modelId: 'command-r', endpoint: 'https://api.cohere.ai/v1/chat', expectedUrl: 'https://api.cohere.ai/v1/chat' },
            { name: 'ernie', modelId: 'ernie-4.0', endpoint: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro', expectedUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro' }
        ];

        providers.forEach(p => {
            it(`should use ${p.name} provider correctly`, async () => {
                // Mock dependencies to return this provider
                mockDb.get.mockImplementation((query, params, cb) => {
                    const callback = typeof params === 'function' ? params : cb;
                    if (query.includes('FROM llm_providers')) {
                        callback(null, {
                            id: 1,
                            provider: p.name,
                            api_key: 'test-key',
                            model_id: p.modelId,
                            endpoint: p.endpoint,
                            markup_multiplier: 1.0,
                            is_active: 1
                        });
                    } else if (query.includes('system_prompts')) {
                        callback(null, { content: "System" });
                    } else {
                        callback(null, null);
                    }
                });

                // Mock Fetch Response
                const mockFetchInfo = {
                    ok: true,
                    json: async () => {
                        if (p.name === 'anthropic') {
                            return { content: [{ text: "Provider Response" }] };
                        }
                        if (p.name === 'cohere' || p.name === 'ernie') {
                            return { text: "Provider Response", result: "Provider Response" }; // Ernie uses result
                        }
                        return {
                            choices: [{ message: { content: "Provider Response" } }],
                            message: { content: "Provider Response" } // For Ollama/others
                        };
                    }
                };
                global.fetch = vi.fn().mockResolvedValue(mockFetchInfo);

                const response = await AiService.callLLM("Test Prompt", "System", [], 1, 123);
                expect(response).toBe("Provider Response");

                // Verify Fetch calls
                expect(global.fetch).toHaveBeenCalled();
                const callArgs = global.fetch.mock.calls[0];
                // Check URL includes endpoint for all providers except Gemini (which is mocked internally)
                // Ollama is also handled by global.fetch, so it should be checked.
                if (p.name !== 'gemini') {
                    expect(callArgs[0]).toContain(p.expectedUrl);
                    expect(callArgs[1].method).toBe('POST');
                }
            });
        });
    });

    describe('Diagnosis Logic', () => {
        it('deepDiagnose should run chain of thought and save analytics', async () => {
            // Mock callLLM to return valid JSON for diagnosis
            const mockDiagnosis = JSON.stringify({
                score: 4,
                summary: "Good",
                gaps: ["Gap1"],
                recommendations: ["Rec1"]
            });

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: mockDiagnosis } }] })
            });

            // Mock DB for organization lookup
            mockDb.get.mockImplementation((q, p, cb) => {
                const callback = typeof p === 'function' ? p : cb;
                if (q.includes('SELECT organization_id')) {
                    callback(null, { organization_id: 10, industry: 'Tech' });
                } else if (q.includes('SELECT industry')) {
                    callback(null, { industry: 'Tech' });
                } else {
                    callback(null, { is_active: 1, provider: 'openai', api_key: 'sk-test' });
                }
            });
            const result = await AiService.diagnose("Strategy", "Input", 123);
            expect(result.score).toBe(4);
            expect(mockAnalytics.logUsage).toHaveBeenCalled();
        });

        it('deepDiagnose should run chain of thought and save analytics', async () => {
            mockDb.get.mockImplementation((q, p, cb) => cb(null, { organization_id: 10, industry: 'Tech' }));

            // Mock chain of thought response
            vi.spyOn(AiService, 'callLLM').mockResolvedValue('{"score":3, "gaps": []}');

            const result = await AiService.deepDiagnose("Axis1", "Input", 1);
            expect(result.score).toBe(3);
            expect(mockAnalytics.saveMaturityScore).toHaveBeenCalled();
        });

        it('deepDiagnose should handle JSON parse errors by returning fallback', async () => {
            // Return invalid JSON
            vi.spyOn(AiService, 'callLLM').mockResolvedValue('Invalid JSON Content');

            // Suppress console.error for this test
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await AiService.deepDiagnose("Axis1", "Input", 1);
            expect(result.score).toBe(1); // Default
            expect(result.summary).toBe("Invalid JSON Content"); // Raw result as summary

            consoleSpy.mockRestore();
        });
    });

    describe('Helper Methods', () => {
        it('simulateEconomics should delegate to FinancialService and call LLM', async () => {
            const mockSim = { roi: 100 };
            const mockFinancial = { simulatePortfolio: vi.fn().mockReturnValue(mockSim) };
            AiService.setDependencies({ FinancialService: mockFinancial });

            // Mock callLLM to return commentary JSON
            const mockCommentary = JSON.stringify({ commentary: "Good", riskAssessment: "Low" });
            vi.spyOn(AiService, 'callLLM').mockResolvedValue(mockCommentary);
            vi.spyOn(AiService, 'enhancePrompt').mockResolvedValue("System Prompt");

            const result = await AiService.simulateEconomics([], 100, 1);
            expect(mockFinancial.simulatePortfolio).toHaveBeenCalled();
            expect(result.commentary).toBe("Good");
            expect(result.roi).toBe(100);
        });

        it('verifyWithWeb should delegate to WebSearchService', async () => {
            const mockWeb = { verifyFact: vi.fn().mockResolvedValue("Fact Verified") };
            AiService.setDependencies({ WebSearchService: mockWeb });

            const result = await AiService.verifyWithWeb("Query", 1);
            expect(mockWeb.verifyFact).toHaveBeenCalledWith("Query");
            expect(result).toBe("Fact Verified");
        });

        it('enrichInitiative should use WebSearchService', async () => {
            const mockWeb = { verifyFact: vi.fn().mockResolvedValue("Enriched Data") };
            AiService.setDependencies({ WebSearchService: mockWeb });

            const result = await AiService.enrichInitiative({ name: "Init1", summary: "Sum" });
            expect(result).toBe("Enriched Data");
        });

        it('enrichInitiative should fallback to LLM if WebSearch fails', async () => {
            const mockWeb = { verifyFact: vi.fn().mockRejectedValue(new Error("Web Fail")) };
            AiService.setDependencies({ WebSearchService: mockWeb });
            vi.spyOn(AiService, 'callLLM').mockResolvedValue("Enriched via LLM");

            const result = await AiService.enrichInitiative({ name: "I1", summary: "S" });
            expect(AiService.callLLM).toHaveBeenCalledWith(expect.stringContaining("market context"), expect.stringContaining("Market Researcher"));
            expect(result).toBe("Enriched via LLM");
        });

        it('validateInitiative should return safe default on error', async () => {
            vi.spyOn(AiService, 'callLLM').mockRejectedValue(new Error("LLM Fail"));
            const result = await AiService.validateInitiative({ name: "Bad Init" }, 1);
            expect(result.confidenceScore).toBe(0);
            expect(result.risks).toEqual([]);
        });

        it('extractInsights should parse JSON and save to KnowledgeService', async () => {
            const mockRawJSON = JSON.stringify({
                idea: { found: true, content: "Idea", reasoning: "Reason", topic: "Topic" },
                context: { found: true, key: "Key", value: "Value", confidence: 0.9 }
            });
            vi.spyOn(AiService, 'callLLM').mockResolvedValue(mockRawJSON);

            const mockKnowledge = {
                addCandidate: vi.fn().mockResolvedValue(true),
                setClientContext: vi.fn().mockResolvedValue(true)
            };
            AiService.setDependencies({ KnowledgeService: mockKnowledge });

            const result = await AiService.extractInsights("Text", "chat", 1, 10);
            expect(result.idea.found).toBe(true);
            expect(mockKnowledge.addCandidate).toHaveBeenCalled();
            expect(mockKnowledge.setClientContext).toHaveBeenCalled();
        });

        it('suggestTasks should parse JSON list tasks', async () => {
            const mockTasks = JSON.stringify([{ title: "Task1" }]);
            vi.spyOn(AiService, 'callLLM').mockResolvedValue(mockTasks);

            const result = await AiService.suggestTasks({ name: "I1", summary: "S", hypothesis: "H" }, 1);
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe("Task1");
        });
    });

    describe('streamLLM', () => {
        it('should yield chunks for Gemini fallback', async () => {
            // Setup DB to return nothing
            mockDb.get.mockImplementation((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                callback(null, null);
            });

            const stream = AiService.streamLLM("Prompt", "", [], null, 1);
            let chunks = "";
            for await (const chunk of stream) {
                chunks += chunk;
            }
            expect(chunks).toBe("Mock Chunk"); // We mocked the stream to yield this
        });
        it('should yield chunks for OpenAI stream', async () => {
            // Mock DB to return OpenAI
            mockDb.get.mockImplementation((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                callback(null, { id: 1, provider: 'openai', api_key: 'sk-test' });
            });

            // Mock Fetch Stream
            const stream = new ReadableStream({
                start(controller) {
                    const chunk1 = { choices: [{ delta: { content: "Chunk1" } }] };
                    const chunk2 = { choices: [{ delta: { content: "Chunk2" } }] };
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk1)}\n\n`));
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk2)}\n\n`));
                    controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                    controller.close();
                }
            });

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                body: stream
            });

            const generator = AiService.streamLLM("Prompt", "", [], null, 1);
            let parts = [];
            for await (const chunk of generator) {
                parts.push(chunk);
            }
            expect(parts).toEqual(["Chunk1", "Chunk2"]);
        });

        it.skip('should yield chunks for Gemini when configured via DB', async () => {
            mockDb.get.mockImplementation((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                callback(null, { id: 1, provider: 'gemini', api_key: 'gem-key', markup_multiplier: 1 });
            });

            mockGoogleGenerativeAI.mockImplementation(() => ({
                getGenerativeModel: () => ({
                    startChat: () => ({
                        sendMessageStream: vi.fn().mockResolvedValue({
                            stream: (async function* () { yield { text: () => "GeminiConfigChunk" }; })()
                        })
                    })
                })
            }));

            const generator = AiService.streamLLM("Prompt", "", [], null, 1);
            const parts = [];
            for await (const chunk of generator) {
                parts.push(chunk);
            }
            expect(parts).toEqual(["GeminiConfigChunk"]);
        });

        it('should handle stream errors gracefully', async () => {
            // Mock Gemini error (since default)
            mockGoogleGenerativeAI.mockImplementation(() => ({
                getGenerativeModel: () => ({
                    startChat: () => ({
                        sendMessageStream: vi.fn().mockRejectedValue(new Error("Stream Fail"))
                    })
                })
            }));

            const generator = AiService.streamLLM("Fail Prompt", "", [], null, 1);
            const parts = [];
            for await (const chunk of generator) {
                parts.push(chunk);
            }
            expect(parts[0]).toContain("[Error generating response]");
        });
    });

    describe('enhancePrompt', () => {
        it('should append strategies and context if available', async () => {
            // mock getSystemPrompt (uses db.get)
            mockDb.get.mockImplementation((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                callback(null, { content: "Base Prompt" });
            });

            // mock strategies (db.all)
            mockDb.all.mockImplementation((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                if (query.includes('global_strategies')) {
                    callback(null, [{ title: "Strat1", description: "Desc1" }]);
                } else if (query.includes('client_context')) {
                    callback(null, [{ key: "Key1", value: "Val1" }]);
                } else {
                    callback(null, []);
                }
            });

            const mockFeedback = {
                getLearningExamples: vi.fn().mockResolvedValue("Example1 is a very long string that should definitely exceed fifty characters now to pass the check.")
            };
            AiService.setDependencies({ FeedbackService: mockFeedback, RagService: mockRagService });


            const prompt = await AiService.enhancePrompt('CONSULTANT', 'context', 123);

            expect(prompt).toContain("Base Prompt");
            expect(prompt).toContain("Strat1");
            expect(prompt).toContain("Key1");
            expect(prompt).toContain("Example1");
        });
    });

    describe('Deep Reasoning Layers', () => {
        it('generateInitiatives should parse JSON response', async () => {
            const jsonResp = JSON.stringify([{ title: "Init 1" }]);

            // Mock Gemini response (since default fallback used)
            mockChatSession.sendMessage.mockResolvedValue({
                response: Promise.resolve({ text: () => jsonResp })
            });

            // Also need basic db mocks for enhancePrompt calls inside generateInitiatives
            mockDb.get.mockImplementation((q, p, cb) => {
                const callback = typeof p === 'function' ? p : cb;
                callback(null, { content: "System" });
            });
            mockDb.all.mockImplementation((q, p, cb) => {
                const callback = typeof p === 'function' ? p : cb;
                callback(null, []);
            });

            const res = await AiService.generateInitiatives({}, 1);
            expect(res).toHaveLength(1);
            expect(res[0].title).toBe("Init 1");
        });

        it('generateInitiatives should return empty list on error', async () => {
            vi.spyOn(AiService, 'callLLM').mockRejectedValue(new Error("Gen Fail"));
            const result = await AiService.generateInitiatives({}, 1);
            expect(result).toEqual([]);
        });

        it('suggestTasks should return empty list on error', async () => {
            vi.spyOn(AiService, 'callLLM').mockRejectedValue(new Error("Task Fail"));
            const result = await AiService.suggestTasks({}, 1);
            expect(result).toEqual([]);
        });

        it('buildRoadmap should return empty object on error', async () => {
            mockChatSession.sendMessage.mockRejectedValue(new Error("Fail"));
            // allow enhancePrompt to pass
            mockDb.get.mockImplementation((q, p, cb) => {
                const callback = typeof p === 'function' ? p : cb;
                callback(null, null);
            });
            mockDb.all.mockImplementation((q, p, cb) => {
                const callback = typeof p === 'function' ? p : cb;
                callback(null, []);
            });

            const res = await AiService.buildRoadmap([], 1);
            expect(res).toEqual({});
        });
    });

    describe('testProviderConnection', () => {
        it('should return success for OpenAI', async () => {
            const result = await AiService.testProviderConnection({
                provider: 'openai', api_key: 'sk-test', model_id: 'gpt-4'
            });
            expect(result.success).toBe(true);
            expect(result.response).toBe("OpenAI Test Response");
        });

        it('should return success for Google', async () => {
            // Should use injected GoogleGenerativeAI mock
            const result = await AiService.testProviderConnection({
                provider: 'google', api_key: 'test-key', model_id: 'gemini-pro'
            });
            expect(result.success).toBe(true);
            expect(result.response).toBe("Mock Content");
        });

        it('should return success for Generic Providers (DeepSeek)', async () => {
            const result = await AiService.testProviderConnection({
                provider: 'deepseek', api_key: 'sk-test', endpoint: 'https://api.deepseek.com'
            });
            expect(result.success).toBe(true);
            expect(result.response).toBe("OpenAI Test Response"); // Uses injected OpenAI mock
        });

        it('should return success for Ollama', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ message: { content: "Ollama Hello" } })
            });

            const result = await AiService.testProviderConnection({
                provider: 'ollama', endpoint: 'http://localhost:11434', model_id: 'llama3'
            });
            expect(result.success).toBe(true);
            expect(result.response).toBe("Ollama Hello");
        });

        it('should handle connection errors gracefully', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));
            const result = await AiService.testProviderConnection({
                provider: 'ollama', endpoint: 'http://fail'
            });
            expect(result.success).toBe(false);
            expect(result.message).toContain("Network Error");
        });

        it('should return error for unknown provider', async () => {
            const result = await AiService.testProviderConnection({
                provider: 'unknown-provider', api_key: 'sk-test'
            });
            expect(result.success).toBe(false);
            expect(result.message).toContain("not implemented yet");
        });

        it('should use default baseURL for generic providers if missing', async () => {
            const MockOpenAI = vi.fn();
            MockOpenAI.prototype.chat = {
                completions: {
                    create: vi.fn().mockResolvedValue({
                        choices: [{ message: { content: "DefaultBase" } }]
                    })
                }
            };
            // Inject MockOpenAI directly
            AiService.setDependencies({ OpenAI: MockOpenAI });

            const result = await AiService.testProviderConnection({
                provider: 'deepseek', api_key: 'sk-deep'
                // No endpoint provided (triggers default baseURL logic only if provider matching logic works)
            });

            expect(result.success).toBe(true);
            expect(MockOpenAI).toHaveBeenCalledWith(
                expect.objectContaining({ baseURL: "https://api.deepseek.com" })
            );
        });
    });

    describe('Chat & Streams', () => {
        it('chat should enhance prompt with context and history', async () => {
            mockRagService.getContext.mockResolvedValue("Retrieved Context");
            vi.spyOn(AiService, 'callLLM').mockResolvedValue("Chat Response");

            const res = await AiService.chat("Hello", [], 'CONSULTANT', 1, 10);
            expect(mockRagService.getContext).toHaveBeenCalledWith("Hello");
            expect(AiService.callLLM).toHaveBeenCalledWith(
                "Hello",
                expect.stringContaining("Retrieved Context"),
                [], null, 1, 'chat'
            );
            expect(res).toBe("Chat Response");
        });

        it('chatStream should delegate to streamLLM', async () => {
            mockRagService.getContext.mockResolvedValue("Stream Context");

            // Generator mock
            async function* mockGen() { yield "Chunk1"; yield "Chunk2"; }
            vi.spyOn(AiService, 'streamLLM').mockImplementation(mockGen);

            const stream = AiService.chatStream("Hello", [], 'CONSULTANT', 1);
            const chunks = [];
            for await (const c of stream) chunks.push(c);

            expect(chunks).toEqual(["Chunk1", "Chunk2"]);
            expect(AiService.streamLLM).toHaveBeenCalledWith(
                "Hello",
                expect.stringContaining("Stream Context"),
                expect.anything(), null, 1, 'chat'
            );
        });
    });
});
