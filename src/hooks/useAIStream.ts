import { useCallback, useEffect, useRef, useState } from 'react';

import i18n from '@/i18n';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import {
  parseArtifactsFromResponse,
  stripArtifactsFromResponse,
  useArtifactsStore,
} from '@/store/useArtifactsStore';
import type { Artifact, TeresaChatProposal, ThinkingStep } from '@/types';
import { readPreferredChatLanguage } from '@/utils/chatLanguagePreference';

function mergeCitations(prev: any[], next: any[]): any[] {
  const out: any[] = [];
  const seen = new Map<string, any>();

  const keyOf = (c: any) =>
    String(
      c?.id ||
        c?.link ||
        c?.reference ||
        c?.url ||
        c?.title ||
        `${c?.type || 'citation'}:${JSON.stringify(c).slice(0, 120)}`
    );

  const add = (c: any) => {
    if (!c) return;
    const k = keyOf(c);
    if (!k) return;
    if (seen.has(k)) {
      // Prefer newer fields (e.g., excerpt added later)
      seen.set(k, { ...(seen.get(k) || {}), ...(c || {}) });
      return;
    }
    const merged = c;
    seen.set(k, merged);
    out.push(merged);
  };

  (Array.isArray(prev) ? prev : []).forEach(add);
  (Array.isArray(next) ? next : []).forEach(add);

  return out;
}

/**
 * Build localized thinking step labels for Cursor-like AI thinking indicator.
 * Uses natural, conversational phrases that change as the AI processes.
 *
 * Adaptive step count:
 *   - 'light'  (1 step)  — simple/fast queries expected < 3s
 *   - 'medium' (3 steps) — standard queries expected 3–15s
 *   - 'deep'   (5 steps) — complex/deep-thinking queries expected > 15s
 */
type ThinkingComplexity = 'light' | 'medium' | 'deep';

function buildDefaultThinkingSteps(
  language: string,
  complexity: ThinkingComplexity = 'medium'
): ThinkingStep[] {
  // AI thinking steps are always displayed in English regardless of UI language
  const labelVariants = {
    analyzing: [
      'Analyzing your question and finding the best way to respond…',
      'Processing your request and evaluating the relevant context…',
      'Understanding what you need and preparing my approach…',
    ],
    context: [
      'Gathering context from project data and related documents…',
      'Searching conversation history and organization data for connections…',
      'Reviewing initiatives, tasks, and progress to build a complete picture…',
      'Collecting insights from available sources for a more thorough answer…',
    ],
    planning: [
      'Planning the response — selecting the most important points to cover…',
      'Organizing the gathered information and prioritizing key findings…',
      'Choosing an approach that best addresses your specific question…',
    ],
    validating: [
      'Checking my analysis for consistency and verifying the details…',
      'Cross-referencing information to make sure there are no contradictions…',
      'Finalizing the details — making sure everything checks out…',
    ],
    composing: [
      'Composing the answer — weaving conclusions into a clear response…',
      'Putting it all together with concrete recommendations…',
      'Finishing up and polishing the response to be as helpful as possible…',
    ],
  };

  const variants = labelVariants;
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  const now = new Date();

  // Light: single step for fast queries
  if (complexity === 'light') {
    return [
      {
        id: `think-1-${now.getTime()}`,
        label: pick(variants.analyzing),
        content: '',
        status: 'in_progress' as const,
        timestamp: now,
        category: 'analysis',
      },
    ];
  }

  // Medium: 3 focused steps
  if (complexity === 'medium') {
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
        label: pick(variants.composing),
        content: '',
        status: 'pending' as const,
        timestamp: now,
        category: 'synthesis',
      },
    ];
  }

  // Deep: full 5-step decomposition
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
 * Logarithmic progress curve — fast to 60%, then asymptotically approaches 98%.
 * Never freezes: always has some micro-movement even at high elapsed times.
 * `elapsedMs` is time since stream started.
 */
function logarithmicProgress(elapsedMs: number): number {
  // Phase 1 (0–3s): quick ramp to ~55%
  // Phase 2 (3–15s): gradual climb to ~85%
  // Phase 3 (15s+): asymptotic approach to 97%, never freezing
  const t = elapsedMs / 1000; // seconds
  if (t <= 0) return 0;
  // Logarithmic curve: 20 * ln(1 + t) capped smoothly
  const raw = 20 * Math.log(1 + t);
  // Sigmoid squash so it never exceeds 97
  const progress = 97 * (1 - Math.exp(-raw / 97));
  // Add micro-jitter (±0.5%) to prevent visual freeze
  const jitter = Math.sin(t * 2.7) * 0.5;
  return Math.min(97, Math.max(0, progress + jitter));
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

/**
 * Split a raw streamed buffer into the visible answer and the model's reasoning.
 *
 * The model emits its chain-of-thought inside `<thinking>…</thinking>` blocks
 * intermixed with the answer. We:
 *  - collect the text of every COMPLETE block into `reasoning`,
 *  - remove those blocks from `visible`,
 *  - and, if a block is still OPEN at the end of the buffer (mid-stream), hide
 *    its partial tail from the answer while surfacing it live in `reasoning`.
 *
 * Operating on the full accumulated buffer (not per-chunk) makes this robust to
 * `<thinking>` tags that are split across SSE chunks.
 */
export function splitThinking(raw: string): { visible: string; reasoning: string } {
  const parts: string[] = [];
  const completeRe = /<thinking>([\s\S]*?)<\/thinking>/g;
  let m: RegExpExecArray | null;
  while ((m = completeRe.exec(raw)) !== null) {
    const t = m[1].trim();
    if (t) parts.push(t);
  }
  let visible = raw.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
  const openIdx = visible.indexOf('<thinking>');
  if (openIdx !== -1) {
    const partial = visible.slice(openIdx + '<thinking>'.length).trim();
    if (partial) parts.push(partial);
    visible = visible.slice(0, openIdx);
  }
  return { visible, reasoning: parts.join('\n\n') };
}

type StreamOptions = {
  onStreamDone?: (
    fullText: string,
    thinking: ThinkingStep[],
    artifacts: Artifact[],
    meta?: {
      citations?: any[];
      sessionId?: string;
      policyDecision?: any;
      policyNotices?: any[];
      sourceLedger?: any;
      trustBundle?: any;
      proposal?: TeresaChatProposal | null;
      /** Model's extracted chain-of-thought (from <thinking> blocks), for the
       *  per-message collapsible reasoning trace. Empty string when none. */
      reasoning?: string;
    }
  ) => void;
  onStreamError?: (error: Error) => void;
  onThinkingUpdate?: (steps: ThinkingStep[]) => void;
  /** Live reasoning text as it streams (for the expandable "Tok rozumowania" panel). */
  onReasoningUpdate?: (reasoning: string) => void;
  onArtifactDetected?: (
    artifact: Artifact,
    meta?: {
      citations?: any[];
      sessionId?: string;
      policyDecision?: any;
      policyNotices?: any[];
      sourceLedger?: any;
      trustBundle?: any;
      proposal?: TeresaChatProposal | null;
    }
  ) => void;
  /**
   * SPEC_01 (Tryb A): the chat backend created a deliverable via the
   * generate_deliverable tool and asks the FE to mount it in the canvas.
   * Payload mirrors the existing intent-intercept mount sequence (Tryb B).
   */
  onDeliverable?: (payload: {
    draftId: string;
    generationId: string;
    kind:
      | 'doc'
      | 'sheet'
      | 'deck'
      | 'mindmap'
      | 'process_flow'
      | 'table'
      | 'whiteboard'
      | 'note'
      | 'task'
      | 'decision'
      | 'initiative';
    format?: string;
    title?: string;
    /**
     * For kind: mindmap / process_flow / table / whiteboard (M06 Fala 2 · 2.3
     * + Teresa "all 8 tools"): backend-built skeleton graph, ReactFlow-like
     * {nodes, edges}. The workspace mount should hydrate this directly
     * instead of re-deriving from `seedText` via a fresh AI kickoff.
     */
    graph?: { nodes?: unknown[]; edges?: unknown[] };
    /** For the 4 canvas-tool kinds: topic seed text for AI expansion in Ideas. */
    seedText?: string;
    /** Which canvas tool the skeleton `graph` targets (mindmap/process_flow/table/whiteboard). */
    preferredSystem?: string;
  }) => void;
  /**
   * Z4 transport (fala „Teresa steruje Ideą przez rejestr"): model wywołał
   * narzędzie akcji OTWARTEJ reprezentacji Idei. Serwer NIE wykonuje tego (nie
   * ma dostępu do płótna) — przekazuje `{toolName, args}`, a front uruchamia je
   * przez executeTeresaTool() (ta sama ścieżka co klik człowieka). Callback jest
   * opcjonalny: gdy go nie ma, zdarzenie jest ignorowane i czat działa jak dziś.
   */
  onIdeaAction?: (payload: { toolName: string; args?: Record<string, unknown> }) => void;
};

export type UseAIStreamReturn = {
  startStream: (
    message: string,
    history?: any[],
    systemPrompt?: string,
    context?: Record<string, unknown>,
    focusMode?: string,
    roleName?: string,
    language?: string
  ) => Promise<void>;
  abortStream: () => boolean;
  retryLastStream: () => Promise<void>;
  lastError: Error | null;
  clearLastError: () => void;
  resumeFromPartial: (
    sessionId: string,
    message: string,
    history?: any[],
    systemPrompt?: string,
    context?: Record<string, unknown>,
    focusMode?: string
  ) => Promise<void>;
  checkPartialResponse: (sessionId: string) => Promise<{
    sessionId: string;
    content: string;
    canResume?: boolean;
    updatedAt?: string;
  } | null>;

  isStreaming: boolean;
  streamedContent: string;
  thinkingSteps: ThinkingStep[];
  reasoning: string;
  citations: any[];
  policyDecision: any | null;
  policyNotices: any[];
  sourceLedger: any | null;
  memoryCandidate: any | null;
  trustBundle: any | null;
  teresaProposal: TeresaChatProposal | null;
  deepThinkingState: any | null;
  researchProgress: any | null;
  researchVisibility: any | null;
  agentAuditState: any | null;
  agentReviewProgressByAgentId: Record<string, any>;
  agentSourcesByAgentId: Record<string, { kb: any[]; web: any[] }>;
  agentAuditVerdict: any | null;
  deepThinkingHint: any | null;
  interimInsight: any | null;
  artifacts: Artifact[];
  progress: number;
  retryInfo: { attempt: number; maxRetries: number; backoffMs: number } | null;
  streamStartedAt: number | null;
  streamCompletedSignal: boolean;
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
  /** Current research round (1 = initial, 2 = follow-up) */
  round?: number;
  /** Total research rounds */
  totalRounds?: number;
  /** Detected research type */
  researchType?: string;
  /** Number of completed rounds */
  rounds?: number;
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

type AgentAuditStateEvent = {
  type: 'agent_audit_state';
  state: 'reviewing' | 'aggregating' | 'done' | 'error' | string;
  orchestratorRunId?: string;
  agentsTotal?: number;
  qualityStatus?: string;
  gatesTriggered?: string[];
  error?: string;
};

type AgentReviewProgressEvent = {
  type: 'agent_review_progress';
  orchestratorRunId?: string;
  agentId: string;
  stage: 'start' | 'kb_retrieval' | 'llm_review' | 'done' | 'rejected' | 'error' | string;
  error?: string;
};

type AgentSourcesEvent = {
  type: 'agent_sources';
  orchestratorRunId?: string;
  agentId: string;
  kind: 'kb' | 'web' | string;
  sources: any[];
};

type AgentAuditVerdictEvent = {
  type: 'agent_audit_verdict';
  orchestratorRunId: string;
  verdict: any;
  reviews: any[];
  decisionContext?: any;
  agentIds?: string[];
  userIntent?: string;
  loopIteration?: number;
};

type CitationsEvent = {
  type: 'citations';
  citations: any[];
};

type PartialResponse = {
  sessionId: string;
  content: string;
  canResume?: boolean;
  updatedAt?: string;
};

export const useAIStream = (options: StreamOptions = {}): UseAIStreamReturn => {
  const { updateLastChatMessage, setIsBotTyping, setCurrentStreamContent, aiConfig } =
    useAppStore();
  const { addArtifact } = useArtifactsStore();

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  // Model's extracted chain-of-thought (from <thinking> blocks) for the
  // per-message collapsible "Tok rozumowania" trace.
  const [reasoning, setReasoning] = useState('');
  const reasoningRef = useRef('');
  const [lastError, setLastError] = useState<Error | null>(null);
  const [citations, setCitations] = useState<any[]>([]);
  const [policyDecision, setPolicyDecision] = useState<any | null>(null);
  const [policyNotices, setPolicyNotices] = useState<any[]>([]);
  const [sourceLedger, setSourceLedger] = useState<any | null>(null);
  const [memoryCandidate, setMemoryCandidate] = useState<any | null>(null);
  const [trustBundle, setTrustBundle] = useState<any | null>(null);
  const [teresaProposal, setTeresaProposal] = useState<TeresaChatProposal | null>(null);
  const [retryInfo, setRetryInfo] = useState<{
    attempt: number;
    maxRetries: number;
    backoffMs: number;
  } | null>(null);
  const [streamStartedAt, setStreamStartedAt] = useState<number | null>(null);
  const [streamCompletedSignal, setStreamCompletedSignal] = useState(false);
  const [deepThinkingState, setDeepThinkingState] = useState<DeepThinkingStateEvent | null>(null);
  const [researchProgress, setResearchProgress] = useState<ResearchProgressEvent | null>(null);
  const [researchVisibility, setResearchVisibility] = useState<ResearchVisibilityEvent | null>(
    null
  );
  const [agentAuditState, setAgentAuditState] = useState<AgentAuditStateEvent | null>(null);
  const [agentReviewProgressByAgentId, setAgentReviewProgressByAgentId] = useState<
    Record<string, AgentReviewProgressEvent>
  >({});
  const [agentSourcesByAgentId, setAgentSourcesByAgentId] = useState<
    Record<string, { kb: any[]; web: any[] }>
  >({});
  const [agentAuditVerdict, setAgentAuditVerdict] = useState<AgentAuditVerdictEvent | null>(null);
  const [deepThinkingHint, setDeepThinkingHint] = useState<{
    reason: string;
    confidence: 'low' | 'medium' | 'high';
  } | null>(null);
  const [interimInsight, setInterimInsight] = useState<{
    paths: Array<{ id: string; label: string; summary: string }>;
  } | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef({ aborted: false });
  const abortControllerRef = useRef<AbortController | null>(null);
  const citationsRef = useRef<any[]>([]);
  const policyDecisionRef = useRef<any | null>(null);
  const policyNoticesRef = useRef<any[]>([]);
  const sourceLedgerRef = useRef<any | null>(null);
  const memoryCandidateRef = useRef<any | null>(null);
  const trustBundleRef = useRef<any | null>(null);
  const teresaProposalRef = useRef<TeresaChatProposal | null>(null);
  const lastRequestRef = useRef<{
    message: string;
    history: any[];
    systemPrompt?: string;
    context?: Record<string, unknown>;
    focusMode?: string;
    roleName?: string;
    language?: string;
  } | null>(null);
  const retryCountRef = useRef(0);
  const MAX_AUTO_RETRIES = 3;
  const thinkingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const thinkingClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamSessionIdRef = useRef<string | null>(null);

  const resetStreamState = useCallback(() => {
    setStreamedContent('');
    setThinkingSteps([]);
    setReasoning('');
    reasoningRef.current = '';
    setDeepThinkingState(null);
    setCitations([]);
    citationsRef.current = [];
    setPolicyDecision(null);
    policyDecisionRef.current = null;
    setPolicyNotices([]);
    policyNoticesRef.current = [];
    setSourceLedger(null);
    sourceLedgerRef.current = null;
    setMemoryCandidate(null);
    memoryCandidateRef.current = null;
    setTrustBundle(null);
    trustBundleRef.current = null;
    setTeresaProposal(null);
    teresaProposalRef.current = null;
    setResearchProgress(null);
    setResearchVisibility(null);
    setAgentAuditState(null);
    setAgentReviewProgressByAgentId({});
    setAgentSourcesByAgentId({});
    setAgentAuditVerdict(null);
    setDeepThinkingHint(null);
    setInterimInsight(null);
    setArtifacts([]);
    setProgress(0);
    setCurrentStreamContent('');
    setLastError(null);
    setRetryInfo(null);
    setStreamStartedAt(null);
    setStreamCompletedSignal(false);
    streamSessionIdRef.current = null;
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
      language?: string,
      throwTerminalError = false
    ) => {
      // Save for manual retry (best-effort)
      lastRequestRef.current = {
        message,
        history,
        systemPrompt,
        context,
        focusMode,
        roleName,
        language,
      };

      abortRef.current.aborted = false;
      retryCountRef.current = 0;
      setIsStreaming(true);
      setIsBotTyping(true);
      resetStreamState();
      setLastError(null);
      setStreamStartedAt(Date.now());
      setStreamCompletedSignal(false);

      // Create a new abort controller for this stream
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      let fullText = '';
      // Raw accumulator INCLUDING <thinking> blocks — used to split out reasoning
      // robustly even when a tag spans multiple SSE chunks.
      let rawBuffer = '';
      const isDeepThinking = aiConfig?.deepResearch === true;
      // Adaptive complexity: start light for casual queries, escalate if response takes long
      const initialComplexity: ThinkingComplexity = isDeepThinking ? 'deep' : 'light';
      let currentThinking: ThinkingStep[] = isDeepThinking
        ? buildDefaultThinkingSteps(language || '', initialComplexity)
        : [];
      let hasEscalatedComplexity = isDeepThinking; // deep starts fully expanded
      let step = 0;
      let hasReceivedContent = false;
      let hasReceivedBackendThought = false; // switches to real steps once backend sends thoughts
      // Native reasoning channel: when the backend streams real model reasoning
      // tokens via `{type:'reasoning',delta}` events we accumulate them here and
      // prefer them over the `<thinking>` prose fallback (splitThinking).
      let nativeReasoning = '';
      let hasNativeReasoning = false;
      const streamStartTime = Date.now();

      // Deep Thinking gets visible process steps. Regular chat stays clean until
      // the backend emits real thought/retrieval/file events.
      if (isDeepThinking) {
        setThinkingSteps([...currentThinking]);
        options.onThinkingUpdate?.([...currentThinking]);
      } else {
        setThinkingSteps([]);
        options.onThinkingUpdate?.([]);
      }

      // Keep the UI "alive" even before first chunk arrives.
      // Uses logarithmic progress curve — never freezes, always micro-moves.
      // Once backend sends real 'thought' events, we defer to them and stop simulated updates.
      if (thinkingIntervalRef.current) clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = setInterval(() => {
        if (abortRef.current.aborted || hasReceivedContent) {
          if (thinkingIntervalRef.current) clearInterval(thinkingIntervalRef.current);
          thinkingIntervalRef.current = null;
          return;
        }

        // If backend is sending real thought events, only update progress bar
        // and skip simulated step manipulations
        const elapsed = Date.now() - streamStartTime;
        const pct = logarithmicProgress(elapsed);
        setProgress(Math.floor(pct));

        if (!isDeepThinking) return;

        if (hasReceivedBackendThought) {
          // Backend is driving thinking steps — do NOT override with simulated steps.
          // Only add a long-wait label if generating takes very long (>30s)
          if (elapsed > 30000 && !isDeepThinking) {
            setThinkingSteps((prev) => {
              const lastStep = prev[prev.length - 1];
              if (
                lastStep &&
                lastStep.status === 'in_progress' &&
                !lastStep.label.includes('almost')
              ) {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...lastStep,
                  label: 'Almost done — polishing the final details…',
                };
                options.onThinkingUpdate?.(updated);
                return updated;
              }
              return prev;
            });
          }
          return;
        }

        // Simulated mode: use client-side steps when backend doesn't send thoughts
        currentThinking = advanceThinkingSteps(currentThinking, pct);
        setThinkingSteps([...currentThinking]);
        options.onThinkingUpdate?.([...currentThinking]);

        // Escalate from 'light' (1 step) to 'medium' (3 steps) if response takes > 5s
        if (!hasEscalatedComplexity && elapsed > 5000) {
          hasEscalatedComplexity = true;
          currentThinking = buildDefaultThinkingSteps(language || '', 'medium');
          // Mark first step as completed to show progress
          if (currentThinking.length > 0) {
            currentThinking[0].status = 'completed';
            if (currentThinking.length > 1) currentThinking[1].status = 'in_progress';
          }
          setThinkingSteps([...currentThinking]);
          options.onThinkingUpdate?.([...currentThinking]);
        }

        // Long-wait escalation labels (3-second rule: always update something)
        if (elapsed > 30000 && !isDeepThinking) {
          const escalationStep = currentThinking.find((s) => s.status === 'in_progress');
          if (escalationStep && !escalationStep.label.includes('almost')) {
            escalationStep.label = 'Almost done — polishing the final details of the response…';
            setThinkingSteps([...currentThinking]);
            options.onThinkingUpdate?.([...currentThinking]);
          }
        } else if (elapsed > 10000 && !isDeepThinking) {
          const escalationStep = currentThinking.find((s) => s.status === 'in_progress');
          if (escalationStep && !escalationStep.label.includes('moment')) {
            escalationStep.label =
              'This is taking a moment — analyzing more complex aspects of your question…';
            setThinkingSteps([...currentThinking]);
            options.onThinkingUpdate?.([...currentThinking]);
          }
        }
      }, 350);

      const handleChunk = (chunk: string) => {
        if (abortRef.current.aborted) return;

        // Accumulate raw, then split the model's <thinking> reasoning out of the
        // visible answer. Reasoning is ALWAYS captured (regardless of the
        // showReasoning toggle) so the per-message "Tok rozumowania" trace can
        // render it and it can be persisted; the toggle only affects auto-expand.
        rawBuffer += chunk;
        const { visible, reasoning: extractedReasoning } = splitThinking(rawBuffer);
        // Prefer the native reasoning channel when present; only fall back to the
        // <thinking> prose extraction when the backend hasn't streamed any native
        // reasoning tokens. This keeps both paths populating metadata.reasoning.
        if (!hasNativeReasoning && extractedReasoning !== reasoningRef.current) {
          reasoningRef.current = extractedReasoning;
          setReasoning(extractedReasoning);
          options.onReasoningUpdate?.(extractedReasoning);
        }
        fullText = visible;

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
        setRetryInfo(null);

        // Flash completion signal for UI feedback (auto-clears after 2s)
        setStreamCompletedSignal(true);
        setTimeout(() => setStreamCompletedSignal(false), 2000);

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

        // Parse any artifacts from the response, but never persist/show raw
        // artifact envelopes in the chat bubble.
        const parsedArtifacts = parseArtifactsFromResponse(fullText);
        const visibleText =
          parsedArtifacts.length > 0 ? stripArtifactsFromResponse(fullText) : fullText;
        if (parsedArtifacts.length) {
          const artifactMeta = {
            citations: citationsRef.current,
            sessionId: streamSessionIdRef.current || undefined,
            policyDecision: policyDecisionRef.current,
            policyNotices: policyNoticesRef.current,
            sourceLedger: sourceLedgerRef.current,
            trustBundle: trustBundleRef.current,
            proposal: teresaProposalRef.current,
          };
          parsedArtifacts.forEach((artifact) => {
            if (options.onArtifactDetected) {
              options.onArtifactDetected(artifact, artifactMeta);
            } else {
              addArtifact(artifact);
            }
          });
          setArtifacts(parsedArtifacts);
        }

        updateLastChatMessage?.(visibleText);
        options.onStreamDone?.(visibleText, currentThinking, parsedArtifacts, {
          citations: citationsRef.current,
          sessionId: streamSessionIdRef.current || undefined,
          policyDecision: policyDecisionRef.current,
          policyNotices: policyNoticesRef.current,
          sourceLedger: sourceLedgerRef.current,
          trustBundle: trustBundleRef.current,
          proposal: teresaProposalRef.current,
          reasoning: reasoningRef.current,
        });
      };

      const handleEvent = (evt: any) => {
        if (abortRef.current.aborted) return;
        if (!evt || typeof evt !== 'object') return;

        // SPEC_01 (Tryb A): the model called generate_deliverable server-side and
        // a draft was created. Hand the mount off to the chat panel, which runs
        // the same canvas-mount sequence as the front-end intent intercept.
        if (evt.type === 'deliverable') {
          const draftId = String((evt as any).draftId || (evt as any).generationId || '').trim();
          const kindRaw = String((evt as any).kind || 'doc');
          // M06 Fala 2 · 2.3 (+ Teresa "all 8 tools"): mind map / process_flow /
          // table / whiteboard / note are first-class deliverable kinds that
          // carry a pre-built skeleton graph (or, for note, a real row id)
          // instead of a canvas draft id. Previously this narrowed to only
          // 'doc' | 'sheet' | 'deck' | 'mindmap', silently downgrading
          // process_flow/table/whiteboard/note to 'doc' — UnifiedChatPanel's
          // CANVAS_TOOL_KINDS check then never matched, so those deliverables
          // fell through into the generic doc-canvas mount path instead of the
          // Ideas-workspace handoff. Pass the backend `kind` straight through;
          // it is already whitelisted server-side by KIND_TO_FORMAT.
          // Teresa routing-N (naprawa-rN-routing): task / decision / initiative are
          // real N-OBJECTS (a tasks/decisions/initiatives row already persisted
          // server-side), not canvas drafts. Pass them straight through so
          // UnifiedChatPanel navigates to the right My Work / Initiatives module
          // instead of downgrading them to a 'doc' canvas mount.
          const kind:
            | 'doc'
            | 'sheet'
            | 'deck'
            | 'mindmap'
            | 'process_flow'
            | 'table'
            | 'whiteboard'
            | 'note'
            | 'task'
            | 'decision'
            | 'initiative' =
            kindRaw === 'mindmap' ||
            kindRaw === 'process_flow' ||
            kindRaw === 'table' ||
            kindRaw === 'whiteboard' ||
            kindRaw === 'note' ||
            kindRaw === 'task' ||
            kindRaw === 'decision' ||
            kindRaw === 'initiative'
              ? kindRaw
              : kindRaw === 'sheet'
                ? 'sheet'
                : kindRaw === 'deck'
                  ? 'deck'
                  : 'doc';
          if (draftId) {
            options.onDeliverable?.({
              draftId,
              generationId: String((evt as any).generationId || draftId),
              kind,
              format: (evt as any).format,
              title: (evt as any).title,
              graph: (evt as any).graph,
              seedText: (evt as any).seedText,
              // Which canvas tool the skeleton graph targets — dropped before
              // (never forwarded), so UnifiedChatPanel's mount fell back to
              // `payloadKind` and lost this distinction for kind:'mindmap'
              // shared across all 4 canvas tools.
              preferredSystem: (evt as any).preferredSystem,
            } as any);
          }
          return;
        }

        // Z4 transport — model wywołał narzędzie akcji OTWARTEJ Idei. Serwer nie
        // wykonuje go (patrz clientTools w llmService); przekazuje toolName+args,
        // a front uruchamia akcję przez executeTeresaTool() (ta sama ścieżka co
        // klik). Brak `onIdeaAction` ⇒ zdarzenie jest ignorowane (czat jak dziś).
        if (evt.type === 'idea_action') {
          const toolName = String((evt as any).toolName || '').trim();
          if (toolName) {
            const rawArgs = (evt as any).args;
            options.onIdeaAction?.({
              toolName,
              args:
                rawArgs && typeof rawArgs === 'object'
                  ? (rawArgs as Record<string, unknown>)
                  : undefined,
            });
          }
          return;
        }

        // Native model reasoning channel — real chain-of-thought tokens streamed
        // as `{type:'reasoning',delta}` events, interleaved with content. We
        // accumulate the deltas and surface them LIVE in the per-message "Tok
        // rozumowania" trace (preferred over the <thinking> prose fallback).
        if (evt.type === 'reasoning') {
          const delta = typeof (evt as any).delta === 'string' ? (evt as any).delta : '';
          if (delta) {
            hasNativeReasoning = true;
            nativeReasoning += delta;
            reasoningRef.current = nativeReasoning;
            setReasoning(nativeReasoning);
            options.onReasoningUpdate?.(nativeReasoning);
          }
          return;
        }

        // Policy gateway: decision + notices (refusal/uncertainty)
        if (evt.type === 'policy_decision') {
          const d = (evt as any)?.decision ?? evt;
          setPolicyDecision(d);
          policyDecisionRef.current = d;
          return;
        }
        if (evt.type === 'policy_notice') {
          const next = [
            ...(Array.isArray(policyNoticesRef.current) ? policyNoticesRef.current : []),
            evt,
          ];
          policyNoticesRef.current = next;
          setPolicyNotices(next);
          return;
        }
        if (evt.type === 'source_ledger') {
          setSourceLedger(evt);
          sourceLedgerRef.current = evt;
          return;
        }
        if (evt.type === 'memory_candidate') {
          setMemoryCandidate(evt);
          memoryCandidateRef.current = evt;
          return;
        }
        if (evt.type === 'trust_bundle') {
          const bundle = (evt as any)?.bundle ?? evt;
          setTrustBundle(bundle);
          trustBundleRef.current = bundle;
          return;
        }

        if (evt.type === 'teresa_proposal') {
          const proposal = (evt as { proposal?: TeresaChatProposal | null }).proposal || null;
          setTeresaProposal(proposal);
          teresaProposalRef.current = proposal;
          return;
        }

        if (evt.type === 'citations') {
          const e = evt as CitationsEvent;
          const incoming = Array.isArray(e.citations) ? e.citations : [];
          const next = mergeCitations(citationsRef.current, incoming);
          citationsRef.current = next;
          setCitations(next);
          return;
        }

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
                e.state === 'research_visibility' ? ('in_progress' as const) : ('done' as const),
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
                  : e.state === 'thinking' || e.state === 'synthesis' || e.state === 'closure'
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

        // Agent Audit Layer — streamed progress/sources/verdict
        if (evt.type === 'agent_audit_state') {
          setAgentAuditState(evt as AgentAuditStateEvent);
          return;
        }
        if (evt.type === 'agent_review_progress') {
          const e = evt as AgentReviewProgressEvent;
          if (e?.agentId) {
            setAgentReviewProgressByAgentId((prev) => ({ ...prev, [e.agentId]: e }));
          }
          return;
        }
        if (evt.type === 'agent_sources') {
          const e = evt as AgentSourcesEvent;
          const agentId = String(e?.agentId || '').trim();
          if (!agentId) return;
          setAgentSourcesByAgentId((prev) => {
            const cur = prev[agentId] || { kb: [], web: [] };
            const next =
              e.kind === 'web'
                ? { ...cur, web: Array.isArray(e.sources) ? e.sources : cur.web }
                : e.kind === 'kb'
                  ? { ...cur, kb: Array.isArray(e.sources) ? e.sources : cur.kb }
                  : cur;
            return { ...prev, [agentId]: next };
          });
          return;
        }
        if (evt.type === 'agent_audit_verdict') {
          setAgentAuditVerdict(evt as AgentAuditVerdictEvent);
          return;
        }

        // Stream meta (debug/resume affinity)
        if (evt.type === 'stream_meta') {
          const sessionId =
            typeof evt.sessionId === 'string' && evt.sessionId.trim().length > 0
              ? evt.sessionId.trim()
              : null;
          if (sessionId) {
            streamSessionIdRef.current = sessionId;
          }
          return;
        }

        // Backend thought progress — real-time pipeline stage updates
        if (evt.type === 'thought') {
          const e = evt as {
            type: 'thought';
            step?: string;
            status?: string;
            label?: string;
          };
          const stepId = e.step || 'unknown';
          const label = e.label || stepId;
          const now = new Date();

          // Switch from simulated steps to real backend-driven steps
          hasReceivedBackendThought = true;

          setThinkingSteps((prev) => {
            // Check if step already exists
            const existingIdx = prev.findIndex((s) => s.id === `backend-${stepId}`);

            if (existingIdx >= 0) {
              // Update existing step
              const updated = [...prev];
              updated[existingIdx] = {
                ...updated[existingIdx],
                label,
                status: e.status === 'done' ? ('done' as const) : ('in_progress' as const),
                timestamp: now,
              };
              // Mark all previous steps as done
              for (let i = 0; i < existingIdx; i++) {
                if (updated[i].status !== 'done') {
                  updated[i] = { ...updated[i], status: 'done' as const };
                }
              }
              options.onThinkingUpdate?.(updated);
              return updated;
            }

            // New step — mark all previous as done, add new one
            const updated: ThinkingStep[] = prev
              .filter((s) => s.id.startsWith('backend-')) // keep only backend steps
              .map((s) => ({
                ...s,
                status: 'done' as const,
              }));

            updated.push({
              id: `backend-${stepId}`,
              label,
              content: '',
              status: 'in_progress' as const,
              timestamp: now,
              category: stepId === 'generating' ? 'synthesis' : ('research' as const),
            });

            options.onThinkingUpdate?.(updated);
            return updated;
          });
          return;
        }

        // Partial resume: backend may send a full/partial buffer to restore UI continuity.
        // Treat as a replace (NOT append), otherwise we'd duplicate content.
        if (evt.type === 'resume') {
          const newText = String((evt as any).text || '');
          if (newText) {
            rawBuffer = newText;
            fullText = newText;
            setStreamedContent(newText);
            setCurrentStreamContent(newText);
            updateLastChatMessage?.(newText);
          }
          return;
        }

        // Self-Check repair: replace streamed content entirely
        if (evt.type === 'dt_repair_replace') {
          const newText = String((evt as any).text || '');
          if (newText) {
            rawBuffer = newText;
            fullText = newText;
            setStreamedContent(newText);
            setCurrentStreamContent(newText);
            updateLastChatMessage?.(newText);
          }
          return;
        }

        // AI-suggested Deep Thinking activation hint
        if (evt.type === 'dt_hint') {
          const e = evt as {
            type: 'dt_hint';
            reason: string;
            confidence: 'low' | 'medium' | 'high';
          };
          setDeepThinkingHint({ reason: e.reason, confidence: e.confidence });
          return;
        }

        // Interim Insight checkpoint (mid-stream emerging paths)
        if (evt.type === 'dt_interim_insight') {
          const e = evt as {
            type: 'dt_interim_insight';
            paths: Array<{ id: string; label: string; summary: string }>;
          };
          setInterimInsight({ paths: e.paths || [] });
          return;
        }

        // Self-Check status (passed / repairing / best_effort)
        if (evt.type === 'dt_selfcheck') {
          const e = evt as {
            type: 'dt_selfcheck';
            status: 'repairing' | 'passed' | 'best_effort' | 'failed' | 'force_depth_insufficient';
            label?: string;
            iteration?: number;
            repairIterations?: number;
            forceDepthDiff?: any;
          };
          if (isDeepThinking) {
            const now = new Date();
            // Update the closure step to reflect self-check status
            setThinkingSteps((prev) => {
              const updated = prev.map((s) => {
                if (s.category === 'validation') {
                  return {
                    ...s,
                    label: e.label || s.label,
                    status:
                      e.status === 'passed' ||
                      e.status === 'best_effort' ||
                      e.status === 'failed' ||
                      e.status === 'force_depth_insufficient'
                        ? ('done' as const)
                        : ('in_progress' as const),
                    timestamp: now,
                  };
                }
                return s;
              });
              options.onThinkingUpdate?.(updated);
              return updated;
            });
          }
          return;
        }
      };

      const mergedContext = focusMode ? { ...(context || {}), focusMode } : context;
      const uiLang = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];
      const resolvedLanguage =
        (
          readPreferredChatLanguage(language || context?.conversationLanguage || uiLang) || uiLang
        ).split('-')[0] || uiLang;
      const resolvedKnowledgeSources = {
        pmoDocuments: aiConfig?.knowledgeSources?.pmoDocuments ?? true,
        projectData: aiConfig?.knowledgeSources?.projectData ?? true,
        organizationData: aiConfig?.knowledgeSources?.organizationData ?? true,
      };

      const runRequest = () =>
        Api.chatWithAIStream(
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
            multiAgent: aiConfig?.multiAgent,
            marketResearch: (aiConfig as any)?.marketResearch,
            coThinkerMode: (aiConfig as any)?.coThinkerMode ?? null,
            privateMode: (aiConfig as any)?.privateMode ?? false,
            assistantScope: (aiConfig as any)?.assistantScope,
            memoryScope: (aiConfig as any)?.memoryScope,
            knowledgeSources: resolvedKnowledgeSources,
            responseStyle: aiConfig?.responseStyle,
            selectedTier: (aiConfig as any)?.selectedTier,
            selectedModelId: (aiConfig as any)?.selectedModelId ?? null,
          },
          abortControllerRef.current?.signal
        );

      let terminalError: Error | null = null;
      while (!abortRef.current.aborted) {
        try {
          await runRequest();
          retryCountRef.current = 0;
          setRetryInfo(null);
          return;
        } catch (error) {
          const err = error as Error & { code?: string };
          if (abortRef.current.aborted || err?.name === 'AbortError') break;

          const nonRetryableCodes = new Set([
            'ACCESS_BLOCKED',
            'ORG_NOT_FOUND',
            'ORG_INACTIVE',
            'UNAUTHORIZED',
            'AI_BUDGET_EXHAUSTED',
            'AI_TOKEN_BUDGET_EXCEEDED',
            'RATE_LIMIT',
            'RATE_LIMIT_EXCEEDED',
            'DEEP_THINKING_CONFIRM_REQUIRED',
          ]);
          const nonRetryable =
            nonRetryableCodes.has(String(err.code || '').toUpperCase()) ||
            /ACCESS_BLOCKED|Unauthorized|AI_BUDGET_EXHAUSTED|RATE_LIMIT_EXCEEDED/i.test(
              err.message || ''
            );

          if (nonRetryable || retryCountRef.current >= MAX_AUTO_RETRIES) {
            terminalError = err;
            break;
          }

          retryCountRef.current += 1;
          const backoffMs = 1500 * Math.pow(2, retryCountRef.current - 1);
          console.warn(
            `[useAIStream] Auto-retry ${retryCountRef.current}/${MAX_AUTO_RETRIES} in ${backoffMs}ms…`
          );
          setRetryInfo({ attempt: retryCountRef.current, maxRetries: MAX_AUTO_RETRIES, backoffMs });
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          setRetryInfo(null);
          if (abortRef.current.aborted) break;

          abortControllerRef.current?.abort();
          abortControllerRef.current = new AbortController();
          // A retry is a replacement response, not an append to the failed
          // partial response.
          fullText = '';
          rawBuffer = '';
          reasoningRef.current = '';
          setReasoning('');
          nativeReasoning = '';
          hasNativeReasoning = false;
          hasReceivedContent = false;
          setStreamedContent('');
          setCurrentStreamContent('');
        }
      }

      retryCountRef.current = 0;
      setRetryInfo(null);
      setIsStreaming(false);
      setIsBotTyping(false);
      if (terminalError) {
        setLastError(terminalError);
        options.onStreamError?.(terminalError);
        if (throwTerminalError) throw terminalError;
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
    abortControllerRef.current?.abort();
    const hadPartialContent = (streamedContent || '').trim().length > 0;
    setIsStreaming(false);
    setIsBotTyping(false);
    // Keep partial content visible if any was received
    if (!hadPartialContent) {
      resetStreamState();
    } else {
      // Clear only thinking/progress state but keep streamed content
      setThinkingSteps([]);
      setProgress(0);
      setRetryInfo(null);
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
        thinkingIntervalRef.current = null;
      }
      if (thinkingClearTimeoutRef.current) {
        clearTimeout(thinkingClearTimeoutRef.current);
        thinkingClearTimeoutRef.current = null;
      }
    }
    return hadPartialContent;
  }, [resetStreamState, setIsBotTyping, streamedContent]);

  // Chat P0-3 — abort any in-flight stream when the active conversation
  // changes. Without this the SSE for conv A keeps running after the user
  // clicks conv B, and the streamed content (hook-state, not conv-scoped)
  // leaks into conv B's view. The event is dispatched from
  // useConversationStore.setActiveConversation when prev !== id.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onAbortRequest = () => {
      if (isStreaming) abortStream();
    };
    window.addEventListener('chat:abort-stream', onAbortRequest);
    return () => window.removeEventListener('chat:abort-stream', onAbortRequest);
  }, [abortStream, isStreaming]);

  const retryLastStream = useCallback(async () => {
    if (isStreaming) return;
    const req = lastRequestRef.current;
    if (!req) return;
    await startStream(
      req.message,
      req.history,
      req.systemPrompt,
      req.context,
      req.focusMode,
      req.roleName,
      req.language
    );
  }, [isStreaming, startStream]);

  const clearLastError = useCallback(() => setLastError(null), []);

  const checkPartialResponse = useCallback(
    async (sessionId: string): Promise<PartialResponse | null> => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/ai/stream/partial/${sessionId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (response.status === 404) {
          return null;
        }
        if (!response.ok) {
          throw new Error(`chat_partial_discovery_failed_${response.status}`);
        }

        return (await response.json()) as PartialResponse;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('chat_partial_discovery_failed_')) {
          throw error;
        }
        throw new Error('chat_partial_discovery_unavailable');
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
        {
          ...(context || {}),
          // Backend expects these as top-level fields (passed through by Api.chatWithAIStream)
          conversationId: sessionId,
          sessionId,
          resumeFromPartial: true,
        },
        focusMode,
        undefined,
        undefined,
        true
      );
    },
    [startStream]
  );

  return {
    startStream,
    abortStream,
    retryLastStream,
    lastError,
    clearLastError,
    resumeFromPartial,
    checkPartialResponse,
    isStreaming,
    streamedContent,
    thinkingSteps,
    reasoning,
    citations,
    policyDecision,
    policyNotices,
    sourceLedger,
    memoryCandidate,
    trustBundle,
    teresaProposal,
    deepThinkingState,
    researchProgress,
    researchVisibility,
    agentAuditState,
    agentReviewProgressByAgentId,
    agentSourcesByAgentId,
    agentAuditVerdict,
    deepThinkingHint,
    interimInsight,
    artifacts,
    progress,
    retryInfo,
    streamStartedAt,
    streamCompletedSignal,
  };
};
