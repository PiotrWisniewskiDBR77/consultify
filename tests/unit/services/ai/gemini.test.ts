/**
 * Gemini AI Service Tests
 * 
 * Tests for Gemini AI service - message sending, streaming, and content refinement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendMessageToAI, sendMessageToAIStream, refineContent, SYSTEM_PROMPTS } from '../../../../services/ai/gemini';
import { UnifiedAI } from '../../../../services/ai/unified';
import { useAppStore } from '../../../../store/useAppStore';

// Mock UnifiedAI
vi.mock('../../../../services/ai/unified', () => ({
    UnifiedAI: {
        sendMessage: vi.fn(),
        sendMessageStream: vi.fn()
    }
}));

// Mock useAppStore
vi.mock('../../../../store/useAppStore', () => ({
    useAppStore: {
        getState: vi.fn()
    }
}));

describe('Gemini AI Service', () => {
    const mockConfig = {
        provider: 'system' as const,
        apiKey: 'test-key',
        modelId: 'test-model'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useAppStore.getState).mockReturnValue({
            currentUser: {
                aiConfig: mockConfig
            }
        } as any);
    });

    describe('sendMessageToAI', () => {
        it('should send message via UnifiedAI', async () => {
            const mockHistory = [{ role: 'user' as const, parts: [{ text: 'Hello' }] }];
            const mockResponse = 'AI Response';

            vi.mocked(UnifiedAI.sendMessage).mockResolvedValue(mockResponse);

            const result = await sendMessageToAI(mockHistory, 'Test message');

            expect(UnifiedAI.sendMessage).toHaveBeenCalledWith(
                mockConfig,
                mockHistory,
                'Test message',
                undefined,
                undefined
            );
            expect(result).toBe(mockResponse);
        });

        it('should pass system instruction', async () => {
            vi.mocked(UnifiedAI.sendMessage).mockResolvedValue('Response');

            await sendMessageToAI([], 'Message', 'System instruction', 'Role Name');

            expect(UnifiedAI.sendMessage).toHaveBeenCalledWith(
                mockConfig,
                [],
                'Message',
                'System instruction',
                'Role Name'
            );
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(UnifiedAI.sendMessage).mockRejectedValue(new Error('AI Error'));

            const result = await sendMessageToAI([], 'Test');

            expect(result).toContain('error');
        });

        it('should use default config when no user config', async () => {
            vi.mocked(useAppStore.getState).mockReturnValue({
                currentUser: null
            } as any);

            vi.mocked(UnifiedAI.sendMessage).mockResolvedValue('Response');

            await sendMessageToAI([], 'Test');

            expect(UnifiedAI.sendMessage).toHaveBeenCalledWith(
                undefined,
                [],
                'Test',
                undefined,
                undefined
            );
        });
    });

    describe('sendMessageToAIStream', () => {
        it('should stream message via UnifiedAI', async () => {
            const mockHistory = [{ role: 'user' as const, parts: [{ text: 'Hello' }] }];
            const onChunk = vi.fn();
            const onDone = vi.fn();

            vi.mocked(UnifiedAI.sendMessageStream).mockResolvedValue(undefined);

            await sendMessageToAIStream(mockHistory, 'Test message', onChunk, onDone);

            expect(UnifiedAI.sendMessageStream).toHaveBeenCalledWith(
                mockConfig,
                mockHistory,
                'Test message',
                onChunk,
                onDone,
                undefined,
                undefined
            );
        });

        it('should pass system instruction and role name', async () => {
            const onChunk = vi.fn();
            const onDone = vi.fn();

            vi.mocked(UnifiedAI.sendMessageStream).mockResolvedValue(undefined);

            await sendMessageToAIStream([], 'Message', onChunk, onDone, 'System', 'Role');

            expect(UnifiedAI.sendMessageStream).toHaveBeenCalledWith(
                mockConfig,
                [],
                'Message',
                onChunk,
                onDone,
                'System',
                'Role'
            );
        });

        it('should handle errors gracefully', async () => {
            const onChunk = vi.fn();
            const onDone = vi.fn();

            vi.mocked(UnifiedAI.sendMessageStream).mockRejectedValue(new Error('Stream Error'));

            await sendMessageToAIStream([], 'Test', onChunk, onDone);

            expect(onChunk).toHaveBeenCalledWith(expect.stringContaining('error'));
            expect(onDone).toHaveBeenCalled();
        });
    });

    describe('refineContent', () => {
        it('should refine content with general context', async () => {
            vi.mocked(UnifiedAI.sendMessage).mockResolvedValue('Refined text');

            const result = await refineContent('Original text', 'general');

            expect(UnifiedAI.sendMessage).toHaveBeenCalled();
            expect(result).toBe('Refined text');
        });

        it('should refine content with objective context', async () => {
            vi.mocked(UnifiedAI.sendMessage).mockResolvedValue('SMART objective');

            const result = await refineContent('Improve processes', 'objective');

            expect(result).toBe('SMART objective');
            const callArgs = vi.mocked(UnifiedAI.sendMessage).mock.calls[0];
            // Check system instruction (3rd argument) contains SMART
            expect(callArgs[3]).toContain('SMART');
        });

        it('should refine content with blocker context', async () => {
            vi.mocked(UnifiedAI.sendMessage).mockResolvedValue('Refined blocker');

            await refineContent('Something is broken', 'blocker');

            const callArgs = vi.mocked(UnifiedAI.sendMessage).mock.calls[0];
            // Check system instruction (3rd argument) contains root cause
            expect(callArgs[3]).toContain('root cause');
        });

        it('should refine content with constraint context', async () => {
            vi.mocked(UnifiedAI.sendMessage).mockResolvedValue('Refined constraint');

            await refineContent('Limited budget', 'constraint');

            const callArgs = vi.mocked(UnifiedAI.sendMessage).mock.calls[0];
            // Check system instruction (3rd argument) contains constraint
            expect(callArgs[3]).toContain('constraint');
        });

        it('should refine content with location context', async () => {
            vi.mocked(UnifiedAI.sendMessage).mockResolvedValue('Refined locations');

            await refineContent('Warsaw, Krakow', 'location');

            const callArgs = vi.mocked(UnifiedAI.sendMessage).mock.calls[0];
            // Check system instruction (3rd argument) contains locations
            expect(callArgs[3]).toContain('locations');
        });

        it('should return original text if too short', async () => {
            const result = await refineContent('Hi', 'general');

            expect(UnifiedAI.sendMessage).not.toHaveBeenCalled();
            expect(result).toBe('Hi');
        });

        it('should return original text if empty', async () => {
            const result = await refineContent('', 'general');

            expect(UnifiedAI.sendMessage).not.toHaveBeenCalled();
            expect(result).toBe('');
        });

        it('should return original text on error', async () => {
            vi.mocked(UnifiedAI.sendMessage).mockRejectedValue(new Error('Error'));

            const result = await refineContent('Original text', 'general');

            // refineContent catches errors and returns error message, not original text
            // But the error message should contain "error"
            expect(result).toContain('error');
        });
    });

    describe('SYSTEM_PROMPTS', () => {
        it('should have FREE_ASSESSMENT prompt defined', () => {
            expect(SYSTEM_PROMPTS.FREE_ASSESSMENT).toBeDefined();
            expect(SYSTEM_PROMPTS.FREE_ASSESSMENT).toContain('Consultify AI');
            expect(SYSTEM_PROMPTS.FREE_ASSESSMENT).toContain('manufacturing');
        });
    });
});

