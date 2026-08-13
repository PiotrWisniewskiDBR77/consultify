import {
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  FileCode,
  HelpCircle,
  Mic,
  MicOff,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Square as StopIcon,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  Volume2,
  VolumeX,
  Wrench,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useUniversalVoice } from '../../hooks/useUniversalVoice';
import { useAppStore } from '../../store/useAppStore';
import { useArtifactsStore } from '../../store/useArtifactsStore';
import { useConversationStore } from '../../store/useConversationStore';
import {
  Artifact,
  ChatMessage,
  ChatOption,
  MessageFeedback,
  ResponseFeedback,
  ToolCallInfo,
} from '../../types';
import { CitationList } from '../AIChat/CitationList';
import { EnhancedChatInput } from '../AIChat/EnhancedChatInput';
import { InlineResponseFeedback } from '../AIChat/InlineResponseFeedback';
import { ThinkingBlock } from '../AIChat/Messages/ThinkingBlock';
import { AIFeedbackButton } from '../AIFeedbackButton';
import TeresaMark from '../shared/TeresaMark';
// Tool Call Card Component for displaying MCP tool executions
const ToolCallCard: React.FC<{ tool: ToolCallInfo }> = ({ tool }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const statusIcon = () => {
    switch (tool.status) {
      case 'executed':
        return <CheckCircle size={14} className="text-green-500" />;
      case 'approved':
        return <Check size={14} className="text-blue-500" />;
      case 'rejected':
        return <XCircle size={14} className="text-danger-500" />;
      case 'pending':
      default:
        return <Clock size={14} className="text-amber-500 animate-pulse" />;
    }
  };

  const statusColor = () => {
    switch (tool.status) {
      case 'executed':
        return 'border-green-500/30 bg-green-500/10';
      case 'approved':
        return 'border-blue-500/30 bg-blue-500/10';
      case 'rejected':
        return 'border-danger-500/30 bg-danger-500/10';
      case 'pending':
      default:
        return 'border-amber-500/30 bg-amber-500/10';
    }
  };

  return (
    <div className={`rounded-lg border ${statusColor()} p-3 text-xs`}>
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Wrench size={14} className="text-slate-500 dark:text-slate-400" />
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {tool.name.replace(/_/g, ' ')}
          </span>
          {statusIcon()}
        </div>
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          <div>
            <span className="text-slate-500 dark:text-slate-400">Arguments:</span>
            <pre className="mt-1 p-2 bg-slate-50 dark:bg-navy-900 rounded text-[10px] overflow-x-auto">
              {JSON.stringify(tool.args, null, 2)}
            </pre>
          </div>
          {tool.result != null && (
            <div>
              <span className="text-slate-500 dark:text-slate-400">Result:</span>
              <pre className="mt-1 p-2 bg-slate-50 dark:bg-navy-900 rounded text-[10px] overflow-x-auto">
                {typeof tool.result === 'string'
                  ? tool.result
                  : JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onOptionSelect: (option: ChatOption, isMultiSelect?: boolean) => void;
  onMultiSelectSubmit?: (selectedOptions: string[]) => void;
  isTyping: boolean;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Enable automatic voice readback of AI responses */
  enableVoice?: boolean;
  /** Callback when voice readback should trigger (AI response complete) */
  onVoiceRead?: (text: string) => void;
  /** Callback when user wants to edit a message */
  onEditMessage?: (messageId: string, newContent: string) => void;
  /** Callback when user wants to delete a message */
  onDeleteMessage?: (messageId: string) => void;
  /** Callback when user wants to regenerate AI response */
  onRegenerateMessage?: (messageId: string) => void;
  /** Callback for message feedback */
  onMessageFeedback?: (messageId: string, feedback: MessageFeedback) => void;
  /** Enable enhanced message rendering with artifacts and thinking */
  enableEnhancedMessages?: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  onOptionSelect,
  onMultiSelectSubmit,
  isTyping,
  title,
  subtitle,
  enableVoice: externalVoiceEnabled,
  onVoiceRead,
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
  onMessageFeedback,
  enableEnhancedMessages = true,
}) => {
  const { t, i18n } = useTranslation();
  const { aiFreezeStatus, editChatMessage, deleteChatMessage, setMessageFeedback } = useAppStore();
  const { addArtifact, togglePanel } = useArtifactsStore();
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const displayTitle = title || t('chat.header');
  const displaySubtitle = subtitle || t('chat.subHeader');
  const [inputValue, setInputValue] = useState('');
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([]);
  const { activeConversationId: conversationId } = useConversationStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Universal Voice System
  const {
    state: voiceState,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    isSupported: voiceSupported,
  } = useUniversalVoice({
    onSendMessage: async (text) => onSendMessage(text),
    settings: {
      autoSpeakResponses: true,
      sttProvider: 'whisper',
      ttsProvider: 'openai',
      language: (i18n.language as any) || 'pl',
    },
  });

  const speechSupported = voiceSupported;
  const isRecording = Boolean((voiceState as any)?.isListening);
  const toggleRecording = () => (isRecording ? stopListening() : startListening());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || aiFreezeStatus.isFrozen) return;
    onSendMessage(text);
    setInputValue('');
  };

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const toggleVoice = () => setVoiceEnabled(!voiceEnabled);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Auto-read AI responses when voice is enabled
  useEffect(() => {
    if (!voiceEnabled || !voiceSupported || isTyping) return;

    // Find the last AI message that isn't currently streaming
    const lastAIMessage = [...messages]
      .reverse()
      .find((msg) => msg.role === 'ai' && msg.id !== 'stream');

    if (lastAIMessage && lastAIMessage.id !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastAIMessage.id;
      speak(lastAIMessage.content);
    }
  }, [messages, voiceEnabled, voiceSupported, isTyping, speak]);

  // Speech Recognition logic removed in favor of Universal Voice PTT

  const handleMultiSelectToggle = (value: string) => {
    if (selectedMultiOptions.includes(value)) {
      setSelectedMultiOptions((prev) => prev.filter((item) => item !== value));
    } else {
      if (selectedMultiOptions.length < 2) {
        // Max 2 as per requirements
        setSelectedMultiOptions((prev) => [...prev, value]);
      }
    }
  };

  const handleMultiSelectConfirm = () => {
    if (onMultiSelectSubmit && selectedMultiOptions.length > 0) {
      onMultiSelectSubmit(selectedMultiOptions);
      setSelectedMultiOptions([]); // Reset for next time
    }
  };

  // World-Class Chat 2025: Message action handlers
  const handleCopyMessage = useCallback(async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  }, []);

  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (onEditMessage) {
        onEditMessage(messageId, newContent);
      } else {
        editChatMessage(messageId, newContent);
      }
    },
    [onEditMessage, editChatMessage]
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (onDeleteMessage) {
        onDeleteMessage(messageId);
      } else {
        deleteChatMessage(messageId);
      }
    },
    [onDeleteMessage, deleteChatMessage]
  );

  const handleRegenerateMessage = useCallback(
    (messageId: string) => {
      if (onRegenerateMessage) {
        onRegenerateMessage(messageId);
      }
    },
    [onRegenerateMessage]
  );

  const handleMessageFeedback = useCallback(
    (messageId: string, rating: 'positive' | 'negative') => {
      const feedback: MessageFeedback = { rating, timestamp: new Date() };
      if (onMessageFeedback) {
        onMessageFeedback(messageId, feedback);
      } else {
        setMessageFeedback(messageId, feedback);
      }
    },
    [onMessageFeedback, setMessageFeedback]
  );

  // Handle detailed response feedback (Adaptive Response System)
  const handleResponseFeedback = useCallback(
    async (messageId: string, feedback: ResponseFeedback) => {
      try {
        const response = await fetch('/api/ai-feedback/response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId,
            conversationId,
            ...feedback,
          }),
        });

        if (response.ok) {
          // Also update local message feedback state for quick visual indicator
          const simpleFeedback: MessageFeedback = {
            rating:
              feedback.rating === 'positive'
                ? 'positive'
                : feedback.rating === 'negative'
                  ? 'negative'
                  : 'positive',
            timestamp: new Date(),
          };
          if (onMessageFeedback) {
            onMessageFeedback(messageId, simpleFeedback);
          } else {
            setMessageFeedback(messageId, simpleFeedback);
          }
        }
      } catch (error) {
        console.error('Failed to submit response feedback:', error);
      }
    },
    [conversationId, onMessageFeedback, setMessageFeedback]
  );

  const handleViewArtifacts = useCallback(
    (artifacts: Artifact[]) => {
      artifacts.forEach((artifact) => addArtifact(artifact));
      togglePanel(true);
    },
    [addArtifact, togglePanel]
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-900 shadow-sm relative">
      {/* Chat Header */}
      <div className="pl-4 pr-14 py-3 border-b border-slate-200 dark:border-navy-800 flex justify-between items-center bg-slate-50/80 dark:bg-navy-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h2 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide uppercase">
            {displayTitle}
          </h2>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{displaySubtitle}</p>
        </div>
        {/* Voice Toggle Button */}
        {voiceSupported && i18n.language && (
          <button
            onClick={toggleVoice}
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs ${
              voiceEnabled
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
            }`}
            title={voiceEnabled ? 'Wyłącz głos AI' : 'Włącz głos AI'}
          >
            {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span className="hidden sm:inline">{voiceEnabled ? 'Głos ON' : 'Głos OFF'}</span>
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => {
          const isLastMessage = index === messages.length - 1;
          const isHovered = hoveredMessageId === msg.id;
          const hasArtifacts = msg.artifacts && msg.artifacts.length > 0;
          const hasThinkingSteps = msg.thinkingSteps && msg.thinkingSteps.length > 0;
          const hasCitations = msg.citations && msg.citations.length > 0;
          const isCopied = copiedMessageId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col space-y-1.5 group ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              onMouseEnter={() => setHoveredMessageId(msg.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
            >
              {/* Thinking Steps (for AI messages) */}
              {enableEnhancedMessages && msg.role === 'ai' && hasThinkingSteps && (
                <div className="w-full max-w-[85%] ml-9">
                  <ThinkingBlock
                    steps={msg.thinkingSteps!}
                    isStreaming={msg.isStreaming || msg.isThinking}
                  />
                </div>
              )}

              <div
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === 'ai' ? 'bg-primary-500/10' : 'bg-slate-200/60 dark:bg-white/[0.06]'
                  }`}
                >
                  {msg.role === 'ai' ? (
                    <TeresaMark size={14} strokeWidth={1.75} className="text-primary-500" />
                  ) : (
                    <User size={14} strokeWidth={1.75} className="text-slate-600" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`relative max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-navy-900 text-white rounded-tr-sm'
                      : 'bg-slate-50 dark:bg-navy-800/60 text-slate-700 dark:text-slate-200 rounded-tl-sm'
                  }`}
                >
                  {/* AI Message Header */}
                  {enableEnhancedMessages && msg.role === 'ai' && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-primary-600 dark:text-primary-400 flex items-center gap-1">
                        <Sparkles size={14} />
                        {t('chat.aiAssistant', 'AI Assistant')}
                      </span>
                      {msg.focusMode && (
                        <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-navy-700 rounded text-[10px]">
                          {msg.focusMode}
                        </span>
                      )}
                      {msg.regenerateCount && msg.regenerateCount > 0 && (
                        <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded text-[10px]">
                          {t('chat.regenerated', 'Regenerated')} {msg.regenerateCount}x
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message Content - Enhanced for AI */}
                  {enableEnhancedMessages && msg.role === 'ai' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
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
                              <pre className="bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100 p-3 rounded-lg overflow-x-auto text-xs my-2">
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
                    </div>
                  ) : (
                    <span>{msg.content}</span>
                  )}

                  {/* Streaming indicator */}
                  {msg.isStreaming && (
                    <span className="inline-flex items-center gap-1 ml-2">
                      <span
                        className="w-1.5 h-1.5 bg-navy-900 rounded-full animate-bounce dark:bg-white"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-navy-900 rounded-full animate-bounce dark:bg-white"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-navy-900 rounded-full animate-bounce dark:bg-white"
                        style={{ animationDelay: '300ms' }}
                      />
                    </span>
                  )}

                  {/* Hover Actions */}
                  {enableEnhancedMessages && isHovered && !msg.isStreaming && (
                    <div
                      className={`absolute ${msg.role === 'user' ? '-left-2 -translate-x-full' : '-right-2 translate-x-full'} top-0 flex items-center gap-0.5 bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200/60 dark:border-white/[0.08] p-0.5`}
                    >
                      {/* Copy */}
                      <button
                        onClick={() => handleCopyMessage(msg.content, msg.id)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700"
                        title={t('chat.actions.copy', 'Copy')}
                      >
                        {isCopied ? (
                          <CheckCircle size={14} className="text-green-500" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>

                      {/* Regenerate (AI only) */}
                      {msg.role === 'ai' && onRegenerateMessage && (
                        <button
                          onClick={() => handleRegenerateMessage(msg.id)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700"
                          title={t('chat.actions.regenerate', 'Regenerate')}
                        >
                          <RefreshCw size={14} />
                        </button>
                      )}

                      {/* Quick Feedback Buttons (AI only, compact mode in toolbar) */}
                      {msg.role === 'ai' && !msg.feedback && (
                        <>
                          <button
                            onClick={() => handleMessageFeedback(msg.id, 'positive')}
                            className="p-1.5 rounded-md text-slate-500 hover:text-green-600 dark:text-slate-400 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                            title={t('chat.actions.helpful', 'Helpful')}
                          >
                            <ThumbsUp size={14} />
                          </button>
                          <button
                            onClick={() => handleMessageFeedback(msg.id, 'negative')}
                            className="p-1.5 rounded-md text-slate-500 hover:text-danger-600 dark:text-slate-400 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                            title={t('chat.actions.notHelpful', 'Not helpful')}
                          >
                            <ThumbsDown size={14} />
                          </button>
                        </>
                      )}

                      {/* View Artifacts (AI only) */}
                      {msg.role === 'ai' && hasArtifacts && (
                        <button
                          onClick={() => handleViewArtifacts(msg.artifacts!)}
                          className="p-1.5 rounded-md text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                          title={t('chat.actions.viewArtifacts', 'View Artifacts')}
                        >
                          <FileCode size={14} />
                        </button>
                      )}

                      {/* Delete (user messages) */}
                      {msg.role === 'user' && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-danger-600 dark:text-slate-400 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                          title={t('chat.actions.delete', 'Delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}

                      {/* Speak */}
                      {voiceSupported && msg.role === 'ai' && (
                        <button
                          onClick={() =>
                            voiceState.isSpeaking ? stopSpeaking() : speak(msg.content)
                          }
                          className={`p-1.5 rounded-md ${voiceState.isSpeaking ? 'text-danger-500 hover:text-danger-600' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'} hover:bg-slate-100 dark:hover:bg-navy-700`}
                          title={
                            voiceState.isSpeaking
                              ? t('chat.actions.stop', 'Stop')
                              : t('chat.actions.speak', 'Speak')
                          }
                        >
                          {voiceState.isSpeaking ? <Square size={14} /> : <Volume2 size={14} />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Tool Calls Display */}
              {msg.role === 'ai' && msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="ml-9 mt-2 space-y-2">
                  {msg.toolCalls.map((tool, idx) => (
                    <ToolCallCard key={`${msg.id}-tool-${idx}`} tool={tool} />
                  ))}
                </div>
              )}

              {/* Thinking Indicator for MAX Mode */}
              {msg.role === 'ai' && msg.isThinking && (
                <div className="ml-9 mt-2 flex items-center gap-2 text-xs text-primary-500 dark:text-primary-400">
                  <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
                  <span>Deep reasoning in progress...</span>
                </div>
              )}

              {/* Artifacts Badge */}
              {enableEnhancedMessages && msg.role === 'ai' && hasArtifacts && (
                <button
                  onClick={() => handleViewArtifacts(msg.artifacts!)}
                  className="ml-9 flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg text-xs font-medium transition-colors"
                >
                  <FileCode size={14} />
                  {msg.artifacts!.length}{' '}
                  {msg.artifacts!.length === 1
                    ? t('chat.artifact', 'artifact')
                    : t('chat.artifacts', 'artifacts')}
                </button>
              )}

              {/* Citations */}
              {enableEnhancedMessages && msg.role === 'ai' && hasCitations && (
                <div className="ml-9 mt-2">
                  <CitationList citations={msg.citations!} />
                </div>
              )}

              {/* Feedback indicator if already given */}
              {enableEnhancedMessages && msg.feedback && (
                <div className="ml-9 mt-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                      msg.feedback.rating === 'positive'
                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-danger-100 text-danger-600 dark:bg-danger-900/30 dark:text-danger-400'
                    }`}
                  >
                    {msg.feedback.rating === 'positive' ? (
                      <ThumbsUp size={14} />
                    ) : (
                      <ThumbsDown size={14} />
                    )}
                    {msg.feedback.rating === 'positive'
                      ? t('chat.markedHelpful', 'Marked as helpful')
                      : t('chat.markedNotHelpful', 'Marked as not helpful')}
                  </span>
                </div>
              )}

              {/* Inline Response Feedback (AI messages without existing feedback) */}
              {enableEnhancedMessages &&
                msg.role === 'ai' &&
                !msg.feedback &&
                !msg.isStreaming &&
                msg.id !== 'stream' && (
                  <div className="ml-9 mt-1">
                    <InlineResponseFeedback
                      messageId={msg.id}
                      conversationId={conversationId || undefined}
                      responseMode={msg.metadata?.responseMode as any}
                      responseLength={msg.content?.length}
                      onFeedback={(feedback) => handleResponseFeedback(msg.id, feedback)}
                    />
                  </div>
                )}

              {/* Legacy Message Actions (kept for backward compatibility) */}
              {!enableEnhancedMessages && msg.role === 'ai' && msg.id !== 'stream' && (
                <div className="ml-9 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <AIFeedbackButton context="chat" data={msg.content} />
                  {/* Read aloud button */}
                  {voiceSupported && (
                    <button
                      onClick={() => (voiceState.isSpeaking ? stopSpeaking() : speak(msg.content))}
                      className={`p-1.5 rounded-md transition-all ${
                        voiceState.isSpeaking
                          ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400'
                          : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
                      }`}
                      title={voiceState.isSpeaking ? 'Zatrzymaj' : 'Przeczytaj'}
                    >
                      {voiceState.isSpeaking ? <Square size={14} /> : <Volume2 size={14} />}
                    </button>
                  )}
                </div>
              )}

              {/* Interactive Options (Only show for AI and if options exist) */}
              {msg.role === 'ai' && msg.options && (
                <div
                  className={`ml-9 flex flex-wrap gap-2 ${isLastMessage ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}
                >
                  {msg.multiSelect ? (
                    // Multi-select Mode
                    <div className="flex flex-col gap-2 w-full max-w-md">
                      <div className="flex flex-wrap gap-1.5">
                        {msg.options.map((option) => {
                          const isSelected = selectedMultiOptions.includes(option.value);
                          return (
                            <button
                              key={option.id}
                              onClick={() => handleMultiSelectToggle(option.value)}
                              className={`px-3 py-1.5 text-xs rounded-full border transition-all flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-primary-100 dark:bg-primary-600/20 border-primary-300 dark:border-primary-500 text-primary-700 dark:text-primary-200'
                                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 hover:border-slate-300 dark:hover:border-white/20'
                              }`}
                            >
                              {option.label}
                              {isSelected && <Check size={14} />}
                            </button>
                          );
                        })}
                      </div>
                      {isLastMessage && selectedMultiOptions.length > 0 && (
                        <button
                          onClick={handleMultiSelectConfirm}
                          className="self-start btn-primary px-4 py-1.5 text-xs font-medium rounded-md"
                        >
                          Confirm Selection
                        </button>
                      )}
                    </div>
                  ) : (
                    // Single Select Mode
                    msg.options.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => onOptionSelect(option)}
                        className="px-3 py-1.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 text-xs rounded-full hover:bg-primary-50 dark:hover:bg-primary-600/10 hover:border-primary-300 dark:hover:border-primary-500 hover:text-primary-700 dark:hover:text-primary-300 transition-all text-left"
                      >
                        {option.label}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isTyping && (
          <div className="flex gap-3 justify-start">
            <div className="w-6 h-6 rounded-full bg-primary-50 dark:bg-primary-900/50 border border-primary-200 dark:border-primary-700 flex items-center justify-center shrink-0 mt-0.5">
              <TeresaMark size={14} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl rounded-tl-none px-4 py-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-100"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={aiFreezeStatus.isFrozen}
              placeholder={
                aiFreezeStatus.isFrozen
                  ? 'AI RESTRICTED (Budget Exhausted)'
                  : isRecording
                    ? 'Listening...'
                    : 'Type your answer...'
              }
              className={`w-full bg-slate-50 dark:bg-navy-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 pr-10 text-sm border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all ${aiFreezeStatus.isFrozen ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-navy-950' : ''} ${isRecording ? 'border-danger-400 ring-1 ring-danger-400 animate-pulse' : ''}`}
            />
            {isRecording && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-danger-500"></span>
                </span>
              </div>
            )}
          </div>

          {/* Microphone Button - always visible */}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={aiFreezeStatus.isFrozen || !speechSupported}
            className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${
              isRecording
                ? 'bg-danger-500 text-white hover:bg-danger-600 shadow-md shadow-danger-500/30'
                : speechSupported
                  ? 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700 hover:text-slate-700 dark:hover:text-slate-200'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 cursor-not-allowed'
            } ${aiFreezeStatus.isFrozen ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={
              !speechSupported
                ? 'Voice input not supported in this browser'
                : isRecording
                  ? 'Stop recording'
                  : 'Start voice input'
            }
          >
            {isRecording ? <Square size={16} /> : <Mic size={16} />}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={aiFreezeStatus.isFrozen || !inputValue.trim()}
            className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${
              inputValue.trim()
                ? 'bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 shadow-md shadow-primary-500/30'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-500'
            } ${aiFreezeStatus.isFrozen ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Send message"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
