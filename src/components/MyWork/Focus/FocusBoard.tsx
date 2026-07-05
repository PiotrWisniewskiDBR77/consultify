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

import { AnimatePresence, motion, Reorder } from 'framer-motion';
import {
  Brain,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Coffee,
  Flame,
  GripVertical,
  Inbox,
  Loader2,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Target,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import type { FocusBoardProps, FocusSuggestion, FocusTask, TimeBlock } from '../../../types/myWork';
import { DueDateIndicator } from '../shared/DueDateIndicator';
import { EmptyState } from '../shared/EmptyState';
import { getPMOCategory, PMOPriorityBadge } from '../shared/PMOPriorityBadge';

interface ExtendedFocusBoardProps extends Partial<FocusBoardProps> {
  onTaskClick?: (taskId: string) => void;
  onNavigateToInbox?: () => void;
}

const MAX_FOCUS_TASKS = 5;

/**
 * Daily Stats Card Component
 */
const DailyStatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  suffix?: string;
  color: 'green' | 'blue' | 'orange' | 'slate' | 'purple';
}> = ({ icon, label, value, suffix, color }) => {
  const colorClasses = {
    green:
      'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800/30',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/30',
    orange:
      'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/30',
    slate:
      'bg-c-surface-raised text-c-text-secondary border-c-border-subtle',
    purple:
      'bg-c-info/10 text-c-info border-c-info/20',
  };

  const iconBgClasses = {
    green: 'bg-green-100 dark:bg-green-900/30',
    blue: 'bg-blue-100 dark:bg-blue-900/30',
    orange: 'bg-amber-100 dark:bg-amber-900/30',
    slate: 'bg-c-surface-raised',
    purple: 'bg-c-info/15',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border ${colorClasses[color]} transition-all hover:shadow-md`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${iconBgClasses[color]}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-c-text">
            {value}
            {suffix && (
              <span className="text-sm font-normal text-c-text-muted ml-1">
                {suffix}
              </span>
            )}
          </p>
          <p className="text-xs text-c-text-muted">{label}</p>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Focus Tips for empty state
 */
const focusTips = [
  {
    icon: Brain,
    tip: 'Start with your hardest task when your energy is highest',
    color: 'text-c-info',
  },
  { icon: Target, tip: 'Limit yourself to 3-5 important tasks per day', color: 'text-blue-500' },
  { icon: Coffee, tip: 'Take breaks every 90 minutes to maintain focus', color: 'text-amber-500' },
  {
    icon: Zap,
    tip: 'Group similar tasks together to minimize context switching',
    color: 'text-yellow-500',
  },
];

/**
 * Time block configuration
 */
const timeBlockConfig: Record<
  TimeBlock,
  {
    label: string;
    icon: React.ReactNode;
    gradient: string;
    time: string;
  }
> = {
  morning: {
    label: 'Rano',
    icon: <Sun size={16} />,
    gradient: 'time-block-morning',
    time: '8:00 - 12:00',
  },
  afternoon: {
    label: 'Popołudnie',
    icon: <Moon size={16} />,
    gradient: 'time-block-afternoon',
    time: '12:00 - 17:00',
  },
  buffer: {
    label: 'Bufor',
    icon: <Clock size={16} />,
    gradient: 'time-block-buffer',
    time: 'Elastyczny',
  },
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
  const pmoCategory =
    task.pmoCategory ||
    getPMOCategory({
      dueDate: task.dueDate,
      priority: task.priority,
    });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      className={`
                group relative bg-c-surface rounded-xl border
                ${
                  task.isCompleted
                    ? 'border-green-200 dark:border-green-800/30 bg-green-50/50 dark:bg-green-900/10'
                    : 'border-c-border-subtle hover:border-c-border-strong'
                }
                ${isDragging ? 'focus-task-dragging shadow-hig-lg opacity-70 ring-1 ring-c-border-strong' : 'shadow-sm'}
                transition-all duration-200 cursor-pointer
            `}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Drag Handle */}
        <div className="shrink-0 pt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical size={16} className="text-c-text-muted" />
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
            <Circle size={22} className="text-c-text-muted hover:text-c-text transition-colors" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0" onClick={() => onClick(task.taskId)}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Initiative */}
              {task.initiativeName && (
                <span className="text-[10px] text-c-info font-medium">
                  {task.initiativeName}
                </span>
              )}

              {/* Title */}
              <h4
                className={`text-sm font-semibold truncate ${
                  task.isCompleted ? 'text-c-text-muted line-through' : 'text-c-text'
                }`}
              >
                {task.title}
              </h4>
            </div>

            {/* Remove Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(task.taskId);
              }}
              aria-label={t('myWork.focus.removeFromFocus', 'Remove from focus')}
              className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-danger-50 dark:hover:bg-danger-900/20 text-c-text-muted hover:text-danger-500 transition-all"
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
              <span className="text-[10px] text-c-text-muted flex items-center gap-1">
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
  const completedCount = tasks.filter((t) => t.isCompleted).length;

  return (
    <div
      className={`rounded-xl overflow-hidden border border-c-border-subtle ${config.gradient}`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-white/50 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-c-text-secondary">{config.icon}</span>
          <span className="font-semibold text-c-text">
            {t(`myWork.focus.timeBlock.${block}`, config.label)}
          </span>
          <span className="text-xs text-c-text-muted">{config.time}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-c-text-muted">
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
                <Reorder.Group axis="y" values={tasks} onReorder={onReorder} className="space-y-2">
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
                <div className="text-center py-4 text-sm text-c-text-muted">
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
  onRequestAISuggestion,
  onNavigateToInbox,
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

  // Daily stats state
  const [dailyStats, setDailyStats] = useState({
    completedToday: 0,
    focusHours: 0,
    streak: 0,
    backlogCount: 0,
  });

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
      // Load daily stats
      if (res?.stats) {
        setDailyStats({
          completedToday: res.stats.completedToday || 0,
          focusHours: res.stats.focusHours || 0,
          streak: res.stats.streak || 0,
          backlogCount: res.stats.backlogCount || 0,
        });
      } else {
        // Fallback: calculate from tasks
        const completed = (res?.board?.tasks || []).filter((t: FocusTask) => t.isCompleted).length;
        setDailyStats((prev) => ({
          ...prev,
          completedToday: completed,
        }));
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
    morning: tasks.filter((t) => t.timeBlock === 'morning'),
    afternoon: tasks.filter((t) => t.timeBlock === 'afternoon'),
    buffer: tasks.filter((t) => t.timeBlock === 'buffer'),
  };

  // Handle task completion
  const handleComplete = async (taskId: string) => {
    try {
      const task = tasks.find((t) => t.taskId === taskId);
      if (!task) return;

      const newCompleted = !task.isCompleted;

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.taskId === taskId ? { ...t, isCompleted: newCompleted } : t))
      );

      // Call API
      await Api.updateTask(taskId, {
        status: newCompleted ? 'completed' : 'todo',
      });

      onTaskComplete?.(taskId);
      toast.success(
        newCompleted
          ? t('myWork.focus.taskCompleted', 'Task completed!')
          : t('myWork.focus.taskReopened', 'Task reopened')
      );
    } catch (error) {
      console.error('Failed to complete task:', error);
      loadFocus(); // Revert on error
      toast.error(t('myWork.focus.error', 'Failed to update task'));
    }
  };

  // Handle task removal from focus
  const handleRemove = async (taskId: string) => {
    try {
      const newTasks = tasks.filter((t) => t.taskId !== taskId);
      setTasks(newTasks);

      await Api.put('/my-work/focus', {
        date: dateString,
        tasks: newTasks.map((t, idx) => ({
          taskId: t.taskId,
          timeBlock: t.timeBlock,
          position: idx,
        })),
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
    const otherTasks = tasks.filter((t) => t.timeBlock !== block);
    const newTasks = [...otherTasks, ...newBlockTasks];
    setTasks(newTasks);

    // Debounce API call
    Api.put('/my-work/focus', {
      date: dateString,
      tasks: newTasks.map((t, idx) => ({
        taskId: t.taskId,
        timeBlock: t.timeBlock,
        position: idx,
      })),
    }).catch(console.error);
  };

  // Toggle block expansion
  const toggleBlock = (block: TimeBlock) => {
    setExpandedBlocks((prev) => {
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
  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return <LoadingState variant="spinner" className="p-12" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-brand to-primary-600 text-white rounded-xl shadow-lg shadow-brand/25">
            <Target size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-c-text">
              {t('myWork.focus.title', "Today's Focus")}
            </h2>
            <p className="text-xs text-c-text-muted">
              {new Date().toLocaleDateString('pl-PL', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
          </div>
        </div>

        {/* Stats & AI Button */}
        <div className="flex items-center gap-3">
          {/* Progress */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-c-surface-raised rounded-lg">
            <div className="w-16 h-1.5 bg-c-border-subtle rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-medium text-c-text-secondary">
              {completedCount}/{totalCount}
            </span>
          </div>

          {/* AI Suggest Button */}
          <button
            onClick={handleAISuggestion}
            disabled={aiSuggesting || tasks.length >= MAX_FOCUS_TASKS}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-primary-600 to-crimson-600 hover:from-primary-500 hover:to-crimson-500 text-white text-sm font-medium shadow-lg shadow-primary-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aiSuggesting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            <span className="hidden sm:inline">{t('myWork.focus.aiSuggest', 'AI Suggest')}</span>
          </button>
        </div>
      </div>

      {/* Daily Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DailyStatCard
          icon={<CheckCircle2 size={18} />}
          label={t('myWork.focus.stats.doneToday', 'Done Today')}
          value={dailyStats.completedToday}
          color="green"
        />
        <DailyStatCard
          icon={<Clock size={18} />}
          label={t('myWork.focus.stats.focusTime', 'Focus Time')}
          value={dailyStats.focusHours}
          suffix="h"
          color="blue"
        />
        <DailyStatCard
          icon={<Flame size={18} />}
          label={t('myWork.focus.stats.streak', 'Streak')}
          value={dailyStats.streak}
          suffix={t('myWork.focus.stats.days', 'days')}
          color="orange"
        />
        <DailyStatCard
          icon={<Inbox size={18} />}
          label={t('myWork.focus.stats.backlog', 'Backlog')}
          value={dailyStats.backlogCount}
          color="slate"
        />
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
        <div className="space-y-6">
          {/* Enhanced Empty State with Tips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-c-surface rounded-xl border border-c-border-subtle p-8 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-c-surface-raised rounded-xl flex items-center justify-center">
              <Target size={32} className="text-c-text-secondary" />
            </div>
            <h3 className="text-xl font-bold text-c-text mb-2">
              {t('myWork.focus.empty.title', 'Plan Your Focus')}
            </h3>
            <p className="text-sm text-c-text-secondary mb-6 max-w-md mx-auto">
              {t(
                'myWork.focus.empty.description',
                'Select up to 5 tasks to focus on today. AI can help you prioritize based on deadlines and importance.'
              )}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <button
                onClick={handleAISuggestion}
                disabled={aiSuggesting}
                className="inline-flex items-center gap-2 p-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-crimson-600 hover:from-primary-500 hover:to-crimson-500 text-white font-medium shadow-lg shadow-primary-500/25 transition-all disabled:opacity-50"
              >
                {aiSuggesting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Sparkles size={18} />
                )}
                {t('myWork.focus.aiSuggest', 'AI Suggest')}
              </button>
              <button
                onClick={() => onNavigateToInbox?.()}
                className="inline-flex items-center gap-2 p-4 py-2.5 rounded-xl bg-c-surface border border-c-border text-c-text-secondary font-medium hover:bg-c-surface-raised transition-colors"
              >
                <Plus size={18} />
                {t('myWork.focus.addFromInbox', 'Add from Inbox')}
              </button>
            </div>
          </motion.div>

          {/* Focus Tips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-c-surface rounded-xl border border-c-border-subtle p-4"
          >
            <h4 className="text-sm font-bold text-c-text mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-primary-500" />
              {t('myWork.focus.tips.title', 'Tips for productive focus')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {focusTips.map((tip, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-start gap-3 p-3 bg-c-surface-raised rounded-lg"
                >
                  <tip.icon size={18} className={`${tip.color} shrink-0 mt-0.5`} />
                  <span className="text-sm text-c-text-secondary">
                    {t(`myWork.focus.tips.tip${i + 1}`, tip.tip)}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* AI Suggestions Panel */}
      <AnimatePresence>
        {suggestions && suggestions.suggestedTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-c-info/10 border border-c-info/20 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-primary-600 dark:text-primary-400" />
              <h3 className="font-semibold text-c-text">
                {t('myWork.focus.aiSuggestions', 'AI Suggestions')}
              </h3>
            </div>
            <p className="text-sm text-c-text-secondary mb-3">
              {suggestions.reasoning}
            </p>
            <div className="space-y-2">
              {suggestions.suggestedTasks.slice(0, 3).map((suggestion) => (
                <div
                  key={suggestion.taskId}
                  className="flex items-center justify-between p-3 bg-c-surface rounded-lg border border-c-border-subtle"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-c-text truncate">
                      {suggestion.title}
                    </p>
                    <p className="text-xs text-c-text-muted truncate">
                      {suggestion.reason}
                    </p>
                  </div>
                  <button
                    onClick={() => onAddToFocus?.(suggestion.taskId, suggestion.suggestedTimeBlock)}
                    disabled={tasks.length >= MAX_FOCUS_TASKS}
                    className="shrink-0 ml-3 p-2 rounded-lg bg-c-info/15 hover:bg-c-info/25 text-c-info transition-colors disabled:opacity-50"
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
      <div className="bg-c-surface rounded-xl border border-c-border-subtle p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-c-text-muted uppercase tracking-wider mb-1">
              {t('myWork.focus.executionScore', 'Execution Score')}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-c-text">
                {executionScore}
              </span>
              <span className="text-sm text-c-text-muted">/ 100</span>
            </div>
          </div>
          <div
            className="w-16 h-16 execution-score-ring flex items-center justify-center"
            style={{ '--score-percent': `${executionScore}%` } as React.CSSProperties}
          >
            <div className="w-12 h-12 rounded-full bg-c-surface flex items-center justify-center">
              <Target size={20} className="text-green-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FocusBoard;
