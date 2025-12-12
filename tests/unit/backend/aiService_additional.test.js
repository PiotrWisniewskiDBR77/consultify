// tests/unit/backend/aiService_additional.test.js
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const AIService = require('../../../server/services/aiService.js');

// Mock dependencies
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn(cb => cb()),
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

// Helper to handle db callbacks
const handleCallback = (args, result) => {
    const cb = args.length > 0 && typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
    if (cb) cb(null, result);
};

beforeAll(() => {
    // Mock GoogleGenerativeAI chain using function syntax (required by vitest for constructors)
    mockGoogleGenerativeAI.mockImplementation(function () {
        return {
            getGenerativeModel: () => mockGenerativeModel
        };
    });
    mockGenerativeModel.startChat.mockReturnValue(mockChatSession);
    mockChatSession.sendMessage.mockResolvedValue({ response: { text: () => 'Mock Gemini Response' } });
    mockChatSession.sendMessageStream.mockResolvedValue({
        stream: {
            [Symbol.asyncIterator]: async function* () {
                yield { text: () => 'Chunk A' };
                yield { text: () => 'Chunk B' };
            }
        }
    });

    // Inject mocks into AIService
    AIService.setDependencies({
        db: mockDb,
        TokenBillingService: mockTokenBillingService,
        AnalyticsService: mockAnalyticsService,
        FeedbackService: mockFeedbackService,
        GoogleGenerativeAI: mockGoogleGenerativeAI
    });

    // Default db mocks
    mockDb.get.mockImplementation((...args) => {
        const query = args[0];
        if (typeof query === 'string' && query.includes('FROM llm_providers')) {
            // Return a generic provider config for openai by default
            handleCallback(args, { provider: 'openai', api_key: 'sk-test', endpoint: 'https://api.openai.com/v1', model_id: 'gpt-3.5-turbo' });
        } else if (typeof query === 'string' && query.includes('FROM system_prompts')) {
            handleCallback(args, { content: 'System Prompt' });
        } else {
            handleCallback(args, null);
        }
    });

    mockDb.all.mockImplementation((...args) => {
        handleCallback(args, []);
    });
});

beforeEach(() => {
    vi.clearAllMocks();
    mockTokenBillingService.hasSufficientBalance.mockResolvedValue(true);
    mockTokenBillingService.deductTokens.mockResolvedValue(true);
    global.fetch = vi.fn();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('AIService.testProviderConnection', () => {
    it.skip('tests OpenAI connection via fetch', async () => {
        // Override DB to return OpenAI config
        mockDb.get.mockImplementationOnce((...args) => {
            handleCallback(args, { provider: 'openai', api_key: 'sk-open', endpoint: 'https://api.openai.com/v1', model_id: 'gpt-4' });
        });
        const mockResponse = {
            ok: true,
            json: async () => ({ choices: [{ message: { content: 'OK' } }] })
        };
        global.fetch.mockResolvedValue(mockResponse);

        const result = await AIService.testProviderConnection({ provider: 'openai', api_key: 'sk-open', model_id: 'gpt-4' });
        expect(result.success).toBe(true);
        expect(result.response).toBe('OK');
        expect(global.fetch).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.objectContaining({ method: 'POST' }));
    });

    it('tests Anthropic connection via fetch', async () => {
        mockDb.get.mockImplementationOnce((...args) => {
            handleCallback(args, { provider: 'anthropic', api_key: 'sk-anth', endpoint: 'https://api.anthropic.com/v1', model_id: 'claude-3' });
        });
        const mockResponse = { ok: true, json: async () => ({ content: [{ text: 'OK' }] }) };
        global.fetch.mockResolvedValue(mockResponse);

        const result = await AIService.testProviderConnection({ provider: 'anthropic', api_key: 'sk-anth', model_id: 'claude-3' });
        expect(result.success).toBe(true);
        expect(result.response).toBe('OK');
    });

    it.skip('tests Gemini connection via GoogleGenerativeAI', async () => {
        mockDb.get.mockImplementationOnce((...args) => {
            handleCallback(args, { provider: 'gemini', api_key: 'gem-key', model_id: 'gemini-pro' });
        });
        const result = await AIService.testProviderConnection({ provider: 'gemini', api_key: 'gem-key', model_id: 'gemini-pro' });
        expect(result.success).toBe(true);
        expect(result.response).toBe('Mock Gemini Response');
    });
});

describe.skip('AIService.callLLM fallback to Gemini', () => {
    it('uses Gemini when no provider config', async () => {
        mockDb.get.mockImplementationOnce((...args) => {
            handleCallback(args, null);
        });
        process.env.GEMINI_API_KEY = 'env-gem-key';
        const result = await AIService.callLLM('Fallback prompt');
        expect(result).toBe('Mock Gemini Response');
        delete process.env.GEMINI_API_KEY;
    });
});

describe.skip('AIService.streamLLM Gemini streaming', () => {
    it('yields chunks from Gemini stream', async () => {
        mockDb.get.mockImplementationOnce((...args) => {
            handleCallback(args, null);
        });
        process.env.GEMINI_API_KEY = 'env-gem-key';
        const stream = AIService.streamLLM('Stream test');
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        expect(chunks).toEqual(['Chunk A', 'Chunk B']);
        delete process.env.GEMINI_API_KEY;
    });
});

describe('AIService.generateObservations', () => {
    it('processes feedback and returns observations', async () => {
        const mockRows = [{ context: 'ctx1', rating: 5, prompt: 'p1', comment: 'c1' }];
        mockDb.all.mockImplementationOnce((...args) => {
            handleCallback(args, mockRows);
        });
        const mockObs = { app_improvements: [{ description: 'Fix UI', severity: 'high', action_item: 'Update UI' }], content_gaps: [] };
        const callLLMSpy = vi.spyOn(AIService, 'callLLM').mockResolvedValue(JSON.stringify(mockObs));
        const result = await AIService.generateObservations('user-1');
        expect(result.app_improvements).toHaveLength(1);
        expect(result.app_improvements[0].description).toBe('Fix UI');
        expect(callLLMSpy).toHaveBeenCalled();
    });
});
