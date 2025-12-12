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
        // #region agent log
        console.log('[DEBUG-D] handleSendMessage entry:', { textLength: text?.length || 0, currentMessagesCount: activeChatMessages?.length || 0, hasScreenContext: !!screenContext });
        fetch('http://127.0.0.1:7242/ingest/690b8f02-96fa-4527-ae57-5d2b028e8181',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatOverlay.tsx:handleSendMessage:entry',message:'Send message triggered',data:{textLength:text?.length||0,currentMessagesCount:activeChatMessages?.length||0,hasScreenContext:!!screenContext},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
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

        // #region agent log
        console.log('[DEBUG-D] handleSendMessage historyBuilt:', { historyLength: history?.length || 0, newMsgIncluded: history.some(h => h.parts[0]?.text === text) });
        fetch('http://127.0.0.1:7242/ingest/690b8f02-96fa-4527-ae57-5d2b028e8181',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatOverlay.tsx:handleSendMessage:historyBuilt',message:'History prepared before stream',data:{historyLength:history?.length||0,newMsgIncluded:history.some(h=>h.parts[0]?.text===text)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        // Context Injection via separate payload
        // We pass screenContext directly to the backend which will use PromptService
        startStream(text, history, undefined, screenContext || undefined);
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
