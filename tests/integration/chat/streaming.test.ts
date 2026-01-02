/**
 * Integration tests for Enhanced Streaming
 * World-Class Chat 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAIStream } from '../../../hooks/useAIStream';
import { Api } from '../../../services/api';
import { renderHook, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { useArtifactsStore, parseArtifactsFromResponse } from '../../../store/useArtifactsStore';

// Mock stores
vi.mock('../../../store/useAppStore', () => ({
  useAppStore: vi.fn()
}));

vi.mock('../../../store/useArtifactsStore', () => ({
  useArtifactsStore: vi.fn(),
  parseArtifactsFromResponse: vi.fn(() => [])
}));



describe('Enhanced Streaming Integration', () => {
  const mockUpdateLastChatMessage = vi.fn();
  const mockSetIsBotTyping = vi.fn();
  const mockSetCurrentStreamContent = vi.fn();
  const mockAddArtifact = vi.fn();
  let chatSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Spy on the API method and provide default implementation
    chatSpy = vi.spyOn(Api, 'chatWithAIStream').mockImplementation(async () => { });

    (useAppStore as any).mockReturnValue({
      updateLastChatMessage: mockUpdateLastChatMessage,
      setIsBotTyping: mockSetIsBotTyping,
      setCurrentStreamContent: mockSetCurrentStreamContent,
      currentStreamContent: '',
      isBotTyping: false
    });

    (useArtifactsStore as any).mockReturnValue({
      addArtifact: mockAddArtifact
    });

    (parseArtifactsFromResponse as any).mockReturnValue([]);

  });

  it('extracts thinking steps during streaming', async () => {


    // Mock streaming response with thinking steps
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield { content: '<thinking>\n1. Analyzing' };
        yield { content: ' requirements\n</thinking>\n\nAnswer: ' };
        yield { content: 'Here is the solution.' };
      }
    };

    chatSpy.mockImplementation(async (msg: any, hist: any, onChunk: any, onDone: any) => {
      for await (const chunk of mockStream) {
        onChunk(chunk.content);
        await new Promise(r => setTimeout(r, 100));
      }
      onDone();
    });

    const { result } = renderHook(() => useAIStream());

    await result.current.startStream('Test message', [], 'System prompt');

    await waitFor(() => {
      expect(result.current.thinkingSteps.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('detects artifacts during streaming', async () => {


    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield { content: 'Here is code:\n```artifact:code:javascript:Test\n' };
        yield { content: 'function test() {}\n```' };
      }
    };

    (parseArtifactsFromResponse as any).mockReturnValue([{ id: 'test', type: 'code' }]);

    chatSpy.mockImplementation(async (msg: any, hist: any, onChunk: any, onDone: any) => {
      for await (const chunk of mockStream) {
        onChunk(chunk.content);
        await new Promise(r => setTimeout(r, 100));
      }
      onDone();
    });

    const { result } = renderHook(() => useAIStream({
      onArtifactDetected: vi.fn()
    }));

    await result.current.startStream('Generate code', [], 'System prompt');

    await waitFor(() => {
      expect(mockAddArtifact).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('tracks progress during streaming', async () => {


    const chunks = ['Chunk 1', 'Chunk 2', 'Chunk 3'];
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) {
          yield { content: chunk };
        }
      }
    };

    chatSpy.mockImplementation(async (msg: any, hist: any, onChunk: any, onDone: any) => {
      for await (const chunk of mockStream) {
        onChunk(chunk.content);
        await new Promise(r => setTimeout(r, 100));
      }
      onDone();
    });

    const { result } = renderHook(() => useAIStream());

    await result.current.startStream('Test', [], 'System prompt');

    await waitFor(() => {
      expect(result.current.progress).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('handles streaming errors gracefully', async () => {


    chatSpy.mockRejectedValue(new Error('Stream error'));

    const onError = vi.fn();
    const { result } = renderHook(() => useAIStream({
      onStreamError: onError
    }));

    await result.current.startStream('Test', [], 'System prompt');

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('calls onStreamDone when streaming completes', async () => {


    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield { content: 'Complete response' };
      }
    };

    chatSpy.mockImplementation(async (msg: any, hist: any, onChunk: any, onDone: any) => {
      for await (const chunk of mockStream) {
        onChunk(chunk.content);
        await new Promise(r => setTimeout(r, 100));
      }
      onDone();
    });

    const onDone = vi.fn();
    const { result } = renderHook(() => useAIStream({
      onStreamDone: onDone
    }));

    await result.current.startStream('Test', [], 'System prompt');

    await waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('updates streamed content in real-time', async () => {


    const chunks = ['Hello', ' World', '!'];
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) {
          yield { content: chunk };
        }
      }
    };

    chatSpy.mockImplementation(async (msg: any, hist: any, onChunk: any, onDone: any) => {
      for await (const chunk of mockStream) {
        onChunk(chunk.content);
        await new Promise(r => setTimeout(r, 100));
      }
      onDone();
    });

    const { result } = renderHook(() => useAIStream());

    await result.current.startStream('Test', [], 'System prompt');

    await waitFor(() => {
      // Check if the store action was called with the expected content parts
      expect(mockSetCurrentStreamContent).toHaveBeenCalledWith(expect.stringContaining('Hello'));
      expect(mockSetCurrentStreamContent).toHaveBeenCalledWith(expect.stringContaining('World'));
    }, { timeout: 2000 });
  });
});
