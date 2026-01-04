/**
 * FocusModeSelector - Focus mode pills for AI context filtering
 * Like Perplexity's source filters: All | PMO Docs | Project | Research | Web
 */

import { BookOpen, Briefcase, FolderOpen, Globe, Search, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { FocusMode } from '../../../types';

interface FocusModeSelectorProps {
    value: FocusMode;
    onChange: (mode: FocusMode) => void;
    disabled?: boolean;
    compact?: boolean;
    className?: string;
}

interface FocusModeOption {
    value: FocusMode;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
}

export const FocusModeSelector: React.FC<FocusModeSelectorProps> = ({
    value,
    onChange,
    disabled = false,
    compact = false,
    className = '',
}) => {
    const { t } = useTranslation();

    const focusModes: FocusModeOption[] = [
        {
            value: 'all',
            label: t('focusMode.all', 'All'),
            description: t('focusMode.allDesc', 'Use all available sources'),
            icon: <Sparkles size={14} />,
            color: 'purple',
        },
        {
            value: 'pmo-docs',
            label: t('focusMode.pmoDocs', 'PMO Docs'),
            description: t('focusMode.pmoDocsDesc', 'ISO, PMBOK, PRINCE2 standards'),
            icon: <BookOpen size={14} />,
            color: 'blue',
        },
        {
            value: 'project-data',
            label: t('focusMode.projectData', 'Project'),
            description: t('focusMode.projectDataDesc', 'Current project context'),
            icon: <FolderOpen size={14} />,
            color: 'green',
        },
        {
            value: 'research',
            label: t('focusMode.research', 'Research'),
            description: t('focusMode.researchDesc', 'Deep analysis mode'),
            icon: <Search size={14} />,
            color: 'amber',
        },
        {
            value: 'web',
            label: t('focusMode.web', 'Web'),
            description: t('focusMode.webDesc', 'Real-time web search'),
            icon: <Globe size={14} />,
            color: 'cyan',
        },
    ];

    const getColorClasses = (color: string, isActive: boolean) => {
        const colors: Record<string, { active: string; inactive: string }> = {
            purple: {
                active: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
                inactive:
                    'text-slate-600 dark:text-slate-400 border-transparent hover:bg-purple-50 dark:hover:bg-purple-900/20',
            },
            blue: {
                active: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
                inactive:
                    'text-slate-600 dark:text-slate-400 border-transparent hover:bg-blue-50 dark:hover:bg-blue-900/20',
            },
            green: {
                active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
                inactive:
                    'text-slate-600 dark:text-slate-400 border-transparent hover:bg-green-50 dark:hover:bg-green-900/20',
            },
            amber: {
                active: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
                inactive:
                    'text-slate-600 dark:text-slate-400 border-transparent hover:bg-amber-50 dark:hover:bg-amber-900/20',
            },
            cyan: {
                active: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700',
                inactive:
                    'text-slate-600 dark:text-slate-400 border-transparent hover:bg-cyan-50 dark:hover:bg-cyan-900/20',
            },
        };

        return isActive ? colors[color].active : colors[color].inactive;
    };

    if (compact) {
        return (
            <div className={`flex items-center gap-1 ${className}`}>
                {focusModes.map((mode) => (
                    <button
                        key={mode.value}
                        onClick={() => onChange(mode.value)}
                        disabled={disabled}
                        className={`
              p-1.5 rounded-md border transition-all duration-200
              ${getColorClasses(mode.color, value === mode.value)}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
                        title={`${mode.label}: ${mode.description}`}
                    >
                        {mode.icon}
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
            {focusModes.map((mode) => {
                const isActive = value === mode.value;

                return (
                    <button
                        key={mode.value}
                        onClick={() => onChange(mode.value)}
                        disabled={disabled}
                        className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium
              transition-all duration-200
              ${getColorClasses(mode.color, isActive)}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
                        title={mode.description}
                    >
                        {mode.icon}
                        <span>{mode.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

/**
 * Focus Mode Display Badge - Shows current mode inline
 */
export const FocusModeBadge: React.FC<{
    mode: FocusMode;
    className?: string;
}> = ({ mode, className = '' }) => {
    const { t } = useTranslation();

    const modeConfig: Record<FocusMode, { label: string; icon: React.ReactNode; color: string }> = {
        all: {
            label: t('focusMode.all', 'All'),
            icon: <Sparkles size={12} />,
            color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
        },
        'pmo-docs': {
            label: t('focusMode.pmoDocs', 'PMO'),
            icon: <BookOpen size={12} />,
            color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        },
        'project-data': {
            label: t('focusMode.projectData', 'Project'),
            icon: <FolderOpen size={12} />,
            color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        },
        research: {
            label: t('focusMode.research', 'Research'),
            icon: <Search size={12} />,
            color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        },
        web: {
            label: t('focusMode.web', 'Web'),
            icon: <Globe size={12} />,
            color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
        },
    };

    const config = modeConfig[mode];

    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color} ${className}`}
        >
            {config.icon}
            {config.label}
        </span>
    );
};

export default FocusModeSelector;


