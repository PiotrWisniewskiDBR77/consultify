import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// References to mocks - Defined at top level for shared access
let mockDb;
let mockAiQueue;
let mockModelRouter;
let mockCircuitBreakerService;
let mockTokenBillingService;
let mockAnalyticsService;
let mockFeedbackService;
let mockGenerativeModel;
let mockChatSession;
let mockGoogleGenerativeAI;
let mockFinancialService;
let mockAccessPolicyService; // The specific object we inject

// Service references
let AIService;

// ROOT BLOCK - Scoping ensures beforeAll runs for all tests
describe('AIService Test Suite', () => {

    beforeAll(async () => {
        vi.resetModules();

        // 1. Define Mocks
        mockDb = {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn(),
            serialize: vi.fn((cb) => cb()),
            initPromise: Promise.resolve()
        };

        mockAiQueue = { add: vi.fn().mockResolvedValue({ id: 'job-1' }), getJob: vi.fn() };
        mockModelRouter = { route: vi.fn() };

        mockCircuitBreakerService = {
            execute: vi.fn(async (n, op) => await op()),
            getBreaker: vi.fn(() => ({
                state: 'CLOSED',
                _isSystemFailure: vi.fn(() => true),
                onSuccess: vi.fn(),
                onFailure: vi.fn()
            })),
            isOpen: vi.fn(() => false),
            handleFailure: vi.fn()
        };

        // 2. Register doMocks for static dependencies
        vi.doMock('../../../server/queues/aiQueue', () => ({ default: { add: mockAiQueue.add, getJob: mockAiQueue.getJob } }));
        vi.doMock('../../../server/src/services/modelRouter.js', () => ({ default: mockModelRouter }));
        vi.doMock('../../../server/src/services/circuitBreakerService.js', () => ({ default: mockCircuitBreakerService }));

        mockAccessPolicyService = {
            checkAccess: vi.fn(async () => ({ allowed: true })),
            trackTokenUsage: vi.fn().mockResolvedValue(true), // Fixed: Returns Promise
            setDependencies: vi.fn()
        };
        vi.doMock('../../../server/src/services/accessPolicyService.js', () => ({
            default: mockAccessPolicyService
        }));

        // 3. Import Services (Dynamic)
        AIService = (await import('../../../server/src/services/aiService.js')).default;

        // 4. Initialize other mocks - ALL MUST RETURN PROMISES for void/async methods
        mockTokenBillingService = {
            hasSufficientBalance: vi.fn().mockResolvedValue(true),
            deductTokens: vi.fn().mockResolvedValue(true) // Fixed: Returns Promise
        };
        mockAnalyticsService = { logUsage: vi.fn().mockResolvedValue(true) }; // Fixed: Returns Promise
        mockFeedbackService = { getLearningExamples: vi.fn().mockResolvedValue('') };
        mockChatSession = { sendMessage: vi.fn(), sendMessageStream: vi.fn() };

        mockGenerativeModel = {
            generateContent: vi.fn(),
            startChat: vi.fn(() => mockChatSession),
            generateContentStream: vi.fn()
        };

        mockGoogleGenerativeAI = vi.fn(function () {
            return { getGenerativeModel: vi.fn(() => mockGenerativeModel) };
        });

        // FINANCIAL SERVICE MOCK - Must be configurable per test
        mockFinancialService = { simulatePortfolio: vi.fn() };

        // 5. Inject Mocks into AIService
        if (AIService.setDependencies) {
            AIService.setDependencies({
                db: mockDb,
                AccessPolicyService: mockAccessPolicyService,
                TokenBillingService: mockTokenBillingService,
                AnalyticsService: mockAnalyticsService,
                FeedbackService: mockFeedbackService,
                GoogleGenerativeAI: mockGoogleGenerativeAI,
                aiQueue: mockAiQueue,
                FinancialService: mockFinancialService,
                ModelRouter: mockModelRouter,
                CircuitBreakerService: mockCircuitBreakerService,
                AICostControlService: { checkBudget: vi.fn(async () => ({ allowed: true })) }
            });
        }
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', vi.fn());

        mockGenerativeModel.generateContent.mockResolvedValue({ response: { text: () => 'Mock Gemini' } });
        mockChatSession.sendMessage.mockResolvedValue({ response: Promise.resolve({ text: () => 'Mock Gemini' }) });
        mockAccessPolicyService.checkAccess.mockResolvedValue({ allowed: true });
        mockTokenBillingService.hasSufficientBalance.mockResolvedValue(true);
        mockTokenBillingService.deductTokens.mockResolvedValue(true);

        mockModelRouter.route.mockResolvedValue({ providerConfig: { provider: 'gemini', api_key: 'test', model_id: 'gemini-pro' }, orgId: 'org-1', sourceType: 'platform', model: 'gemini-pro' });

        const handleCallback = (args, result) => {
            const cb = args.length > 0 && typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
            if (cb) cb(null, result);
        };
        mockDb.get.mockImplementation((...args) => {
            const query = args[0];
            let result = null;
            if (query && query.includes('FROM llm_providers')) {
                result = { id: 'default', provider: 'gemini', api_key: 'test-key', is_active: 1 };
            }
            handleCallback(args, result);
        });
        mockDb.all.mockImplementation((...args) => handleCallback(args, []));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('Core Logic', () => {
        it('should use Google Gemini by default if checks pass', async () => {
            const result = await AIService.callLLM('Prompter', '', [], null, 'user-1');
            expect(result).toBe('Mock Gemini');
        });
        it('should block if balance is insufficient', async () => {
            mockAccessPolicyService.checkAccess.mockResolvedValueOnce({ allowed: false, reason: 'Insufficient' });
            await expect(AIService.callLLM('Test', '', [], null, 'user-1')).rejects.toThrow('Insufficient');
        });
        it('should call OpenAI via fetch when provider is openai', async () => {
            mockDb.get.mockImplementation((...args) => args[args.length - 1](null, { provider: 'openai', api_key: 'sk-1', endpoint: 'https://api.openai.com/v1' }));
            fetch.mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'OpenAI' } }] }) });
            const res = await AIService.callLLM('Hi', '', [], 'prov-openai', 'user-1');
            expect(res).toBe('OpenAI');
        });
        it('should call Anthropic via fetch when provider is anthropic', async () => {
            mockDb.get.mockImplementation((...args) => args[args.length - 1](null, { provider: 'anthropic', api_key: 'sk-2', endpoint: 'https://api.anthropic.com/v1' }));
            fetch.mockResolvedValue({ ok: true, json: async () => ({ content: [{ text: 'Claude' }] }) });
            const res = await AIService.callLLM('Hi', '', [], 'prov-anth', 'user-1');
            expect(res).toBe('Claude');
        });
    });

    describe('generateInitiatives', () => {
        it('should parse JSON response correctly', async () => {
            const mockJson = JSON.stringify([{ title: 'Initiative 1' }]);
            mockChatSession.sendMessage.mockResolvedValueOnce({ response: Promise.resolve({ text: () => '```json\n' + mockJson + '\n```' }) });
            mockDb.all.mockImplementation((...args) => args[args.length - 1](null, [{ content: 'Sys' }]));
            const inits = await AIService.generateInitiatives({ gap: 5 }, 'user-1');
            expect(inits).toHaveLength(1);
            expect(inits[0].title).toBe('Initiative 1');
        });
        it('should return empty array on JSON parse error', async () => {
            mockChatSession.sendMessage.mockResolvedValueOnce({ response: Promise.resolve({ text: () => 'Bad JSON' }) });
            const inits = await AIService.generateInitiatives({}, 'user-1');
            expect(inits).toEqual([]);
        });
    });

    describe('streamLLM', () => {
        it('should yield chunks from Gemini stream', async () => {
            mockChatSession.sendMessageStream.mockResolvedValueOnce({
                stream: { [Symbol.asyncIterator]: async function* () { yield { text: () => 'Chunk 1' }; yield { text: () => 'Chunk 2' }; } }
            });
            const stream = AIService.streamLLM('Test', '', [], null, 'user-1');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            expect(chunks).toEqual(['Chunk 1', 'Chunk 2']);
        });
        it('should handle errors in stream', async () => {
            mockChatSession.sendMessageStream.mockRejectedValueOnce(new Error('Stream Fail'));
            const stream = AIService.streamLLM('Test', '', [], null, 'user-1');
            const chunks = [];
            await expect(async () => {
                for await (const chunk of stream) chunks.push(chunk);
            }).rejects.toThrow('Stream Fail');
        });
    });

    describe('Vision Capabilities', () => {
        it('should format payload correctly for OpenAI Vision', async () => {
            mockDb.get.mockImplementation((...args) => args[args.length - 1](null, { provider: 'openai', api_key: 'k', model_id: 'v' }));
            const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'Vision' } }] }) });
            vi.stubGlobal('fetch', spy);
            await AIService.callLLM('Vis', '', [], 'prov-1', 'user-1', 'chat', ['img']);
            const body = JSON.parse(spy.mock.calls[0][1].body);
            expect(body.messages[0].content[1].type).toBe('image_url');
        });
        it('should use Gemini 1.5 Flash for vision fallback', async () => {
            mockDb.get.mockImplementation((...args) => args[args.length - 1](null, null));
            process.env.GEMINI_API_KEY = 'key';
            mockGenerativeModel.generateContent.mockResolvedValue({ response: { text: () => 'Flash' } });
            await AIService.callLLM('Vis', '', [], null, 'user-1', 'chat', ['img']);
            expect(mockGenerativeModel.generateContent).toHaveBeenCalled();
        });
    });

    describe('Advanced Streaming', () => {
        it('should parse OpenAI SSE stream correctly', async () => {
            mockDb.get.mockImplementation((...args) => args[args.length - 1](null, { provider: 'openai', api_key: 'sk', model_id: 'gpt' }));
            const chunks = ['data: {"choices":[{"delta":{"content":"A"}}]}\n\n', 'data: [DONE]\n\n'];
            const reader = {
                read: vi.fn()
                    .mockResolvedValueOnce({ value: new TextEncoder().encode(chunks[0]), done: false })
                    .mockResolvedValueOnce({ value: undefined, done: true })
            };
            fetch.mockResolvedValue({ ok: true, body: { getReader: () => reader } });
            const iterator = AIService.streamLLM('Hi', '', [], 'prov-1', 'user-1');
            const res = [];
            for await (const c of iterator) res.push(c);
            expect(res.join('')).toBe('A');
        });
        it('should handle OpenAI stream error', async () => {
            mockDb.get.mockImplementation((...args) => args[args.length - 1](null, { provider: 'openai' }));
            fetch.mockResolvedValue({ ok: false, statusText: 'Error' });
            const iterator = AIService.streamLLM('Hi', '', [], 'prov-1', 'user-1');
            const res = [];
            await expect(async () => {
                for await (const c of iterator) res.push(c);
            }).rejects.toThrow('Provider openai Stream error: Error');
        });
    });

    describe('Provider Integrations', () => {
        it('should generate JWT for Zhipu AI provider', async () => {
            mockDb.get.mockImplementation((...args) => {
                args[args.length - 1](null, { provider: 'z_ai', api_key: 'id.secret', model_id: 'glm-4' });
            });
            const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'Zhipu' } }] }) });
            vi.stubGlobal('fetch', fetchSpy);
            await AIService.callLLM('Test', '', [], 'zhipu-1', 'user-1');
            const callArgs = fetchSpy.mock.calls[0];
            const headers = callArgs[1].headers;
            expect(headers['Authorization']).toMatch(/^Bearer ey/);
        });
    });

    describe('Extended AI Capabilities', () => {
        let callLLMSpy;
        beforeEach(() => {
            callLLMSpy = vi.spyOn(AIService, 'callLLM').mockResolvedValue('{}');
        });
        afterEach(() => { callLLMSpy.mockRestore(); });

        it('should return parsed insights when LLM returns valid JSON', async () => {
            callLLMSpy.mockResolvedValue('```json\n{"summary": "Test"}\n```');
            const res = await AIService.generateTaskInsight({ title: "T" }, {}, "u-1");
            expect(res.summary).toBe("Test");
        });
        it('should return fallback object on LLM failure', async () => {
            callLLMSpy.mockRejectedValue(new Error("Fail"));
            const res = await AIService.generateTaskInsight({ title: "T" }, {}, "u-1");
            expect(res.summary).toContain("AI Analysis failed");
        });

        it('should combine financial simulation with AI commentary', async () => {
            // CRITICAL FIX: mockReturnValue for SYNC call
            mockFinancialService.simulatePortfolio.mockReturnValue({ roi: 200, totalCapex: 100 });
            const res = await AIService.simulateEconomics([], 1000, "u-1");
            console.log('DEBUG RES:', JSON.stringify(res, null, 2));
            expect(mockFinancialService.simulatePortfolio).toHaveBeenCalled();
            // CRITICAL FIX: Expect TOP LEVEL property because of spread
            expect(res.roi).toBe(200);
        });
        it('should return just simulation if AI fails', async () => {
            // CRITICAL FIX: mockReturnValue for SYNC call
            mockFinancialService.simulatePortfolio.mockReturnValue({ roi: 100 });
            callLLMSpy.mockRejectedValue(new Error("AI Fail"));
            const res = await AIService.simulateEconomics([], 1000, "u-1");
            expect(res.roi).toBe(100);
        });
    });

});
