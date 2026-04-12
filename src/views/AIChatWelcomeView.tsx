/**
 * AIChatWelcomeView - Complete AI Chat Experience
 *
 * Features:
 * - Collapsible conversation history sidebar
 * - Time-aware personalized greetings
 * - Enhanced input with file upload and AI tools
 * - Smart suggestions based on PMO context
 * - Citations and action buttons in responses
 * - Harvard-Level Co-Thinker AI System integration
 * - Continuous voice conversation mode
 * - Action execution capabilities
 */

import {
  Calculator,
  CheckCircle2,
  Lock,
  RefreshCw,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useAIContext } from '@/contexts/AIContext';
import { isValidLanguage, LANGUAGE_NAMES, type SupportedLanguage } from '@/i18n';
import { Api } from '@/services/api.ts';
import { AppView } from '@/types';

import { ChatExportModal } from '../components/AIChat/ChatExportModal';
// Components
import { ChatSlidingPanel } from '../components/AIChat/ChatSlidingPanel';
import { CitationList } from '../components/AIChat/CitationList';
import { EnhancedChatInput } from '../components/AIChat/EnhancedChatInput';
import { OutputToolSelector } from '../components/AIChat/OutputToolSelector';
import { MessageActions } from '../components/AIChat/Messages/MessageActions';
import { ThinkingBlock } from '../components/AIChat/Messages/ThinkingBlock';
import { ResearchProgress } from '../components/AIChat/ResearchProgress';
import { ResponseActions } from '../components/AIChat/ResponseActions';
import { SmartSuggestions } from '../components/AIChat/SmartSuggestions';
import { TeresaProposalCard } from '../components/AIChat/TeresaProposalCard';
import {
  getTeresaEmptyResponseMessage,
  getTeresaStartFailureMessage,
} from '../components/AIChat/teresaRuntimeCopy';
import { ThinkingStatusLine } from '../components/AIChat/ThinkingStatusLine';
import { TTSIndicator } from '../components/AIChat/TTSIndicator';
import { V8ArtifactRunControl } from '../components/AIChat/V8ArtifactRunControl';
import { V8ContextIndicator } from '../components/AIChat/V8ContextIndicator';
import { ACTION_TYPES, ActionPayload, useActionHandler } from '../hooks/useActionHandler';
import { useTeresaVoiceContext } from '../contexts/TeresaVoiceContext';
import { useAIStream } from '../hooks/useAIStream';
import { useUniversalVoice } from '../hooks/useUniversalVoice';
import { useAppStore } from '../store/useAppStore';
import { useConversationStore } from '../store/useConversationStore';
import { usePMOStore } from '../store/usePMOStore';
import { ChatCitation, ChatMessage, ChatResponseAction, TeresaChatProposal } from '../types';
import { MessageFeedback } from '../types';
import { buildPersistedAiResponseMetadata } from '../utils/chatPersistence';
import { exportConversationToPDF } from '../utils/pdfExport';
import { cleanTextForSpeech } from '../utils/textCleaning';
import { isRtlLanguage, textDirection } from '../utils/textDirection';

// Time-aware greeting helper
const getTimeContext = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return {
      greetingKey: 'morning',
      greetingFallback: 'Good morning',
      subtitleKey: 'subtitle.morning',
      subtitleFallback: 'Ready to drive your transformation forward?',
    };
  } else if (hour >= 12 && hour < 18) {
    return {
      greetingKey: 'afternoon',
      greetingFallback: 'Good afternoon',
      subtitleKey: 'subtitle.afternoon',
      subtitleFallback: "Let's make progress on your initiatives",
    };
  } else {
    return {
      greetingKey: 'evening',
      greetingFallback: 'Good evening',
      subtitleKey: 'subtitle.evening',
      subtitleFallback: 'Review your transformation journey',
    };
  }
};

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? true;
};

const isUuidLike = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());

const TERESA_TARGET_ROUTE_MAP: Record<string, string> = {
  initiatives: '/initiatives',
  notebook: '/my-work?tab=notebook',
  calendar: '/meeting',
  radar: '/my-work',
  interview: '/interview',
};

/** Download a string as a file */
function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const AIChatWelcomeView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // App state
  const {
    currentUser,
    currentProjectId,
    aiConfig,
    currentOrganization,
    setCurrentView,
    isChatCollapsed,
    toggleChatCollapse,
    setAIConfig,
    setChatKickoffMessage,
    chatKickoffMessage,
    clearChatKickoffMessage,
  } = useAppStore();
  const { projectName } = usePMOStore();

  // Derived state for compatibility
  const selectedProject = useMemo(
    () => (currentProjectId ? { id: currentProjectId, name: projectName } : null),
    [currentProjectId, projectName]
  );

  // Conversation store
  const conversationStore = useConversationStore() as any;
  const {
    activeConversationId,
    activeMessages,
    isLoading: isConversationLoading,
    isSidebarOpen,
    workspaceContext,
    createConversation,
    addMessage,
    setActiveConversation,
    clearActiveChat,
    truncateFromMessage,
    generateTitle,
    draftChatLanguage,
    chatLanguageByConversationId,
    setConversationChatLanguage,
  } = conversationStore;

  const activeConversationIdRef = useRef(activeConversationId);
  const activeMessagesRef = useRef(activeMessages);

  // Deep Thinking confirm state
  const [dtConfirmBusy, setDtConfirmBusy] = useState(false);
  const [dtPendingConfirm, setDtPendingConfirm] = useState<{
    messageId: string;
    conversationId: string | null;
    originalMessage: string;
    editedMessage: string;
    confirm: any;
    context: any;
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
    // 3. Fall back to current UI language (i18n), then 'en'
    const uiLang = i18n.language?.split('-')[0] || 'en';
    const candidate = explicitPref || activeLang || draftChatLanguage || uiLang;
    const base = String(candidate).split('-')[0];
    return (isValidLanguage(base) ? (base as SupportedLanguage) : 'en') as SupportedLanguage;
  }, [activeConversationId, chatLanguageByConversationId, draftChatLanguage, i18n.language]);
  const isRtlChatLanguage = isRtlLanguage(chatLanguage);

  // AI stream with persistence callback
  const handleStreamDone = useCallback(
    async (
      fullText: string,
      thinking: any[] = [],
      artifacts: any[] = [],
      meta?: { citations?: any[]; sessionId?: string; proposal?: TeresaChatProposal | null }
    ) => {
      const safeText =
        typeof fullText === 'string' && fullText.trim().length > 0
          ? fullText
          : getTeresaEmptyResponseMessage(i18n.language);

      // Use ref to get the latest conversation ID (avoids stale closure)
      const convId = activeConversationIdRef.current;
      if (!convId) {
        console.warn('[Chat] handleStreamDone: no active conversation ID');
        return;
      }

      // Persist AI response to conversation store (backend)
      try {
        await addMessage({
          conversationId: convId,
          role: 'ai',
          content: safeText,
          messageType: 'text',
          metadata: buildPersistedAiResponseMetadata({
            thinking: thinking as any,
            artifacts: artifacts as any,
            citations: meta?.citations,
            streamSessionId: meta?.sessionId,
            extra: meta?.proposal ? { proposal: meta.proposal } : {},
          }) as any,
        });

        // Title generation is handled by useConversationStore.addMessage()
        // after the first user+AI exchange (2 messages). No duplicate trigger needed here.
      } catch (err) {
        console.error('[Chat] Failed to persist AI response:', err);
      }
    },
    [addMessage, generateTitle]
  );

  const {
    isStreaming,
    streamedContent,
    startStream,
    thinkingSteps,
    abortStream,
    retryLastStream,
    lastError,
    clearLastError,
    researchProgress,
    streamStartedAt,
    streamCompletedSignal,
    retryInfo,
  } = useAIStream({
    onStreamDone: handleStreamDone,
    onStreamError: (err) => {
      console.error('[Chat] Stream error:', err);
      if ((err as any)?.code === 'DEEP_THINKING_CONFIRM_REQUIRED') {
        // Flow-control error: do not persist as a chat message.
        return;
      }
      // Persist a visible error message to the conversation (so UI stays consistent with backend)
      const convId = activeConversationIdRef.current;
      if (!convId) return;
      void addMessage({
        conversationId: convId,
        role: 'ai',
        content: getTeresaStartFailureMessage(i18n.language),
        messageType: 'text',
        metadata: { error: (err as Error)?.message || String(err) },
      } as any);
    },
  });

  // Keep conversation ID ref fresh (avoids stale closures in handleStreamDone)
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    activeMessagesRef.current = activeMessages;
  }, [activeMessages]);

  // UI messages: derive from conversation store + transient UI-only messages
  const activeChatMessages: ChatMessage[] = useMemo(() => {
    const persisted: ChatMessage[] = (activeMessages || []).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: String(m.content || ''),
      timestamp: m.createdAt || new Date(),
      type: m.messageType || 'text',
      thinkingSteps: m.metadata?.thinkingSteps,
      metadata: m.metadata,
      citations: m.metadata?.citations,
      actions: m.metadata?.actions,
      options: m.metadata?.options,
      multiSelect: m.metadata?.multiSelect,
      artifacts: m.metadata?.artifacts,
      toolCalls: m.metadata?.toolCalls,
      authorUserId: m.authorUserId,
      authorName: m.authorName,
    }));

    const out: ChatMessage[] = [...persisted];

    if (isStreaming) {
      out.push({
        id: 'streaming',
        role: 'ai',
        content: String(streamedContent || ''),
        timestamp: new Date(),
        isStreaming: true,
        isThinking: true,
        thinkingSteps: thinkingSteps as any,
        metadata: { transient: true },
      } as any);
    }

    return out;
  }, [activeMessages, dtPendingConfirm, isStreaming, streamedContent, thinkingSteps]);

  const activeChatMessagesRef = useRef<ChatMessage[]>(activeChatMessages);
  useEffect(() => {
    activeChatMessagesRef.current = activeChatMessages;
  }, [activeChatMessages]);

  const latestUserGoalHint = useMemo(() => {
    const latestUserMessage = [...activeChatMessages]
      .reverse()
      .find(
        (message) => message.role === 'user' && String(message.content || '').trim().length > 0
      );
    return String(latestUserMessage?.content || '').trim();
  }, [activeChatMessages]);

  const v8SnapshotContext = useMemo(() => {
    const workspaceId = isUuidLike(workspaceContext?.entityId)
      ? workspaceContext.entityId
      : isUuidLike(workspaceContext?.projectId)
        ? workspaceContext.projectId
        : isUuidLike(selectedProject?.id)
          ? selectedProject.id
          : null;

    const projectId = isUuidLike(workspaceContext?.projectId)
      ? workspaceContext.projectId
      : isUuidLike(selectedProject?.id)
        ? selectedProject.id
        : null;

    const resolvedRoleRef =
      typeof currentUser?.role === 'string' && currentUser.role.trim().length > 0
        ? currentUser.role.trim().toLowerCase()
        : 'member';

    return {
      workspaceId,
      projectId,
      effectiveScopeRef: 'workspace',
      resolvedRoleRef,
      privacyMode: Boolean((aiConfig as any)?.privateMode),
    };
  }, [
    aiConfig,
    currentUser?.role,
    selectedProject?.id,
    workspaceContext?.entityId,
    workspaceContext?.projectId,
  ]);

  // AI context
  const { pmoContext, globalContext, screenContext } = useAIContext();

  // Universal Voice System
  const {
    state: voiceState,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    isSupported: voiceSupported,
    endConversation: stopContinuousMode,
  } = useUniversalVoice({
    onSendMessage: (msg) => handleSend(msg),
    settings: {
      autoSpeakResponses: true,
      sttProvider: 'whisper',
      ttsProvider: 'web',
      language: chatLanguage,
    },
  });

  // Action handler for AI-initiated actions
  const {
    executeAction,
    confirmAction,
    pendingActions,
    isExecuting: isActionExecuting,
  } = useActionHandler();

  // Local state
  const [citationsCollapsed, setCitationsCollapsed] = useState(false);
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
  const [continuousVoiceMode, setContinuousVoiceMode] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [orgLogoLoaded, setOrgLogoLoaded] = useState(false);
  const [aiMemoryContext, setAiMemoryContext] = useState<string | null>(null);
  const [coThinkerPhase, setCoThinkerPhase] = useState<string>('discovery');
  const [messageFeedback, setMessageFeedback] = useState<Record<string, MessageFeedback>>({});
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [editBusy, setEditBusy] = useState(false);
  // Teresa real-time voice — global context (persists across navigation)
  const teresaVoice = useTeresaVoiceContext();

  const lastSpokenContentRef = useRef<string>('');
  const autoReadEnabled = Boolean(aiConfig?.textToSpeech);
  const isPrivateMode = Boolean((aiConfig as any)?.privateMode);

  // Get time-aware context
  const timeContext = useMemo(() => getTimeContext(), []);
  const firstName = currentUser?.firstName || '';
  const orgId = currentOrganization?.id || currentUser?.organizationId || null;

  const subtitleVariants: string[] = useMemo(() => {
    const raw = t(`aiChat.subtitleRotator.${timeContext.greetingKey}`, {
      returnObjects: true,
      defaultValue: [],
    }) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => String(x || '').trim()).filter(Boolean);
  }, [t, i18n.language, timeContext.greetingKey]);

  const [subtitleIndex, setSubtitleIndex] = useState(0);
  const [subtitleFading, setSubtitleFading] = useState(false);

  // Reset subtitle when language / time bucket changes
  useEffect(() => {
    setSubtitleIndex(0);
    setSubtitleFading(false);
  }, [i18n.language, timeContext.greetingKey, subtitleVariants.length]);

  // Rotate subtitle variants (welcome header)
  useEffect(() => {
    if (subtitleVariants.length < 2) return;

    const reduce = prefersReducedMotion();
    let fadeTimeout: number | undefined;

    const interval = window.setInterval(() => {
      if (reduce) {
        setSubtitleIndex((i) => (i + 1) % subtitleVariants.length);
        return;
      }

      setSubtitleFading(true);
      fadeTimeout = window.setTimeout(() => {
        setSubtitleIndex((i) => (i + 1) % subtitleVariants.length);
        setSubtitleFading(false);
      }, 200);
    }, 6500);

    return () => {
      window.clearInterval(interval);
      if (fadeTimeout) window.clearTimeout(fadeTimeout);
    };
  }, [subtitleVariants]);

  const subtitleText =
    subtitleVariants.length > 0
      ? subtitleVariants[subtitleIndex]!
      : t(`aiChat.${timeContext.subtitleKey}`, timeContext.subtitleFallback);

  // Fetch org logo for white-label branding (set in Admin → Organization Profile)
  useEffect(() => {
    let cancelled = false;

    const fetchOrgLogo = async () => {
      if (!orgId) {
        setOrgLogoUrl(null);
        return;
      }

      try {
        const resp = await Api.get(`/organization-profiles/${orgId}`);
        const url = resp?.profile?.logoUrl ? String(resp.profile.logoUrl || '') : '';
        if (!cancelled) {
          setOrgLogoUrl(url || null);
          setOrgLogoLoaded(false);
        }
      } catch (err) {
        // Non-blocking: branding is optional.
        if (!cancelled) setOrgLogoUrl(null);
      }
    };

    fetchOrgLogo();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  // Fetch AI memory context on mount
  useEffect(() => {
    const fetchMemoryContext = async () => {
      try {
        const response = await fetch('/api/ai-memory/context', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.context) {
            setAiMemoryContext(data.context);
          }
        }
      } catch (err) {
        console.error('[AIMemory] Failed to fetch context:', err);
      }
    };
    fetchMemoryContext();
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, streamedContent]);

  // =========================================================================
  // Auto-speak AI responses (voice mode OR textToSpeech from ToolsMenu)
  // =========================================================================
  const ttsEnabled = voiceModeEnabled || (aiConfig?.textToSpeech ?? false);
  const spokenCharsRef = useRef(0); // how many chars of streaming content we already spoke

  // Reset spoken tracker when a new stream starts
  useEffect(() => {
    if (isStreaming) {
      spokenCharsRef.current = 0;
    }
  }, [isStreaming]);

  // Incremental TTS: speak sentence-by-sentence WHILE streaming
  useEffect(() => {
    if (!ttsEnabled || !voiceSupported || !isStreaming || !streamedContent) return;

    const text = cleanTextForSpeech(streamedContent);
    if (!text || text.length <= spokenCharsRef.current) return;

    // Find complete sentences in the new (unspoken) portion
    const unspoken = text.slice(spokenCharsRef.current);
    // Match sentences ending with . ! ? or newlines (but not abbreviations like "np." "dr.")
    const sentenceEnd = /(?<=[.!?])\s+|(?<=\n)\s*/g;
    const parts = unspoken.split(sentenceEnd).filter(Boolean);

    if (parts.length > 1) {
      // We have at least one complete sentence — speak all but the last (incomplete) part
      const toSpeak = parts.slice(0, -1).join(' ').trim();
      if (toSpeak) {
        console.log('[TTS] Speaking sentence:', toSpeak.slice(0, 60) + '…');
        speak(toSpeak).catch((err) => console.warn('[TTS] speak error:', err));
        spokenCharsRef.current += unspoken.length - parts[parts.length - 1].length;
      }
    }
  }, [ttsEnabled, voiceSupported, isStreaming, streamedContent, speak]);

  // Speak remaining text when streaming finishes
  useEffect(() => {
    if (!ttsEnabled || !voiceSupported || isStreaming) return;

    const lastMessage = activeChatMessages[activeChatMessages.length - 1];
    if (lastMessage?.role === 'ai' && lastMessage.content) {
      const contentToSpeak = cleanTextForSpeech(lastMessage.content);

      if (contentToSpeak && contentToSpeak !== lastSpokenContentRef.current) {
        lastSpokenContentRef.current = contentToSpeak;

        // Speak only the remaining portion (what wasn't spoken during streaming)
        const remaining = contentToSpeak.slice(spokenCharsRef.current).trim();
        if (remaining) {
          console.log('[TTS] Speaking remaining:', remaining.slice(0, 60) + '…');
          speak(remaining).catch((err) => console.warn('[TTS] speak error:', err));
        }
        spokenCharsRef.current = 0;
      }
    }
  }, [activeChatMessages, ttsEnabled, voiceSupported, isStreaming, speak]);

  // Handle voice mode change
  const handleVoiceModeChange = useCallback(
    (enabled: boolean) => {
      setVoiceModeEnabled(enabled);
      if (!enabled) {
        stopSpeaking();
        if (continuousVoiceMode) {
          stopContinuousMode();
          setContinuousVoiceMode(false);
        }
      }
    },
    [stopSpeaking, continuousVoiceMode, stopContinuousMode]
  );

  // Always replay from start: stop current audio and read again.
  const replaySpeech = useCallback(
    (rawText: string) => {
      const text = cleanTextForSpeech(rawText || '');
      if (!text) return;
      stopSpeaking();
      window.setTimeout(() => {
        speak(text).catch((err) => console.warn('[TTS] replay error:', err));
      }, 60);
    },
    [speak, stopSpeaking]
  );

  // Handle continuous voice mode toggle
  const handleContinuousVoiceToggle = useCallback(() => {
    if (continuousVoiceMode) {
      stopListening();
      setContinuousVoiceMode(false);
    } else {
      startListening();
      setContinuousVoiceMode(true);
      setVoiceModeEnabled(true);
    }
  }, [continuousVoiceMode, startListening, stopListening]);

  // Handle AI action execution
  const handleAIAction = useCallback(
    async (action: any) => {
      const actionPayload: ActionPayload = {
        type: action.type || ACTION_TYPES.NAVIGATE,
        payload: action.payload || action,
        requiresConfirmation: action.requiresConfirmation || false,
      };

      const result = await executeAction(actionPayload);

      if (result.status === 'success' && result.result?.message) {
        const convId = activeConversationIdRef.current;
        if (convId) {
          void addMessage({
            conversationId: convId,
            role: 'ai',
            content: `✅ ${result.result.message}`,
            messageType: 'text',
          });
        }
      }

      return result;
    },
    [executeAction, addMessage]
  );

  // Handle pending action confirmation
  const handleConfirmPendingAction = useCallback(
    async (actionId: string, confirmed: boolean) => {
      const result = await confirmAction(actionId, confirmed);

      if (result.status === 'success') {
        const convId = activeConversationIdRef.current;
        if (convId) {
          void addMessage({
            conversationId: convId,
            role: 'ai',
            content: confirmed ? '✅ Akcja wykonana pomyślnie.' : '❌ Akcja anulowana.',
            messageType: 'text',
          });
        }
      }
    },
    [confirmAction, addMessage]
  );

  const handleTeresaProposalUpdated = useCallback(
    async (proposal: TeresaChatProposal) => {
      const convId = activeConversationIdRef.current;
      if (!convId) return;

      const stateMessages: Record<TeresaChatProposal['state'], string> = {
        proposal: `Teresa prepared a proposal for ${proposal.targetLabel}.`,
        pending_approval: `Teresa proposal for ${proposal.targetLabel} is waiting for approval.`,
        approved: `Teresa proposal for ${proposal.targetLabel} is approved and ready to execute.`,
        executing: `Teresa is executing the handoff to ${proposal.targetLabel}.`,
        completed: `Teresa completed the handoff to ${proposal.targetLabel}.`,
        rejected: `Teresa proposal for ${proposal.targetLabel} was rejected.`,
      };

      await addMessage({
        conversationId: convId,
        role: 'ai',
        content:
          stateMessages[proposal.state] ||
          `Teresa updated the proposal for ${proposal.targetLabel}.`,
        messageType: 'text',
        metadata: { proposal } as any,
      });
    },
    [addMessage]
  );

  const handleTeresaProposalNavigate = useCallback(
    async (proposal: TeresaChatProposal) => {
      const targetRoute =
        TERESA_TARGET_ROUTE_MAP[String(proposal.targetModule || '').toLowerCase()];
      await executeAction({
        type: ACTION_TYPES.NAVIGATE,
        payload: {
          view: targetRoute || '/chat',
          targetModule: proposal.targetModule,
        },
      });
    },
    [executeAction]
  );

  const handleTeresaLifecycleMessage = useCallback(
    async (message: string) => {
      const convId = activeConversationIdRef.current;
      if (!convId || !message.trim()) return;
      await addMessage({
        conversationId: convId,
        role: 'ai',
        content: message,
        messageType: 'text',
      });
    },
    [addMessage]
  );

  // Build system prompt for AI
  const buildSystemPrompt = useCallback(
    (extraContext?: string) => {
      let systemPrompt = `You are Teresa, the in-product copilot for Consultify.

ROLE:
- Talk naturally, clearly, and with strong product awareness.
- Help ${currentUser?.firstName || 'the user'} move work forward inside the application.
- Use the current workspace and screen context before asking the user to repeat themselves.

PROPOSAL-FIRST RULES:
- Never imply that a write already happened unless the system confirms it.
- When work in the application is appropriate, frame it as a proposal for user approval.
- Keep proposals safe, bounded, and specific to the current context.
- Prefer: navigate, prepare a draft, prepare a handoff, suggest the next safe step.
- Avoid silent writes and avoid claiming execution before approval.

WORK STYLE:
- Be conversational, direct, and helpful.
- Use concise structure when useful, but do not sound robotic.
- Ask short clarification questions only when missing information blocks a safe proposal.
- ALWAYS respond in ${LANGUAGE_NAMES[chatLanguage] || 'English'}, regardless of the language the user writes in. This is their chosen application language.

CURRENT TRANSFORMATION PHASE: ${coThinkerPhase.toUpperCase()}
${coThinkerPhase === 'discovery' ? '→ Focus: understanding goals, constraints, and stakeholders.' : ''}
${coThinkerPhase === 'assessment' ? '→ Focus: evaluating digital maturity and evidence.' : ''}
${coThinkerPhase === 'initiatives' ? '→ Focus: shaping and prioritizing initiatives.' : ''}
${coThinkerPhase === 'roadmap' ? '→ Focus: sequencing work, dependencies, and ownership.' : ''}
${coThinkerPhase === 'execution' ? '→ Focus: tracking progress, blockers, and next actions.' : ''}

CONTEXT:
- User: ${currentUser?.firstName || 'User'} (${currentUser?.role || 'Stakeholder'})
- Organization: ${currentUser?.organizationName || 'Unknown'}
- Project: ${selectedProject?.name || 'General'}

OUTPUT EXPECTATION:
- Give a natural assistant response first.
- If there is a strong next action, make the response compatible with a proposal-first UI.
- When the user asks about the partner program, explain the public path clearly: discover the program, review the case study, start the shared partner application flow, complete onboarding, then activate partner operations and payouts.
- You can explain partner academy, certification readiness, partner resources, case packs, certification tracks (sales, delivery, strategic), levels (foundation, practitioner, advanced), review states, and when the user should switch from self-serve application to direct contact for custom commercial terms.
`;

      // Append AI memory context if available
      if (aiMemoryContext) {
        systemPrompt += `\n${aiMemoryContext}\n`;
      }

      if (extraContext) {
        systemPrompt += `\n${extraContext}\n`;
      }

      systemPrompt += `
Focus on practical movement inside the app: decisions, drafts, navigation, next steps, and safe handoffs.

MEMORY INSTRUCTIONS:
If the user explicitly asks you to remember something, include a line in your response:
REMEMBER: [key]: [value]
For example: REMEMBER: preferred_language: Polish`;

      return systemPrompt;
    },
    [currentUser, coThinkerPhase, chatLanguage, selectedProject, aiMemoryContext]
  );

  // Handle Deep Thinking proceed (after user confirms)
  const handleDeepThinkingProceed = useCallback(async () => {
    if (!dtPendingConfirm) return;
    if (isStreaming) return;

    const history = activeChatMessagesRef.current
      .filter((m) => !((m as any).metadata?.deepThinking?.kind === 'confirm'))
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

    const systemPrompt = buildSystemPrompt();

    // Start stream with Deep Thinking context confirmed
    startStream(
      dtPendingConfirm.editedMessage || dtPendingConfirm.originalMessage,
      history,
      systemPrompt,
      {
        ...(dtPendingConfirm.context || {}),
        deepThinkingConfirmed: true,
        deepThinkingConfirm: dtPendingConfirm.confirm,
      },
      undefined,
      undefined,
      chatLanguage
    );

    setDtPendingConfirm(null);
  }, [dtPendingConfirm, isStreaming, buildSystemPrompt, startStream, chatLanguage]);

  // Handle sending a message
  const handleSend = useCallback(
    async (message: string, attachments?: any[]) => {
      if (!message.trim() || isStreaming) return;

      let conversationId = activeConversationId;

      // Create new conversation if needed
      if (!conversationId) {
        try {
          const newConv = await createConversation({
            projectId: selectedProject?.id,
          });
          conversationId = newConv.id;

          // Ensure continuity: immediately activate the new conversation in the conversation store.
          // Without this, other screens can "forget" the chat and bounce back to the welcome state.
          setActiveConversation(newConv.id);
          setConversationChatLanguage(newConv.id, chatLanguage);
        } catch (err) {
          console.error('[Chat] Failed to create conversation:', err);
          // Make failure visible (no conversation to persist into)
          alert(
            t(
              'aiChat.createConversationFailed',
              '⚠️ Nie udało się utworzyć konwersacji. Sprawdź czy jesteś zalogowany i spróbuj ponownie.'
            )
          );
          return;
        }
      }

      // Upload supported attachments into Knowledge Base and keep conversation-scoped doc filters.
      const existingAttachmentDocIds = Array.from(
        new Set(
          (activeMessages || [])
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

      const uploadedAttachments: Array<{
        docId: string;
        filename: string;
        mimeType?: string;
        size?: number;
      }> = [];

      for (const file of files) {
        const ext = String(file.name || '')
          .split('.')
          .pop()
          ?.toLowerCase();
        const supported =
          file.type === 'application/pdf' ||
          file.type.startsWith('text/') ||
          file.type === 'application/json' ||
          ['txt', 'md', 'csv', 'json'].includes(ext || '');

        if (!supported) {
          console.warn('[AIChatWelcomeView] Skipping unsupported attachment type:', {
            name: file.name,
            type: file.type,
            size: file.size,
          });
          continue;
        }

        try {
          const resp = await Api.uploadChatAttachment(file);
          const docId = String((resp as any)?.docId || '');
          if (!docId) continue;
          uploadedAttachments.push({
            docId,
            filename: file.name,
            mimeType: file.type || undefined,
            size: file.size,
          });
        } catch (err) {
          console.error('[AIChatWelcomeView] Failed to upload attachment:', err);
        }
      }

      const attachmentDocIds = Array.from(
        new Set([...existingAttachmentDocIds, ...uploadedAttachments.map((a) => a.docId)])
      );

      // Add user message
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: message.trim(),
        timestamp: new Date(),
      };

      // Also persist to conversation store (backend)
      try {
        await addMessage({
          conversationId: conversationId!,
          role: 'user',
          content: message.trim(),
          messageType: 'text',
          metadata:
            uploadedAttachments.length > 0
              ? ({ attachments: uploadedAttachments } as any)
              : undefined,
        });
      } catch (err) {
        console.error('[Chat] Failed to persist user message:', err);
      }

      // Build context
      // Important: `activeChatMessages` here does NOT yet include `userMsg`/`aiMsg` (state updates are async),
      // so we build history explicitly.
      const history = [...activeChatMessagesRef.current, userMsg]
        .filter((m) => !(m as any)?.isStreaming && m.id !== 'streaming')
        .filter((m) => !((m as any).metadata?.deepThinking?.kind === 'confirm'))
        .filter((m) => m.content && m.content.trim().length > 0) // Filter out empty messages
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: String(m.content || '') }],
        }));

      const fullContext = {
        ...screenContext,
        pmo: pmoContext,
        global: globalContext,
        workspaceContext,
        screenContext,
        pmoContext,
        currentSurface: 'chat/full',
        isWelcomeScreen: activeMessages.length === 0,
        conversationId,
        conversationLanguage: chatLanguage,
        attachmentDocIds,
        attachments: uploadedAttachments,
        virtualWorkerSlug: 'teresa',
        proposalMode: 'proposal_first',
      };

      let systemPrompt = buildSystemPrompt();

      // F1.4: When user comes from Help panel, inject help context into Teresa's prompt
      const helpData = workspaceContext?.entityData;
      if (helpData?.helpDocumentId) {
        systemPrompt += `\n\nHELP CONTEXT: The user came from the Help panel (document: "${workspaceContext?.entityName || helpData.helpDocumentId}", module: "${helpData.helpModuleId || 'general'}").
When citing knowledge base articles, always reference them by article_id (slug). Do not invent article titles or links not provided in the KB context below.\n`;
      }

      // Deep Thinking: blocking Confirm step (no streaming until user confirms)
      if (aiConfig?.deepResearch) {
        if (dtConfirmBusy) return;
        setDtConfirmBusy(true);
        try {
          const confirmRes = await Api.chatConfirm(
            message.trim(),
            history,
            systemPrompt,
            fullContext,
            undefined,
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

          let confirmMessageId = `dt-confirm-${Date.now()}`;
          try {
            const saved = await addMessage({
              conversationId: conversationId!,
              role: 'ai',
              content: md,
              messageType: 'text',
              metadata: {
                deepThinking: { kind: 'confirm', originalMessage: message.trim() },
                deepThinkingConfirm: c,
              } as any,
            });
            confirmMessageId = (saved as any)?.id || confirmMessageId;
          } catch (persistErr) {
            console.error('[AIChatWelcomeView] Failed to persist confirm card:', persistErr);
          }

          setDtPendingConfirm({
            messageId: confirmMessageId,
            conversationId: conversationId || null,
            originalMessage: message.trim(),
            editedMessage: message.trim(),
            confirm: c,
            context: fullContext,
          });

          return; // Don't start stream yet - wait for user to confirm
        } catch (err) {
          console.error('[AIChatWelcomeView] Deep Thinking confirm failed:', err);
          // Fall through to regular stream on error
        } finally {
          setDtConfirmBusy(false);
        }
      }

      startStream(
        message.trim(),
        history,
        systemPrompt,
        fullContext,
        undefined,
        undefined,
        chatLanguage
      );

      // Auto-speak in voice mode
      if (voiceModeEnabled && voiceSupported) {
        // Speech will be triggered when streaming completes
      }
    },
    [
      activeConversationId,
      selectedProject,
      currentUser,
      isStreaming,
      coThinkerPhase,
      chatLanguage,
      voiceModeEnabled,
      voiceSupported,
      createConversation,
      setActiveConversation,
      setConversationChatLanguage,
      addMessage,
      startStream,
      screenContext,
      pmoContext,
      globalContext,
      activeMessages,
      aiMemoryContext,
      aiConfig,
      dtConfirmBusy,
      buildSystemPrompt,
      workspaceContext,
      t,
    ]
  );

  // F1.1: Consume chatKickoffMessage on full-screen chat (mobile/tablet from Help → Ask AI)
  const kickoffSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (!chatKickoffMessage) return;
    if (isStreaming) return;
    if ((activeMessages || []).length > 0) return;
    if (kickoffSentRef.current === chatKickoffMessage) return;

    kickoffSentRef.current = chatKickoffMessage;
    void handleSend(chatKickoffMessage);
    clearChatKickoffMessage();
  }, [chatKickoffMessage, isStreaming, activeMessages, handleSend, clearChatKickoffMessage]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    async (suggestion: any) => {
      if (suggestion.action?.type === 'chat' && suggestion.action.prompt) {
        // Special handling for daily brief
        if (suggestion.action.prompt === '__DAILY_BRIEF__') {
          try {
            const response = await fetch(
              `/api/daily-brief${selectedProject?.id ? `?projectId=${selectedProject.id}` : ''}`,
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
              }
            );
            if (response.ok) {
              const data = await response.json();
              const content = data.brief?.textVersion || 'Nie udało się wygenerować briefu.';
              let convId = activeConversationIdRef.current;
              if (!convId) {
                const newConv = await createConversation({ projectId: selectedProject?.id });
                convId = newConv.id;
                setActiveConversation(newConv.id);
                setConversationChatLanguage(newConv.id, chatLanguage);
              }
              if (convId) {
                await addMessage({
                  conversationId: convId,
                  role: 'ai',
                  content,
                  messageType: 'text',
                });
              }
            } else {
              handleSend('Pokaż mi dzienny brief - podsumowanie moich zadań, decyzji i inicjatyw');
            }
          } catch (err) {
            console.error('[DailyBrief] Error:', err);
            handleSend('Pokaż mi dzienny brief - podsumowanie moich zadań, decyzji i inicjatyw');
          }
        } else {
          handleSend(suggestion.action.prompt);
        }
      }
    },
    [
      addMessage,
      chatLanguage,
      createConversation,
      handleSend,
      selectedProject,
      setActiveConversation,
      setConversationChatLanguage,
    ]
  );

  const startModuleWithKickoff = useCallback(
    (view: AppView, aiPatch: any, kickoff: string) => {
      setAIConfig(aiPatch);
      setChatKickoffMessage(kickoff);
      // Ensure a clean conversation so kickoff can auto-send safely
      clearActiveChat();
      if (isChatCollapsed) toggleChatCollapse();
      setCurrentView(view);
    },
    [
      clearActiveChat,
      isChatCollapsed,
      setAIConfig,
      setChatKickoffMessage,
      setCurrentView,
      toggleChatCollapse,
    ]
  );

  // Handle new chat — clear state AND create a fresh conversation (like UnifiedChatPanel)
  const handleNewChat = useCallback(async () => {
    clearActiveChat();
    setDtPendingConfirm(null);
    clearLastError();
    abortStream();
    // Title generation is handled by the conversation store
    try {
      const conv = await createConversation({ projectId: selectedProject?.id });
      setActiveConversation(conv.id);
      if (chatLanguage) {
        setConversationChatLanguage(conv.id, chatLanguage);
      }
    } catch (err) {
      console.error('[AIChatWelcomeView] Failed to create new chat:', err);
    }
  }, [
    abortStream,
    chatLanguage,
    clearActiveChat,
    clearLastError,
    createConversation,
    selectedProject?.id,
    setActiveConversation,
    setConversationChatLanguage,
  ]);

  // Handle export
  const handleExport = useCallback(() => {
    setShowExportModal(true);
  }, []);

  const handleExportFormat = useCallback(
    async (format: 'pdf' | 'json' | 'txt') => {
      const messages = activeChatMessages;
      if (!messages.length) return;

      const title =
        useConversationStore.getState().conversations.find((c) => c.id === activeConversationId)
          ?.title || 'AI Chat Export';
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}`;

      if (format === 'json') {
        const data = JSON.stringify(
          {
            title,
            exportedAt: new Date().toISOString(),
            messageCount: messages.length,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
            })),
          },
          null,
          2
        );
        downloadFile(`${filename}.json`, data, 'application/json');
      } else if (format === 'txt') {
        const lines = messages.map(
          (m) =>
            `[${m.role === 'user' ? 'User' : 'AI'}] ${m.timestamp ? new Date(m.timestamp).toLocaleString() : ''}\n${m.content}\n`
        );
        downloadFile(
          `${filename}.txt`,
          `${title}\n${'='.repeat(40)}\n\n${lines.join('\n')}`,
          'text/plain'
        );
      } else {
        // PDF — proper formatted document
        await exportConversationToPDF(
          messages.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
          { title, filename: `${filename}.pdf` }
        );
      }

      setShowExportModal(false);
    },
    [activeChatMessages, activeConversationId]
  );

  // Handle daily brief
  const handleDailyBrief = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/daily-brief${selectedProject?.id ? `?projectId=${selectedProject.id}` : ''}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const content = data.brief?.textVersion || 'Nie udało się wygenerować briefu.';
        let convId = activeConversationIdRef.current;
        if (!convId) {
          const newConv = await createConversation({ projectId: selectedProject?.id });
          convId = newConv.id;
          setActiveConversation(newConv.id);
          setConversationChatLanguage(newConv.id, chatLanguage);
        }
        if (convId) {
          await addMessage({
            conversationId: convId,
            role: 'ai',
            content,
            messageType: 'text',
          });
        }
      }
    } catch (err) {
      console.error('[DailyBrief] Error:', err);
    }
  }, [
    addMessage,
    chatLanguage,
    createConversation,
    selectedProject,
    setActiveConversation,
    setConversationChatLanguage,
  ]);

  // Handle message feedback (thumbs up/down)
  const handleFeedback = useCallback((messageId: string, feedback: MessageFeedback) => {
    setMessageFeedback((prev) => ({
      ...prev,
      [messageId]: feedback,
    }));

    // Report to backend for analytics
    Api.reportMessageFeedback?.(messageId, feedback.rating).catch((err: any) => {
      console.error('[Feedback] Failed to report:', err);
    });

    console.log('[Chat] Feedback recorded:', messageId, feedback.rating);
  }, []);

  // Handle report problem - visual alert
  const handleReport = useCallback((messageId: string, reason: string) => {
    console.error('[REPORT] 🚨 Problem reported:', { messageId, reason });

    // Show visual feedback - "krzyk" (scream)
    const alertDiv = document.createElement('div');
    alertDiv.className =
      'fixed top-4 right-4 z-50 p-4 bg-red-600 text-white rounded-lg shadow-xl animate-pulse';
    alertDiv.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-2xl">⚠️</span>
                <div>
                    <div class="font-bold">Zgłoszono problem</div>
                    <div class="text-sm opacity-90">${
                      reason === 'harmful'
                        ? 'Szkodliwa treść'
                        : reason === 'incorrect'
                          ? 'Błędne informacje'
                          : reason === 'unhelpful'
                            ? 'Nieprzydatne'
                            : 'Inny problem'
                    }</div>
                </div>
            </div>
        `;
    document.body.appendChild(alertDiv);

    // Remove after 4 seconds
    setTimeout(() => {
      alertDiv.classList.add('opacity-0', 'transition-opacity', 'duration-500');
      setTimeout(() => document.body.removeChild(alertDiv), 500);
    }, 4000);

    // Report to backend
    Api.reportMessage?.(messageId, reason).catch((err: any) => {
      console.error('[Report] Failed to send report:', err);
    });
  }, []);

  const handleStartEdit = useCallback((messageId: string) => {
    const msg = activeChatMessagesRef.current.find((m) => m.id === messageId);
    if (!msg || msg.role !== 'user') return;
    if (String(msg.id || '').startsWith('local-')) return;
    setEditingMessageId(messageId);
    setEditingText(msg.content || '');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingText('');
  }, []);

  const handleCommitEdit = useCallback(async () => {
    if (!editingMessageId) return;
    const newText = editingText.trim();
    if (!newText) return;
    if (!activeConversationId) return;
    if (editBusy || isStreaming) return;

    setEditBusy(true);
    try {
      // Truncate conversation after edited message and update its content
      await truncateFromMessage(editingMessageId, newText);

      // Build history up to (but excluding) the edited message, then resend from that point
      const msgs = useConversationStore.getState().activeMessages || [];
      const idx = msgs.findIndex((m: any) => m.id === editingMessageId);
      const before = idx >= 0 ? msgs.slice(0, idx) : msgs;
      const history = before
        .filter((m: any) => m?.content && String(m.content).trim().length > 0)
        .map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: String(m.content || '') }],
        }));

      const attachmentDocIds = Array.from(
        new Set(
          (msgs || [])
            .flatMap((m: any) =>
              Array.isArray(m?.metadata?.attachments) ? m.metadata.attachments : []
            )
            .map((a: any) => a?.docId)
            .filter(Boolean)
            .map((x: any) => String(x))
        )
      );

      const fullContext = {
        ...screenContext,
        pmo: pmoContext,
        global: globalContext,
        workspaceContext,
        screenContext,
        pmoContext,
        currentSurface: 'chat/full',
        isWelcomeScreen: false,
        conversationId: activeConversationId,
        conversationLanguage: chatLanguage,
        attachmentDocIds,
        virtualWorkerSlug: 'teresa',
        proposalMode: 'proposal_first',
      };
      const systemPrompt = buildSystemPrompt();

      // If Deep Research is enabled, run confirm step again
      if (aiConfig?.deepResearch) {
        if (!dtConfirmBusy) {
          setDtConfirmBusy(true);
          try {
            const confirmRes = await Api.chatConfirm(
              newText,
              history,
              systemPrompt,
              fullContext,
              undefined,
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

            let confirmMessageId = `dt-confirm-${Date.now()}`;
            try {
              const saved = await addMessage({
                conversationId: activeConversationId,
                role: 'ai',
                content: md,
                messageType: 'text',
                metadata: {
                  deepThinking: { kind: 'confirm', originalMessage: newText },
                  deepThinkingConfirm: c,
                } as any,
              });
              confirmMessageId = (saved as any)?.id || confirmMessageId;
            } catch (persistErr) {
              console.error('[AIChatWelcomeView] Failed to persist confirm card:', persistErr);
            }
            setDtPendingConfirm({
              messageId: confirmMessageId,
              conversationId: activeConversationId,
              originalMessage: newText,
              editedMessage: newText,
              confirm: c,
              context: fullContext,
            });
          } finally {
            setDtConfirmBusy(false);
          }
        }
      } else {
        startStream(
          newText,
          history,
          systemPrompt,
          fullContext,
          undefined,
          undefined,
          chatLanguage
        );
      }

      handleCancelEdit();
    } catch (e) {
      console.error('[Chat] Edit & regenerate failed:', e);
    } finally {
      setEditBusy(false);
    }
  }, [
    activeConversationId,
    aiConfig,
    buildSystemPrompt,
    chatLanguage,
    dtConfirmBusy,
    editBusy,
    editingMessageId,
    editingText,
    globalContext,
    handleCancelEdit,
    isStreaming,
    pmoContext,
    screenContext,
    workspaceContext,
    startStream,
    truncateFromMessage,
  ]);

  // Handle message regenerate
  const handleRegenerate = useCallback(
    (messageId: string) => {
      // Find the user message before this AI message and resend
      const msgIndex = activeChatMessages.findIndex((m) => m.id === messageId);
      if (msgIndex > 0) {
        const previousUserMsg = activeChatMessages[msgIndex - 1];
        if (previousUserMsg && previousUserMsg.role === 'user') {
          handleSend(previousUserMsg.content);
        }
      }
    },
    [activeChatMessages, handleSend]
  );

  const hasMessages = activeChatMessages.length > 0;
  // Loading state — conversation is selected but messages haven't arrived yet
  // (e.g. after page reload / cross-screen navigation while rehydration fetches)
  const isRehydrating = !!activeConversationId && !hasMessages && isConversationLoading;
  if (isRehydrating) {
    return (
      <div className="h-full w-full bg-slate-50 dark:bg-navy-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {t('aiChat.loadingConversation', 'Loading conversation…')}
          </p>
        </div>
      </div>
    );
  }

  // Chat View (when messages exist)
  if (hasMessages) {
    return (
      <div
        className={`h-full w-full bg-slate-50 dark:bg-navy-950 overflow-hidden relative ${
          isPrivateMode
            ? 'ring-1 ring-violet-200/70 dark:ring-violet-800/45'
            : 'ring-1 ring-transparent'
        }`}
      >
        {/* Claude-style Sliding Panel */}
        <ChatSlidingPanel
          onNewChat={handleNewChat}
          onSelectConversation={(id: string) => setActiveConversation(id)}
          activeConversationId={activeConversationId}
        />

        {/* Main Chat Area - Full width, sidebar is overlay */}
        <div className="h-full flex flex-col overflow-hidden">
          {/* Header with Sidebar Toggle */}
          <div className="shrink-0 h-14 border-b border-slate-200 dark:border-navy-700 flex items-center px-4 justify-between bg-white/50 dark:bg-navy-950/50 backdrop-blur-sm z-10">
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
              {isPrivateMode && (
                <div
                  className="mr-1 inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:border-violet-800/70 dark:bg-violet-900/25 dark:text-violet-300"
                  title={t(
                    'aiChat.menu.modes.privateMode.desc',
                    'Disable memory injection and personalization for this chat'
                  )}
                  aria-label={t('aiChat.menu.modes.privateMode.label', 'Private mode')}
                >
                  <Lock size={11} strokeWidth={2} />
                  <span>{t('aiChat.menu.modes.privateMode.label', 'Private mode')}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {voiceSupported && (
                <button
                  onClick={() => {
                    // While speaking, this button must behave as immediate mute/off.
                    if (voiceState.isSpeaking) {
                      stopSpeaking();
                    }
                    const nextState = voiceState.isSpeaking ? false : !autoReadEnabled;
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

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-4 py-8">
              {activeChatMessages.map((msg, index) => {
                const isLastMessage = index === activeChatMessages.length - 1;
                const isAiMessage = msg.role === 'ai';
                const isStreamingThis = isStreaming && isLastMessage && isAiMessage;
                const isEditingThis = msg.role === 'user' && editingMessageId === msg.id;

                const displayContent = isStreamingThis ? streamedContent : msg.content;

                if (isAiMessage && !displayContent && !isStreamingThis) {
                  return null;
                }

                return (
                  <div
                    key={msg.id}
                    className={`mb-6 ${msg.role === 'user' ? 'flex justify-end' : ''}`}
                  >
                    {/* Thinking Block - 5-step progress (visible during streaming) */}
                    {isAiMessage && isStreamingThis && thinkingSteps.length > 0 && (
                      <div className="mb-2 max-w-[85%]">
                        <ThinkingBlock
                          steps={thinkingSteps}
                          isStreaming={true}
                          {...({ defaultExpanded: !displayContent } as any)}
                        />
                      </div>
                    )}

                    {/* Research Progress - web search / sources status (C6.1) */}
                    {isAiMessage && isStreamingThis && researchProgress && (
                      <div className="mb-2 max-w-[85%]">
                        <ResearchProgress {...researchProgress} />
                      </div>
                    )}

                    {/* Thinking Status Line - elapsed time + retry info */}
                    {isAiMessage && isStreamingThis && !displayContent && streamStartedAt && (
                      <div className="mb-2 max-w-[85%]">
                        <ThinkingStatusLine
                          label={
                            retryInfo
                              ? `Attempt ${retryInfo.attempt}/${retryInfo.maxRetries}...`
                              : 'Thinking...'
                          }
                          compact
                        />
                      </div>
                    )}

                    <div
                      className={`inline-block max-w-[85%] ${
                        msg.role === 'user'
                          ? 'bg-primary-600 text-white rounded-xl rounded-br-md px-4 py-3'
                          : 'text-navy-900 dark:text-slate-200'
                      } ${isRtlChatLanguage ? 'text-right' : 'text-left'}`}
                      dir={textDirection(chatLanguage)}
                    >
                      <div className="text-[15px] leading-relaxed">
                        {isEditingThis ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              rows={3}
                              className="w-full text-sm bg-white/90 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary-500/40 text-navy-900 dark:text-slate-100"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={handleCancelEdit}
                                disabled={editBusy}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-200 dark:bg-navy-700 hover:bg-slate-300 dark:hover:bg-navy-600 text-slate-700 dark:text-slate-300 disabled:opacity-50"
                              >
                                {t('common.cancel', 'Cancel')}
                              </button>
                              <button
                                onClick={handleCommitEdit}
                                disabled={editBusy || !editingText.trim()}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50"
                              >
                                {editBusy
                                  ? t('common.saving', 'Saving…')
                                  : t('common.save', 'Save')}
                              </button>
                            </div>
                          </div>
                        ) : isAiMessage ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-code:text-primary-600 dark:prose-code:text-primary-400 prose-code:before:content-none prose-code:after:content-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {displayContent || ''}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <span className="whitespace-pre-wrap">{displayContent}</span>
                        )}
                        {isStreamingThis && displayContent && (
                          <span className="inline-block w-2 h-5 bg-primary-500 ml-1 animate-pulse rounded-sm" />
                        )}
                      </div>

                      {/* Citations */}
                      {isAiMessage && msg.citations && msg.citations.length > 0 && (
                        <CitationList
                          citations={msg.citations}
                          collapsed={citationsCollapsed}
                          onToggle={() => setCitationsCollapsed(!citationsCollapsed)}
                        />
                      )}

                      {/* Actions */}
                      {isAiMessage && msg.actions && msg.actions.length > 0 && !isStreamingThis && (
                        <ResponseActions
                          actions={msg.actions}
                          onActionComplete={(action) => {
                            console.log('[Chat] Action completed:', action.id);
                            handleAIAction(action);
                          }}
                        />
                      )}

                      {isAiMessage && (msg.metadata as any)?.proposal && !isStreamingThis && (
                        <TeresaProposalCard
                          proposal={(msg.metadata as any).proposal as TeresaChatProposal}
                          onNavigate={handleTeresaProposalNavigate}
                          onProposalUpdated={handleTeresaProposalUpdated}
                          onLifecycleMessage={handleTeresaLifecycleMessage}
                        />
                      )}

                      {/* Voice Mode Indicator */}
                      {isAiMessage && !isStreamingThis && voiceModeEnabled && voiceSupported && (
                        <button
                          onClick={() => replaySpeech(displayContent)}
                          className="mt-2 text-xs text-slate-400 dark:text-slate-500 hover:text-primary-500 flex items-center gap-1"
                          title="Odtwórz głosowo"
                        >
                          🔊 Odtwórz
                        </button>
                      )}

                      {/* Retry button for error messages */}
                      {isAiMessage &&
                        !isStreamingThis &&
                        displayContent?.includes('⚠️') &&
                        (() => {
                          const prevUserMsg = activeChatMessages
                            .slice(0, index)
                            .reverse()
                            .find((m) => m.role === 'user');
                          return prevUserMsg ? (
                            <button
                              onClick={() => handleSend(prevUserMsg.content)}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                            >
                              <RefreshCw size={12} />
                              {t('aiChat.retry', 'Try again')}
                            </button>
                          ) : null;
                        })()}

                      {/* Deep Thinking Confirm Card */}
                      {isAiMessage &&
                        !isStreamingThis &&
                        (msg as any).metadata?.deepThinking?.kind === 'confirm' &&
                        dtPendingConfirm?.messageId === msg.id && (
                          <div className="mt-4 p-4 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
                            <div className="flex flex-col gap-3">
                              <div className="text-sm font-medium text-primary-700 dark:text-primary-300">
                                {t(
                                  'aiChat.deepThinking.confirmTitle',
                                  'Ready to start Deep Thinking?'
                                )}
                              </div>
                              <textarea
                                value={dtPendingConfirm.editedMessage}
                                onChange={(e) =>
                                  setDtPendingConfirm((prev) =>
                                    prev ? { ...prev, editedMessage: e.target.value } : prev
                                  )
                                }
                                rows={2}
                                className="w-full text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary-500/40"
                                placeholder={t(
                                  'aiChat.deepThinking.editPlaceholder',
                                  'Edit your question if needed...'
                                )}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={handleDeepThinkingProceed}
                                  disabled={dtConfirmBusy || isStreaming}
                                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  {dtConfirmBusy
                                    ? t('aiChat.deepThinking.processing', 'Processing...')
                                    : t(
                                        'aiChat.deepThinking.confirm',
                                        'Confirm & Start Deep Thinking'
                                      )}
                                </button>
                                <button
                                  onClick={() => setDtPendingConfirm(null)}
                                  className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-200 dark:bg-navy-700 hover:bg-slate-300 dark:hover:bg-navy-600 text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                  {t('common.cancel', 'Cancel')}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>

                    {/* User Message Actions */}
                    {msg.role === 'user' && !isEditingThis && (
                      <div className="mt-2 flex items-center justify-end gap-1">
                        <MessageActions
                          message={{
                            id: msg.id,
                            role: 'user',
                            content: displayContent,
                            timestamp: msg.timestamp,
                            canEdit: true,
                          }}
                          onEdit={(id) => handleStartEdit(id)}
                          showAlwaysVisible={true}
                        />
                      </div>
                    )}

                    {/* Message Actions - shown below AI messages */}
                    {isAiMessage && !isStreamingThis && displayContent && (
                      <div className="mt-2 flex items-center gap-1">
                        <MessageActions
                          message={{
                            id: msg.id,
                            role: 'ai',
                            content: displayContent,
                            timestamp: msg.timestamp,
                            feedback: messageFeedback[msg.id] as any,
                          }}
                          onFeedback={handleFeedback}
                          onReport={handleReport}
                          onRegenerate={handleRegenerate}
                          onSpeak={voiceSupported ? (content) => replaySpeech(content) : undefined}
                          showAlwaysVisible={true}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Pending Actions Banner */}
          {pendingActions.length > 0 && (
            <div className="shrink-0 p-3 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
              <div className="max-w-5xl mx-auto">
                {pendingActions.map((pa) => {
                  const message =
                    typeof pa.payload?.message === 'string'
                      ? pa.payload.message
                      : t('aiChat.pendingAction', 'Action requires confirmation');

                  return (
                    <div key={pa.id} className="flex items-center justify-between text-sm">
                      <span className="text-yellow-800 dark:text-yellow-200">🔔 {message}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfirmPendingAction(pa.id, true)}
                          className="px-3 py-1 bg-green-500 text-white rounded-md text-xs hover:bg-green-600"
                        >
                          Potwierdź
                        </button>
                        <button
                          onClick={() => handleConfirmPendingAction(pa.id, false)}
                          className="px-3 py-1 bg-red-500 text-white rounded-md text-xs hover:bg-red-600"
                        >
                          Anuluj
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Continuous Voice Mode Indicator */}
          {continuousVoiceMode && (
            <div className="shrink-0 p-2 bg-primary-50 dark:bg-primary-900/20 border-t border-primary-200 dark:border-primary-800">
              <div className="max-w-5xl mx-auto flex items-center justify-center gap-3 text-sm">
                <span
                  className={`w-3 h-3 rounded-full ${voiceState.isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-400'}`}
                />
                <span className="text-primary-700 dark:text-primary-300">
                  {voiceState.isListening
                    ? 'Słucham...'
                    : voiceState.isSpeaking
                      ? 'Mówię...'
                      : 'Tryb głosowy aktywny'}
                </span>
                {voiceState.interimTranscript && (
                  <span className="text-slate-500 dark:text-slate-400 italic truncate max-w-xs">
                    "{voiceState.interimTranscript}"
                  </span>
                )}
                <button
                  onClick={handleContinuousVoiceToggle}
                  className="px-3 py-1 bg-red-500 text-white rounded-md text-xs hover:bg-red-600"
                >
                  Zatrzymaj
                </button>
              </div>
            </div>
          )}

          {/* Input at bottom */}
          <div className="shrink-0 p-4 border-t border-slate-200 dark:border-navy-700">
            <div className="max-w-5xl mx-auto">
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
                onSend={handleSend}
                onStopGenerating={abortStream}
                onTeresaVoiceToggle={teresaVoice.handleVoiceToggle}
                teresaVoiceStatus={teresaVoice.voiceStatus}
                teresaVoiceMuted={teresaVoice.isMuted}
                onTeresaVoiceMuteToggle={teresaVoice.toggleMute}
                isStreaming={isStreaming}
                disabled={isActionExecuting}
                variant="compact"
                placeholder={t('aiChat.placeholder', 'Start a transformation...')}
                voiceModeEnabled={voiceModeEnabled}
                onVoiceModeChange={handleVoiceModeChange}
                chatLanguage={chatLanguage}
                voiceState={voiceState}
                startVoiceListening={startListening}
                stopVoiceListening={stopListening}
              />
            </div>
          </div>
        </div>

        {/* Export Modal */}
        <ChatExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleExportFormat}
        />

      </div>
    );
  }

  // Welcome Screen
  return (
    <div className="h-full w-full bg-slate-50 dark:bg-navy-950 overflow-hidden relative">
      {/* Claude-style Sliding Panel */}
      <ChatSlidingPanel
        onNewChat={handleNewChat}
        onSelectConversation={(id: string) => setActiveConversation(id)}
        activeConversationId={activeConversationId}
      />

      {/* Main Welcome Area - Full width, sidebar is overlay */}
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header with Sidebar Toggle */}
        <div className="shrink-0 h-14 flex items-center px-4 justify-end absolute top-0 left-0 right-0 z-10">
          <div className="flex items-center gap-1">
            {voiceSupported && (
              <button
                onClick={() => {
                  // While speaking, this button must behave as immediate mute/off.
                  if (voiceState.isSpeaking) {
                    stopSpeaking();
                  }
                  const nextState = voiceState.isSpeaking ? false : !autoReadEnabled;
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

        {/* Centered Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 relative z-10">
          {/* Personalized Greeting */}
          <div className="text-center mb-10">
            <div className="mb-3 inline-flex items-center rounded-full border border-primary-200/70 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:border-primary-800/60 dark:bg-primary-900/20 dark:text-primary-300">
              Teresa
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold text-navy-900 dark:text-white">
              {t(`aiChat.greeting.${timeContext.greetingKey}`, timeContext.greetingFallback)}
              {firstName && <span className="text-primary-600">, {firstName}</span>}
            </h1>
            <p
              className={`text-slate-500 dark:text-slate-400 mt-4 text-lg transition-opacity duration-200 ${
                subtitleFading ? 'opacity-0' : 'opacity-100'
              }`}
            >
              {subtitleText}
            </p>
          </div>

          {/* Chat Input */}
          <div className="w-full max-w-5xl">
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
            <OutputToolSelector />
            <EnhancedChatInput
              onSend={handleSend}
              onStopGenerating={abortStream}
              onTeresaVoiceToggle={teresaVoice.handleVoiceToggle}
              teresaVoiceStatus={teresaVoice.voiceStatus}
              teresaVoiceMuted={teresaVoice.isMuted}
              onTeresaVoiceMuteToggle={teresaVoice.toggleMute}
              isStreaming={isStreaming}
              disabled={false}
              variant="compact"
              placeholder={t('aiChat.teresaPlaceholder', 'Ask Teresa about your work...')}
              voiceModeEnabled={voiceModeEnabled}
              onVoiceModeChange={handleVoiceModeChange}
              chatLanguage={chatLanguage}
            />
          </div>

          {/* Minimal Suggestions */}
          <div className="w-full max-w-5xl mt-5">
            <SmartSuggestions
              projectId={selectedProject?.id}
              onSuggestionClick={handleSuggestionClick}
              variant="minimal"
              workspaceType={workspaceContext?.type}
              entityName={workspaceContext?.entityName}
            />
          </div>

          {/* AI Capability Cards — shows what the AI can do */}
          <div className="w-full max-w-2xl mt-6 grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              {
                icon: Search,
                label: t('aiChat.homeCards.market.label', 'Analiza rynku'),
                desc: t(
                  'aiChat.homeCards.market.desc',
                  'Research a market, competitors, and positioning'
                ),
                color: 'text-violet-500',
                bg: 'bg-violet-50 dark:bg-violet-900/20',
                onClick: () => {
                  const kickoff = t(
                    'aiChat.homeCards.market.kickoff',
                    'Chcę zrobić analizę rynku. Opisz proszę, jakie pytania musisz mi zadać, żeby dobrze zdefiniować: branżę, segment, kraj, klientów, konkurencję i przewagę. Zacznij od 5 pytań.'
                  );
                  setAIConfig({
                    deepResearch: true,
                    marketResearch: true,
                    webSearch: true,
                    coThinkerMode: null,
                    responseStyle: 'analyst',
                  } as any);
                  void handleSend(kickoff);
                },
              },
              {
                icon: Calculator,
                label: t('aiChat.homeCards.finance.label', 'Analiza finansowa'),
                desc: t('aiChat.homeCards.finance.desc', 'Analyze ROI, budgets, and scenarios'),
                color: 'text-emerald-500',
                bg: 'bg-emerald-50 dark:bg-emerald-900/20',
                onClick: () => {
                  const kickoff = t(
                    'aiChat.homeCards.finance.kickoff',
                    'Chcę zrobić analizę finansową. Jakie dane mamy przeanalizować (budżet, koszty, przychody, ROI, CAPEX/OPEX)? Zadaj mi 5 pytań, a potem zaproponuj strukturę analizy.'
                  );
                  startModuleWithKickoff(
                    AppView.ECONOMICS,
                    {
                      deepResearch: false,
                      marketResearch: false,
                      webSearch: false,
                      coThinkerMode: 'competitive_analyst',
                      responseStyle: 'analyst',
                    },
                    kickoff
                  );
                },
              },
              {
                icon: Wrench,
                label: t('aiChat.homeCards.consulting.label', 'Klasyczny consulting'),
                desc: t('aiChat.homeCards.consulting.desc', 'Use classic frameworks and tools'),
                color: 'text-amber-500',
                bg: 'bg-amber-50 dark:bg-amber-900/20',
                onClick: () => {
                  const kickoff = t(
                    'aiChat.homeCards.consulting.kickoff',
                    'Chcę użyć klasycznych narzędzi consultingowych. Jaki problem rozwiązujemy i w jakim kontekście? Zadaj mi 5 pytań, a potem zaproponuj 2–3 najlepsze ramy (np. SWOT, 5 Forces, Ansoff, Value Chain).'
                  );
                  startModuleWithKickoff(
                    AppView.DISCOVERY_TOOLS,
                    {
                      deepResearch: false,
                      marketResearch: false,
                      webSearch: false,
                      coThinkerMode: 'multi_consultant',
                      responseStyle: 'professional',
                    },
                    kickoff
                  );
                },
              },
              {
                icon: CheckCircle2,
                label: t('aiChat.homeCards.digital.label', 'Transformacja cyfrowa'),
                desc: t(
                  'aiChat.homeCards.digital.desc',
                  'Run licensed diagnostics and assessments'
                ),
                color: 'text-blue-500',
                bg: 'bg-blue-50 dark:bg-blue-900/20',
                onClick: () => {
                  const kickoff = t(
                    'aiChat.homeCards.digital.kickoff',
                    'Chcę ocenić gotowość do transformacji cyfrowej. Jakie obszary mamy ocenić i jakie są kryteria? Zadaj mi 5 pytań i zaproponuj szybki plan diagnozy.'
                  );
                  startModuleWithKickoff(
                    AppView.ASSESSMENT_OVERVIEW,
                    {
                      deepResearch: false,
                      marketResearch: false,
                      webSearch: false,
                      coThinkerMode: 'multi_consultant',
                      responseStyle: 'coach',
                    },
                    kickoff
                  );
                },
              },
            ].map((cap) => (
              <button
                key={cap.label}
                onClick={cap.onClick}
                className="group flex flex-col items-start gap-1.5 p-2.5 rounded-lg border border-slate-200/60 dark:border-white/5 bg-white/60 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-all duration-200 text-left"
              >
                <div className={`p-1.5 rounded-md ${cap.bg}`}>
                  <cap.icon size={15} className={cap.color} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-navy-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {cap.label}
                  </div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">
                    {cap.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* First-time help hint */}
          <div className="w-full max-w-2xl mt-4 text-center">
            <p className="text-[11px] text-slate-400 dark:text-slate-600 flex items-center justify-center gap-1.5">
              <Sparkles size={11} />
              {t(
                'aiChat.onboarding.hint',
                'Tip: Try voice mode, attach files, or enable Deep Thinking for multi-step analysis'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Organization logo — visible only after the image loads successfully */}
      {!!orgLogoUrl && (
        <div
          className={`absolute bottom-4 right-16 sm:right-20 z-20 pointer-events-none select-none transition-opacity duration-300 ${
            orgLogoLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="rounded-xl border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-navy-950/40 backdrop-blur-md px-3 py-2 shadow-lg">
            <img
              src={orgLogoUrl}
              alt={currentOrganization?.name || currentUser?.organizationName || 'Organization'}
              className="h-10 sm:h-12 w-auto max-w-[190px] object-contain opacity-95"
              draggable={false}
              onLoad={() => setOrgLogoLoaded(true)}
              onError={() => setOrgLogoLoaded(false)}
            />
          </div>
        </div>
      )}

      {/* Footer (overlay) - does NOT affect centering above */}
      <div className="absolute bottom-0 left-0 right-0 p-4 flex flex-col items-center gap-1 pointer-events-none select-none z-0">
        <img
          src="/assets/logos/logo-dark.svg?v=20260319"
          alt="Consultify"
          className="h-24 sm:h-28 md:h-32 w-auto opacity-100 hidden dark:block translate-y-1 drop-shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
          draggable={false}
        />
        <img
          src="/assets/logos/logo-light.svg?v=20260319"
          alt="Consultify"
          className="h-24 sm:h-28 md:h-32 w-auto opacity-35 dark:hidden translate-y-1"
          draggable={false}
        />
        <p className="-mt-0.5 text-center text-[11px] text-slate-400 dark:text-slate-600 tracking-[0.25em] uppercase">
          <span className="text-primary-600 dark:text-primary-400">DBR77</span>{' '}
          <span>Industrial Intelligence</span>
        </p>
      </div>

      {/* Export Modal */}
      <ChatExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExportFormat}
      />

      {/* TTS Indicator - shows when speaking */}
      <TTSIndicator />

    </div>
  );
};

export default AIChatWelcomeView;
