/**
 * TaskFiltersBar - Advanced filtering for task list
 * Part of My Work Module PMO Upgrade
 * 
 * Features:
 * - Multi-select filters
 * - Date range picker
 * - Search
 * - Saved filter presets
 * - View mode toggle
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Filter,
    X,
    ChevronDown,
    CheckSquare,
    Calendar,
    User,
    Tag,
    Layers,
    LayoutList,
    LayoutGrid,
    CalendarDays,
    Target,
    Save,
    Trash2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PMOCategory } from '../../../types/myWork';
import { PMO_CATEGORY_CONFIG } from '../shared/PMOPriorityBadge';

export type ViewMode = 'list' | 'kanban' | 'calendar' | 'pmo';

export interface TaskFilters {
    search: string;
    status: string[];
    priority: string[];
    assignee: string[];
    initiative: string[];
    pmoCategory: PMOCategory[];
    dateRange: {
        start: string | null;
        end: string | null;
    };
}

export interface FilterPreset {
    id: string;
    name: string;
    filters: TaskFilters;
}

interface TaskFiltersBarProps {
    filters: TaskFilters;
    onFiltersChange: (filters: TaskFilters) => void;
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    presets?: FilterPreset[];
    onSavePreset?: (name: string) => void;
    onDeletePreset?: (id: string) => void;
    onLoadPreset?: (preset: FilterPreset) => void;
    // Options for dropdowns
    statusOptions?: Array<{ value: string; label: string }>;
    priorityOptions?: Array<{ value: string; label: string }>;
    assigneeOptions?: Array<{ value: string; label: string; avatar?: string }>;
    initiativeOptions?: Array<{ value: string; label: string }>;
    className?: string;
}

const defaultStatusOptions = [
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'done', label: 'Done' }
];

const defaultPriorityOptions = [
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
];

const viewModeOptions: Array<{ mode: ViewMode; icon: React.ReactNode; label: string }> = [
    { mode: 'list', icon: <LayoutList size={16} />, label: 'List' },
    { mode: 'kanban', icon: <LayoutGrid size={16} />, label: 'Kanban' },
    { mode: 'calendar', icon: <CalendarDays size={16} />, label: 'Calendar' },
    { mode: 'pmo', icon: <Target size={16} />, label: 'PMO' }
];

/**
 * Multi-select dropdown component
 */
const MultiSelectDropdown: React.FC<{
    label: string;
    icon: React.ReactNode;
    options: Array<{ value: string; label: string; avatar?: string }>;
    selected: string[];
    onChange: (selected: string[]) => void;
}> = ({ label, icon, options, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggle = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter(v => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const hasSelection = selected.length > 0;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                    border transition-all
                    ${hasSelection
                        ? 'bg-brand/10 border-brand/20 text-brand dark:bg-brand/20 dark:border-brand/30'
                        : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-brand/30'
                    }
                `}
            >
                {icon}
                <span>{label}</span>
                {hasSelection && (
                    <span className="ml-1 px-1.5 py-0.5 bg-brand text-white text-[10px] rounded-full">
                        {selected.length}
                    </span>
                )}
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 z-30 overflow-hidden"
                    >
                        <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                            {options.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => toggle(opt.value)}
                                    className={`
                                        w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left
                                        transition-colors
                                        ${selected.includes(opt.value)
                                            ? 'bg-brand/10 text-brand dark:bg-brand/20'
                                            : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                                        }
                                    `}
                                >
                                    <CheckSquare 
                                        size={14} 
                                        className={selected.includes(opt.value) ? 'text-brand' : 'text-slate-300'} 
                                    />
                                    {opt.avatar && (
                                        <img src={opt.avatar} alt="" className="w-5 h-5 rounded-full" />
                                    )}
                                    <span className="truncate">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                        {hasSelection && (
                            <div className="border-t border-slate-100 dark:border-white/5 p-2">
                                <button
                                    onClick={() => onChange([])}
                                    className="w-full text-xs text-slate-500 hover:text-red-500 py-1"
                                >
                                    Clear selection
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

/**
 * PMO Category filter (specific to PMO methodology)
 */
const PMOCategoryFilter: React.FC<{
    selected: PMOCategory[];
    onChange: (selected: PMOCategory[]) => void;
}> = ({ selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggle = (category: PMOCategory) => {
        if (selected.includes(category)) {
            onChange(selected.filter(c => c !== category));
        } else {
            onChange([...selected, category]);
        }
    };

    const hasSelection = selected.length > 0;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                    border transition-all
                    ${hasSelection
                        ? 'bg-purple-100 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-800/30 dark:text-purple-300'
                        : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-purple-300'
                    }
                `}
            >
                <Layers size={14} />
                <span>PMO Category</span>
                {hasSelection && (
                    <span className="ml-1 px-1.5 py-0.5 bg-purple-500 text-white text-[10px] rounded-full">
                        {selected.length}
                    </span>
                )}
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 z-30 overflow-hidden"
                    >
                        <div className="p-2 space-y-1">
                            {(Object.keys(PMO_CATEGORY_CONFIG) as PMOCategory[]).map((category) => {
                                const config = PMO_CATEGORY_CONFIG[category];
                                return (
                                    <button
                                        key={category}
                                        onClick={() => toggle(category)}
                                        className={`
                                            w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left
                                            transition-colors
                                            ${selected.includes(category)
                                                ? `${config.color.bg} ${config.color.text}`
                                                : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                                            }
                                        `}
                                    >
                                        <span>{config.emoji}</span>
                                        <span className="truncate">{config.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

/**
 * TaskFiltersBar Component - Main Export
 */
export const TaskFiltersBar: React.FC<TaskFiltersBarProps> = ({
    filters,
    onFiltersChange,
    viewMode,
    onViewModeChange,
    presets = [],
    onSavePreset,
    onDeletePreset,
    onLoadPreset,
    statusOptions = defaultStatusOptions,
    priorityOptions = defaultPriorityOptions,
    assigneeOptions = [],
    initiativeOptions = [],
    className = ''
}) => {
    const { t } = useTranslation();
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');

    const updateFilter = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => {
        onFiltersChange({ ...filters, [key]: value });
    };

    const clearAllFilters = () => {
        onFiltersChange({
            search: '',
            status: [],
            priority: [],
            assignee: [],
            initiative: [],
            pmoCategory: [],
            dateRange: { start: null, end: null }
        });
    };

    const hasActiveFilters = 
        filters.search || 
        filters.status.length > 0 || 
        filters.priority.length > 0 || 
        filters.assignee.length > 0 || 
        filters.initiative.length > 0 ||
        filters.pmoCategory.length > 0 ||
        filters.dateRange.start || 
        filters.dateRange.end;

    const handleSavePreset = () => {
        if (newPresetName.trim() && onSavePreset) {
            onSavePreset(newPresetName.trim());
            setNewPresetName('');
            setShowPresetModal(false);
        }
    };

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Main Filter Row */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={filters.search}
                        onChange={(e) => updateFilter('search', e.target.value)}
                        placeholder={t('myWork.filters.searchPlaceholder', 'Search tasks...')}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                    />
                    {filters.search && (
                        <button
                            onClick={() => updateFilter('search', '')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Filter Dropdowns */}
                <MultiSelectDropdown
                    label={t('myWork.filters.status', 'Status')}
                    icon={<CheckSquare size={14} />}
                    options={statusOptions}
                    selected={filters.status}
                    onChange={(val) => updateFilter('status', val)}
                />

                <MultiSelectDropdown
                    label={t('myWork.filters.priority', 'Priority')}
                    icon={<Tag size={14} />}
                    options={priorityOptions}
                    selected={filters.priority}
                    onChange={(val) => updateFilter('priority', val)}
                />

                {assigneeOptions.length > 0 && (
                    <MultiSelectDropdown
                        label={t('myWork.filters.assignee', 'Assignee')}
                        icon={<User size={14} />}
                        options={assigneeOptions}
                        selected={filters.assignee}
                        onChange={(val) => updateFilter('assignee', val)}
                    />
                )}

                {initiativeOptions.length > 0 && (
                    <MultiSelectDropdown
                        label={t('myWork.filters.initiative', 'Initiative')}
                        icon={<Target size={14} />}
                        options={initiativeOptions}
                        selected={filters.initiative}
                        onChange={(val) => updateFilter('initiative', val)}
                    />
                )}

                <PMOCategoryFilter
                    selected={filters.pmoCategory}
                    onChange={(val) => updateFilter('pmoCategory', val)}
                />

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={clearAllFilters}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                        <X size={14} />
                        {t('myWork.filters.clearAll', 'Clear')}
                    </button>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-lg">
                    {viewModeOptions.map((opt) => (
                        <button
                            key={opt.mode}
                            onClick={() => onViewModeChange(opt.mode)}
                            className={`
                                p-2 rounded-md transition-all
                                ${viewMode === opt.mode
                                    ? 'bg-white dark:bg-navy-800 text-brand shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }
                            `}
                            title={opt.label}
                        >
                            {opt.icon}
                        </button>
                    ))}
                </div>

                {/* Save Preset Button */}
                {onSavePreset && hasActiveFilters && (
                    <button
                        onClick={() => setShowPresetModal(true)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <Save size={14} />
                        {t('myWork.filters.savePreset', 'Save')}
                    </button>
                )}
            </div>

            {/* Presets Row */}
            {presets.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-xs text-slate-500 shrink-0">
                        {t('myWork.filters.presets', 'Presets:')}
                    </span>
                    {presets.map((preset) => (
                        <div
                            key={preset.id}
                            className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-white/5 rounded-lg group"
                        >
                            <button
                                onClick={() => onLoadPreset?.(preset)}
                                className="text-xs text-slate-600 dark:text-slate-300 hover:text-brand"
                            >
                                {preset.name}
                            </button>
                            {onDeletePreset && (
                                <button
                                    onClick={() => onDeletePreset(preset.id)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-all"
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Save Preset Modal */}
            <AnimatePresence>
                {showPresetModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                        onClick={() => setShowPresetModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-navy-900 rounded-xl p-6 w-full max-w-sm shadow-xl"
                        >
                            <h3 className="text-lg font-bold mb-4">
                                {t('myWork.filters.savePresetTitle', 'Save Filter Preset')}
                            </h3>
                            <input
                                type="text"
                                value={newPresetName}
                                onChange={(e) => setNewPresetName(e.target.value)}
                                placeholder={t('myWork.filters.presetNamePlaceholder', 'Preset name...')}
                                className="w-full px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg mb-4"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowPresetModal(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg"
                                >
                                    {t('common.cancel', 'Cancel')}
                                </button>
                                <button
                                    onClick={handleSavePreset}
                                    disabled={!newPresetName.trim()}
                                    className="px-4 py-2 text-sm bg-brand text-white rounded-lg disabled:opacity-50"
                                >
                                    {t('common.save', 'Save')}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TaskFiltersBar;



