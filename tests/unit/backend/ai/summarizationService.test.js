// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Logger
vi.mock('../../../../server/services/ai/logger.js', () => ({
    aiLogger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

describe('SummarizationService', () => {
    let summarizationService;
    let SummarizationService;
    let mockLlmService;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Mock LLM Service Object
        mockLlmService = {
            call: vi.fn()
        };

        const mod = await import('../../../../server/services/ai/summarizationService.js');
        SummarizationService = mod.SummarizationService;

        // INJECT MOCK LLM
        summarizationService = new SummarizationService(mockLlmService);
    });

    describe('summarizeConversation()', () => {
        it('should call LLM with conversation text', async () => {
            mockLlmService.call.mockResolvedValue({ content: 'Summary of chat' });

            const messages = [
                { role: 'user', content: 'Hi' },
                { role: 'assistant', content: 'Hello' }
            ];

            const result = await summarizationService.summarizeConversation(messages);

            expect(mockLlmService.call).toHaveBeenCalled();
            expect(result).toBe('Summary of chat');
        });

        it('should handle LLM errors gracefully', async () => {
            mockLlmService.call.mockRejectedValue(new Error('API Error'));

            const messages = [{ role: 'user', content: 'Test' }];
            const result = await summarizationService.summarizeConversation(messages);

            expect(result).toContain('Summary unavailable');
        });
    });

    describe('summarizeText()', () => {
        it('should summarize text', async () => {
            mockLlmService.call.mockResolvedValue({ content: 'Short summary' });
            const result = await summarizationService.summarizeText('Text', 10);
            expect(result).toBe('Short summary');
        });
    });
});
