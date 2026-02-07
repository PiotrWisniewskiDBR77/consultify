/**
 * UnifiedChatPanel
 *
 * A unified chat interface component that works in both:
 * - Full-screen mode (main AI Chat view)
 * - Split-screen mode (alongside workspace)
 *
 * Uses useConversationStore as the primary source of truth for all
 * chat state, messages, and conversation management.
 *
 * Features:
 * - EnhancedChatInput with all rich features (files, tools, voice)
 * - FocusModeSelector (compact in split mode)
 * - ChatSlidingPanel integration for history
 * - Message rendering with streaming, thinking, artifacts
 * - Responsive design
 *
 * @version 1.0.0
 */

import {
  Bookmark,
  Bot,
  BrainCircuit,
  Check,
  Copy,
  FileCode,
  History,
  Lightbulb,
  MessageSquare,
  Plus,
  Pencil,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { isValidLanguage, type SupportedLanguage } from '@/i18n';

import { useAIStream } from '../../hooks/useAIStream';
import { useDemoSession } from '../../hooks/useDemoSession';
import { useUniversalVoice } from '../../hooks/useUniversalVoice';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { useArtifactsStore } from '../../store/useArtifactsStore';
import { ConversationMessage, useConversationStore } from '../../store/useConversationStore';
import {
  AppView,
  Artifact,
  ChatMessage,
  FocusMode,
  ResponseFeedback,
  ThinkingStep,
} from '../../types';
import { ChatDisplayMode, WorkspaceContext } from '../../types/workspace';
import { ChatSlidingPanel } from './ChatSlidingPanel';
import { CitationList } from './CitationList';
import { ContextBadge } from './ContextBadge';
import { EnhancedChatInput } from './EnhancedChatInput';
import { InlineResponseFeedback } from './InlineResponseFeedback';
import { ThinkingBlock } from './Messages/ThinkingBlock';
import { PendingActionsIndicator } from './PendingActionsIndicator';
import { ResearchProgress } from './ResearchProgress';
import { ThinkingStatusLine } from './ThinkingStatusLine';

// ============================================================================
// Types
// ============================================================================

interface UnifiedChatPanelProps {
  /** Display mode: full-screen or split-screen */
  mode?: ChatDisplayMode;

  /** Custom class name */
  className?: string;

  /** Whether to show expand/collapse button */
  showModeToggle?: boolean;

  /** Callback when mode toggle is clicked */
  onModeToggle?: () => void;

  /** Callback for "back" button in split mode */
  onBack?: () => void;

  /** Whether to show the sliding history panel trigger */
  showHistoryTrigger?: boolean;

  /** Optional title override */
  title?: string;

  /** Whether to show focus mode selector */
  showFocusMode?: boolean;

  /** Current workspace context (for AI awareness) */
  workspaceContext?: WorkspaceContext | null;

  /** Whether the panel is disabled */
  disabled?: boolean;

  /** Max height for the panel (useful in split mode) */
  maxHeight?: string;

  /** Callback when user sends a message */
  onMessageSent?: (content: string) => void;

  /** Callback when user clicks "View All Actions" */
  onNavigateToActions?: () => void;

  /** Optional system prompt override */
  systemPrompt?: string;

  /** Optional role name override */
  roleName?: string;

  /** Callback when user selects an interactive option */
  onOptionSelect?: (option: { id: string; label: string; value: string }) => void;

  /** Callback when user selects multiple interactive options */
  onMultiSelectSubmit?: (values: string[]) => void;

  /** Optional messages override for ephemeral/specialized views */
  customMessages?: ChatMessage[];
}

// ============================================================================
// Component
// ============================================================================

export const UnifiedChatPanel: React.FC<UnifiedChatPanelProps> = ({
  mode = 'full',
  className = '',
  showModeToggle = true,
  onModeToggle,
  onBack,
  showHistoryTrigger = true,
  title,
  showFocusMode = true,
  workspaceContext,
  disabled = false,
  maxHeight,
  onMessageSent,
  onNavigateToActions,
  systemPrompt,
  roleName,
  onOptionSelect,
  onMultiSelectSubmit,
  customMessages,
}) => {
  const { t, i18n } = useTranslation();

  // ========================================================================
  // Store hooks
  // ========================================================================

  const {
    isChatSlidingPanelOpen,
    setChatSlidingPanelOpen,
    currentStreamContent,
    isBotTyping,
    addChatMessage,
    setIsBotTyping,
    aiFreezeStatus,
    aiConfig,
  } = useAppStore();

  const {
    activeConversationId,
    activeMessages,
    isLoading: isConversationLoading,
    displayMode,
    createConversation,
    addMessage: addMessageToConversation,
    setActiveConversation,
    fetchConversation,
    clearActiveChat,
    truncateFromMessage,
    setDisplayMode,
    expandToFullScreen,
    collapseToSplit,
    draftChatLanguage,
    chatLanguageByConversationId,
  } = useConversationStore();

  const { addArtifact, togglePanel: toggleArtifactsPanel } = useArtifactsStore();

  // ========================================================================
  // Local state (must be declared before hooks that depend on them)
  // ========================================================================

  const [focusMode, setFocusMode] = useState<FocusMode>('all');
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
  const [autoReadEnabled, setAutoReadEnabled] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [editBusy, setEditBusy] = useState(false);

  const chatLanguage: SupportedLanguage = useMemo(() => {
    const activeLang = activeConversationId
      ? chatLanguageByConversationId[activeConversationId]
      : undefined;
    const candidate =
      activeLang ||
      draftChatLanguage ||
      i18n.language ||
      localStorage.getItem('i18nextLng') ||
      'en';
    const base = String(candidate).split('-')[0];
    return (isValidLanguage(base) ? base : 'en') as SupportedLanguage;
  }, [activeConversationId, chatLanguageByConversationId, draftChatLanguage, i18n.language]);

  // Voice Hook (uses autoReadEnabled state)
  const {
    speak,
    stopSpeaking,
    state: voiceState,
    startListening,
    stopListening,
    settings: voiceSettings,
    updateSettings: updateVoiceSettings,
    isSupported: ttsSupported,
  } = useUniversalVoice({
    onSendMessage: (msg) => handleSendMessage(msg),
    settings: {
      autoSpeakResponses: autoReadEnabled,
      sttProvider: 'whisper',
      ttsProvider: 'openai',
      language: chatLanguage,
    },
  });

  const {
    isDemo,
    timeRemainingMs: demoTimeRemainingMs,
    aiInteractionsRemaining,
    aiInteractionsLimit,
    consumeAIInteraction,
  } = useDemoSession();
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([]);
  const [dtHintDismissed, setDtHintDismissed] = useState(false);
  const [dtSavingDecision, setDtSavingDecision] = useState<string | null>(null);
  const [dtDecisionSaved, setDtDecisionSaved] = useState<Set<string>>(new Set());
  const [dtPendingConfirm, setDtPendingConfirm] = useState<{
    messageId: string;
    conversationId: string | null;
    originalMessage: string;
    editedMessage: string;
    confirm: any;
    context: any;
    attachments?: any[];
    agentAudit?: {
      suggested?: any;
      orchestratorRunId?: string;
      selectedAgentIds: string[];
      userIntent: 'validate' | 'stress_test' | 'approve';
      maxAgents: 2 | 3 | 4;
      decisionContext?: {
        topic: string;
        industry?: string;
        horizon?: string;
        functions?: string[];
        riskFocus?: string[];
      };
    };
  } | null>(null);
  const [dtConfirmBusy, setDtConfirmBusy] = useState(false);

  // Agent Audit Layer (registry + post-DT verdict)
  const [agentRegistryById, setAgentRegistryById] = useState<Record<string, any>>({});
  const [agentAuditBusy, setAgentAuditBusy] = useState(false);
  const [agentAuditActiveTabByMessageId, setAgentAuditActiveTabByMessageId] = useState<
    Record<string, string>
  >({});
  const deepThinkingRunRef = useRef<{
    conversationId: string | null;
    decisionContext: {
      topic: string;
      industry?: string;
      horizon?: string;
      functions?: string[];
      riskFocus?: string[];
    };
    agentIds: string[];
    userIntent: 'validate' | 'stress_test' | 'approve';
    loopIteration: 1 | 2;
    deepThinkingConfirm: any;
  } | null>(null);
  const agentAuditVerdictRef = useRef<any>(null);
  const persistedAgentAuditRunIdsRef = useRef<Set<string>>(new Set());

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoReadEnabledRef = useRef(autoReadEnabled);

  // Keep ref in sync with state
  useEffect(() => {
    autoReadEnabledRef.current = autoReadEnabled;
  }, [autoReadEnabled]);

  // Agent registry (for readable labels in approval UI)
  useEffect(() => {
    let mounted = true;
    Api.agentAuditListAgents()
      .then((res: any) => {
        const list = (res as any)?.agents || [];
        if (!mounted) return;
        const map: Record<string, any> = {};
        for (const a of list) {
          if (a?.id) map[String(a.id)] = a;
        }
        setAgentRegistryById(map);
      })
      .catch(() => {
        // best-effort; UI will fall back to ids
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Computed values
  const isSplitMode = mode === 'split' || displayMode === 'split';
  const isCompact = isSplitMode;
  const isDisabled = disabled || aiFreezeStatus.isFrozen;

  // ========================================================================
  // AI Stream hook
  // ========================================================================

  const {
    startStream,
    abortStream,
    retryLastStream,
    lastError,
    clearLastError,
    isStreaming,
    streamedContent,
    researchProgress,
    researchVisibility,
    deepThinkingState,
    deepThinkingHint,
    interimInsight,
    agentAuditState,
    agentAuditVerdict,
  } = useAIStream({
    onStreamDone: async (fullText, thinking, artifacts) => {
      const safeText =
        typeof fullText === 'string' && fullText.trim().length > 0
          ? fullText
          : t(
              'thinking.processing',
              '⚠️ AI returned an empty response. Check backend LLM provider configuration.'
            );

      const artifactsForConversation: Array<{
        id: string;
        type: string;
        title: string;
        content: string;
        language?: string;
      }> = (artifacts || []).map((a) => ({
        id: a.id,
        type: String((a as any).type),
        title: String((a as any).title || 'Artifact'),
        content: String((a as any).content || ''),
        language: (a as any).language,
      }));

      // Save AI response to conversation store
      if (activeConversationId) {
        try {
          await addMessageToConversation({
            conversationId: activeConversationId,
            role: 'ai',
            content: safeText,
            messageType: 'text',
            metadata: {
              thinkingSteps: thinking as any,
              artifacts: artifactsForConversation,
              ...(aiConfig?.deepResearch
                ? {
                    options: [
                      { id: 'dt-go-deeper', label: 'Go deeper', value: 'Go deeper' },
                      { id: 'dt-too-shallow', label: 'Too shallow', value: 'Too shallow' },
                      {
                        id: 'dt-challenge',
                        label: 'Challenge this conclusion',
                        value: 'Challenge this conclusion',
                      },
                    ],
                    multiSelect: false,
                    deepThinking: { kind: 'report' },
                  }
                : {}),
            },
          });
        } catch (err) {
          console.error('[UnifiedChatPanel] Failed to save AI message:', err);
        }
      }

      // Also update useAppStore for backward compatibility
      addChatMessage({
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: safeText,
        timestamp: new Date(),
        thinkingSteps: thinking,
        artifacts,
        ...(aiConfig?.deepResearch
          ? ({
              options: [
                { id: 'dt-go-deeper', label: 'Go deeper', value: 'Go deeper' },
                { id: 'dt-too-shallow', label: 'Too shallow', value: 'Too shallow' },
                {
                  id: 'dt-challenge',
                  label: 'Challenge this conclusion',
                  value: 'Challenge this conclusion',
                },
              ],
              multiSelect: false,
              metadata: { deepThinking: { kind: 'report' } },
            } as any)
          : {}),
      });

      // Auto-read AI response if enabled (use ref for current value)
      if (autoReadEnabledRef.current && safeText) {
        speak(safeText);
      }

      // Agent Audit Layer: run post-DT review on the CLOSED report
      if (
        aiConfig?.deepResearch &&
        deepThinkingRunRef.current &&
        deepThinkingRunRef.current.conversationId === activeConversationId &&
        Array.isArray(deepThinkingRunRef.current.agentIds) &&
        deepThinkingRunRef.current.agentIds.length > 0
      ) {
        try {
          // Prefer streamed verdict (from SSE) if present; fallback to REST review otherwise.
          const streamed = agentAuditVerdictRef.current;
          const streamedRunId = String(streamed?.orchestratorRunId || '').trim();
          const canUseStreamed =
            streamed &&
            streamed?.verdict &&
            Array.isArray(streamed?.reviews) &&
            streamed?.reviews?.length >= 0 &&
            streamed?.loopIteration === deepThinkingRunRef.current.loopIteration &&
            !persistedAgentAuditRunIdsRef.current.has(streamedRunId);

          let verdict: any = null;
          let reviews: any[] = [];
          let runId: string | null = null;

          if (canUseStreamed) {
            verdict = streamed.verdict || {};
            reviews = streamed.reviews || [];
            runId = streamedRunId || null;
          } else {
            setAgentAuditBusy(true);
            const reviewRes = await Api.agentAuditReview({
              decisionContext: deepThinkingRunRef.current.decisionContext,
              deepThinkingReport: safeText,
              agentIds: deepThinkingRunRef.current.agentIds,
              conversationId: activeConversationId || undefined,
              dtSessionId: activeConversationId || undefined,
              webSearchEnabled: aiConfig?.webSearch === true,
              userIntent: deepThinkingRunRef.current.userIntent,
              language: chatLanguage,
              selectedTier: (aiConfig as any)?.selectedTier,
              selectedModelId: (aiConfig as any)?.selectedModelId ?? null,
              loopIteration: deepThinkingRunRef.current.loopIteration,
            });
            verdict = (reviewRes as any)?.verdict || {};
            reviews = (reviewRes as any)?.reviews || [];
            runId = String((reviewRes as any)?.orchestratorRunId || '').trim() || null;
          }

          const lines: string[] = [];
          lines.push('**Agent Audit (post Deep Thinking)**');
          lines.push(`- Status: **${String(verdict.qualityStatus || '—')}**`);
          lines.push(
            `- Gates: ${Array.isArray(verdict.gatesTriggered) && verdict.gatesTriggered.length ? verdict.gatesTriggered.join(', ') : '—'}`
          );
          lines.push(`- Reviewers: ${deepThinkingRunRef.current.agentIds.length}`);
          lines.push('');

          if (Array.isArray(verdict.criticalRisks) && verdict.criticalRisks.length) {
            lines.push('**Critical risks (high)**');
            for (const r of verdict.criticalRisks.slice(0, 6)) {
              lines.push(
                `- (${String(r.area || 'other')}) ${String(r.claim || '').trim()}`.trim()
              );
            }
            lines.push('');
          }

          if (Array.isArray(verdict.actionableFollowups) && verdict.actionableFollowups.length) {
            lines.push('**Actionable follow-ups (data / gaps)**');
            for (const f of verdict.actionableFollowups.slice(0, 6)) {
              lines.push(`- ${String(f.question || '').trim()}`.trim());
            }
            lines.push('');
          }

          if (verdict?.directedLoop?.deepThinkingPrompt) {
            lines.push('**Directed deepening prompt (max 2 loops)**');
            lines.push('```');
            lines.push(String(verdict.directedLoop.deepThinkingPrompt || '').trim());
            lines.push('```');
          }

          const verdictMessageContent = lines.filter(Boolean).join('\n');
          const verdictMessageId = `agent-audit-${Date.now()}`;

          // Persist verdict into conversation (survives refresh)
          if (activeConversationId) {
            await addMessageToConversation({
              conversationId: activeConversationId,
              role: 'ai',
              content: verdictMessageContent,
              messageType: 'text',
              metadata: {
                agentAudit: {
                  kind: 'verdict',
                  orchestratorRunId: runId,
                  verdict,
                  reviews,
                  decisionContext: deepThinkingRunRef.current.decisionContext,
                  agentIds: deepThinkingRunRef.current.agentIds,
                  userIntent: deepThinkingRunRef.current.userIntent,
                  loopIteration: deepThinkingRunRef.current.loopIteration,
                },
              } as any,
            });
          }

          // Also add to legacy global store
          addChatMessage({
            id: verdictMessageId,
            role: 'ai',
            content: verdictMessageContent,
            timestamp: new Date(),
            metadata: {
              agentAudit: {
                kind: 'verdict',
                orchestratorRunId: runId,
                verdict,
                reviews,
                decisionContext: deepThinkingRunRef.current.decisionContext,
                agentIds: deepThinkingRunRef.current.agentIds,
                userIntent: deepThinkingRunRef.current.userIntent,
                loopIteration: deepThinkingRunRef.current.loopIteration,
              },
            },
          } as any);

          if (runId) persistedAgentAuditRunIdsRef.current.add(runId);
        } catch (err) {
          console.error('[UnifiedChatPanel] Agent audit review failed:', err);
        } finally {
          setAgentAuditBusy(false);
        }
      }

      setThinkingSteps([]);
    },
    onStreamError: async (err) => {
      // Make failures visible in the conversation UI (otherwise user only sees their own messages).
      const uiLang = (localStorage.getItem('i18nextLng') || 'en').split('-')[0];
      const friendly =
        uiLang === 'pl'
          ? '⚠️ Nie udało się uruchomić AI. Sprawdź backend (logi) oraz czy jest skonfigurowany dostawca LLM (np. OPENAI_API_KEY / GEMINI_API_KEY).'
          : '⚠️ Failed to start AI. Check backend logs and ensure an LLM provider is configured (e.g. OPENAI_API_KEY / GEMINI_API_KEY).';

      try {
        if (activeConversationId) {
          await addMessageToConversation({
            conversationId: activeConversationId,
            role: 'ai',
            content: friendly,
            messageType: 'text',
            metadata: { error: (err as Error)?.message || String(err) },
          });
        } else {
          addChatMessage({
            id: `ai-error-${Date.now()}`,
            role: 'ai',
            content: friendly,
            timestamp: new Date(),
          });
        }
      } catch (persistErr) {
        console.error('[UnifiedChatPanel] Failed to persist stream error message:', persistErr);
        addChatMessage({
          id: `ai-error-${Date.now()}`,
          role: 'ai',
          content: friendly,
          timestamp: new Date(),
        });
      }
      setThinkingSteps([]);
    },
    onThinkingUpdate: (steps) => {
      setThinkingSteps(steps);
    },
    onArtifactDetected: (artifact) => {
      addArtifact(artifact);
    },
  });

  // Keep the streamed verdict accessible from callbacks without dependency churn
  useEffect(() => {
    agentAuditVerdictRef.current = agentAuditVerdict;
  }, [agentAuditVerdict]);

  // ========================================================================
  // Convert conversation messages to ChatMessage format
  // ========================================================================

  const messages: ChatMessage[] = useMemo(() => {
    return activeMessages.map((msg) => ({
      id: msg.id,
      role: msg.role === 'ai' ? 'ai' : 'user',
      content: msg.content,
      timestamp: msg.createdAt,
      thinkingSteps: msg.metadata?.thinkingSteps as any,
      artifacts: msg.metadata?.artifacts,
      citations: msg.metadata?.citations,
      options: msg.metadata?.options,
      multiSelect: msg.metadata?.multiSelect,
      metadata: msg.metadata as any,
      authorUserId: msg.authorUserId || null,
      authorName: msg.authorName || null,
      isStreaming: false,
    })) as ChatMessage[];
  }, [activeMessages]);

  // Combined messages to display
  const displayMessages = useMemo(() => {
    const baseMessages = customMessages || messages;

    // Always append a streaming AI bubble while streaming, even before first chunk arrives.
    // This enables the Cursor-like "thinking" indicator immediately.
    if (isStreaming) {
      return [
        ...baseMessages,
        {
          id: 'stream',
          role: 'ai' as const,
          content: streamedContent || '',
          timestamp: new Date(),
          isStreaming: true,
          thinkingSteps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
          metadata: {
            deepThinkingState,
            researchProgress,
            researchVisibility,
          },
        },
      ];
    }

    return baseMessages;
  }, [
    messages,
    customMessages,
    isStreaming,
    streamedContent,
    thinkingSteps,
    deepThinkingState,
    researchProgress,
    researchVisibility,
  ]);

  // ========================================================================
  // Scroll to bottom on new messages
  // ========================================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages, isStreaming]);

  // ========================================================================
  // Handlers
  // ========================================================================

  const handleSendMessage = useCallback(
    async (content: string, attachments?: any[]) => {
      if (!content.trim() || isDisabled) return;

      // Demo session enforcement (time + AI interactions quota)
      if (isDemo) {
        if (demoTimeRemainingMs <= 0) {
          window.dispatchEvent(
            new CustomEvent('access:blocked', {
              detail: {
                code: 'DEMO_TIME_EXPIRED',
                message: 'Demo session expired. Start a free trial to continue.',
                cta: { label: 'Start free trial', href: '/auth?mode=register' },
              },
            })
          );
          return;
        }

        if ((aiInteractionsRemaining ?? 0) <= 0) {
          window.dispatchEvent(
            new CustomEvent('access:blocked', {
              detail: {
                code: 'DEMO_AI_SESSION_LIMIT_REACHED',
                message: `Demo AI limit reached (${aiInteractionsLimit ?? 0}). Start a free trial to continue.`,
                cta: { label: 'Start free trial', href: '/auth?mode=register' },
              },
            })
          );
          return;
        }

        // Count this interaction once per user send
        consumeAIInteraction();
      }

      // Create conversation if none exists
      let conversationId = activeConversationId;
      if (!conversationId) {
        try {
          const conv = await createConversation();
          conversationId = conv.id;
        } catch (err) {
          console.error('[UnifiedChatPanel] Failed to create conversation:', err);
        }
      }

      // Save user message to conversation store
      if (conversationId) {
        try {
          await addMessageToConversation({
            conversationId,
            role: 'user',
            content,
            messageType: 'text',
          });
        } catch (err) {
          console.error('[UnifiedChatPanel] Failed to save user message:', err);
        }
      }

      // Also add to useAppStore for backward compatibility
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };
      addChatMessage(userMessage);

      // Build context for AI
      const context = {
        focusMode,
        attachments,
        workspaceContext,
        conversationId,
        conversationLanguage: chatLanguage,
      };

      // Backend expects history roles as: user | model (Gemini-style)
      const history = (customMessages || messages).map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const normalized = String(content || '')
        .trim()
        .toLowerCase();
      const forceDepthTriggers = [
        'go deeper',
        'too shallow',
        'challenge this conclusion',
        // Polish (accept as user input too)
        'idź głębiej',
        'za płytkie',
        'podważ wnioski',
        'podważ tę konkluzję',
        'podważ tę rekomendację',
      ];
      const isForceDepth = forceDepthTriggers.includes(normalized);

      // Deep Thinking: force-depth triggers bypass Confirm (they are a quality control action)
      if (aiConfig?.deepResearch && isForceDepth) {
        const base = (customMessages || messages).filter(
          (m) => !((m as any).metadata?.deepThinking?.kind === 'confirm')
        );
        const history = base.map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }));

        // Reuse last confirm payload if present (keeps flow deterministic while not blocking)
        const lastConfirm = (customMessages || messages)
          .slice()
          .reverse()
          .find((m: any) => m?.metadata?.deepThinking?.kind === 'confirm') as any;

        await startStream(
          content,
          history,
          systemPrompt,
          {
            ...(context || {}),
            deepThinkingConfirmed: true,
            deepThinkingConfirm: lastConfirm?.metadata?.deepThinkingConfirm,
            deepThinkingDepth: 'hard',
            forceDepth: true,
          },
          focusMode,
          roleName,
          chatLanguage
        );

        onMessageSent?.(content);
        return;
      }

      // Deep Thinking: blocking Confirm step (no streaming until user confirms)
      if (aiConfig?.deepResearch) {
        if (dtConfirmBusy) return;
        setDtConfirmBusy(true);
        try {
          const confirmRes = await Api.chatConfirm(
            content,
            history,
            systemPrompt,
            context,
            roleName,
            chatLanguage,
            {
              deepResearch: aiConfig?.deepResearch,
              webSearch: aiConfig?.webSearch,
              showReasoning: aiConfig?.showReasoning,
              knowledgeSources: aiConfig?.knowledgeSources,
              responseStyle: aiConfig?.responseStyle,
              selectedTier: (aiConfig as any)?.selectedTier || undefined,
              selectedModelId: (aiConfig as any)?.selectedModelId ?? null,
            }
          );

          const c = (confirmRes as any)?.confirm || {};
          const u = c?.understanding || {};
          // Agent Audit Layer: suggested reviewers (manual approval before DT)
          const decisionContext = {
            topic: String(content || '').trim(),
            horizon: String(u.decisionHorizon || '').trim() || undefined,
            industry: undefined,
            functions: [],
            riskFocus: [],
          };
          let suggestedAgentsSet: any = null;
          try {
            const suggestRes = await Api.agentAuditSuggest({
              decisionContext,
              userIntent: 'validate',
              language: chatLanguage,
              maxAgents: 3,
            });
            suggestedAgentsSet = (suggestRes as any)?.suggested || null;
          } catch {
            // best-effort; DT can proceed without agent layer
          }
          const md = [
            '**My understanding of your task**',
            `- Goal: ${u.goal || ''}`,
            u.context ? `- Context: ${u.context}` : '',
            Array.isArray(u.constraints) && u.constraints.length
              ? `- Constraints: ${u.constraints.join('; ')}`
              : '',
            u.expectedOutput ? `- Output: ${u.expectedOutput}` : '',
            u.decisionHorizon ? `- Horizon: ${u.decisionHorizon}` : '',
            '',
            Array.isArray(c.missingInfoQuestions) && c.missingInfoQuestions.length
              ? `**Assumptions & gaps (optional):**\n${c.missingInfoQuestions
                  .slice(0, 3)
                  .map((q: any, i: number) => `${i + 1}. ${q.question}`)
                  .join('\n')}`
              : '',
            '',
            '_Confirm to start Deep Thinking. Adjust if the task needs correction._',
          ]
            .filter(Boolean)
            .join('\n');

          // Persist confirm card as an AI message (so it survives refresh / history)
          let confirmMessageId = `dt-confirm-${Date.now()}`;
          if (conversationId) {
            const saved = await addMessageToConversation({
              conversationId,
              role: 'ai',
              content: md,
              messageType: 'text',
              metadata: {
                deepThinking: { kind: 'confirm', originalMessage: content },
                deepThinkingConfirm: c,
                agentAuditSuggested: suggestedAgentsSet,
              } as any,
            });
            confirmMessageId = (saved as any)?.id || confirmMessageId;
          } else {
            addChatMessage({
              id: confirmMessageId,
              role: 'ai',
              content: md,
              timestamp: new Date(),
              metadata: {
                deepThinking: { kind: 'confirm', originalMessage: content },
                deepThinkingConfirm: c,
                agentAuditSuggested: suggestedAgentsSet,
              },
            } as any);
          }

          setDtPendingConfirm({
            messageId: confirmMessageId,
            conversationId: conversationId || null,
            originalMessage: content,
            editedMessage: content,
            confirm: c,
            context,
            attachments,
            agentAudit: {
              suggested: suggestedAgentsSet,
              orchestratorRunId: String(suggestedAgentsSet?.orchestratorRunId || ''),
              selectedAgentIds: Array.isArray(suggestedAgentsSet?.agents)
                ? suggestedAgentsSet.agents.map((a: any) => String(a?.agentId || '')).filter(Boolean)
                : [],
              userIntent: 'validate',
              maxAgents: 3,
              decisionContext,
            },
          });

          onMessageSent?.(content);
          return;
        } catch (err) {
          console.error('[UnifiedChatPanel] Deep Thinking confirm failed:', err);
          throw err;
        } finally {
          setDtConfirmBusy(false);
        }
      }

      // Add placeholder for AI response in useAppStore (legacy + non-conversation views)
      addChatMessage({
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      });

      // Start streaming (standard mode)
      await startStream(content, history, systemPrompt, context, focusMode, roleName, chatLanguage);

      // Callback
      onMessageSent?.(content);
    },
    [
      activeConversationId,
      createConversation,
      addMessageToConversation,
      addChatMessage,
      displayMessages,
      messages,
      customMessages,
      focusMode,
      chatLanguage,
      workspaceContext,
      startStream,
      isDisabled,
      isDemo,
      demoTimeRemainingMs,
      aiInteractionsRemaining,
      aiInteractionsLimit,
      consumeAIInteraction,
      onMessageSent,
      aiConfig,
      dtConfirmBusy,
      addMessageToConversation,
    ]
  );

  const handleDeepThinkingProceed = useCallback(async () => {
    if (!dtPendingConfirm) return;
    if (isDisabled) return;

    // Build backend-compatible history, excluding confirm cards (they are UI-only)
    const base = (customMessages || messages).filter(
      (m) => !((m as any).metadata?.deepThinking?.kind === 'confirm')
    );
    const history = base.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const depthRaw = dtPendingConfirm?.confirm?.suggestedDepth || 'Standard';
    const depth = String(depthRaw).toLowerCase(); // light|standard|hard

    // Agent Audit Layer: lock context for post-DT review + directed loop
    const agentIds =
      dtPendingConfirm.agentAudit?.selectedAgentIds ||
      (Array.isArray(dtPendingConfirm.agentAudit?.suggested?.agents)
        ? dtPendingConfirm.agentAudit?.suggested?.agents
            ?.map((a: any) => String(a?.agentId || '').trim())
            .filter(Boolean)
        : []);
    const decisionContext =
      dtPendingConfirm.agentAudit?.decisionContext || ({
        topic: String(dtPendingConfirm.editedMessage || dtPendingConfirm.originalMessage || '').trim(),
        horizon: String(dtPendingConfirm?.confirm?.understanding?.decisionHorizon || '').trim() || undefined,
        industry: undefined,
        functions: [],
        riskFocus: [],
      } as any);

    deepThinkingRunRef.current = {
      conversationId: dtPendingConfirm.conversationId,
      decisionContext,
      agentIds,
      userIntent: dtPendingConfirm.agentAudit?.userIntent || 'validate',
      loopIteration: 1,
      deepThinkingConfirm: dtPendingConfirm.confirm,
    };

    // Persist approved agent set for transparency/history
    if (dtPendingConfirm.conversationId) {
      try {
        const suggested = dtPendingConfirm.agentAudit?.suggested?.agents || [];
        const selectedSet = new Set(agentIds);
        const selectedAgents = (Array.isArray(suggested) ? suggested : [])
          .map((a: any) => ({
            agentId: String(a?.agentId || '').trim(),
            whySelected: String(a?.whySelected || '').trim(),
          }))
          .filter((a: any) => a.agentId && selectedSet.has(a.agentId));

        const lines: string[] = [];
        lines.push('**Agent Audit — approved reviewers (pre Deep Thinking)**');
        lines.push(`- Intent: **${String(dtPendingConfirm.agentAudit?.userIntent || 'validate')}**`);
        lines.push(`- Max agents: **${String(dtPendingConfirm.agentAudit?.maxAgents || 3)}**`);
        lines.push('');
        for (const a of selectedAgents) {
          const label =
            agentRegistryById[a.agentId]?.displayName?.pl ||
            agentRegistryById[a.agentId]?.displayName?.en ||
            a.agentId;
          lines.push(`- **${String(label)}**`);
          if (a.whySelected) lines.push(`  - ${a.whySelected}`);
        }

        const approvalContent = lines.filter(Boolean).join('\n');
        await addMessageToConversation({
          conversationId: dtPendingConfirm.conversationId,
          role: 'ai',
          content: approvalContent,
          messageType: 'text',
          metadata: {
            agentAudit: {
              kind: 'approval',
              suggested: dtPendingConfirm.agentAudit?.suggested || null,
              selectedAgentIds: agentIds,
              userIntent: dtPendingConfirm.agentAudit?.userIntent || 'validate',
              maxAgents: dtPendingConfirm.agentAudit?.maxAgents || 3,
              decisionContext,
            },
          } as any,
        });
      } catch {
        // best-effort
      }
    }

    // Legacy placeholder in global store
    addChatMessage({
      id: `ai-${Date.now()}`,
      role: 'ai',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    });

    // Start stream with Deep Thinking context hints
    await startStream(
      dtPendingConfirm.editedMessage || dtPendingConfirm.originalMessage,
      history,
      systemPrompt,
      {
        ...(dtPendingConfirm.context || {}),
        deepThinkingConfirmed: true,
        deepThinkingConfirm: dtPendingConfirm.confirm,
        deepThinkingDepth: depth,
        agentAudit: {
          orchestratorRunId: dtPendingConfirm.agentAudit?.orchestratorRunId || null,
          agentIds,
          userIntent: dtPendingConfirm.agentAudit?.userIntent || 'validate',
          loopIteration: 1,
          decisionContext,
        },
      },
      focusMode,
      roleName,
      chatLanguage
    );

    setDtPendingConfirm(null);
  }, [
    dtPendingConfirm,
    isDisabled,
    customMessages,
    messages,
    addChatMessage,
    addMessageToConversation,
    agentRegistryById,
    startStream,
    systemPrompt,
    focusMode,
    roleName,
    chatLanguage,
  ]);

  const handleDeepThinkingReconfirm = useCallback(async () => {
    if (!dtPendingConfirm) return;
    if (dtConfirmBusy) return;
    setDtConfirmBusy(true);
    try {
      const base = (customMessages || messages).filter(
        (m) => !((m as any).metadata?.deepThinking?.kind === 'confirm')
      );
      const history = base.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const confirmRes = await Api.chatConfirm(
        dtPendingConfirm.editedMessage || dtPendingConfirm.originalMessage,
        history,
        systemPrompt,
        dtPendingConfirm.context,
        roleName,
        chatLanguage,
        {
          deepResearch: aiConfig?.deepResearch,
          webSearch: aiConfig?.webSearch,
          showReasoning: aiConfig?.showReasoning,
          knowledgeSources: aiConfig?.knowledgeSources,
          responseStyle: aiConfig?.responseStyle,
          selectedTier: (aiConfig as any)?.selectedTier || undefined,
          selectedModelId: (aiConfig as any)?.selectedModelId ?? null,
        }
      );

      const c = (confirmRes as any)?.confirm || {};
      // Refresh Agent Audit suggestions after reconfirm (task may have changed)
      const u = c?.understanding || {};
      const decisionContext = {
        topic: String(dtPendingConfirm.editedMessage || dtPendingConfirm.originalMessage || '').trim(),
        horizon: String(u.decisionHorizon || '').trim() || undefined,
        industry: undefined,
        functions: [],
        riskFocus: [],
      };
      let suggestedAgentsSet: any = null;
      try {
        const suggestRes = await Api.agentAuditSuggest({
          decisionContext,
          userIntent: dtPendingConfirm.agentAudit?.userIntent || 'validate',
          language: chatLanguage,
          maxAgents: dtPendingConfirm.agentAudit?.maxAgents || 3,
        });
        suggestedAgentsSet = (suggestRes as any)?.suggested || null;
      } catch {
        // ignore
      }

      setDtPendingConfirm((prev) => {
        if (!prev) return prev;
        const prevSelected = prev.agentAudit?.selectedAgentIds || [];
        const nextSuggestedIds = Array.isArray(suggestedAgentsSet?.agents)
          ? suggestedAgentsSet.agents.map((a: any) => String(a?.agentId || '')).filter(Boolean)
          : prevSelected;
        const nextSelected =
          prevSelected.length > 0
            ? nextSuggestedIds.filter((id: string) => prevSelected.includes(id))
            : nextSuggestedIds;
        return {
          ...prev,
          confirm: c,
          agentAudit: {
            ...(prev.agentAudit || {
              selectedAgentIds: [],
              userIntent: 'validate',
              maxAgents: 3,
            }),
            suggested: suggestedAgentsSet || prev.agentAudit?.suggested,
            orchestratorRunId: String(
              suggestedAgentsSet?.orchestratorRunId || prev.agentAudit?.orchestratorRunId || ''
            ),
            selectedAgentIds: nextSelected,
            decisionContext,
          },
        };
      });
    } catch (err) {
      console.error('[UnifiedChatPanel] Deep Thinking reconfirm failed:', err);
      throw err;
    } finally {
      setDtConfirmBusy(false);
    }
  }, [
    dtPendingConfirm,
    dtConfirmBusy,
    customMessages,
    messages,
    systemPrompt,
    roleName,
    chatLanguage,
    aiConfig,
  ]);

  const refreshAgentAuditSuggestionsOnly = useCallback(
    async (overrides?: { userIntent?: 'validate' | 'stress_test' | 'approve'; maxAgents?: 2 | 3 | 4 }) => {
      if (!dtPendingConfirm) return;
      const decisionContext =
        dtPendingConfirm.agentAudit?.decisionContext || ({
          topic: String(dtPendingConfirm.editedMessage || dtPendingConfirm.originalMessage || '').trim(),
          industry: undefined,
          horizon: undefined,
          functions: [],
          riskFocus: [],
        } as any);

      const userIntent =
        overrides?.userIntent || dtPendingConfirm.agentAudit?.userIntent || ('validate' as const);
      const maxAgents = overrides?.maxAgents || dtPendingConfirm.agentAudit?.maxAgents || (3 as 3);

      try {
        const suggestRes = await Api.agentAuditSuggest({
          decisionContext,
          userIntent,
          language: chatLanguage,
          maxAgents,
        });
        const suggestedAgentsSet = (suggestRes as any)?.suggested || null;

        setDtPendingConfirm((prev) => {
          if (!prev?.agentAudit) return prev;
          const prevSelected = prev.agentAudit.selectedAgentIds || [];
          const nextSuggestedIds = Array.isArray(suggestedAgentsSet?.agents)
            ? suggestedAgentsSet.agents.map((a: any) => String(a?.agentId || '')).filter(Boolean)
            : prevSelected;

          // Preserve previous selections where possible; otherwise default to suggested list.
          const nextSelected =
            prevSelected.length > 0
              ? nextSuggestedIds.filter((id: string) => prevSelected.includes(id))
              : nextSuggestedIds;

          return {
            ...prev,
            agentAudit: {
              ...prev.agentAudit,
              suggested: suggestedAgentsSet || prev.agentAudit.suggested,
              orchestratorRunId: String(
                suggestedAgentsSet?.orchestratorRunId || prev.agentAudit.orchestratorRunId || ''
              ),
              selectedAgentIds: nextSelected.slice(0, maxAgents),
              userIntent,
              maxAgents,
              decisionContext,
            },
          };
        });
      } catch {
        // best-effort; DT can proceed without agent layer
      }
    },
    [dtPendingConfirm, chatLanguage]
  );

  const handleRunDirectedDeepening = useCallback(
    async (agentAuditPayload: any) => {
      const prompt = String(agentAuditPayload?.verdict?.directedLoop?.deepThinkingPrompt || '').trim();
      if (!prompt) return;
      if (isDisabled) return;

      const run = deepThinkingRunRef.current;
      if (!run) return;
      if (run.loopIteration >= 2) return;

      const nextIteration = ((run.loopIteration + 1) as 2) || 2;
      run.loopIteration = nextIteration;

      // Build backend-compatible history, excluding confirm cards
      const base = (customMessages || messages).filter(
        (m) => !((m as any).metadata?.deepThinking?.kind === 'confirm')
      );
      const history = base.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      // Legacy placeholder in global store
      addChatMessage({
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      });

      await startStream(
        prompt,
        history,
        systemPrompt,
        {
          deepThinkingConfirmed: true,
          deepThinkingConfirm: run.deepThinkingConfirm,
          deepThinkingDepth: 'hard',
          forceDepth: true,
          agentAudit: {
            agentIds: run.agentIds,
            userIntent: run.userIntent,
            loopIteration: nextIteration,
            decisionContext: run.decisionContext,
          },
        },
        focusMode,
        roleName,
        chatLanguage
      );
    },
    [
      addChatMessage,
      chatLanguage,
      customMessages,
      focusMode,
      isDisabled,
      messages,
      roleName,
      startStream,
      systemPrompt,
    ]
  );

  const handleNewChat = useCallback(async () => {
    clearActiveChat();
    try {
      const conv = await createConversation();
      setActiveConversation(conv.id);
    } catch (err) {
      console.error('[UnifiedChatPanel] Failed to create new chat:', err);
    }
  }, [clearActiveChat, createConversation, setActiveConversation]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveConversation(id);
    },
    [setActiveConversation]
  );

  const handleCopyMessage = useCallback(
    async (content: string, messageId: string) => {
      try {
        await navigator.clipboard.writeText(content);
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000);

        // Deep Thinking ops metric: "copied" as a reuse signal (best-effort)
        if (aiConfig?.deepResearch && activeConversationId) {
          Api.deepThinkingEvent({
            eventType: 'copied',
            sessionId: activeConversationId,
            conversationId: activeConversationId,
            payload: { messageId },
          }).catch(() => {
            /* ignore */
          });
        }
      } catch (err) {
        console.error('Failed to copy message:', err);
      }
    },
    [activeConversationId, aiConfig?.deepResearch]
  );

  const handleModeToggle = useCallback(() => {
    if (isSplitMode) {
      expandToFullScreen();
    } else {
      collapseToSplit();
    }
    onModeToggle?.();
  }, [isSplitMode, expandToFullScreen, collapseToSplit, onModeToggle]);

  const handleViewArtifacts = useCallback(
    (artifacts: Artifact[]) => {
      artifacts.forEach((artifact) => addArtifact(artifact));
      toggleArtifactsPanel(true);
    },
    [addArtifact, toggleArtifactsPanel]
  );

  // Deep Thinking: Save output as Decision
  const handleSaveAsDecision = useCallback(
    async (messageId: string, content: string) => {
      if (!activeConversationId) return;
      setDtSavingDecision(messageId);
      try {
        await Api.saveDeepThinkingDecision({
          sessionId: activeConversationId,
          conversationId: activeConversationId,
          content,
        });
        setDtDecisionSaved((prev) => new Set(prev).add(messageId));
      } catch (err) {
        console.error('[UnifiedChatPanel] Failed to save decision:', err);
      } finally {
        setDtSavingDecision(null);
      }
    },
    [activeConversationId]
  );

  // Deep Thinking: Enable DT mode from hint banner
  const handleEnableDeepThinking = useCallback(() => {
    setDtHintDismissed(true);
    // Toggle Deep Thinking in aiConfig
    const { setAIConfig } = useAppStore.getState();
    if (typeof setAIConfig === 'function') {
      setAIConfig({ ...aiConfig, deepResearch: true } as any);
    }
  }, [aiConfig]);

  /**
   * Handle feedback submission for AI responses
   * Integrated with FeedbackService for learning system
   */
  const handleFeedback = useCallback(
    async (messageId: string, messageContent: string, feedback: ResponseFeedback) => {
      try {
        // Find the user message that triggered this AI response
        const messageIndex = displayMessages.findIndex((m) => m.id === messageId);
        const userMessage = messageIndex > 0 ? displayMessages[messageIndex - 1]?.content : '';

        // Send detailed feedback to v2.0 adaptive system
        await Api.aiFeedback({
          messageId,
          conversationId: activeConversationId || undefined,
          rating: feedback.rating,
          lengthFeedback: feedback.lengthFeedback,
          detailFeedback: feedback.detailFeedback,
          wantedMode: feedback.wantedMode,
          customFeedback: feedback.customFeedback,
          screenContext: workspaceContext?.type,
          focusMode: focusMode,
          responseMode: focusMode, // Map focusMode to responseMode for learning
          capability: workspaceContext?.type || 'chat',
        });

        console.log('[UnifiedChatPanel] Detailed feedback submitted via Api.aiFeedback:', {
          messageId,
          conversationId: activeConversationId,
          rating: feedback.rating,
          hasDetailedFeedback: !!(
            feedback.lengthFeedback ||
            feedback.detailFeedback ||
            feedback.wantedMode
          ),
        });
      } catch (err) {
        console.error('[UnifiedChatPanel] Failed to submit specific feedback:', err);
      }
    },
    [displayMessages, workspaceContext, activeConversationId]
  );

  const handleMultiSelectToggle = (value: string) => {
    setSelectedMultiOptions((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleMultiSelectConfirm = () => {
    if (selectedMultiOptions.length > 0) {
      if (onMultiSelectSubmit) {
        onMultiSelectSubmit(selectedMultiOptions);
      } else if (onOptionSelect) {
        onOptionSelect({
          id: 'multi-confirm',
          label: t('chat.confirmSelection', 'Confirm Selection'),
          value: selectedMultiOptions.join(', '),
        });
      }
      setSelectedMultiOptions([]);
    }
  };

  // ========================================================================
  // Inline edit & regenerate (ChatGPT-like)
  // ========================================================================

  const handleStartEditMessage = useCallback(
    (messageId: string) => {
      const msg = displayMessages.find((m) => m.id === messageId);
      if (!msg || msg.role !== 'user') return;
      if (String(msg.id || '').startsWith('local-')) return;
      setEditingMessageId(messageId);
      setEditingText(msg.content || '');
    },
    [displayMessages]
  );

  const handleCancelEditMessage = useCallback(() => {
    setEditingMessageId(null);
    setEditingText('');
  }, []);

  const handleCommitEditMessage = useCallback(async () => {
    if (!editingMessageId) return;
    const newText = editingText.trim();
    if (!newText) return;
    if (!activeConversationId) return;
    if (editBusy || isStreaming) return;

    setEditBusy(true);
    try {
      await truncateFromMessage(editingMessageId, newText);

      const msgs = useConversationStore.getState().activeMessages || [];
      const idx = msgs.findIndex((m: any) => m.id === editingMessageId);
      const before = idx >= 0 ? msgs.slice(0, idx) : msgs;
      const history = before
        .filter((m: any) => m?.content && String(m.content).trim().length > 0)
        .map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: String(m.content || '') }],
        }));

      const context = {
        focusMode,
        attachments: [],
        workspaceContext,
        conversationId: activeConversationId,
        conversationLanguage: chatLanguage,
      };

      if (aiConfig?.deepResearch) {
        if (dtConfirmBusy) return;
        setDtConfirmBusy(true);
        try {
          const confirmRes = await Api.chatConfirm(
            newText,
            history,
            systemPrompt,
            context,
            roleName,
            chatLanguage,
            {
              deepResearch: aiConfig?.deepResearch,
              webSearch: aiConfig?.webSearch,
              showReasoning: aiConfig?.showReasoning,
              knowledgeSources: aiConfig?.knowledgeSources,
              responseStyle: aiConfig?.responseStyle,
              selectedTier: (aiConfig as any)?.selectedTier || undefined,
              selectedModelId: (aiConfig as any)?.selectedModelId ?? null,
            }
          );

          const c = (confirmRes as any)?.confirm || {};
          const u = c?.understanding || {};
          const md = [
            '**My understanding of your task**',
            `- Goal: ${u.goal || ''}`,
            u.context ? `- Context: ${u.context}` : '',
            Array.isArray(u.constraints) && u.constraints.length
              ? `- Constraints: ${u.constraints.join('; ')}`
              : '',
            u.expectedOutput ? `- Output: ${u.expectedOutput}` : '',
            u.decisionHorizon ? `- Horizon: ${u.decisionHorizon}` : '',
            '',
            Array.isArray(c.missingInfoQuestions) && c.missingInfoQuestions.length
              ? `**Assumptions & gaps (optional):**\n${c.missingInfoQuestions
                  .slice(0, 3)
                  .map((q: any, i: number) => `${i + 1}. ${q.question}`)
                  .join('\n')}`
              : '',
            '',
            '_Confirm to start Deep Thinking. Adjust if the task needs correction._',
          ]
            .filter(Boolean)
            .join('\n');

          const saved = await addMessageToConversation({
            conversationId: activeConversationId,
            role: 'ai',
            content: md,
            messageType: 'text',
            metadata: {
              deepThinking: { kind: 'confirm', originalMessage: newText },
              deepThinkingConfirm: c,
            } as any,
          });
          const confirmMessageId = (saved as any)?.id || `dt-confirm-${Date.now()}`;

          setDtPendingConfirm({
            messageId: confirmMessageId,
            conversationId: activeConversationId,
            originalMessage: newText,
            editedMessage: newText,
            confirm: c,
            context,
            attachments: [],
          } as any);
        } finally {
          setDtConfirmBusy(false);
        }
      } else {
        await startStream(newText, history, systemPrompt, context, focusMode, roleName, chatLanguage);
      }

      handleCancelEditMessage();
    } catch (e) {
      console.error('[UnifiedChatPanel] Edit & regenerate failed:', e);
    } finally {
      setEditBusy(false);
    }
  }, [
    activeConversationId,
    addMessageToConversation,
    aiConfig,
    chatLanguage,
    dtConfirmBusy,
    editBusy,
    editingMessageId,
    editingText,
    focusMode,
    handleCancelEditMessage,
    isStreaming,
    roleName,
    startStream,
    systemPrompt,
    truncateFromMessage,
    workspaceContext,
  ]);

  // ========================================================================
  // Render helpers
  // ========================================================================

  const renderMessage = (msg: ChatMessage, index: number) => {
    const isLastMessage = index === displayMessages.length - 1;
    const isHovered = hoveredMessageId === msg.id;
    const hasArtifacts = msg.artifacts && msg.artifacts.length > 0;
    const hasThinkingSteps = msg.thinkingSteps && msg.thinkingSteps.length > 0;
    const hasCitations = msg.citations && msg.citations.length > 0;
    const isCopied = copiedMessageId === msg.id;
    const isDeepThinkingConfirm = (msg as any).metadata?.deepThinking?.kind === 'confirm';
    const confirmPayload =
      isDeepThinkingConfirm && dtPendingConfirm?.messageId === msg.id
        ? dtPendingConfirm.confirm
        : (msg as any).metadata?.deepThinkingConfirm;

    return (
      <div
        key={msg.id}
        className={`flex flex-col space-y-1.5 group ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
        onMouseEnter={() => setHoveredMessageId(msg.id)}
        onMouseLeave={() => setHoveredMessageId(null)}
      >
        {/* Thinking Steps (for AI messages) */}
        {msg.role === 'ai' && hasThinkingSteps && (
          <div className={`w-full ${isCompact ? 'ml-7' : 'ml-9'} max-w-[85%]`}>
            <ThinkingBlock
              steps={msg.thinkingSteps!}
              isStreaming={msg.isStreaming}
              defaultExpanded={msg.isStreaming === true && !msg.content}
            />
          </div>
        )}

        <div
          className={`flex gap-2 ${isCompact ? 'gap-2' : 'gap-3'} ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
        >
          {/* Avatar */}
          <div
            className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
              msg.role === 'ai'
                ? 'bg-primary-50 dark:bg-primary-900/50 border-primary-200 dark:border-primary-700'
                : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
            }`}
          >
            {msg.role === 'ai' ? (
              <Bot size={isCompact ? 12 : 14} className="text-primary-600 dark:text-primary-400" />
            ) : (
              <User size={isCompact ? 12 : 14} className="text-slate-400 dark:text-slate-300" />
            )}
          </div>

          {/* Message Bubble */}
          <div className="flex flex-col max-w-[85%]">
            {/* Author name for team messages */}
            {msg.role === 'user' && msg.authorName && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5 text-right pr-1 font-medium">
                {msg.authorName}
              </span>
            )}
            <div
              className={`relative rounded-xl px-3 py-2 ${isCompact ? 'text-xs' : 'text-sm'} leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-tr-none'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-navy-700 rounded-tl-none'
              }`}
            >
              {/* AI Message Content */}
              {msg.role === 'ai' ? (
                <div
                  className={`${isDeepThinkingConfirm ? 'not-prose' : `prose ${isCompact ? 'prose-xs' : 'prose-sm'} dark:prose-invert`} max-w-none`}
                >
                  {/* Deep Thinking: Research progress (SSE events) */}
                  {(msg as any).metadata?.researchVisibility?.items && (
                    <div className={`${isCompact ? 'mb-2' : 'mb-3'} not-prose`}>
                      <div className="mb-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        Research & Sources (planned)
                      </div>
                      <div className="space-y-1">
                        {(msg as any).metadata?.researchVisibility?.items
                          ?.slice(0, 6)
                          .map((it: any) => (
                            <div
                              key={it.id}
                              className="flex items-start justify-between gap-2 text-[11px] bg-white/60 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700 rounded-md px-2 py-1"
                            >
                              <div className="min-w-0">
                                <div className="text-slate-700 dark:text-slate-200 truncate">
                                  {it.label}
                                </div>
                                {it.rationale ? (
                                  <div className="text-slate-400 dark:text-slate-500 truncate">
                                    {it.rationale}
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex-shrink-0 text-slate-500 dark:text-slate-400">
                                {String(it.status || 'planned')}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {(msg as any).metadata?.researchProgress && (
                    <div className={`${isCompact ? 'mb-2' : 'mb-3'} not-prose`}>
                      {((msg as any).metadata?.researchProgress?.error as string | undefined) && (
                        <div className="mb-2 text-[11px] text-amber-600 dark:text-amber-400">
                          {(msg as any).metadata?.researchProgress?.error}
                        </div>
                      )}
                      <ResearchProgress
                        topic={String((msg as any).metadata?.researchProgress?.topic || '')}
                        stage={
                          ((msg as any).metadata?.researchProgress?.stage || 'searching') as any
                        }
                        queries={((msg as any).metadata?.researchProgress?.queries || []) as any}
                        sources={((msg as any).metadata?.researchProgress?.sources || []) as any}
                      />
                    </div>
                  )}

                  {isDeepThinkingConfirm ? (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Confirm Understanding (Deep Thinking)
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <div className="font-medium">My understanding of your task</div>
                        <ul className="list-disc pl-4 space-y-0.5">
                          <li>
                            <span className="font-medium">Goal:</span>{' '}
                            {String(confirmPayload?.understanding?.goal || '').trim() || '—'}
                          </li>
                          {String(confirmPayload?.understanding?.context || '').trim() ? (
                            <li>
                              <span className="font-medium">Context:</span>{' '}
                              {String(confirmPayload?.understanding?.context || '').trim()}
                            </li>
                          ) : null}
                          {Array.isArray(confirmPayload?.understanding?.constraints) &&
                          confirmPayload.understanding.constraints.length ? (
                            <li>
                              <span className="font-medium">Constraints:</span>{' '}
                              {confirmPayload.understanding.constraints.join('; ')}
                            </li>
                          ) : null}
                          {String(confirmPayload?.understanding?.expectedOutput || '').trim() ? (
                            <li>
                              <span className="font-medium">Output:</span>{' '}
                              {String(confirmPayload.understanding.expectedOutput)}
                            </li>
                          ) : null}
                          {String(confirmPayload?.understanding?.decisionHorizon || '').trim() ? (
                            <li>
                              <span className="font-medium">Horizon:</span>{' '}
                              {String(confirmPayload.understanding.decisionHorizon)}
                            </li>
                          ) : null}
                        </ul>
                      </div>

                      {Array.isArray(confirmPayload?.missingInfoQuestions) &&
                      confirmPayload.missingInfoQuestions.length ? (
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          <div className="font-medium mb-1">Assumptions & gaps (optional)</div>
                          <ol className="list-decimal pl-4 space-y-0.5">
                            {confirmPayload.missingInfoQuestions.slice(0, 3).map((q: any) => (
                              <li key={q.id || q.question}>{q.question}</li>
                            ))}
                          </ol>
                        </div>
                      ) : null}

                      {/* Agent Audit Layer: manual approval of suggested reviewers */}
                      {dtPendingConfirm?.messageId === msg.id &&
                      Array.isArray(dtPendingConfirm.agentAudit?.suggested?.agents) &&
                      dtPendingConfirm.agentAudit!.suggested.agents.length ? (
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          <div className="font-medium mb-2">
                            Suggested reviewers (Agent Audit Layer)
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <label className="text-[11px] text-slate-500 dark:text-slate-400">
                              Intent
                            </label>
                            <select
                              value={dtPendingConfirm.agentAudit?.userIntent || 'validate'}
                              onChange={(e) => {
                                const next = (String(e.target.value) || 'validate') as
                                  | 'validate'
                                  | 'stress_test'
                                  | 'approve';
                                setDtPendingConfirm((prev) =>
                                  prev?.agentAudit
                                    ? {
                                        ...prev,
                                        agentAudit: { ...prev.agentAudit, userIntent: next },
                                      }
                                    : prev
                                );
                                void refreshAgentAuditSuggestionsOnly({ userIntent: next });
                              }}
                              className="text-[11px] bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-md px-2 py-1"
                            >
                              <option value="validate">Validate</option>
                              <option value="stress_test">Stress-test</option>
                              <option value="approve">Approve</option>
                            </select>

                            <label className="text-[11px] text-slate-500 dark:text-slate-400 ml-2">
                              Max agents
                            </label>
                            <select
                              value={dtPendingConfirm.agentAudit?.maxAgents || 3}
                              onChange={(e) => {
                                const next = Number(e.target.value) as 2 | 3 | 4;
                                setDtPendingConfirm((prev) =>
                                  prev?.agentAudit
                                    ? {
                                        ...prev,
                                        agentAudit: { ...prev.agentAudit, maxAgents: next },
                                      }
                                    : prev
                                );
                                void refreshAgentAuditSuggestionsOnly({ maxAgents: next });
                              }}
                              className="text-[11px] bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-md px-2 py-1"
                            >
                              <option value={2}>2</option>
                              <option value={3}>3</option>
                              <option value={4}>4</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            {dtPendingConfirm.agentAudit!.suggested.agents
                              .slice(0, 8)
                              .map((a: any) => {
                                const id = String(a?.agentId || '').trim();
                                const isSelected = Boolean(
                                  id && dtPendingConfirm.agentAudit!.selectedAgentIds.includes(id)
                                );
                                const label =
                                  agentRegistryById[id]?.displayName?.pl ||
                                  agentRegistryById[id]?.displayName?.en ||
                                  id ||
                                  '—';
                                const why = String(a?.whySelected || '').trim();
                                return (
                                  <label
                                    key={id}
                                    className="flex items-start gap-2 bg-white/60 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700 rounded-md px-2 py-1"
                                  >
                                    <input
                                      type="checkbox"
                                      className="mt-0.5"
                                      checked={isSelected}
                                      onChange={() => {
                                        setDtPendingConfirm((prev) => {
                                          if (!prev?.agentAudit) return prev;
                                          const cur = prev.agentAudit.selectedAgentIds || [];
                                          const next = cur.includes(id)
                                            ? cur.filter((x) => x !== id)
                                            : [...cur, id];
                                          return {
                                            ...prev,
                                            agentAudit: { ...prev.agentAudit, selectedAgentIds: next },
                                          };
                                        });
                                      }}
                                    />
                                    <div className="min-w-0">
                                      <div className="text-slate-700 dark:text-slate-200 truncate">
                                        {label}
                                      </div>
                                      {why ? (
                                        <div className="text-slate-400 dark:text-slate-500 truncate">
                                          {why}
                                        </div>
                                      ) : null}
                                    </div>
                                  </label>
                                );
                              })}
                          </div>
                          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                            Selected:{' '}
                            {dtPendingConfirm.agentAudit?.selectedAgentIds?.length || 0} reviewer(s)
                            · They will audit the final report (no interference with DT).
                          </div>
                        </div>
                      ) : null}

                      {/* Adjust */}
                      {dtPendingConfirm?.messageId === msg.id && (
                        <div className="space-y-2">
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            If this is not correct, adjust the task and re-run confirm.
                          </div>
                          <textarea
                            value={dtPendingConfirm.editedMessage}
                            onChange={(e) =>
                              setDtPendingConfirm((prev) =>
                                prev ? { ...prev, editedMessage: e.target.value } : prev
                              )
                            }
                            rows={3}
                            className="w-full text-xs bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary-500/40"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={handleDeepThinkingProceed}
                              disabled={
                                dtConfirmBusy ||
                                isDisabled ||
                                (Array.isArray(dtPendingConfirm.agentAudit?.suggested?.agents) &&
                                  dtPendingConfirm.agentAudit?.suggested?.agents?.length > 0 &&
                                  (dtPendingConfirm.agentAudit?.selectedAgentIds?.length || 0) ===
                                    0)
                              }
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Confirm & proceed
                            </button>
                            <button
                              onClick={handleDeepThinkingReconfirm}
                              disabled={dtConfirmBusy || isDisabled}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {dtConfirmBusy ? 'Reconfirming…' : 'Adjust & reconfirm'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Cursor-like thinking indicator - shows only when streaming with no content yet */}
                      <ThinkingStatusLine
                        compact={isCompact}
                        className="mb-1"
                        show={msg.isStreaming === true && thinkingSteps.length > 0}
                        label={
                          (thinkingSteps.find((s) => s.status === 'in_progress')?.label ||
                            thinkingSteps.find((s) => s.status === 'pending')?.label ||
                            t('thinking.processing', 'Thinking...')) as string
                        }
                      />
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code: ({ inline, className: codeClassName, children }: any) => {
                            if (inline) {
                              return (
                                <code className="px-1 py-0.5 bg-slate-200 dark:bg-navy-700 rounded text-primary-600 dark:text-primary-400 text-xs font-mono">
                                  {children}
                                </code>
                              );
                            }
                            return (
                              <pre className="bg-slate-900 dark:bg-navy-950 text-slate-100 p-2 rounded-lg overflow-x-auto text-xs my-2">
                                <code className={codeClassName}>{children}</code>
                              </pre>
                            );
                          },
                          a: ({ href, children }: any) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-700 underline"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                      {msg.role === 'ai' &&
                        !msg.isStreaming &&
                        (msg as any).metadata?.agentAudit?.kind === 'verdict' && (
                          <div className="mt-3 p-3 bg-slate-50 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700 rounded-lg">
                            {(() => {
                              const audit = (msg as any).metadata?.agentAudit || {};
                              const verdict = audit?.verdict || {};
                              const reviews = Array.isArray(audit?.reviews) ? audit.reviews : [];
                              const gates = Array.isArray(verdict?.gatesTriggered)
                                ? verdict.gatesTriggered
                                : [];
                              const gateExplanations = Array.isArray(verdict?.gateExplanations)
                                ? verdict.gateExplanations
                                : [];

                              const activeAgentId =
                                agentAuditActiveTabByMessageId[msg.id] ||
                                String(reviews[0]?.agentId || '').trim();
                              const activeReview =
                                reviews.find((r: any) => String(r?.agentId || '') === activeAgentId) ||
                                reviews[0] ||
                                null;

                              const renderSource = (s: any, idx: number) => {
                                if (!s || !s.type) return null;
                                if (s.type === 'dt_section') {
                                  return (
                                    <div key={`${s.type}-${idx}`} className="text-[11px] text-slate-600 dark:text-slate-300">
                                      <span className="font-medium">DT</span>
                                      {s.quote ? `: "${String(s.quote).slice(0, 180)}"` : ''}
                                    </div>
                                  );
                                }
                                if (s.type === 'kb_snippet') {
                                  const meta = [
                                    String(s.title || 'KB'),
                                    s.version ? `v${String(s.version)}` : '',
                                    typeof s.score === 'number' ? `score=${s.score.toFixed(2)}` : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' · ');
                                  return (
                                    <div key={`${s.type}-${idx}`} className="text-[11px] text-slate-600 dark:text-slate-300">
                                      <div>
                                        <span className="font-medium">KB</span>
                                        {meta ? `: ${meta}` : ''}
                                      </div>
                                      {s.snippet ? (
                                        <div className="mt-1 px-2 py-1 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded text-[10px] leading-snug">
                                          {String(s.snippet).slice(0, 220)}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                }
                                if (s.type === 'web_source') {
                                  const url = String(s.url || '').trim();
                                  if (!url) return null;
                                  const label = String(s.title || s.domain || url);
                                  return (
                                    <div key={`${s.type}-${idx}`} className="text-[11px]">
                                      <span className="font-medium text-slate-600 dark:text-slate-300">
                                        Web
                                      </span>
                                      {': '}
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary-600 hover:text-primary-700 underline"
                                      >
                                        {label}
                                      </a>
                                    </div>
                                  );
                                }
                                return null;
                              };

                              return (
                                <>
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                      Agent Audit — details
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                      Status:{' '}
                                      <span className="font-medium">
                                        {String(verdict?.qualityStatus || '—')}
                                      </span>
                                      {gates.length ? ` · Gates: ${gates.join(', ')}` : ''}
                                    </div>
                                  </div>

                                  {gateExplanations.length ? (
                                    <div className="mt-2">
                                      <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                                        Gate reasons
                                      </div>
                                      <ul className="space-y-0.5">
                                        {gateExplanations.slice(0, 6).map((g: any, i: number) => (
                                          <li
                                            key={`${String(g?.gate || '')}-${i}`}
                                            className="text-[11px] text-slate-600 dark:text-slate-300"
                                          >
                                            <span className="font-semibold">{String(g.gate)}</span>
                                            {': '}
                                            {String(g.reason || '').trim()}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}

                                  {String(verdict?.qualityStatus || '') === 'FAIL' &&
                                  String(audit?.orchestratorRunId || '').trim() ? (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                      <button
                                        onClick={async () => {
                                          if (agentAuditBusy) return;
                                          const runId = String(audit?.orchestratorRunId || '').trim();
                                          if (!runId) return;
                                          setAgentAuditBusy(true);
                                          try {
                                            await Api.agentAuditAcceptRun({ runId });
                                            const content = [
                                              '**Agent Audit — risk accepted**',
                                              `- Run: \`${runId}\``,
                                              '- Decision: user accepted proceeding despite FAIL.',
                                            ].join('\n');
                                            if (activeConversationId) {
                                              await addMessageToConversation({
                                                conversationId: activeConversationId,
                                                role: 'ai',
                                                content,
                                                messageType: 'text',
                                                metadata: { agentAudit: { kind: 'accept', runId } } as any,
                                              });
                                            }
                                            addChatMessage({
                                              id: `agent-audit-accept-${Date.now()}`,
                                              role: 'ai',
                                              content,
                                              timestamp: new Date(),
                                              metadata: { agentAudit: { kind: 'accept', runId } },
                                            } as any);
                                          } catch (err) {
                                            console.error('[UnifiedChatPanel] Failed to accept audit run:', err);
                                          } finally {
                                            setAgentAuditBusy(false);
                                          }
                                        }}
                                        disabled={isDisabled || agentAuditBusy}
                                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        Accept risk & proceed
                                      </button>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        This is recorded in the audit trail.
                                      </div>
                                    </div>
                                  ) : null}

                                  {reviews.length ? (
                                    <div className="mt-3">
                                      <div className="flex flex-wrap gap-2">
                                        {reviews.slice(0, 6).map((r: any) => {
                                          const id = String(r?.agentId || '').trim();
                                          const label =
                                            agentRegistryById[id]?.displayName?.pl ||
                                            agentRegistryById[id]?.displayName?.en ||
                                            id;
                                          const isActive = id && id === activeAgentId;
                                          return (
                                            <button
                                              key={id}
                                              onClick={() =>
                                                setAgentAuditActiveTabByMessageId((prev) => ({
                                                  ...prev,
                                                  [msg.id]: id,
                                                }))
                                              }
                                              className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                                                isActive
                                                  ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                                                  : 'bg-white dark:bg-navy-950 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                                              }`}
                                            >
                                              {String(label)}
                                              {String(r?.overreach || '') === 'hard' ? ' (rejected)' : ''}
                                            </button>
                                          );
                                        })}
                                      </div>

                                      {activeReview ? (
                                        <div className="mt-3">
                                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                            Verdict: <span className="font-medium">{String(activeReview.verdict || '—')}</span>
                                            {activeReview.overreach ? ` · Overreach: ${String(activeReview.overreach)}` : ''}
                                          </div>

                                          {Array.isArray(activeReview.findings) && activeReview.findings.length ? (
                                            <div className="mt-2">
                                              <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                                                Findings
                                              </div>
                                              <div className="space-y-2">
                                                {activeReview.findings.slice(0, 8).map((f: any, i: number) => (
                                                  <div
                                                    key={`${String(f?.area || 'other')}-${i}`}
                                                    className="p-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-md"
                                                  >
                                                    <div className="text-[11px] text-slate-700 dark:text-slate-200">
                                                      <span className="font-semibold">
                                                        {String(f.severity || '').toUpperCase()}
                                                      </span>
                                                      {` · ${String(f.area || 'other')}`} — {String(f.claim || '').trim()}
                                                    </div>

                                                    {Array.isArray(f.sourcesUsed) && f.sourcesUsed.length ? (
                                                      <div className="mt-1 space-y-1">
                                                        {f.sourcesUsed.slice(0, 4).map(renderSource)}
                                                      </div>
                                                    ) : null}

                                                    {Array.isArray(f.missingDataQuestions) &&
                                                    f.missingDataQuestions.length ? (
                                                      <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                                                        <div className="font-medium">Missing data</div>
                                                        <ul className="list-disc pl-4">
                                                          {f.missingDataQuestions
                                                            .slice(0, 4)
                                                            .map((q: any, qi: number) => (
                                                              <li key={qi}>{String(q)}</li>
                                                            ))}
                                                        </ul>
                                                      </div>
                                                    ) : null}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ) : null}

                                          {Array.isArray(activeReview.conflicts) && activeReview.conflicts.length ? (
                                            <div className="mt-2">
                                              <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                                                Conflicts
                                              </div>
                                              <ul className="list-disc pl-4 text-[11px] text-slate-600 dark:text-slate-300">
                                                {activeReview.conflicts.slice(0, 6).map((c: any, ci: number) => (
                                                  <li key={ci}>
                                                    with <span className="font-medium">{String(c.withAgentId || '')}</span>
                                                    {c.aboutArea ? ` (${String(c.aboutArea)})` : ''}:{' '}
                                                    {String(c.conflictStatement || '')}
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </>
                              );
                            })()}
                          </div>
                        )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  {editingMessageId === msg.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={3}
                        className="w-full text-sm bg-white/90 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary-500/40 text-navy-900 dark:text-slate-100"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={handleCancelEditMessage}
                          disabled={editBusy}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/80 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 disabled:opacity-50"
                        >
                          {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                          onClick={handleCommitEditMessage}
                          disabled={editBusy || !editingText.trim()}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50"
                        >
                          {editBusy ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </>
              )}

              {/* Streaming indicator */}
              {msg.isStreaming && (
                <span className="inline-flex items-center gap-1 ml-2">
                  <span
                    className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </span>
              )}

              {/* Agent Audit Layer: streamed post-DT progress (keeps UI alive after text ends) */}
              {msg.isStreaming &&
                agentAuditState?.state &&
                agentAuditState.state !== 'done' &&
                agentAuditState.state !== 'error' && (
                  <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    Agent audit: {String(agentAuditState.state)}
                  </div>
                )}

              {/* Retry button for error messages */}
              {msg.role === 'ai' &&
                !msg.isStreaming &&
                msg.content?.includes('⚠️') &&
                (() => {
                  // Find the last user message before this error
                  const errorIdx = displayMessages.indexOf(msg);
                  const prevUserMsg = displayMessages
                    .slice(0, errorIdx)
                    .reverse()
                    .find((m) => m.role === 'user');
                  return prevUserMsg ? (
                    <button
                      onClick={() => handleSendMessage(prevUserMsg.content)}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                    >
                      <RefreshCw size={12} />
                      {t('aiChat.retry', 'Try again')}
                    </button>
                  ) : null;
                })()}

              {/* Hover Actions */}
              {isHovered && !msg.isStreaming && (
                <div
                  className={`absolute ${msg.role === 'user' ? '-left-2 -translate-x-full' : '-right-2 translate-x-full'} top-0 flex items-center gap-0.5 bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 p-1`}
                >
                  {/* Copy */}
                  <button
                    onClick={() => handleCopyMessage(msg.content, msg.id)}
                    className="p-1 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700"
                    title={t('chat.actions.copy', 'Copy')}
                  >
                    {isCopied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                  </button>

                  {/* Edit (user only) */}
                  {msg.role === 'user' && (
                    <button
                      onClick={() => handleStartEditMessage(msg.id)}
                      className="p-1 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700"
                      title={t('chat.actions.edit', 'Edit')}
                    >
                      <Pencil size={12} />
                    </button>
                  )}

                  {/* Quick Feedback (AI only) */}
                  {msg.role === 'ai' && (
                    <>
                      <button
                        className="p-1 rounded-md text-slate-500 hover:text-green-600 dark:text-slate-400 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                        title={t('chat.actions.helpful', 'Helpful')}
                      >
                        <ThumbsUp size={12} />
                      </button>
                      <button
                        className="p-1 rounded-md text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title={t('chat.actions.notHelpful', 'Not helpful')}
                      >
                        <ThumbsDown size={12} />
                      </button>
                    </>
                  )}

                  {/* View Artifacts */}
                  {msg.role === 'ai' && hasArtifacts && (
                    <button
                      onClick={() => handleViewArtifacts(msg.artifacts!)}
                      className="p-1 rounded-md text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                      title={t('chat.actions.viewArtifacts', 'View Artifacts')}
                    >
                      <FileCode size={12} />
                    </button>
                  )}

                  {/* Speak */}
                  {msg.role === 'ai' && (
                    <button
                      onClick={() => (voiceState.isSpeaking ? stopSpeaking() : speak(msg.content))}
                      className={`p-1 rounded-md ${voiceState.isSpeaking ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'} hover:bg-slate-100 dark:hover:bg-navy-700`}
                      title={
                        voiceState.isSpeaking
                          ? t('chat.actions.stop', 'Stop')
                          : t('chat.actions.speak', 'Speak')
                      }
                    >
                      <Volume2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Artifacts Badge */}
        {msg.role === 'ai' && hasArtifacts && (
          <button
            onClick={() => handleViewArtifacts(msg.artifacts!)}
            className={`${isCompact ? 'ml-7' : 'ml-9'} flex items-center gap-1 px-2 py-1 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg text-xs font-medium transition-colors`}
          >
            <FileCode size={12} />
            {msg.artifacts!.length}{' '}
            {msg.artifacts!.length === 1
              ? t('chat.artifact', 'artifact')
              : t('chat.artifacts', 'artifacts')}
          </button>
        )}

        {/* Citations */}
        {msg.role === 'ai' && hasCitations && (
          <div className={`${isCompact ? 'ml-7' : 'ml-9'} mt-1`}>
            <CitationList citations={msg.citations!} />
          </div>
        )}

        {/* Inline Feedback (AI messages only, not streaming) */}
        {msg.role === 'ai' && !msg.isStreaming && (
          <div className={`${isCompact ? 'ml-7' : 'ml-9'} mt-1`}>
            <InlineResponseFeedback
              messageId={msg.id}
              conversationId={activeConversationId || undefined}
              responseLength={msg.content.length}
              onFeedback={(feedback) => handleFeedback(msg.id, msg.content, feedback)}
              compact={isCompact}
            />
          </div>
        )}

        {/* AI-suggested Deep Thinking activation hint */}
        {msg.role === 'ai' &&
          !msg.isStreaming &&
          isLastMessage &&
          deepThinkingHint &&
          !dtHintDismissed &&
          !aiConfig?.deepResearch && (
            <div
              className={`${isCompact ? 'ml-7' : 'ml-9'} mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg`}
            >
              <div className="flex items-start gap-2">
                <Lightbulb
                  size={16}
                  className="text-amber-500 dark:text-amber-400 mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                    {t(
                      'deepThinking.hint',
                      'This looks like a strategic problem. Deep Thinking Mode can provide structured, decision-grade analysis.'
                    )}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleEnableDeepThinking}
                      className="px-3 py-1 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors flex items-center gap-1"
                    >
                      <BrainCircuit size={12} />
                      {t('deepThinking.enableHint', 'Enable Deep Thinking')}
                    </button>
                    <button
                      onClick={() => setDtHintDismissed(true)}
                      className="px-3 py-1 text-xs font-medium rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                    >
                      {t('deepThinking.dismissHint', 'Not now')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Deep Thinking CTA: Save as Decision / Convert to Initiative */}
        {msg.role === 'ai' &&
          !msg.isStreaming &&
          (msg as any).metadata?.deepThinking?.kind === 'report' &&
          !dtDecisionSaved.has(msg.id) && (
            <div
              className={`${isCompact ? 'ml-7' : 'ml-9'} mt-2 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/50 rounded-lg`}
            >
              <p className="text-xs font-medium text-primary-800 dark:text-primary-200 mb-2 flex items-center gap-1.5">
                <Sparkles size={14} className="text-primary-500" />
                {t('deepThinking.ctaTitle', 'What do you want to do with this output?')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSaveAsDecision(msg.id, msg.content)}
                  disabled={dtSavingDecision === msg.id}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  <Bookmark size={12} />
                  {dtSavingDecision === msg.id
                    ? t('deepThinking.saving', 'Saving…')
                    : t('deepThinking.saveDecision', 'Save as Decision')}
                </button>
                <button
                  onClick={() => handleSaveAsDecision(msg.id, msg.content)}
                  disabled={dtSavingDecision === msg.id}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-navy-900 border border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  <Zap size={12} />
                  {t('deepThinking.convertInitiative', 'Convert to Initiative')}
                </button>
              </div>
            </div>
          )}

        {/* Deep Thinking CTA: saved confirmation */}
        {msg.role === 'ai' && !msg.isStreaming && dtDecisionSaved.has(msg.id) && (
          <div
            className={`${isCompact ? 'ml-7' : 'ml-9'} mt-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg`}
          >
            <p className="text-xs font-medium text-green-700 dark:text-green-300 flex items-center gap-1.5">
              <Check size={14} />
              {t('deepThinking.decisionSaved', 'Decision saved successfully')}
            </p>
          </div>
        )}

        {/* Interim Insight checkpoint */}
        {msg.role === 'ai' &&
          !msg.isStreaming &&
          isLastMessage &&
          interimInsight &&
          interimInsight.paths.length > 0 && (
            <div
              className={`${isCompact ? 'ml-7' : 'ml-9'} mt-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-lg`}
            >
              <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-200 mb-2 flex items-center gap-1.5">
                <BrainCircuit size={14} className="text-indigo-500" />
                {t('deepThinking.interimInsight', 'Preliminary insight — dominant paths emerging:')}
              </p>
              <ul className="space-y-1 mb-2">
                {interimInsight.paths.map((p) => (
                  <li key={p.id} className="text-xs text-indigo-700 dark:text-indigo-300">
                    <span className="font-medium">{p.label}</span>
                    {p.summary ? ` — ${p.summary}` : ''}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    handleSendMessage(
                      t('deepThinking.narrowFocus', 'Narrow focus on the first path')
                    )
                  }
                  className="px-3 py-1 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                >
                  {t('deepThinking.narrowFocusBtn', 'Narrow focus')}
                </button>
                <button
                  onClick={() => handleSendMessage(t('deepThinking.goDeeper', 'Go deeper'))}
                  className="px-3 py-1 text-xs font-medium rounded-lg bg-white dark:bg-navy-900 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 transition-colors"
                >
                  {t('deepThinking.continueDeeper', 'Continue to full report')}
                </button>
              </div>
            </div>
          )}

        {/* Agent Audit Layer: Directed Deepening CTA */}
        {msg.role === 'ai' &&
          !msg.isStreaming &&
          (msg as any).metadata?.agentAudit?.kind === 'verdict' &&
          String((msg as any).metadata?.agentAudit?.verdict?.directedLoop?.deepThinkingPrompt || '')
            .trim() && (
            <div className={`${isCompact ? 'ml-7' : 'ml-9'} mt-3 flex flex-wrap gap-2`}>
              <button
                onClick={() => handleRunDirectedDeepening((msg as any).metadata?.agentAudit)}
                disabled={
                  isDisabled ||
                  agentAuditBusy ||
                  Number((msg as any).metadata?.agentAudit?.loopIteration || 1) >= 2
                }
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {agentAuditBusy ? 'Running audit…' : 'Run directed deepening'}
              </button>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 self-center">
                Iterations: {String((msg as any).metadata?.agentAudit?.loopIteration || 1)}/2
              </div>
            </div>
          )}

        {/* Interactive Options */}
        {msg.role === 'ai' && !msg.isStreaming && msg.options && msg.options.length > 0 && (
          <div className={`${isCompact ? 'ml-7' : 'ml-9'} mt-3 flex flex-wrap gap-2`}>
            {msg.multiSelect ? (
              <div className="flex flex-col gap-3 w-full">
                <div className="flex flex-wrap gap-2">
                  {msg.options.map((option) => {
                    const isSelected = selectedMultiOptions.includes(option.value);
                    return (
                      <button
                        key={option.id}
                        onClick={() => handleMultiSelectToggle(option.value)}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                            : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                        }`}
                      >
                        {option.label}
                        {isSelected && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>
                {isLastMessage && selectedMultiOptions.length > 0 && (
                  <button
                    onClick={handleMultiSelectConfirm}
                    className="self-start px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
                  >
                    {t('chat.confirmSelection', 'Confirm Selection')}
                  </button>
                )}
              </div>
            ) : (
              msg.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() =>
                    onOptionSelect ? onOptionSelect(option) : handleSendMessage(option.label)
                  }
                  className="px-3 py-1.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 text-xs rounded-full hover:bg-primary-50 dark:hover:bg-primary-900/10 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-700 dark:hover:text-primary-300 transition-all"
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-navy-950 ${className}`}
      style={{ maxHeight: maxHeight || '100%' }}
    >
      {/* Skip links for keyboard users */}
      <a
        href="#chat-input"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-primary-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        {t('wcag.skipToInput', 'Skip to chat input')}
      </a>

      {/* Header - Simplified */}
      <div
        className={`flex items-center justify-between ${isCompact ? 'px-3 py-2' : 'px-4 py-3'} border-b border-slate-200 dark:border-navy-800 bg-white/50 dark:bg-navy-950/50 backdrop-blur-sm`}
      >
        <div className="flex items-center gap-1">
          {/* New Chat button - first from left */}
          <button
            onClick={handleNewChat}
            data-testid="chat-new-button"
            className="p-1.5 text-slate-400 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
            title={t('aiChat.newChat', 'Nowa rozmowa')}
          >
            <Plus size={18} />
          </button>

          {/* History toggle - second from left */}
          {showHistoryTrigger && (
            <button
              onClick={() => setChatSlidingPanelOpen(!isChatSlidingPanelOpen)}
              data-testid="chat-history-button"
              data-chat-toggle
              className={`p-1.5 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors ${
                isChatSlidingPanelOpen
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
              title={t('aiChat.history', 'Historia')}
            >
              <History size={18} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Auto-read toggle (speaker) - right side */}
          {ttsSupported && (
            <button
              onClick={() => {
                if (autoReadEnabled && voiceState.isSpeaking) {
                  stopSpeaking();
                }
                const nextState = !autoReadEnabled;
                setAutoReadEnabled(nextState);
                updateVoiceSettings({ autoSpeakResponses: nextState });
              }}
              data-testid="chat-autoread-button"
              className={`p-1.5 rounded-lg transition-colors ${
                autoReadEnabled
                  ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
              }`}
              title={
                autoReadEnabled
                  ? t('aiChat.autoReadOff', 'Wyłącz czytanie na głos')
                  : t('aiChat.autoReadOn', 'Włącz czytanie na głos')
              }
            >
              {autoReadEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          )}
        </div>
      </div>

      {/* Pending Actions Indicator - Inline visibility for AI actions */}
      <div className={`${isCompact ? 'px-2 pt-2' : 'px-3 pt-3'}`}>
        <PendingActionsIndicator
          projectId={workspaceContext?.projectId}
          compact={isCompact}
          onViewAll={onNavigateToActions}
          onActionDecided={(actionId, decision) => {
            console.log(`[UnifiedChatPanel] Action ${actionId} ${decision}`);
          }}
          maxPreview={isCompact ? 2 : 3}
        />
      </div>

      {/* Context Badge - shows what AI "sees" */}
      <div className={`${isCompact ? 'px-2' : 'px-3'}`}>
        <ContextBadge
          workspaceContext={workspaceContext}
          focusMode={focusMode}
          compact={isCompact}
        />
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className={`flex-1 overflow-y-auto ${isCompact ? 'p-3 space-y-3' : 'p-4 space-y-4'}`}
      >
        {displayMessages.length === 0 && activeConversationId && isConversationLoading ? (
          /* Loading state — conversation selected but messages still loading */
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p
              className={`${isCompact ? 'text-xs' : 'text-sm'} text-slate-400 dark:text-slate-500`}
            >
              {t('aiChat.loadingConversation', 'Loading conversation…')}
            </p>
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
              <MessageSquare size={24} className="text-primary-500" />
            </div>
            <h3
              className={`${isCompact ? 'text-sm' : 'text-base'} font-medium text-navy-900 dark:text-white mb-1`}
            >
              {t('aiChat.welcome', 'Start a conversation')}
            </h3>
            <p
              className={`${isCompact ? 'text-xs' : 'text-sm'} text-slate-500 dark:text-slate-400 max-w-xs`}
            >
              {t('aiChat.welcomeSubtitle', 'Ask questions, get insights, and collaborate with AI')}
            </p>
          </div>
        ) : (
          displayMessages.map((msg, index) => renderMessage(msg, index))
        )}

        {/* Typing indicator */}
        {isBotTyping && !streamedContent && (
          <div className="flex gap-2 justify-start">
            <div
              className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full bg-primary-50 dark:bg-primary-900/50 border border-primary-200 dark:border-primary-700 flex items-center justify-center shrink-0 mt-0.5`}
            >
              <Bot size={isCompact ? 12 : 14} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div className="bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl rounded-tl-none px-3 py-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-100"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        id="chat-input"
        className={`${isCompact ? 'p-2' : 'p-3'} border-t border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950`}
      >
        {!!lastError && !isStreaming && (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
            <div className="text-xs text-amber-800 dark:text-amber-200">
              {t('aiChat.streamError', 'Last request failed. You can retry.')}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => retryLastStream()}
                className="px-3 py-1 rounded-md text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white"
              >
                {t('common.tryAgain', 'Try again')}
              </button>
              <button
                onClick={() => clearLastError()}
                className="px-3 py-1 rounded-md text-xs font-medium bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15 text-amber-800 dark:text-amber-200"
              >
                {t('common.dismiss', 'Dismiss')}
              </button>
            </div>
          </div>
        )}
        <EnhancedChatInput
          onSend={handleSendMessage}
          onStopGenerating={abortStream}
          isStreaming={isStreaming}
          disabled={isDisabled}
          placeholder={
            workspaceContext && workspaceContext.type !== 'empty' && workspaceContext.entityName
              ? t('aiChat.contextPlaceholder', 'Jak mogę pomóc z {{context}}?', {
                  context: workspaceContext.entityName,
                })
              : t('aiChat.placeholder', 'How can I help you?')
          }
          voiceModeEnabled={voiceModeEnabled}
          onVoiceModeChange={setVoiceModeEnabled}
          voiceState={voiceState}
          startVoiceListening={startListening}
          stopVoiceListening={stopListening}
        />
      </div>

      {/* Sliding History Panel */}
      <ChatSlidingPanel
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        activeConversationId={activeConversationId}
      />
    </div>
  );
};

export default UnifiedChatPanel;
