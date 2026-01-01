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
    actions
}) => {
    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header with title and tabs */}
            <div className="shrink-0 bg-white/50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-white/5">
                {/* Title row */}
                {(title || actions) && (
                    <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                        <div>
                            {title && (
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
                            )}
                            {subtitle && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
                            )}
                        </div>
                        {actions && (
                            <div className="flex items-center gap-3">
                                {actions}
                            </div>
                        )}
                    </div>
                )}

                {/* Tabs row */}
                <div className="px-6 flex gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => !tab.disabled && onTabChange(tab.id)}
                            disabled={tab.disabled}
                            className={`
                                flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
                                border-b-2 transition-all duration-200
                                ${activeTab === tab.id
                                    ? 'text-slate-900 dark:text-white border-red-500 bg-slate-100 dark:bg-white/5'
                                    : tab.disabled
                                        ? 'text-slate-400 dark:text-slate-600 border-transparent cursor-not-allowed'
                                        : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
                                }
                            `}
                        >
                            {tab.icon && (
                                <span className={activeTab === tab.id ? 'text-red-500 dark:text-red-400' : ''}>
                                    {tab.icon}
                                </span>
                            )}
                            {tab.label}
                            {tab.badge !== undefined && tab.badge > 0 && (
                                <span className={`
                                    px-1.5 py-0.5 text-[10px] font-bold rounded-full
                                    ${activeTab === tab.id
                                        ? 'bg-red-500 text-white'
                                        : 'bg-slate-600 text-slate-300'
                                    }
                                `}>
                                    {tab.badge > 99 ? '99+' : tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>
        </div>
    );
};

export default TabLayout;


