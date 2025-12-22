```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
        (Api.chatWithAIStream as jest.Mock).mockImplementation((prompt: string, history: any[], onChunk: (chunk: string) => void, onComplete: () => void) => {
            onChunk('Hello');
            onChunk(' World');
            onComplete();
            return Promise.resolve();
        });
        const { result } = renderHook(() => useIndependentAI());
        let callPromise: Promise<string> | undefined;
        await act(async () => {
            callPromise = result.current.callAI('Test prompt');
        });
        expect(result.current.isLoading).toBe(false); // Should be false after onComplete
        expect(result.current.result).toBe('Hello World');
    });
    it('refineText calls callAI with correct prompt and system instruction', async () => {
        const { result } = renderHook(() => useIndependentAI());
        const callAISpy = vi.spyOn(result.current, 'callAI');
        // Note: spyOn result.current.callAI won't work easily because it's returned from hook.
        // We should verify Api calls instead.
        (Api.chatWithAIStream as jest.Mock).mockImplementation((p: string, h: any[], onC: (chunk: string) => void, onComp: () => void) => {
            onComp();
            return Promise.resolve();
        });
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
```
Zmiany:
1. Usunięto `waitFor` z importu, ponieważ nie jest używane.
2. Zmieniono typy `any` na bardziej konkretne typy, takie jak `string` i `any[]`.
3. Zmieniono `as any` na `as jest.Mock` dla `Api.chatWithAIStream` w celu lepszego typowania.