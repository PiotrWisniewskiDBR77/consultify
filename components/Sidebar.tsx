import React, { useState, useEffect } from 'react';
import { AppView, SessionMode, UserRole } from '../types';
import { translations } from '../translations';
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
  PanelLeftOpen,
  Rocket,
  Map
} from 'lucide-react';

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
    isSidebarCollapsed,
    toggleSidebarCollapse
  } = useAppStore();

  const t = translations.sidebar;

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
    setExpandedItems(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const menuStructure: MenuItem[] = [
    {
      id: 'DASHBOARD',
      label: t.dashboard[language], // Module 0
      icon: <LayoutDashboard size={18} />,
      viewId: AppView.DASHBOARD
    },
    {
      id: 'MODULE_1',
      label: language === 'PL' ? '1. Oczekiwania & Wyzwania' : '1. Expectations & Challenges',
      icon: <Zap size={18} />,
      subItems: [
        { id: 'M1_1', label: language === 'PL' ? 'Profil Firmy' : 'Company Profile', viewId: AppView.QUICK_STEP1_PROFILE },
        { id: 'M1_2', label: language === 'PL' ? 'Cele Strategiczne' : 'Goals & Expectations', viewId: AppView.QUICK_STEP2_USER_CONTEXT, requiresView: AppView.QUICK_STEP1_PROFILE }, // Assuming STEP2 maps to Context/Goals
        { id: 'M1_3', label: language === 'PL' ? 'Mapa Wyzwań' : 'Challenges Map', viewId: AppView.QUICK_STEP3_EXPECTATIONS, requiresView: AppView.QUICK_STEP2_USER_CONTEXT },
      ]
    },
    {
      id: 'MODULE_2',
      label: language === 'PL' ? '2. Ocena DrD & Audyty' : '2. Assessment (DRD)',
      icon: <CheckCircle2 size={18} />,
      subItems: [
        { id: 'M2_1', label: t.fullStep1_proc[language], viewId: AppView.FULL_STEP1_PROCESSES },
        { id: 'M2_2', label: t.fullStep1_prod[language], viewId: AppView.FULL_STEP1_DIGITAL },
        { id: 'M2_3', label: t.fullStep1_model[language], viewId: AppView.FULL_STEP1_MODELS },
        { id: 'M2_4', label: t.fullStep1_data[language], viewId: AppView.FULL_STEP1_DATA },
        { id: 'M2_5', label: t.fullStep1_cult[language], viewId: AppView.FULL_STEP1_CULTURE },
        { id: 'M2_6', label: t.fullStep1_ai[language], viewId: AppView.FULL_STEP1_AI },
      ]
    },
    {
      id: 'MODULE_3',
      label: language === 'PL' ? '3. Inicjatywy & Roadmapa' : '3. Initiatives & Roadmap',
      icon: <Layers size={18} />,
      subItems: [
        { id: 'M3_1', label: language === 'PL' ? 'Generator & Lista' : 'Initiatives List', viewId: AppView.FULL_STEP2_INITIATIVES, requiresView: AppView.FULL_STEP1_ASSESSMENT },
        { id: 'M3_2', label: language === 'PL' ? 'Roadmapa' : 'Roadmap Builder', viewId: AppView.FULL_STEP3_ROADMAP, requiresView: AppView.FULL_STEP2_INITIATIVES },
      ]
    },
    {
      id: 'MODULE_4',
      label: language === 'PL' ? '4. Pilot Execution' : '4. Pilot Execution',
      icon: <Rocket size={18} />, // Need to import Rocket if not present
      viewId: AppView.FULL_PILOT_EXECUTION,
      requiresView: AppView.FULL_STEP3_ROADMAP
    },
    {
      id: 'MODULE_5',
      label: language === 'PL' ? '5. Full Rollout' : '5. Full Rollout',
      icon: <Map size={18} />, // Need to import Map if not present
      viewId: AppView.FULL_ROLLOUT,
      requiresView: AppView.FULL_STEP3_ROADMAP
    },
    {
      id: 'MODULE_6',
      label: language === 'PL' ? '6. Ekonomia & ROI' : '6. Economics & ROI',
      icon: <Box size={18} />, // Using specific icon for ROI
      viewId: AppView.FULL_STEP4_ROI,
      requiresView: AppView.FULL_STEP2_INITIATIVES
    },
    {
      id: 'MODULE_7',
      label: language === 'PL' ? '7. Raporty' : '7. Execution Reports',
      icon: <BookOpen size={18} />,
      viewId: AppView.FULL_STEP6_REPORTS,
      requiresView: AppView.FULL_STEP5_EXECUTION
    }
  ];

  const adminMenuItem: MenuItem = {
    id: 'ADMIN',
    label: language === 'PL' ? 'Panel Administratora' : 'Admin Panel',
    icon: <Shield size={18} />,
    subItems: [
      { id: 'ADMIN_DASHBOARD', label: t.dashboard[language], viewId: AppView.ADMIN_DASHBOARD },
      { id: 'ADMIN_USERS', label: language === 'PL' ? 'Użytkownicy' : 'Users', viewId: AppView.ADMIN_USERS },
      { id: 'ADMIN_PROJECTS', label: language === 'PL' ? 'Projekty' : 'Projects', viewId: AppView.ADMIN_PROJECTS },
      { id: 'ADMIN_LLM', label: language === 'PL' ? 'Zarządzanie LLM' : 'LLM Management', viewId: AppView.ADMIN_LLM },
      { id: 'ADMIN_KNOWLEDGE', label: language === 'PL' ? 'Baza Wiedzy' : 'Knowledge Base', viewId: AppView.ADMIN_KNOWLEDGE },
      { id: 'ADMIN_FEEDBACK', label: language === 'PL' ? 'Feedback' : 'User Feedback', viewId: AppView.ADMIN_FEEDBACK },
    ]
  };

  // Auto-expand sidebar based on currentView
  useEffect(() => {
    if (isSidebarCollapsed) {
      setExpandedItems([]);
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

    const paddingLeft = isSidebarCollapsed ? 'justify-center px-2' : level === 0 ? 'px-2.5' : level === 1 ? 'px-5' : 'px-8';

    return (
      <div key={item.id} className="w-full">
        <button
          onClick={() => {
            if (isLocked) return;
            if (hasSubItems) {
              toggleExpand(item.id);
            } else if (item.viewId) {
              setCurrentView(item.viewId);
              setIsSidebarOpen(false);
            }
          }}
          disabled={isLocked}
          className={`
            w-full flex items-center justify-between py-1 text-xs transition-all relative group
            ${paddingLeft}
            ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${isSidebarCollapsed ? '' : ''}
            ${isActive
              ? 'bg-gradient-to-r from-purple-600/10 to-transparent ltr:border-l-2 rtl:border-r-2 border-purple-500 text-purple-700 dark:text-white dark:from-purple-600/20'
              : isParentActive
                ? 'text-navy-900 dark:text-white font-medium ltr:border-l-2 rtl:border-r-2 border-transparent'
                : 'text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 ltr:border-l-2 rtl:border-r-2 border-transparent'}
          `}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            {item.icon && <span className={`${isActive || isParentActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>{React.cloneElement(item.icon as React.ReactElement<{ size: number }>, { size: 16 })}</span>}
            {(!isSidebarCollapsed) && (
              <span className="truncate tracking-wide">
                {item.label}
              </span>
            )}
          </div>

          {!isSidebarCollapsed && (
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

        {hasSubItems && isExpanded && !isSidebarCollapsed && (
          <div className="w-full bg-slate-50/50 dark:bg-navy-900/20 ltr:border-l rtl:border-r border-slate-200 dark:border-white/5 ltr:ml-4 rtl:mr-4 my-1">
            {item.subItems!.map(sub => renderMenuItem(sub, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container - Floating Dock Style */}
      <div className={`
        fixed inset-y-0 ltr:left-0 rtl:right-0 z-50 
        my-3 ml-3 rounded-xl border border-white/20 dark:border-white/5
        ${isSidebarCollapsed ? 'w-14' : 'w-56'} 
        bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl shadow-2xl dark:shadow-black/50
        flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] shrink-0
        ${isSidebarOpen
          ? 'translate-x-0'
          : language === 'AR' ? 'translate-x-full lg:translate-x-0 lg:relative' : '-translate-x-full lg:translate-x-0 lg:relative'}
      `}>
        {/* Header / Logo */}
        <div className="h-12 flex items-center px-3 mb-1 relative">
          <button onClick={toggleSidebarCollapse} className="flex items-center gap-3 w-full group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand to-brand-hover flex items-center justify-center shadow-lg shadow-brand/20 group-hover:scale-105 transition-transform duration-300">
              <span className="text-white font-black text-xs tracking-tighter">DBR</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="flex items-center justify-between flex-1 animate-fade-in">
                <div className="flex flex-col items-start leading-none">
                  <span className="font-bold text-base tracking-tight text-navy-900 dark:text-white">CONSULTIFY</span>
                  <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Enterprise</span>
                </div>
              </div>
            )}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden absolute right-4 text-slate-400 hover:text-navy-900 dark:hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-1.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent space-y-0.5">
          {menuStructure.map(item => renderMenuItem(item))}
        </nav>

        {/* Bottom Actions */}
        <div className="mt-auto px-3 pb-4">
          {currentUser?.role === UserRole.ADMIN && (
            <div className="mb-2 pb-2 border-b border-slate-200/50 dark:border-white/5">
              {renderMenuItem(adminMenuItem)}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <button
              onClick={() => setCurrentView(AppView.SETTINGS_PROFILE as AppView)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200
                ${currentView.startsWith('SETTINGS')
                  ? 'bg-brand/10 text-brand dark:text-purple-300'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-navy-900 dark:hover:text-white'} 
                ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Settings size={18} />
              {!isSidebarCollapsed && t.settings[language]}
            </button>
            <button
              onClick={logout}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200
               text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400
               ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
            >
              <LogOut size={18} />
              {!isSidebarCollapsed && t.logOut[language]}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
