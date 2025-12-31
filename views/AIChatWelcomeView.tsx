/**
 * AIChatWelcomeView - Complete AI Chat Experience
 * 
 * Features:
 * - Collapsible conversation history sidebar
 * - Time-aware personalized greetings
 * - Enhanced input with file upload and AI tools
 * - Smart suggestions based on PMO context
 * - Citations and action buttons in responses
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { useConversationStore, Conversation } from '../store/useConversationStore';
import { useAIStream } from '../hooks/useAIStream';
import { useAIContext } from '../contexts/AIContext';
import { useTextToSpeech, cleanTextForSpeech } from '../hooks/useTextToSpeech';
import { ChatMessage, ChatCitation, ChatResponseAction } from '../types';

// Components
import { ChatHistorySidebar } from '../components/AIChat/ChatHistorySidebar';
import { EnhancedChatInput } from '../components/AIChat/EnhancedChatInput';
import { SmartSuggestions } from '../components/AIChat/SmartSuggestions';
import { CitationList } from '../components/AIChat/CitationList';
import { ResponseActions } from '../components/AIChat/ResponseActions';

import { 
    Target, 
    TrendingUp, 
    FileText,
    Lightbulb,
    MessageSquare,
    Sparkles
} from 'lucide-react';

// Time-aware greeting helper
const getTimeContext = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
        return {
            greetingKey: 'morning',
            greetingFallback: 'Good morning',
            subtitleKey: 'subtitle.morning',
            subtitleFallback: 'Ready to drive your transformation forward?'
        };
    } else if (hour >= 12 && hour < 18) {
        return {
            greetingKey: 'afternoon',
            greetingFallback: 'Good afternoon',
            subtitleKey: 'subtitle.afternoon',
            subtitleFallback: "Let's make progress on your initiatives"
        };
    } else {
        return {
            greetingKey: 'evening',
            greetingFallback: 'Good evening',
            subtitleKey: 'subtitle.evening',
            subtitleFallback: 'Review your transformation journey'
        };
    }
};

// Quick action definitions
const QUICK_ACTIONS = [
    {
        id: 'assessment',
        icon: Target,
        labelKey: 'aiChat.actions.assess',
        label: 'Assess',
        prompt: 'Help me assess our digital maturity across key dimensions'
    },
    {
        id: 'initiatives',
        icon: Lightbulb,
        labelKey: 'aiChat.actions.generate',
        label: 'Generate',
        prompt: 'Suggest strategic initiatives for our digital transformation'
    },
    {
        id: 'roadmap',
        icon: TrendingUp,
        labelKey: 'aiChat.actions.plan',
        label: 'Plan',
        prompt: 'Help me create a transformation roadmap with priorities'
    },
    {
        id: 'report',
        icon: FileText,
        labelKey: 'aiChat.actions.report',
        label: 'Report',
        prompt: 'Generate a comprehensive transformation analysis report'
    }
];

export const AIChatWelcomeView: React.FC = () => {
    const { t } = useTranslation();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // App state
    const { currentUser, selectedProject, activeChatMessages, addChatMessage } = useAppStore();

    // Conversation store
    const {
        activeConversationId,
        activeMessages,
        isSidebarOpen,
        createConversation,
        addMessage,
        updateLastMessage,
        setActiveConversation,
        clearActiveChat,
        generateTitle
    } = useConversationStore();

    // AI stream
    const { isStreaming, streamedContent, startStream } = useAIStream();
    
    // AI context
    const { pmoContext, globalContext, screenContext } = useAIContext();

    // Text-to-Speech for AI responses
    const { speak, stop: stopSpeaking, isSpeaking, isSupported: ttsSupported } = useTextToSpeech();

    // Local state
    const [citationsCollapsed, setCitationsCollapsed] = useState(false);
    const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
    const lastSpokenContentRef = useRef<string>('');

    // Get time-aware context
    const timeContext = useMemo(() => getTimeContext(), []);
    const firstName = currentUser?.name?.split(' ')[0] || currentUser?.firstName || '';

    // Auto-scroll on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeMessages, streamedContent]);

    // Speak AI responses in voice mode
    useEffect(() => {
        if (!voiceModeEnabled || !ttsSupported || isStreaming) return;

        // Get the last AI message content
        const lastMessage = activeChatMessages[activeChatMessages.length - 1];
        if (lastMessage?.role === 'ai' && lastMessage.content) {
            const contentToSpeak = cleanTextForSpeech(lastMessage.content);
            
            // Only speak if it's new content
            if (contentToSpeak && contentToSpeak !== lastSpokenContentRef.current) {
                lastSpokenContentRef.current = contentToSpeak;
                speak(contentToSpeak);
            }
        }
    }, [activeChatMessages, voiceModeEnabled, ttsSupported, isStreaming, speak]);

    // Handle voice mode change
    const handleVoiceModeChange = useCallback((enabled: boolean) => {
        setVoiceModeEnabled(enabled);
        if (!enabled) {
            stopSpeaking();
        }
    }, [stopSpeaking]);

    // Handle sending a message
    const handleSend = useCallback(async (message: string) => {
        if (!message.trim() || isStreaming) return;

        let conversationId = activeConversationId;

        // Create new conversation if needed
        if (!conversationId) {
            const newConv = await createConversation({
                projectId: selectedProject?.id
            });
            conversationId = newConv.id;
        }

        // Add user message
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: message.trim(),
            timestamp: new Date()
        };

        // Add to legacy store for backwards compatibility
        addChatMessage(userMsg);

        // Add placeholder AI message
        const aiMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'ai',
            content: '',
            timestamp: new Date()
        };
        addChatMessage(aiMsg);

        // Build context
        const history = activeChatMessages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
        }));

        const fullContext = {
            ...screenContext,
            pmo: pmoContext,
            global: globalContext,
            isWelcomeScreen: activeMessages.length === 0,
            conversationId
        };

        // Enhanced system prompt with co-thinker persona
        const systemPrompt = `You are a Senior Digital Transformation Consultant at DBR77.
Your role is to be a strategic co-thinker, helping ${currentUser?.name || 'the user'} with digital transformation management.

PRINCIPLES:
- Be concise, professional, and action-oriented
- Reference specific data when available (assessment scores, initiatives, timelines)
- Always end with a clear next step or question
- Guide, don't dictate - offer options when decisions are needed

CONTEXT:
- User: ${currentUser?.name || 'User'} (${currentUser?.role || 'Stakeholder'})
- Organization: ${currentUser?.organizationName || 'Unknown'}
- Project: ${selectedProject?.name || 'General'}

Focus on practical recommendations for transformation initiatives, roadmaps, and organizational change.`;

        startStream(message.trim(), history, systemPrompt, fullContext);
    }, [activeConversationId, activeChatMessages, selectedProject, currentUser, isStreaming]);

    // Handle quick action click
    const handleQuickAction = useCallback((actionId: string) => {
        const action = QUICK_ACTIONS.find(a => a.id === actionId);
        if (action) {
            handleSend(action.prompt);
        }
    }, [handleSend]);

    // Handle suggestion click
    const handleSuggestionClick = useCallback((suggestion: any) => {
        if (suggestion.action?.type === 'chat' && suggestion.action.prompt) {
            handleSend(suggestion.action.prompt);
        }
    }, [handleSend]);

    // Handle new chat
    const handleNewChat = useCallback(() => {
        clearActiveChat();
    }, [clearActiveChat]);

    const hasMessages = activeChatMessages.length > 0;

    // Chat View (when messages exist)
    if (hasMessages) {
        return (
            <div className="h-full w-full bg-slate-50 dark:bg-navy-950 overflow-hidden relative">
                {/* History Sidebar - Floating Overlay */}
                <ChatHistorySidebar
                    projectId={selectedProject?.id}
                    onNewChat={handleNewChat}
                />

                {/* Main Chat Area - Full width, sidebar is overlay */}
                <div className="h-full flex flex-col overflow-hidden">
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
                                    <div 
                                        key={msg.id} 
                                        className={`mb-6 ${msg.role === 'user' ? 'text-right' : ''}`}
                                    >
                                        <div className={`inline-block max-w-[85%] ${
                                            msg.role === 'user' 
                                                ? 'bg-primary-600 text-white rounded-2xl rounded-br-md px-4 py-3' 
                                                : 'text-navy-900 dark:text-slate-200'
                                        }`}>
                                            <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
                                                {displayContent}
                                                {isStreamingThis && (
                                                    <span className="inline-block w-2 h-5 bg-primary-500 ml-1 animate-pulse" />
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
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Input at bottom */}
                    <div className="shrink-0 p-4 border-t border-slate-200 dark:border-white/5">
                        <div className="max-w-3xl mx-auto">
                            <EnhancedChatInput
                                onSend={handleSend}
                                disabled={isStreaming}
                                placeholder={t('aiChat.placeholder', 'Ask anything...')}
                                voiceModeEnabled={voiceModeEnabled}
                                onVoiceModeChange={handleVoiceModeChange}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Welcome Screen
    return (
        <div className="h-full w-full bg-slate-50 dark:bg-navy-950 overflow-hidden relative">
            {/* History Sidebar - Floating Overlay */}
            <ChatHistorySidebar
                projectId={selectedProject?.id}
                onNewChat={handleNewChat}
            />

            {/* Main Welcome Area - Full width, sidebar is overlay */}
            <div className="h-full flex flex-col overflow-hidden">
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
                            showQuickActions
                            onQuickAction={handleQuickAction}
                            voiceModeEnabled={voiceModeEnabled}
                            onVoiceModeChange={handleVoiceModeChange}
                        />
                    </div>

                    {/* Smart Suggestions */}
                    <div className="w-full max-w-2xl mt-8">
                        <SmartSuggestions
                            projectId={selectedProject?.id}
                            onSuggestionClick={handleSuggestionClick}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 py-5">
                    <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 tracking-[0.25em] uppercase">
                        DBR77 Industrial Intelligence
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AIChatWelcomeView;
