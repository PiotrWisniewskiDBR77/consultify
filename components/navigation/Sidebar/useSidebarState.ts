/**
 * Sidebar State Hook - Apple HIG Design System
 * 
 * Extracts sidebar state management from the main component.
 */

import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useConversationStore } from '../../../store/useConversationStore';
import { useDeviceType } from '../../../hooks/useDeviceType';
import { AppView } from '../../../types';
import { getDefaultWorkspaceType, createWorkspaceContext } from '../../../types/workspace';
import { ActiveFloatingState, MenuItem } from './types';

export function useSidebarState() {
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
    displayMode,
    setDisplayMode,
    setWorkspaceContext,
    activeConversationId
  } = useConversationStore();

  const { isTablet, isMobile, isTouchDevice } = useDeviceType();

  // Floating menu state
  const [activeFloating, setActiveFloating] = useState<ActiveFloatingState | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Derived state
  const showFull = !isSidebarCollapsed && !isTablet;

  // Calculate completed views
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
  const navigateToFullChat = useCallback(() => {
    setDisplayMode('full');
    setCurrentView(AppView.AI_CHAT);
    toggleChatSlidingPanel();
  }, [setDisplayMode, setCurrentView, toggleChatSlidingPanel]);

  const navigateToViewWithChat = useCallback((viewId: AppView) => {
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

  const handleNavigate = useCallback((viewId: AppView) => {
    if (activeConversationId) {
      navigateToViewWithChat(viewId);
    } else {
      setCurrentView(viewId);
    }
    
    if (isMobile || (isTablet && isSidebarOpen)) {
      setIsSidebarOpen(false);
    }
  }, [activeConversationId, navigateToViewWithChat, setCurrentView, isMobile, isTablet, isSidebarOpen, setIsSidebarOpen]);

  // Floating menu handlers
  const handleItemMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>, item: MenuItem) => {
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
        title: item.label
      });
    } else {
      if (activeFloating && activeFloating.id !== item.id) {
        setActiveFloating(null);
      }
    }
  }, [showFull, activeFloating]);

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

// Need to import React for useMemo
import React from 'react';


