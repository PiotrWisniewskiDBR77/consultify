/**
 * PillNavigation - Modern pill-style tab navigation
 * Part of Unified MyWork Module
 * UNIFIED DESIGN: Same height/padding/font as NotificationsHub tabs
 */

import React from 'react';
import {
    CheckSquare,
    Scale,
    FolderKanban,
    Plus
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type WorkTab = 'tasks' | 'decisions' | 'projects';

interface PillNavigationProps {
    activeTab: WorkTab;
    onTabChange: (tab: WorkTab) => void;
    counts: {
        tasks: number;
        decisions: number;
    };
    onCreateNew: () => void;
}

interface TabConfig {
    key: WorkTab;
    label: string;
    icon: React.ElementType;
    count?: number;
    activeColor: string;
    comingSoon?: boolean;
}

export const PillNavigation: React.FC<PillNavigationProps> = ({
    activeTab,
    onTabChange,
    counts,
    onCreateNew
}) => {
    const { t } = useTranslation();

    const tabs: TabConfig[] = [
        {
            key: 'tasks',
            label: t('myWork.tasks', 'Tasks'),
            icon: CheckSquare,
            count: counts.tasks,
            activeColor: 'bg-blue-500 text-white'
        },
        {
            key: 'decisions',
            label: t('myWork.decisions', 'Decisions'),
            icon: Scale,
            count: counts.decisions,
            activeColor: 'bg-purple-500 text-white'
        },
        {
            key: 'projects',
            label: t('myWork.projects', 'Projects'),
            icon: FolderKanban,
            activeColor: 'bg-emerald-500 text-white',
            comingSoon: true
        }
    ];

    const getButtonLabel = () => {
        switch (activeTab) {
            case 'tasks':
                return t('myWork.newTask', 'New Task');
            case 'decisions':
                return t('myWork.newDecision', 'New Decision');
            default:
                return t('common.new', 'New');
        }
    };

    return (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-white/10">
            {/* Tab Pills */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-navy-800 rounded-lg">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.key}
                            onClick={() => onTabChange(tab.key)}
                            disabled={tab.comingSoon}
                            className={`
                                flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium
                                transition-all duration-150
                                ${isActive
                                    ? `${tab.activeColor} shadow-sm`
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
                                }
                                ${tab.comingSoon ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                        >
                            <Icon size={14} />
                            <span>{tab.label}</span>
                            
                            {/* Count Badge */}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className={`
                                    px-1.5 min-w-[20px] text-center text-[10px] font-semibold rounded-full
                                    ${isActive 
                                        ? 'bg-white/25' 
                                        : 'bg-slate-200 dark:bg-white/10'
                                    }
                                `}>
                                    {tab.count}
                                </span>
                            )}
                            
                            {/* Coming Soon Badge */}
                            {tab.comingSoon && (
                                <span className="px-1.5 text-[9px] font-semibold rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                                    Soon
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Create Button */}
            {activeTab !== 'projects' && (
                <button
                    onClick={onCreateNew}
                    className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 rounded-lg shadow-sm hover:shadow transition-all duration-150"
                >
                    <Plus size={14} />
                    <span>{getButtonLabel()}</span>
                </button>
            )}
        </div>
    );
};

export default PillNavigation;
