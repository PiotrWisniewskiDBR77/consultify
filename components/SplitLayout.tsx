import React from 'react';
import { ChatPanel } from './ChatPanel';
import { useAppStore } from '../store/useAppStore';
import { usePMOContextAutoFetch } from '../store/usePMOStore';
import { ChatMessage, ChatOption } from '../types';
import { useAIStream } from '../hooks/useAIStream';
import { useAIContext } from '../contexts/AIContext';
import { useDeviceType } from '../hooks/useDeviceType';
import { X, Sparkles, MessageSquare } from 'lucide-react';

interface SplitLayoutProps {
    children: React.ReactNode;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    isFullScreen?: boolean; // Escape hatch for tools needing full width
    onSendMessage?: (text: string) => void; // Optional override
    hideSidebar?: boolean;
}

export const SplitLayout: React.FC<SplitLayoutProps> = ({
    children,

    title,

    subtitle,
    isFullScreen = false,
    onSendMessage,
    hideSidebar = false
}) => {
    const {
        activeChatMessages,
        addChatMessage,
        isBotTyping,
        setIsBotTyping,
        currentProjectId,
        isChatCollapsed,
        toggleChatCollapse,
        chatPanelWidth,
        setChatPanelWidth
    } = useAppStore();

    // CRIT-03: Auto-fetch PMO context when project changes
    usePMOContextAutoFetch(currentProjectId);

    const { screenContext } = useAIContext();
    const { isStreaming, streamedContent, startStream } = useAIStream();

    // Device detection
    const { isTablet, isMobile, isTouchDevice } = useDeviceType();
    const isCompact = isTablet || isMobile;

    // Resizable State (width comes from global store)
    const [isResizing, setIsResizing] = React.useState(false);
    const sidebarRef = React.useRef<HTMLDivElement>(null);

    const startResizing = React.useCallback((mouseDownEvent: React.MouseEvent) => {
        // Disable resizing on touch devices
        if (isTouchDevice) return;
        
        setIsResizing(true);
        mouseDownEvent.preventDefault();

        const startX = mouseDownEvent.clientX;
        const startWidth = chatPanelWidth;

        const doDrag = (mouseMoveEvent: MouseEvent) => {
            // Calculate new width: original width + delta
            // If dragging right, delta is positive, sidebar grows.
            const delta = mouseMoveEvent.clientX - startX;
            const newWidth = Math.max(280, Math.min(700, startWidth + delta));
            setChatPanelWidth(newWidth);
        };

        const stopDrag = () => {
            setIsResizing(false);
            window.removeEventListener('mousemove', doDrag);
            window.removeEventListener('mouseup', stopDrag);
            // Re-enable text selection/cursor
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('mousemove', doDrag);
        window.addEventListener('mouseup', stopDrag);

        // Prevent selection while dragging
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [chatPanelWidth, setChatPanelWidth, isTouchDevice]);

    // Mobile/Tablet Chat State - Combined for touch devices
    const [isMobileChatOpen, setIsMobileChatOpen] = React.useState(false);

    // Default message handler if none provided
    const handleSendMessage = (text: string) => {
        if (onSendMessage) {
            onSendMessage(text);
            return;
        }

        // Add user message
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date()
        };
        addChatMessage(userMsg);

        // Call Backend AI with Streaming
        setIsBotTyping(true);

        // Create placeholder AI message for streaming
        const aiMsgId = (Date.now() + 1).toString();
        const aiPlaceholder: ChatMessage = {
            id: aiMsgId,
            role: 'ai',
            content: '',
            timestamp: new Date()
        };
        addChatMessage(aiPlaceholder);

        // Prepare history for API
        const history = activeChatMessages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
        }));

        // System prompt for consulting context
        const systemPrompt = `You are Consultify AI, an expert Digital Transformation Consultant.
Your role is to guide the user through strategic discovery and provide actionable insights.
Be concise, professional, and solution-oriented. Focus on value, not fluff.`;

        // Import API dynamically to avoid circular deps and call stream
        startStream(text, history, systemPrompt, screenContext || undefined);
    };

    const handleOptionSelect = (option: ChatOption) => {
        handleSendMessage(option.label);
        // Logic to interpret the option value can be added here
    };

    if (isFullScreen) {
        return <div className="w-full h-full">{children}</div>;
    }

    return (
        <div className="flex w-full h-full overflow-hidden bg-gray-50 dark:bg-navy-950 relative">
            {/* Desktop Left Panel: Consultant Chat */}
            {!isChatCollapsed && !hideSidebar && (
                <div
                    ref={sidebarRef}
                    style={{ width: chatPanelWidth }}
                    className="shrink-0 border-r border-slate-200 dark:border-white/5 bg-white dark:bg-navy-950 flex flex-col hidden lg:flex h-full transition-none relative"
                >
                    <div className="absolute top-2 right-2 z-10">
                        <button
                            onClick={() => toggleChatCollapse()}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500"
                            title="Collapse AI Panel"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </button>
                    </div>

                    <ChatPanel
                        messages={
                            isStreaming
                                ? [...activeChatMessages, {
                                    id: 'streaming-ai',
                                    role: 'ai',
                                    content: streamedContent,
                                    timestamp: new Date()
                                } as ChatMessage]
                                : activeChatMessages
                        }
                        onSendMessage={handleSendMessage}
                        onOptionSelect={handleOptionSelect}
                        isTyping={isBotTyping}
                        title={title}
                        subtitle={subtitle}
                    />
                </div>
            )}
            {/* Desktop Collapsed Trigger */}
            {isChatCollapsed && (
                <div className="hidden lg:flex w-12 border-r border-slate-200 dark:border-white/5 bg-white dark:bg-navy-950 flex-col items-center py-4 gap-4 h-full shrink-0">
                    <button
                        onClick={() => toggleChatCollapse()}
                        className="w-8 h-8 rounded bg-brand/10 text-brand flex items-center justify-center hover:bg-brand/20 transition-colors"
                        title="Expand Chat"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                    <div className="writing-vertical-rl text-xs text-slate-500 font-bold tracking-widest uppercase rotate-180 flex-1 text-center">
                        AI Consultant
                    </div>
                </div>
            )}
            {/* Resizer Handle (Only when visible) */}
            {!isChatCollapsed && (
                <div
                    className={`hidden lg:block w-1 hover:w-1.5 -ml-0.5 z-10 cursor-col-resize bg-transparent hover:bg-brand/50 active:bg-brand transition-all duration-150 relative ${isResizing ? 'bg-brand w-1.5' : ''}`}
                    onMouseDown={startResizing}
                >
                    <div className="absolute inset-y-0 left-1/2 w-px bg-slate-200 dark:bg-white/10" />
                </div>
            )}

            {/* Mobile/Tablet Chat Drawer - Slides from right */}
            {isMobileChatOpen && (
                <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
                        onClick={() => setIsMobileChatOpen(false)} 
                    />
                    
                    {/* Chat Drawer - Different sizes for mobile vs tablet */}
                    <div 
                        className={`
                            relative bg-white dark:bg-navy-900 h-full flex flex-col shadow-2xl
                            transition-transform duration-300 ease-out transform
                            ${isMobile ? 'w-full' : 'w-[400px] max-w-[80vw]'}
                        `}
                        style={{ 
                            animation: 'slideInFromRight 0.3s ease-out forwards',
                        }}
                    >
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                    <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-navy-900 dark:text-white">AI Consultant</h3>
                                    <p className="text-[10px] text-slate-400">Twój asystent transformacji</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsMobileChatOpen(false)}
                                className="touch-target flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Chat Panel */}
                        <div className="flex-1 overflow-hidden">
                            <ChatPanel
                                messages={
                                    isStreaming
                                        ? [...activeChatMessages, {
                                            id: 'streaming-ai',
                                            role: 'ai',
                                            content: streamedContent,
                                            timestamp: new Date()
                                        } as ChatMessage]
                                        : activeChatMessages
                                }
                                onSendMessage={handleSendMessage}
                                onOptionSelect={handleOptionSelect}
                                isTyping={isBotTyping}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Right Panel: Workspace */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">

                {/* Mobile/Tablet Chat FAB - Different position for tablet */}
                {!hideSidebar && (
                    <button
                        onClick={() => setIsMobileChatOpen(true)}
                        className={`
                            lg:hidden fixed z-40 rounded-full bg-purple-600 text-white shadow-lg shadow-purple-600/30 
                            flex items-center justify-center transition-all touch-ripple touch-target
                            ${isMobile 
                                ? 'bottom-20 right-4 w-14 h-14' /* Above bottom nav on mobile */
                                : 'bottom-6 right-6 w-12 h-12' /* Normal position on tablet */
                            }
                            ${isMobileChatOpen ? 'scale-0' : 'scale-100'}
                        `}
                    >
                        <MessageSquare size={isMobile ? 24 : 20} />
                        
                        {/* Notification dot if there are unread messages */}
                        {activeChatMessages.length > 0 && activeChatMessages[activeChatMessages.length - 1]?.role === 'ai' && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                            </span>
                        )}
                    </button>
                )}

                <div className="flex-1 overflow-hidden relative momentum-scroll">
                    {children}
                </div>
            </div>

            {/* Add CSS for slide animation */}
            <style>{`
                @keyframes slideInFromRight {
                    from {
                        transform: translateX(100%);
                    }
                    to {
                        transform: translateX(0);
                    }
                }
            `}</style>
        </div>
    );
};
