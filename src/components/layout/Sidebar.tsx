import {
  Accessibility, // Accessibility settings
  Activity,
  Bell, // Notifications
  BookOpen,
  Bot, // AI/Cyber?
  Brain, // AI
  Briefcase, // My Work
  Building2, // Projects
  Calculator, // Economics module
  Calendar, // Roadmap
  CheckCircle2,
  ChevronRight,
  ClipboardList, // Work preferences
  Cpu, // Digital (M2_2)
  CreditCard, // Billing
  Database, // Data (M2_4)
  Eye, // Step D: Executive View
  EyeOff, // Privacy settings
  Factory, // Organization
  FileOutput, // Reports export
  FileText, // Reports
  Fingerprint, // Cyber
  Globe, // Megatrends
  Layers,
  LayoutDashboard,
  LayoutGrid, // Dashboard preferences
  Lightbulb, // Initiatives
  Link, // Integrations
  Lock,
  LogOut,
  MessageSquare, // Feedback
  Palette, // Studio
  PanelLeftClose,
  Pin,
  Presentation,
  Rocket,
  Scale, // Challenges
  Settings,
  Shield,
  Sparkles,
  Target, // Goals
  TrendingUp,
  UserCircle, // Profile
  Users, // Culture (M2_5) / Users
  Workflow, // Processes (M2_1)
  Wrench, // Tools
  Zap, // Strategy/Quick
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useDeviceType } from '../../hooks/useDeviceType';
import { APP_VIEW_TO_ROUTE } from '../../routes/routeConfig';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import { useAppStore } from '../../store/useAppStore';
import { useConversationStore } from '../../store/useConversationStore';
import { AppView, UserRole } from '../../types';
import { createWorkspaceContext, getDefaultWorkspaceType } from '../../types/workspace';
import { isSuperAdminRole } from '../../utils/roleGuards';
import { PhaseIndicator } from '../PMO/PhaseIndicator';

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  viewId?: AppView;
  subItems?: MenuItem[];
  requiresView?: AppView;
  isFloating?: boolean; // Deprecated but kept for compatibility logic if needed (we default to true now)
  badge?: 'beta' | 'new' | 'soon'; // Optional badge for items in development
}

// ---------------------------------------------------------------------------
// Floating Submenu Portal Component
// ---------------------------------------------------------------------------

interface FloatingMenuProps {
  parentRect: DOMRect;
  items: MenuItem[];
  onClose: () => void;
  onNavigate: (viewId: AppView) => void;
  currentView: AppView;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  theme: 'light' | 'dark' | 'system';
  title?: string;
  parentId?: string; // To identify if this is Admin menu
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({
  parentRect,
  items,
  onNavigate,
  currentView,
  onMouseEnter,
  onMouseLeave,
  theme,
  title,
  parentId,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!menuRef.current) return;

    // Initial position: to the right of the parent, aligned with top
    let top = parentRect.top;
    const left = parentRect.right + 8; // 8px gap

    // Adjust for viewport height
    const menuHeight = menuRef.current.offsetHeight;
    const windowHeight = window.innerHeight;

    // If menu goes below viewport, shift it up
    if (top + menuHeight > windowHeight - 20) {
      top = windowHeight - menuHeight - 20;
    }

    // Ensure it doesn't go above top
    if (top < 10) top = 10;

    setPosition({ top, left });
  }, [parentRect]);

  const bgColor = theme === 'dark' ? 'bg-navy-900' : 'bg-white';
  const borderColor =
    theme === 'dark' ? 'border-c-border-subtle' : 'border-slate-200 dark:border-navy-700';
  const textColor = theme === 'dark' ? 'text-slate-600' : 'text-slate-600 dark:text-slate-400';
  const hoverBg =
    theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-navy-800/20';
  const hoverText = theme === 'dark' ? 'hover:text-white' : 'hover:text-navy-900';
  const activeBg = theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50';
  const activeText = theme === 'dark' ? 'text-blue-300' : 'text-blue-700';

  const hasItems = items && items.length > 0;

  // Determine position style
  // Use opacity 0 until position is set (checked by top !== 0) to avoid "jump" from 0,0
  const isPositioned = position.top !== 0;

  return createPortal(
    <div
      ref={menuRef}
      className={`fixed z-context-menu w-64 py-2 rounded-xl shadow-2xl border ${bgColor} ${borderColor} transition-opacity duration-200 ease-out ${isPositioned ? 'opacity-100' : 'opacity-0'}`}
      style={{ top: position.top, left: position.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex flex-col">
        {title && (
          <div
            className={`px-4 py-3 text-sm font-bold ${hasItems ? 'border-b mb-1' : ''} ${theme === 'dark' ? 'border-c-border-subtle text-white' : 'border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-200'}`}
          >
            {title}
          </div>
        )}
        {items.map((sub) => {
          const isActive = sub.viewId === currentView;
          return (
            <button
              key={sub.id}
              onClick={() => {
                if (sub.viewId) {
                  onNavigate(sub.viewId);
                }
              }}
              className={`
                 w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors
                 ${isActive ? `${activeBg} ${activeText}` : `${textColor} ${hoverBg} ${hoverText}`}
               `}
            >
              {sub.icon &&
                React.cloneElement(sub.icon as React.ReactElement<{ size: number }>, { size: 16 })}
              {sub.label}
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );
};

// ---------------------------------------------------------------------------
// Main Sidebar Component
// ---------------------------------------------------------------------------

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();

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
    navigateWithChatContext,
    currentProjectId,
  } = useAppStore();

  // Unified Chat System: Conversation store for display mode management
  const {
    displayMode,
    setDisplayMode,
    setWorkspaceContext,
    expandToFullScreen,
    collapseToSplit,
    activeConversationId,
    isSidebarOpen: isChatHistorySidebarOpen,
    toggleSidebar: toggleChatHistorySidebar,
  } = useConversationStore();

  const { t } = useTranslation();
  const { isTablet, isMobile, isTouchDevice } = useDeviceType();

  // On tablet: default to collapsed sidebar unless manually expanded
  // Derived state: Show full content if Pinned (not collapsed)
  // On tablet, we force mini mode unless user explicitly expands
  const showFull = !isSidebarCollapsed && !isTablet;

  // Floating Menu State
  const [activeFloating, setActiveFloating] = useState<{
    id: string;
    rect: DOMRect;
    items: MenuItem[];
    title: string;
  } | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout>(undefined);

  // =========================================================================
  // UNIFIED CHAT SYSTEM: Navigation Handlers
  // =========================================================================

  /**
   * Navigate to AI Chat full-screen mode
   * - Sets display mode to 'full'
   * - Opens the chat sliding panel
   */
  const navigateToFullChat = useCallback(() => {
    setDisplayMode('full');
    setCurrentView(AppView.AI_CHAT);
    // Open the chat history sidebar on entry (Claude-style).
    toggleChatHistorySidebar();
  }, [setDisplayMode, setCurrentView, toggleChatHistorySidebar]);

  /**
   * Navigate to a view while preserving chat context
   * - Sets display mode to 'split'
   * - Updates workspace context for AI awareness
   * - Preserves active conversation
   */
  const navigateToViewWithChat = useCallback(
    (viewId: AppView) => {
      // Update display mode to split
      setDisplayMode('split');

      // Create workspace context for the target view
      const workspaceType = getDefaultWorkspaceType(viewId);
      const context = createWorkspaceContext(viewId, workspaceType, {
        projectId: currentProjectId || undefined,
      });
      setWorkspaceContext(context);

      // Navigate using the app store
      navigateWithChatContext(viewId, {
        preserveChat: true,
        workspaceContext: context,
      });
    },
    [setDisplayMode, setWorkspaceContext, navigateWithChatContext, currentProjectId]
  );

  // Calculate completed views logic
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

  // Menu Definition - Simplified Navigation
  const menuStructure: MenuItem[] = [
    // 1. AI Chat - podstawowa rozmowa
    {
      id: 'AI_CHAT',
      label: t('sidebar.aiChat', 'AI Chat'),
      icon: <MessageSquare size={20} />,
      viewId: AppView.AI_CHAT,
    },
    // 1.5 My Work - centrum pracy (Inbox / Focus / Tasks / Decisions)
    {
      id: 'MY_WORK',
      label: t('myWork.title', 'My Work'),
      icon: <Briefcase size={20} />,
      viewId: AppView.MY_WORK,
    },
    // 2. Interview - ustrukturyzowana rozmowa z AI konsultantem
    {
      id: 'INTERVIEW',
      label: t('sidebar.interview', 'Interview'),
      icon: <Brain size={20} />,
      viewId: AppView.DISCOVERY_CONSULTANT,
    },
    // 3. Tools - unified tool hub (V3: Library → Sessions → Outputs → Initiatives)
    {
      id: 'DISCOVERY_TOOLS',
      label: t('sidebar.discoveryTools', 'Tools'),
      icon: <Wrench size={20} />,
      viewId: AppView.DISCOVERY_TOOLS,
      badge: 'new',
    },
    // 4. Assessment (Licensed Tools) - DRD/SIRI/ADMA/Lean
    {
      id: 'MODULE_ASSESSMENT',
      label: t('sidebar.assessment', 'Assessment'),
      icon: <CheckCircle2 size={20} />,
      viewId: AppView.ASSESSMENT_OVERVIEW,
    },
    // 5. Initiatives - zarządzanie inicjatywami (DRAFT→APPROVED)
    {
      id: 'MODULE_INITIATIVES',
      label: t('sidebar.initiatives', 'Initiatives'),
      icon: <Lightbulb size={20} />,
      viewId: AppView.FULL_STEP2_INITIATIVES,
    },
    // 6. Execution - realizacja zatwierdzonych inicjatyw (EXECUTING→DONE)
    {
      id: 'MODULE_EXECUTION',
      label: t('sidebar.execution', 'Execution'),
      icon: <Rocket size={20} />,
      viewId: AppView.FULL_STEP5_EXECUTION,
    },
    // 7. Results - śledzenie efektów zrealizowanych inicjatyw (KPI/OKR)
    {
      id: 'MODULE_BENEFITS',
      label: t('sidebar.results', 'Results'),
      icon: <TrendingUp size={20} />,
      viewId: AppView.BENEFITS_REALIZATION,
    },
    // 8. Reports - Builder (deliverable) + Management (PMO)
    {
      id: 'MODULE_REPORTS',
      label: t('sidebar.reports', 'Reports'),
      icon: <BookOpen size={20} />,
      viewId: AppView.REPORTS_ENTRY,
      subItems: [
        {
          id: 'REPORTS_BUILDER',
          label: t('sidebar.reportsBuilder', 'Report Builder'),
          viewId: AppView.FULL_STEP6_REPORTS,
          icon: <FileText size={16} />,
        },
        {
          id: 'REPORTS_MANAGEMENT',
          label: t('sidebar.reportsManagement', 'Management Reports'),
          viewId: AppView.REPORTS_MANAGEMENT,
          icon: <FileOutput size={16} />,
        },
      ],
    },
    // 9. Presentations - biblioteka decków
    {
      id: 'MODULE_PRESENTATIONS',
      label: t('sidebar.presentations', 'Presentations'),
      icon: <Presentation size={20} />,
      viewId: AppView.PRESENTATIONS,
    },
    // 10. Economics - analiza ekonomiczna
    {
      id: 'MODULE_ECONOMICS',
      label: t('sidebar.economics', 'Economics'),
      icon: <Calculator size={20} />,
      viewId: AppView.ECONOMICS,
    },
    // Ecosystem Affiliate dropped per decision #1 (Harvard): dashboard was
    // UI-complete but backend-stubbed (always 503/zeros). Route redirects to
    // /chat; DB + backend kept as dormant foundations.
  ];

  const adminMenuItem: MenuItem = {
    id: 'ADMIN',
    label: t('sidebar.adminPanel'),
    icon: <Shield size={20} />,
    subItems: [
      {
        id: 'ADMIN_OVERVIEW',
        label: t('admin.modules.overview', 'Overview'),
        viewId: AppView.ADMIN_OVERVIEW,
        icon: <LayoutDashboard size={16} />,
      },
      {
        id: 'ADMIN_ORGANIZATION',
        label: t('admin.modules.operations', 'Organization Ops'),
        viewId: AppView.ADMIN_ORGANIZATION,
        icon: <Building2 size={16} />,
      },
      {
        id: 'ADMIN_TEAM',
        label: t('admin.modules.people', 'People & Access'),
        viewId: AppView.ADMIN_TEAM,
        icon: <Users size={16} />,
      },
      {
        id: 'ADMIN_WORKSPACE',
        label: t('admin.modules.integrations', 'Integrations'),
        viewId: AppView.ADMIN_WORKSPACE,
        icon: <Briefcase size={16} />,
      },
      {
        id: 'ADMIN_AI',
        label: t('admin.modules.ai', 'AI Governance'),
        viewId: AppView.ADMIN_AI,
        icon: <Brain size={16} />,
      },
      {
        id: 'ADMIN_BILLING',
        label: t('admin.modules.billing', 'Billing & FinOps'),
        viewId: AppView.ADMIN_BILLING,
        icon: <CreditCard size={16} />,
      },
      {
        id: 'ADMIN_SECURITY',
        label: t('admin.modules.security', 'Security & Identity'),
        viewId: AppView.ADMIN_SECURITY,
        icon: <Lock size={16} />,
      },
    ],
  };

  const organizationMenuItem: MenuItem = {
    id: 'ORGANIZATION',
    label: t('sidebar.organization'),
    icon: <Factory size={20} />,
    subItems: [
      {
        id: 'CTX_1',
        label: t('sidebar.context.profile'),
        viewId: AppView.CONTEXT_BUILDER_PROFILE,
        icon: <Target size={16} />,
      },
      {
        id: 'CTX_2',
        label: t('sidebar.context.goals'),
        viewId: AppView.CONTEXT_BUILDER_GOALS,
        icon: <Target size={16} />,
      },
      {
        id: 'CTX_3',
        label: t('sidebar.context.challenges'),
        viewId: AppView.CONTEXT_BUILDER_CHALLENGES,
        icon: <Scale size={16} />,
      },
      {
        id: 'CTX_4',
        label: t('sidebar.context.megatrends'),
        viewId: AppView.CONTEXT_BUILDER_MEGATRENDS,
        icon: <Globe size={16} />,
      },
      {
        id: 'CTX_5',
        label: t('sidebar.context.strategy'),
        viewId: AppView.CONTEXT_BUILDER_STRATEGY,
        icon: <Zap size={16} />,
      },
    ],
  };

  const settingsMenuItem: MenuItem = {
    id: 'SETTINGS',
    label: t('sidebar.settings'),
    icon: <Settings size={20} />,
    subItems: [
      {
        id: 'SETTINGS_PROFILE_MODULE',
        label: t('settings.modules.profile', 'Profile'),
        viewId: AppView.SETTINGS_PROFILE_MODULE,
        icon: <UserCircle size={16} />,
      },
      {
        id: 'SETTINGS_AI_MODULE',
        label: t('settings.modules.aiPreferences', 'AI Preferences'),
        viewId: AppView.SETTINGS_AI_MODULE,
        icon: <Brain size={16} />,
      },
      {
        id: 'SETTINGS_NOTIFICATIONS_MODULE',
        label: t('settings.modules.notifications', 'Notifications'),
        viewId: AppView.SETTINGS_NOTIFICATIONS_MODULE,
        icon: <Bell size={16} />,
      },
      {
        id: 'SETTINGS_SECURITY_MODULE',
        label: t('settings.modules.security', 'Security'),
        viewId: AppView.SETTINGS_SECURITY_MODULE,
        icon: <Shield size={16} />,
      },
      {
        id: 'SETTINGS_INTEGRATIONS_MODULE',
        label: t('settings.modules.integrations', 'Integrations'),
        viewId: AppView.SETTINGS_INTEGRATIONS_MODULE,
        icon: <Link size={16} />,
      },
      {
        id: 'SETTINGS_APPEARANCE_MODULE',
        label: t('settings.modules.appearance', 'Appearance'),
        viewId: AppView.SETTINGS_APPEARANCE_MODULE,
        icon: <Globe size={16} />,
      },
    ],
  };

  // Hover Handlers
  const handleItemMouseEnter = (e: React.MouseEvent<HTMLDivElement>, item: MenuItem) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);

    // Logic:
    // 1. If has subItems -> ALWAYS show flyout (items + header)
    // 2. If NO subItems BUT Sidebar is Collapsed (!showFull) -> show flyout (Tooltip style: Header only)

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
      // If full sidebar and no subitems, we rely on rendering the label inline; so close any other flyouts
      if (activeFloating && activeFloating.id !== item.id) {
        setActiveFloating(null);
      }
    }
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setActiveFloating(null);
    }, 150); // Short delay to allow moving to the flyout
  };

  const handleFlyoutMouseEnter = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  };

  const handleFlyoutMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setActiveFloating(null);
    }, 150);
  };

  const renderMenuItem = (item: MenuItem) => {
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isActive = item.viewId === currentView;
    const isCompleted = item.viewId && completedViews.includes(item.viewId);
    const badgeLabel = item.badge === 'soon' ? 'Coming soon' : item.badge;

    // Check if locked
    const isLocked =
      item.requiresView &&
      !completedViews.includes(item.requiresView) &&
      !(
        currentUser?.role === UserRole.ADMIN ||
        currentUser?.role === UserRole.OWNER ||
        isSuperAdminRole(currentUser?.role)
      );

    // Get human-readable name for required view
    const getViewName = (view: AppView): string => {
      const viewNames: Record<string, string> = {
        [AppView.FULL_STEP1_ASSESSMENT]: t('sidebar.assessmentDRD'),
        [AppView.ASSESSMENT_OVERVIEW]: t('licensedTools.moduleName', 'Licensed Tools'),
        [AppView.FULL_STEP2_INITIATIVES]: t('sidebar.module3_1'),
        [AppView.PORTFOLIO_ROADMAP]: t('sidebar.portfolioRoadmap', 'Portfolio & Roadmap'),
        [AppView.FULL_STEP5_EXECUTION]: t('sidebar.realization'),
        [AppView.MY_WORK]: t('myWork.title', 'My Work'),
      };
      return viewNames[view] || t('common.previousStep');
    };

    // Check if child active (for highlighting parent)
    const isChildActive = (i: MenuItem): boolean => {
      if (i.viewId === currentView) return true;
      if (i.subItems) return i.subItems.some((sub) => isChildActive(sub));
      return false;
    };
    const isParentActive = hasSubItems && isChildActive(item);

    // Padding logic
    const paddingLeft = showFull ? 'px-3' : 'px-0 justify-center';

    // Generate tooltip
    const getTooltip = () => {
      if (isLocked && item.requiresView) {
        return `${t('common.locked')}: ${t('common.complete')} ${getViewName(item.requiresView)} ${t('common.first')}`;
      }
      if (!showFull) {
        return item.label;
      }
      return undefined;
    };

    return (
      <div
        key={item.id}
        className="relative w-full"
        onMouseEnter={(e) => handleItemMouseEnter(e, item)}
        onMouseLeave={handleMouseLeave}
      >
        <button
          data-chat-toggle={item.id === 'AI_CHAT' ? 'true' : undefined}
          aria-haspopup={hasSubItems ? 'menu' : undefined}
          aria-expanded={hasSubItems ? activeFloating?.id === item.id : undefined}
          onFocus={(e) => {
            // Keyboard users: open the flyout when the parent item receives focus
            if (hasSubItems || !showFull) {
              const rect = e.currentTarget.getBoundingClientRect();
              setActiveFloating({
                id: item.id,
                rect,
                items: item.subItems || [],
                title: item.label,
              });
            }
          }}
          onClick={() => {
            console.log('[Sidebar-old] Button clicked:', item.id, item.viewId);

            if (isLocked) {
              console.log('[Sidebar-old] Item is locked:', item.id);
              return;
            }

            // =====================================================
            // UNIFIED CHAT SYSTEM: Smart Navigation
            // =====================================================

            // AI Chat button: Navigate to full-screen chat
            if (item.id === 'AI_CHAT') {
              // If already in AI Chat, just toggle the sliding panel
              if (currentView === AppView.AI_CHAT) {
                toggleChatHistorySidebar();
              } else {
                // Navigate to full-screen AI Chat
                navigateToFullChat();
              }
              return;
            }

            if (item.viewId) {
              // Navigate to URL FIRST - this triggers React Router
              const route = APP_VIEW_TO_ROUTE[item.viewId];
              console.log('[Sidebar] Navigating:', item.viewId, '→', route);

              if (route) {
                trackFunnelEvent('sidebar_navigation_clicked', { target: route });
                navigate(route);
              }

              // Then update state
              if (activeConversationId) {
                navigateToViewWithChat(item.viewId);
              } else {
                setCurrentView(item.viewId);
              }

              // Close on mobile/tablet after navigation
              if (isMobile || (isTablet && isSidebarOpen)) {
                setIsSidebarOpen(false);
              }
            } else {
              console.warn('[Sidebar-old] Item has no viewId:', item.id);
            }
          }}
          disabled={isLocked}
          className={`
            w-full flex items-center text-sm transition-all relative group touch-ripple
            ${isTouchDevice ? 'py-3 min-h-[44px]' : 'py-2.5'}
            ${paddingLeft}
            ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${
              isActive || (item.id === 'AI_CHAT' && isChatHistorySidebarOpen)
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 border-r-2 border-blue-500'
                : isParentActive
                  ? 'text-navy-900 dark:text-white font-medium bg-slate-50 dark:bg-white/5'
                  : 'text-slate-500 dark:text-slate-400 active:text-navy-900 dark:active:text-white active:bg-slate-100 dark:active:bg-white/10 hover:text-navy-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-navy-800/20 dark:hover:bg-white/5'
            }
          `}
          title={getTooltip()}
        >
          <div
            className={`flex items-center gap-3 min-w-0 ${!showFull ? 'justify-center w-full' : 'flex-1'} `}
          >
            {item.icon && (
              <span
                className={`transition-colors ${isActive || isParentActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}
              >
                {React.cloneElement(item.icon as React.ReactElement<{ size: number }>, {
                  size: 20,
                })}
              </span>
            )}

            {showFull && (
              <span className="truncate tracking-wide flex-1 text-left">{item.label}</span>
            )}
          </div>

          {showFull && (
            <div className="flex items-center gap-2">
              {/* Beta/New/Soon Badge */}
              {item.badge && (
                <span
                  className={`
                    px-2 py-0.5 text-[10px] font-semibold rounded-full tracking-wide shrink-0 border
                    ${item.badge === 'beta' ? 'bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300 border-amber-500/25 dark:border-amber-400/20' : ''}
                    ${item.badge === 'new' ? 'bg-green-500/10 text-green-700 dark:bg-green-400/10 dark:text-green-300 border-green-500/25 dark:border-green-400/20' : ''}
                    ${item.badge === 'soon' ? 'bg-amber-400/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300 border-amber-400/25 dark:border-amber-400/20' : ''}
                  `}
                >
                  {badgeLabel}
                </span>
              )}
              {isCompleted && !isActive && <CheckCircle2 size={14} className="text-green-500/80" />}
              {isLocked && <Lock size={14} className="text-slate-600 dark:text-slate-500" />}
              {hasSubItems && (
                <span
                  className={`text-slate-600 dark:text-slate-400 transition-transform ${activeFloating?.id === item.id ? 'translate-x-1' : ''}`}
                >
                  <div className="rtl:rotate-180">
                    <ChevronRight size={14} />
                  </div>
                </span>
              )}
            </div>
          )}
        </button>
      </div>
    );
  };

  // Width class:
  // - Mobile: full width when open, hidden when closed
  // - Tablet: mini mode (64px) by default
  // - Desktop: full (256px) or mini based on user preference
  const sidebarWidthClass = showFull ? 'w-64' : 'w-16';

  return (
    <>
      {/* Mobile/Tablet Overlay - shown when sidebar is open on touch devices */}
      {isSidebarOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-overlay lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR CONTAINER */}
      <div
        data-tour="sidebar-nav"
        className={`
          fixed inset-y-0 left-0 z-modal
          bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl
          border-r border-slate-200 dark:border-navy-700 shadow-2xl
          flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]
          ${sidebarWidthClass}
          ${
            isSidebarOpen
              ? 'translate-x-0'
              : isMobile
                ? '-translate-x-full'
                : isTablet
                  ? 'translate-x-0' /* Tablet: always visible as mini */
                  : 'lg:translate-x-0 -translate-x-full' /* Desktop: visible from lg breakpoint */
          }
          safe-area-pt safe-area-pb
        `}
      >
        {/* Header */}
        <div
          className={`flex items-center ${showFull ? 'justify-between px-4 h-16' : 'flex-col justify-center gap-4 py-6'} relative shrink-0 transition-all duration-300`}
        >
          {showFull ? (
            <>
              <div className="flex items-center overflow-hidden">
                <img
                  src={
                    theme === 'dark'
                      ? '/assets/logos/logo-dark.svg?v=20260319'
                      : '/assets/logos/logo-light.svg?v=20260319'
                  }
                  alt="Consultify"
                  className="h-8 w-auto object-contain"
                />
              </div>

              <button
                onClick={toggleSidebarCollapse}
                aria-label={t('sidebar.collapse', 'Collapse')}
                aria-expanded={true}
                className={`
                  p-2 rounded-lg transition-colors
                  text-slate-600 dark:text-slate-500 hover:text-navy-900 hover:bg-slate-100 dark:hover:bg-navy-800/30
                  dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10
                `}
                title={t('sidebar.collapse', 'Collapse')}
              >
                <PanelLeftClose size={20} className="" />
              </button>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold tracking-tighter text-primary-600 dark:text-primary-400">
                77
              </span>
              <button
                onClick={toggleSidebarCollapse}
                aria-label={t('sidebar.expand', 'Expand')}
                aria-expanded={false}
                className={`
                  p-2 rounded-lg transition-colors flex justify-center items-center
                  text-slate-600 dark:text-slate-500 hover:text-navy-900 hover:bg-slate-100 dark:hover:bg-navy-800/30
                  dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10
                `}
                title={t('sidebar.expand', 'Expand')}
              >
                <PanelLeftClose size={20} className="rotate-180" />
              </button>
            </>
          )}
        </div>

        {/* Scrollable Navigation */}
        <nav
          aria-label={t('sidebar.mainNavigation', 'Main navigation')}
          className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent"
        >
          {/* PMO Phase Indicator - Always visible */}
          <div className={`${showFull ? 'px-3 pt-4' : 'px-2 pt-4'}`}>
            <PhaseIndicator compact={!showFull} />
          </div>

          <div className={`space-y-1 pb-2 ${showFull ? 'pt-4' : 'pt-4'}`}>
            {menuStructure.map((item) => renderMenuItem(item))}
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-slate-200 dark:border-navy-700 shrink-0">
          <div className="space-y-1">
            <div className="my-1 border-t border-slate-200 dark:border-navy-700" />

            {(currentUser?.role === UserRole.ADMIN ||
              currentUser?.role === UserRole.OWNER ||
              isSuperAdminRole(currentUser?.role)) &&
              renderMenuItem(organizationMenuItem)}
            {(currentUser?.role === UserRole.ADMIN ||
              currentUser?.role === UserRole.OWNER ||
              isSuperAdminRole(currentUser?.role)) &&
              renderMenuItem(adminMenuItem)}
            {renderMenuItem(settingsMenuItem)}

            <button
              onClick={() => logout()}
              className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium btn-base transition-all duration-200
                text-slate-500 dark:text-slate-400 hover:bg-danger-50 dark:hover:bg-danger-500/10 hover:text-danger-600 dark:hover:text-danger-400
                ${!showFull ? 'justify-center px-0' : 'px-3'} `}
              title={t('sidebar.logOut')}
            >
              <LogOut size={16} />
              {showFull && <span>{t('sidebar.logOut')}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Render Active Flyout Menu */}
      {activeFloating && (
        <FloatingMenu
          parentRect={activeFloating.rect}
          items={activeFloating.items}
          title={activeFloating.title}
          parentId={activeFloating.id}
          onClose={() => setActiveFloating(null)}
          onNavigate={(viewId) => {
            // Navigate to URL FIRST
            const route = APP_VIEW_TO_ROUTE[viewId];
            console.log('[Sidebar FloatingMenu] Navigating:', viewId, '→', route);
            if (route) {
              trackFunnelEvent('sidebar_navigation_clicked', { target: route });
              navigate(route);
            }
            // Then update state
            if (activeConversationId) {
              navigateToViewWithChat(viewId);
            } else {
              setCurrentView(viewId);
            }
            setActiveFloating(null);
            if (window.innerWidth < 1024) setIsSidebarOpen(false);
          }}
          currentView={currentView}
          onMouseEnter={handleFlyoutMouseEnter}
          onMouseLeave={handleFlyoutMouseLeave}
          theme={theme}
        />
      )}
    </>
  );
};
