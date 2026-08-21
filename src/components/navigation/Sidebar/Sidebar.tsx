/**
 * Sidebar Component - Apple HIG Design System
 *
 * Main sidebar navigation component with collapsible states and floating submenus.
 * Refactored from 750+ line monolith into composable parts.
 */

import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useDeviceType } from '../../../hooks/useDeviceType';
import { Api } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';
import { useConversationStore } from '../../../store/useConversationStore';
import { AppView } from '../../../types';
import { createWorkspaceContext, getDefaultWorkspaceType } from '../../../types/workspace';
import {
  BETA_LOCKED_CODE,
  declutterMenu,
  dispatchBetaAccessBlocked,
  lockClosedBetaModules,
} from '../../../utils/betaAccess';
import { isNavDeclutterEnabled } from '../../../utils/navDeclutterFlag';
import {
  dispatchPilotAccessBlocked,
  getPilotLockedAreaDetail,
  isPilotAllowedMenuId,
} from '../../../utils/pilotAccess';
import {
  lockMainMenuForPublicProduction,
  shouldLockNonCoreModulesInPublicProduction,
} from '../../../utils/publicProduction';
import {
  isAdminOwnerOrSuperAdminRole,
  isPilotRestrictedRole,
  isSuperAdminRole,
} from '../../../utils/roleGuards';
import { FloatingSubmenu } from './FloatingSubmenu';
import {
  getAdminMenuItem,
  getMenuStructure,
  getOrganizationMenuItem,
  getSettingsMenuItem,
  getSuperAdminMenuItem,
  getViewName,
} from './menuConfig';
import { NavItem } from './NavItem';
import { SidebarFooter } from './SidebarFooter';
import { SidebarHeader } from './SidebarHeader';
import { ActiveFloatingState, MenuItem } from './types';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { isTablet, isMobile, isTouchDevice } = useDeviceType();

  // Prefetch route modules / data on hover to reduce perceived navigation latency.
  const prefetchedRef = React.useRef<Set<string>>(new Set());

  // NOTE (React 19 + useSyncExternalStore):
  // Avoid selectors returning new objects/arrays each call (even with shallow),
  // because it can trigger "getSnapshot should be cached" warnings/loops.
  const currentView = useAppStore((s) => s.currentView);
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const navigateWithChatContext = useAppStore((s) => s.navigateWithChatContext);
  const returnToFullChat = useAppStore((s) => s.returnToFullChat);
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
  const currentProjectId = useAppStore((s) => s.currentProjectId);

  const {
    setDisplayMode,
    setWorkspaceContext,
    activeConversationId,
    isSidebarOpen: isChatHistorySidebarOpen,
    toggleSidebar: toggleChatHistorySidebar,
  } = useConversationStore();

  // Floating menu state
  const [activeFloating, setActiveFloating] = React.useState<ActiveFloatingState | null>(null);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  // Derived state
  // NOTE: previously we forced collapsed sidebar on tablets (<=1023px).
  // That made "expanded" mode effectively impossible in narrower desktop windows / split-screen.
  // We now allow expanded mode anywhere except mobile.
  const showFull = !isSidebarCollapsed && !isMobile;
  const lockNonCoreModulesOnPublicProduction = React.useMemo(
    () => shouldLockNonCoreModulesInPublicProduction(),
    []
  );
  const publicProductionLockedMessage =
    'This module is visible in the platform overview, but access is disabled on public production. Please use Chat or Interview.';

  // Menu configuration
  const menuStructure = React.useMemo(
    () =>
      lockMainMenuForPublicProduction(
        getMenuStructure(t, currentUser?.journeyState),
        lockNonCoreModulesOnPublicProduction,
        publicProductionLockedMessage,
        '/interview'
      ),
    [
      t,
      currentUser?.journeyState,
      lockNonCoreModulesOnPublicProduction,
      publicProductionLockedMessage,
    ]
  );
  const visibleMenuStructure = React.useMemo(() => {
    if (!isPilotRestrictedRole(currentUser?.role)) {
      return menuStructure;
    }

    const decoratePilotItem = (item: MenuItem): MenuItem => {
      const decoratedChildren = item.subItems?.map((subItem) => decoratePilotItem(subItem));

      if (isPilotAllowedMenuId(item.id)) {
        return {
          ...item,
          subItems: decoratedChildren,
        };
      }

      const lockedDetail = getPilotLockedAreaDetail(item.id, item.label);
      return {
        ...item,
        subItems: decoratedChildren,
        isLocked: true,
        lockedMessage: lockedDetail.message,
        lockedCtaHref: lockedDetail.href,
      };
    };

    return menuStructure.map((item) => decoratePilotItem(item));
  }, [currentUser?.role, menuStructure]);
  // Beta gating: closed-beta modules are locked for non-administrators. They see
  // the polished "access restricted" plate and cannot enter; admins keep access.
  const betaLockedMessage = t('access.blocked.BETA_LOCKED');
  // Nav declutter (Q1, `ff.nav_declutter`, default OFF — see navDeclutterFlag.ts).
  // OFF: behavior below is skipped entirely, nav is unchanged from today. ON:
  // closed-beta modules (Audits/Meeting) are hidden even from admins, and the
  // 'beta' badge is stripped from GA modules (Results/Finance/Materials).
  const navDeclutterEnabled = isNavDeclutterEnabled();
  const gatedMenuStructure = React.useMemo(() => {
    const locked = lockClosedBetaModules(
      visibleMenuStructure,
      currentUser?.role,
      betaLockedMessage
    );
    return navDeclutterEnabled ? declutterMenu(locked) : locked;
  }, [visibleMenuStructure, currentUser?.role, betaLockedMessage, navDeclutterEnabled]);
  const adminMenuItem = React.useMemo(() => getAdminMenuItem(t), [t]);
  const organizationMenuItem = React.useMemo(() => getOrganizationMenuItem(t), [t]);
  const settingsMenuItem = React.useMemo(() => getSettingsMenuItem(t), [t]);
  const superAdminMenuItem = React.useMemo(() => getSuperAdminMenuItem(t), [t]);

  // Completed views
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

  const navigateToFullChat = React.useCallback(() => {
    setDisplayMode('full');
    if (typeof returnToFullChat === 'function') {
      returnToFullChat();
      return;
    }
    setCurrentView(AppView.AI_CHAT);
  }, [returnToFullChat, setCurrentView, setDisplayMode]);

  const navigateToView = React.useCallback(
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
    [currentProjectId, navigateWithChatContext, setDisplayMode, setWorkspaceContext]
  );

  const handleItemClick = React.useCallback(
    (item: MenuItem) => {
      // Enhanced diagnostic logging for navigation debugging
      console.log('[Sidebar] ====== NAVIGATION START ======');
      console.log('[Sidebar] handleItemClick:', {
        itemId: item.id,
        viewId: item.viewId,
        label: item.label,
        currentView,
        hasActiveConversation: !!activeConversationId,
        userRole: currentUser?.role,
        timestamp: new Date().toISOString(),
      });

      const isLocked =
        item.requiresView &&
        !completedViews.includes(item.requiresView) &&
        !isAdminOwnerOrSuperAdminRole(currentUser?.role);

      if (isLocked) {
        console.warn('[Sidebar] BLOCKED - Item is locked:', {
          itemId: item.id,
          requiresView: item.requiresView,
          completedViews,
        });
        return;
      }

      if (item.isLocked) {
        if (item.lockedCode === BETA_LOCKED_CODE) {
          dispatchBetaAccessBlocked(item.lockedMessage);
        } else {
          dispatchPilotAccessBlocked({
            message: item.lockedMessage,
            href: item.lockedCtaHref,
          });
        }
        return;
      }

      // AI Chat special handling
      if (item.id === 'AI_CHAT') {
        console.log('[Sidebar] AI_CHAT special handling:', {
          isCurrentlyOnChat: currentView === AppView.AI_CHAT,
          action: currentView === AppView.AI_CHAT ? 'togglePanel' : 'navigateToFullChat',
        });
        if (currentView === AppView.AI_CHAT) {
          toggleChatHistorySidebar();
        } else {
          navigateToFullChat();
        }
        return;
      }

      if (item.viewId) {
        console.log('[Sidebar] Executing navigation:', {
          targetView: item.viewId,
          method: 'navigateToView',
        });

        try {
          navigateToView(item.viewId);
          console.log('[Sidebar] Navigation call completed successfully');
        } catch (error) {
          console.error('[Sidebar] NAVIGATION ERROR:', error);
        }

        if (isMobile || (isTablet && isSidebarOpen)) {
          setIsSidebarOpen(false);
        }
      } else {
        console.error('[Sidebar] INVALID - Item has no viewId:', {
          itemId: item.id,
          item,
        });
      }

      console.log('[Sidebar] ====== NAVIGATION END ======');
    },
    [
      completedViews,
      currentUser?.role,
      currentView,
      toggleChatHistorySidebar,
      navigateToFullChat,
      navigateToView,
      activeConversationId,
      isMobile,
      isTablet,
      isSidebarOpen,
      setIsSidebarOpen,
    ]
  );

  // Floating menu handlers
  const handleItemMouseEnter = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>, item: MenuItem) => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);

      // Warm up the most-used modules & their first API calls.
      // This is especially helpful in dev (Vite transforms on-demand) and on large routes like My Work.
      try {
        if (item.id && !prefetchedRef.current.has(item.id)) {
          prefetchedRef.current.add(item.id);

          if (item.viewId === AppView.MY_WORK) {
            void import('@/views/MyWorkView');
            void Api.getPersonalTasks().catch(() => {});
          }
        }
      } catch {
        // ignore prefetch errors
      }

      const hasSubItems = item.subItems && item.subItems.length > 0;
      const shouldShow = hasSubItems || !showFull;

      if (shouldShow) {
        const rect = e.currentTarget.getBoundingClientRect();
        setActiveFloating({
          id: item.id,
          rect,
          items: item.subItems || [],
          title: item.label,
        });
      } else if (activeFloating?.id !== item.id) {
        setActiveFloating(null);
      }
    },
    [showFull, activeFloating?.id]
  );

  const handleMouseLeave = React.useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => setActiveFloating(null), 150);
  }, []);

  const handleFlyoutMouseEnter = React.useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  }, []);

  const handleFlyoutMouseLeave = React.useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => setActiveFloating(null), 150);
  }, []);

  const handleFlyoutNavigate = React.useCallback(
    (item: MenuItem) => {
      if (item.isLocked) {
        if (item.lockedCode === BETA_LOCKED_CODE) {
          dispatchBetaAccessBlocked(item.lockedMessage);
        } else {
          dispatchPilotAccessBlocked({
            message: item.lockedMessage,
            href: item.lockedCtaHref,
          });
        }
        setActiveFloating(null);
        return;
      }
      if (!item.viewId) return;
      navigateToView(item.viewId);
      setActiveFloating(null);
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
    },
    [navigateToView, setIsSidebarOpen]
  );

  const handleFooterNavigate = React.useCallback(
    (view: AppView) => {
      navigateToView(view);
    },
    [navigateToView]
  );

  // Render nav item helper
  const renderNavItem = (item: MenuItem) => (
    <NavItem
      key={item.id}
      item={item}
      currentView={currentView}
      completedViews={completedViews}
      showFull={showFull}
      isTouchDevice={isTouchDevice}
      isChatSlidingPanelOpen={isChatHistorySidebarOpen}
      isFloatingActive={activeFloating?.id === item.id}
      currentUserRole={currentUser?.role as any}
      onMouseEnter={handleItemMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleItemClick}
      getViewName={(view) => getViewName(view, t)}
      t={t as any}
    />
  );

  const sidebarWidthClass = showFull ? 'w-64' : 'w-16';

  React.useEffect(() => {
    if (!isSidebarOpen || (!isMobile && !isTablet)) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, isSidebarOpen, isTablet, setIsSidebarOpen]);

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
            data-testid="mobile-sidebar-overlay"
            className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container - z-[60] ensures it's above chat history sidebar (z-40) */}
      <motion.div
        layout
        data-tour="sidebar-nav"
        className={`
          fixed inset-y-0 left-0 z-[60]
          bg-slate-50 dark:bg-navy-950 backdrop-blur-xl
          flex flex-col
          ${sidebarWidthClass}
          ${
            isSidebarOpen
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
          {/* Menu Items */}
          <div className={`space-y-0.5 pb-2 ${showFull ? 'pt-4 px-2' : 'pt-4 px-1'}`}>
            {gatedMenuStructure.map(renderNavItem)}
          </div>
        </nav>

        {/* Footer */}
        <SidebarFooter
          showFull={showFull}
          onLogout={logout}
          onNavigate={handleFooterNavigate}
          t={t as any}
          showPartnerPortal
        >
          {isAdminOwnerOrSuperAdminRole(currentUser?.role) && renderNavItem(organizationMenuItem)}
          {isAdminOwnerOrSuperAdminRole(currentUser?.role) && renderNavItem(adminMenuItem)}
          {isSuperAdminRole(currentUser?.role) && renderNavItem(superAdminMenuItem)}
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
          onItemClick={handleFlyoutNavigate}
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
