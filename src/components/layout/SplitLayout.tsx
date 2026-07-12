import {
  ChevronLeft,
  ChevronRight,
  FileCode,
  Maximize2,
  MessageSquare,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { useAIContext } from '../../contexts/AIContext';
import { useAIStream } from '../../hooks/useAIStream';
import { useDeviceType } from '../../hooks/useDeviceType';
import { useAppStore } from '../../store/useAppStore';
import { useArtifactsStore } from '../../store/useArtifactsStore';
import { useConversationStore } from '../../store/useConversationStore';
import { usePMOContextAutoFetch } from '../../store/usePMOStore';
import { AppView, Artifact, ChatMessage, ChatOption, FocusMode } from '../../types';
import { createWorkspaceContext, getDefaultWorkspaceType } from '../../types/workspace';
import { ArtifactsPanel } from '../AIChat/Artifacts/ArtifactsPanel';
import { FocusModeSelector } from '../AIChat/Input/FocusModeSelector';
import { UnifiedChatPanel } from '../AIChat/UnifiedChatPanel';

interface SplitLayoutProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  isFullScreen?: boolean; // Escape hatch for tools needing full width
  onSendMessage?: (text: string) => void; // Optional override
  hideSidebar?: boolean;
  /** Use the new UnifiedChatPanel instead of legacy ChatPanel */
  useUnifiedChat?: boolean;
  /** Optional system prompt override for chat */
  chatSystemPrompt?: string;
  /** Optional role name override for chat */
  chatRoleName?: string;
  /** Current view for workspace context (optional) */
  currentView?: AppView;
  /** Entity ID for workspace context (optional) */
  contextEntityId?: string;
}

export const SplitLayout: React.FC<SplitLayoutProps> = ({
  children,
  title,
  subtitle,
  isFullScreen = false,
  onSendMessage,
  hideSidebar = true, // Default to true since MainLayout already provides chat panel
  useUnifiedChat = true, // Default to unified chat panel
  chatSystemPrompt,
  chatRoleName,
  currentView,
  contextEntityId,
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
    setChatPanelWidth,
    currentView: appCurrentView,
    returnToFullChat,
    chatSystemPrompt: storeChatSystemPrompt,
    chatQuickPrompts: storeChatQuickPrompts,
  } = useAppStore();

  const effectiveSystemPrompt = chatSystemPrompt || storeChatSystemPrompt || undefined;

  const { setDisplayMode, expandToFullScreen, setWorkspaceContext } = useConversationStore();

  // Artifacts store for World-Class Chat 2025
  const {
    artifacts,
    activeArtifactId,
    isPanelOpen: isArtifactsPanelOpen,
    isFullscreen: isArtifactsFullscreen,
    setActiveArtifact,
    updateArtifact,
    togglePanel: toggleArtifactsPanel,
    toggleFullscreen: toggleArtifactsFullscreen,
    exportArtifact,
  } = useArtifactsStore();

  // Focus mode state
  const [focusMode, setFocusMode] = useState<FocusMode>('all');

  // Compute workspace context for AI awareness
  const workspaceContext = useMemo(() => {
    const view = currentView || appCurrentView;
    if (!view) return null;

    const type = getDefaultWorkspaceType(view);
    return createWorkspaceContext(view, type, {
      entityId: contextEntityId,
      projectId: currentProjectId || undefined,
    });
  }, [currentView, appCurrentView, contextEntityId, currentProjectId]);

  // Update conversation store with workspace context when it changes
  React.useEffect(() => {
    if (workspaceContext) {
      setWorkspaceContext(workspaceContext);
      setDisplayMode('split');
    }
  }, [workspaceContext, setWorkspaceContext, setDisplayMode]);

  // Handle expanding to full screen chat
  const handleExpandToFullChat = useCallback(() => {
    expandToFullScreen();
    returnToFullChat();
  }, [expandToFullScreen, returnToFullChat]);

  // CRIT-03: Auto-fetch PMO context when project changes
  usePMOContextAutoFetch(currentProjectId);

  const { screenContext } = useAIContext();
  const { isStreaming, streamedContent, thinkingSteps, startStream } = useAIStream();

  // Device detection
  const { isTablet, isMobile, isTouchDevice } = useDeviceType();
  const isCompact = isTablet || isMobile;

  // Resizable State (width comes from global store)
  const [isResizing, setIsResizing] = React.useState(false);
  const sidebarRef = React.useRef<HTMLDivElement>(null);

  const startResizing = React.useCallback(
    (mouseDownEvent: React.MouseEvent) => {
      // Disable resizing on touch devices
      if (isTouchDevice) return;

      setIsResizing(true);
      mouseDownEvent.preventDefault();

      const startX = mouseDownEvent.clientX;
      const startWidth = chatPanelWidth;

      const doDrag = (mouseMoveEvent: MouseEvent) => {
        // Panel is docked on the RIGHT (D17): the resizer sits on its left edge,
        // so dragging right shrinks the panel — subtract the delta.
        const delta = mouseMoveEvent.clientX - startX;
        const newWidth = Math.max(280, Math.min(700, startWidth - delta));
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
    },
    [chatPanelWidth, setChatPanelWidth, isTouchDevice]
  );

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
      timestamp: new Date(),
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
      timestamp: new Date(),
    };
    addChatMessage(aiPlaceholder);

    // Prepare history for API
    const history = activeChatMessages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    // System prompt for consulting context
    const systemPrompt =
      chatSystemPrompt ||
      `You are Consultify AI, an expert Digital Transformation Consultant.
Your role is to guide the user through strategic discovery and provide actionable insights.
Be concise, professional, and solution-oriented. Focus on value, not fluff.`;

    // Import API dynamically to avoid circular deps and call stream
    // Pass focusMode for context filtering
    startStream(text, history, systemPrompt, { ...screenContext, focusMode });
  };

  // Handle artifact export
  const handleExportArtifact = useCallback(
    async (artifact: Artifact, format: string) => {
      await exportArtifact(artifact.id, format);
    },
    [exportArtifact]
  );

  const handleOptionSelect = (option: ChatOption) => {
    handleSendMessage(option.label);
    // Logic to interpret the option value can be added here
  };

  if (isFullScreen) {
    return <div className="w-full h-full">{children}</div>;
  }

  return (
    <div className="flex w-full h-full min-h-0 overflow-hidden bg-slate-50 dark:bg-navy-950 relative">
      {/* Consultant Chat panel — docked on the RIGHT (D17) via flex order. */}
      {!isChatCollapsed && !hideSidebar && (
        <div
          ref={sidebarRef}
          style={{ width: chatPanelWidth }}
          className="shrink-0 shadow-sm bg-white dark:bg-navy-900 flex flex-col hidden lg:flex h-full transition-none relative lg:order-3 border-l border-slate-200 dark:border-navy-700"
        >
          {/* Collapse button - only for legacy chat panel */}
          {!useUnifiedChat && (
            <div className="absolute top-2 right-2 z-10">
              <button
                onClick={() => toggleChatCollapse()}
                className="p-1 rounded bg-slate-100 dark:bg-navy-800/40 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400"
                title="Collapse AI Panel"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
            </div>
          )}

          <UnifiedChatPanel
            mode="split"
            workspaceContext={workspaceContext}
            showModeToggle={true}
            onModeToggle={handleExpandToFullChat}
            showHistoryTrigger={true}
            showFocusMode={true}
            title={typeof title === 'string' ? title : undefined}
            systemPrompt={effectiveSystemPrompt}
            roleName={chatRoleName}
            quickPrompts={storeChatQuickPrompts || undefined}
            onMessageSent={onSendMessage}
          />
        </div>
      )}
      {/* Desktop Collapsed Trigger — right-docked (D17) via flex order. */}
      {isChatCollapsed && !hideSidebar && (
        <div className="hidden lg:flex w-12 shadow-sm bg-white dark:bg-navy-900 flex-col items-center py-4 gap-4 h-full shrink-0 lg:order-3 border-l border-slate-200 dark:border-navy-700">
          <button
            onClick={() => toggleChatCollapse()}
            className="w-8 h-8 rounded bg-brand/10 text-brand flex items-center justify-center hover:bg-brand/20 transition-colors"
            title="Expand Chat"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <div className="writing-vertical-rl text-xs text-slate-600 font-bold tracking-widest uppercase rotate-180 flex-1 text-center">
            AI Consultant
          </div>
        </div>
      )}
      {/* Resizer Handle (Only when visible) — sits left of the right-docked panel. */}
      {!isChatCollapsed && !hideSidebar && (
        <div
          className={`hidden lg:block w-1 hover:w-1.5 -mr-0.5 z-10 cursor-col-resize bg-transparent hover:bg-brand/50 active:bg-brand transition-all duration-150 relative lg:order-2 ${isResizing ? 'bg-brand w-1.5' : ''}`}
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
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-900/30 flex items-center justify-center">
                  <Sparkles size={16} className="text-primary-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    AI Consultant
                  </h3>
                  <p className="text-[10px] text-slate-500">Twój asystent transformacji</p>
                </div>
              </div>
              <button
                onClick={() => setIsMobileChatOpen(false)}
                className="touch-target flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <UnifiedChatPanel
                mode="split"
                workspaceContext={workspaceContext}
                showModeToggle={true}
                onModeToggle={handleExpandToFullChat}
                showHistoryTrigger={true}
                showFocusMode={false}
                systemPrompt={effectiveSystemPrompt}
                roleName={chatRoleName}
                quickPrompts={storeChatQuickPrompts || undefined}
                onMessageSent={onSendMessage}
              />
            </div>
          </div>
        </div>
      )}

      {/* Center Panel: Workspace — leftmost (D17) via flex order. */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative lg:order-1">
        {/* Focus Mode Selector - Only for legacy ChatPanel (UnifiedChatPanel has built-in) */}
        {!useUnifiedChat && !hideSidebar && !isChatCollapsed && (
          <div className="hidden lg:flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950">
            <FocusModeSelector value={focusMode} onChange={setFocusMode} />

            {/* Artifacts toggle button */}
            {artifacts.length > 0 && (
              <button
                onClick={() => toggleArtifactsPanel()}
                className={`
                                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                                    ${
                                      isArtifactsPanelOpen
                                        ? 'bg-slate-700 dark:bg-white/[0.15] text-white'
                                        : 'bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.10]'
                                    }
                                `}
              >
                <FileCode size={16} />
                <span>{artifacts.length} Artifacts</span>
                {isArtifactsPanelOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
            )}
          </div>
        )}

        {/* Artifacts toggle for UnifiedChatPanel */}
        {useUnifiedChat && !hideSidebar && !isChatCollapsed && artifacts.length > 0 && (
          <div className="hidden lg:flex items-center justify-end px-4 py-2 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950">
            <button
              onClick={() => toggleArtifactsPanel()}
              className={`
                                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                                ${
                                  isArtifactsPanelOpen
                                    ? 'bg-slate-700 dark:bg-white/[0.15] text-white'
                                    : 'bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.10]'
                                }
                            `}
            >
              <FileCode size={16} />
              <span>{artifacts.length} Artifacts</span>
              {isArtifactsPanelOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
        )}

        {/* Mobile/Tablet Chat FAB - Different position for tablet */}
        {!hideSidebar && (
          <button
            onClick={() => setIsMobileChatOpen(true)}
            className={`
                            lg:hidden fixed z-40 rounded-full bg-navy-900 text-white shadow-lg shadow-navy-900/30
                            flex items-center justify-center transition-all touch-ripple touch-target
                            ${
                              isMobile
                                ? 'bottom-20 right-4 w-14 h-14' /* Above bottom nav on mobile */
                                : 'bottom-6 right-6 w-12 h-12' /* Normal position on tablet */
                            }
                            ${isMobileChatOpen ? 'scale-0' : 'scale-100'}
                        `}
          >
            <MessageSquare size={isMobile ? 24 : 20} />

            {/* Notification dot if there are unread messages */}
            {activeChatMessages.length > 0 &&
              activeChatMessages[activeChatMessages.length - 1]?.role === 'ai' && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger-500 rounded-full flex items-center justify-center">
                  <span className="w-2 h-2 bg-slate-900 dark:bg-navy-900 rounded-full animate-ping" />
                </span>
              )}
          </button>
        )}

        <div className="flex-1 min-h-0 relative">{children}</div>
      </div>

      {/* Right Panel: Artifacts - World-Class Chat 2025 */}
      {isArtifactsPanelOpen && artifacts.length > 0 && (
        <div
          className={`
                        hidden lg:block shrink-0 border-l border-slate-200 dark:border-navy-700 lg:order-4
                        ${isArtifactsFullscreen ? 'fixed inset-0 z-50' : 'w-[400px] max-w-[40vw]'}
                    `}
        >
          <ArtifactsPanel
            artifacts={artifacts}
            activeArtifactId={activeArtifactId}
            onSelectArtifact={setActiveArtifact}
            onUpdateArtifact={updateArtifact}
            onClose={() => toggleArtifactsPanel(false)}
            onExport={handleExportArtifact}
            isFullscreen={isArtifactsFullscreen}
            onToggleFullscreen={() => toggleArtifactsFullscreen()}
          />
        </div>
      )}

      {/* Mobile Artifacts Drawer */}
      {isArtifactsPanelOpen && artifacts.length > 0 && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => toggleArtifactsPanel(false)}
          />

          {/* Drawer from bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-navy-900 rounded-t-2xl max-h-[80vh] overflow-hidden"
            style={{ animation: 'slideInFromBottom 0.3s ease-out forwards' }}
          >
            <ArtifactsPanel
              artifacts={artifacts}
              activeArtifactId={activeArtifactId}
              onSelectArtifact={setActiveArtifact}
              onUpdateArtifact={updateArtifact}
              onClose={() => toggleArtifactsPanel(false)}
              onExport={handleExportArtifact}
            />
          </div>
        </div>
      )}

      {/* Add CSS for slide animations */}
      <style>{`
                @keyframes slideInFromRight {
                    from {
                        transform: translateX(100%);
                    }
                    to {
                        transform: translateX(0);
                    }
                }
                @keyframes slideInFromBottom {
                    from {
                        transform: translateY(100%);
                    }
                    to {
                        transform: translateY(0);
                    }
                }
            `}</style>
    </div>
  );
};
