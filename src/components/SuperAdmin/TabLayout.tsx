/**
 * TabLayout Component
 *
 * Reusable horizontal tab navigation for SuperAdmin modules.
 * Provides consistent tab styling and behavior across all modules.
 */

import React from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  badge?: number;
  disabled?: boolean;
}

interface TabLayoutProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const TabLayout: React.FC<TabLayoutProps> = ({
  tabs,
  activeTab,
  onTabChange,
  title,
  subtitle,
  children,
  actions,
}) => {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with title and tabs */}
      <div className="shrink-0 bg-white/80 dark:bg-navy-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-navy-800 relative z-10">
        {/* Title + tabs on one row when possible */}
        <div className="px-5 pt-4 pb-0 flex items-end justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            {(title || subtitle) && (
              <div className="shrink-0">
                {title && (
                  <h1 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
                )}
              </div>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0 pb-1">{actions}</div>}
        </div>

        {/* Tabs row */}
        <div className="px-5 flex gap-0.5 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 mt-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && onTabChange(tab.id)}
              disabled={tab.disabled}
              className={`
                flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap
                border-b-2 transition-all duration-200
                ${
                  activeTab === tab.id
                    ? 'text-slate-900 dark:text-slate-100 border-navy-900 dark:border-c-border-strong bg-slate-100/80 dark:bg-white/5'
                    : tab.disabled
                      ? 'text-slate-600 dark:text-slate-400 border-transparent cursor-not-allowed'
                      : 'text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
                }
              `}
            >
              {tab.icon && (
                <span
                  className={activeTab === tab.id ? 'text-slate-900 dark:text-white' : ''}
                >
                  {tab.icon}
                </span>
              )}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`
                    px-1.5 py-0.5 text-[10px] font-bold rounded-full
                    ${activeTab === tab.id ? 'bg-c-text text-c-bg' : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300'}
                  `}
                >
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-auto">{children}</div>
    </div>
  );
};

export default TabLayout;
