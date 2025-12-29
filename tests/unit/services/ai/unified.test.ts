/**
 * Unified AI Service Tests
 * 
 * Tests for UnifiedAI service - provider abstraction for AI services (system, gemini, openai, ollama).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnifiedAI } from '../../../../services/ai/unified';
import { Api } from '../../../../services/api';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock Api
vi.mock('../../../../services/api', () => ({
    Api: {
        chatWithAI: vi.fn(),
        chatWithAIStream: vi.fn()
    }
}));

// Mock GoogleGenerativeAI
let mockModelInstance: any;

const createMockModel = () => ({
    startChat: vi.fn().mockReturnValue({
        sendMessage: vi.fn().mockResolvedValue({
            response: {
                text: vi.fn().mockResolvedValue('Gemini Response')
            }
        }),
        sendMessageStream: vi.fn().mockResolvedValue({
            stream: (async function* () {
                yield { text: () => 'Chunk1' };
                yield { text: () => 'Chunk2' };
            })()
        })
    })
});

mockModelInstance = createMockModel();

const mockGoogleGenerativeAI = vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue(mockModelInstance)
}));

vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: mockGoogleGenerativeAI
}));

// Mock fetch for OpenAI and Ollama
global.fetch = vi.fn();

describe('UnifiedAI Service', () => {
    const mockHistory = [
        { role: 'user' as const, parts: [{ text: 'Hello' }] },
        { role: 'model' as const, parts: [{ text: 'Hi there' }] }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('sendMessage - system provider', () => {
        it('should use Api.chatWithAI for system provider', async () => {
            const config = { provider: 'system' as const };
            const mockResponse = 'System AI Response';

            vi.mocked(Api.chatWithAI).mockResolvedValue(mockResponse);

            const result = await UnifiedAI.sendMessage(config, mockHistory, 'Test message', 'System', 'Role');

            expect(Api.chatWithAI).toHaveBeenCalledWith('Test message', mockHistory, 'System', 'Role');
            expect(result).toBe(mockResponse);
        });

        it('should use default system provider when config is undefined', async () => {
            vi.mocked(Api.chatWithAI).mockResolvedValue('Response');

            await UnifiedAI.sendMessage(undefined, mockHistory, 'Test');

            expect(Api.chatWithAI).toHaveBeenCalled();
        });
    });

    describe('sendMessage - gemini provider', () => {
        it('should use GoogleGenerativeAI for gemini provider', async () => {
            const config = {
                provider: 'gemini' as const,
                apiKey: 'test-key',
                modelId: 'gemini-1.5-flash'
            };

            const result = await UnifiedAI.sendMessage(config, mockHistory, 'Test message', 'System');

            expect(mockGoogleGenerativeAI).toHaveBeenCalledWith('test-key');
            expect(mockModel.startChat).toHaveBeenCalled();
            expect(result).toBe('Gemini Response');
        });

        it('should throw error when API key is missing', async () => {
            const config = { provider: 'gemini' as const };

            await expect(
                UnifiedAI.sendMessage(config, mockHistory, 'Test')
            ).rejects.toThrow('Missing API Key');
        });

        it('should use default model when modelId not provided', async () => {
            const config = {
                provider: 'gemini' as const,
                apiKey: 'test-key'
            };

            mockGoogleGenerativeAI.mockClear();
            mockModelInstance = createMockModel();

            await UnifiedAI.sendMessage(config, mockHistory, 'Test');

            expect(mockModelInstance.startChat).toHaveBeenCalledWith(
                expect.objectContaining({
                    history: mockHistory
                })
            );
        });
    });

    describe('sendMessage - openai provider', () => {
        it('should use OpenAI API for openai provider', async () => {
            const config = {
                provider: 'openai' as const,
                apiKey: 'test-key',
                modelId: 'gpt-4-turbo'
            };

            vi.mocked(global.fetch).mockResolvedValue({
                json: vi.fn().mockResolvedValue({
                    choices: [{ message: { content: 'OpenAI Response' } }]
                })
            } as any);

            const result = await UnifiedAI.sendMessage(config, mockHistory, 'Test message', 'System');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.openai.com/v1/chat/completions',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-key'
                    })
                })
            );
            expect(result).toBe('OpenAI Response');
        });

        it('should throw error when API key is missing', async () => {
            const config = { provider: 'openai' as const };

            await expect(
                UnifiedAI.sendMessage(config, mockHistory, 'Test')
            ).rejects.toThrow('Missing API Key');
        });

        it('should handle OpenAI errors', async () => {
            const config = {
                provider: 'openai' as const,
                apiKey: 'test-key'
            };

            vi.mocked(global.fetch).mockResolvedValue({
                json: vi.fn().mockResolvedValue({
                    error: { message: 'API Error' }
                })
            } as any);

            const result = await UnifiedAI.sendMessage(config, mockHistory, 'Test');

            expect(result).toContain('OpenAI Error');
        });

        it('should use default model when modelId not provided', async () => {
            const config = {
                provider: 'openai' as const,
                apiKey: 'test-key'
            };

            vi.mocked(global.fetch).mockResolvedValue({
                json: vi.fn().mockResolvedValue({
                    choices: [{ message: { content: 'Response' } }]
                })
            } as any);

            await UnifiedAI.sendMessage(config, mockHistory, 'Test');

            const callArgs = (global.fetch as any).mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.model).toBe('gpt-4-turbo');
        });
    });

    describe('sendMessage - ollama provider', () => {
        it('should use Ollama API for ollama provider', async () => {
            const config = {
                provider: 'ollama' as const,
                endpoint: 'http://localhost:11434',
                modelId: 'llama3'
            };

            vi.mocked(global.fetch).mockResolvedValue({
                json: vi.fn().mockResolvedValue({
                    message: { content: 'Ollama Response' }
                })
            } as any);

            const result = await UnifiedAI.sendMessage(config, mockHistory, 'Test message', 'System');

            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:11434/api/chat',
                expect.objectContaining({
                    method: 'POST'
                })
            );
            expect(result).toBe('Ollama Response');
        });

        it('should use default endpoint and model when not provided', async () => {
            const config = { provider: 'ollama' as const };

            vi.mocked(global.fetch).mockResolvedValue({
                json: vi.fn().mockResolvedValue({
                    message: { content: 'Response' }
                })
            } as any);

            await UnifiedAI.sendMessage(config, mockHistory, 'Test');

            const callArgs = (global.fetch as any).mock.calls[0];
            expect(callArgs[0]).toBe('http://localhost:11434/api/chat');
            const body = JSON.parse(callArgs[1].body);
            expect(body.model).toBe('llama3');
        });

        it('should handle Ollama errors', async () => {
            const config = {
                provider: 'ollama' as const,
                endpoint: 'http://localhost:11434'
            };

            vi.mocked(global.fetch).mockRejectedValue(new Error('Connection failed'));

            const result = await UnifiedAI.sendMessage(config, mockHistory, 'Test');

            expect(result).toContain('Ollama Error');
        });
    });

    describe('sendMessage - unknown provider', () => {
        it('should return "Unknown Provider" for unknown provider', async () => {
            const config = { provider: 'unknown' as any };

            const result = await UnifiedAI.sendMessage(config, mockHistory, 'Test');

            expect(result).toBe('Unknown Provider');
        });
    });

    describe('sendMessageStream - system provider', () => {
        it('should use Api.chatWithAIStream for system provider', async () => {
            const config = { provider: 'system' as const };
            const onChunk = vi.fn();
            const onDone = vi.fn();

            vi.mocked(Api.chatWithAIStream).mockResolvedValue(undefined);

            await UnifiedAI.sendMessageStream(config, mockHistory, 'Test', onChunk, onDone, 'System', 'Role');

            expect(Api.chatWithAIStream).toHaveBeenCalledWith(
                'Test',
                mockHistory,
                onChunk,
                onDone,
                'System',
                undefined,
                'Role'
            );
        });
    });

    describe('sendMessageStream - gemini provider', () => {
        it('should stream from Gemini', async () => {
            const config = {
                provider: 'gemini' as const,
                apiKey: 'test-key',
                modelId: 'gemini-1.5-flash'
            };

            mockModelInstance = createMockModel();

            const onChunk = vi.fn();
            const onDone = vi.fn();

            await UnifiedAI.sendMessageStream(config, mockHistory, 'Test', onChunk, onDone);

            // Wait for stream to complete
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(onChunk).toHaveBeenCalled();
            expect(onDone).toHaveBeenCalled();
        });

        it('should handle Gemini stream errors', async () => {
            const config = {
                provider: 'gemini' as const,
                apiKey: 'test-key'
            };

            mockModelInstance = {
                startChat: vi.fn().mockReturnValue({
                    sendMessageStream: vi.fn().mockRejectedValue(new Error('Stream Error'))
                })
            };

            const onChunk = vi.fn();
            const onDone = vi.fn();

            await UnifiedAI.sendMessageStream(config, mockHistory, 'Test', onChunk, onDone);

            expect(onDone).toHaveBeenCalled();
        });
    });

    describe('sendMessageStream - fallback for other providers', () => {
        it('should fallback to non-streaming for openai', async () => {
            const config = {
                provider: 'openai' as const,
                apiKey: 'test-key'
            };

            vi.mocked(global.fetch).mockResolvedValue({
                json: vi.fn().mockResolvedValue({
                    choices: [{ message: { content: 'Full Response' } }]
                })
            } as any);

            const onChunk = vi.fn();
            const onDone = vi.fn();

            await UnifiedAI.sendMessageStream(config, mockHistory, 'Test', onChunk, onDone);

            expect(onChunk).toHaveBeenCalledWith('Full Response');
            expect(onDone).toHaveBeenCalled();
        });
    });
});

