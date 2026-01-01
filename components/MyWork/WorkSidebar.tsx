/**
 * WorkSidebar - Left navigation sidebar for My Work module
 * ClickUp-style minimalist design with collapsible sections
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CheckSquare,
    FileQuestion,
    FolderKanban,
    ChevronDown,
    ChevronRight,
    AlertCircle,
    Calendar,
    CalendarDays,
    Clock,
    CircleDashed
} from 'lucide-react';

export type WorkSection = 'tasks' | 'decisions' | 'projects';
export type TaskTimeGroup = 'all' | 'overdue' | 'today' | 'week' | 'later' | 'no-date';
export type DecisionGroup = 'all' | 'my' | 'awaiting';

interface TaskCounts {
    total: number;
    overdue: number;
    today: number;
    week: number;
    later: number;
    noDate: number;
}

interface DecisionCounts {
    total: number;
    my: number;
    awaiting: number;
}

interface WorkSidebarProps {
    activeSection: WorkSection;
    onSectionChange: (section: WorkSection) => void;
    taskTimeGroup: TaskTimeGroup;
    onTaskTimeGroupChange: (group: TaskTimeGroup) => void;
    decisionGroup: DecisionGroup;
    onDecisionGroupChange: (group: DecisionGroup) => void;
    taskCounts: TaskCounts;
    decisionCounts: DecisionCounts;
}

export const WorkSidebar: React.FC<WorkSidebarProps> = ({
    activeSection,
    onSectionChange,
    taskTimeGroup,
    onTaskTimeGroupChange,
    decisionGroup,
    onDecisionGroupChange,
    taskCounts,
    decisionCounts
}) => {
    const { t } = useTranslation();
    const [expandedSections, setExpandedSections] = useState<Set<WorkSection>>(
        new Set(['tasks', 'decisions'])
    );

    const toggleSection = (section: WorkSection) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    };

    const taskSubItems = [
        { key: 'overdue' as TaskTimeGroup, label: t('myWork.timeGroup.overdue', 'Overdue'), count: taskCounts.overdue, icon: AlertCircle, color: 'text-red-500' },
        { key: 'today' as TaskTimeGroup, label: t('myWork.timeGroup.today', 'Today'), count: taskCounts.today, icon: Calendar, color: 'text-blue-500' },
        { key: 'week' as TaskTimeGroup, label: t('myWork.timeGroup.thisWeek', 'This Week'), count: taskCounts.week, icon: CalendarDays, color: 'text-slate-500' },
        { key: 'later' as TaskTimeGroup, label: t('myWork.timeGroup.later', 'Later'), count: taskCounts.later, icon: Clock, color: 'text-slate-400' },
        { key: 'no-date' as TaskTimeGroup, label: t('myWork.timeGroup.noDate', 'No Date'), count: taskCounts.noDate, icon: CircleDashed, color: 'text-slate-300' },
    ];

    const decisionSubItems = [
        { key: 'my' as DecisionGroup, label: t('myWork.decisions.my', 'My Decisions'), count: decisionCounts.my },
        { key: 'awaiting' as DecisionGroup, label: t('myWork.decisions.awaiting', 'Awaiting Others'), count: decisionCounts.awaiting },
    ];

    return (
        <div className="w-60 bg-white dark:bg-navy-900 border-r border-slate-200 dark:border-white/10 h-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-4 border-b border-slate-100 dark:border-white/5">
                <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {t('myWork.title', 'My Work')}
                </h2>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-2">
                {/* My Tasks Section */}
                <div className="mb-1">
                    <button
                        onClick={() => {
                            onSectionChange('tasks');
                            onTaskTimeGroupChange('all');
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                            activeSection === 'tasks'
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSection('tasks');
                                }}
                                className="p-0.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded"
                            >
                                {expandedSections.has('tasks') ? (
                                    <ChevronDown size={14} className="text-slate-400" />
                                ) : (
                                    <ChevronRight size={14} className="text-slate-400" />
                                )}
                            </button>
                            <CheckSquare size={16} />
                            <span className="font-medium">{t('myWork.sections.tasks', 'My Tasks')}</span>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            activeSection === 'tasks'
                                ? 'bg-blue-100 dark:bg-blue-800/50 text-blue-700 dark:text-blue-200'
                                : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                        }`}>
                            {taskCounts.total}
                        </span>
                    </button>

                    {/* Task Sub-items */}
                    {expandedSections.has('tasks') && (
                        <div className="ml-6 border-l border-slate-200 dark:border-white/10">
                            {taskSubItems.map((item) => (
                                <button
                                    key={item.key}
                                    onClick={() => {
                                        onSectionChange('tasks');
                                        onTaskTimeGroupChange(item.key);
                                    }}
                                    className={`w-full flex items-center justify-between pl-4 pr-4 py-1.5 text-xs transition-colors ${
                                        activeSection === 'tasks' && taskTimeGroup === item.key
                                            ? 'bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <item.icon size={12} className={item.color} />
                                        <span>{item.label}</span>
                                    </div>
                                    {item.count > 0 && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                            item.key === 'overdue' && item.count > 0
                                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                                : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                                        }`}>
                                            {item.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Decisions Section */}
                <div className="mb-1">
                    <button
                        onClick={() => {
                            onSectionChange('decisions');
                            onDecisionGroupChange('all');
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                            activeSection === 'decisions'
                                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSection('decisions');
                                }}
                                className="p-0.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded"
                            >
                                {expandedSections.has('decisions') ? (
                                    <ChevronDown size={14} className="text-slate-400" />
                                ) : (
                                    <ChevronRight size={14} className="text-slate-400" />
                                )}
                            </button>
                            <FileQuestion size={16} />
                            <span className="font-medium">{t('myWork.sections.decisions', 'Decisions')}</span>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            activeSection === 'decisions'
                                ? 'bg-purple-100 dark:bg-purple-800/50 text-purple-700 dark:text-purple-200'
                                : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                        }`}>
                            {decisionCounts.total}
                        </span>
                    </button>

                    {/* Decision Sub-items */}
                    {expandedSections.has('decisions') && (
                        <div className="ml-6 border-l border-slate-200 dark:border-white/10">
                            {decisionSubItems.map((item) => (
                                <button
                                    key={item.key}
                                    onClick={() => {
                                        onSectionChange('decisions');
                                        onDecisionGroupChange(item.key);
                                    }}
                                    className={`w-full flex items-center justify-between pl-4 pr-4 py-1.5 text-xs transition-colors ${
                                        activeSection === 'decisions' && decisionGroup === item.key
                                            ? 'bg-purple-50/50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <span>{item.label}</span>
                                    {item.count > 0 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                                            {item.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* My Projects Section */}
                <div className="mb-1">
                    <button
                        onClick={() => onSectionChange('projects')}
                        className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                            activeSection === 'projects'
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-4" /> {/* Spacer for alignment */}
                            <FolderKanban size={16} />
                            <span className="font-medium">{t('myWork.sections.projects', 'My Projects')}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            Soon
                        </span>
                    </button>
                </div>
            </nav>
        </div>
    );
};

export default WorkSidebar;


