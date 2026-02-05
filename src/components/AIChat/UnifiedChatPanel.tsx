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
  Bot,
  Check,
  Copy,
  FileCode,
  History,
  MessageSquare,
  Plus,
  ThumbsDown,
  ThumbsUp,
  User,
  Volume2,
  VolumeX,
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
  const [dtPendingConfirm, setDtPendingConfirm] = useState<{
    messageId: string;
    conversationId: string | null;
    originalMessage: string;
    editedMessage: string;
    confirm: any;
    context: any;
    attachments?: any[];
  } | null>(null);
  const [dtConfirmBusy, setDtConfirmBusy] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoReadEnabledRef = useRef(autoReadEnabled);

  // Keep ref in sync with state
  useEffect(() => {
    autoReadEnabledRef.current = autoReadEnabled;
  }, [autoReadEnabled]);

  // Computed values
  const isSplitMode = mode === 'split' || displayMode === 'split';
  const isCompact = isSplitMode;
  const isDisabled = disabled || aiFreezeStatus.isFrozen;

  // ========================================================================
  // AI Stream hook
  // ========================================================================

  const {
    startStream,
    isStreaming,
    streamedContent,
    researchProgress,
    researchVisibility,
    deepThinkingState,
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
  }, [messages, customMessages, isStreaming, streamedContent, thinkingSteps, deepThinkingState, researchProgress, researchVisibility]);

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

      const normalized = String(content || '').trim().toLowerCase();
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
      setDtPendingConfirm((prev) => (prev ? { ...prev, confirm: c } : prev));
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

  const handleCopyMessage = useCallback(async (content: string, messageId: string) => {
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
  }, [activeConversationId, aiConfig?.deepResearch]);

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
          <div
            className={`relative max-w-[85%] rounded-xl px-3 py-2 ${isCompact ? 'text-xs' : 'text-sm'} leading-relaxed shadow-sm ${
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
                      {(msg as any).metadata?.researchVisibility?.items?.slice(0, 6).map((it: any) => (
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
                      stage={((msg as any).metadata?.researchProgress?.stage || 'searching') as any}
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
                            disabled={dtConfirmBusy || isDisabled}
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
                  </>
                )}
              </div>
            ) : (
              <span>{msg.content}</span>
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
            <p className={`${isCompact ? 'text-xs' : 'text-sm'} text-slate-400 dark:text-slate-500`}>
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
        <EnhancedChatInput
          onSend={handleSendMessage}
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
