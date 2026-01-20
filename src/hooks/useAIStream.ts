import { useCallback, useRef, useState } from 'react';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { parseArtifactsFromResponse, useArtifactsStore } from '@/store/useArtifactsStore';

type StreamOptions = {
  onStreamDone?: (fullText: string, thinking: unknown[], artifacts: unknown[]) => void;
  onStreamError?: (error: Error) => void;
  onThinkingUpdate?: (steps: unknown[]) => void;
  onArtifactDetected?: (artifact: unknown) => void;
};

type PartialResponse = {
  sessionId: string;
  content: string;
  canResume?: boolean;
};

export const useAIStream = (options: StreamOptions = {}) => {
  const {
    updateLastChatMessage,
    setIsBotTyping,
    setCurrentStreamContent,
    aiConfig,
  } = useAppStore();
  const { addArtifact } = useArtifactsStore();

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [thinkingSteps, setThinkingSteps] = useState<unknown[]>([]);
  const [artifacts, setArtifacts] = useState<unknown[]>([]);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef({ aborted: false });

  const resetStreamState = useCallback(() => {
    setStreamedContent('');
    setThinkingSteps([]);
    setArtifacts([]);
    setProgress(0);
    setCurrentStreamContent('');
  }, [setCurrentStreamContent]);

  const startStream = useCallback(
    async (
      message: string,
      history: any[] = [],
      systemPrompt?: string,
      context?: Record<string, unknown>,
      focusMode?: string,
      roleName?: string,
      language?: string
    ) => {
      abortRef.current.aborted = false;
      setIsStreaming(true);
      setIsBotTyping(true);
      resetStreamState();

      let fullText = '';
      const currentThinking: unknown[] = [];
      let step = 0;

      const handleChunk = (chunk: string) => {
        if (abortRef.current.aborted) return;

        const thinkingMatches = Array.from(chunk.matchAll(/<thinking>([\s\S]*?)<\/thinking>/g));
        if (thinkingMatches.length > 0) {
          thinkingMatches.forEach((match) => {
            const content = match[1]?.trim();
            if (content) {
              currentThinking.push({ id: `${Date.now()}-${currentThinking.length}`, content });
            }
          });

          const cleaned = chunk.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
          if (cleaned) {
            fullText += cleaned;
          }
          setThinkingSteps([...currentThinking]);
          options.onThinkingUpdate?.([...currentThinking]);
        } else {
          fullText += chunk;
        }

        setStreamedContent(fullText);
        setCurrentStreamContent(fullText);

        step += 1;
        setProgress((prev) => Math.min(95, Math.max(prev, step * 5)));
      };

      const handleDone = () => {
        if (abortRef.current.aborted) return;
        setIsStreaming(false);
        setIsBotTyping(false);
        setProgress(100);

        const parsedArtifacts = parseArtifactsFromResponse(fullText);
        if (parsedArtifacts.length) {
          parsedArtifacts.forEach((artifact) => {
            addArtifact(artifact);
            options.onArtifactDetected?.(artifact);
          });
          setArtifacts(parsedArtifacts);
        }

        updateLastChatMessage?.(fullText);
        options.onStreamDone?.(fullText, currentThinking, parsedArtifacts);
      };

      try {
        const mergedContext = focusMode ? { ...(context || {}), focusMode } : context;
        await Api.chatWithAIStream(
          message,
          history,
          handleChunk,
          handleDone,
          systemPrompt,
          mergedContext,
          roleName,
          language,
          undefined,
          {
            deepResearch: aiConfig?.deepResearch,
            webSearch: aiConfig?.webSearch,
            showReasoning: aiConfig?.showReasoning,
            knowledgeSources: aiConfig?.knowledgeSources,
            responseStyle: aiConfig?.responseStyle,
          }
        );
      } catch (error) {
        setIsStreaming(false);
        setIsBotTyping(false);
        options.onStreamError?.(error as Error);
      }
    },
    [
      aiConfig,
      addArtifact,
      options,
      resetStreamState,
      setCurrentStreamContent,
      setIsBotTyping,
      updateLastChatMessage,
    ]
  );

  const abortStream = useCallback(() => {
    abortRef.current.aborted = true;
    setIsStreaming(false);
    setIsBotTyping(false);
    resetStreamState();
  }, [resetStreamState, setIsBotTyping]);

  const checkPartialResponse = useCallback(async (sessionId: string): Promise<PartialResponse | null> => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/ai/stream/partial/${sessionId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as PartialResponse;
    } catch (error) {
      return null;
    }
  }, []);

  const resumeFromPartial = useCallback(
    async (
      sessionId: string,
      message: string,
      history: any[] = [],
      systemPrompt?: string,
      context?: Record<string, unknown>,
      focusMode?: string
    ) => {
      await startStream(message, history, systemPrompt, { ...context, sessionId, resumeFromPartial: true }, focusMode);
    },
    [startStream]
  );

  return {
    startStream,
    abortStream,
    resumeFromPartial,
    checkPartialResponse,
    isStreaming,
    streamedContent,
    thinkingSteps,
    artifacts,
    progress,
  };
};
