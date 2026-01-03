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
 * - Full keyboard accessibility
 * - Responsive design
 * 
 * @version 1.0.0
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Bot, 
    User, 
    MessageSquare, 
    History, 
    Maximize2, 
    Minimize2,
    ChevronLeft,
    Sparkles,
    RefreshCw,
    Copy,
    Check,
    ThumbsUp,
    ThumbsDown,
    Volume2,
    FileCode
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useAppStore } from '../../store/useAppStore';
import { useConversationStore, ConversationMessage } from '../../store/useConversationStore';
import { useArtifactsStore } from '../../store/useArtifactsStore';
import { useAIStream } from '../../hooks/useAIStream';
import { useVoiceChat } from '../../hooks/useVoiceChat';

import { EnhancedChatInput } from './EnhancedChatInput';
import { FocusModeSelector } from './Input/FocusModeSelector';
import { ChatSlidingPanel } from './ChatSlidingPanel';
import { ThinkingBlock } from './Messages/ThinkingBlock';
import { CitationList } from './CitationList';
import { InlineResponseFeedback } from './InlineResponseFeedback';

import { FocusMode, ChatMessage, ThinkingStep, Artifact, AppView, ResponseFeedback } from '../../types';
import { ChatDisplayMode, WorkspaceContext } from '../../types/workspace';

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
    onMessageSent
}) => {
    const { t } = useTranslation();
    
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
        aiFreezeStatus
    } = useAppStore();
    
    const {
        activeConversationId,
        activeMessages,
        displayMode,
        createConversation,
        addMessage: addMessageToConversation,
        setActiveConversation,
        fetchConversation,
        clearActiveChat,
        setDisplayMode,
        expandToFullScreen,
        collapseToSplit
    } = useConversationStore();
    
    const { addArtifact, togglePanel: toggleArtifactsPanel } = useArtifactsStore();
    const { speak, stopSpeaking, isSpeaking, voiceEnabled, ttsSupported } = useVoiceChat();
    
    // ========================================================================
    // Local state
    // ========================================================================
    
    const [focusMode, setFocusMode] = useState<FocusMode>('all');
    const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
    const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
    
    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    
    // Computed values
    const isSplitMode = mode === 'split' || displayMode === 'split';
    const isCompact = isSplitMode;
    const isDisabled = disabled || aiFreezeStatus.isFrozen;
    
    // ========================================================================
    // AI Stream hook
    // ========================================================================
    
    const { startStream, isStreaming, streamedContent } = useAIStream({
        onStreamDone: async (fullText, thinking, artifacts) => {
            // Save AI response to conversation store
            if (activeConversationId) {
                try {
                    await addMessageToConversation({
                        conversationId: activeConversationId,
                        role: 'ai',
                        content: fullText,
                        messageType: 'text',
                        metadata: {
                            thinkingSteps: thinking,
                            artifacts
                        }
                    });
                } catch (err) {
                    console.error('[UnifiedChatPanel] Failed to save AI message:', err);
                }
            }
            
            // Also update useAppStore for backward compatibility
            addChatMessage({
                id: `ai-${Date.now()}`,
                role: 'ai',
                content: fullText,
                timestamp: new Date(),
                thinkingSteps: thinking,
                artifacts
            });
            
            setThinkingSteps([]);
        },
        onThinkingUpdate: (steps) => {
            setThinkingSteps(steps);
        },
        onArtifactDetected: (artifact) => {
            addArtifact(artifact);
        }
    });
    
    // ========================================================================
    // Convert conversation messages to ChatMessage format
    // ========================================================================
    
    const messages: ChatMessage[] = useMemo(() => {
        return activeMessages.map(msg => ({
            id: msg.id,
            role: msg.role === 'ai' ? 'ai' : 'user',
            content: msg.content,
            timestamp: msg.createdAt,
            thinkingSteps: msg.metadata?.thinkingSteps,
            artifacts: msg.metadata?.artifacts,
            citations: msg.metadata?.citations,
            isStreaming: false
        }));
    }, [activeMessages]);
    
    // Add streaming message if actively streaming
    const displayMessages = useMemo(() => {
        if (isStreaming && streamedContent) {
            return [
                ...messages,
                {
                    id: 'stream',
                    role: 'ai' as const,
                    content: streamedContent,
                    timestamp: new Date(),
                    isStreaming: true,
                    thinkingSteps: thinkingSteps.length > 0 ? thinkingSteps : undefined
                }
            ];
        }
        return messages;
    }, [messages, isStreaming, streamedContent, thinkingSteps]);
    
    // ========================================================================
    // Scroll to bottom on new messages
    // ========================================================================
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [displayMessages, isStreaming]);
    
    // ========================================================================
    // Handlers
    // ========================================================================
    
    const handleSendMessage = useCallback(async (content: string, attachments?: any[]) => {
        if (!content.trim() || isDisabled) return;
        
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
                    messageType: 'text'
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
            timestamp: new Date()
        };
        addChatMessage(userMessage);
        
        // Build context for AI
        const context = {
            focusMode,
            attachments,
            workspaceContext,
            conversationId
        };
        
        // Add placeholder for AI response in useAppStore
        const aiPlaceholder: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: 'ai',
            content: '',
            timestamp: new Date(),
            isStreaming: true
        };
        addChatMessage(aiPlaceholder);
        
        // Start streaming
        const history = displayMessages.map(m => ({
            role: m.role,
            content: m.content
        }));
        
        await startStream(content, history, undefined, context, focusMode);
        
        // Callback
        onMessageSent?.(content);
    }, [
        activeConversationId,
        createConversation,
        addMessageToConversation,
        addChatMessage,
        displayMessages,
        focusMode,
        workspaceContext,
        startStream,
        isDisabled,
        onMessageSent
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
    
    const handleSelectConversation = useCallback((id: string) => {
        setActiveConversation(id);
    }, [setActiveConversation]);
    
    const handleCopyMessage = useCallback(async (content: string, messageId: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000);
        } catch (err) {
            console.error('Failed to copy message:', err);
        }
    }, []);
    
    const handleModeToggle = useCallback(() => {
        if (isSplitMode) {
            expandToFullScreen();
        } else {
            collapseToSplit();
        }
        onModeToggle?.();
    }, [isSplitMode, expandToFullScreen, collapseToSplit, onModeToggle]);
    
    const handleViewArtifacts = useCallback((artifacts: Artifact[]) => {
        artifacts.forEach(artifact => addArtifact(artifact));
        toggleArtifactsPanel(true);
    }, [addArtifact, toggleArtifactsPanel]);
    
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
                        />
                    </div>
                )}
                
                <div className={`flex gap-2 ${isCompact ? 'gap-2' : 'gap-3'} ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                        msg.role === 'ai'
                            ? 'bg-primary-50 dark:bg-primary-900/50 border-primary-200 dark:border-primary-700'
                            : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                    }`}>
                        {msg.role === 'ai' 
                            ? <Bot size={isCompact ? 12 : 14} className="text-primary-600 dark:text-primary-400" /> 
                            : <User size={isCompact ? 12 : 14} className="text-slate-400 dark:text-slate-300" />
                        }
                    </div>
                    
                    {/* Message Bubble */}
                    <div className={`relative max-w-[85%] rounded-2xl px-3 py-2 ${isCompact ? 'text-xs' : 'text-sm'} leading-relaxed shadow-sm ${
                        msg.role === 'user'
                            ? 'bg-primary-600 text-white rounded-tr-none'
                            : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-navy-700 rounded-tl-none'
                    }`}>
                        {/* AI Message Content */}
                        {msg.role === 'ai' ? (
                            <div className={`prose ${isCompact ? 'prose-xs' : 'prose-sm'} dark:prose-invert max-w-none`}>
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
                                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 underline">
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
                                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                        )}
                        
                        {/* Hover Actions */}
                        {isHovered && !msg.isStreaming && (
                            <div className={`absolute ${msg.role === 'user' ? '-left-2 -translate-x-full' : '-right-2 translate-x-full'} top-0 flex items-center gap-0.5 bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 p-1`}>
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
                                {ttsSupported && msg.role === 'ai' && (
                                    <button
                                        onClick={() => isSpeaking ? stopSpeaking() : speak(msg.content)}
                                        className={`p-1 rounded-md ${isSpeaking ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'} hover:bg-slate-100 dark:hover:bg-navy-700`}
                                        title={isSpeaking ? t('chat.actions.stop', 'Stop') : t('chat.actions.speak', 'Speak')}
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
                        {msg.artifacts!.length} {msg.artifacts!.length === 1 ? t('chat.artifact', 'artifact') : t('chat.artifacts', 'artifacts')}
                    </button>
                )}
                
                {/* Citations */}
                {msg.role === 'ai' && hasCitations && (
                    <div className={`${isCompact ? 'ml-7' : 'ml-9'} mt-1`}>
                        <CitationList citations={msg.citations!} />
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
            {/* Header */}
            <div className={`flex items-center justify-between ${isCompact ? 'px-3 py-2' : 'px-4 py-3'} border-b border-slate-200 dark:border-navy-800 bg-white/50 dark:bg-navy-950/50 backdrop-blur-sm`}>
                <div className="flex items-center gap-2">
                    {/* Back button (split mode) */}
                    {isSplitMode && onBack && (
                        <button
                            onClick={onBack}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
                            title={t('common.back', 'Back')}
                        >
                            <ChevronLeft size={18} />
                        </button>
                    )}
                    
                    {/* History toggle */}
                    {showHistoryTrigger && (
                        <button
                            onClick={() => setChatSlidingPanelOpen(!isChatSlidingPanelOpen)}
                            data-chat-toggle
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
                            title={t('aiChat.history', 'History')}
                        >
                            <History size={18} />
                        </button>
                    )}
                    
                    {/* Title */}
                    <div>
                        <h2 className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold text-navy-900 dark:text-white flex items-center gap-1.5`}>
                            <Sparkles size={isCompact ? 12 : 14} className="text-primary-500" />
                            {title || t('aiChat.title', 'AI Assistant')}
                        </h2>
                        {workspaceContext && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {t('aiChat.contextAware', 'Context-aware')} • {workspaceContext.type}
                            </p>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-1">
                    {/* Focus Mode (compact in split mode) */}
                    {showFocusMode && (
                        <FocusModeSelector
                            value={focusMode}
                            onChange={setFocusMode}
                            compact={isCompact}
                            disabled={isDisabled}
                            className={isCompact ? '' : 'mr-2'}
                        />
                    )}
                    
                    {/* Mode toggle */}
                    {showModeToggle && (
                        <button
                            onClick={handleModeToggle}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
                            title={isSplitMode ? t('aiChat.expand', 'Expand') : t('aiChat.collapse', 'Collapse')}
                        >
                            {isSplitMode ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                        </button>
                    )}
                </div>
            </div>
            
            {/* Messages Area */}
            <div 
                ref={messagesContainerRef}
                className={`flex-1 overflow-y-auto ${isCompact ? 'p-3 space-y-3' : 'p-4 space-y-4'}`}
            >
                {displayMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
                            <MessageSquare size={24} className="text-primary-500" />
                        </div>
                        <h3 className={`${isCompact ? 'text-sm' : 'text-base'} font-medium text-navy-900 dark:text-white mb-1`}>
                            {t('aiChat.welcome', 'Start a conversation')}
                        </h3>
                        <p className={`${isCompact ? 'text-xs' : 'text-sm'} text-slate-500 dark:text-slate-400 max-w-xs`}>
                            {t('aiChat.welcomeSubtitle', 'Ask questions, get insights, and collaborate with AI')}
                        </p>
                    </div>
                ) : (
                    displayMessages.map((msg, index) => renderMessage(msg, index))
                )}
                
                {/* Typing indicator */}
                {isBotTyping && !streamedContent && (
                    <div className="flex gap-2 justify-start">
                        <div className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full bg-primary-50 dark:bg-primary-900/50 border border-primary-200 dark:border-primary-700 flex items-center justify-center shrink-0 mt-0.5`}>
                            <Bot size={isCompact ? 12 : 14} className="text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-2xl rounded-tl-none px-3 py-2 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-100"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>
            
            {/* Input Area */}
            <div className={`${isCompact ? 'p-2' : 'p-3'} border-t border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950`}>
                <EnhancedChatInput
                    onSend={handleSendMessage}
                    disabled={isDisabled}
                    placeholder={workspaceContext 
                        ? t('aiChat.contextPlaceholder', 'Ask about {{context}}...', { context: workspaceContext.type })
                        : undefined
                    }
                    voiceModeEnabled={voiceModeEnabled}
                    onVoiceModeChange={setVoiceModeEnabled}
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

