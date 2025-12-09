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
  X
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
    fullSessionData
  } = useAppStore();

  const t = translations.sidebar;

  // Calculate completed views logic moved here
  const completedViews = React.useMemo(() => {
    const completed: AppView[] = [];

    // Quick Assessment
    if (freeSessionData.step1Completed) completed.push(AppView.QUICK_STEP1_PROFILE);
    if (freeSessionData.step2Completed) completed.push(AppView.QUICK_STEP2_CHALLENGES);
    if (freeSessionData.step3Completed) completed.push(AppView.QUICK_STEP3_RECOMMENDATIONS);

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
      label: t.dashboard[language],
      icon: <LayoutDashboard size={18} />,
      viewId: AppView.DASHBOARD
    },
    {
      id: 'QUICK',
      label: t.quickAssessment[language],
      icon: <Zap size={18} />,
      subItems: [
        { id: 'Q1', label: t.quickStep1[language], viewId: AppView.QUICK_STEP1_PROFILE },
        { id: 'Q2', label: t.quickStep2[language], viewId: AppView.QUICK_STEP2_CHALLENGES, requiresView: AppView.QUICK_STEP1_PROFILE },
        { id: 'Q3', label: t.quickStep3[language], viewId: AppView.QUICK_STEP3_RECOMMENDATIONS, requiresView: AppView.QUICK_STEP2_CHALLENGES },
      ]
    },
    {
      id: 'FULL',
      label: t.fullProject[language],
      icon: <Layers size={18} />,
      subItems: [
        {
          id: 'FULL_STEP1',
          label: t.fullStep1[language],
          subItems: [
            { id: 'FS1_1', label: t.fullStep1_proc[language], viewId: AppView.FULL_STEP1_PROCESSES },
            { id: 'FS1_2', label: t.fullStep1_prod[language], viewId: AppView.FULL_STEP1_DIGITAL },
            { id: 'FS1_3', label: t.fullStep1_model[language], viewId: AppView.FULL_STEP1_MODELS },
            { id: 'FS1_4', label: t.fullStep1_data[language], viewId: AppView.FULL_STEP1_DATA },
            { id: 'FS1_5', label: t.fullStep1_cult[language], viewId: AppView.FULL_STEP1_CULTURE },
            { id: 'FS1_6', label: t.fullStep1_ai[language], viewId: AppView.FULL_STEP1_AI },
          ]
        },
        { id: 'FULL_STEP2', label: t.fullStep2[language], viewId: AppView.FULL_STEP2_INITIATIVES, requiresView: AppView.FULL_STEP1_ASSESSMENT },
        { id: 'FULL_STEP3', label: t.fullStep3[language], viewId: AppView.FULL_STEP3_ROADMAP, requiresView: AppView.FULL_STEP2_INITIATIVES },
        { id: 'FULL_STEP4', label: t.fullStep4[language], viewId: AppView.FULL_STEP4_ROI, requiresView: AppView.FULL_STEP3_ROADMAP },
        { id: 'FULL_STEP5', label: t.fullStep5[language], viewId: AppView.FULL_STEP5_EXECUTION, requiresView: AppView.FULL_STEP4_ROI },
        { id: 'FULL_STEP6', label: t.fullStep6[language], viewId: AppView.FULL_STEP6_REPORTS, requiresView: AppView.FULL_STEP5_EXECUTION },
      ]
    },
    {
      id: 'MASTERCLASS',
      label: t.masterclass[language],
      icon: <BookOpen size={18} />,
      viewId: AppView.MASTERCLASS
    },
    {
      id: 'RESOURCES',
      label: t.resources[language],
      icon: <Box size={18} />,
      viewId: AppView.RESOURCES
    }
  ];

  // Auto-expand sidebar based on currentView
  useEffect(() => {
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

    const parentsToExpand = findParentIds(menuStructure, currentView);
    if (parentsToExpand && parentsToExpand.length > 0) {
      setExpandedItems(prev => {
        const next = new Set([...prev, ...parentsToExpand]);
        return Array.from(next);
      });
    }
  }, [currentView]);

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const isExpanded = expandedItems.includes(item.id);
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isActive = item.viewId === currentView;
    const isCompleted = item.viewId && completedViews.includes(item.viewId);

    // Determine if locked
    const isLocked = item.requiresView && !completedViews.includes(item.requiresView);

    // Check if any child is active to highlight parent
    const isChildActive = (i: MenuItem): boolean => {
      if (i.viewId === currentView) return true;
      if (i.subItems) return i.subItems.some(sub => isChildActive(sub));
      return false;
    };
    const isParentActive = hasSubItems && isChildActive(item);

    const paddingLeft = level === 0 ? 'px-4' : level === 1 ? 'px-8' : 'px-12';

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
            w-full flex items-center justify-between py-2.5 text-sm transition-all relative group
            ${paddingLeft}
            ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${isActive
              ? 'bg-gradient-to-r from-purple-600/20 to-transparent border-l-2 border-purple-500 text-white'
              : isParentActive
                ? 'text-white font-medium border-l-2 border-transparent'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent'}
          `}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {item.icon && <span className={`${isActive || isParentActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'}`}>{item.icon}</span>}
            <span className="truncate tracking-wide">
              {item.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isCompleted && !isActive && (
              <CheckCircle2 size={14} className="text-green-500/80" />
            )}
            {isLocked && (
              <Lock size={12} className="text-slate-500" />
            )}
            {hasSubItems && (
              <span className="text-slate-600">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            )}
          </div>
        </button>

        {hasSubItems && isExpanded && (
          <div className="w-full bg-navy-900/20 border-l border-white/5 ml-4 my-1">
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

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-navy-950 border-r border-elegant flex flex-col transition-transform duration-300 ease-in-out shrink-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:relative'}
      `}>
        {/* Header / Logo */}
        <div className="h-20 flex items-center px-6 border-b border-elegant relative bg-navy-950">
          <div className="flex items-center gap-3 font-bold text-xl tracking-tight text-white">
            <div className="h-8 px-2 rounded-sm bg-purple-600 flex items-center justify-center shadow-glow">
              <span className="text-white font-bold text-xs tracking-tighter">DBR77</span>
            </div>
            <span className="tracking-widest text-sm">CONSULTIFY</span>
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden absolute right-4 text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-navy-800 scrollbar-track-transparent">
          <div className="space-y-1">
            {menuStructure.map(item => renderMenuItem(item))}
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-elegant bg-navy-950">
          {/* Admin Link */}
          {currentUser && currentUser.role === UserRole.ADMIN && (
            <button
              onClick={() => setCurrentView(AppView.ADMIN_DASHBOARD)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm transition-colors mb-1 ${currentView.startsWith('ADMIN') ? 'bg-purple-600/20 text-purple-300' : 'text-slate-400 hover:text-white hover:bg-navy-900'}`}
            >
              <Shield size={18} />
              Admin Panel
            </button>
          )}

          <button
            onClick={() => setCurrentView(AppView.SETTINGS_PROFILE as AppView)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm transition-colors mb-1 ${currentView.startsWith('SETTINGS') ? 'bg-navy-800 text-white' : 'text-slate-400 hover:text-white hover:bg-navy-900'}`}
          >
            <Settings size={18} />
            {t.settings[language]}
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={18} />
            {t.logOut[language]}
          </button>
        </div>
      </div>
    </>
  );
};
