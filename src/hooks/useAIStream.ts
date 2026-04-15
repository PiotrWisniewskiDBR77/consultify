import { useCallback, useRef, useState } from 'react';

import i18n from '@/i18n';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { parseArtifactsFromResponse, useArtifactsStore } from '@/store/useArtifactsStore';
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
      proposal?: TeresaChatProposal | null;
    }
  ) => void;
  onStreamError?: (error: Error) => void;
  onThinkingUpdate?: (steps: ThinkingStep[]) => void;
  onArtifactDetected?: (artifact: Artifact) => void;
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
  } | null>;

  isStreaming: boolean;
  streamedContent: string;
  thinkingSteps: ThinkingStep[];
  citations: any[];
  policyDecision: any | null;
  policyNotices: any[];
  sourceLedger: any | null;
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
};

export const useAIStream = (options: StreamOptions = {}): UseAIStreamReturn => {
  const { updateLastChatMessage, setIsBotTyping, setCurrentStreamContent, aiConfig } =
    useAppStore();
  const { addArtifact } = useArtifactsStore();

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [citations, setCitations] = useState<any[]>([]);
  const [policyDecision, setPolicyDecision] = useState<any | null>(null);
  const [policyNotices, setPolicyNotices] = useState<any[]>([]);
  const [sourceLedger, setSourceLedger] = useState<any | null>(null);
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
    setDeepThinkingState(null);
    setCitations([]);
    setPolicyDecision(null);
    setPolicyNotices([]);
    setSourceLedger(null);
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
      language?: string
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
      const isDeepThinking = aiConfig?.deepResearch === true;
      // Adaptive complexity: start light for casual queries, escalate if response takes long
      const initialComplexity: ThinkingComplexity = isDeepThinking ? 'deep' : 'light';
      let currentThinking: ThinkingStep[] = buildDefaultThinkingSteps(
        language || '',
        initialComplexity
      );
      let hasEscalatedComplexity = isDeepThinking; // deep starts fully expanded
      let step = 0;
      let hasReceivedContent = false;
      let hasReceivedBackendThought = false; // switches to real steps once backend sends thoughts
      const streamStartTime = Date.now();

      // Make "LLM is working" visible immediately (Cursor-like)
      setThinkingSteps([...currentThinking]);
      options.onThinkingUpdate?.([...currentThinking]);

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

        // Handle <thinking> tags: show as visible blockquote when showReasoning is on,
        // otherwise strip them silently.
        let processedChunk = chunk;
        const hasThinkingTags = /<thinking>[\s\S]*?<\/thinking>/g.test(chunk);
        if (hasThinkingTags) {
          if (aiConfig?.showReasoning) {
            // Convert <thinking>...</thinking> into a visible markdown blockquote
            processedChunk = chunk.replace(
              /<thinking>([\s\S]*?)<\/thinking>/g,
              (_match, content: string) => {
                const trimmed = content.trim();
                if (!trimmed) return '';
                // Format as a collapsible reasoning block
                const quotedLines = trimmed
                  .split('\n')
                  .map((line: string) => `> ${line}`)
                  .join('\n');
                return `\n> **Tok rozumowania:**\n${quotedLines}\n\n`;
              }
            );
          } else {
            processedChunk = chunk.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
          }
        }

        // Add to full text
        if (processedChunk) {
          fullText += processedChunk;
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
        options.onStreamDone?.(fullText, currentThinking, parsedArtifacts, {
          citations,
          sessionId: streamSessionIdRef.current || undefined,
          policyDecision,
          policyNotices,
          sourceLedger,
          proposal: teresaProposalRef.current,
        });
      };

      const handleEvent = (evt: any) => {
        if (abortRef.current.aborted) return;
        if (!evt || typeof evt !== 'object') return;

        // Policy gateway: decision + notices (refusal/uncertainty)
        if (evt.type === 'policy_decision') {
          const d = (evt as any)?.decision ?? evt;
          setPolicyDecision(d);
          return;
        }
        if (evt.type === 'policy_notice') {
          setPolicyNotices((prev) => [...(Array.isArray(prev) ? prev : []), evt]);
          return;
        }
        if (evt.type === 'source_ledger') {
          setSourceLedger(evt);
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
          setCitations((prev) => mergeCitations(prev, incoming));
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
          readPreferredChatLanguage(language || context?.conversationLanguage || uiLang) ||
          uiLang
        ).split('-')[0] || uiLang;
      const resolvedKnowledgeSources = {
        pmoDocuments: aiConfig?.knowledgeSources?.pmoDocuments ?? true,
        projectData: aiConfig?.knowledgeSources?.projectData ?? true,
        organizationData: aiConfig?.knowledgeSources?.organizationData ?? false,
      };

      try {
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
            multiAgent: aiConfig?.multiAgent,
            marketResearch: (aiConfig as any)?.marketResearch,
            coThinkerMode: (aiConfig as any)?.coThinkerMode ?? null,
            privateMode: (aiConfig as any)?.privateMode ?? false,
            knowledgeSources: resolvedKnowledgeSources,
            responseStyle: aiConfig?.responseStyle,
            selectedTier: (aiConfig as any)?.selectedTier,
            selectedModelId: (aiConfig as any)?.selectedModelId ?? null,
          },
          abortControllerRef.current?.signal
        );
      } catch (error) {
        // Auto-retry with exponential backoff on network/stream errors (not on user abort)
        if (
          !abortRef.current.aborted &&
          retryCountRef.current < MAX_AUTO_RETRIES &&
          // Only retry on network-like errors, not on access/auth/budget errors
          !(error as Error)?.message?.includes('ACCESS_BLOCKED') &&
          !(error as Error)?.message?.includes('Unauthorized') &&
          !(error as Error)?.message?.includes('AI_BUDGET_EXHAUSTED') &&
          !(error as Error)?.message?.includes('RATE_LIMIT_EXCEEDED')
        ) {
          retryCountRef.current += 1;
          // Exponential backoff: 1.5s, 3s, 6s
          const backoffMs = 1500 * Math.pow(2, retryCountRef.current - 1);
          console.warn(
            `[useAIStream] Auto-retry ${retryCountRef.current}/${MAX_AUTO_RETRIES} in ${backoffMs}ms…`
          );
          // Surface retry status to UI so user sees transparent progress
          setRetryInfo({ attempt: retryCountRef.current, maxRetries: MAX_AUTO_RETRIES, backoffMs });
          await new Promise((r) => setTimeout(r, backoffMs));
          setRetryInfo(null);
          if (!abortRef.current.aborted) {
            try {
              // New controller for retry
              abortControllerRef.current?.abort();
              abortControllerRef.current = new AbortController();
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
                  multiAgent: aiConfig?.multiAgent,
                  marketResearch: (aiConfig as any)?.marketResearch,
                  coThinkerMode: (aiConfig as any)?.coThinkerMode ?? null,
                  privateMode: (aiConfig as any)?.privateMode ?? false,
                  knowledgeSources: resolvedKnowledgeSources,
                  responseStyle: aiConfig?.responseStyle,
                  selectedTier: (aiConfig as any)?.selectedTier,
                  selectedModelId: (aiConfig as any)?.selectedModelId ?? null,
                },
                abortControllerRef.current?.signal
              );
              return; // Retry succeeded
            } catch (retryError) {
              // Retry also failed — fall through to error handling
              console.error('[useAIStream] Auto-retry failed:', retryError);
            }
          }
        }

        // If aborted, don't surface as an error
        const err = error as any;
        if (abortRef.current.aborted || err?.name === 'AbortError') {
          return;
        }

        retryCountRef.current = 0;
        setIsStreaming(false);
        setIsBotTyping(false);
        setLastError(error as Error);
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
        {
          ...(context || {}),
          // Backend expects these as top-level fields (passed through by Api.chatWithAIStream)
          conversationId: sessionId,
          sessionId,
          resumeFromPartial: true,
        },
        focusMode
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
    citations,
    policyDecision,
    policyNotices,
    sourceLedger,
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
