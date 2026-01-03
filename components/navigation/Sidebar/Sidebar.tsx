/**
 * Sidebar Component - Apple HIG Design System
 * 
 * Main sidebar navigation component with collapsible states and floating submenus.
 * Refactored from 750+ line monolith into composable parts.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { AppView, UserRole } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { useConversationStore } from '../../../store/useConversationStore';
import { useDeviceType } from '../../../hooks/useDeviceType';
import { getDefaultWorkspaceType, createWorkspaceContext } from '../../../types/workspace';
import { PhaseIndicator } from '../../PMO/PhaseIndicator';
import { SidebarHeader } from './SidebarHeader';
import { SidebarFooter } from './SidebarFooter';
import { NavItem } from './NavItem';
import { FloatingSubmenu } from './FloatingSubmenu';
import {
  getMenuStructure,
  getAdminMenuItem,
  getOrganizationMenuItem,
  getSettingsMenuItem,
  getViewName,
} from './menuConfig';
import { MenuItem, ActiveFloatingState } from './types';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { isTablet, isMobile, isTouchDevice } = useDeviceType();

  const {
    currentView,
    setCurrentView,
    logout,
    isSidebarOpen,
    setIsSidebarOpen,
    currentUser,
    freeSessionData,
    fullSessionData,
    theme,
    isSidebarCollapsed,
    toggleSidebarCollapse,
    isChatSlidingPanelOpen,
    toggleChatSlidingPanel,
    navigateWithChatContext,
    currentProjectId
  } = useAppStore();

  const {
    setDisplayMode,
    setWorkspaceContext,
    activeConversationId
  } = useConversationStore();

  // Floating menu state
  const [activeFloating, setActiveFloating] = React.useState<ActiveFloatingState | null>(null);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  // Derived state
  const showFull = !isSidebarCollapsed && !isTablet;

  // Menu configuration
  const menuStructure = React.useMemo(
    () => getMenuStructure(t, currentUser?.journeyState),
    [t, currentUser?.journeyState]
  );
  const adminMenuItem = React.useMemo(() => getAdminMenuItem(t), [t]);
  const organizationMenuItem = React.useMemo(() => getOrganizationMenuItem(t), [t]);
  const settingsMenuItem = React.useMemo(() => getSettingsMenuItem(t), [t]);

  // Completed views
  const completedViews = React.useMemo(() => {
    const completed: AppView[] = [];
    if (freeSessionData.step1Completed) completed.push(AppView.QUICK_STEP1_PROFILE);
    if (freeSessionData.step2Completed) completed.push(AppView.QUICK_STEP2_USER_CONTEXT);
    if (freeSessionData.step3Completed) completed.push(AppView.QUICK_STEP3_EXPECTATIONS);
    if (fullSessionData.step1Completed) completed.push(AppView.FULL_STEP1_ASSESSMENT);
    if (fullSessionData.step2Completed) completed.push(AppView.FULL_STEP2_INITIATIVES);
    if (fullSessionData.step3Completed) completed.push(AppView.FULL_STEP3_ROADMAP);
    if (fullSessionData.step4Completed) completed.push(AppView.FULL_STEP4_ROI);
    if (fullSessionData.step5Completed) completed.push(AppView.FULL_STEP5_EXECUTION);
    return completed;
  }, [freeSessionData, fullSessionData]);

  // Navigation handlers
  const navigateToFullChat = React.useCallback(() => {
    setDisplayMode('full');
    setCurrentView(AppView.AI_CHAT);
    toggleChatSlidingPanel();
  }, [setDisplayMode, setCurrentView, toggleChatSlidingPanel]);

  const navigateToViewWithChat = React.useCallback((viewId: AppView) => {
    setDisplayMode('split');
    const workspaceType = getDefaultWorkspaceType(viewId);
    const context = createWorkspaceContext(viewId, workspaceType, {
      projectId: currentProjectId || undefined
    });
    setWorkspaceContext(context);
    navigateWithChatContext(viewId, {
      preserveChat: true,
      workspaceContext: context
    });
  }, [setDisplayMode, setWorkspaceContext, navigateWithChatContext, currentProjectId]);

  const handleItemClick = React.useCallback((item: MenuItem) => {
    const isLocked = item.requiresView &&
      !completedViews.includes(item.requiresView) &&
      !(currentUser?.role === UserRole.ADMIN || currentUser?.role === 'SUPERADMIN');

    if (isLocked) return;

    // AI Chat special handling
    if (item.id === 'AI_CHAT') {
      if (currentView === AppView.AI_CHAT) {
        toggleChatSlidingPanel();
      } else {
        navigateToFullChat();
      }
      return;
    }

    if (item.viewId) {
      if (activeConversationId) {
        navigateToViewWithChat(item.viewId);
      } else {
        setCurrentView(item.viewId);
      }

      if (isMobile || (isTablet && isSidebarOpen)) {
        setIsSidebarOpen(false);
      }
    }
  }, [
    completedViews,
    currentUser?.role,
    currentView,
    toggleChatSlidingPanel,
    navigateToFullChat,
    activeConversationId,
    navigateToViewWithChat,
    setCurrentView,
    isMobile,
    isTablet,
    isSidebarOpen,
    setIsSidebarOpen
  ]);

  // Floating menu handlers
  const handleItemMouseEnter = React.useCallback((e: React.MouseEvent<HTMLDivElement>, item: MenuItem) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);

    const hasSubItems = item.subItems && item.subItems.length > 0;
    const shouldShow = hasSubItems || !showFull;

    if (shouldShow) {
      const rect = e.currentTarget.getBoundingClientRect();
      setActiveFloating({
        id: item.id,
        rect,
        items: item.subItems || [],
        title: item.label
      });
    } else if (activeFloating?.id !== item.id) {
      setActiveFloating(null);
    }
  }, [showFull, activeFloating?.id]);

  const handleMouseLeave = React.useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => setActiveFloating(null), 150);
  }, []);

  const handleFlyoutMouseEnter = React.useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  }, []);

  const handleFlyoutMouseLeave = React.useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => setActiveFloating(null), 150);
  }, []);

  const handleFlyoutNavigate = React.useCallback((viewId: AppView) => {
    if (activeConversationId) {
      navigateToViewWithChat(viewId);
    } else {
      setCurrentView(viewId);
    }
    setActiveFloating(null);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, [activeConversationId, navigateToViewWithChat, setCurrentView, setIsSidebarOpen]);

  // Render nav item helper
  const renderNavItem = (item: MenuItem) => (
    <NavItem
      key={item.id}
      item={item}
      currentView={currentView}
      completedViews={completedViews}
      showFull={showFull}
      isTouchDevice={isTouchDevice}
      isChatSlidingPanelOpen={isChatSlidingPanelOpen}
      isFloatingActive={activeFloating?.id === item.id}
      currentUserRole={currentUser?.role}
      onMouseEnter={handleItemMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleItemClick}
      getViewName={(view) => getViewName(view, t)}
      t={t as any}
    />
  );

  const sidebarWidthClass = showFull ? 'w-64' : 'w-16';

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <motion.div
        layout
        data-tour="sidebar-nav"
        className={`
          fixed inset-y-0 left-0 z-50
          bg-white/95 dark:bg-navy-900/95 backdrop-blur-hig
          border-r border-slate-200 dark:border-white/5
          flex flex-col
          ${sidebarWidthClass}
          ${isSidebarOpen
            ? 'translate-x-0'
            : isMobile
              ? '-translate-x-full'
              : isTablet
                ? 'translate-x-0'
                : 'lg:translate-x-0 -translate-x-full'
          }
          safe-area-pt safe-area-pb
        `}
        initial={false}
        animate={{
          width: showFull ? 256 : 64,
          boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <SidebarHeader
          showFull={showFull}
          theme={theme}
          onToggleCollapse={toggleSidebarCollapse}
          t={t as any}
        />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
          {/* PMO Phase Indicator */}
          <div className={`${showFull ? 'px-3 pt-4' : 'px-2 pt-4'}`}>
            <PhaseIndicator compact={!showFull} />
          </div>

          {/* Menu Items */}
          <div className={`space-y-0.5 pb-2 ${showFull ? 'pt-4 px-2' : 'pt-4 px-1'}`}>
            {menuStructure.map(renderNavItem)}
          </div>
        </nav>

        {/* Footer */}
        <SidebarFooter
          showFull={showFull}
          onLogout={logout}
          t={t as any}
        >
          {currentUser?.role === UserRole.ADMIN && renderNavItem(organizationMenuItem)}
          {currentUser?.role === UserRole.ADMIN && renderNavItem(adminMenuItem)}
          {renderNavItem(settingsMenuItem)}
        </SidebarFooter>
      </motion.div>

      {/* Floating Submenu */}
      {activeFloating && (
        <FloatingSubmenu
          parentRect={activeFloating.rect}
          items={activeFloating.items}
          title={activeFloating.title}
          onClose={() => setActiveFloating(null)}
          onNavigate={handleFlyoutNavigate}
          currentView={currentView}
          onMouseEnter={handleFlyoutMouseEnter}
          onMouseLeave={handleFlyoutMouseLeave}
          theme={theme}
        />
      )}
    </>
  );
};

export default Sidebar;


