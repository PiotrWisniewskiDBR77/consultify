import { useCallback, useEffect, useRef, useState } from 'react';

import { Api } from '@/services/api';

import { useAppStore } from '../store/useAppStore';
import { parseArtifactsFromResponse, useArtifactsStore } from '../store/useArtifactsStore';
import { Artifact, FocusMode, ThinkingStep } from '../types';

// ==================== TTS UTILITIES ====================

/**
 * Clean text for TTS (remove markdown, code blocks, etc.)
 */
const cleanTextForTTS = (text: string): string => {
  return (
    text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`[^`]+`/g, '')
      // Remove markdown headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic markers
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove bullet points
      .replace(/^[-*+]\s+/gm, '')
      // Remove numbered lists markers
      .replace(/^\d+\.\s+/gm, '')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
};

// ==================== THINKING EXTRACTION UTILITIES ====================

/**
 * Categorize a thinking step based on its content
 */
function categorizeThinkingStep(stepContent: string): ThinkingStep['category'] {
  const lower = stepContent.toLowerCase();

  if (lower.includes('analyz') || lower.includes('examin') || lower.includes('assess')) {
    return 'analysis';
  }
  if (
    lower.includes('search') ||
    lower.includes('look') ||
    lower.includes('find') ||
    lower.includes('research')
  ) {
    return 'research';
  }
  if (
    lower.includes('combin') ||
    lower.includes('integrat') ||
    lower.includes('synthesiz') ||
    lower.includes('creat')
  ) {
    return 'synthesis';
  }
  if (
    lower.includes('verify') ||
    lower.includes('check') ||
    lower.includes('valid') ||
    lower.includes('confirm')
  ) {
    return 'validation';
  }

  return 'analysis'; // Default
}

/**
 * Extract thinking steps from AI response content
 */
function extractThinkingSteps(content: string): {
  cleanContent: string;
  thinkingSteps: ThinkingStep[];
} {
  if (!content) return { cleanContent: '', thinkingSteps: [] };

  const thinkingSteps: ThinkingStep[] = [];
  let stepId = 1;

  // Pattern for <thinking>...</thinking> blocks
  const thinkingPattern = /<thinking>([\s\S]*?)<\/thinking>/gi;

  let match;
  while ((match = thinkingPattern.exec(content)) !== null) {
    const thinkingContent = match[1].trim();

    // Split into individual steps if numbered or bulleted
    const stepLines = thinkingContent.split(/\n(?=\d+\.|[-*•])/);

    stepLines.forEach((line) => {
      const cleanLine = line.replace(/^\d+\.\s*|^[-*•]\s*/, '').trim();
      if (cleanLine) {
        thinkingSteps.push({
          id: `think-${stepId++}`,
          label: `Step ${thinkingSteps.length + 1}`,
          content: cleanLine,
          status: 'done',
          timestamp: new Date(),
          category: categorizeThinkingStep(cleanLine),
        });
      }
    });
  }

  // Remove thinking blocks from content
  const cleanContent = content.replace(thinkingPattern, '').trim();

  return { cleanContent, thinkingSteps };
}

// ==================== INTERFACES ====================

interface UseAIStreamOptions {
  onStreamDone?: (fullText: string, thinkingSteps?: ThinkingStep[], artifacts?: Artifact[]) => void;
  onStreamError?: (error: any) => void;
  onThinkingUpdate?: (steps: ThinkingStep[]) => void;
  onArtifactDetected?: (artifact: Artifact) => void;
  /** Called when stream can be resumed (on disconnect) */
  onCanResume?: (sessionId: string, partialContent: string) => void;
}

interface StreamState {
  isStreaming: boolean;
  streamedContent: string;
  thinkingSteps: ThinkingStep[];
  artifacts: Artifact[];
  progress: number; // 0-100 for UI progress indicator
}

interface PartialResponse {
  sessionId: string;
  content: string;
  updatedAt: string;
  canResume: boolean;
}

// ==================== HOOK ====================

export const useAIStream = (options: UseAIStreamOptions = {}) => {
  const {
    updateLastChatMessage,
    setIsBotTyping,
    setCurrentStreamContent,
    currentStreamContent,
    isBotTyping,
    aiConfig,
  } = useAppStore();

  const { addArtifact } = useArtifactsStore();

  // Enhanced state tracking
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [streamArtifacts, setStreamArtifacts] = useState<Artifact[]>([]);
  const [streamProgress, setStreamProgress] = useState(0);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [canResume, setCanResume] = useState(false);

  // Refs for accumulation to avoid stale closures
  const contentRef = useRef('');
  const thinkingRef = useRef<ThinkingStep[]>([]);
  const artifactsRef = useRef<Artifact[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthesisRef.current = window.speechSynthesis;
    }
  }, []);

  // Get current language
  const currentLanguage = localStorage.getItem('i18nextLng') || 'pl';

  /**
   * Process incoming chunk for thinking steps and artifacts
   */
  const processChunk = useCallback(
    (chunk: string): string => {
      // Check for thinking block markers
      const fullContent = contentRef.current + chunk;

      // Try to extract thinking steps from accumulated content
      const { cleanContent, thinkingSteps: extractedSteps } = extractThinkingSteps(fullContent);

      if (extractedSteps.length > thinkingRef.current.length) {
        thinkingRef.current = extractedSteps;
        setThinkingSteps(extractedSteps);
        if (options.onThinkingUpdate) {
          options.onThinkingUpdate(extractedSteps);
        }
      }

      // Check for artifact markers
      const newArtifacts = parseArtifactsFromResponse(fullContent);
      if (newArtifacts.length > artifactsRef.current.length) {
        const addedArtifacts = newArtifacts.slice(artifactsRef.current.length);
        artifactsRef.current = newArtifacts;
        setStreamArtifacts(newArtifacts);

        // Notify about new artifacts
        addedArtifacts.forEach((artifact) => {
          addArtifact(artifact);
          if (options.onArtifactDetected) {
            options.onArtifactDetected(artifact);
          }
        });
      }

      // Return the chunk (possibly cleaned of thinking markers for display)
      return chunk;
    },
    [options, addArtifact]
  );

  /**
   * Process thinking event from backend
   */
  const processThought = useCallback(
    (thought: any) => {
      const step: ThinkingStep = {
        id: thought.id || `think-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        label: thought.detail || capitalize(thought.stage),
        content: thought.detail,
        status: 'done',
        timestamp: new Date(thought.timestamp),
        category: thought.stage || 'analysis',
      };

      thinkingRef.current = [...thinkingRef.current, step];
      setThinkingSteps(thinkingRef.current);
      if (options.onThinkingUpdate) {
        options.onThinkingUpdate(thinkingRef.current);
      }
    },
    [options]
  );

  function capitalize(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  /**
   * Speak text using Web Speech API
   */
  const speakText = useCallback(
    (text: string) => {
      if (!synthesisRef.current || !aiConfig.textToSpeech) return;

      // Cancel any ongoing speech
      synthesisRef.current.cancel();

      // Clean text for better TTS output
      const cleanedText = cleanTextForTTS(text);
      if (!cleanedText) return;

      const utterance = new SpeechSynthesisUtterance(cleanedText);

      // Get voices and find the best match
      const voices = synthesisRef.current.getVoices();

      // If user selected a voice, use it
      if (aiConfig.ttsVoice) {
        const selectedVoice = voices.find((v) => v.voiceURI === aiConfig.ttsVoice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          utterance.lang = selectedVoice.lang;
        }
      } else {
        // Auto-detect Polish or use default
        const polishChars = (text.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length;
        const isPolish = polishChars > 2;

        if (isPolish) {
          const polishVoice = voices.find((v) => v.lang.startsWith('pl'));
          if (polishVoice) {
            utterance.voice = polishVoice;
            utterance.lang = 'pl-PL';
          }
        } else {
          const englishVoice = voices.find((v) => v.lang.startsWith('en'));
          if (englishVoice) {
            utterance.voice = englishVoice;
            utterance.lang = 'en-US';
          }
        }
      }

      // Apply rate and pitch from config
      utterance.rate = aiConfig.ttsRate ?? 1.0;
      utterance.pitch = aiConfig.ttsPitch ?? 1.0;
      utterance.volume = 1.0;

      // Start speaking
      synthesisRef.current.speak(utterance);
      console.log('[TTS] Speaking response...');
    },
    [aiConfig.textToSpeech, aiConfig.ttsVoice, aiConfig.ttsRate, aiConfig.ttsPitch]
  );

  /**
   * Start streaming with enhanced features
   */
  const startStream = useCallback(
    async (
      userMessage: string,
      history: any[],
      systemPrompt?: string,
      context?: any,
      focusMode?: FocusMode,
      overrideOptions?: any
    ) => {
      // Merge hook options with override options
      const effectiveOptions = { ...options, ...overrideOptions };

      // Reset state
      setIsBotTyping(true);
      setCurrentStreamContent('');
      setThinkingSteps([]);
      setStreamArtifacts([]);
      setStreamProgress(0);
      contentRef.current = '';
      thinkingRef.current = [];
      artifactsRef.current = [];

      // Build AI options from global config
      const aiOptions = {
        deepResearch: aiConfig.deepResearch,
        webSearch: aiConfig.webSearch,
        showReasoning: aiConfig.showReasoning || aiConfig.maxMode,
        knowledgeSources: aiConfig.knowledgeSources,
        responseStyle: aiConfig.responseStyle || 'normal',
        ...overrideOptions,
      };

      console.log('[useAIStream] Starting with AI config:', {
        deepResearch: aiOptions.deepResearch,
        webSearch: aiOptions.webSearch,
        showReasoning: aiOptions.showReasoning,
        knowledgeSources: aiOptions.knowledgeSources,
        responseStyle: aiOptions.responseStyle,
      });

      try {
        await Api.chatWithAIStream(
          userMessage,
          history,
          (chunk) => {
            // Process chunk for structured content
            processChunk(chunk);

            // Accumulate raw content
            contentRef.current += chunk;
            setCurrentStreamContent(contentRef.current);

            // Update progress estimate
            const estimatedTotal = 2000;
            const progress = Math.min(95, (contentRef.current.length / estimatedTotal) * 100);
            setStreamProgress(progress);
          },
          () => {
            setIsBotTyping(false);
            setStreamProgress(100);

            // Final extraction
            const { cleanContent, thinkingSteps: finalThinking } = extractThinkingSteps(
              contentRef.current
            );
            const finalArtifacts = parseArtifactsFromResponse(contentRef.current);

            // Update store
            updateLastChatMessage(cleanContent || contentRef.current);

            // Text-to-Speech: Read the response aloud if enabled
            if (aiConfig.textToSpeech) {
              speakText(cleanContent || contentRef.current);
            }

            // Callback
            if (effectiveOptions.onStreamDone) {
              effectiveOptions.onStreamDone(
                cleanContent || contentRef.current,
                // Merge backend steps with extracted text steps if needed
                [...thinkingRef.current, ...finalThinking],
                finalArtifacts.length > 0 ? finalArtifacts : undefined
              );
            }

            setCurrentStreamContent('');
          },
          systemPrompt,
          { ...context, focusMode },
          undefined,
          currentLanguage,
          // Pass the thinking handler
          processThought,
          aiOptions // Pass AI configuration to API
        );
      } catch (error) {
        console.error('AI Stream Error:', error);
        setIsBotTyping(false);
        setStreamProgress(0);

        if (effectiveOptions.onStreamError) effectiveOptions.onStreamError(error);

        if (!contentRef.current) {
          updateLastChatMessage('Sorry, I encountered an error. Please try again.');
        }
        setCurrentStreamContent('');
      }
    },
    [
      updateLastChatMessage,
      setIsBotTyping,
      setCurrentStreamContent,
      processChunk,
      processThought,
      speakText,
      options,
      currentLanguage,
      aiConfig,
    ]
  );

  /**
   * Stop TTS playback
   */
  const stopTTS = useCallback(() => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
    }
  }, []);

  /**
   * Abort current stream
   */
  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Stop any TTS playback
    stopTTS();
    setIsBotTyping(false);
    setCurrentStreamContent('');
    setStreamProgress(0);

    // Mark as resumable if we have content
    if (contentRef.current.length > 0 && lastSessionId) {
      setCanResume(true);
      if (options.onCanResume) {
        options.onCanResume(lastSessionId, contentRef.current);
      }
    }
  }, [setIsBotTyping, setCurrentStreamContent, lastSessionId, options]);

  /**
   * Check if partial response exists for a session
   */
  const checkPartialResponse = useCallback(
    async (sessionId: string): Promise<PartialResponse | null> => {
      try {
        const response = await fetch(`/api/ai/stream/partial/${sessionId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (response.ok) {
          return await response.json();
        }
        return null;
      } catch (error) {
        console.warn('[useAIStream] Failed to check partial response:', error);
        return null;
      }
    },
    []
  );

  /**
   * Resume from a partial response
   */
  const resumeFromPartial = useCallback(
    async (
      sessionId: string,
      userMessage: string,
      history: any[],
      systemPrompt?: string,
      context?: any,
      focusMode?: FocusMode
    ) => {
      // First, check if we have a partial response
      const partial = await checkPartialResponse(sessionId);

      if (partial && partial.canResume) {
        // Initialize with partial content
        contentRef.current = partial.content;
        setCurrentStreamContent(partial.content);

        console.log('[useAIStream] Resuming from partial:', {
          sessionId,
          contentLength: partial.content.length,
        });
      }

      // Continue the stream with resumeFromPartial flag
      return startStream(
        userMessage,
        history,
        systemPrompt,
        {
          ...context,
          conversationId: sessionId,
          resumeFromPartial: true,
        },
        focusMode
      );
    },
    [checkPartialResponse, startStream, setCurrentStreamContent]
  );

  return {
    // Basic state
    isStreaming: isBotTyping,
    streamedContent: currentStreamContent,

    // Enhanced state (World-Class Chat 2025)
    thinkingSteps,
    artifacts: streamArtifacts,
    progress: streamProgress,

    // Reconnection state
    lastSessionId,
    canResume,

    // Actions
    startStream,
    abortStream,
    resumeFromPartial,
    checkPartialResponse,
    stopTTS,
  };
};
