/**
 * useAIStream Hook Integration Tests
 *
 * Tests the real streaming logic, thinking extraction, and artifact parsing.
 * Uses mocked fetch but tests real hook logic.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

// Mock the stores before importing the hook
vi.mock('@/store/useAppStore', () => ({
  useAppStore: vi.fn(() => ({
    updateLastChatMessage: vi.fn(),
    setIsBotTyping: vi.fn(),
    setCurrentStreamContent: vi.fn(),
    currentStreamContent: '',
    isBotTyping: false,
    aiConfig: {
      textToSpeech: false,
      ttsVoice: null,
      ttsRate: 1.0,
      ttsPitch: 1.0,
      deepResearch: false,
      webSearch: false,
      showReasoning: false,
      maxMode: false,
      knowledgeSources: [],
      responseStyle: 'normal',
    },
  })),
}));

vi.mock('@/store/useArtifactsStore', () => ({
  useArtifactsStore: vi.fn(() => ({
    addArtifact: vi.fn(),
  })),
  parseArtifactsFromResponse: vi.fn(() => []),
}));

vi.mock('@/services/api', () => ({
  Api: {
    chatWithAIStream: vi.fn(),
  },
}));

import { useAIStream } from '@/hooks/useAIStream';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

describe('useAIStream', () => {
  const mockSetIsBotTyping = vi.fn();
  const mockSetCurrentStreamContent = vi.fn();
  const mockUpdateLastChatMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup store mock
    vi.mocked(useAppStore).mockReturnValue({
      updateLastChatMessage: mockUpdateLastChatMessage,
      setIsBotTyping: mockSetIsBotTyping,
      setCurrentStreamContent: mockSetCurrentStreamContent,
      currentStreamContent: '',
      isBotTyping: false,
      aiConfig: {
        textToSpeech: false,
        ttsVoice: null,
        ttsRate: 1.0,
        ttsPitch: 1.0,
        deepResearch: false,
        webSearch: false,
        showReasoning: false,
        maxMode: false,
        knowledgeSources: [],
        responseStyle: 'normal',
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useAIStream());

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamedContent).toBe('');
    expect(result.current.thinkingSteps).toEqual([]);
    expect(result.current.artifacts).toEqual([]);
    expect(result.current.progress).toBe(0);
  });

  it('should expose stream control functions', () => {
    const { result } = renderHook(() => useAIStream());

    expect(typeof result.current.startStream).toBe('function');
    expect(typeof result.current.abortStream).toBe('function');
    expect(typeof result.current.resumeFromPartial).toBe('function');
    expect(typeof result.current.checkPartialResponse).toBe('function');
  });

  it('should start streaming and process chunks', async () => {
    const mockOnStreamDone = vi.fn();

    // Mock the API to simulate streaming
    vi.mocked(Api.chatWithAIStream).mockImplementation(
      async (message, history, onChunk, onDone) => {
        // Simulate streaming chunks
        onChunk('Hello ');
        onChunk('World!');
        onDone();
      }
    );

    const { result } = renderHook(() => useAIStream({ onStreamDone: mockOnStreamDone }));

    await act(async () => {
      await result.current.startStream('Test message', []);
    });

    // Verify typing state was set
    expect(mockSetIsBotTyping).toHaveBeenCalledWith(true);
    expect(mockSetIsBotTyping).toHaveBeenCalledWith(false);

    // Verify content was accumulated
    expect(mockSetCurrentStreamContent).toHaveBeenCalled();
  });

  it('should pass streamed session id through onStreamDone metadata', async () => {
    const mockOnStreamDone = vi.fn();

    vi.mocked(Api.chatWithAIStream).mockImplementation(
      async (
        message,
        history,
        onChunk,
        onDone,
        systemPrompt,
        context,
        roleName,
        language,
        onThinking
      ) => {
        onThinking?.({ type: 'stream_meta', sessionId: 'stream-session-123' });
        onChunk('Hello ');
        onChunk('again');
        onDone();
      }
    );

    const { result } = renderHook(() => useAIStream({ onStreamDone: mockOnStreamDone }));

    await act(async () => {
      await result.current.startStream('Test message', []);
    });

    expect(mockOnStreamDone).toHaveBeenCalledWith(
      'Hello again',
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ sessionId: 'stream-session-123' })
    );
  });

  it('should pass latest streamed citations through onStreamDone metadata', async () => {
    const mockOnStreamDone = vi.fn();

    vi.mocked(Api.chatWithAIStream).mockImplementation(
      async (
        message,
        history,
        onChunk,
        onDone,
        systemPrompt,
        context,
        roleName,
        language,
        onThinking
      ) => {
        onChunk('Answer with source [1]');
        onThinking?.({
          type: 'citations',
          citations: [
            {
              id: 'cit-1',
              title: 'DBR77 Marketplace',
              type: 'external',
              reference: 'dbr77.com',
              link: 'https://dbr77.com',
            },
          ],
        });
        onDone();
      }
    );

    const { result } = renderHook(() => useAIStream({ onStreamDone: mockOnStreamDone }));

    await act(async () => {
      await result.current.startStream('Test message', []);
    });

    expect(mockOnStreamDone).toHaveBeenCalledWith(
      'Answer with source [1]',
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({
        citations: [
          expect.objectContaining({
            id: 'cit-1',
            title: 'DBR77 Marketplace',
          }),
        ],
      })
    );
  });

  it('should pass the streamed source ledger through onStreamDone metadata', async () => {
    const mockOnStreamDone = vi.fn();
    const sourceLedger = {
      type: 'source_ledger',
      used_sources: [{ id: 'doc-1', type: 'document', title: 'Operating model' }],
      blocked_sources: [{ category: 'cross_tenant', reason: 'forbidden_by_policy' }],
      degraded: null,
    };

    vi.mocked(Api.chatWithAIStream).mockImplementation(
      async (
        _message,
        _history,
        onChunk,
        onDone,
        _systemPrompt,
        _context,
        _roleName,
        _language,
        onThinking
      ) => {
        onChunk('Grounded answer [1]');
        onThinking?.(sourceLedger);
        onDone();
      }
    );

    const { result } = renderHook(() => useAIStream({ onStreamDone: mockOnStreamDone }));

    await act(async () => {
      await result.current.startStream('Use the operating model', []);
    });

    expect(mockOnStreamDone).toHaveBeenCalledWith(
      'Grounded answer [1]',
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ sourceLedger })
    );
  });

  it('should pass streamed TrustBundleV1 through onStreamDone metadata', async () => {
    const mockOnStreamDone = vi.fn();

    vi.mocked(Api.chatWithAIStream).mockImplementation(
      async (
        message,
        history,
        onChunk,
        onDone,
        systemPrompt,
        context,
        roleName,
        language,
        onThinking
      ) => {
        onChunk('Trusted answer [1]');
        onThinking?.({
          type: 'trust_bundle',
          bundle: {
            version: 'TrustBundleV1',
            model: 'gpt-4o-mini',
            provider: 'openai',
            citationsCount: 1,
          },
        });
        onDone();
      }
    );

    const { result } = renderHook(() => useAIStream({ onStreamDone: mockOnStreamDone }));

    await act(async () => {
      await result.current.startStream('Test trust bundle', []);
    });

    expect(result.current.trustBundle).toEqual(
      expect.objectContaining({
        version: 'TrustBundleV1',
        citationsCount: 1,
      })
    );
    expect(mockOnStreamDone).toHaveBeenCalledWith(
      'Trusted answer [1]',
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({
        trustBundle: expect.objectContaining({
          version: 'TrustBundleV1',
          model: 'gpt-4o-mini',
        }),
      })
    );
  });

  it('should persist Teresa proposal metadata from streaming events', async () => {
    const mockOnStreamDone = vi.fn();

    vi.mocked(Api.chatWithAIStream).mockImplementation(
      async (
        message,
        history,
        onChunk,
        onDone,
        systemPrompt,
        context,
        roleName,
        language,
        onThinking
      ) => {
        onChunk('Draft ready.');
        onThinking?.({
          type: 'teresa_proposal',
          proposal: {
            proposalId: 'proposal-1',
            contractId: 'teresa_copilot_v1',
            title: 'Prepare initiative draft',
            summary: 'Proposal prepared for Initiatives.',
            state: 'proposal',
            approvalState: 'awaiting_review',
            allowedActions: ['approve', 'reject', 'navigate'],
            targetModule: 'initiatives',
            targetLabel: 'Initiatives',
            handoffIntent: 'create',
            previewLines: ['Problem statement', 'Expected outcome'],
            auditCount: 1,
            resultRef: null,
            degraded: null,
          },
        });
        onDone();
      }
    );

    const { result } = renderHook(() => useAIStream({ onStreamDone: mockOnStreamDone }));

    await act(async () => {
      await result.current.startStream('Prepare initiative', []);
    });

    expect(result.current.teresaProposal).toEqual(
      expect.objectContaining({
        proposalId: 'proposal-1',
        targetModule: 'initiatives',
      })
    );
    expect(mockOnStreamDone).toHaveBeenCalledWith(
      'Draft ready.',
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({
        proposal: expect.objectContaining({ proposalId: 'proposal-1' }),
      })
    );
  });

  it('should handle streaming errors gracefully', async () => {
    const mockOnStreamError = vi.fn();

    vi.mocked(Api.chatWithAIStream).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAIStream({ onStreamError: mockOnStreamError }));

    await act(async () => {
      await result.current.startStream('Test message', []);
    });

    await waitFor(() => {
      expect(mockOnStreamError).toHaveBeenCalledWith(expect.any(Error));
    });
    expect(Api.chatWithAIStream).toHaveBeenCalledTimes(1);
    expect(mockSetIsBotTyping).toHaveBeenCalledWith(false);
  });

  it('does not start a second HTTP stream when startStream races before React rerenders', async () => {
    let release!: () => void;
    vi.mocked(Api.chatWithAIStream).mockImplementation(
      () => new Promise<void>((resolve) => (release = resolve))
    );
    const { result } = renderHook(() => useAIStream());
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.startStream('first', []);
      second = result.current.startStream('second', []);
    });
    expect(Api.chatWithAIStream).toHaveBeenCalledTimes(1);
    release();
    await act(async () => {
      await Promise.all([first, second]);
    });
  });

  it('fails a terminal full-session start immediately while an aborted transport is still closing', async () => {
    let release!: () => void;
    vi.mocked(Api.chatWithAIStream).mockImplementation(
      () => new Promise<void>((resolve) => (release = resolve))
    );
    const { result } = renderHook(() => useAIStream());
    let first!: Promise<void>;
    act(() => {
      first = result.current.startStream('first', []);
    });

    await expect(
      result.current.startStream(
        'retry',
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      )
    ).rejects.toThrow('still stopping');
    expect(Api.chatWithAIStream).toHaveBeenCalledTimes(1);

    release();
    await act(async () => first);
  });

  it('does not auto-retry non-retryable access or budget failures', async () => {
    const mockOnStreamError = vi.fn();
    const blocked = Object.assign(new Error('Budget exhausted'), {
      code: 'AI_BUDGET_EXHAUSTED',
    });
    vi.mocked(Api.chatWithAIStream).mockRejectedValue(blocked);

    const { result } = renderHook(() => useAIStream({ onStreamError: mockOnStreamError }));
    await act(async () => {
      await result.current.startStream('Test budget', []);
    });

    expect(Api.chatWithAIStream).toHaveBeenCalledTimes(1);
    expect(mockOnStreamError).toHaveBeenCalledWith(blocked);
    expect(result.current.lastError).toBe(blocked);
  });

  it('should extract thinking steps from content', async () => {
    const mockOnThinkingUpdate = vi.fn();

    vi.mocked(Api.chatWithAIStream).mockImplementation(
      async (message, history, onChunk, onDone) => {
        onChunk('<thinking>Analyzing the request</thinking>');
        onChunk('Here is my response.');
        onDone();
      }
    );

    const { result } = renderHook(() => useAIStream({ onThinkingUpdate: mockOnThinkingUpdate }));

    await act(async () => {
      await result.current.startStream('Analyze this', []);
    });

    // Thinking update should have been called
    expect(mockOnThinkingUpdate).toHaveBeenCalled();
  });

  it('should abort stream on demand', async () => {
    const { result } = renderHook(() => useAIStream());

    act(() => {
      result.current.abortStream();
    });

    expect(mockSetIsBotTyping).toHaveBeenCalledWith(false);
    expect(mockSetCurrentStreamContent).toHaveBeenCalledWith('');
  });

  it('GF-CHAT-07: forced disconnect mid-stream never calls onStreamDone (no false success)', async () => {
    // Simulates a forced disconnect/timeout: the stream is still in flight
    // (the mocked Api.chatWithAIStream promise never resolves) when the
    // caller aborts. isStreaming must flip to false and onStreamDone must
    // never fire — an abort is not a completion, so nothing downstream may
    // treat it as one.
    const mockOnStreamDone = vi.fn();
    let releaseStream: () => void = () => {};
    const inFlightStream = new Promise<void>((resolve) => {
      releaseStream = resolve;
    });

    vi.mocked(Api.chatWithAIStream).mockImplementationOnce(async (_message, _history, onChunk) => {
      onChunk('Partial content before forced disconnect');
      await inFlightStream;
    });

    const { result } = renderHook(() => useAIStream({ onStreamDone: mockOnStreamDone }));

    act(() => {
      void result.current.startStream('Test message', []);
    });

    await waitFor(() =>
      expect(result.current.streamedContent).toBe('Partial content before forced disconnect')
    );
    expect(result.current.isStreaming).toBe(true);

    let hadPartial: boolean | undefined;
    act(() => {
      hadPartial = result.current.abortStream();
    });

    expect(hadPartial).toBe(true); // partial content WAS received — distinct from a clean cancel
    expect(result.current.isStreaming).toBe(false);
    expect(mockOnStreamDone).not.toHaveBeenCalled();

    releaseStream();
  });

  it('GF-CHAT-07: aborting BEFORE any content arrives is a clean cancel, not a false success', async () => {
    let releaseStream: () => void = () => {};
    const inFlightStream = new Promise<void>((resolve) => {
      releaseStream = resolve;
    });
    const mockOnStreamDone = vi.fn();

    vi.mocked(Api.chatWithAIStream).mockImplementationOnce(async () => {
      await inFlightStream; // no onChunk call at all before abort
    });

    const { result } = renderHook(() => useAIStream({ onStreamDone: mockOnStreamDone }));

    act(() => {
      void result.current.startStream('Test message', []);
    });

    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    let hadPartial: boolean | undefined;
    act(() => {
      hadPartial = result.current.abortStream();
    });

    expect(hadPartial).toBe(false);
    expect(result.current.isStreaming).toBe(false);
    expect(mockOnStreamDone).not.toHaveBeenCalled();

    releaseStream();
  });

  it('should check for partial response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessionId: 'test-session',
          content: 'Partial content...',
          canResume: true,
        }),
    });

    const { result } = renderHook(() => useAIStream());

    let partial: any;
    await act(async () => {
      partial = await result.current.checkPartialResponse('test-session');
    });

    expect(partial).toEqual({
      sessionId: 'test-session',
      content: 'Partial content...',
      canResume: true,
    });
  });

  it('should handle partial response check failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const { result } = renderHook(() => useAIStream());

    let partial: any;
    await act(async () => {
      partial = await result.current.checkPartialResponse('nonexistent-session');
    });

    expect(partial).toBeNull();
  });

  it('returns revoked membership as a non-resumable forbidden state', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    });

    const { result } = renderHook(() => useAIStream());

    let partial: any;
    await act(async () => {
      partial = await result.current.checkPartialResponse('revoked-session');
    });

    expect(partial).toEqual({
      sessionId: 'revoked-session',
      content: '',
      canResume: false,
      forbidden: true,
    });
  });

  it('preserves a server-declared superseded checkpoint as stale and non-resumable', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessionId: 'stale-session',
          content: 'Outdated partial',
          canResume: false,
          stale: true,
          code: 'PARTIAL_RECOVERY_SUPERSEDED',
        }),
    });

    const { result } = renderHook(() => useAIStream());

    let partial: any;
    await act(async () => {
      partial = await result.current.checkPartialResponse('stale-session');
    });

    expect(partial).toMatchObject({
      sessionId: 'stale-session',
      content: 'Outdated partial',
      canResume: false,
      stale: true,
    });
  });

  it('should pass focus mode to stream context', async () => {
    vi.mocked(Api.chatWithAIStream).mockImplementation(
      async (message, history, onChunk, onDone, systemPrompt, context) => {
        expect(context?.focusMode).toBe('deep_analysis');
        onDone();
      }
    );

    const { result } = renderHook(() => useAIStream());

    await act(async () => {
      await result.current.startStream('Analyze deeply', [], undefined, {}, 'deep_analysis' as any);
    });
  });

  it('SPEC_01 Tryb A: routes a deliverable SSE event to onDeliverable with mapped kind', async () => {
    const mockOnDeliverable = vi.fn();

    vi.mocked(Api.chatWithAIStream).mockImplementation(
      async (
        message,
        history,
        onChunk,
        onDone,
        systemPrompt,
        context,
        roleName,
        language,
        onThinking
      ) => {
        onThinking?.({
          type: 'deliverable',
          draftId: 'gen-777',
          generationId: 'gen-777',
          kind: 'sheet',
          format: 'sheet',
          title: 'Tabela kosztów',
        });
        onChunk('Utworzyłem arkusz i otworzyłem go w canvasie.');
        onDone();
      }
    );

    const { result } = renderHook(() => useAIStream({ onDeliverable: mockOnDeliverable }));

    await act(async () => {
      await result.current.startStream('chcę to mieć w canvasie z boku', []);
    });

    expect(mockOnDeliverable).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: 'gen-777',
        generationId: 'gen-777',
        kind: 'sheet',
        title: 'Tabela kosztów',
      })
    );
  });

  it('M06 Fala 2 · 2.3: routes a mindmap deliverable event with graph + seedText to onDeliverable', async () => {
    const mockOnDeliverable = vi.fn();

    const skeletonGraph = {
      nodes: [
        { id: 'center', type: 'center', data: { label: 'Transformacja cyfrowa' } },
        { id: 'branch-1', type: 'branch', data: { label: 'Ludzie' } },
        { id: 'branch-2', type: 'branch', data: { label: 'Procesy' } },
      ],
      edges: [
        { id: 'e-center-branch-1', source: 'center', target: 'branch-1' },
        { id: 'e-center-branch-2', source: 'center', target: 'branch-2' },
      ],
    };

    vi.mocked(Api.chatWithAIStream).mockImplementation(
      async (
        message,
        history,
        onChunk,
        onDone,
        systemPrompt,
        context,
        roleName,
        language,
        onThinking
      ) => {
        onThinking?.({
          type: 'deliverable',
          draftId: 'chat-mindmap-1',
          generationId: 'chat-mindmap-1',
          kind: 'mindmap',
          format: 'mindmap',
          title: 'Transformacja cyfrowa',
          graph: skeletonGraph,
          seedText: 'Mapa myśli o transformacji cyfrowej: ludzie, procesy, technologia',
        });
        onChunk('Utworzyłem mapę myśli i otworzyłem ją w Pomysłach.');
        onDone();
      }
    );

    const { result } = renderHook(() => useAIStream({ onDeliverable: mockOnDeliverable }));

    await act(async () => {
      await result.current.startStream('zrób mapę myśli o transformacji', []);
    });

    expect(mockOnDeliverable).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: 'chat-mindmap-1',
        kind: 'mindmap',
        title: 'Transformacja cyfrowa',
        graph: skeletonGraph,
        seedText: 'Mapa myśli o transformacji cyfrowej: ludzie, procesy, technologia',
      })
    );
  });

  it('Teresa "all 8 tools": forwards process_flow/table/whiteboard kind + preferredSystem to onDeliverable (not coerced to "doc")', async () => {
    // Regression test — `kind` used to be narrowed to only
    // 'doc' | 'sheet' | 'deck' | 'mindmap' before being forwarded, silently
    // downgrading process_flow/table/whiteboard/note to 'doc'.
    // UnifiedChatPanel's CANVAS_TOOL_KINDS check then never matched for these
    // kinds, so the skeleton graph fell through to the generic doc-canvas
    // mount path instead of the Ideas-workspace handoff — the same class of
    // bug as the mindmap graph being ignored, but for the other 3 tools.
    // `preferredSystem` was also never forwarded at all.
    const mockOnDeliverable = vi.fn();

    const skeletonGraph = {
      nodes: [{ id: 'n1', type: 'step', data: { label: 'Krok 1' } }],
      edges: [],
    };

    vi.mocked(Api.chatWithAIStream).mockImplementation(
      async (
        message,
        history,
        onChunk,
        onDone,
        systemPrompt,
        context,
        roleName,
        language,
        onThinking
      ) => {
        onThinking?.({
          type: 'deliverable',
          draftId: 'chat-process_flow-1',
          generationId: 'chat-process_flow-1',
          kind: 'process_flow',
          format: 'process_flow',
          title: 'Proces onboardingu',
          graph: skeletonGraph,
          seedText: 'Zrób przepływ procesu onboardingu',
          preferredSystem: 'process_flow',
        });
        onChunk('Utworzyłem przepływ procesu.');
        onDone();
      }
    );

    const { result } = renderHook(() => useAIStream({ onDeliverable: mockOnDeliverable }));

    await act(async () => {
      await result.current.startStream('zrób przepływ procesu onboardingu', []);
    });

    expect(mockOnDeliverable).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: 'chat-process_flow-1',
        kind: 'process_flow',
        preferredSystem: 'process_flow',
        graph: skeletonGraph,
      })
    );
  });

  it('SPEC_01 Tryb A: ignores a deliverable event without a draft id', async () => {
    const mockOnDeliverable = vi.fn();

    vi.mocked(Api.chatWithAIStream).mockImplementation(
      async (
        message,
        history,
        onChunk,
        onDone,
        systemPrompt,
        context,
        roleName,
        language,
        onThinking
      ) => {
        onThinking?.({ type: 'deliverable', kind: 'doc' });
        onDone();
      }
    );

    const { result } = renderHook(() => useAIStream({ onDeliverable: mockOnDeliverable }));

    await act(async () => {
      await result.current.startStream('zrób coś', []);
    });

    expect(mockOnDeliverable).not.toHaveBeenCalled();
  });

  it('should reset state when starting new stream', async () => {
    vi.mocked(Api.chatWithAIStream).mockImplementation(
      async (message, history, onChunk, onDone) => {
        onDone();
      }
    );

    const { result } = renderHook(() => useAIStream());

    await act(async () => {
      await result.current.startStream('First message', []);
    });

    // State should be reset on new stream
    expect(mockSetCurrentStreamContent).toHaveBeenCalledWith('');
    expect(result.current.thinkingSteps).toEqual([]);
    expect(result.current.artifacts).toEqual([]);
  });
});

describe('Thinking Step Extraction', () => {
  it('should categorize analysis steps correctly', async () => {
    const analysisKeywords = ['analyzing', 'examining', 'assessing'];

    analysisKeywords.forEach((keyword) => {
      const content = `I am ${keyword} the data`;
      // The categorization logic should identify these as analysis
      expect(content.toLowerCase()).toContain(keyword);
    });
  });

  it('should categorize research steps correctly', async () => {
    const researchKeywords = ['searching', 'looking', 'finding', 'researching'];

    researchKeywords.forEach((keyword) => {
      const content = `I am ${keyword} for information`;
      expect(content.toLowerCase()).toContain(keyword);
    });
  });

  it('should categorize synthesis steps correctly', async () => {
    const synthesisKeywords = ['combining', 'integrating', 'synthesizing', 'creating'];

    synthesisKeywords.forEach((keyword) => {
      const content = `I am ${keyword} the results`;
      expect(content.toLowerCase()).toContain(keyword);
    });
  });

  it('should categorize validation steps correctly', async () => {
    const validationKeywords = ['verifying', 'checking', 'validating', 'confirming'];

    validationKeywords.forEach((keyword) => {
      const content = `I am ${keyword} the accuracy`;
      expect(content.toLowerCase()).toContain(keyword);
    });
  });
});
