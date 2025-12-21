import React, { useRef, useEffect, useState } from 'react';
import { useAIContext } from '../../contexts/AIContext';
import { useAppStore } from '../../store/useAppStore';
import { ChatPanel } from '../ChatPanel';
import { useAIStream } from '../../hooks/useAIStream';
import { MessageCircle, X, Cpu, MapPin, Shield } from 'lucide-react';
import { ChatMessage, ChatOption } from '../../types';
import { AIRoleBadge } from './AIRoleBadge';

export const ChatOverlay: React.FC = () => {
    const { isChatOpen, toggleChat, screenContext, pmoContext, globalContext } = useAIContext();
    const {
        activeChatMessages,
        addChatMessage,
        isBotTyping
    } = useAppStore();

    const { isStreaming, streamedContent, startStream } = useAIStream();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [regulatoryModeEnabled, setRegulatoryModeEnabled] = useState(false);

    // Fetch regulatory mode status when project changes
    useEffect(() => {
        const fetchRegulatoryStatus = async () => {
            if (!pmoContext.projectId) {
                setRegulatoryModeEnabled(false);
                return;
            }
            try {
                const res = await fetch(`/api/projects/${pmoContext.projectId}/regulatory-mode`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setRegulatoryModeEnabled(data.enabled);
                }
            } catch (err) {
                console.error('Failed to fetch regulatory mode status:', err);
            }
        };
        fetchRegulatoryStatus();
    }, [pmoContext.projectId]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [activeChatMessages, streamedContent, isChatOpen]);

    const handleSendMessage = (text: string) => {
        // Check if we have enough context
        if (!pmoContext.projectId) {
            const warningMsg: ChatMessage = {
                id: `warn-${Date.now()}`,
                role: 'ai',
                content: '⚠️ **No Project Selected**\n\nPlease select a project first to get context-aware assistance. I can still help with general questions.',
                timestamp: new Date()
            };
            addChatMessage(warningMsg);
        }

        // Add User Message
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date()
        };
        addChatMessage(userMsg);

        // Prepare History
        const history = activeChatMessages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
        }));

        // Build full context for AI
        const fullContext = {
            ...screenContext,
            pmo: pmoContext,
            global: globalContext
        };

        // Start stream with full context
        startStream(text, history, undefined, fullContext);
    };

    const handleOptionSelect = (option: ChatOption) => {
        handleSendMessage(option.label);
    };

    if (!isChatOpen) {
        return (
            <button
                data-tour="ai-panel"
                onClick={toggleChat}
                className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 z-50 group"
            >
                <MessageCircle size={28} className="group-hover:animate-pulse" />
                {/* Badge indicator when context is loaded */}
                {pmoContext.projectId && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-navy-900 animate-pulse" />
                )}
                {/* Regulatory Mode indicator */}
                {regulatoryModeEnabled && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white dark:border-navy-900 flex items-center justify-center">
                        <Shield size={8} className="text-white" />
                    </span>
                )}
            </button>
        );
    }

    return (
        <div
            data-tour="ai-chat"
            className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-10 fade-in zoom-in-95 duration-200"
        >
            {/* Header */}
            <div className="bg-navy-950 shrink-0 border-b border-white/5">
                <div className="h-14 flex items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                            <Cpu size={18} />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white leading-tight flex items-center gap-2">
                                PMO Assistant
                                {/* AI Roles Model: Display active role badge */}
                                {pmoContext.projectId && (
                                    <AIRoleBadge role={pmoContext.aiRole} size="sm" />
                                )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                <MapPin size={8} />
                                {pmoContext.currentPhase} • {pmoContext.userRole}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={toggleChat}
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
                {/* Context Bar with Regulatory Mode Badge */}
                {pmoContext.projectId && (
                    <div className="px-4 pb-2 flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30">
                            Context Loaded
                        </span>
                        {/* Regulatory Mode Badge */}
                        {regulatoryModeEnabled && (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 flex items-center gap-1">
                                <Shield size={10} />
                                Regulatory Mode: Advisor-only
                            </span>
                        )}
                        <span className="truncate">{pmoContext.currentScreen}</span>
                    </div>
                )}
            </div>

            {/* Content using ChatPanel */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                <ChatPanel
                    messages={isStreaming
                        ? [...activeChatMessages, { id: 'stream', role: 'ai', content: streamedContent, timestamp: new Date() } as ChatMessage]
                        : activeChatMessages
                    }
                    isTyping={isBotTyping}
                    onSendMessage={handleSendMessage}
                    onOptionSelect={handleOptionSelect}
                />
            </div>
        </div>
    );
};
