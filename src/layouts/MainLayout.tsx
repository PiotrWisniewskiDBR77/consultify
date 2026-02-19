import { ChevronRight, Menu, MessageSquare, Sparkles, X } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { AccessBlockedModal } from '../components/access/AccessBlockedModal';
import { UnifiedChatPanel } from '../components/AIChat/UnifiedChatPanel';
import { AIFreezeBanner } from '../components/AIFreezeBanner';
import { DemoSessionManager } from '../components/demo/DemoSessionManager';
import { DocumentSidePanel } from '../components/documents/DocumentSidePanel';
import { DocumentToggleButton } from '../components/documents/DocumentToggleButton';
import { FeedbackSidePanel } from '../components/Feedback/FeedbackSidePanel';
import { FeedbackToggleButton } from '../components/Feedback/FeedbackToggleButton';
import { HelpSidePanel } from '../components/Help/HelpSidePanel';
import { HelpToggleButton } from '../components/Help/HelpToggleButton';
import { NotificationDropdown } from '../components/layout/NotificationDropdown';
import { UserProfileMenu } from '../components/layout/UserProfileMenu';
import { LLMSelector } from '../components/LLMSelector';
import { BottomNavigation } from '../components/navigation/BottomNavigation';
import { Sidebar } from '../components/navigation/Sidebar';
import { OnboardingFirstLoginCTA } from '../components/Onboarding/OnboardingFirstLoginCTA';
import { SystemHealth } from '../components/SystemHealth';
import { TaskDropdown } from '../components/TaskDropdown';
import { TrialExpiredGate } from '../components/Trial/TrialExpiredGate';
import { useAppStore } from '../store/useAppStore';
import { useConversationStore } from '../store/useConversationStore';
import { AppView } from '../types';
import { createWorkspaceContext, getDefaultWorkspaceType } from '../types/workspace';

export interface MainLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: string[];
  noPadding?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  breadcrumbs,
  noPadding = false,
}) => {
  // NOTE (React 19 + useSyncExternalStore):
  // Avoid selectors returning new objects/arrays each call (even with shallow),
  // because it can trigger "getSnapshot should be cached" warnings/loops.
  const isSidebarCollapsed = useAppStore((s) => s.isSidebarCollapsed);
  const setIsSidebarOpen = useAppStore((s) => s.setIsSidebarOpen);
  const isChatCollapsed = useAppStore((s) => s.isChatCollapsed);
  const toggleChatCollapse = useAppStore((s) => s.toggleChatCollapse);
  const currentUser = useAppStore((s) => s.currentUser);
  const currentView = useAppStore((s) => s.currentView);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const chatPanelWidth = useAppStore((s) => s.chatPanelWidth);
  const setChatPanelWidth = useAppStore((s) => s.setChatPanelWidth);

  const { setDisplayMode, setWorkspaceContext, expandToFullScreen } = useConversationStore();

  // Views where chat panel should NOT be shown (full-screen chat only, and settings)
  // AI chat is now available on Admin, SuperAdmin, Context Builder, and Partner screens
  const VIEWS_WITHOUT_CHAT_PANEL: AppView[] = [
    AppView.AI_CHAT, // Full-screen chat mode — no split panel
    AppView.SETTINGS_PROFILE,
    AppView.SETTINGS_PROFILE_MODULE,
    AppView.SETTINGS_AI,
    AppView.SETTINGS_AI_MODULE,
    AppView.SETTINGS_NOTIFICATIONS,
    AppView.SETTINGS_NOTIFICATIONS_MODULE,
    AppView.SETTINGS_SECURITY,
    AppView.SETTINGS_SECURITY_MODULE,
    AppView.SETTINGS_INTEGRATIONS,
    AppView.SETTINGS_INTEGRATIONS_MODULE,
    AppView.SETTINGS_APPEARANCE_MODULE,
  ];

  const shouldShowChatPanel = currentView ? !VIEWS_WITHOUT_CHAT_PANEL.includes(currentView) : true;

  // Compute workspace context for AI awareness
  const workspaceContext = useMemo(() => {
    if (!currentView) return null;
    const type = getDefaultWorkspaceType(currentView);
    return createWorkspaceContext(currentView, type, {
      projectId: currentProjectId || undefined,
    });
  }, [currentView, currentProjectId]);

  // Update conversation store with workspace context
  React.useEffect(() => {
    // Only keep chat workspace context updated when the split chat panel is actually visible.
    // This avoids extra store updates/renders when user keeps AI collapsed.
    if (workspaceContext && shouldShowChatPanel && !isChatCollapsed) {
      setWorkspaceContext(workspaceContext);
      setDisplayMode('split');
    }
  }, [workspaceContext, shouldShowChatPanel, isChatCollapsed, setWorkspaceContext, setDisplayMode]);

  // Resizer state
  const [isResizing, setIsResizing] = React.useState(false);
  const startResizing = React.useCallback(
    (e: React.MouseEvent) => {
      setIsResizing(true);
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = chatPanelWidth;

      const doDrag = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.max(280, Math.min(600, startWidth + delta));
        setChatPanelWidth(newWidth);
      };

      const stopDrag = () => {
        setIsResizing(false);
        window.removeEventListener('mousemove', doDrag);
        window.removeEventListener('mouseup', stopDrag);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      window.addEventListener('mousemove', doDrag);
      window.addEventListener('mouseup', stopDrag);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [chatPanelWidth, setChatPanelWidth]
  );

  // Only show sidebar/header for actual app views, not Welcome/Auth
  const isSessionView = true; // MainLayout is only used for session views

  return (
    <div className="flex h-screen w-full bg-slate-100 dark:bg-navy-950 text-navy-900 dark:text-white font-sans overflow-hidden">
      {/* Global Floating Action Buttons - Order: Help, Feedback, Docs */}
      <div className="fixed right-0 top-[70%] z-50 flex flex-col gap-2 items-end pointer-events-none">
        <div className="pointer-events-auto">
          <HelpToggleButton />
        </div>
        <div className="pointer-events-auto">
          <FeedbackToggleButton />
        </div>
        <div className="pointer-events-auto">
          <DocumentToggleButton />
        </div>
      </div>
      <HelpSidePanel />
      <DocumentSidePanel />
      <FeedbackSidePanel />

      {/* Global access/paywall modal */}
      <AccessBlockedModal />

      {/* Demo Session Manager - Handles banner, tour, prompts, exit intent */}
      <DemoSessionManager />

      {/* First-login onboarding CTA (dismissible) */}
      <OnboardingFirstLoginCTA />

      {/* Impersonation Banner */}
      {currentUser?.impersonatorId && (
        <div className="fixed top-0 left-0 right-0 h-10 bg-red-600 text-white z-50 flex items-center justify-center gap-4 text-sm font-medium shadow-md">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-white dark:bg-navy-900 rounded-full animate-pulse"></span>
            Impersonating Mode
          </span>
        </div>
      )}

      <div className={currentUser?.isDemo ? 'pt-10' : ''}>
        <Sidebar />
      </div>

      <BottomNavigation />

      <main
        className={`
                    flex-1 flex flex-col overflow-hidden relative min-w-0 h-full min-h-0 transition-all duration-300
                    ${isSidebarCollapsed ? 'md:ltr:pl-16 md:rtl:pr-16' : 'md:ltr:pl-64 md:rtl:pr-64'}
                    ${currentUser?.isDemo ? 'mt-10' : ''}
                    pb-16 md:pb-0
                `}
      >
        {/* Header */}
        <div className="flex flex-col z-30 shrink-0">
          <AIFreezeBanner />

          <div className="h-12 border-b border-slate-100 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm dark:shadow-none flex items-center justify-between px-3 transition-colors duration-300">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden text-navy-700 dark:text-white mr-2"
              >
                <Menu />
              </button>
              <div className="flex items-center text-sm font-medium text-slate-400 dark:text-slate-500">
                <span className="hover:text-navy-900 dark:hover:text-white cursor-pointer transition-colors">
                  {breadcrumbs?.[0] || ''}
                </span>
                <ChevronRight size={14} className="mx-2 rtl:rotate-180" />
                <span className="text-navy-900 dark:text-white">{breadcrumbs?.[1] || ''}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <SystemHealth />
              <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>
              <LLMSelector />
              <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>

              <button
                onClick={() => toggleChatCollapse()}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg font-medium text-xs transition-all
                                    ${
                                      isChatCollapsed
                                        ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-500/30'
                                        : 'text-slate-400 dark:text-slate-500 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                                    }`}
                title={isChatCollapsed ? 'Show AI Chat' : 'Hide AI Chat'}
              >
                <Sparkles size={16} />
                <span>AI</span>
              </button>
              <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>

              <TaskDropdown />
              <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>
              <NotificationDropdown />

              <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>

              <UserProfileMenu />
            </div>
          </div>
        </div>

        <TrialExpiredGate>
          <div className={`flex-1 overflow-hidden relative flex min-h-0 ${noPadding ? '' : 'p-0'}`}>
            {/* Chat Panel - Left Side */}
            {shouldShowChatPanel && !isChatCollapsed && (
              <>
                <div
                  style={{ width: chatPanelWidth }}
                  className="shrink-0 bg-white dark:bg-navy-900 border-r border-slate-200 dark:border-navy-700 hidden lg:flex flex-col h-full"
                >
                  <UnifiedChatPanel
                    mode="split"
                    workspaceContext={workspaceContext}
                    showModeToggle={true}
                    onModeToggle={() => expandToFullScreen()}
                    showHistoryTrigger={true}
                    showFocusMode={true}
                  />
                </div>
                {/* Resizer */}
                <div
                  className={`hidden lg:block w-1 hover:w-1.5 cursor-col-resize bg-transparent hover:bg-purple-500/50 active:bg-purple-500 transition-all ${isResizing ? 'bg-purple-500 w-1.5' : ''}`}
                  onMouseDown={startResizing}
                />
              </>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto">{children}</div>
          </div>
        </TrialExpiredGate>
      </main>
    </div>
  );
};
