import { useCallback, useRef, useState } from 'react';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { parseArtifactsFromResponse, useArtifactsStore } from '@/store/useArtifactsStore';
import type { Artifact, ThinkingStep } from '@/types';

/**
 * Build localized thinking step labels for Cursor-like AI thinking indicator.
 * Uses natural, conversational phrases that change as the AI processes.
 */
function buildDefaultThinkingSteps(language: string): ThinkingStep[] {
  const lang = (language || 'en').split('-')[0];

  // Multiple phrase variants for more natural feel - randomly selected
  const labelVariants: Record<
    string,
    {
      analyzing: string[];
      context: string[];
      planning: string[];
      validating: string[];
      composing: string[];
    }
  > = {
    pl: {
      analyzing: [
        'Analizuję Twoje pytanie…',
        'Rozważam Twoje zapytanie…',
        'Myślę nad tym…',
        'Przygotowuję się…',
      ],
      context: [
        'Zbieram kontekst…',
        'Szukam powiązań…',
        'Przeglądam informacje…',
        'Gromadzę wiedzę…',
      ],
      planning: ['Układam plan odpowiedzi…', 'Porządkuję wątki…', 'Wybieram podejście…'],
      validating: ['Sprawdzam spójność…', 'Weryfikuję szczegóły…', 'Dopinam odpowiedź…'],
      composing: ['Piszę odpowiedź…', 'Składam wszystko w całość…', 'Kończę i dopracowuję…'],
    },
    en: {
      analyzing: [
        'Analyzing your question…',
        'Thinking about this…',
        'Processing your request…',
        'Understanding the context…',
      ],
      context: [
        'Gathering context…',
        'Searching for connections…',
        'Reviewing information…',
        'Collecting insights…',
      ],
      planning: ['Planning the response…', 'Organizing the key points…', 'Choosing an approach…'],
      validating: ['Checking for consistency…', 'Verifying details…', 'Sanity-checking…'],
      composing: ['Composing the answer…', 'Putting it all together…', 'Polishing…'],
    },
    de: {
      analyzing: [
        'Ich analysiere deine Frage…',
        'Ich denke darüber nach…',
        'Bearbeite deine Anfrage…',
      ],
      context: ['Ich sammle Kontext…', 'Suche nach Zusammenhängen…', 'Überprüfe Informationen…'],
      planning: ['Ich plane die Antwort…', 'Ordne die Punkte…', 'Wähle ein Vorgehen…'],
      validating: ['Prüfe die Konsistenz…', 'Verifiziere Details…', 'Gegencheck…'],
      composing: ['Formuliere die Antwort…', 'Setze alles zusammen…', 'Finalisiere…'],
    },
    es: {
      analyzing: ['Analizando tu pregunta…', 'Pensando en esto…', 'Procesando tu solicitud…'],
      context: ['Recopilando contexto…', 'Buscando conexiones…', 'Revisando información…'],
      planning: ['Planificando la respuesta…', 'Organizando puntos clave…', 'Eligiendo enfoque…'],
      validating: ['Verificando coherencia…', 'Revisando detalles…', 'Comprobando…'],
      composing: ['Redactando la respuesta…', 'Uniendo todo…', 'Finalizando…'],
    },
    ar: {
      analyzing: ['أحلّل سؤالك…', 'أفكر في هذا…'],
      context: ['أجمع السياق…', 'أبحث عن المعلومات…'],
      planning: ['أخطط للإجابة…', 'أنظم الأفكار…'],
      validating: ['أتحقق من الاتساق…', 'أراجع التفاصيل…'],
      composing: ['أصوغ الإجابة…', 'أجهّز الرد…'],
    },
    ja: {
      analyzing: ['質問を分析しています…', '考えています…'],
      context: ['コンテキストを収集中…', '情報を確認中…'],
      planning: ['回答の方針を整理中…', 'ポイントをまとめています…'],
      validating: ['整合性を確認中…', '詳細をチェック中…'],
      composing: ['回答を作成中…', '仕上げ中…'],
    },
  };

  const variants = labelVariants[lang] || labelVariants.en;
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  const now = new Date();
  return [
    {
      id: `think-1-${now.getTime()}`,
      label: pick(variants.analyzing),
      content: '',
      status: 'in_progress' as const,
      timestamp: now,
      category: 'analysis',
    },
    {
      id: `think-2-${now.getTime()}`,
      label: pick(variants.context),
      content: '',
      status: 'pending' as const,
      timestamp: now,
      category: 'research',
    },
    {
      id: `think-3-${now.getTime()}`,
      label: pick(variants.planning),
      content: '',
      status: 'pending' as const,
      timestamp: now,
      category: 'synthesis',
    },
    {
      id: `think-4-${now.getTime()}`,
      label: pick(variants.validating),
      content: '',
      status: 'pending' as const,
      timestamp: now,
      category: 'validation',
    },
    {
      id: `think-5-${now.getTime()}`,
      label: pick(variants.composing),
      content: '',
      status: 'pending' as const,
      timestamp: now,
      category: 'synthesis',
    },
  ];
}

/**
 * Advance thinking steps based on stream progress.
 * Uses smoother phase transitions for more natural feel.
 */
function advanceThinkingSteps(steps: ThinkingStep[], progressPct: number): ThinkingStep[] {
  const next = steps.map((s) => ({ ...s }));
  const p = Math.max(0, Math.min(100, progressPct));
  const total = Math.max(1, next.length);
  // Map progress 0..100 -> phase 0..(total-1)
  const phase = Math.min(total - 1, Math.floor((p / 100) * total));

  next.forEach((s, idx) => {
    if (idx < phase) s.status = 'done';
    else if (idx === phase) s.status = 'in_progress';
    else s.status = 'pending';
  });

  return next;
}

/**
 * Get the current thinking label from steps (for UI display)
 */
export function getCurrentThinkingLabel(steps: ThinkingStep[]): string {
  return (
    steps.find((s) => s.status === 'in_progress')?.label ||
    steps.find((s) => s.status === 'pending')?.label ||
    ''
  );
}

type StreamOptions = {
  onStreamDone?: (fullText: string, thinking: ThinkingStep[], artifacts: Artifact[]) => void;
  onStreamError?: (error: Error) => void;
  onThinkingUpdate?: (steps: ThinkingStep[]) => void;
  onArtifactDetected?: (artifact: Artifact) => void;
};

type DeepThinkingStateEvent = {
  type: 'dt_state';
  state: 'research_visibility' | 'research' | 'thinking' | 'synthesis' | 'closure' | string;
  label?: string;
};

type ResearchProgressEvent = {
  type: 'research_progress';
  topic: string;
  stage: string;
  queries: any[];
  sources?: any[];
  error?: string;
};

type ResearchVisibilityEvent = {
  type: 'research_visibility';
  items: Array<{
    id: string;
    type: string;
    label: string;
    rationale?: string;
    status: 'planned' | 'checking' | 'validated' | 'discarded';
  }>;
};

type PartialResponse = {
  sessionId: string;
  content: string;
  canResume?: boolean;
};

export const useAIStream = (options: StreamOptions = {}) => {
  const { updateLastChatMessage, setIsBotTyping, setCurrentStreamContent, aiConfig } =
    useAppStore();
  const { addArtifact } = useArtifactsStore();

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [deepThinkingState, setDeepThinkingState] = useState<DeepThinkingStateEvent | null>(null);
  const [researchProgress, setResearchProgress] = useState<ResearchProgressEvent | null>(null);
  const [researchVisibility, setResearchVisibility] = useState<ResearchVisibilityEvent | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef({ aborted: false });
  const thinkingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const thinkingClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetStreamState = useCallback(() => {
    setStreamedContent('');
    setThinkingSteps([]);
    setDeepThinkingState(null);
    setResearchProgress(null);
    setResearchVisibility(null);
    setArtifacts([]);
    setProgress(0);
    setCurrentStreamContent('');
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }
    if (thinkingClearTimeoutRef.current) {
      clearTimeout(thinkingClearTimeoutRef.current);
      thinkingClearTimeoutRef.current = null;
    }
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
      let currentThinking: ThinkingStep[] = buildDefaultThinkingSteps(language || '');
      let step = 0;
      let hasReceivedContent = false;
      let thinkingProgress = 0;
      const isDeepThinking = aiConfig?.deepResearch === true;

      // Make "LLM is working" visible immediately (Cursor-like)
      setThinkingSteps([...currentThinking]);
      options.onThinkingUpdate?.([...currentThinking]);

      // Keep the UI "alive" even before first chunk arrives.
      // This is not model chain-of-thought; it's a UX progress narration.
      if (thinkingIntervalRef.current) clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = setInterval(() => {
        if (abortRef.current.aborted || hasReceivedContent) {
          if (thinkingIntervalRef.current) clearInterval(thinkingIntervalRef.current);
          thinkingIntervalRef.current = null;
          return;
        }
        // Smooth-ish progress with small random increments, capped before "done"
        const bump = 3 + Math.random() * 5;
        thinkingProgress = Math.min(92, thinkingProgress + bump);
        setProgress(Math.floor(thinkingProgress));
        currentThinking = advanceThinkingSteps(currentThinking, thinkingProgress);
        setThinkingSteps([...currentThinking]);
        options.onThinkingUpdate?.([...currentThinking]);
      }, 350);

      const handleChunk = (chunk: string) => {
        if (abortRef.current.aborted) return;

        // Strip any <thinking> tags if present (legacy support)
        const thinkingMatches = Array.from(chunk.matchAll(/<thinking>([\s\S]*?)<\/thinking>/g));
        let cleanedChunk = chunk;
        if (thinkingMatches.length > 0) {
          cleanedChunk = chunk.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
        }

        // Add to full text
        if (cleanedChunk) {
          fullText += cleanedChunk;
        }

        setStreamedContent(fullText);
        setCurrentStreamContent(fullText);

        // When first real content arrives, mark thinking steps done, but keep them visible briefly.
        // This prevents the "blink and gone" effect on fast streams and shows a clearer flow.
        if (fullText.trim().length > 0 && !hasReceivedContent) {
          hasReceivedContent = true;
          // In Deep Thinking, we keep the state steps visible (they represent the process),
          // otherwise we clear them quickly for a clean chat UX.
          if (!isDeepThinking) {
            currentThinking = currentThinking.map((s) => ({ ...s, status: 'done' as const }));
            setThinkingSteps([...currentThinking]);
            options.onThinkingUpdate?.([...currentThinking]);
          }

          if (thinkingIntervalRef.current) {
            clearInterval(thinkingIntervalRef.current);
            thinkingIntervalRef.current = null;
          }

          if (!isDeepThinking) {
            if (thinkingClearTimeoutRef.current) clearTimeout(thinkingClearTimeoutRef.current);
            thinkingClearTimeoutRef.current = setTimeout(() => {
              setThinkingSteps([]);
              options.onThinkingUpdate?.([]);
            }, 1200);
          }
        }

        // Update progress for the actual content streaming
        step += 1;
        setProgress(Math.min(99, 50 + step * 2));
      };

      const handleDone = () => {
        if (abortRef.current.aborted) return;
        setIsStreaming(false);
        setIsBotTyping(false);
        setProgress(100);

        if (thinkingIntervalRef.current) {
          clearInterval(thinkingIntervalRef.current);
          thinkingIntervalRef.current = null;
        }
        if (thinkingClearTimeoutRef.current) {
          clearTimeout(thinkingClearTimeoutRef.current);
          thinkingClearTimeoutRef.current = null;
        }

        // Ensure non-deep thinking steps are cleared
        if (!isDeepThinking) {
          setThinkingSteps([]);
          options.onThinkingUpdate?.([]);
        }

        // Parse any artifacts from the response
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

      const handleEvent = (evt: any) => {
        if (abortRef.current.aborted) return;
        if (!evt || typeof evt !== 'object') return;

        // Deep Thinking state
        if (evt.type === 'dt_state') {
          const e = evt as DeepThinkingStateEvent;
          setDeepThinkingState(e);

          // Map state -> steps shown in ThinkingBlock
          const now = new Date();
          const steps: ThinkingStep[] = [
            {
              id: `dt-research-${now.getTime()}`,
              label:
                e.state === 'research_visibility'
                  ? e.label || 'Research visibility'
                  : 'Research visibility',
              content: '',
              status:
                e.state === 'research_visibility'
                  ? ('in_progress' as const)
                  : ('done' as const),
              timestamp: now,
              category: 'research',
            },
            {
              id: `dt-reason-${now.getTime()}`,
              label: e.state === 'research' ? e.label || 'Research' : 'Research',
              content: '',
              status:
                e.state === 'research'
                  ? ('in_progress' as const)
                  : e.state === 'thinking' ||
                      e.state === 'synthesis' ||
                      e.state === 'closure'
                    ? ('done' as const)
                    : ('pending' as const),
              timestamp: now,
              category: 'research',
            },
            {
              id: `dt-thinking-${now.getTime()}`,
              label: e.state === 'thinking' ? e.label || 'Thinking' : 'Thinking',
              content: '',
              status:
                e.state === 'thinking'
                  ? ('in_progress' as const)
                  : e.state === 'synthesis' || e.state === 'closure'
                    ? ('done' as const)
                    : ('pending' as const),
              timestamp: now,
              category: 'analysis',
            },
            {
              id: `dt-synthesis-${now.getTime()}`,
              label: e.state === 'synthesis' ? e.label || 'Synthesis' : 'Synthesis',
              content: '',
              status:
                e.state === 'synthesis'
                  ? ('in_progress' as const)
                  : e.state === 'closure'
                    ? ('done' as const)
                    : ('pending' as const),
              timestamp: now,
              category: 'synthesis',
            },
            {
              id: `dt-closure-${now.getTime()}`,
              label: e.state === 'closure' ? e.label || 'Closure' : 'Closure',
              content: '',
              status: e.state === 'closure' ? ('in_progress' as const) : ('pending' as const),
              timestamp: now,
              category: 'validation',
            },
          ];

          if (isDeepThinking) {
            setThinkingSteps(steps);
            options.onThinkingUpdate?.(steps);
          }
          return;
        }

        // Research visibility (planned sources)
        if (evt.type === 'research_visibility') {
          setResearchVisibility(evt as ResearchVisibilityEvent);
          return;
        }

        // Research progress
        if (evt.type === 'research_progress') {
          const e = evt as ResearchProgressEvent;
          setResearchProgress(e);
          return;
        }
      };

      try {
        const mergedContext = focusMode ? { ...(context || {}), focusMode } : context;
        const resolvedLanguage =
          (language || localStorage.getItem('i18nextLng') || 'pl').split('-')[0] || 'pl';
        await Api.chatWithAIStream(
          message,
          history,
          handleChunk,
          handleDone,
          systemPrompt,
          mergedContext,
          roleName,
          resolvedLanguage,
          handleEvent,
          {
            deepResearch: aiConfig?.deepResearch,
            webSearch: aiConfig?.webSearch,
            showReasoning: aiConfig?.showReasoning,
            knowledgeSources: aiConfig?.knowledgeSources,
            responseStyle: aiConfig?.responseStyle,
            selectedTier: (aiConfig as any)?.selectedTier,
            selectedModelId: (aiConfig as any)?.selectedModelId ?? null,
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

  const checkPartialResponse = useCallback(
    async (sessionId: string): Promise<PartialResponse | null> => {
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
    },
    []
  );

  const resumeFromPartial = useCallback(
    async (
      sessionId: string,
      message: string,
      history: any[] = [],
      systemPrompt?: string,
      context?: Record<string, unknown>,
      focusMode?: string
    ) => {
      await startStream(
        message,
        history,
        systemPrompt,
        { ...context, sessionId, resumeFromPartial: true },
        focusMode
      );
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
    deepThinkingState,
    researchProgress,
    researchVisibility,
    artifacts,
    progress,
  };
};
