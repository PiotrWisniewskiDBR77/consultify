/**
 * useIndependentAI Hook Integration Tests
 * 
 * Tests independent AI operations for Smart Inputs, Magic Buttons, etc.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Api
vi.mock('@/services/api', () => ({
    Api: {
        chatWithAIStream: vi.fn(),
    },
}));

import { useIndependentAI } from '@/hooks/useIndependentAI';
import { Api } from '@/services/api';

describe('useIndependentAI', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should initialize with default state', () => {
        const { result } = renderHook(() => useIndependentAI());

        expect(result.current.isLoading).toBe(false);
        expect(result.current.result).toBeNull();
        expect(typeof result.current.callAI).toBe('function');
        expect(typeof result.current.refineText).toBe('function');
    });

    it('should call AI and accumulate streamed result', async () => {
        let accumulatedContent = '';

        vi.mocked(Api.chatWithAIStream).mockImplementation(
            async (prompt, history, onChunk, onDone) => {
                onChunk('Hello ');
                onChunk('World');
                onDone();
            }
        );

        const { result } = renderHook(() => useIndependentAI());

        let response: string | undefined;
        await act(async () => {
            response = await result.current.callAI('Test prompt');
        });

        expect(response).toBe('Hello World');
        expect(result.current.isLoading).toBe(false);
    });

    it('should set loading state during AI call', async () => {
        let resolvePromise: () => void;
        const promise = new Promise<void>((resolve) => {
            resolvePromise = resolve;
        });

        vi.mocked(Api.chatWithAIStream).mockImplementation(
            async (prompt, history, onChunk, onDone) => {
                await promise;
                onDone();
            }
        );

        const { result } = renderHook(() => useIndependentAI());

        // Start the call
        let callPromise: Promise<string>;
        act(() => {
            callPromise = result.current.callAI('Test');
        });

        // Should be loading
        expect(result.current.isLoading).toBe(true);

        // Resolve
        await act(async () => {
            resolvePromise!();
            await callPromise;
        });

        expect(result.current.isLoading).toBe(false);
    });

    it('should handle errors gracefully', async () => {
        vi.mocked(Api.chatWithAIStream).mockRejectedValue(new Error('API Error'));

        const { result } = renderHook(() => useIndependentAI());

        await expect(
            act(async () => {
                await result.current.callAI('Test prompt');
            })
        ).rejects.toThrow('API Error');

        expect(result.current.isLoading).toBe(false);
    });

    it('should pass system instruction to API', async () => {
        vi.mocked(Api.chatWithAIStream).mockImplementation(
            async (prompt, history, onChunk, onDone, systemInstruction) => {
                expect(systemInstruction).toBe('Custom instruction');
                onDone();
            }
        );

        const { result } = renderHook(() => useIndependentAI());

        await act(async () => {
            await result.current.callAI('Test', 'Custom instruction');
        });
    });

    it('should use default system instruction if not provided', async () => {
        vi.mocked(Api.chatWithAIStream).mockImplementation(
            async (prompt, history, onChunk, onDone, systemInstruction) => {
                expect(systemInstruction).toBe('You are a helpful assistant.');
                onDone();
            }
        );

        const { result } = renderHook(() => useIndependentAI());

        await act(async () => {
            await result.current.callAI('Test');
        });
    });

    it('should call stream callback for each chunk', async () => {
        vi.mocked(Api.chatWithAIStream).mockImplementation(
            async (prompt, history, onChunk, onDone) => {
                onChunk('A');
                onChunk('B');
                onChunk('C');
                onDone();
            }
        );

        const streamCallback = vi.fn();
        const { result } = renderHook(() => useIndependentAI());

        await act(async () => {
            await result.current.callAI('Test', undefined, undefined, streamCallback);
        });

        expect(streamCallback).toHaveBeenCalledTimes(3);
        expect(streamCallback).toHaveBeenCalledWith('A');
        expect(streamCallback).toHaveBeenCalledWith('B');
        expect(streamCallback).toHaveBeenCalledWith('C');
    });

    it('should refine text with proper prompt', async () => {
        vi.mocked(Api.chatWithAIStream).mockImplementation(
            async (prompt, history, onChunk, onDone, systemInstruction) => {
                expect(prompt).toContain('Rewrite the following text');
                expect(prompt).toContain('Original text here');
                expect(systemInstruction).toBe('You are a Senior Editor.');
                onChunk('Refined text');
                onDone();
            }
        );

        const { result } = renderHook(() => useIndependentAI());

        let refined: string | undefined;
        await act(async () => {
            refined = await result.current.refineText('Original text here');
        });

        expect(refined).toBe('Refined text');
    });

    it('should pass empty history for atomic operations', async () => {
        vi.mocked(Api.chatWithAIStream).mockImplementation(
            async (prompt, history, onChunk, onDone) => {
                expect(history).toEqual([]);
                onDone();
            }
        );

        const { result } = renderHook(() => useIndependentAI());

        await act(async () => {
            await result.current.callAI('Test');
        });
    });

    it('should clear previous result before new call', async () => {
        vi.mocked(Api.chatWithAIStream)
            .mockImplementationOnce(async (prompt, history, onChunk, onDone) => {
                onChunk('First result');
                onDone();
            })
            .mockImplementationOnce(async (prompt, history, onChunk, onDone) => {
                onChunk('Second result');
                onDone();
            });

        const { result } = renderHook(() => useIndependentAI());

        await act(async () => {
            await result.current.callAI('First');
        });

        expect(result.current.result).toBe('First result');

        await act(async () => {
            await result.current.callAI('Second');
        });

        expect(result.current.result).toBe('Second result');
    });
});