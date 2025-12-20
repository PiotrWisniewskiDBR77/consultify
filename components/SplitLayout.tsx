import React from 'react';
import { ChatPanel } from './ChatPanel';
import { useAppStore } from '../store/useAppStore';
import { ChatMessage, ChatOption } from '../types';
import { useAIStream } from '../hooks/useAIStream';
import { useAIContext } from '../contexts/AIContext';

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
        setIsBotTyping
    } = useAppStore();

    const { screenContext } = useAIContext();
    const { isStreaming, streamedContent, startStream } = useAIStream();

    // Resizable State
    const [sidebarWidth, setSidebarWidth] = React.useState(380);
    const [isResizing, setIsResizing] = React.useState(false);
    const sidebarRef = React.useRef<HTMLDivElement>(null);

    const startResizing = React.useCallback((mouseDownEvent: React.MouseEvent) => {
        setIsResizing(true);
        mouseDownEvent.preventDefault();

        const startX = mouseDownEvent.clientX;
        const startWidth = sidebarWidth;

        const doDrag = (mouseMoveEvent: MouseEvent) => {
            // Calculate new width: original width + delta
            // If dragging right, delta is positive, sidebar grows.
            const delta = mouseMoveEvent.clientX - startX;
            const newWidth = Math.max(280, Math.min(700, startWidth + delta));
            setSidebarWidth(newWidth);
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
    }, [sidebarWidth]);

    // Mobile/Responsive State
    const [isMobileChatOpen, setIsMobileChatOpen] = React.useState(false);
    const [isCollapsed, setIsCollapsed] = React.useState(false);

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
            {!isCollapsed && !hideSidebar && (
                <div
                    ref={sidebarRef}
                    style={{ width: sidebarWidth }}
                    className="shrink-0 border-r border-slate-200 dark:border-white/5 bg-white dark:bg-navy-950 flex flex-col hidden lg:flex h-full transition-none relative"
                >
                    <div className="absolute top-2 right-2 z-10">
                        <button
                            onClick={() => setIsCollapsed(true)}
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
            {isCollapsed && (
                <div className="hidden lg:flex w-12 border-r border-slate-200 dark:border-white/5 bg-white dark:bg-navy-950 flex-col items-center py-4 gap-4 h-full shrink-0">
                    <button
                        onClick={() => setIsCollapsed(false)}
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
            {!isCollapsed && (
                <div
                    className={`hidden lg:block w-1 hover:w-1.5 -ml-0.5 z-10 cursor-col-resize bg-transparent hover:bg-brand/50 active:bg-brand transition-all duration-150 relative ${isResizing ? 'bg-brand w-1.5' : ''}`}
                    onMouseDown={startResizing}
                >
                    <div className="absolute inset-y-0 left-1/2 w-px bg-slate-200 dark:bg-white/10" />
                </div>
            )}

            {/* Mobile Chat Overlay */}
            {isMobileChatOpen && (
                <div className="lg:hidden absolute inset-0 z-50 flex">
                    <div className="w-full sm:w-96 bg-white dark:bg-navy-950 border-r border-white/10 h-full flex flex-col shadow-2xl relative">
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
                        <button
                            onClick={() => setIsMobileChatOpen(false)}
                            className="absolute top-4 right-4 p-2 bg-navy-900/50 rounded-full text-white"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileChatOpen(false)} />
                </div>
            )}

            {/* Right Panel: Workspace */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">

                {/* Mobile Chat Toggle (Floating) */}
                <button
                    onClick={() => setIsMobileChatOpen(true)}
                    className="lg:hidden absolute bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-brand text-white shadow-lg shadow-brand/40 flex items-center justify-center animate-bounce-slow"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                </button>

                <div className="flex-1 overflow-hidden relative">
                    {children}
                </div>
            </div>
        </div>
    );
};
