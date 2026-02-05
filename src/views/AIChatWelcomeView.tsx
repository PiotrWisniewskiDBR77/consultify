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

import { PanelLeft } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAIContext } from '@/contexts/AIContext';
import { isValidLanguage, type SupportedLanguage } from '@/i18n';
import { Api } from '@/services/api';

import { ChatExportModal } from '../components/AIChat/ChatExportModal';
// Components
import { ChatSlidingPanel } from '../components/AIChat/ChatSlidingPanel';
import { CitationList } from '../components/AIChat/CitationList';
import { EnhancedChatInput } from '../components/AIChat/EnhancedChatInput';
import { MessageActions } from '../components/AIChat/Messages/MessageActions';
import { ResponseActions } from '../components/AIChat/ResponseActions';
import { SmartSuggestions } from '../components/AIChat/SmartSuggestions';
import { ThinkingBlock } from '../components/AIChat/Messages/ThinkingBlock';
import { ThinkingStatusLine } from '../components/AIChat/ThinkingStatusLine';
import { TTSIndicator } from '../components/AIChat/TTSIndicator';
import { ACTION_TYPES, ActionPayload, useActionHandler } from '../hooks/useActionHandler';
import { useAIStream } from '../hooks/useAIStream';
import { useUniversalVoice } from '../hooks/useUniversalVoice';
import { useAppStore } from '../store/useAppStore';
import { useConversationStore } from '../store/useConversationStore';
import { usePMOStore } from '../store/usePMOStore';
import { ChatCitation, ChatMessage, ChatResponseAction } from '../types';
import { MessageFeedback } from '../types';
import { cleanTextForSpeech } from '../utils/textCleaning';

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

export const AIChatWelcomeView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastBackendSyncSigRef = useRef<string>('');

  // App state
  const {
    currentUser,
    currentProjectId,
    activeChatMessages,
    addChatMessage,
    clearChat,
    setChatMessages,
    updateLastChatMessage,
  } = useAppStore();
  const activeChatMessagesRef = useRef(activeChatMessages);
  const { projectName } = usePMOStore();

  // Derived state for compatibility
  const selectedProject = useMemo(
    () => (currentProjectId ? { id: currentProjectId, name: projectName } : null),
    [currentProjectId, projectName]
  );

  // Conversation store
  const {
    activeConversationId,
    activeMessages,
    isLoading: isConversationLoading,
    isSidebarOpen,
    toggleSidebar,
    createConversation,
    addMessage,
    updateLastMessage,
    setActiveConversation,
    clearActiveChat,
    generateTitle,
    draftChatLanguage,
    chatLanguageByConversationId,
    setConversationChatLanguage,
  } = useConversationStore();

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

  // AI stream with persistence callback
  const handleStreamDone = useCallback(
    async (fullText: string) => {
      // Persist AI response to conversation store (backend)
      try {
        await addMessage({
          conversationId: activeConversationId!,
          role: 'ai',
          content: fullText,
          messageType: 'text',
        });

        // Trigger title generation after first AI response
        if (isFirstExchangeRef.current && activeConversationId) {
          isFirstExchangeRef.current = false;
          console.log('[Chat] First exchange complete, generating title...');
          // Use small delay to ensure messages are persisted
          setTimeout(() => {
            generateTitle(activeConversationId);
          }, 500);
        }
      } catch (err) {
        console.error('[Chat] Failed to persist AI response:', err);
      }
    },
    [addMessage, activeConversationId, generateTitle]
  );

  const { isStreaming, streamedContent, startStream, thinkingSteps } = useAIStream({
    onStreamDone: handleStreamDone,
    onStreamError: (err) => {
      console.error('[Chat] Stream error:', err);
      // Make the failure visible to the user by filling the last (AI placeholder) message.
      updateLastChatMessage?.(
        '⚠️ Nie udało się połączyć z AI. Sprawdź logi backendu i konsolę przeglądarki (Network/Console).'
      );
    },
  });

  // Keep latest UI messages in a ref so effects can read them without depending on the full array.
  useEffect(() => {
    activeChatMessagesRef.current = activeChatMessages;
  }, [activeChatMessages]);

  // Sync conversation-store messages into legacy chat UI state when user selects a conversation.
  // Important: do NOT sync while streaming, otherwise we would overwrite the streaming placeholder message.
  // Also: do NOT overwrite local UI with a partial backend list (prevents "nothing happens" when
  // backend persists only the user message but AI stream fails, which would remove the AI placeholder).
  useEffect(() => {
    if (isStreaming) return;
    if (!activeConversationId) return;

    const backendCount = (activeMessages || []).length;
    const uiCount = (activeChatMessagesRef.current || []).length;

    // If backend is behind UI, do not sync yet (avoid dropping UI-only placeholder/stream/error text).
    // We will sync once backend catches up (e.g. after AI response is persisted).
    if (backendCount > 0 && backendCount < uiCount) return;
    if (backendCount === 0 && uiCount > 0) return;

    const mapped = (activeMessages || []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.createdAt,
      citations: m.metadata?.citations,
      actions: m.metadata?.actions,
      options: m.metadata?.options,
      multiSelect: m.metadata?.multiSelect,
    })) as any;

    // Prevent infinite update loops:
    // - mapped is a new array/object every run, and setChatMessages updates activeChatMessages,
    //   which can re-trigger this effect if we depend on it.
    // We sync only when backend payload meaningfully changed.
    const sig =
      String(activeConversationId) +
      ':' +
      (activeMessages || [])
        .map((m) => `${m.id}|${m.role}|${String(m.content || '').length}`)
        .join(',');

    if (lastBackendSyncSigRef.current === sig) return;

    // If the UI already matches this payload, don't set again.
    const uiSig =
      String(activeConversationId) +
      ':' +
      (activeChatMessagesRef.current || [])
        .map((m) => `${m.id}|${m.role}|${String((m as any).content || '').length}`)
        .join(',');
    if (uiSig === sig) {
      lastBackendSyncSigRef.current = sig;
      return;
    }

    lastBackendSyncSigRef.current = sig;
    setChatMessages(mapped);
  }, [activeConversationId, activeMessages, isStreaming, setChatMessages]);

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
      ttsProvider: 'openai',
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
  const [aiMemoryContext, setAiMemoryContext] = useState<string | null>(null);
  const [coThinkerPhase, setCoThinkerPhase] = useState<string>('discovery');
  const [messageFeedback, setMessageFeedback] = useState<Record<string, MessageFeedback>>({});
  const lastSpokenContentRef = useRef<string>('');
  const isFirstExchangeRef = useRef<boolean>(true);

  // Get time-aware context
  const timeContext = useMemo(() => getTimeContext(), []);
  const firstName = currentUser?.firstName || '';

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

  // Speak AI responses in voice mode
  useEffect(() => {
    if (!voiceModeEnabled || !voiceSupported || isStreaming) return;

    const lastMessage = activeChatMessages[activeChatMessages.length - 1];
    if (lastMessage?.role === 'ai' && lastMessage.content) {
      const contentToSpeak = cleanTextForSpeech(lastMessage.content);

      // Only speak if it's new content
      if (contentToSpeak && contentToSpeak !== lastSpokenContentRef.current) {
        lastSpokenContentRef.current = contentToSpeak;
        speak(contentToSpeak);
      }
    }
  }, [activeChatMessages, voiceModeEnabled, voiceSupported, isStreaming, speak]);

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
        // Add feedback message to chat
        const feedbackMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'ai',
          content: `✅ ${result.result.message}`,
          timestamp: new Date(),
        };
        addChatMessage(feedbackMsg);
      }

      return result;
    },
    [executeAction, addChatMessage]
  );

  // Handle pending action confirmation
  const handleConfirmPendingAction = useCallback(
    async (actionId: string, confirmed: boolean) => {
      const result = await confirmAction(actionId, confirmed);

      if (result.status === 'success') {
        const feedbackMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'ai',
          content: confirmed ? '✅ Akcja wykonana pomyślnie.' : '❌ Akcja anulowana.',
          timestamp: new Date(),
        };
        addChatMessage(feedbackMsg);
      }
    },
    [confirmAction, addChatMessage]
  );

  // Handle sending a message
  const handleSend = useCallback(
    async (message: string) => {
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
          // Show error in chat so user knows what happened
          addChatMessage({
            id: Date.now().toString(),
            role: 'ai',
            content:
              '⚠️ Nie udało się utworzyć konwersacji. Sprawdź czy jesteś zalogowany i spróbuj ponownie.',
            timestamp: new Date(),
          });
          return;
        }
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: message.trim(),
        timestamp: new Date(),
      };

      // Add to legacy store for backwards compatibility
      addChatMessage(userMsg);

      // Also persist to conversation store (backend)
      try {
        await addMessage({
          conversationId: conversationId!,
          role: 'user',
          content: message.trim(),
          messageType: 'text',
        });
      } catch (err) {
        console.error('[Chat] Failed to persist user message:', err);
      }

      // Add placeholder AI message
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: '',
        timestamp: new Date(),
      };
      addChatMessage(aiMsg);

      // Build context
      // Important: `activeChatMessages` here does NOT yet include `userMsg`/`aiMsg` (state updates are async),
      // so we build history explicitly.
      const history = [...activeChatMessagesRef.current, userMsg].map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const fullContext = {
        ...screenContext,
        pmo: pmoContext,
        global: globalContext,
        isWelcomeScreen: activeMessages.length === 0,
        conversationId,
        conversationLanguage: chatLanguage,
      };

      // Harvard-Level Co-Thinker System Prompt
      let systemPrompt = `You are an elite Digital Transformation Consultant with a Harvard MBA and PhD, 20+ years of experience with McKinsey, BCG, and Fortune 500 companies.

YOUR PERSONA:
- Name: Senior Partner at DBR77 Industrial Intelligence
- Background: Harvard Business School MBA, MIT PhD in Digital Transformation
- Experience: Led 100+ transformation programs globally, €500M+ in value delivered
- Style: Socratic questioning, hypothesis-driven, executive-level communication

YOUR ROLE WITH ${currentUser?.firstName || 'the user'}:
You are their personal strategic co-thinker, not just an assistant. You:
1. ASK before assuming - use Socratic questions to understand deeply
2. GUIDE through methodology - Discovery → Assessment → Initiatives → Roadmap → Execution
3. CHALLENGE assumptions - respectfully probe weak arguments
4. EXECUTE on their behalf - create entities, fill forms, navigate when authorized
5. REMEMBER everything - maintain context across all conversations

CURRENT TRANSFORMATION PHASE: ${coThinkerPhase.toUpperCase()}
${coThinkerPhase === 'discovery' ? '→ Focus: Understanding goals, constraints, stakeholders' : ''}
${coThinkerPhase === 'assessment' ? '→ Focus: Evaluating digital maturity across axes' : ''}
${coThinkerPhase === 'initiatives' ? '→ Focus: Generating and prioritizing transformation initiatives' : ''}
${coThinkerPhase === 'roadmap' ? '→ Focus: Building timeline, dependencies, resource allocation' : ''}
${coThinkerPhase === 'execution' ? '→ Focus: Tracking progress, course correction, benefits realization' : ''}

COMMUNICATION RULES:
- Speak at executive level - concise, impactful, no fluff
- Use McKinsey SCQA structure for complex answers: Situation → Complication → Question → Answer
- Always provide: (1) Your perspective, (2) Supporting data, (3) Clear next action
- Conversation language: ${chatLanguage}. Respond in this language unless the user explicitly asks otherwise.

CONTEXT:
- User: ${currentUser?.firstName || 'User'} (${currentUser?.role || 'Stakeholder'})
- Organization: ${currentUser?.organizationName || 'Unknown'}
- Project: ${selectedProject?.name || 'General'}

ACTION CAPABILITIES:
You can execute actions on the user's behalf. When appropriate, respond with:
ACTION: {"type": "navigate|create_initiative|create_task|update_assessment", "payload": {...}}
`;

      // Append AI memory context if available
      if (aiMemoryContext) {
        systemPrompt += `\n${aiMemoryContext}\n`;
      }

      systemPrompt += `
Focus on practical recommendations for transformation initiatives, roadmaps, and organizational change.

MEMORY INSTRUCTIONS:
If the user explicitly asks you to remember something, include a line in your response:
REMEMBER: [key]: [value]
For example: REMEMBER: preferred_language: Polish`;

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
      addChatMessage,
      addMessage,
      startStream,
      screenContext,
      pmoContext,
      globalContext,
      activeMessages.length,
      aiMemoryContext,
    ]
  );

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
              // Add the brief as an AI message directly
              const briefMsg: ChatMessage = {
                id: Date.now().toString(),
                role: 'ai',
                content: data.brief?.textVersion || 'Nie udało się wygenerować briefu.',
                timestamp: new Date(),
              };
              addChatMessage(briefMsg);
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
    [handleSend, selectedProject, addChatMessage]
  );

  // Handle new chat
  const handleNewChat = useCallback(() => {
    // Clear both stores - conversation store (backend) and app store (UI)
    clearActiveChat();
    clearChat();
    // Reset first exchange flag for title generation
    isFirstExchangeRef.current = true;
  }, [clearActiveChat, clearChat]);

  // Handle export
  const handleExport = useCallback(() => {
    setShowExportModal(true);
  }, []);

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
        const briefMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'ai',
          content: data.brief?.textVersion || 'Nie udało się wygenerować briefu.',
          timestamp: new Date(),
        };
        addChatMessage(briefMsg);
      }
    } catch (err) {
      console.error('[DailyBrief] Error:', err);
    }
  }, [selectedProject, addChatMessage]);

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
  const currentThinkingLabel =
    thinkingSteps.find((s) => s.status === 'in_progress')?.label ||
    thinkingSteps.find((s) => s.status === 'pending')?.label ||
    '';

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
      <div className="h-full w-full bg-slate-50 dark:bg-navy-950 overflow-hidden relative">
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleSidebar()}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
                title={t('aiChat.openSidebar', 'Open Sidebar')}
              >
                <PanelLeft size={20} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-8">
              {activeChatMessages.map((msg, index) => {
                const isLastMessage = index === activeChatMessages.length - 1;
                const isAiMessage = msg.role === 'ai';
                const isStreamingThis = isStreaming && isLastMessage && isAiMessage;

                const displayContent = isStreamingThis ? streamedContent : msg.content;

                if (isAiMessage && !displayContent && !isStreamingThis) {
                  return null;
                }

                return (
                  <div key={msg.id} className={`mb-6 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    {/* Thinking Block - 5-step progress (visible during streaming) */}
                    {isAiMessage && isStreamingThis && thinkingSteps.length > 0 && (
                      <div className="mb-2 max-w-[85%]">
                        <ThinkingBlock
                          steps={thinkingSteps}
                          isStreaming={true}
                          defaultExpanded={!displayContent}
                        />
                      </div>
                    )}

                    <div
                      className={`inline-block max-w-[85%] ${
                        msg.role === 'user'
                          ? 'bg-primary-600 text-white rounded-xl rounded-br-md px-4 py-3'
                          : 'text-navy-900 dark:text-slate-200'
                      }`}
                    >
                      <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
                        {/* Cursor-like thinking indicator - inline label while thinking */}
                        <ThinkingStatusLine
                          label={currentThinkingLabel || t('thinking.processing', 'Thinking…')}
                          className="mb-2"
                          show={isStreamingThis && thinkingSteps.length > 0}
                        />
                        {displayContent}
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

                      {/* Voice Mode Indicator */}
                      {isAiMessage && !isStreamingThis && voiceModeEnabled && voiceSupported && (
                        <button
                          onClick={() => speak(cleanTextForSpeech(displayContent))}
                          className="mt-2 text-xs text-slate-400 dark:text-slate-500 hover:text-primary-500 flex items-center gap-1"
                          title="Odtwórz głosowo"
                        >
                          🔊 Odtwórz
                        </button>
                      )}
                    </div>

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
                          onSpeak={
                            voiceSupported
                              ? (content) => speak(cleanTextForSpeech(content))
                              : undefined
                          }
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
              <div className="max-w-3xl mx-auto">
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
              <div className="max-w-3xl mx-auto flex items-center justify-center gap-3 text-sm">
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
            <div className="max-w-3xl mx-auto">
              <EnhancedChatInput
                onSend={handleSend}
                disabled={isStreaming || isActionExecuting}
                placeholder={t('aiChat.placeholder', 'Start a transformation...')}
                voiceModeEnabled={voiceModeEnabled}
                onVoiceModeChange={handleVoiceModeChange}
                voiceState={voiceState}
                startVoiceListening={startListening}
                stopVoiceListening={stopListening}
              />
            </div>
          </div>
        </div>

        {/* Export Modal */}
        <ChatExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />
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
        <div className="shrink-0 h-14 flex items-center px-4 justify-start absolute top-0 left-0 right-0 z-10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleSidebar()}
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
              title={t('aiChat.openSidebar', 'Open Sidebar')}
            >
              <PanelLeft size={20} />
            </button>
          </div>
        </div>

        {/* Centered Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Personalized Greeting */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-semibold text-navy-900 dark:text-white">
              {t(`aiChat.greeting.${timeContext.greetingKey}`, timeContext.greetingFallback)}
              {firstName && <span className="text-primary-600">, {firstName}</span>}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-4 text-lg">
              {t(`aiChat.${timeContext.subtitleKey}`, timeContext.subtitleFallback)}
            </p>
          </div>

          {/* Chat Input */}
          <div className="w-full max-w-2xl">
            <EnhancedChatInput
              onSend={handleSend}
              disabled={isStreaming}
              placeholder={t('aiChat.placeholder', 'Ask anything...')}
              voiceModeEnabled={voiceModeEnabled}
              onVoiceModeChange={handleVoiceModeChange}
            />
          </div>

          {/* Minimal Suggestions */}
          <div className="w-full max-w-2xl mt-6">
            <SmartSuggestions
              projectId={selectedProject?.id}
              onSuggestionClick={handleSuggestionClick}
              variant="minimal"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4">
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 tracking-[0.25em] uppercase">
            DBR77 Industrial Intelligence
          </p>
        </div>
      </div>

      {/* Export Modal */}
      <ChatExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />

      {/* TTS Indicator - shows when speaking */}
      <TTSIndicator />
    </div>
  );
};

export default AIChatWelcomeView;
