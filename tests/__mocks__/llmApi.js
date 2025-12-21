/**
 * LLM API Mock
 * 
 * Mocks the /api/ai/chat endpoint used by the application.
 * This mocks the user's API endpoint, not direct provider SDKs.
 */

import { vi } from 'vitest';

/**
 * Mock LLM API responses
 */
export const mockLLMApi = {
    /**
     * Mock chat endpoint response
     */
    chat: vi.fn().mockResolvedValue({
        text: 'Mock AI Response',
        tokens: { input: 100, output: 50 },
        model: 'mock-model',
        cost: 0.001,
        usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150
        }
    }),
    
    /**
     * Mock streaming endpoint response
     * Returns an async generator that yields chunks
     */
    stream: vi.fn().mockImplementation(async function* () {
        const chunks = ['Mock', ' AI', ' Response'];
        for (const chunk of chunks) {
            yield chunk;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }),
    
    /**
     * Mock chat with custom response
     * @param {string} text - Response text
     * @param {Object} options - Additional options
     */
    mockChatResponse: (text, options = {}) => {
        mockLLMApi.chat.mockResolvedValueOnce({
            text,
            tokens: options.tokens || { input: 100, output: 50 },
            model: options.model || 'mock-model',
            cost: options.cost || 0.001,
            usage: options.usage || {
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150
            }
        });
    },
    
    /**
     * Mock streaming with custom chunks
     * @param {string[]} chunks - Array of text chunks
     */
    mockStreamResponse: (chunks) => {
        mockLLMApi.stream.mockImplementationOnce(async function* () {
            for (const chunk of chunks) {
                yield chunk;
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        });
    },
    
    /**
     * Mock error response
     * @param {Error|string} error - Error to throw
     */
    mockError: (error) => {
        const err = typeof error === 'string' ? new Error(error) : error;
        mockLLMApi.chat.mockRejectedValueOnce(err);
    },
    
    /**
     * Reset all mocks
     */
    reset: () => {
        mockLLMApi.chat.mockClear();
        mockLLMApi.stream.mockClear();
        // Reset to default response
        mockLLMApi.chat.mockResolvedValue({
            text: 'Mock AI Response',
            tokens: { input: 100, output: 50 },
            model: 'mock-model',
            cost: 0.001,
            usage: {
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150
            }
        });
    }
};

/**
 * Mock fetch for LLM API calls
 * Intercepts fetch calls to /api/ai/chat endpoints
 */
export const mockLLMFetch = () => {
    const originalFetch = global.fetch;
    
    global.fetch = vi.fn().mockImplementation((url, options) => {
        // Check if this is an LLM API call
        if (typeof url === 'string' && url.includes('/api/ai/chat')) {
            const isStream = url.includes('/stream') || options?.stream;
            
            if (isStream) {
                // Return a mock ReadableStream for streaming
                const stream = new ReadableStream({
                    async start(controller) {
                        const chunks = await mockLLMApi.stream();
                        for await (const chunk of chunks) {
                            const data = `data: ${JSON.stringify({ text: chunk })}\n\n`;
                            controller.enqueue(new TextEncoder().encode(data));
                        }
                        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                        controller.close();
                    }
                });
                
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    headers: new Headers({
                        'Content-Type': 'text/event-stream'
                    }),
                    body: stream,
                    json: async () => ({ success: true })
                });
            } else {
                // Return a mock JSON response for non-streaming
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    headers: new Headers({
                        'Content-Type': 'application/json'
                    }),
                    json: async () => await mockLLMApi.chat()
                });
            }
        }
        
        // For non-LLM calls, use original fetch (or another mock)
        if (originalFetch) {
            return originalFetch(url, options);
        }
        
        return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({})
        });
    });
    
    return () => {
        global.fetch = originalFetch;
    };
};

export default mockLLMApi;

