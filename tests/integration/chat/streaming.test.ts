/**
 * Integration tests for Enhanced Streaming
 * World-Class Chat 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAIStream } from '../../../hooks/useAIStream';
import { renderHook, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { useArtifactsStore } from '../../../store/useArtifactsStore';

// Mock stores
vi.mock('../../../store/useAppStore', () => ({
  useAppStore: vi.fn()
}));

vi.mock('../../../store/useArtifactsStore', () => ({
  useArtifactsStore: vi.fn()
}));

vi.mock('../../../services/api', () => ({
  Api: {
    streamChat: vi.fn()
  }
}));

describe('Enhanced Streaming Integration', () => {
  const mockUpdateLastChatMessage = vi.fn();
  const mockSetIsBotTyping = vi.fn();
  const mockSetCurrentStreamContent = vi.fn();
  const mockAddArtifact = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
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
  });

  it('extracts thinking steps during streaming', async () => {
    const { Api } = await import('../../../services/api');
    
    // Mock streaming response with thinking steps
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield { content: '<thinking>\n1. Analyzing' };
        yield { content: ' requirements\n</thinking>\n\nAnswer: ' };
        yield { content: 'Here is the solution.' };
      }
    };

    (Api.streamChat as any).mockResolvedValue(mockStream);

    const { result } = renderHook(() => useAIStream());

    await result.current.startStream('Test message', [], 'System prompt');

    await waitFor(() => {
      expect(result.current.thinkingSteps.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('detects artifacts during streaming', async () => {
    const { Api } = await import('../../../services/api');
    
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield { content: 'Here is code:\n```artifact:code:javascript:Test\n' };
        yield { content: 'function test() {}\n```' };
      }
    };

    (Api.streamChat as any).mockResolvedValue(mockStream);

    const { result } = renderHook(() => useAIStream({
      onArtifactDetected: vi.fn()
    }));

    await result.current.startStream('Generate code', [], 'System prompt');

    await waitFor(() => {
      expect(mockAddArtifact).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('tracks progress during streaming', async () => {
    const { Api } = await import('../../../services/api');
    
    const chunks = ['Chunk 1', 'Chunk 2', 'Chunk 3'];
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) {
          yield { content: chunk };
        }
      }
    };

    (Api.streamChat as any).mockResolvedValue(mockStream);

    const { result } = renderHook(() => useAIStream());

    await result.current.startStream('Test', [], 'System prompt');

    await waitFor(() => {
      expect(result.current.progress).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('handles streaming errors gracefully', async () => {
    const { Api } = await import('../../../services/api');
    
    (Api.streamChat as any).mockRejectedValue(new Error('Stream error'));

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
    const { Api } = await import('../../../services/api');
    
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield { content: 'Complete response' };
      }
    };

    (Api.streamChat as any).mockResolvedValue(mockStream);

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
    const { Api } = await import('../../../services/api');
    
    const chunks = ['Hello', ' World', '!'];
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) {
          yield { content: chunk };
        }
      }
    };

    (Api.streamChat as any).mockResolvedValue(mockStream);

    const { result } = renderHook(() => useAIStream());

    await result.current.startStream('Test', [], 'System prompt');

    await waitFor(() => {
      expect(result.current.streamedContent).toContain('Hello');
      expect(result.current.streamedContent).toContain('World');
    }, { timeout: 2000 });
  });
});

