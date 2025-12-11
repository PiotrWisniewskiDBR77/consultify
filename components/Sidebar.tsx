import React, { useState, useEffect } from 'react';
import { AppView, SessionMode, UserRole } from '../types';
import { useTranslation } from 'react-i18next'; // Refactored from translations object
import { useAppStore } from '../store/useAppStore';

import {
  Shield,
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Zap,
  Layers,
  BookOpen,
  Box,
  CheckCircle2,
  Lock,
  X,
  PanelLeftClose,
  PanelLeftOpen, // We utilize these for Pin/Unpin visual
  Rocket,
  Map,
  Pin,
  PinOff
} from 'lucide-react';
import { SidebarUsage } from './SidebarUsage';

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  viewId?: AppView;
  subItems?: MenuItem[];
  requiresView?: AppView;
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
    toggleTheme,
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

  // Local state for hover interaction
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

  // State for expanded sections
  const [expandedItems, setExpandedItems] = useState<string[]>(['QUICK', 'FULL', 'FULL_STEP1']);

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
      viewId: AppView.DASHBOARD
    },
    {
      id: 'MODULE_1',
      label: language === 'PL' ? '1. Oczekiwania & Wyzwania' : '1. Expectations & Challenges',
      icon: <Zap size={20} />,
      subItems: [
        { id: 'M1_1', label: language === 'PL' ? 'Profil Firmy' : 'Company Profile', viewId: AppView.QUICK_STEP1_PROFILE },
        { id: 'M1_2', label: language === 'PL' ? 'Cele Strategiczne' : 'Goals & Expectations', viewId: AppView.QUICK_STEP2_USER_CONTEXT, requiresView: AppView.QUICK_STEP1_PROFILE }, // Assuming STEP2 maps to Context/Goals
        { id: 'M1_3', label: language === 'PL' ? 'Mapa Wyzwań' : 'Challenges Map', viewId: AppView.QUICK_STEP3_EXPECTATIONS, requiresView: AppView.QUICK_STEP2_USER_CONTEXT },
      ]
    },
    {
      id: 'MODULE_2',
      label: language === 'PL' ? '2. Ocena DrD & Audyty' : '2. Assessment (DRD)',
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
      label: language === 'PL' ? '3. Inicjatywy & Roadmapa' : '3. Initiatives & Roadmap',
      icon: <Layers size={20} />,
      subItems: [
        { id: 'M3_1', label: language === 'PL' ? 'Generator & Lista' : 'Initiatives List', viewId: AppView.FULL_STEP2_INITIATIVES, requiresView: AppView.FULL_STEP1_ASSESSMENT },
        { id: 'M3_2', label: language === 'PL' ? 'Roadmapa' : 'Roadmap Builder', viewId: AppView.FULL_STEP3_ROADMAP, requiresView: AppView.FULL_STEP2_INITIATIVES },
      ]
    },
    {
      id: 'MODULE_4',
      label: language === 'PL' ? '4. Pilot Execution' : '4. Pilot Execution',
      icon: <Rocket size={20} />, // Need to import Rocket if not present
      viewId: AppView.FULL_PILOT_EXECUTION,
      requiresView: AppView.FULL_STEP3_ROADMAP
    },
    {
      id: 'MODULE_5',
      label: language === 'PL' ? '5. Full Rollout' : '5. Full Rollout',
      icon: <Map size={20} />, // Need to import Map if not present
      viewId: AppView.FULL_ROLLOUT,
      requiresView: AppView.FULL_STEP3_ROADMAP
    },
    {
      id: 'MODULE_6',
      label: language === 'PL' ? '6. Ekonomia & ROI' : '6. Economics & ROI',
      icon: <Box size={20} />, // Using specific icon for ROI
      viewId: AppView.FULL_STEP4_ROI,
      requiresView: AppView.FULL_STEP2_INITIATIVES
    },
    {
      id: 'MODULE_7',
      label: language === 'PL' ? '7. Raporty' : '7. Execution Reports',
      icon: <BookOpen size={20} />,
      viewId: AppView.FULL_STEP6_REPORTS,
      requiresView: AppView.FULL_STEP5_EXECUTION
    }
  ];

  const adminMenuItem: MenuItem = {
    id: 'ADMIN',
    label: language === 'PL' ? 'Panel Administratora' : 'Admin Panel',
    icon: <Shield size={20} />,
    subItems: [
      { id: 'ADMIN_DASHBOARD', label: t('sidebar.dashboard'), viewId: AppView.ADMIN_DASHBOARD },
      { id: 'ADMIN_USERS', label: language === 'PL' ? 'Użytkownicy' : 'Users', viewId: AppView.ADMIN_USERS },
      { id: 'ADMIN_PROJECTS', label: language === 'PL' ? 'Projekty' : 'Projects', viewId: AppView.ADMIN_PROJECTS },
      { id: 'ADMIN_LLM', label: language === 'PL' ? 'Zarządzanie LLM' : 'LLM Management', viewId: AppView.ADMIN_LLM },
      { id: 'ADMIN_KNOWLEDGE', label: language === 'PL' ? 'Baza Wiedzy' : 'Knowledge Base', viewId: AppView.ADMIN_KNOWLEDGE },
      { id: 'ADMIN_FEEDBACK', label: language === 'PL' ? 'Feedback' : 'User Feedback', viewId: AppView.ADMIN_FEEDBACK },
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
    if (parentsToExpand && parentsToExpand.length > 0) {
      setExpandedItems(prev => {
        const next = new Set([...prev, ...parentsToExpand]);
        return Array.from(next);
      });
    }
  }, [currentView, currentUser, isSidebarCollapsed]);

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const isExpanded = expandedItems.includes(item.id);
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isActive = item.viewId === currentView;
    const isCompleted = item.viewId && completedViews.includes(item.viewId);

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
      <div key={item.id} className="w-full">
        <button
          onClick={() => {
            if (isLocked) return;
            if (hasSubItems) {
              if (showFull) toggleExpand(item.id);
              else {
                // In mini mode, clicking a parent expanding its children might be handled by expanding the sidebar first?
                // For now, assume user hovers to expand, then clicks.
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
                : 'text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}
          `}
          title={!showFull ? item.label : undefined}
        >
          <div className={`flex items-center gap-3 ${!showFull ? 'justify-center w-full' : ''}`}>
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
                <span className="text-slate-400 dark:text-slate-600">
                  {isExpanded ? <ChevronDown size={14} /> : <div className="rtl:rotate-180"><ChevronRight size={14} /></div>}
                </span>
              )}
            </div>
          )}
        </button>

        {hasSubItems && isExpanded && showFull && (
          <div className="w-full bg-slate-50/50 dark:bg-navy-900/20 ltr:border-l rtl:border-r border-slate-200 dark:border-white/5 ltr:ml-4 rtl:mr-4 my-1">
            {item.subItems!.map(sub => renderMenuItem(sub, level + 1))}
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
            onClick={() => !isSidebarCollapsed ? toggleSidebarCollapse() : null} // Clicking logo when pinned logic could go here, but let's stick to dedicated pin button
            className="flex items-center gap-3 w-full group overflow-hidden"
          >
            <div className="h-9 w-9 min-w-[2.25rem] rounded-xl bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center shadow-lg shadow-brand/20">
              <span className="text-white font-black text-xs tracking-tighter">DBR</span>
            </div>

            {showFull && (
              <div className="flex items-center justify-between flex-1 animate-fade-in">
                <div className="flex flex-col items-start leading-none">
                  <span className="font-bold text-base tracking-tight text-navy-900 dark:text-white">CONSULTIFY</span>
                  <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Enterprise</span>
                </div>
              </div>
            )}</button>

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
              onClick={toggleSidebarCollapse}
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
            <button
              onClick={() => setCurrentView(AppView.SETTINGS_PROFILE as AppView)}
              className={`
                 w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                 ${currentView.startsWith('SETTINGS')
                  ? 'bg-brand/10 text-brand dark:text-purple-300'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-navy-900 dark:hover:text-white'} 
                ${!showFull ? 'justify-center px-0' : ''}`}
              title="Settings"
            >
              <Settings size={18} />
              {showFull && <span>{t('sidebar.settings')}</span>}
            </button>

            <button
              onClick={logout}
              className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400
                ${!showFull ? 'justify-center px-0' : ''}`}
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
