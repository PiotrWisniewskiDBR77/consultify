import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { AppView, UserRole } from '../types';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';

import {
  Shield,
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronRight,
  Layers,
  BookOpen,
  Box,
  CheckCircle2,
  Lock,
  PanelLeftClose,
  Rocket,
  Map,
  Activity,
  Pin,
  Target, // Goals
  Scale, // Challenges
  Globe, // Megatrends
  Zap, // Strategy/Quick
  Workflow, // Processes (M2_1)
  Cpu, // Digital (M2_2)
  Database, // Data (M2_4)
  Users, // Culture (M2_5) / Users
  Bot, // AI/Cyber?
  Fingerprint, // Cyber
  Brain, // AI
  Lightbulb, // Initiatives
  Calendar, // Roadmap
  FileText, // Reports
  Building2, // Projects
  MessageSquare, // Feedback
  Briefcase, // My Work
  UserCircle, // Profile
  CreditCard, // Billing
  Bell, // Notifications
  Link, // Integrations
  Eye, // Step D: Executive View
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { SidebarUsage } from './SidebarUsage';
import { PhaseIndicator } from './PMO/PhaseIndicator';

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  viewId?: AppView;
  subItems?: MenuItem[];
  requiresView?: AppView;
  isFloating?: boolean; // Deprecated but kept for compatibility logic if needed (we default to true now)
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
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({
  parentRect,
  items,
  onNavigate,
  currentView,
  onMouseEnter,
  onMouseLeave,
  theme,
  title
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
  const borderColor = theme === 'dark' ? 'border-white/10' : 'border-slate-200';
  const textColor = theme === 'dark' ? 'text-slate-300' : 'text-slate-600';
  const hoverBg = theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50';
  const hoverText = theme === 'dark' ? 'hover:text-white' : 'hover:text-navy-900';
  const activeBg = theme === 'dark' ? 'bg-purple-900/20' : 'bg-purple-50';
  const activeText = theme === 'dark' ? 'text-purple-300' : 'text-purple-600';

  const hasItems = items && items.length > 0;

  // Determine position style
  // Use opacity 0 until position is set (checked by top !== 0) to avoid "jump" from 0,0
  const isPositioned = position.top !== 0;

  return createPortal(
    <div
      ref={menuRef}
      className={`fixed z-[9999] w-64 py-2 rounded-xl shadow-2xl border ${bgColor} ${borderColor} transition-opacity duration-200 ease-out ${isPositioned ? 'opacity-100' : 'opacity-0'}`}
      style={{ top: position.top, left: position.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex flex-col">
        {title && (
          <div className={`px-4 py-3 text-sm font-bold ${hasItems ? 'border-b mb-1' : ''} ${theme === 'dark' ? 'border-white/10 text-white' : 'border-slate-100 text-slate-800'}`}>
            {title}
          </div>
        )}
        {items.map(sub => {
          const isActive = sub.viewId === currentView;
          return (
            <button
              key={sub.id}
              onClick={() => sub.viewId && onNavigate(sub.viewId)}
              className={`
                 w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors
                 ${isActive ? `${activeBg} ${activeText}` : `${textColor} ${hoverBg} ${hoverText}`}
               `}
            >
              {sub.icon && React.cloneElement(sub.icon as React.ReactElement<{ size: number }>, { size: 16 })}
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
    toggleSidebarCollapse
  } = useAppStore();

  const { t } = useTranslation();

  // Derived state: Show full content if Pinned (not collapsed)
  const showFull = !isSidebarCollapsed;

  // Floating Menu State
  const [activeFloating, setActiveFloating] = useState<{ id: string; rect: DOMRect; items: MenuItem[]; title: string } | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout>(undefined);

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

  // Menu Definition
  const menuStructure: MenuItem[] = [
    {
      id: 'DASHBOARD',
      label: t('sidebar.dashboard'),
      icon: <LayoutDashboard size={20} />,
      viewId: AppView.DASHBOARD_OVERVIEW,
    },

    {
      id: 'MY_WORK',
      label: t('myWork.title', 'My Work'),
      icon: <Briefcase size={20} />,
      viewId: AppView.MY_WORK,
    },
    {
      id: 'EXECUTIVE_VIEW',
      label: t('sidebar.executiveView', 'Executive View'),
      icon: <Eye size={20} />,
      viewId: AppView.EXECUTIVE_VIEW,
    },
    {
      id: 'INTRO_CONTEXT',
      label: t('sidebar.intro'),
      icon: <BookOpen size={20} />,
      subItems: [
        { id: 'CTX_1', label: t('sidebar.context.profile'), viewId: AppView.CONTEXT_BUILDER_PROFILE, icon: <Target size={16} /> },
        { id: 'CTX_2', label: t('sidebar.context.goals'), viewId: AppView.CONTEXT_BUILDER_GOALS, icon: <Target size={16} /> },
        { id: 'CTX_3', label: t('sidebar.context.challenges'), viewId: AppView.CONTEXT_BUILDER_CHALLENGES, icon: <Scale size={16} /> },
        { id: 'CTX_4', label: t('sidebar.context.megatrends'), viewId: AppView.CONTEXT_BUILDER_MEGATRENDS, icon: <Globe size={16} /> },
        { id: 'CTX_5', label: t('sidebar.context.strategy'), viewId: AppView.CONTEXT_BUILDER_STRATEGY, icon: <Zap size={16} /> },
      ]
    },
    {
      id: 'MODULE_2',
      label: t('sidebar.module2'),
      icon: <CheckCircle2 size={20} />,
      subItems: [
        { id: 'M2_1', label: t('sidebar.fullStep1_proc'), viewId: AppView.FULL_STEP1_PROCESSES, icon: <Workflow size={16} /> },
        { id: 'M2_2', label: t('sidebar.fullStep1_prod'), viewId: AppView.FULL_STEP1_DIGITAL, icon: <Cpu size={16} /> },
        { id: 'M2_3', label: t('sidebar.fullStep1_model'), viewId: AppView.FULL_STEP1_MODELS, icon: <Layers size={16} /> },
        { id: 'M2_4', label: t('sidebar.fullStep1_data'), viewId: AppView.FULL_STEP1_DATA, icon: <Database size={16} /> },
        { id: 'M2_5', label: t('sidebar.fullStep1_cult'), viewId: AppView.FULL_STEP1_CULTURE, icon: <Users size={16} /> },
        { id: 'M2_CYBER', label: t('sidebar.fullStep1_cyber'), viewId: AppView.FULL_STEP1_CYBERSECURITY, icon: <Fingerprint size={16} /> },
        { id: 'M2_6', label: t('sidebar.fullStep1_ai'), viewId: AppView.FULL_STEP1_AI, icon: <Brain size={16} /> },
      ]
    },
    {
      id: 'MODULE_3',
      label: t('sidebar.module3'),
      icon: <Layers size={20} />,
      subItems: [
        { id: 'M3_1', label: t('sidebar.module3_1'), viewId: AppView.FULL_STEP2_INITIATIVES, requiresView: AppView.FULL_STEP1_ASSESSMENT, icon: <Lightbulb size={16} /> },
        { id: 'M3_2', label: t('sidebar.module3_2'), viewId: AppView.FULL_STEP3_ROADMAP, requiresView: AppView.FULL_STEP2_INITIATIVES, icon: <Calendar size={16} /> },
      ]
    },
    {
      id: 'MODULE_4',
      label: t('sidebar.module4'),
      icon: <Rocket size={20} />,
      viewId: AppView.FULL_PILOT_EXECUTION,
      requiresView: AppView.FULL_STEP3_ROADMAP
    },
    {
      id: 'MODULE_5',
      label: t('sidebar.module5'),
      icon: <Map size={20} />,
      viewId: AppView.FULL_ROLLOUT,
      requiresView: AppView.FULL_STEP3_ROADMAP
    },
    {
      id: 'MODULE_6',
      label: t('sidebar.module6'),
      icon: <Box size={20} />,
      viewId: AppView.FULL_STEP4_ROI,
      requiresView: AppView.FULL_STEP2_INITIATIVES
    },
    {
      id: 'MODULE_7',
      label: t('sidebar.module7'),
      icon: <BookOpen size={20} />,
      viewId: AppView.FULL_STEP6_REPORTS,
      requiresView: AppView.FULL_STEP5_EXECUTION
    },
    {
      id: 'AI_ADVISOR',
      label: t('sidebar.aiAdvisor', 'AI Advisor'),
      icon: <Sparkles size={20} />,
      viewId: AppView.AI_ACTION_PROPOSALS,
      requiresView: AppView.DASHBOARD // Available essentially always for admins
    }
  ];

  const adminMenuItem: MenuItem = {
    id: 'ADMIN',
    label: t('sidebar.adminPanel'),
    icon: <Shield size={20} />,
    subItems: [
      { id: 'ADMIN_DASHBOARD', label: t('sidebar.dashboard'), viewId: AppView.ADMIN_DASHBOARD, icon: <LayoutDashboard size={16} /> },
      { id: 'ADMIN_METRICS', label: t('sidebar.metrics', 'Metrics & Conversion'), viewId: AppView.ADMIN_METRICS, icon: <TrendingUp size={16} /> },
      { id: 'ADMIN_USERS', label: t('sidebar.adminUsers'), viewId: AppView.ADMIN_USERS, icon: <Users size={16} /> },
      { id: 'ADMIN_PROJECTS', label: t('sidebar.adminProjects'), viewId: AppView.ADMIN_PROJECTS, icon: <Building2 size={16} /> },
      { id: 'ADMIN_LLM', label: t('sidebar.adminLLM'), viewId: AppView.ADMIN_LLM, icon: <Brain size={16} /> },
      { id: 'ADMIN_KNOWLEDGE', label: t('sidebar.adminKnowledge'), viewId: AppView.ADMIN_KNOWLEDGE, icon: <BookOpen size={16} /> },
      { id: 'ADMIN_FEEDBACK', label: t('sidebar.adminFeedback'), viewId: AppView.ADMIN_FEEDBACK, icon: <MessageSquare size={16} /> },
    ]
  };

  const settingsMenuItem: MenuItem = {
    id: 'SETTINGS',
    label: t('sidebar.settings'),
    icon: <Settings size={20} />,
    // viewId: AppView.SETTINGS_PROFILE, // Removed direct link in favor of subitems
    subItems: [
      { id: 'SETTINGS_PROFILE', label: t('settings.menu.myProfile', 'My Profile'), viewId: AppView.SETTINGS_PROFILE, icon: <UserCircle size={16} /> },
      { id: 'SETTINGS_BILLING', label: t('settings.menu.billing', 'Billing & Plans'), viewId: AppView.SETTINGS_BILLING, icon: <CreditCard size={16} /> },
      { id: 'SETTINGS_AI', label: t('settings.menu.aiConfig', 'AI Configuration'), viewId: AppView.SETTINGS_AI, icon: <Brain size={16} /> },
      { id: 'SETTINGS_NOTIFICATIONS', label: t('settings.menu.notifications', 'Notifications'), viewId: AppView.SETTINGS_NOTIFICATIONS, icon: <Bell size={16} /> },
      { id: 'SETTINGS_INTEGRATIONS', label: t('settings.menu.integrations', 'Integrations'), viewId: AppView.SETTINGS_INTEGRATIONS, icon: <Link size={16} /> },
      { id: 'SETTINGS_REGIONALIZATION', label: t('settings.menu.regionalization', 'Regionalization'), viewId: AppView.SETTINGS_REGIONALIZATION, icon: <Globe size={16} /> },
    ]
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
        title: item.label
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

    // Check if locked
    const isLocked = item.requiresView && !completedViews.includes(item.requiresView) && !(currentUser?.role === UserRole.ADMIN || currentUser?.role === 'SUPERADMIN');

    // Check if child active (for highlighting parent)
    const isChildActive = (i: MenuItem): boolean => {
      if (i.viewId === currentView) return true;
      if (i.subItems) return i.subItems.some(sub => isChildActive(sub));
      return false;
    };
    const isParentActive = hasSubItems && isChildActive(item);

    // Padding logic
    const paddingLeft = showFull ? 'px-3' : 'px-0 justify-center';

    return (
      <div
        key={item.id}
        className="relative w-full"
        onMouseEnter={(e) => handleItemMouseEnter(e, item)}
        onMouseLeave={handleMouseLeave}
      >
        <button
          onClick={() => {
            if (isLocked) return;
            if (item.viewId) {
              setCurrentView(item.viewId);
              // if mobile, close
              if (window.innerWidth < 1024) setIsSidebarOpen(false);
            }
          }}
          disabled={isLocked}
          className={`
            w-full flex items-center py-2.5 text-sm transition-all relative group
            ${paddingLeft}
            ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${isActive
              ? 'bg-purple-600/10 text-purple-600 dark:text-purple-400 border-r-2 border-purple-600'
              : isParentActive
                ? 'text-navy-900 dark:text-white font-medium bg-slate-50 dark:bg-white/5'
                : 'text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
            }
          `}
          title={!showFull ? item.label : undefined}
        >
          <div className={`flex items-center gap-3 ${!showFull ? 'justify-center w-full' : ''} `}>
            {item.icon && (
              <span className={`transition-colors ${isActive || isParentActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                {React.cloneElement(item.icon as React.ReactElement<{ size: number }>, { size: 20 })}
              </span>
            )}

            {showFull && (
              <span className="truncate tracking-wide flex-1 text-left">
                {item.label}
              </span>
            )}
          </div>

          {showFull && (
            <div className="flex items-center gap-2">
              {isCompleted && !isActive && (
                <CheckCircle2 size={14} className="text-green-500/80" />
              )}
              {isLocked && (
                <Lock size={12} className="text-slate-400 dark:text-slate-500" />
              )}
              {hasSubItems && (
                <span className={`text-slate-400 dark:text-slate-600 transition-transform ${activeFloating?.id === item.id ? 'translate-x-1' : ''}`}>
                  <div className="rtl:rotate-180"><ChevronRight size={14} /></div>
                </span>
              )}
            </div>
          )}
        </button>
      </div>
    );
  };

  const sidebarWidthClass = showFull ? 'w-64' : 'w-16';

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR CONTAINER */}
      <div
        data-tour="sidebar-nav"
        className={`
          fixed inset-y-0 left-0 z-50
          bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl
          border-r border-slate-200 dark:border-white/5 shadow-2xl
          flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]
          ${sidebarWidthClass}
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className={`flex items-center ${showFull ? 'justify-between px-4 h-16' : 'flex-col justify-center gap-4 py-6'} relative shrink-0 transition-all duration-300`}>
          {showFull ? (
            <>
              <div className="flex items-center overflow-hidden">
                <img
                  src={theme === 'dark' ? "/assets/logos/logo-dark.png" : "/assets/logos/logo-light.png"}
                  alt="DBR77 Consultify"
                  className="h-8 w-auto object-contain"
                />
              </div>

              <button
                onClick={toggleSidebarCollapse}
                className={`
                  p-2 rounded-lg transition-colors
                  text-slate-400 hover:text-navy-900 hover:bg-slate-100 
                  dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10
                `}
                title={t('sidebar.collapse', 'Collapse')}
              >
                <PanelLeftClose size={20} className="" />
              </button>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold tracking-tighter text-purple-600 dark:text-purple-400">
                77
              </span>
              <button
                onClick={toggleSidebarCollapse}
                className={`
                  p-2 rounded-lg transition-colors flex justify-center items-center
                  text-slate-400 hover:text-navy-900 hover:bg-slate-100 
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
        <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
          {/* PMO Phase Indicator - Always visible */}
          <div className={`${showFull ? 'px-3 pt-4' : 'px-2 pt-4'}`}>
            <PhaseIndicator compact={!showFull} />
          </div>

          <div className={`space-y-1 pb-2 ${showFull ? 'pt-4' : 'pt-4'}`}>
            {menuStructure.map(item => renderMenuItem(item))}
          </div>
        </nav>

        {/* Usage Stats */}
        <div className="border-t border-slate-200 dark:border-white/5 py-2">
          <SidebarUsage showFull={showFull} />
        </div>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-slate-200 dark:border-white/5 shrink-0">
          <div className="space-y-1">
            <div className="my-1 border-t border-slate-200 dark:border-white/5" />

            {currentUser?.role === UserRole.ADMIN && renderMenuItem(adminMenuItem)}
            {renderMenuItem(settingsMenuItem)}

            <button
              onClick={logout}
              className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium btn-base transition-all duration-200
                text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400
                ${!showFull ? 'justify-center px-0' : 'px-3'} `}
              title="Log Out"
            >
              <LogOut size={18} />
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
          onClose={() => setActiveFloating(null)}
          onNavigate={(viewId) => {
            setCurrentView(viewId);
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
