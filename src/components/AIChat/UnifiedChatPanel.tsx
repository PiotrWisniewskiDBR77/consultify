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
  Briefcase,
  History,
  MessageSquare,
  Plus,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import type {
  IdeaWorkspaceCreationPayload,
  IdeaWorkspaceSeedIntent,
} from '@/components/MyWork/ideaEntryTypes';
import { ChatToSchemaPanel } from '@/components/MyWork/table/ChatToSchemaPanel';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { isValidLanguage, normalizeLanguageCode, type SupportedLanguage } from '@/i18n';

import { useAIStream } from '../../hooks/useAIStream';
import { useChatActions } from '../../hooks/useChatActions';
import { useDemoSession } from '../../hooks/useDemoSession';
// import { useOrgMemory } from '../../hooks/useOrgMemory'; // removed — panel disabled
import { useTeresaVoiceContext } from '../../contexts/TeresaVoiceContext';
import { useUniversalVoice } from '../../hooks/useUniversalVoice';
import { Api } from '../../services/api';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import { useAIActionsStore } from '../../store/useAIActionsStore';
import { useAppStore } from '../../store/useAppStore';
import { useArtifactsStore } from '../../store/useArtifactsStore';
import { useConversationStore } from '../../store/useConversationStore';
import { useProposalLifecycleStore } from '../../store/useProposalLifecycleStore';
import {
  AppView,
  Artifact,
  ChatMessage,
  FocusMode,
  ResponseFeedback,
  ThinkingStep,
} from '../../types';
import { ChatDisplayMode, WorkspaceContext } from '../../types/workspace';
import { notifyBargeIn } from '../../utils/bargeInToast';
import { buildPersistedAiResponseMetadata } from '../../utils/chatPersistence';
import { cleanTextForSpeech } from '../../utils/textCleaning';
import { isRtlLanguage } from '../../utils/textDirection';
import { ChatSmartSuggestions, type ChatSuggestion } from '../Chat/ChatSmartSuggestions';
import {
  isSupportedChatAttachment,
  SUPPORTED_CHAT_ATTACHMENT_LABEL,
} from './chatAttachmentSupport';
import { ChatSignalsPanel } from './ChatSignalsPanel';
import { ChatSlidingPanel } from './ChatSlidingPanel';
import { getTeresaEmptyResponseMessage, getTeresaStartFailureMessage } from './teresaRuntimeCopy';
import { ContextBadge } from './ContextBadge';
import { EnhancedChatInput } from './EnhancedChatInput';
import { MessageRenderer } from './MessageRenderer';
// import { OrganizationMemoryPanel } from './OrganizationMemoryPanel'; // removed — panel disabled
import { PendingActionsIndicator } from './PendingActionsIndicator';
import { PrivateModeDetails } from './PrivateModeDetails';
import { detectDocumentIntent, detectPresentationIntent } from './documentIntentDetector';
import { detectExceleIntent, detectTableIntent } from './tableIntentDetector';
import { detectWhiteboardIntent } from './whiteboardIntentDetector';
import { V8ArtifactRunControl } from './V8ArtifactRunControl';
import { V8ContextIndicator } from './V8ContextIndicator';

// ============================================================================
// Types
// ============================================================================

type ChatSaveTarget = 'idea' | 'note';

interface ChatSaveIntent {
  target: ChatSaveTarget;
  cleanPrompt: string;
}

const firstMatchIndex = (input: string, patterns: RegExp[]): number => {
  const s = String(input || '');
  let best = -1;
  for (const p of patterns) {
    const m = s.match(p);
    if (!m || typeof m.index !== 'number') continue;
    if (best === -1 || m.index < best) best = m.index;
  }
  return best;
};

const isLikelyAiFailureText = (text: string): boolean => {
  const t = String(text || '')
    .trim()
    .toLowerCase();
  if (!t) return true;
  return (
    t.startsWith('⚠️') ||
    t.includes('stream ended without output') ||
    t.includes('ai returned an empty response') ||
    t.includes('ai returned no output') ||
    t.includes('failed to start ai') ||
    t.includes('nie udało się uruchomić ai') ||
    t.includes('nie udalo sie uruchomic ai')
  );
};

const extractSlashPayload = (raw: string, commands: string[]): string | null => {
  const trimmed = String(raw || '').trim();
  const lower = trimmed.toLowerCase();
  for (const cmd of commands) {
    if (!lower.startsWith(cmd)) continue;
    const payload = trimmed.slice(cmd.length).trim();
    return payload || '';
  }
  return null;
};

const isUuidLike = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());

const parseChatSaveIntent = (rawContent: string): ChatSaveIntent | null => {
  const raw = String(rawContent || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  const notePayload = extractSlashPayload(raw, ['/note', '/notatka']);
  if (notePayload !== null) {
    return {
      target: 'note',
      cleanPrompt:
        notePayload ||
        'Utworz krotka, uporzadkowana notatke na podstawie naszej rozmowy. Dodaj tytul i tresc.',
    };
  }

  const ideaPayload = extractSlashPayload(raw, ['/idea', '/pomysl', '/pomysł']);
  if (ideaPayload !== null) {
    return {
      target: 'idea',
      cleanPrompt:
        ideaPayload ||
        'Utworz konkretny pomysl do wdrozenia na podstawie naszej rozmowy. Dodaj tytul i opis.',
    };
  }

  const asksToSave = /(^|\s)zapisz(\s|$)|(^|\s)save(\s|$)/i.test(lower);
  if (!asksToSave) return null;

  const asksIdea = /pomysł|pomysl|idea|ideas/i.test(lower);
  const asksNote = /notatk|notebook|note/i.test(lower);

  if (asksIdea && asksNote) {
    const noteIdx = firstMatchIndex(lower, [/notatk/i, /notebook/i, /\bnote\b/i]);
    const ideaIdx = firstMatchIndex(lower, [/pomysł/i, /pomysl/i, /\bidea\b/i, /\bideas\b/i]);
    if (noteIdx >= 0 && ideaIdx >= 0) {
      return noteIdx <= ideaIdx
        ? { target: 'note', cleanPrompt: raw }
        : { target: 'idea', cleanPrompt: raw };
    }
  }

  if (asksIdea) return { target: 'idea', cleanPrompt: raw };
  if (asksNote) return { target: 'note', cleanPrompt: raw };

  return null;
};

export const __private__ = {
  firstMatchIndex,
  isLikelyAiFailureText,
  extractSlashPayload,
  parseChatSaveIntent,
};

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

  /** One-shot kickoff message to auto-send (split panel) */
  kickoffMessage?: string;
  /** Callback after kickoff message is consumed */
  onKickoffConsumed?: () => void;

  /** Per-tab quick prompt chips shown above the input */
  quickPrompts?: string[];
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
  kickoffMessage,
  onKickoffConsumed,
  quickPrompts,
}) => {
  const route = useLocation();
  const navigateToRoute = useNavigate();
  const { t, i18n } = useTranslation();
  const { isEnabled } = useFeatureFlagsContext();
  const signalsEnabled = isEnabled('myWorkSignalsV2');

  const routeInfo = useMemo(
    () => ({
      pathname: route.pathname,
      search: route.search,
      hash: route.hash,
    }),
    [route.hash, route.pathname, route.search]
  );

  // ========================================================================
  // Store hooks
  // ========================================================================

  const {
    currentStreamContent,
    isBotTyping,
    addChatMessage,
    deleteChatMessage,
    setIsBotTyping,
    aiFreezeStatus,
    aiConfig,
    setAIConfig,
    currentUser,
    currentOrganization,
  } = useAppStore();

  const {
    activeConversationId,
    activeMessages,
    isLoading: isConversationLoading,
    isSidebarOpen,
    displayMode,
    createConversation,
    addMessage: addMessageToConversation,
    setActiveConversation,
    fetchConversation,
    clearActiveChat,
    truncateFromMessage,
    toggleSidebar,
    setDisplayMode,
    expandToFullScreen,
    collapseToSplit,
    draftChatLanguage,
    chatLanguageByConversationId,
    _activeConversationState,
    _activeConversationStateMessage,
    notifyModelChange,
    exportConversation,
    purgeConversation,
  } = useConversationStore();

  const { addArtifact, togglePanel: toggleArtifactsPanel, exportArtifact } = useArtifactsStore();

  const pendingActionsCount = useAIActionsStore((s) => s.pendingCount);
  const { handleAction: handleChatAction } = useChatActions();

  // ========================================================================
  // Local state (must be declared before hooks that depend on them)
  // ========================================================================

  const [focusMode, setFocusMode] = useState<FocusMode>('all');
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
  // Auto-read is driven by textToSpeech from ToolsMenu (aiConfig) or manual toggle
  const [autoReadEnabled, setAutoReadEnabled] = useState(aiConfig?.textToSpeech ?? false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [editBusy, setEditBusy] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [tableBuilderOpen, setTableBuilderOpen] = useState(false);
  const [tableBuilderInitialMsg, setTableBuilderInitialMsg] = useState<string | undefined>();
  const lastKickoffSentRef = useRef<string | null>(null);
  const pendingChatSaveIntentRef = useRef<{
    target: ChatSaveTarget;
    originalUserMessage: string;
  } | null>(null);

  const chatLanguage: SupportedLanguage = useMemo(() => {
    // 1. User's explicit preference (set via ChatLanguageSelector) - highest priority
    const explicitPref =
      localStorage.getItem('consultinity-preferred-chat-lang') ||
      localStorage.getItem('consultify-preferred-chat-lang');
    // 2. Conversation-specific language (from DB/store)
    const activeLang = activeConversationId
      ? chatLanguageByConversationId[activeConversationId]
      : undefined;
    // 3. UI language (i18n) — always follow the current app language unless overridden above
    const uiLang = i18n.language?.split('-')[0] || 'en';
    const candidate = explicitPref || activeLang || uiLang;
    const base = String(candidate).split('-')[0];
    return (normalizeLanguageCode(base) ||
      (isValidLanguage(base) ? (base as SupportedLanguage) : 'en')) as SupportedLanguage;
  }, [activeConversationId, chatLanguageByConversationId, i18n.language]);

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
      ttsProvider: 'web',
      language: chatLanguage,
    },
  });

  // Teresa real-time voice — global context (persists across navigation)
  const teresaVoice = useTeresaVoiceContext();

  const {
    isDemo,
    timeRemainingMs: demoTimeRemainingMs,
    aiInteractionsRemaining,
    aiInteractionsLimit,
    consumeAIInteraction,
  } = useDemoSession();

  // Organization Memory — disabled (panel removed)
  // const orgMemory = useOrgMemory();

  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [contextSaveBusyMessageId, setContextSaveBusyMessageId] = useState<string | null>(null);
  const [contextSavedMessageIds, setContextSavedMessageIds] = useState<Set<string>>(new Set());
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([]);
  const [dtHintDismissed, setDtHintDismissed] = useState(false);
  const [abortFeedback, setAbortFeedback] = useState<'partial' | 'cancelled' | null>(null);
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

  // Sync autoReadEnabled with textToSpeech from ToolsMenu (aiConfig)
  useEffect(() => {
    const ttsFromConfig = aiConfig?.textToSpeech ?? false;
    if (ttsFromConfig !== autoReadEnabled) {
      setAutoReadEnabled(ttsFromConfig);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiConfig?.textToSpeech]);

  useEffect(() => {
    setContextSavedMessageIds(new Set());
    setContextSaveBusyMessageId(null);
  }, [activeConversationId]);

  // V8 / Wave A6 — seed the unified proposal lifecycle cache when a
  // conversation is opened so chat bubbles can render the freshest state
  // rather than the snapshot frozen into each message's metadata at write time.
  useEffect(() => {
    if (!activeConversationId) return;
    void useProposalLifecycleStore
      .getState()
      .loadForConversation(activeConversationId);
  }, [activeConversationId]);

  // Session hook: create new session when model/preset changes mid-conversation (§2.3.1)
  const prevModelRef = useRef<string | null>(null);
  useEffect(() => {
    const currentModel = (aiConfig as any)?.selectedModelId ?? null;
    if (prevModelRef.current !== null && currentModel !== prevModelRef.current && activeConversationId) {
      void notifyModelChange({
        modelId: currentModel || undefined,
        presetId: (aiConfig as any)?.selectedTier || undefined,
        locale: draftChatLanguage || undefined,
      });
    }
    prevModelRef.current = currentModel;
  }, [(aiConfig as any)?.selectedModelId, activeConversationId, notifyModelChange, draftChatLanguage]);

  // Ref for incremental TTS (defined here, used in effects after useAIStream)
  const spokenCharsRef = useRef(0);

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
  const isPrivateMode = Boolean((aiConfig as any)?.privateMode);
  const isRtlChatLanguage = isRtlLanguage(chatLanguage);

  // ========================================================================
  // AI Stream hook
  // ========================================================================

  const saveMessageAsIdea = useCallback(
    async (
      messageId: string,
      content: string,
      options?: {
        navigateToMyWork?: boolean;
        autoTriggered?: boolean;
      }
    ) => {
      const trimmed = String(content || '').trim();
      if (!trimmed) return;

      const firstLine =
        trimmed
          .split('\n')
          .map((l) => l.replace(/^#+\s*/, '').trim())
          .find((l) => !!l) || '';
      const title = firstLine.slice(0, 120) || (i18n.language === 'pl' ? 'Pomysł' : 'Idea');

      const navigateToMyWork = options?.navigateToMyWork !== false;
      const autoTriggered = options?.autoTriggered === true;

      try {
        if (navigateToMyWork) {
          const creationPayload: IdeaWorkspaceCreationPayload = {
            title,
            body: trimmed,
            tags: [],
            sourceType: 'chat',
            sourceConversationId: activeConversationId,
            sourceMessageId: messageId,
          };
          const seedIntent: IdeaWorkspaceSeedIntent = {
            startMode: 'describe_with_ai',
            seedText: trimmed,
            preferredSystem: 'mindmap',
            templateId: null,
            popularStartId: null,
            popularStartLabel: null,
            structuredBrief: null,
            source: 'chat_handoff',
          };
          const draftId = `new-idea-${Date.now()}`;

          trackFunnelEvent('my_idea_saved', {
            source: autoTriggered ? 'chat_auto' : 'chat',
            ideaId: draftId,
            messageId,
            handoff: true,
          });
          toast.success(
            autoTriggered
              ? t('myWork.ideas.savedFromChatToast', 'Saved from chat to My Ideas')
              : t('myWork.ideas.sentToWorkspaceToast', 'Opened in Ideas workspace')
          );

          try {
            const { setMyWorkIntent, setCurrentView } = useAppStore.getState() as any;
            setMyWorkIntent?.({
              tab: 'ideas',
              open: {
                type: 'idea',
                id: draftId,
                name: title,
                data: {
                  isNew: true,
                  creationPayload,
                  seedIntent,
                },
              },
            });
            setCurrentView?.(AppView.MY_WORK);
          } catch {
            // ignore
          }
          return;
        }

        const created = await Api.createIdeaFromChat({
          title,
          seedText: trimmed,
          sourceConversationId: activeConversationId || undefined,
          sourceMessageId: messageId,
          startMode: 'describe_with_ai',
          preferredSystem: 'mindmap',
        });

        trackFunnelEvent('my_idea_saved', {
          source: autoTriggered ? 'chat_auto' : 'chat',
          ideaId: created?.ideaId,
          messageId,
        });
        toast.success(
          autoTriggered
            ? t('myWork.ideas.savedFromChatToast', 'Saved from chat to My Ideas')
            : t('myWork.ideas.savedToast', 'Saved to My Ideas')
        );
      } catch (err) {
        console.error('[UnifiedChatPanel] Failed to save idea:', err);
        toast.error(t('myWork.errors.createFailed', 'Failed to create idea'));
      }
    },
    [activeConversationId, i18n.language, t]
  );

  const saveMessageAsNote = useCallback(
    async (
      messageId: string,
      content: string,
      options?: {
        navigateToMyWork?: boolean;
        autoTriggered?: boolean;
      }
    ) => {
      const trimmed = String(content || '').trim();
      if (!trimmed) return;

      const firstLine =
        trimmed
          .split('\n')
          .map((l) => l.replace(/^#+\s*/, '').trim())
          .find((l) => !!l) || '';
      const title = firstLine.slice(0, 120) || (i18n.language === 'pl' ? 'Notatka' : 'Note');

      const navigateToMyWork = options?.navigateToMyWork !== false;
      const autoTriggered = options?.autoTriggered === true;

      try {
        const created = await Api.post('/my-work/notebook/pages', {
          title,
          visibility: 'private',
          tags: [],
          contentText: trimmed,
          contentJson: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: trimmed }],
              },
            ],
          },
          source: { type: 'chat', conversationId: activeConversationId, messageId },
        });

        trackFunnelEvent('notebook_page_saved', {
          source: autoTriggered ? 'chat_auto' : 'chat',
          pageId: (created as any)?.id,
          messageId,
        });
        toast.success(
          autoTriggered
            ? t('myWork.notebook.savedFromChatToast', 'Saved from chat to Notebook')
            : t('myWork.notebook.savedToast', 'Saved to Notebook')
        );

        if (navigateToMyWork) {
          try {
            const { setMyWorkIntent, setCurrentView } = useAppStore.getState() as any;
            setMyWorkIntent?.({ tab: 'notebook' });
            setCurrentView?.(AppView.MY_WORK);
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.error('[UnifiedChatPanel] Failed to save note:', err);
        toast.error(t('myWork.errors.createFailed', 'Failed to create'));
      }
    },
    [activeConversationId, i18n.language, t]
  );

  const {
    startStream,
    abortStream,
    retryLastStream,
    lastError,
    clearLastError,
    isStreaming,
    streamedContent,
    policyDecision,
    policyNotices,
    researchProgress,
    researchVisibility,
    deepThinkingState,
    deepThinkingHint,
    interimInsight,
    agentAuditState,
    agentAuditVerdict,
    agentReviewProgressByAgentId,
    agentSourcesByAgentId,
    retryInfo,
    streamStartedAt,
    streamCompletedSignal,
  } = useAIStream({
    onStreamDone: async (fullText, thinking, artifacts, meta) => {
      const safeText =
        typeof fullText === 'string' && fullText.trim().length > 0
          ? fullText
          : getTeresaEmptyResponseMessage(i18n.language);

      // Feedback #53cc607e — read the active conversation id straight from the
      // store at callback time. The hook's option object is captured with the
      // component's render closure, so a conversation created *during* the send
      // (handleSendMessage → createConversation) would otherwise see a stale
      // `activeConversationId === null` here and silently skip persisting the
      // AI reply ("Chat nie pamięta rozmów").
      const liveActiveConversationId =
        useConversationStore.getState().activeConversationId || activeConversationId;

      let savedAiMessageId: string | null = null;
      // Save AI response to conversation store
      if (liveActiveConversationId) {
        try {
          const saved = await addMessageToConversation({
            conversationId: liveActiveConversationId,
            role: 'ai',
            content: safeText,
            messageType: 'text',
            metadata: buildPersistedAiResponseMetadata({
              thinking: thinking as any,
              artifacts: artifacts as any,
              citations: meta?.citations,
              streamSessionId: meta?.sessionId,
            extra:
              aiConfig?.deepResearch ||
              (aiConfig as any)?.marketResearch ||
              meta?.policyDecision ||
              meta?.sourceLedger ||
              (meta?.policyNotices && meta.policyNotices.length) ||
              meta?.trustBundle
                ? {
                    ...(aiConfig?.deepResearch || (aiConfig as any)?.marketResearch
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
                    ...(meta?.policyDecision || (meta?.policyNotices && meta.policyNotices.length)
                      ? {
                          policyDecision: meta?.policyDecision,
                          policyNotices: meta?.policyNotices,
                        }
                      : {}),
                    ...(meta?.sourceLedger ? { sourceLedger: meta.sourceLedger } : {}),
                    // V8 / Wave A7 — forward the canonical trust bundle so
                    // the persisted AI row carries the same pills rendered
                    // live in the bubble. Server also enriches on write;
                    // this keeps client + server in lockstep and avoids
                    // depending on a refetch for live hydration.
                    ...(meta?.trustBundle ? { trustBundle: meta.trustBundle } : {}),
                  }
                : undefined,
            }),
          });
          savedAiMessageId = String((saved as any)?.id || '') || null;
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
        ...(aiConfig?.deepResearch || (aiConfig as any)?.marketResearch
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
            } as any)
          : {}),
        metadata: {
          ...(aiConfig?.deepResearch || (aiConfig as any)?.marketResearch
            ? { deepThinking: { kind: 'report' } }
            : {}),
          ...(meta?.policyDecision ? { policyDecision: meta.policyDecision } : {}),
          ...(meta?.policyNotices && meta.policyNotices.length ? { policyNotices: meta.policyNotices } : {}),
          ...(meta?.sourceLedger ? { sourceLedger: meta.sourceLedger } : {}),
          ...(meta?.trustBundle ? { trustBundle: meta.trustBundle } : {}),
        },
      });

      // Auto-read AI response if enabled (speak only remaining text not already spoken during streaming)
      if (autoReadEnabledRef.current && safeText) {
        const cleaned = cleanTextForSpeech(safeText);
        const remaining = cleaned.slice(spokenCharsRef.current).trim();
        if (remaining) {
          console.log('[TTS] Speaking remaining:', remaining.slice(0, 60) + '…');
          speak(remaining).catch((err) => console.warn('[TTS] speak error:', err));
        }
        spokenCharsRef.current = 0;
      }

      // Chat intent -> auto save AI output to My Work (Idea / Notebook)
      const pendingSave = pendingChatSaveIntentRef.current;
      pendingChatSaveIntentRef.current = null;
      if (pendingSave && !isLikelyAiFailureText(safeText)) {
        const aiMessageId = savedAiMessageId || `ai-auto-${Date.now()}`;
        if (pendingSave.target === 'idea') {
          await saveMessageAsIdea(aiMessageId, safeText, {
            navigateToMyWork: false,
            autoTriggered: true,
          });
        } else if (pendingSave.target === 'note') {
          await saveMessageAsNote(aiMessageId, safeText, {
            navigateToMyWork: false,
            autoTriggered: true,
          });
        }
      } else if (pendingSave && isLikelyAiFailureText(safeText)) {
        // Fallback: when AI stream fails/returns empty, still persist user intent content.
        const fallbackBody = pendingSave.originalUserMessage || '';
        const aiMessageId = savedAiMessageId || `ai-auto-fallback-${Date.now()}`;
        if (pendingSave.target === 'idea') {
          await saveMessageAsIdea(aiMessageId, fallbackBody, {
            navigateToMyWork: false,
            autoTriggered: true,
          });
        } else if (pendingSave.target === 'note') {
          await saveMessageAsNote(aiMessageId, fallbackBody, {
            navigateToMyWork: false,
            autoTriggered: true,
          });
        }
      }

      // Agent Audit Layer: run post-DT review on the CLOSED report
      if (
        aiConfig?.deepResearch &&
        deepThinkingRunRef.current &&
        deepThinkingRunRef.current.conversationId === liveActiveConversationId &&
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
              lines.push(`- (${String(r.area || 'other')}) ${String(r.claim || '').trim()}`.trim());
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
      const pendingSave = pendingChatSaveIntentRef.current;
      pendingChatSaveIntentRef.current = null;
      if ((err as any)?.code === 'DEEP_THINKING_CONFIRM_REQUIRED') {
        // Flow-control error: do not persist as a chat message.
        setThinkingSteps([]);
        return;
      }
      // Make failures visible in the conversation UI (otherwise user only sees their own messages).
      const friendly = getTeresaStartFailureMessage(i18n.language);

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

      // Fallback save on hard stream error.
      if (pendingSave) {
        const fallbackBody = pendingSave.originalUserMessage || '';
        const fallbackMessageId = `ai-error-fallback-${Date.now()}`;
        if (pendingSave.target === 'idea') {
          await saveMessageAsIdea(fallbackMessageId, fallbackBody, {
            navigateToMyWork: false,
            autoTriggered: true,
          });
        } else if (pendingSave.target === 'note') {
          await saveMessageAsNote(fallbackMessageId, fallbackBody, {
            navigateToMyWork: false,
            autoTriggered: true,
          });
        }
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

  // =========================================================================
  // Incremental TTS: speak sentence-by-sentence WHILE AI is streaming
  // =========================================================================
  useEffect(() => {
    if (isStreaming) {
      spokenCharsRef.current = 0;
    }
  }, [isStreaming]);

  useEffect(() => {
    if (!autoReadEnabledRef.current || !isStreaming || !streamedContent) return;

    const text = cleanTextForSpeech(streamedContent);
    if (!text || text.length <= spokenCharsRef.current) return;

    const unspoken = text.slice(spokenCharsRef.current);
    // Split on sentence boundaries (. ! ? followed by whitespace, or newlines)
    const sentenceEnd = /(?<=[.!?])\s+|(?<=\n)\s*/g;
    const parts = unspoken.split(sentenceEnd).filter(Boolean);

    if (parts.length > 1) {
      // Speak all complete sentences, keep the last (potentially incomplete) part
      const toSpeak = parts.slice(0, -1).join(' ').trim();
      if (toSpeak) {
        console.log('[TTS] Speaking sentence:', toSpeak.slice(0, 60) + '…');
        speak(toSpeak).catch((err) => console.warn('[TTS] speak error:', err));
        spokenCharsRef.current += unspoken.length - parts[parts.length - 1].length;
      }
    }
  }, [isStreaming, streamedContent, speak]);

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
            policyDecision,
            policyNotices,
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
    policyDecision,
    policyNotices,
  ]);

  const latestUserGoalHint = useMemo(() => {
    const latestUserMessage = [...displayMessages]
      .reverse()
      .find(
        (message) => message.role === 'user' && String(message.content || '').trim().length > 0
      );
    return String(latestUserMessage?.content || '').trim();
  }, [displayMessages]);

  const v8SnapshotContext = useMemo(() => {
    const workspaceId = isUuidLike(workspaceContext?.entityId)
      ? workspaceContext.entityId
      : isUuidLike(workspaceContext?.projectId)
        ? workspaceContext.projectId
        : isUuidLike(currentOrganization?.id)
          ? currentOrganization.id
          : null;

    const projectId = isUuidLike(workspaceContext?.projectId) ? workspaceContext.projectId : null;
    const resolvedRoleRef =
      typeof currentUser?.role === 'string' && currentUser.role.trim().length > 0
        ? currentUser.role.trim().toLowerCase()
        : 'member';

    return {
      workspaceId,
      projectId,
      effectiveScopeRef: 'workspace',
      resolvedRoleRef,
      privacyMode: isPrivateMode,
    };
  }, [
    currentOrganization?.id,
    currentUser?.role,
    isPrivateMode,
    workspaceContext?.entityId,
    workspaceContext?.projectId,
  ]);

  // ========================================================================
  // V3-B01: Contextual smart suggestions (shown below input after first exchange)
  // ========================================================================

  const chatSuggestions: ChatSuggestion[] = useMemo(() => {
    if (displayMessages.length < 2 || isStreaming) return [];
    const items: ChatSuggestion[] = [];

    if (workspaceContext?.type === 'initiative') {
      items.push({
        id: 'open-initiative',
        label: t('chat.suggestions.openInitiative', 'Open initiative'),
        type: 'initiative',
        action: {
          type: 'NAVIGATE',
          targetModule: 'initiatives',
          entityId: workspaceContext.entityId ?? undefined,
        },
      });
    }

    if (workspaceContext?.type === 'insight' || workspaceContext?.type === 'interview') {
      items.push(
        {
          id: 'generate-insights',
          label: t('chat.suggestions.generateInsights', 'Generate AI insights from completed sessions'),
          type: 'interview' as any,
          action: { type: 'chat', prompt: t('chat.suggestions.generateInsightsPrompt', 'Generate AI insights from completed interview sessions') },
        },
        {
          id: 'submit-review',
          label: t('chat.suggestions.submitReview', 'Submit this insight for review'),
          type: 'interview' as any,
          action: { type: 'chat', prompt: t('chat.suggestions.submitReviewPrompt', 'Submit this insight for review') },
        },
        {
          id: 'export-initiative',
          label: t('chat.suggestions.exportInsight', 'Export insight to initiative'),
          type: 'interview' as any,
          action: { type: 'chat', prompt: t('chat.suggestions.exportInsightPrompt', 'Export this insight to an initiative') },
        },
        {
          id: 'view-evidence',
          label: t('chat.suggestions.viewEvidence', 'View evidence map'),
          type: 'interview' as any,
          action: { type: 'NAVIGATE', targetModule: 'interview' },
        },
      );
    }

    items.push({
      id: 'open-tools',
      label: t('chat.suggestions.openTools', 'Open Tools hub'),
      type: 'tool',
      action: { type: 'NAVIGATE', targetModule: 'tools' },
    });

    items.push({
      id: 'go-results',
      label: t('chat.suggestions.goResults', 'View Results'),
      type: 'results',
      action: { type: 'NAVIGATE', targetModule: 'results' },
    });

    const lastContent = String(
      (displayMessages[displayMessages.length - 1] as any)?.content || ''
    ).toLowerCase();
    const artifactMentioned =
      workspaceContext?.type === 'report' ||
      workspaceContext?.type === 'presentation' ||
      /\b(report|presentation|artifact|output|deck|sheet|template)\b/.test(lastContent);

    if (artifactMentioned) {
      items.push(
        {
          id: 'open-outputs',
          label: t('chat.suggestions.openOutputs', 'Open Outputs Library'),
          type: 'outputs' as any,
          action: { type: 'NAVIGATE', targetModule: 'presentations' },
        },
        {
          id: 'review-pending',
          label: t('chat.suggestions.reviewPending', 'Review pending artifacts'),
          type: 'outputs' as any,
          action: { type: 'NAVIGATE', targetModule: 'presentations', params: { tab: 'review' } },
        },
      );
    }

    return items;
  }, [displayMessages.length, isStreaming, workspaceContext, t]);

  // `handleSuggestionClick` is declared below `handleSendMessage` to avoid a
  // temporal-dead-zone reference when a suggestion of type 'chat' forwards
  // the prompt straight into the send pipeline. See decl further down.

  // ========================================================================
  // Ensure messages are loaded when activeConversationId changes (e.g. after
  // navigating between screens or browser refresh with localStorage rehydration)
  // ========================================================================

  useEffect(() => {
    if (activeConversationId && activeMessages.length === 0 && !isConversationLoading) {
      fetchConversation(activeConversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

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

      // M2: Chat commands for MyWork actions
      const text = content.trim();
      if (text.startsWith('/task ') || text.startsWith('/decision ')) {
        const isTask = text.startsWith('/task ');
        const title = text.replace(/^\/(task|decision)\s+/, '').trim();
        if (title) {
          try {
            const token = localStorage.getItem('token');
            const resp = await fetch('/api/my-work/chat-actions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: isTask ? 'create_task' : 'create_decision',
                payload: { title },
              }),
            });
            if (resp.ok) {
              const confirmMsg: ChatMessage = {
                id: `action-${Date.now()}`,
                role: 'ai',
                content: isTask ? `Task created: "${title}"` : `Decision created: "${title}"`,
                timestamp: new Date(),
              };
              addChatMessage(confirmMsg);
              if (activeConversationId) {
                try {
                  await addMessageToConversation({
                    conversationId: activeConversationId,
                    role: 'ai',
                    content: confirmMsg.content,
                    messageType: 'text',
                  });
                } catch {
                  /* best-effort persist */
                }
              }
              onMessageSent?.(content);
              return;
            }
          } catch {
            /* fall through to normal send */
          }
        }
      }

      // Explicit output tool routing (user picked a tool via OutputToolSelector)
      const outputTool = useAppStore.getState().chatOutputTool;
      if (outputTool !== 'auto') {
        const routeMap: Record<string, string> = {
          wordy: '/wordy',
          excele: '/excele',
          prezentacje: '/prezentacje',
        };
        const uiLangExplicit = (i18n.language || 'en').split('-')[0];
        const labelMap: Record<string, { pl: string; en: string }> = {
          wordy: { pl: 'Dokumenty', en: 'Documents' },
          excele: { pl: 'Tabele', en: 'Tables' },
          prezentacje: { pl: 'Prezentacje', en: 'Presentations' },
        };
        const label = labelMap[outputTool]?.[uiLangExplicit === 'pl' ? 'pl' : 'en'] || outputTool;

        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        if (activeConversationId) {
          try {
            await addMessageToConversation({
              conversationId: activeConversationId,
              role: 'user',
              content,
              messageType: 'text',
            });
          } catch {
            /* best-effort persist */
          }
        }

        addChatMessage({
          id: `tool-redirect-${Date.now()}`,
          role: 'ai',
          content:
            uiLangExplicit === 'pl'
              ? `Otwieram ${label} — zaraz zaczynam pracę.`
              : `Opening ${label} — starting work now.`,
          timestamp: new Date(),
        });

        useAppStore.getState().setChatKickoffMessage(text);
        useAppStore.getState().setChatOutputTool('auto');
        navigateToRoute(routeMap[outputTool]);
        onMessageSent?.(content);
        return;
      }

      // P23 Excele: intercept workbook/excel/financial model intents before Table Builder
      if (detectExceleIntent(text)) {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        if (activeConversationId) {
          try {
            await addMessageToConversation({
              conversationId: activeConversationId,
              role: 'user',
              content,
              messageType: 'text',
            });
          } catch {
            /* best-effort persist */
          }
        }

        const uiLang = (i18n.language || 'en').split('-')[0];
        addChatMessage({
          id: `excele-redirect-${Date.now()}`,
          role: 'ai',
          content:
            uiLang === 'pl'
              ? 'Otwieram Tabele \u2014 zaraz przygotuję Twój skoroszyt.'
              : "Opening Tables \u2014 I'll prepare your workbook.",
          timestamp: new Date(),
        });

        useAppStore.getState().setChatKickoffMessage(text);
        navigateToRoute('/excele');
        onMessageSent?.(content);
        return;
      }

      // Dokumenty: intercept document/report creation intents
      if (detectDocumentIntent(text)) {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        if (activeConversationId) {
          try {
            await addMessageToConversation({
              conversationId: activeConversationId,
              role: 'user',
              content,
              messageType: 'text',
            });
          } catch {
            /* best-effort persist */
          }
        }

        const uiLangDoc = (i18n.language || 'en').split('-')[0];
        addChatMessage({
          id: `doc-redirect-${Date.now()}`,
          role: 'ai',
          content:
            uiLangDoc === 'pl'
              ? 'Otwieram Dokumenty \u2014 zaraz zaczynam pracę nad dokumentem.'
              : "Opening Documents \u2014 I'll start working on your document.",
          timestamp: new Date(),
        });

        useAppStore.getState().setChatKickoffMessage(text);
        navigateToRoute('/wordy');
        onMessageSent?.(content);
        return;
      }

      // Prezentacje: intercept presentation/deck creation intents
      if (detectPresentationIntent(text)) {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        if (activeConversationId) {
          try {
            await addMessageToConversation({
              conversationId: activeConversationId,
              role: 'user',
              content,
              messageType: 'text',
            });
          } catch {
            /* best-effort persist */
          }
        }

        const uiLangPrez = (i18n.language || 'en').split('-')[0];
        addChatMessage({
          id: `prez-redirect-${Date.now()}`,
          role: 'ai',
          content:
            uiLangPrez === 'pl'
              ? 'Otwieram Prezentacje \u2014 zaraz przygotuję deck.'
              : "Opening Presentations \u2014 I'll prepare your deck.",
          timestamp: new Date(),
        });

        useAppStore.getState().setChatKickoffMessage(text);
        navigateToRoute('/prezentacje');
        onMessageSent?.(content);
        return;
      }

      // Table Platform: intercept table creation/modification intents
      // Opens the AI Table Builder slide-over panel with the user's message
      if (detectTableIntent(text)) {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        if (activeConversationId) {
          try {
            await addMessageToConversation({
              conversationId: activeConversationId,
              role: 'user',
              content,
              messageType: 'text',
            });
          } catch {
            /* best-effort persist */
          }
        }

        const uiLang = (i18n.language || 'en').split('-')[0];
        addChatMessage({
          id: `table-builder-${Date.now()}`,
          role: 'ai',
          content:
            uiLang === 'pl'
              ? 'Otwieram AI Kreator Tabel \u2014 zaraz przygotuję propozycję struktury.'
              : "Opening AI Table Builder \u2014 I'll prepare a structure proposal for you.",
          timestamp: new Date(),
        });

        setTableBuilderInitialMsg(text);
        setTableBuilderOpen(true);

        onMessageSent?.(content);
        return;
      }

      // Whiteboard: intercept brainstorm/whiteboard/workshop intents
      const wbAction = detectWhiteboardIntent(text);
      if (wbAction) {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        addChatMessage(userMessage);

        const uiLang = (i18n.language || 'en').split('-')[0];
        addChatMessage({
          id: `wb-intent-${Date.now()}`,
          role: 'ai',
          content:
            uiLang === 'pl'
              ? 'Wykonuję akcję na tablicy…'
              : 'Running whiteboard action…',
          timestamp: new Date(),
        });

        window.dispatchEvent(
          new CustomEvent('idea-workspace-quick-action', {
            detail: { action: wbAction },
          })
        );

        onMessageSent?.(content);
        return;
      }

      const saveIntent = parseChatSaveIntent(content);
      const effectivePrompt = saveIntent?.cleanPrompt || content;
      pendingChatSaveIntentRef.current = null;

      // Demo session enforcement (time + AI interactions quota)
      if (isDemo) {
        // Feedback #4180b14f: previously we attached a hardcoded English
        // `message` + `cta` to the access:blocked event, and the
        // AccessBlockedModal preferred that string over its i18n catalog —
        // so DE/ES/AR/JP users never saw a translated popup. Emit only the
        // error `code` here and let the modal resolve the localized copy
        // via `access.blocked.<code>` / `access.cta.*` keys.
        if (demoTimeRemainingMs <= 0) {
          window.dispatchEvent(
            new CustomEvent('access:blocked', {
              detail: { code: 'DEMO_TIME_EXPIRED' },
            })
          );
          return;
        }

        if ((aiInteractionsRemaining ?? 0) <= 0) {
          window.dispatchEvent(
            new CustomEvent('access:blocked', {
              detail: { code: 'DEMO_AI_SESSION_LIMIT_REACHED' },
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

      // Conversation-scoped attachments: upload supported files to Knowledge Base and
      // pass doc filters to the backend so RAG only searches within these attachments.
      const existingAttachmentDocIds = Array.from(
        new Set(
          (customMessages || messages || [])
            .flatMap((m: any) =>
              Array.isArray(m?.metadata?.attachments) ? m.metadata.attachments : []
            )
            .map((a: any) => a?.docId)
            .filter(Boolean)
            .map((x: any) => String(x))
        )
      );

      const files: File[] = Array.isArray(attachments)
        ? attachments.filter(
            (a: any): a is File => typeof File !== 'undefined' && a instanceof File
          )
        : [];

      const urlAttachments: Array<{ kind?: string; url: string; title?: string; name?: string }> =
        Array.isArray(attachments)
          ? attachments
              .filter((a: any) => a && typeof a === 'object' && typeof a.url === 'string')
              .map((a: any) => ({
                kind: a.kind,
                url: String(a.url),
                title: a.title ? String(a.title) : undefined,
                name: a.name ? String(a.name) : undefined,
              }))
          : [];

      const uploadedAttachments: Array<{
        docId: string;
        filename: string;
        mimeType?: string;
        size?: number;
        sourceUrl?: string;
        kind?: 'file' | 'url';
      }> = [];

      // Show a visible "Analyzing file..." status message while files are being processed (C4.1)
      const sourcesCount = files.length + urlAttachments.length;
      const fileAnalysisMessageId = sourcesCount > 0 ? `file-analysis-${Date.now()}` : null;
      if (sourcesCount > 0 && fileAnalysisMessageId) {
        const sourceNames = [
          ...files.map((f) => f.name),
          ...urlAttachments.map((u) => u.name || u.url),
        ].join(', ');
        addChatMessage({
          id: fileAnalysisMessageId,
          role: 'assistant',
          content: t(
            'aiChat.attachments.analyzingSources',
            '📎 Analyzing {{count}} attachment(s): {{names}}... Extracting content for AI analysis.',
            { count: sourcesCount, names: sourceNames }
          ),
          timestamp: new Date(),
          isStreaming: true,
        } as ChatMessage);
        setIsBotTyping(true);
      }

      for (const file of files) {
        if (!isSupportedChatAttachment(file)) {
          console.warn('[UnifiedChatPanel] Skipping unsupported attachment type:', {
            name: file.name,
            type: file.type,
            size: file.size,
          });
          toast.error(
            t(
              'aiChat.attachments.unsupportedType',
              'Plik "{{name}}" nie jest obsługiwany. Dozwolone formaty: {{types}}.',
              { name: file.name, types: SUPPORTED_CHAT_ATTACHMENT_LABEL }
            ),
            { duration: 5000 }
          );
          continue;
        }

        try {
          const resp = await Api.uploadChatAttachment(file);
          const docId = String((resp as any)?.docId || '');
          if (!docId) {
            toast.error(
              t('aiChat.attachments.uploadFailed', 'Nie udało się przetworzyć pliku "{{name}}".', {
                name: file.name,
              }),
              { duration: 4000 }
            );
            continue;
          }
          uploadedAttachments.push({
            docId,
            filename: file.name,
            mimeType: file.type || undefined,
            size: file.size,
            kind: 'file',
          });
          toast.success(
            t('aiChat.attachments.uploadSuccess', 'Załącznik "{{name}}" przetworzony.', {
              name: file.name,
            }),
            { duration: 2000 }
          );
        } catch (err: any) {
          console.error('[UnifiedChatPanel] Failed to upload attachment:', err);
          const errMsg = String(err?.message || '');
          const isTextExtraction = errMsg.includes('extract') || errMsg.includes('text');
          toast.error(
            isTextExtraction
              ? t(
                  'aiChat.attachments.extractionFailed',
                  'Nie udało się odczytać tekstu z pliku "{{name}}". Sprawdź czy plik nie jest pusty lub uszkodzony.',
                  { name: file.name }
                )
              : t(
                  'aiChat.attachments.uploadError',
                  'Błąd przesyłania pliku "{{name}}": {{error}}',
                  { name: file.name, error: errMsg.slice(0, 100) }
                ),
            { duration: 5000 }
          );
        }
      }

      for (const urlAtt of urlAttachments) {
        const url = String(urlAtt.url || '').trim();
        if (!url) continue;
        try {
          const resp = await Api.ingestChatUrlAttachment(url, { title: urlAtt.title });
          const docId = String((resp as any)?.docId || '');
          if (!docId) {
            toast.error(
              t('aiChat.attachments.urlIngestFailed', 'Nie udało się przetworzyć linku.'),
              {
                duration: 4000,
              }
            );
            continue;
          }
          const filename = String((resp as any)?.filename || '').trim() || urlAtt.name || url;
          uploadedAttachments.push({
            docId,
            filename,
            mimeType: (resp as any)?.mimeType || 'text/html',
            sourceUrl: String((resp as any)?.sourceUrl || url),
            kind: 'url',
          });
          toast.success(t('aiChat.attachments.urlReady', 'Link przetworzony.'), { duration: 1500 });
        } catch (err: any) {
          console.error('[UnifiedChatPanel] Failed to ingest URL attachment:', err);
          toast.error(
            t('aiChat.attachments.urlError', 'Błąd przetwarzania linku: {{error}}', {
              error: String(err?.message || '').slice(0, 120),
            }),
            { duration: 5000 }
          );
        }
      }

      // Remove the "Analyzing file..." message once processing is done
      if (fileAnalysisMessageId) {
        if (uploadedAttachments.length > 0) {
          const processedNames = uploadedAttachments.map((a) => a.filename).join(', ');
          const partialFailure = uploadedAttachments.length < sourcesCount;
          addChatMessage({
            id: fileAnalysisMessageId,
            role: 'assistant',
            content: partialFailure
              ? t(
                  'aiChat.attachments.filesPartial',
                  '⚠️ {{processed}}/{{total}} attachment(s) processed: {{names}}. Some sources could not be read and will not be referenced. You can retry them or continue.',
                  {
                    processed: uploadedAttachments.length,
                    total: sourcesCount,
                    names: processedNames,
                  }
                )
              : t(
                  'aiChat.attachments.filesReady',
                  '📎 {{count}} attachment(s) ready for analysis: {{names}}. The AI will reference these sources in its response.',
                  { count: uploadedAttachments.length, names: processedNames }
                ),
            timestamp: new Date(),
          } as ChatMessage);
        } else if (sourcesCount > 0) {
          // All attachments failed — surface a persistent, actionable error in the chat
          // instead of silently deleting the analysis message (feedback #f590c4fc, #e196a572).
          const failedNames = [
            ...files.map((f) => f.name),
            ...urlAttachments.map((u) => u.name || u.url),
          ].join(', ');
          addChatMessage({
            id: fileAnalysisMessageId,
            role: 'assistant',
            content: t(
              'aiChat.attachments.allFailed',
              '❌ Could not process the attached source(s): {{names}}. The AI will respond without them. Please re-upload in a supported format (PDF, TXT, MD, CSV, JSON) or check that the link is publicly accessible.',
              { names: failedNames }
            ),
            timestamp: new Date(),
          } as ChatMessage);
        } else {
          deleteChatMessage(fileAnalysisMessageId);
        }
        setIsBotTyping(false);
      }

      const attachmentDocIds = Array.from(
        new Set([...existingAttachmentDocIds, ...uploadedAttachments.map((a) => a.docId)])
      );

      // Save user message to conversation store
      if (conversationId) {
        try {
          await addMessageToConversation({
            conversationId,
            role: 'user',
            content,
            messageType: 'text',
            metadata:
              uploadedAttachments.length > 0
                ? ({ attachments: uploadedAttachments } as any)
                : undefined,
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

      // Build context for AI — include file metadata so the model can cite/reference attachments (C4.1)
      const context = {
        focusMode,
        attachments: uploadedAttachments,
        attachmentDocIds,
        // Provide file names and types so the AI can reference them in its response
        attachmentFileNames: uploadedAttachments.map((a) => a.filename),
        hasAttachments: uploadedAttachments.length > 0,
        // v3 context-awareness: pass project + screen context in the shape expected by backend
        projectId: workspaceContext?.projectId || null,
        screenContext: {
          screenId: workspaceContext?.view || workspaceContext?.type || null,
          currentScreen: workspaceContext?.type || null,
          selectedObjectId: workspaceContext?.entityId || null,
          selectedObjectType: workspaceContext?.type || null,
          route: routeInfo,
          page: (workspaceContext as any)?.entityData || null,
        },
        workspaceContext,
        conversationId,
        conversationLanguage: chatLanguage,
        virtualWorkerSlug: 'teresa',
      };

      // Backend expects history roles as: user | model (Gemini-style)
      const history = (customMessages || messages).map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const normalized = String(effectivePrompt || '')
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
      if ((aiConfig?.deepResearch || (aiConfig as any)?.marketResearch) && isForceDepth) {
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

        pendingChatSaveIntentRef.current = saveIntent
          ? { target: saveIntent.target, originalUserMessage: content }
          : null;
        await startStream(
          effectivePrompt,
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
      if (aiConfig?.deepResearch || (aiConfig as any)?.marketResearch) {
        if (dtConfirmBusy) return;
        setDtConfirmBusy(true);
        try {
          const confirmRes = await Api.chatConfirm(
            effectivePrompt,
            history,
            systemPrompt,
            context,
            roleName,
            chatLanguage,
            {
              deepResearch: aiConfig?.deepResearch,
              webSearch: aiConfig?.webSearch,
              showReasoning: aiConfig?.showReasoning,
              marketResearch: (aiConfig as any)?.marketResearch,
              coThinkerMode: (aiConfig as any)?.coThinkerMode ?? null,
              privateMode: (aiConfig as any)?.privateMode ?? false,
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
                deepThinking: { kind: 'confirm', originalMessage: effectivePrompt },
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
                deepThinking: { kind: 'confirm', originalMessage: effectivePrompt },
                deepThinkingConfirm: c,
                agentAuditSuggested: suggestedAgentsSet,
              },
            } as any);
          }

          setDtPendingConfirm({
            messageId: confirmMessageId,
            conversationId: conversationId || null,
            originalMessage: effectivePrompt,
            editedMessage: effectivePrompt,
            confirm: c,
            context,
            attachments,
            agentAudit: {
              suggested: suggestedAgentsSet,
              orchestratorRunId: String(suggestedAgentsSet?.orchestratorRunId || ''),
              selectedAgentIds: Array.isArray(suggestedAgentsSet?.agents)
                ? suggestedAgentsSet.agents
                    .map((a: any) => String(a?.agentId || ''))
                    .filter(Boolean)
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
      pendingChatSaveIntentRef.current = saveIntent
        ? { target: saveIntent.target, originalUserMessage: content }
        : null;
      await startStream(
        effectivePrompt,
        history,
        systemPrompt,
        context,
        focusMode,
        roleName,
        chatLanguage
      );

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
      i18n.language,
      setIsBotTyping,
    ]
  );

  // Chat V8 — smart-suggestion dispatcher. Lives below `handleSendMessage`
  // so the `type: 'chat'` branch can forward the prompt straight into the
  // send pipeline without hitting a temporal-dead-zone reference.
  const handleSuggestionClick = useCallback(
    async (suggestion: ChatSuggestion) => {
      if (suggestion.action.type === 'chat') {
        const prompt = String((suggestion.action as { prompt?: unknown }).prompt ?? '').trim();
        if (!prompt) return;
        await handleSendMessage(prompt);
        return;
      }
      await handleChatAction(suggestion.action);
    },
    [handleChatAction, handleSendMessage]
  );

  // One-shot kickoff: when panel opens in split mode, auto-send the configured message.
  useEffect(() => {
    if (!kickoffMessage) return;
    if (isDisabled) return;
    if (isStreaming) return;
    if ((customMessages || []).length > 0) return;
    if ((activeMessages || []).length > 0) return;
    if (lastKickoffSentRef.current === kickoffMessage) return;

    // Fire-and-forget; handleSendMessage creates conversation if needed
    void handleSendMessage(kickoffMessage);
    lastKickoffSentRef.current = kickoffMessage;
    onKickoffConsumed?.();
  }, [
    kickoffMessage,
    isDisabled,
    isStreaming,
    customMessages,
    activeMessages,
    handleSendMessage,
    onKickoffConsumed,
  ]);

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
      dtPendingConfirm.agentAudit?.decisionContext ||
      ({
        topic: String(
          dtPendingConfirm.editedMessage || dtPendingConfirm.originalMessage || ''
        ).trim(),
        horizon:
          String(dtPendingConfirm?.confirm?.understanding?.decisionHorizon || '').trim() ||
          undefined,
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
        lines.push(
          `- Intent: **${String(dtPendingConfirm.agentAudit?.userIntent || 'validate')}**`
        );
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
          marketResearch: (aiConfig as any)?.marketResearch,
          coThinkerMode: (aiConfig as any)?.coThinkerMode ?? null,
          privateMode: (aiConfig as any)?.privateMode ?? false,
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
        topic: String(
          dtPendingConfirm.editedMessage || dtPendingConfirm.originalMessage || ''
        ).trim(),
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
    async (overrides?: {
      userIntent?: 'validate' | 'stress_test' | 'approve';
      maxAgents?: 2 | 3 | 4;
    }) => {
      if (!dtPendingConfirm) return;
      const decisionContext =
        dtPendingConfirm.agentAudit?.decisionContext ||
        ({
          topic: String(
            dtPendingConfirm.editedMessage || dtPendingConfirm.originalMessage || ''
          ).trim(),
          industry: undefined,
          horizon: undefined,
          functions: [],
          riskFocus: [],
        } as any);

      const userIntent =
        overrides?.userIntent || dtPendingConfirm.agentAudit?.userIntent || ('validate' as const);
      const maxAgents =
        overrides?.maxAgents || dtPendingConfirm.agentAudit?.maxAgents || (3 as const);

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
      const prompt = String(
        agentAuditPayload?.verdict?.directedLoop?.deepThinkingPrompt || ''
      ).trim();
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

  // T009: Save message output as My Idea (private)
  const handleSaveAsIdea = useCallback(
    async (messageId: string, content: string) => {
      await saveMessageAsIdea(messageId, content, { navigateToMyWork: true, autoTriggered: false });
    },
    [saveMessageAsIdea]
  );

  // T011: Save message output as Notebook page (private)
  const handleSaveAsNote = useCallback(
    async (messageId: string, content: string) => {
      await saveMessageAsNote(messageId, content, { navigateToMyWork: true, autoTriggered: false });
    },
    [saveMessageAsNote]
  );

  const handleSaveToContext = useCallback(
    async (messageId: string, _content: string, _role: 'user' | 'ai') => {
      if (!activeConversationId) return;
      setContextSaveBusyMessageId(messageId);
      try {
        const response = await Api.saveConversationMessageToContext(
          activeConversationId,
          messageId
        );
        setContextSavedMessageIds((prev) => {
          const next = new Set(prev);
          next.add(messageId);
          return next;
        });
        toast.success(
          response?.alreadyCaptured
            ? t('chat.context.alreadySaved', 'Message is already in Context OS')
            : t('chat.context.saved', 'Saved to Context OS')
        );
      } catch (err) {
        console.error('[UnifiedChatPanel] Failed to save message to context:', err);
        toast.error(t('chat.context.saveFailed', 'Failed to save to Context OS'));
      } finally {
        setContextSaveBusyMessageId(null);
      }
    },
    [activeConversationId, t]
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
        // v3 context-awareness: pass project + screen context in the shape expected by backend
        projectId: workspaceContext?.projectId || null,
        screenContext: {
          screenId: workspaceContext?.view || workspaceContext?.type || null,
          currentScreen: workspaceContext?.type || null,
          selectedObjectId: workspaceContext?.entityId || null,
          selectedObjectType: workspaceContext?.type || null,
          route: routeInfo,
          page: (workspaceContext as any)?.entityData || null,
        },
        conversationId: activeConversationId,
        conversationLanguage: chatLanguage,
        virtualWorkerSlug: 'teresa',
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
              marketResearch: (aiConfig as any)?.marketResearch,
              coThinkerMode: (aiConfig as any)?.coThinkerMode ?? null,
              privateMode: (aiConfig as any)?.privateMode ?? false,
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
        await startStream(
          newText,
          history,
          systemPrompt,
          context,
          focusMode,
          roleName,
          chatLanguage
        );
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
  // Agent Audit: Accept risk handler (extracted for MessageRenderer)
  // ========================================================================

  const handleAgentAuditAccept = useCallback(
    async (audit: any, _msgId: string) => {
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
            metadata: {
              agentAudit: { kind: 'accept', runId },
            } as any,
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
    },
    [activeConversationId, addChatMessage, addMessageToConversation, agentAuditBusy]
  );

  // ========================================================================
  // V8 governed proposal handlers (CHAT_V8_ACTIONS_AND_APPROVALS)
  // ========================================================================

  const [proposalBusyById, setProposalBusyById] = useState<
    Record<string, { approve?: boolean; reject?: boolean }>
  >({});

  const handleProposalApprove = useCallback(
    async (proposalId: string, msg: ChatMessage) => {
      if (!proposalId) return;
      setProposalBusyById((prev) => ({
        ...prev,
        [proposalId]: { ...(prev[proposalId] || {}), approve: true },
      }));
      try {
        const result: any = await Api.approveAIAction(
          proposalId,
          activeConversationId || undefined
        );
        if (result?.success !== false) {
          useProposalLifecycleStore.getState().patchLifecycle(proposalId, {
            lifecycleState: 'approved',
            actionType: (msg as any)?.metadata?.executionProposal?.actionType,
            latestMessageType: 'execution_progress',
          });
          // Optimistic local echo so the thread reflects the new lifecycle state
          // immediately — backend already persisted the execution_progress row.
          addChatMessage({
            id: `exec-progress-${proposalId}-${Date.now()}`,
            role: 'ai',
            content: 'Proposal approved — ready to execute.',
            timestamp: new Date(),
            type: 'execution_progress',
            metadata: {
              executionProposal: {
                proposalId,
                lifecycleState: 'approved',
                actionType: (msg as any)?.metadata?.executionProposal?.actionType,
              },
            },
          } as any);
        }
      } catch (err) {
        console.error('[UnifiedChatPanel] Proposal approve failed:', err);
      } finally {
        setProposalBusyById((prev) => {
          const next = { ...prev };
          const entry = { ...(next[proposalId] || {}) };
          delete entry.approve;
          if (Object.keys(entry).length === 0) delete next[proposalId];
          else next[proposalId] = entry;
          return next;
        });
      }
    },
    [activeConversationId, addChatMessage]
  );

  const handleProposalReject = useCallback(
    async (proposalId: string, msg: ChatMessage, reason?: string) => {
      if (!proposalId) return;
      setProposalBusyById((prev) => ({
        ...prev,
        [proposalId]: { ...(prev[proposalId] || {}), reject: true },
      }));
      try {
        const result: any = await Api.rejectAIAction(
          proposalId,
          reason,
          activeConversationId || undefined
        );
        if (result?.success !== false) {
          useProposalLifecycleStore.getState().patchLifecycle(proposalId, {
            lifecycleState: 'rejected',
            actionType: (msg as any)?.metadata?.executionProposal?.actionType,
            rejectionReason: reason || null,
            latestMessageType: 'execution_result',
          });
          addChatMessage({
            id: `exec-result-${proposalId}-${Date.now()}`,
            role: 'ai',
            content: reason ? `Proposal rejected — ${reason}` : 'Proposal rejected.',
            timestamp: new Date(),
            type: 'execution_result',
            metadata: {
              executionProposal: {
                proposalId,
                lifecycleState: 'rejected',
                actionType: (msg as any)?.metadata?.executionProposal?.actionType,
                rejectionReason: reason || null,
              },
            },
          } as any);
        }
      } catch (err) {
        console.error('[UnifiedChatPanel] Proposal reject failed:', err);
      } finally {
        setProposalBusyById((prev) => {
          const next = { ...prev };
          const entry = { ...(next[proposalId] || {}) };
          delete entry.reject;
          if (Object.keys(entry).length === 0) delete next[proposalId];
          else next[proposalId] = entry;
          return next;
        });
      }
    },
    [activeConversationId, addChatMessage]
  );

  // ========================================================================
  // Render helpers
  // ========================================================================

  const renderMessage = (msg: ChatMessage, index: number) => (
    <MessageRenderer
      key={msg.id}
      msg={msg}
      index={index}
      displayMessages={displayMessages}
      isCompact={isCompact}
      isDisabled={isDisabled}
      activeConversationId={activeConversationId}
      thinkingSteps={thinkingSteps}
      streamStartedAt={streamStartedAt}
      streamCompletedSignal={streamCompletedSignal}
      retryInfo={retryInfo}
      abortFeedback={abortFeedback}
      agentAuditState={agentAuditState}
      agentAuditBusy={agentAuditBusy}
      agentRegistryById={agentRegistryById}
      agentReviewProgressByAgentId={agentReviewProgressByAgentId}
      agentSourcesByAgentId={agentSourcesByAgentId}
      agentAuditActiveTabByMessageId={agentAuditActiveTabByMessageId}
      setAgentAuditActiveTabByMessageId={setAgentAuditActiveTabByMessageId}
      deepThinkingHint={deepThinkingHint}
      dtHintDismissed={dtHintDismissed}
      dtPendingConfirm={dtPendingConfirm}
      setDtPendingConfirm={setDtPendingConfirm}
      dtConfirmBusy={dtConfirmBusy}
      dtSavingDecision={dtSavingDecision}
      dtDecisionSaved={dtDecisionSaved}
      interimInsight={interimInsight}
      aiConfig={aiConfig}
      editingMessageId={editingMessageId}
      editingText={editingText}
      editBusy={editBusy}
      setEditingText={setEditingText}
      hoveredMessageId={hoveredMessageId}
      setHoveredMessageId={setHoveredMessageId}
      copiedMessageId={copiedMessageId}
      contextSaveBusyMessageId={contextSaveBusyMessageId}
      contextSavedMessageIds={contextSavedMessageIds}
      selectedMultiOptions={selectedMultiOptions}
      voiceState={voiceState}
      handleCopyMessage={handleCopyMessage}
      handleStartEditMessage={handleStartEditMessage}
      handleCancelEditMessage={handleCancelEditMessage}
      handleCommitEditMessage={handleCommitEditMessage}
      handleViewArtifacts={handleViewArtifacts}
      handleFeedback={handleFeedback}
      handleSendMessage={handleSendMessage}
      handleEnableDeepThinking={handleEnableDeepThinking}
      handleDeepThinkingProceed={handleDeepThinkingProceed}
      handleDeepThinkingReconfirm={handleDeepThinkingReconfirm}
      handleSaveAsDecision={handleSaveAsDecision}
      handleSaveAsIdea={handleSaveAsIdea}
      handleSaveAsNote={handleSaveAsNote}
      handleSaveToContext={handleSaveToContext}
      handleRunDirectedDeepening={handleRunDirectedDeepening}
      handleMultiSelectToggle={handleMultiSelectToggle}
      handleMultiSelectConfirm={handleMultiSelectConfirm}
      refreshAgentAuditSuggestionsOnly={refreshAgentAuditSuggestionsOnly}
      speak={speak}
      stopSpeaking={stopSpeaking}
      setDtHintDismissed={setDtHintDismissed}
      addArtifact={addArtifact}
      toggleArtifactsPanel={toggleArtifactsPanel}
      exportArtifact={exportArtifact}
      handleAgentAuditAccept={handleAgentAuditAccept}
      onOptionSelect={onOptionSelect}
      isRtlChatLanguage={isRtlChatLanguage}
      onProposalApprove={handleProposalApprove}
      onProposalReject={handleProposalReject}
      proposalBusyById={proposalBusyById}
    />
  );

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div
      className={`flex flex-col h-full bg-slate-50 dark:bg-navy-950 ${
        isPrivateMode
          ? 'ring-1 ring-violet-200/70 dark:ring-violet-800/45'
          : 'ring-1 ring-transparent'
      } ${className}`}
      style={{ maxHeight: maxHeight || '100%' }}
    >
      {/* Skip links for keyboard users */}
      <a
        href="#chat-input"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-primary-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        {t('wcag.skipToInput', 'Skip to chat input')}
      </a>

      {/* Header — Tech Sexy (T104/T105) */}
      <div
        className={`flex items-center justify-between ${isCompact ? 'px-3 py-1.5' : 'px-4 py-2'} border-b border-slate-200/60 dark:border-white/[0.06] bg-white/50 dark:bg-navy-950/60 backdrop-blur-sm`}
      >
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleNewChat}
            data-testid="chat-new-button"
            className="p-1.5 rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-slate-200"
            title={t('aiChat.newChat', 'New chat')}
            aria-label={t('aiChat.newChat', 'New chat')}
          >
            <Plus size={18} strokeWidth={1.75} />
          </button>

          {showHistoryTrigger && (
            <button
              onClick={() => toggleSidebar()}
              data-testid="chat-history-button"
              data-chat-toggle
              className={`p-1.5 rounded-lg transition-colors ${
                isSidebarOpen
                  ? 'text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title={t('aiChat.history', 'History')}
              aria-label={t('aiChat.history', 'Chat history')}
            >
              <History size={18} strokeWidth={1.75} />
            </button>
          )}

          {/* Show the business/actions button only when a real navigation target exists. */}
          {onNavigateToActions && (
            <button
              onClick={() => {
                trackFunnelEvent('chat_business_button_clicked', {
                  mode: isSplitMode ? 'split' : 'full',
                  pendingCount: pendingActionsCount,
                });
                onNavigateToActions();
              }}
              data-testid="chat-business-button"
              className="relative p-1.5 rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-slate-200"
              title={t('aiChat.business', 'Business actions')}
              aria-label={t('aiChat.business', 'Business actions')}
            >
              <Briefcase size={18} strokeWidth={1.75} />
              {pendingActionsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-500 text-[10px] font-medium text-white px-1 leading-none">
                  {pendingActionsCount > 9 ? '9+' : pendingActionsCount}
                </span>
              )}
            </button>
          )}

          {/* T012: Important signals (chat-active) */}
          {signalsEnabled && (
            <button
              onClick={() => setSignalsOpen(true)}
              data-testid="chat-signals-button"
              className="p-1.5 rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-slate-200"
              title={t('aiChat.signals.title', 'Important signals')}
              aria-label={t('aiChat.signals.title', 'Important signals')}
            >
              <Sparkles size={18} strokeWidth={1.75} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <V8ArtifactRunControl
            conversationId={activeConversationId}
            defaultGoal={latestUserGoalHint}
            snapshotContext={v8SnapshotContext}
          />
          <V8ContextIndicator
            conversationId={activeConversationId}
            defaultGoal={latestUserGoalHint}
          />
          {/* TRUST T-PM1 — `PrivateModeDetails` replaces the legacy static
              chip. When the feature flag is on, the badge becomes a button
              that opens a short popover explaining what private mode
              does and does NOT do (RODO honesty). When the flag is off
              the component renders the original read-only chip with the
              same classes, so disabling the flag is visually invisible. */}
          {isPrivateMode && <PrivateModeDetails />}
          {ttsSupported && (
            <button
              onClick={() => {
                // VM4 — snapshot `isSpeaking` BEFORE `stopSpeaking()` flips
                // it to false so the barge-in toast only fires when the
                // click actually interrupted an ongoing read. Debounce
                // (1.5 s) is enforced inside `notifyBargeIn`, so repeated
                // mute gestures produce at most one visible toast.
                const wasBargeIn = voiceState.isSpeaking;
                if (wasBargeIn) {
                  stopSpeaking();
                  notifyBargeIn({
                    message: t('voice.bargeInToast', 'Reading interrupted.'),
                    source: 'mute_button',
                  });
                }
                const nextState = wasBargeIn ? false : !autoReadEnabled;
                setAutoReadEnabled(nextState);
                updateVoiceSettings({ autoSpeakResponses: nextState });
                setAIConfig({ textToSpeech: nextState } as any);
              }}
              data-testid="chat-autoread-button"
              className={`p-1.5 rounded-lg transition-colors ${
                autoReadEnabled
                  ? 'text-primary-600 dark:text-primary-400 bg-primary-50/40 dark:bg-primary-900/15'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title={
                voiceState.isSpeaking
                  ? t('aiChat.muteNow', 'Mute now')
                  : autoReadEnabled
                    ? t('aiChat.autoReadOff', 'Turn off auto-read')
                    : t('aiChat.autoReadOn', 'Turn on auto-read')
              }
              aria-label={
                voiceState.isSpeaking
                  ? t('aiChat.muteNow', 'Mute now')
                  : autoReadEnabled
                    ? t('aiChat.autoReadOff', 'Turn off auto-read')
                    : t('aiChat.autoReadOn', 'Turn on auto-read')
              }
            >
              {autoReadEnabled ? (
                <Volume2 size={18} strokeWidth={1.75} />
              ) : (
                <VolumeX size={18} strokeWidth={1.75} />
              )}
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
          onActionDecided={() => {}}
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

      {/* Organization Memory panel removed — unused / WIP feature */}

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
              {t('aiChat.teresaWelcome', 'Talk to Teresa')}
            </h3>
            <p
              className={`${isCompact ? 'text-xs' : 'text-sm'} text-slate-500 dark:text-slate-400 max-w-xs`}
            >
              {t(
                'aiChat.teresaWelcomeSubtitle',
                'Work through decisions, notes, and next steps with your internal AI partner'
              )}
            </p>
          </div>
        ) : (
          <>
            {/* Conversation state banners (§2.3.5 — deep-link + degraded posture) */}
            {_activeConversationState === 'archived' && (
              <div className="mx-2 mb-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40 flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  {t('aiChat.archivedBanner', 'This conversation is archived. Unarchive it to continue chatting.')}
                </span>
              </div>
            )}
            {_activeConversationState === 'deleted' && (
              <div className="mx-2 mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-700/40 flex items-center gap-2">
                <svg className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                <span className="text-xs text-red-700 dark:text-red-400">
                  {_activeConversationStateMessage || t('aiChat.deletedBanner', 'This conversation has been deleted.')}
                </span>
              </div>
            )}
            {_activeConversationState === 'permission_denied' && (
              <div className="mx-2 mb-3 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  {_activeConversationStateMessage || t('aiChat.permissionDenied', 'You do not have access to this conversation. Contact the folder owner for access.')}
                </span>
              </div>
            )}
            {_activeConversationState === 'not_found' && (
              <div className="mx-2 mb-3 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {t('aiChat.notFound', 'This conversation does not exist or has been permanently removed.')}
                </span>
              </div>
            )}
            {displayMessages.map((msg, index) => renderMessage(msg, index))}
          </>
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
        className={`${isCompact ? 'p-2' : 'p-3'} border-t border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950`}
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
                className="px-3 py-1 rounded-md text-xs font-medium bg-slate-50 dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/15 text-amber-800 dark:text-amber-200"
              >
                {t('common.dismiss', 'Dismiss')}
              </button>
            </div>
          </div>
        )}
        {quickPrompts && quickPrompts.length > 0 && messages.length === 0 && !isStreaming && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSendMessage(prompt)}
                className="px-2.5 py-1 text-[11px] font-medium rounded-full border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-700 hover:text-purple-700 dark:hover:text-purple-300 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        <EnhancedChatInput
          onSend={handleSendMessage}
          onStopGenerating={() => {
            const hadPartial = abortStream();
            setAbortFeedback(hadPartial ? 'partial' : 'cancelled');
            setTimeout(() => setAbortFeedback(null), 3000);
          }}
          onTeresaVoiceToggle={teresaVoice.handleVoiceToggle}
          teresaVoiceStatus={teresaVoice.voiceStatus}
          teresaVoiceMuted={teresaVoice.isMuted}
          onTeresaVoiceMuteToggle={teresaVoice.toggleMute}
          isStreaming={isStreaming}
          disabled={isDisabled}
          placeholder={
            workspaceContext && workspaceContext.type !== 'empty' && workspaceContext.entityName
              ? t('aiChat.teresaContextPlaceholder', {
                  defaultValue: 'How can Teresa help with {{context}}?',
                  context: workspaceContext.entityName,
                })
              : t('aiChat.teresaPlaceholder', 'Ask Teresa about your work...')
          }
          voiceModeEnabled={voiceModeEnabled}
          onVoiceModeChange={setVoiceModeEnabled}
          chatLanguage={chatLanguage}
          voiceState={voiceState}
          startVoiceListening={startListening}
          stopVoiceListening={stopListening}
        />
        {chatSuggestions.length > 0 && (
          <ChatSmartSuggestions
            suggestions={chatSuggestions}
            onSuggestionClick={handleSuggestionClick}
            className="pt-2"
          />
        )}
      </div>

      {/* Sliding History Panel */}
      <ChatSlidingPanel
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        activeConversationId={activeConversationId}
      />

      {/* Important signals panel (T012) */}
      {signalsEnabled && (
        <ChatSignalsPanel
          open={signalsOpen}
          onClose={() => setSignalsOpen(false)}
          projectId={workspaceContext?.projectId || null}
        />
      )}


      {/* AI Table Builder slide-over panel */}
      {tableBuilderOpen && (
        <ChatToSchemaPanel
          workspaceId={
            (workspaceContext?.entityData?.tableContext as { baseId?: string } | undefined)
              ?.baseId ||
            workspaceContext?.entityId ||
            ''
          }
          initialMessage={tableBuilderInitialMsg}
          slideOver
          companyContext={{
            workspaceName: workspaceContext?.entityName || workspaceContext?.projectName,
            moduleName: workspaceContext?.type || undefined,
          }}
          onExecuted={() => {
            const uiLang = (i18n.language || 'en').split('-')[0];
            addChatMessage({
              id: `table-created-${Date.now()}`,
              role: 'ai',
              content:
                uiLang === 'pl'
                  ? 'Tabela została utworzona pomyślnie! Możesz ją teraz znaleźć w zakładce My Work.'
                  : 'Table created successfully! You can find it in the My Work tab.',
              timestamp: new Date(),
            });
            setTableBuilderOpen(false);
            setTableBuilderInitialMsg(undefined);
          }}
          onClose={() => {
            setTableBuilderOpen(false);
            setTableBuilderInitialMsg(undefined);
          }}
        />
      )}
    </div>
  );
};

export default UnifiedChatPanel;
