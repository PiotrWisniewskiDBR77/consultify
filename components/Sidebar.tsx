import React, { useState, useEffect } from 'react';
import { AppView, UserRole } from '../types';
import { useTranslation } from 'react-i18next'; // Refactored from translations object
import { useAppStore } from '../store/useAppStore';

import {
  Shield,
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Layers,
  BookOpen,
  Box,
  CheckCircle2,
  Lock,
  PanelLeftClose,
  Rocket,
  Map,
  Pin,
  Bell
} from 'lucide-react';
import { SidebarUsage } from './SidebarUsage';

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  viewId?: AppView;
  subItems?: MenuItem[];
  requiresView?: AppView;
  isFloating?: boolean; // NEW: Floating menu behavior
}

export const Sidebar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    logout,
    language,
    isSidebarOpen,
    setIsSidebarOpen,
    currentUser,
    freeSessionData,
    fullSessionData,
    theme,
    isSidebarCollapsed, // acts as "isPinned" (false = pinned/full, true = unpinned/mini)
    toggleSidebarCollapse
  } = useAppStore();

  const { t, i18n } = useTranslation();

  // Sync language with i18n
  useEffect(() => {
    if (i18n.language !== language.toLowerCase()) {
      i18n.changeLanguage(language.toLowerCase());
    }
  }, [language, i18n]);

  // Local state for sidebar hover interaction
  const [isHovered, setIsHovered] = useState(false);

  // Derived state: Show full content if Pinned (not collapsed) OR Hovered
  const showFull = !isSidebarCollapsed || isHovered;

  // Calculate completed views logic moved here
  const completedViews = React.useMemo(() => {
    const completed: AppView[] = [];

    // Quick Assessment
    if (freeSessionData.step1Completed) completed.push(AppView.QUICK_STEP1_PROFILE);
    if (freeSessionData.step2Completed) completed.push(AppView.QUICK_STEP2_USER_CONTEXT);
    if (freeSessionData.step3Completed) completed.push(AppView.QUICK_STEP3_EXPECTATIONS);

    // Full Transformation
    if (fullSessionData.step1Completed) completed.push(AppView.FULL_STEP1_ASSESSMENT);
    if (fullSessionData.step2Completed) completed.push(AppView.FULL_STEP2_INITIATIVES);
    if (fullSessionData.step3Completed) completed.push(AppView.FULL_STEP3_ROADMAP);
    if (fullSessionData.step4Completed) completed.push(AppView.FULL_STEP4_ROI);
    if (fullSessionData.step5Completed) completed.push(AppView.FULL_STEP5_EXECUTION);

    return completed;
  }, [freeSessionData, fullSessionData]);

  // State for expanded sections (Accordion logic)
  const [expandedItems, setExpandedItems] = useState<string[]>(['QUICK', 'FULL', 'FULL_STEP1']);

  // State for floating menus (hover logic)
  const [hoveredFloatingItem, setHoveredFloatingItem] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    if (!showFull) return; // Cannot expand submenus in mini mode (unless we implement popovers, but hover expands sidebar first)
    setExpandedItems(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const menuStructure: MenuItem[] = [
    {
      id: 'DASHBOARD',
      label: t('sidebar.dashboard'), // Module 0
      icon: <LayoutDashboard size={20} />,
      subItems: [
        { id: 'DASHBOARD_OVERVIEW', label: 'Overview', viewId: AppView.DASHBOARD_OVERVIEW, icon: <Map size={16} /> },
        { id: 'DASHBOARD_SNAPSHOT', label: 'Execution Snapshot', viewId: AppView.DASHBOARD_SNAPSHOT, icon: <Activity size={16} /> }
      ]
    },
    {
      id: 'INTRO_CONTEXT',
      label: 'Intro',
      icon: <BookOpen size={20} />,
      isFloating: false,
      subItems: [
        { id: 'CTX_1', label: 'Company Profile', viewId: AppView.CONTEXT_BUILDER_PROFILE },
        { id: 'CTX_2', label: 'Goals & Expectations', viewId: AppView.CONTEXT_BUILDER_GOALS },
        { id: 'CTX_3', label: 'Challenge Map', viewId: AppView.CONTEXT_BUILDER_CHALLENGES },
        { id: 'CTX_4', label: 'Megatrend Scanner', viewId: AppView.CONTEXT_BUILDER_MEGATRENDS },
        { id: 'CTX_5', label: 'Strategic Synthesis', viewId: AppView.CONTEXT_BUILDER_STRATEGY },
      ]
    },
    // Removed legacy MODULE_1 as requested ("Usun caly ten obecny 1.")
    {
      id: 'MODULE_2',
      label: t('sidebar.module2'),
      icon: <CheckCircle2 size={20} />,
      subItems: [
        { id: 'M2_1', label: t('sidebar.fullStep1_proc'), viewId: AppView.FULL_STEP1_PROCESSES },
        { id: 'M2_2', label: t('sidebar.fullStep1_prod'), viewId: AppView.FULL_STEP1_DIGITAL },
        { id: 'M2_3', label: t('sidebar.fullStep1_model'), viewId: AppView.FULL_STEP1_MODELS },
        { id: 'M2_4', label: t('sidebar.fullStep1_data'), viewId: AppView.FULL_STEP1_DATA },
        { id: 'M2_5', label: t('sidebar.fullStep1_cult'), viewId: AppView.FULL_STEP1_CULTURE },
        { id: 'M2_6', label: t('sidebar.fullStep1_ai'), viewId: AppView.FULL_STEP1_AI },
      ]
    },
    {
      id: 'MODULE_3',
      label: t('sidebar.module3'),
      icon: <Layers size={20} />,
      subItems: [
        { id: 'M3_1', label: t('sidebar.module3_1'), viewId: AppView.FULL_STEP2_INITIATIVES, requiresView: AppView.FULL_STEP1_ASSESSMENT },
        { id: 'M3_2', label: t('sidebar.module3_2'), viewId: AppView.FULL_STEP3_ROADMAP, requiresView: AppView.FULL_STEP2_INITIATIVES },
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
    }
  ];

  // Settings Menu Structure (Floating)
  const settingsMenuItem: MenuItem = {
    id: 'SETTINGS',
    label: t('sidebar.settings'),
    icon: <Settings size={20} />,
    isFloating: true,
    subItems: [
      { id: 'SET_PROFILE', label: t('settings.menu.myProfile'), viewId: AppView.SETTINGS_PROFILE, icon: <UserCircle size={16} /> },
      { id: 'SET_BILLING', label: t('settings.menu.billing'), viewId: AppView.SETTINGS_BILLING, icon: <CreditCard size={16} /> },
      { id: 'SET_AI', label: t('settings.menu.aiConfig'), viewId: AppView.ADMIN_LLM, icon: <Cpu size={16} /> }, // Using ADMIN_LLM or appropriate view
      { id: 'SET_NOTIFICATIONS', label: t('settings.menu.notifications'), viewId: AppView.SETTINGS_PROFILE /* Fallback to profile tab logic? SettingsView handles activeTab internal state, but here we navigate to View. AppView.SETTINGS_* are needed */, icon: <Bell size={16} /> },
    ]
  };

  const adminMenuItem: MenuItem = {
    id: 'ADMIN',
    label: t('sidebar.adminPanel'),
    icon: <Shield size={20} />,
    subItems: [
      { id: 'ADMIN_DASHBOARD', label: t('sidebar.dashboard'), viewId: AppView.ADMIN_DASHBOARD },
      { id: 'ADMIN_USERS', label: t('sidebar.adminUsers'), viewId: AppView.ADMIN_USERS },
      { id: 'ADMIN_PROJECTS', label: t('sidebar.adminProjects'), viewId: AppView.ADMIN_PROJECTS },
      { id: 'ADMIN_LLM', label: t('sidebar.adminLLM'), viewId: AppView.ADMIN_LLM },
      { id: 'ADMIN_KNOWLEDGE', label: t('sidebar.adminKnowledge'), viewId: AppView.ADMIN_KNOWLEDGE },
      { id: 'ADMIN_FEEDBACK', label: t('sidebar.adminFeedback'), viewId: AppView.ADMIN_FEEDBACK },
    ]
  };

  // Auto-expand sidebar based on currentView
  useEffect(() => {
    // If mini mode (collapsed), don't auto-expand submenus as it might be confusing
    if (isSidebarCollapsed) {
      // Actually we might want to collapse all?
      // setExpandedItems([]);
      return;
    }
    const allItems = [...menuStructure, ...(currentUser?.role === UserRole.ADMIN ? [adminMenuItem] : [])];
    const findParentIds = (items: MenuItem[], targetView: AppView): string[] | null => {
      for (const item of items) {
        if (item.viewId === targetView) {
          return [];
        }
        if (item.subItems) {
          const result = findParentIds(item.subItems, targetView);
          if (result !== null) {
            return [item.id, ...result];
          }
        }
      }
      return null;
    };

    const parentsToExpand = findParentIds(allItems, currentView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (parentsToExpand && parentsToExpand.length > 0) {

      setTimeout(() => {
        setExpandedItems(prev => {
          const next = new Set([...prev, ...parentsToExpand]);
          if (prev.length === next.size && prev.every(x => next.has(x))) {
            return prev;
          }
          return Array.from(next);
        });
      }, 0);
    }
  }, [currentView, currentUser?.role]); // Removed isSidebarCollapsed to avoid re-expanding when collapsing

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const isExpanded = expandedItems.includes(item.id);
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isActive = item.viewId === currentView;
    const isCompleted = item.viewId && completedViews.includes(item.viewId);

    // Check if floating menu is active (hovered)
    const isFloatingOpen = item.isFloating && hoveredFloatingItem === item.id;

    // Determine if locked
    const isLocked = item.requiresView && !completedViews.includes(item.requiresView) && !(currentUser?.role === UserRole.ADMIN || currentUser?.role === 'SUPERADMIN');

    // Check if any child is active to highlight parent
    const isChildActive = (i: MenuItem): boolean => {
      if (i.viewId === currentView) return true;
      if (i.subItems) return i.subItems.some(sub => isChildActive(sub));
      return false;
    };
    const isParentActive = hasSubItems && isChildActive(item);

    // Logic for indentation
    // If mini: center icons. If expanded: uses padding.
    const paddingLeft = showFull ? (level === 0 ? 'px-3' : level === 1 ? 'px-6' : 'px-9') : 'px-0 justify-center';

    return (
      <div
        key={item.id}
        className="w-full relative"
        onMouseEnter={() => item.isFloating && setHoveredFloatingItem(item.id)}
        onMouseLeave={() => item.isFloating && setHoveredFloatingItem(null)}
      >
        <button
          onClick={() => {
            if (isLocked) return;
            if (hasSubItems) {
              if (item.isFloating) {
                // Do nothing on click for floating parent, hover handles it, or maybe toggle generic logic?
                // User behavior typically expects hover. Click might toggle expansion in responsive.
              } else {
                if (showFull) toggleExpand(item.id);
              }
            } else if (item.viewId) {
              setCurrentView(item.viewId);
              setIsSidebarOpen(false); // Close mobile menu if open
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
                ? 'text-navy-900 dark:text-white font-medium'
                : 'text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
            }
          `}
          title={!showFull ? item.label : undefined}
        >
          <div className={`flex items-center gap-3 ${!showFull ? 'justify-center w-full' : ''} `}>
            {item.icon && (
              <span className={`transition-colors ${isActive || isParentActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'} `}>
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
              {hasSubItems && !item.isFloating && (
                <span className="text-slate-400 dark:text-slate-600">
                  {isExpanded ? <ChevronDown size={14} /> : <div className="rtl:rotate-180"><ChevronRight size={14} /></div>}
                </span>
              )}
              {hasSubItems && item.isFloating && (
                <span className="text-slate-400 dark:text-slate-600">
                  <div className="rtl:rotate-180"><ChevronRight size={14} /></div>
                </span>
              )}
            </div>
          )}
        </button>

        {/* ACCORDION SUBMENU */}
        {hasSubItems && isExpanded && showFull && !item.isFloating && (
          <div className="w-full bg-slate-50/50 dark:bg-navy-900/20 ltr:border-l rtl:border-r border-slate-200 dark:border-white/5 ltr:ml-4 rtl:mr-4 my-1">
            {item.subItems!.map(sub => renderMenuItem(sub, level + 1))}
          </div>
        )}

        {/* FLOATING SUBMENU */}
        {hasSubItems && isFloatingOpen && (
          <div
            className="absolute left-full top-0 ml-2 w-56 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-200"
            onMouseEnter={() => setHoveredFloatingItem(item.id)} // Keep open while hovering menu
            onMouseLeave={() => setHoveredFloatingItem(null)} // Close when leaving menu
          >
            <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-white/5 mb-2">
              {item.label}
            </div>
            {item.subItems!.map(sub => (
              <button
                key={sub.id}
                onClick={() => {
                  setCurrentView(sub.viewId || AppView.DASHBOARD);
                  setHoveredFloatingItem(null); // Close after click
                  setIsSidebarOpen(false);
                }}
                className={`
                            w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors
                            ${sub.viewId === currentView
                    ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-navy-900 dark:hover:text-white'
                  }
                        `}
              >
                {sub.icon && React.cloneElement(sub.icon as React.ReactElement<{ size: number }>, { size: 16 })}
                {sub.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Determine Sidebar Width
  // Collapsed (Mini) = w-16 (64px)
  // Expanded (Full) = w-64 (256px)
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

      {/* 
         SIDEBAR CONTAINER 
         - Fixed position to support "Floating" on hover without affecting ease of layout (once we adjust margin in App.tsx)
         - Usage of onMouseEnter/Leave for hover logic
      */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50
          bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl
          border-r border-slate-200 dark:border-white/5 shadow-2xl
          flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]
          ${sidebarWidthClass}
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        onMouseEnter={() => !isSidebarOpen && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Header */}
        <div className="h-16 flex items-center px-4 relative shrink-0">
          <button
            onClick={() => !isSidebarCollapsed ? toggleSidebarCollapse() : null}
            className={`flex items-center ${showFull ? 'justify-start' : 'justify-center'} w-full group overflow-hidden transition-all duration-300`}
          >
            {/* Logo Icon / Full Logo Logic */}
            {/* If collapsed (mini): show Icon only */}
            {/* If expanded: show Full Logo (Light/Dark) */}

            {showFull ? (
              <img
                src={theme === 'dark' ? "/assets/logos/logo-dark.png" : "/assets/logos/logo-light.png"}
                alt="DBR77 Consultify"
                className="h-8 w-auto object-contain transition-all"
              />
            ) : (
              <img
                src="/assets/logos/logo-icon.png"
                alt="DBR77"
                className="h-9 w-9 object-contain"
              />
            )}
          </button>

          {/* Pin / Unpin Button - Only visible if expanded */}
          {showFull && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* 
                   Logic: 
                   If isSidebarCollapsed (Mini mode) -> Button shows "Pin" (Make stationary)
                   If !isSidebarCollapsed (Pinned mode) -> Button shows "Unpin" (Make mini)
                */}
            </div>
          )}

          {/* We place the toggle button:
               If Mini: It's implicitly not there, or we could add a tiny one? 
               Usually Mini sidebar doesn't have a toggle, hover is enough, 
               BUT we need a way to 'Lock' it open. 
          */}
        </div>

        {/* Pin Actions Row (Visible when expanded) */}
        {showFull && (
          <div className="flex justify-end px-4 pb-2">
            <button
              onClick={() => {
                toggleSidebarCollapse();
                setIsHovered(false);
              }}
              className="p-1.5 rounded-md text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
              title={isSidebarCollapsed ? "Pin Sidebar (Keep Open)" : "Unpin Sidebar (Collapse)"}
            >
              {isSidebarCollapsed ? (
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Pin size={16} />
                  {/* <span>Pin</span> */}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-medium">
                  <PanelLeftClose size={16} />
                  {/* <span>Unpin</span> */}
                </div>
              )}
            </button>
          </div>
        )}

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
          <div className="space-y-1 py-2">
            {menuStructure.map(item => renderMenuItem(item))}
          </div>

          {/* Admin Section Separator */}
          {currentUser?.role === UserRole.ADMIN && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 mx-3">
              {showFull && <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">Admin</div>}
              {renderMenuItem(adminMenuItem)}
            </div>
          )}
        </nav>

        {/* Usage Stats */}
        <div className="border-t border-slate-200 dark:border-white/5 py-2">
          <SidebarUsage showFull={showFull} />
        </div>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-slate-200 dark:border-white/5 shrink-0">
          <div className="space-y-1">
            {/* Render Settings as Floating Menu Item */}
            {renderMenuItem(settingsMenuItem)}

            <button
              onClick={logout}
              className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
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
    </>
  );

};
