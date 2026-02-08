/**
 * Sidebar State Hook - Apple HIG Design System
 *
 * Extracts sidebar state management from the main component.
 */

import React, { useCallback, useRef, useState } from 'react';

import { useDeviceType } from '../../../hooks/useDeviceType';
import { useAppStore } from '../../../store/useAppStore';
import { useConversationStore } from '../../../store/useConversationStore';
import { AppView } from '../../../types';
import { createWorkspaceContext, getDefaultWorkspaceType } from '../../../types/workspace';
import { ActiveFloatingState, MenuItem } from './types';

export function useSidebarState() {
  // NOTE (React 19 + useSyncExternalStore):
  // Avoid selectors returning new objects/arrays each call (even with shallow),
  // because it can trigger "getSnapshot should be cached" warnings/loops.
  const currentView = useAppStore((s) => s.currentView);
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const logout = useAppStore((s) => s.logout);
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen);
  const setIsSidebarOpen = useAppStore((s) => s.setIsSidebarOpen);
  const currentUser = useAppStore((s) => s.currentUser);
  const freeStep1Completed = useAppStore((s) => Boolean(s.freeSessionData?.step1Completed));
  const freeStep2Completed = useAppStore((s) => Boolean(s.freeSessionData?.step2Completed));
  const freeStep3Completed = useAppStore((s) => Boolean(s.freeSessionData?.step3Completed));
  const fullStep1Completed = useAppStore((s) => Boolean(s.fullSessionData?.step1Completed));
  const fullStep2Completed = useAppStore((s) => Boolean(s.fullSessionData?.step2Completed));
  const fullStep3Completed = useAppStore((s) => Boolean(s.fullSessionData?.step3Completed));
  const fullStep4Completed = useAppStore((s) => Boolean(s.fullSessionData?.step4Completed));
  const fullStep5Completed = useAppStore((s) => Boolean(s.fullSessionData?.step5Completed));
  const theme = useAppStore((s) => s.theme);
  const isSidebarCollapsed = useAppStore((s) => s.isSidebarCollapsed);
  const toggleSidebarCollapse = useAppStore((s) => s.toggleSidebarCollapse);
  const isChatSlidingPanelOpen = useAppStore((s) => s.isChatSlidingPanelOpen);
  const toggleChatSlidingPanel = useAppStore((s) => s.toggleChatSlidingPanel);
  const navigateWithChatContext = useAppStore((s) => s.navigateWithChatContext);
  const currentProjectId = useAppStore((s) => s.currentProjectId);

  const { displayMode, setDisplayMode, setWorkspaceContext, activeConversationId } =
    useConversationStore();

  const { isTablet, isMobile, isTouchDevice } = useDeviceType();

  // Floating menu state
  const [activeFloating, setActiveFloating] = useState<ActiveFloatingState | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Derived state
  // Keep consistent with Sidebar.tsx: allow expanded mode on tablet/narrow windows, only block on mobile.
  const showFull = !isSidebarCollapsed && !isMobile;

  // Calculate completed views
  const completedViews = React.useMemo(() => {
    const completed: AppView[] = [];
    if (freeStep1Completed) completed.push(AppView.QUICK_STEP1_PROFILE);
    if (freeStep2Completed) completed.push(AppView.QUICK_STEP2_USER_CONTEXT);
    if (freeStep3Completed) completed.push(AppView.QUICK_STEP3_EXPECTATIONS);
    if (fullStep1Completed) completed.push(AppView.FULL_STEP1_ASSESSMENT);
    if (fullStep2Completed) completed.push(AppView.FULL_STEP2_INITIATIVES);
    if (fullStep3Completed) completed.push(AppView.FULL_STEP3_ROADMAP);
    if (fullStep4Completed) completed.push(AppView.FULL_STEP4_ROI);
    if (fullStep5Completed) completed.push(AppView.FULL_STEP5_EXECUTION);
    return completed;
  }, [
    freeStep1Completed,
    freeStep2Completed,
    freeStep3Completed,
    fullStep1Completed,
    fullStep2Completed,
    fullStep3Completed,
    fullStep4Completed,
    fullStep5Completed,
  ]);

  // Navigation handlers
  const navigateToFullChat = useCallback(() => {
    setDisplayMode('full');
    setCurrentView(AppView.AI_CHAT);
    toggleChatSlidingPanel();
  }, [setDisplayMode, setCurrentView, toggleChatSlidingPanel]);

  const navigateToViewWithChat = useCallback(
    (viewId: AppView) => {
      setDisplayMode('split');

      const workspaceType = getDefaultWorkspaceType(viewId);
      const context = createWorkspaceContext(viewId, workspaceType, {
        projectId: currentProjectId || undefined,
      });
      setWorkspaceContext(context);

      navigateWithChatContext(viewId, {
        preserveChat: true,
        workspaceContext: context,
      });
    },
    [setDisplayMode, setWorkspaceContext, navigateWithChatContext, currentProjectId]
  );

  const handleNavigate = useCallback(
    (viewId: AppView) => {
      if (activeConversationId) {
        navigateToViewWithChat(viewId);
      } else {
        setCurrentView(viewId);
      }

      if (isMobile || (isTablet && isSidebarOpen)) {
        setIsSidebarOpen(false);
      }
    },
    [
      activeConversationId,
      navigateToViewWithChat,
      setCurrentView,
      isMobile,
      isTablet,
      isSidebarOpen,
      setIsSidebarOpen,
    ]
  );

  // Floating menu handlers
  const handleItemMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, item: MenuItem) => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);

      const hasSubItems = item.subItems && item.subItems.length > 0;
      const shouldShow = hasSubItems || !showFull;

      if (shouldShow) {
        const rect = e.currentTarget.getBoundingClientRect();
        const itemsToShow = item.subItems || [];

        setActiveFloating({
          id: item.id,
          rect,
          items: itemsToShow,
          title: item.label,
        });
      } else {
        if (activeFloating && activeFloating.id !== item.id) {
          setActiveFloating(null);
        }
      }
    },
    [showFull, activeFloating]
  );

  const handleMouseLeave = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => {
      setActiveFloating(null);
    }, 150);
  }, []);

  const handleFlyoutMouseEnter = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  }, []);

  const handleFlyoutMouseLeave = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => {
      setActiveFloating(null);
    }, 150);
  }, []);

  const closeFlyout = useCallback(() => {
    setActiveFloating(null);
  }, []);

  return {
    // State
    currentView,
    currentUser,
    theme,
    showFull,
    isSidebarOpen,
    isSidebarCollapsed,
    isMobile,
    isTablet,
    isTouchDevice,
    isChatSlidingPanelOpen,
    activeFloating,
    completedViews,
    activeConversationId,

    // Actions
    logout,
    setIsSidebarOpen,
    toggleSidebarCollapse,
    toggleChatSlidingPanel,
    navigateToFullChat,
    navigateToViewWithChat,
    handleNavigate,
    handleItemMouseEnter,
    handleMouseLeave,
    handleFlyoutMouseEnter,
    handleFlyoutMouseLeave,
    closeFlyout,
  };
}
