/**
 * FocusBoard - Daily focus task management
 * Part of My Work Module PMO Upgrade
 * 
 * Features:
 * - Time blocks (morning/afternoon/buffer)
 * - Max 5 tasks enforcement
 * - Drag & drop reordering
 * - AI-powered suggestions
 * - One-click completion
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
    Target,
    Sun,
    Moon,
    Clock,
    Plus,
    Sparkles,
    CheckCircle,
    Circle,
    GripVertical,
    ChevronUp,
    ChevronDown,
    X,
    Loader2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FocusTask, TimeBlock, FocusBoardProps, FocusSuggestion } from '../../../types/myWork';
import { PMOPriorityBadge, getPMOCategory } from '../shared/PMOPriorityBadge';
import { DueDateIndicator } from '../shared/DueDateIndicator';
import { EmptyState } from '../shared/EmptyState';
import { Api } from '../../../services/api';
import toast from 'react-hot-toast';

interface ExtendedFocusBoardProps extends Partial<FocusBoardProps> {
    onTaskClick?: (taskId: string) => void;
}

const MAX_FOCUS_TASKS = 5;

/**
 * Time block configuration
 */
const timeBlockConfig: Record<TimeBlock, { 
    label: string; 
    icon: React.ReactNode; 
    gradient: string;
    time: string;
}> = {
    morning: {
        label: 'Rano',
        icon: <Sun size={16} />,
        gradient: 'time-block-morning',
        time: '8:00 - 12:00'
    },
    afternoon: {
        label: 'Popołudnie',
        icon: <Moon size={16} />,
        gradient: 'time-block-afternoon',
        time: '12:00 - 17:00'
    },
    buffer: {
        label: 'Bufor',
        icon: <Clock size={16} />,
        gradient: 'time-block-buffer',
        time: 'Elastyczny'
    }
};

/**
 * FocusTaskCard - Individual task card in Focus board
 */
const FocusTaskCard: React.FC<{
    task: FocusTask;
    onComplete: (taskId: string) => void;
    onRemove: (taskId: string) => void;
    onClick: (taskId: string) => void;
    isDragging?: boolean;
}> = ({ task, onComplete, onRemove, onClick, isDragging }) => {
    const { t } = useTranslation();
    const pmoCategory = task.pmoCategory || getPMOCategory({
        dueDate: task.dueDate,
        priority: task.priority
    });

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20, height: 0 }}
            className={`
                group relative bg-white dark:bg-navy-900 rounded-xl border
                ${task.isCompleted 
                    ? 'border-green-200 dark:border-green-800/30 bg-green-50/50 dark:bg-green-900/10' 
                    : 'border-slate-200 dark:border-white/10 hover:border-brand/30 dark:hover:border-brand/20'
                }
                ${isDragging ? 'focus-task-dragging shadow-xl ring-2 ring-brand' : 'shadow-sm'}
                transition-all duration-200 cursor-pointer
            `}
        >
            <div className="flex items-start gap-3 p-4">
                {/* Drag Handle */}
                <div className="shrink-0 pt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                    <GripVertical size={16} className="text-slate-300 dark:text-slate-600" />
                </div>

                {/* Completion Toggle */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onComplete(task.taskId);
                    }}
                    className="shrink-0 mt-0.5"
                >
                    {task.isCompleted ? (
                        <CheckCircle size={22} className="text-green-500" />
                    ) : (
                        <Circle size={22} className="text-slate-300 hover:text-brand transition-colors" />
                    )}
                </button>

                {/* Content */}
                <div 
                    className="flex-1 min-w-0"
                    onClick={() => onClick(task.taskId)}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            {/* Initiative */}
                            {task.initiativeName && (
                                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                                    {task.initiativeName}
                                </span>
                            )}
                            
                            {/* Title */}
                            <h4 className={`text-sm font-semibold truncate ${
                                task.isCompleted 
                                    ? 'text-slate-400 line-through' 
                                    : 'text-navy-900 dark:text-white'
                            }`}>
                                {task.title}
                            </h4>
                        </div>

                        {/* Remove Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(task.taskId);
                            }}
                            className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-all"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Meta Row */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <PMOPriorityBadge category={pmoCategory} size="sm" showLabel={false} />
                        {task.dueDate && (
                            <DueDateIndicator 
                                dueDate={task.dueDate} 
                                dueTime={task.dueTime}
                                isCompleted={task.isCompleted}
                                size="sm"
                            />
                        )}
                        {task.estimatedMinutes && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Clock size={10} />
                                {task.estimatedMinutes} min
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

/**
 * TimeBlockSection - Section for each time block
 */
const TimeBlockSection: React.FC<{
    block: TimeBlock;
    tasks: FocusTask[];
    onComplete: (taskId: string) => void;
    onRemove: (taskId: string) => void;
    onClick: (taskId: string) => void;
    onReorder: (tasks: FocusTask[]) => void;
    isExpanded: boolean;
    onToggle: () => void;
}> = ({ block, tasks, onComplete, onRemove, onClick, onReorder, isExpanded, onToggle }) => {
    const { t } = useTranslation();
    const config = timeBlockConfig[block];
    const completedCount = tasks.filter(t => t.isCompleted).length;

    return (
        <div className={`rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 ${config.gradient}`}>
            {/* Header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-3 hover:bg-white/50 dark:hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-300">
                        {config.icon}
                    </span>
                    <span className="font-semibold text-navy-900 dark:text-white">
                        {t(`myWork.focus.timeBlock.${block}`, config.label)}
                    </span>
                    <span className="text-xs text-slate-400">
                        {config.time}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                        {completedCount}/{tasks.length}
                    </span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </button>

            {/* Tasks */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-3 pt-0 space-y-2">
                            {tasks.length > 0 ? (
                                <Reorder.Group 
                                    axis="y" 
                                    values={tasks} 
                                    onReorder={onReorder}
                                    className="space-y-2"
                                >
                                    {tasks.map((task) => (
                                        <Reorder.Item key={task.taskId} value={task}>
                                            <FocusTaskCard
                                                task={task}
                                                onComplete={onComplete}
                                                onRemove={onRemove}
                                                onClick={onClick}
                                            />
                                        </Reorder.Item>
                                    ))}
                                </Reorder.Group>
                            ) : (
                                <div className="text-center py-4 text-sm text-slate-400">
                                    {t('myWork.focus.noTasksInBlock', 'No tasks in this block')}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

/**
 * FocusBoard Component - Main Export
 */
export const FocusBoard: React.FC<ExtendedFocusBoardProps> = ({
    date,
    onTaskClick,
    onTaskComplete,
    onReorder,
    onAddToFocus,
    onRemoveFromFocus,
    onRequestAISuggestion
}) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState<FocusTask[]>([]);
    const [executionScore, setExecutionScore] = useState(0);
    const [expandedBlocks, setExpandedBlocks] = useState<Set<TimeBlock>>(
        new Set(['morning', 'afternoon'])
    );
    const [aiSuggesting, setAiSuggesting] = useState(false);
    const [suggestions, setSuggestions] = useState<FocusSuggestion | null>(null);

    const currentDate = date || new Date();
    const dateString = currentDate.toISOString().split('T')[0];

    // Load focus data
    const loadFocus = useCallback(async () => {
        try {
            setLoading(true);
            const res = await Api.get(`/my-work/focus?date=${dateString}`);
            if (res?.board) {
                setTasks(res.board.tasks || []);
                setExecutionScore(res.board.executionScore || 0);
            }
            if (res?.suggestions) {
                setSuggestions(res.suggestions);
            }
        } catch (error) {
            console.error('Failed to load focus:', error);
        } finally {
            setLoading(false);
        }
    }, [dateString]);

    useEffect(() => {
        loadFocus();
    }, [loadFocus]);

    // Group tasks by time block
    const tasksByBlock: Record<TimeBlock, FocusTask[]> = {
        morning: tasks.filter(t => t.timeBlock === 'morning'),
        afternoon: tasks.filter(t => t.timeBlock === 'afternoon'),
        buffer: tasks.filter(t => t.timeBlock === 'buffer')
    };

    // Handle task completion
    const handleComplete = async (taskId: string) => {
        try {
            const task = tasks.find(t => t.taskId === taskId);
            if (!task) return;

            const newCompleted = !task.isCompleted;
            
            // Optimistic update
            setTasks(prev => prev.map(t => 
                t.taskId === taskId ? { ...t, isCompleted: newCompleted } : t
            ));

            // Call API
            await Api.updateTask(taskId, { 
                status: newCompleted ? 'completed' : 'todo' 
            });

            onTaskComplete?.(taskId);
            toast.success(newCompleted ? t('myWork.focus.taskCompleted', 'Task completed!') : t('myWork.focus.taskReopened', 'Task reopened'));
        } catch (error) {
            console.error('Failed to complete task:', error);
            loadFocus(); // Revert on error
            toast.error(t('myWork.focus.error', 'Failed to update task'));
        }
    };

    // Handle task removal from focus
    const handleRemove = async (taskId: string) => {
        try {
            const newTasks = tasks.filter(t => t.taskId !== taskId);
            setTasks(newTasks);

            await Api.put('/my-work/focus', {
                date: dateString,
                tasks: newTasks.map((t, idx) => ({
                    taskId: t.taskId,
                    timeBlock: t.timeBlock,
                    position: idx
                }))
            });

            onRemoveFromFocus?.(taskId);
            toast.success(t('myWork.focus.taskRemoved', 'Removed from focus'));
        } catch (error) {
            console.error('Failed to remove task:', error);
            loadFocus();
            toast.error(t('myWork.focus.error', 'Failed to remove task'));
        }
    };

    // Handle reorder within a block
    const handleBlockReorder = (block: TimeBlock, newBlockTasks: FocusTask[]) => {
        const otherTasks = tasks.filter(t => t.timeBlock !== block);
        const newTasks = [...otherTasks, ...newBlockTasks];
        setTasks(newTasks);

        // Debounce API call
        Api.put('/my-work/focus', {
            date: dateString,
            tasks: newTasks.map((t, idx) => ({
                taskId: t.taskId,
                timeBlock: t.timeBlock,
                position: idx
            }))
        }).catch(console.error);
    };

    // Toggle block expansion
    const toggleBlock = (block: TimeBlock) => {
        setExpandedBlocks(prev => {
            const next = new Set(prev);
            if (next.has(block)) {
                next.delete(block);
            } else {
                next.add(block);
            }
            return next;
        });
    };

    // Request AI suggestions
    const handleAISuggestion = async () => {
        try {
            setAiSuggesting(true);
            const res = await Api.post('/my-work/focus/ai-suggest', { date: dateString });
            if (res?.suggestions) {
                setSuggestions(res.suggestions);
                toast.success(t('myWork.focus.aiSuggestionsReady', 'AI suggestions ready!'));
            }
            onRequestAISuggestion?.();
        } catch (error) {
            console.error('Failed to get AI suggestions:', error);
            toast.error(t('myWork.focus.aiError', 'Failed to get suggestions'));
        } finally {
            setAiSuggesting(false);
        }
    };

    // Calculate completion stats
    const completedCount = tasks.filter(t => t.isCompleted).length;
    const totalCount = tasks.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 size={32} className="animate-spin text-brand" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-brand to-purple-600 text-white rounded-xl shadow-lg shadow-brand/25">
                        <Target size={22} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-navy-900 dark:text-white">
                            {t('myWork.focus.title', "Today's Focus")}
                        </h2>
                        <p className="text-xs text-slate-500">
                            {new Date().toLocaleDateString('pl-PL', { 
                                weekday: 'long', 
                                day: 'numeric', 
                                month: 'long' 
                            })}
                        </p>
                    </div>
                </div>

                {/* Stats & AI Button */}
                <div className="flex items-center gap-3">
                    {/* Progress */}
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-lg">
                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-green-500 transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            {completedCount}/{totalCount}
                        </span>
                    </div>

                    {/* AI Suggest Button */}
                    <button
                        onClick={handleAISuggestion}
                        disabled={aiSuggesting || tasks.length >= MAX_FOCUS_TASKS}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-medium shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {aiSuggesting ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Sparkles size={16} />
                        )}
                        <span className="hidden sm:inline">
                            {t('myWork.focus.aiSuggest', 'AI Suggest')}
                        </span>
                    </button>
                </div>
            </div>

            {/* Task Count Warning */}
            {tasks.length >= MAX_FOCUS_TASKS && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
                    {t('myWork.focus.maxTasksReached', 'Maximum 5 focus tasks. Remove one to add more.')}
                </div>
            )}

            {/* Time Blocks */}
            {tasks.length > 0 ? (
                <div className="space-y-4">
                    {(['morning', 'afternoon', 'buffer'] as TimeBlock[]).map((block) => (
                        <TimeBlockSection
                            key={block}
                            block={block}
                            tasks={tasksByBlock[block]}
                            onComplete={handleComplete}
                            onRemove={handleRemove}
                            onClick={(id) => onTaskClick?.(id)}
                            onReorder={(newTasks) => handleBlockReorder(block, newTasks)}
                            isExpanded={expandedBlocks.has(block)}
                            onToggle={() => toggleBlock(block)}
                        />
                    ))}
                </div>
            ) : (
                <EmptyState
                    type="focus"
                    showAISuggestion
                    onAISuggestion={handleAISuggestion}
                    actionLabel={t('myWork.focus.addFromInbox', 'Add from Inbox')}
                    onAction={() => {
                        // Navigate to inbox
                    }}
                />
            )}

            {/* AI Suggestions Panel */}
            <AnimatePresence>
                {suggestions && suggestions.suggestedTasks.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/30 rounded-xl p-4"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
                            <h3 className="font-semibold text-purple-900 dark:text-purple-200">
                                {t('myWork.focus.aiSuggestions', 'AI Suggestions')}
                            </h3>
                        </div>
                        <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                            {suggestions.reasoning}
                        </p>
                        <div className="space-y-2">
                            {suggestions.suggestedTasks.slice(0, 3).map((suggestion) => (
                                <div 
                                    key={suggestion.taskId}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-navy-900 rounded-lg border border-purple-200 dark:border-purple-800/30"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-navy-900 dark:text-white truncate">
                                            {suggestion.title}
                                        </p>
                                        <p className="text-xs text-slate-500 truncate">
                                            {suggestion.reason}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => onAddToFocus?.(suggestion.taskId, suggestion.suggestedTimeBlock)}
                                        disabled={tasks.length >= MAX_FOCUS_TASKS}
                                        className="shrink-0 ml-3 p-2 rounded-lg bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 transition-colors disabled:opacity-50"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Execution Score */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                            {t('myWork.focus.executionScore', 'Execution Score')}
                        </p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-navy-900 dark:text-white">
                                {executionScore}
                            </span>
                            <span className="text-sm text-slate-400">/ 100</span>
                        </div>
                    </div>
                    <div 
                        className="w-16 h-16 execution-score-ring flex items-center justify-center"
                        style={{ '--score-percent': `${executionScore}%` } as React.CSSProperties}
                    >
                        <div className="w-12 h-12 rounded-full bg-white dark:bg-navy-900 flex items-center justify-center">
                            <Target size={20} className="text-green-500" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FocusBoard;



