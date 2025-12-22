```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAIStream } from '../../../hooks/useAIStream';
import { useAppStore } from '../../../store/useAppStore';
import { Api } from '../../../services/api';
vi.mock('../../../store/useAppStore');
vi.mock('../../../services/api');
describe('Hook Test: useAIStream', () => {
    const mockUpdateLastChatMessage = vi.fn();
    const mockSetIsBotTyping = vi.fn();
    const mockSetCurrentStreamContent = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as jest.Mock).mockReturnValue({
            updateLastChatMessage: mockUpdateLastChatMessage,
            setIsBotTyping: mockSetIsBotTyping,
            setCurrentStreamContent: mockSetCurrentStreamContent,
            currentStreamContent: '',
            isBotTyping: false,
        });
    });
    it('initializes with correct default values', () => {
        const { result } = renderHook(() => useAIStream());
        expect(result.current.isStreaming).toBe(false);
        expect(result.current.streamedContent).toBe('');
        expect(typeof result.current.startStream).toBe('function');
    });
    it('calls API with correct parameters', async () => {
        (Api.chatWithAIStream as jest.Mock).mockImplementation((message: string, history: string[], onChunk: (chunk: string) => void, onDone: () => void) => {
            onChunk('Hello');
            onChunk(' World');
            onDone();
        });
        const { result } = renderHook(() => useAIStream());
        await result.current.startStream('Test message', [], 'System prompt');
        expect(Api.chatWithAIStream).toHaveBeenCalledWith(
            'Test message',
            [],
            expect.any(Function),
            expect.any(Function),
            'System prompt',
            undefined
        );
    });
    it('updates stream content as chunks arrive', async () => {
        (Api.chatWithAIStream as jest.Mock).mockImplementation((message: string, history: string[], onChunk: (chunk: string) => void, onDone: () => void) => {
            onChunk('Hello');
            onChunk(' World');
            onDone();
        });
        const { result } = renderHook(() => useAIStream());
        await result.current.startStream('Test', []);
        expect(mockSetCurrentStreamContent).toHaveBeenCalled();
    });
    it('calls onStreamDone callback when stream completes', async () => {
        const onDoneCallback = vi.fn();
        (Api.chatWithAIStream as jest.Mock).mockImplementation((message: string, history: string[], onChunk: (chunk: string) => void, onDone: () => void) => {
            onChunk('Complete');
            onDone();
        });
        const { result } = renderHook(() => useAIStream({ onStreamDone: onDoneCallback }));
        await result.current.startStream('Test', []);
        await waitFor(() => {
            expect(onDoneCallback).toHaveBeenCalled();
        });
    });
    it('handles stream errors', async () => {
        const onErrorCallback = vi.fn();
        const error = new Error('Stream failed');
        (Api.chatWithAIStream as jest.Mock).mockRejectedValue(error);
        const { result } = renderHook(() => useAIStream({ onStreamError: onErrorCallback }));
        await result.current.startStream('Test', []);
        await waitFor(() => {
            expect(mockSetIsBotTyping).toHaveBeenCalledWith(false);
            expect(onErrorCallback).toHaveBeenCalledWith(error);
        });
    });
    it('sets bot typing state correctly', async () => {
        (Api.chatWithAIStream as jest.Mock).mockImplementation((message: string, history: string[], onChunk: (chunk: string) => void, onDone: () => void) => {
            onChunk('Hello');
            onChunk(' World');
            onDone();
        });
        const { result } = renderHook(() => useAIStream());
        await result.current.startStream('Test', []);
        expect(mockSetIsBotTyping).toHaveBeenCalledWith(true);
        await waitFor(() => {
            expect(mockSetIsBotTyping).toHaveBeenCalledWith(false);
        });
    });
});
```
Zmieniłem typowanie z `any` na bardziej odpowiednie typy, takie jak `jest.Mock` i `string[]`, aby spełnić wymagania lintera i poprawić typowanie w testach.