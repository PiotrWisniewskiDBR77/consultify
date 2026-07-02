import { ChevronRight, Menu, Sparkles, X } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { AccessBlockedModal } from '../components/access/AccessBlockedModal';
import { ForbiddenAccessBanner } from '../components/access/ForbiddenAccessBanner';
import { UnifiedChatPanel } from '../components/AIChat/UnifiedChatPanel';
import { AIFreezeBanner } from '../components/AIFreezeBanner';
import { DemoSessionManager } from '../components/demo/DemoSessionManager';
import { DocumentSidePanel } from '../components/documents/DocumentSidePanel';
import { DocumentToggleButton } from '../components/documents/DocumentToggleButton';
import { FeedbackSidePanel } from '../components/Feedback/FeedbackSidePanel';
import { FeedbackToggleButton } from '../components/Feedback/FeedbackToggleButton';
import { HelpDeepLinkListener } from '../components/Help/HelpDeepLinkListener';
import { HelpSidePanel } from '../components/Help/HelpSidePanel';
import { HelpToggleButton } from '../components/Help/HelpToggleButton';
// import { MicroVideoHelpTrigger } from '../components/Help/MicroVideoHelpTrigger';
import { DemoModeBanner } from '../components/layout/DemoModeBanner';
import GlobalAccessBanners from '../components/layout/GlobalAccessBanners';
import { NotificationDropdown } from '../components/layout/NotificationDropdown';
import { UserProfileMenu } from '../components/layout/UserProfileMenu';
import { LLMSelector } from '../components/LLMSelector';
import { BottomNavigation } from '../components/navigation/BottomNavigation';
import { Sidebar } from '../components/navigation/Sidebar';
import { FirstRunOnboarding } from '../components/Onboarding/FirstRunOnboarding';
import { OnboardingFirstLoginCTA } from '../components/Onboarding/OnboardingFirstLoginCTA';
import { SystemHealth } from '../components/SystemHealth';
import { TaskDropdown } from '../components/TaskDropdown';
import { TrialExpiredGate } from '../components/Trial/TrialExpiredGate';
import { useDeviceType } from '../hooks/useDeviceType';
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
  const chatKickoffMessage = useAppStore((s) => s.chatKickoffMessage);
  const clearChatKickoffMessage = useAppStore((s) => s.clearChatKickoffMessage);
  const currentUser = useAppStore((s) => s.currentUser);
  const currentView = useAppStore((s) => s.currentView);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const chatPanelWidth = useAppStore((s) => s.chatPanelWidth);
  const setChatPanelWidth = useAppStore((s) => s.setChatPanelWidth);
  const chatSystemPrompt = useAppStore((s) => s.chatSystemPrompt);
  const chatQuickPrompts = useAppStore((s) => s.chatQuickPrompts);
  const { isMobile, safeAreaInsets } = useDeviceType();

  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { setDisplayMode, setWorkspaceContext, expandToFullScreen } = useConversationStore();

  // Views where chat panel should NOT be shown (full-screen chat only, and settings)
  // AI chat is now available on Admin, SuperAdmin, Context Builder, and Partner screens
  const VIEWS_WITHOUT_CHAT_PANEL: AppView[] = [
    AppView.AI_CHAT, // Full-screen chat mode — no split panel
    AppView.WORDY, // KIMI workspaces embed their own chat panel
    AppView.EXCELE,
    AppView.PREZENTACJE_GEN,
    AppView.TABELE,
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

  const hasEmbeddedModuleChat = React.useMemo(() => {
    const path = location.pathname.toLowerCase();
    // KIMI workspaces and Outputs Deck Builder render their own Teresa panel.
    if (path.startsWith('/wordy')) return true;
    if (path.startsWith('/excele')) return true;
    if (path.startsWith('/prezentacje')) return true;
    if (path.startsWith('/tabele')) return true;
    if (path.startsWith('/presentations/builder/')) return true;
    return false;
  }, [location.pathname]);

  const shouldShowChatPanel =
    (currentView ? !VIEWS_WITHOUT_CHAT_PANEL.includes(currentView) : true) &&
    !hasEmbeddedModuleChat;

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
    // Keep workspace context updated so the AI always knows where the user is.
    // Important: do NOT overwrite context when user is on the full-screen chat view,
    // so the chat can retain the "last non-chat screen" context.
    if (!workspaceContext) return;
    if (currentView === AppView.AI_CHAT) return;

    // F1.2: Preserve Help entityData if the current store has help metadata
    // (set by HelpSidePanel.openAiNow) and the kickoff hasn't been consumed yet.
    const storeCtx = useConversationStore.getState().workspaceContext;
    const hasHelpOrigin = storeCtx?.entityData?.helpDocumentId && chatKickoffMessage;
    if (hasHelpOrigin) return;

    setWorkspaceContext(workspaceContext);

    // Only push the UI into split mode when the split panel is actually visible.
    if (shouldShowChatPanel && !isChatCollapsed) {
      setDisplayMode('split');
    }
  }, [
    workspaceContext,
    shouldShowChatPanel,
    isChatCollapsed,
    currentView,
    chatKickoffMessage,
    setWorkspaceContext,
    setDisplayMode,
  ]);

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
  const mobileGlobalRailBottomOffset = isMobile ? 64 + (safeAreaInsets.bottom || 0) + 12 : null;

  return (
    <div className="flex h-screen w-full bg-slate-100 dark:bg-navy-950 text-navy-900 dark:text-white font-sans overflow-hidden">
      {/* Global Floating Action Buttons - Order: Help, Feedback, Docs */}
      <div
        data-testid="global-fab-rail"
        className={`fixed z-50 flex flex-col gap-1 items-end pointer-events-none ${isMobile ? 'right-3' : 'right-4 top-[70%]'}`}
        style={
          mobileGlobalRailBottomOffset ? { bottom: `${mobileGlobalRailBottomOffset}px` } : undefined
        }
      >
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
      <HelpDeepLinkListener />
      <HelpSidePanel />
      <DocumentSidePanel />
      <FeedbackSidePanel />

      {/* Global access/paywall modal */}
      <AccessBlockedModal />
      <ForbiddenAccessBanner />

      {/* Demo Session Manager - Handles banner, tour, prompts, exit intent */}
      <DemoSessionManager />

      {/* First-run onboarding flow (new users; once, persisted to user_preferences) */}
      <FirstRunOnboarding />

      {/* First-login onboarding CTA (dismissible) */}
      <OnboardingFirstLoginCTA />

      {/* Contextual micro-video help (T073) — disabled for now */}
      {/* <MicroVideoHelpTrigger /> */}

      {/* Impersonation Banner */}
      {currentUser?.impersonatorId && (
        <div className="fixed top-0 left-0 right-0 h-10 bg-danger-600 text-white z-50 flex items-center justify-center gap-4 text-sm font-medium shadow-md">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-white dark:bg-navy-900 rounded-full animate-pulse"></span>
            Read-only impersonation mode
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
        <a
          href="#app-main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 z-50 bg-white dark:bg-navy-900 text-slate-900 dark:text-white border border-slate-300 dark:border-navy-600 rounded px-3 py-2 text-sm"
        >
          {t('layout.skipToContent', 'Skip to main content')}
        </a>
        {/* Header */}
        <div className="flex flex-col z-30 shrink-0">
          <DemoModeBanner />
          <GlobalAccessBanners
            onStartTrial={() => window.location.assign('/auth?action=trial')}
            onUpgrade={() => window.location.assign('/settings?tab=billing')}
            onContactSales={() => window.open('https://consultify.io/contact', '_blank')}
          />
          <AIFreezeBanner />

          <div className="relative z-50 h-12 border-b border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm dark:shadow-none flex items-center justify-between px-3 transition-colors duration-300">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden text-navy-700 dark:text-white mr-2"
                aria-label="Open menu"
              >
                <Menu />
              </button>
              <nav
                aria-label={t('layout.breadcrumb', 'Breadcrumb')}
                className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-500"
              >
                <span
                  className="hover:text-navy-900 dark:hover:text-white cursor-pointer transition-colors"
                  aria-current={!breadcrumbs?.[1] && breadcrumbs?.[0] ? 'page' : undefined}
                >
                  {breadcrumbs?.[0] || ''}
                </span>
                {breadcrumbs?.[1] ? (
                  <>
                    <ChevronRight size={14} className="mx-2 rtl:rotate-180" aria-hidden="true" />
                    <span className="text-navy-900 dark:text-white" aria-current="page">
                      {breadcrumbs[1]}
                    </span>
                  </>
                ) : null}
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <SystemHealth />
              <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>
              <LLMSelector compact={isMobile} />
              <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>

              <TaskDropdown />
              <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>
              <NotificationDropdown />

              {shouldShowChatPanel && (
                <>
                  <div className="h-4 w-px bg-slate-200 dark:bg-white/10"></div>
                  <button
                    type="button"
                    onClick={() => toggleChatCollapse()}
                    className={`hidden lg:flex w-9 h-9 items-center justify-center rounded-full transition-colors ${
                      isChatCollapsed
                        ? 'bg-primary-500 text-white hover:bg-primary-600'
                        : 'bg-primary-500/15 text-primary-600 dark:text-primary-400 hover:bg-primary-500/25'
                    }`}
                    title={
                      isChatCollapsed
                        ? t('layout.aiPanel.open', 'Open AI panel')
                        : t('layout.aiPanel.close', 'Close AI panel')
                    }
                    aria-label={
                      isChatCollapsed
                        ? t('layout.aiPanel.open', 'Open AI panel')
                        : t('layout.aiPanel.close', 'Close AI panel')
                    }
                    aria-pressed={!isChatCollapsed}
                  >
                    <Sparkles size={18} />
                  </button>
                </>
              )}

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
                  className="shrink-0 bg-white dark:bg-navy-900 border-r border-slate-200 dark:border-navy-700 hidden lg:flex flex-col h-full relative"
                >
                  <button
                    type="button"
                    onClick={() => toggleChatCollapse()}
                    className="absolute top-2 right-2 z-10 w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                    title={t('layout.aiPanel.close', 'Close AI panel')}
                    aria-label={t('layout.aiPanel.close', 'Close AI panel')}
                  >
                    <X size={16} />
                  </button>
                  <UnifiedChatPanel
                    mode="split"
                    workspaceContext={workspaceContext}
                    showModeToggle={true}
                    onModeToggle={() => {
                      if (workspaceContext?.type === 'document') {
                        navigate('/wordy');
                      } else {
                        expandToFullScreen();
                      }
                    }}
                    showHistoryTrigger={true}
                    showFocusMode={true}
                    kickoffMessage={chatKickoffMessage || undefined}
                    onKickoffConsumed={clearChatKickoffMessage}
                    systemPrompt={chatSystemPrompt || undefined}
                    quickPrompts={chatQuickPrompts || undefined}
                  />
                </div>
                {/* Resizer */}
                <div
                  className={`hidden lg:block w-1 hover:w-1.5 cursor-col-resize bg-transparent hover:bg-primary-500/50 active:bg-primary-500 transition-all ${isResizing ? 'bg-primary-500 w-1.5' : ''}`}
                  onMouseDown={startResizing}
                />
              </>
            )}

            {/* Main Content */}
            <div
              id="app-main-content"
              tabIndex={-1}
              className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto"
            >
              {children}
            </div>
          </div>
        </TrialExpiredGate>
      </main>
    </div>
  );
};
