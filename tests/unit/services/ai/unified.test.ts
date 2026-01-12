/**
 * Unified AI Service Tests
 * 
 * Verifies that UnifiedAI routes all requests through the backend API ('system' mode).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnifiedAI } from '../../../../services/ai/unified';
import { Api } from '../../../../services/api';

// Mock Api
vi.mock('../../../../services/api', () => ({
    Api: {
        chatWithAI: vi.fn(),
        chatWithAIStream: vi.fn()
    }
}));

describe('UnifiedAI Service', () => {
    const mockHistory = [
        { role: 'user' as const, parts: [{ text: 'Hello' }] },
        { role: 'model' as const, parts: [{ text: 'Hi there' }] }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('sendMessage', () => {
        it('should route everything through Api.chatWithAI regardless of provider', async () => {
            const config = {
                provider: 'openai' as any,
                apiKey: 'hidden',
                modelId: 'gpt-4'
            };
            const mockResponse = 'Backend AI Response';

            vi.mocked(Api.chatWithAI).mockResolvedValue(mockResponse);

            const result = await UnifiedAI.sendMessage(config, mockHistory, 'Test message', 'System Inst', 'Agent');

            expect(Api.chatWithAI).toHaveBeenCalledWith(
                'Test message',
                mockHistory,
                'System Inst',
                'Agent',
                expect.objectContaining({
                    model: 'gpt-4',
                    temperature: 0.7
                })
            );
            expect(result).toBe(mockResponse);
        });

        it('should handle undefined config by passing undefined model', async () => {
            vi.mocked(Api.chatWithAI).mockResolvedValue('Response');

            await UnifiedAI.sendMessage(undefined, mockHistory, 'Test');

            expect(Api.chatWithAI).toHaveBeenCalledWith(
                'Test',
                mockHistory,
                undefined,
                undefined,
                expect.objectContaining({
                    model: undefined
                })
            );
        });
    });

    describe('sendMessageStream', () => {
        it('should route everything through Api.chatWithAIStream', async () => {
            const config = {
                provider: 'gemini' as any,
                modelId: 'gemini-1.5-flash'
            };
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
                undefined, // context
                'Role',
                undefined, // language
                undefined, // onThinking
                expect.objectContaining({
                    model: 'gemini-1.5-flash',
                    temperature: 0.7
                })
            );
        });
    });
});
