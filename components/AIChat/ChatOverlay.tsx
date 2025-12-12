import React, { useRef, useEffect } from 'react';
import { useAIContext } from '../../contexts/AIContext';
import { useAppStore } from '../../store/useAppStore';
import { ChatPanel } from '../ChatPanel';
import { useAIStream } from '../../hooks/useAIStream';
import { MessageCircle, X, Maximize2, Minimize2 } from 'lucide-react';
import { ChatMessage, ChatOption } from '../../types';

export const ChatOverlay: React.FC = () => {
    const { isChatOpen, toggleChat, screenContext } = useAIContext();
    const {
        activeChatMessages,
        addChatMessage,
        isBotTyping,
        setIsBotTyping
    } = useAppStore();

    const { isStreaming, streamedContent, startStream } = useAIStream();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [activeChatMessages, streamedContent, isChatOpen]);

    const handleSendMessage = (text: string) => {
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

        // Context Injection
        let contextPrefix = "";
        if (screenContext) {
            contextPrefix = `[CONTEXT: User is on "${screenContext.title}" (ID: ${screenContext.screenId}). Data: ${JSON.stringify(screenContext.data)}]`;
        }

        const promptToSend = contextPrefix ? `${contextPrefix}\n\n${text}` : text;

        // Start Stream
        setIsBotTyping(true); // Will be handled by hook usually, but good to force UI state
        startStream(promptToSend, history);
    };

    const handleOptionSelect = (option: ChatOption) => {
        handleSendMessage(option.label); // Or value?
    };

    if (!isChatOpen) {
        return (
            <button
                onClick={toggleChat}
                className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 z-50 group"
            >
                <MessageCircle size={28} className="group-hover:animate-pulse" />
                {/* Badge if unread? (Future) */}
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-10 fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="h-14 bg-navy-950 flex items-center justify-between px-4 shrink-0 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                        AI
                    </div>
                    <div>
                        <div className="text-sm font-bold text-white leading-tight">Consultify AI</div>
                        <div className="text-[10px] text-slate-400">
                            {screenContext ? `Viewing: ${screenContext.title}` : 'Global Assistant'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {/* Minimize/Maximize logic could be added here */}
                    <button
                        onClick={toggleChat}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Content using ChatPanel */}
            {/* Note: ChatPanel usually expects to fill parent. Use flex-1 here. */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                <ChatPanel
                    messages={isStreaming
                        ? [...activeChatMessages, { id: 'stream', role: 'ai', content: streamedContent, timestamp: new Date() } as ChatMessage]
                        : activeChatMessages
                    }
                    isTyping={isBotTyping}
                    onSendMessage={handleSendMessage}
                    onOptionSelect={handleOptionSelect}
                // ChatPanel handles scrolling internally if we pass messages.
                />
            </div>
        </div>
    );
};
