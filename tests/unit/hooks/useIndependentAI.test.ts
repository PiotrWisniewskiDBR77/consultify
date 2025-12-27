import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { useIndependentAI } from '../../../hooks/useIndependentAI';
import { Api } from '../../../services/api';

vi.mock('../../../services/api');

describe('useIndependentAI', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initializes with default state', () => {
        const { result } = renderHook(() => useIndependentAI());
        expect(result.current.isLoading).toBe(false);
        expect(result.current.result).toBeNull();
    });

    it('callAI manages loading state and accumulates stream', async () => {
        (Api.chatWithAIStream as Mock).mockImplementation(
            (prompt: string, history: unknown[], onChunk: (chunk: string) => void, onComplete: () => void) => {
                onChunk('Hello');
                onChunk(' World');
                onComplete();
                return Promise.resolve();
            }
        );
        const { result } = renderHook(() => useIndependentAI());
        await act(async () => {
            await result.current.callAI('Test prompt');
        });
        expect(result.current.isLoading).toBe(false); // Should be false after onComplete
        expect(result.current.result).toBe('Hello World');
    });

    it('refineText calls callAI with correct prompt and system instruction', async () => {
        (Api.chatWithAIStream as Mock).mockImplementation(
            (p: string, h: unknown[], onC: (chunk: string) => void, onComp: () => void) => {
                onComp();
                return Promise.resolve();
            }
        );
        const { result } = renderHook(() => useIndependentAI());
        await act(async () => {
            await result.current.refineText('Bad text');
        });
        expect(Api.chatWithAIStream).toHaveBeenCalledWith(
            expect.stringContaining('Rewrite the following text'),
            expect.any(Array),
            expect.any(Function),
            expect.any(Function),
            'You are a Senior Editor.',
            undefined
        );
    });
});