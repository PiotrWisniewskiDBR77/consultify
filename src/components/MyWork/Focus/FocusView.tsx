/**
 * FocusView - Kanban Board for focused task management
 * Part of My Work Module PMO Upgrade
 *
 * Features:
 * - Kanban board with 3 columns: Today / This Week / Later
 * - Drag & drop between columns using @dnd-kit
 * - Quick actions: Mark Done, Snooze, Delegate
 * - Plan My Day morning planner
 * - Daily progress strip with momentum tracking
 * - Keyboard shortcuts for fast triage
 * - Smart snooze with date options
 * - Filters: type, hide completed, sort
 * - Richer cards: priority borders, blocking badges, inline decision actions
 */

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Filter,
  GripVertical,
  Loader2,
  ListChecks,
  Sparkles,
  Sun,
  Target,
  ThumbsDown,
  ThumbsUp,
  Timer,
  User,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import type { PMOCategory } from '../../../types/myWork';
import { type RowAction, RowActionsMenu } from '../../shared/RowActionsMenu';
import { DueDateIndicator } from '../shared/DueDateIndicator';
import { EmptyState } from '../shared/EmptyState';
import { getPMOCategory, PMOPriorityBadge } from '../shared/PMOPriorityBadge';

// ============================================================================
// TYPES
// ============================================================================

export type FocusColumn = 'today' | 'thisWeek' | 'later';

export type FocusItemType = 'task' | 'decision';

type FocusFilter = 'all' | 'tasks' | 'decisions';
type FocusSort = 'manual' | 'priority' | 'dueDate';

export interface FocusItem {
  id: string;
  type: FocusItemType;
  title: string;
  description?: string;
  column: FocusColumn;
  position: number;
  priority?: 'low' | 'medium' | 'high' | 'critical' | 'urgent';
  status?: string;
  dueDate?: string;
  dueTime?: string;
  assignee?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  initiativeId?: string;
  initiativeName?: string;
  projectName?: string;
  isCompleted?: boolean;
  pmoCategory?: PMOCategory;
  estimatedHours?: number;
  checklistTotal?: number;
  checklistDone?: number;
  // For decisions
  decisionType?: string;
  isOverdue?: boolean;
  daysWaiting?: number;
}

interface FocusViewProps {
  onItemClick?: (item: FocusItem) => void;
  onNavigateToInbox?: () => void;
  refreshTrigger?: number;
}

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

const MAX_PER_COLUMN = 40;
const MAX_TODAY_AUTO = 10;
const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

const priorityBorderColor: Record<string, string> = {
  urgent: 'border-l-red-500',
  critical: 'border-l-orange-500',
  high: 'border-l-amber-500',
  medium: 'border-l-blue-400',
  low: 'border-l-slate-300 dark:border-l-slate-600',
};

const columnConfig: Record<
  FocusColumn,
  {
    title: string;
    titleKey: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  today: {
    title: 'Today',
    titleKey: 'myWork.focus.columns.today',
    icon: <Sun size={16} />,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800/30',
  },
  thisWeek: {
    title: 'This Week',
    titleKey: 'myWork.focus.columns.thisWeek',
    icon: <CalendarDays size={16} />,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800/30',
  },
  later: {
    title: 'Later',
    titleKey: 'myWork.focus.columns.later',
    icon: <Calendar size={16} />,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-800/50',
    borderColor: 'border-slate-200 dark:border-slate-700',
  },
};

// ============================================================================
// SCORING - used by Plan My Day and smart categorization
// ============================================================================

function scoreFocusItem(item: FocusItem, now: Date): number {
  let score = 0;
  const isOverdue = item.isOverdue || (item.dueDate && new Date(item.dueDate) < now);
  if (isOverdue) score += 100;
  if (item.priority === 'critical') score += 50;
  if (item.priority === 'urgent') score += 40;
  if (item.priority === 'high') score += 20;
  if (item.dueDate) {
    const daysUntil = (new Date(item.dueDate).getTime() - now.getTime()) / 86400000;
    if (daysUntil <= 2 && daysUntil >= 0) score += 30;
    else if (daysUntil <= 5 && daysUntil >= 0) score += 10;
  }
  if (item.daysWaiting) score += item.daysWaiting * 5;
  if (item.status === 'blocked') score += 15;
  return score;
}

// ============================================================================
// DAILY PROGRESS STRIP
// ============================================================================

const DailyProgressStrip: React.FC<{
  todayItems: FocusItem[];
  totalItems: number;
}> = ({ todayItems, totalItems }) => {
  const { t } = useTranslation();
  const completedToday = todayItems.filter((i) => i.isCompleted).length;
  const todayTotal = todayItems.length;
  const allDone = todayTotal > 0 && completedToday === todayTotal;
  const pct = todayTotal > 0 ? (completedToday / todayTotal) * 100 : 0;

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
      <div className="flex items-center gap-2 min-w-0">
        {allDone ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            <CheckCircle2 size={20} className="text-green-500" />
          </motion.div>
        ) : (
          <Target size={20} className="text-brand" />
        )}
        <span className="text-sm font-semibold text-navy-900 dark:text-white whitespace-nowrap">
          {allDone
            ? t('myWork.focus.progress.allClear', 'All clear!')
            : `${completedToday}/${todayTotal} ${t('myWork.focus.progress.done', 'done today')}`}
        </span>
      </div>

      <div className="flex-1 h-2 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${allDone ? 'bg-green-500' : 'bg-brand'}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
        {totalItems} {t('myWork.focus.progress.total', 'total')}
      </span>
    </div>
  );
};

// ============================================================================
// FOCUS TOOLBAR (Filters)
// ============================================================================

const FocusToolbar: React.FC<{
  filter: FocusFilter;
  onFilterChange: (f: FocusFilter) => void;
  hideCompleted: boolean;
  onHideCompletedChange: (v: boolean) => void;
  sort: FocusSort;
  onSortChange: (s: FocusSort) => void;
}> = ({ filter, onFilterChange, hideCompleted, onHideCompletedChange, sort, onSortChange }) => {
  const { t } = useTranslation();

  const filterOptions: { value: FocusFilter; label: string }[] = [
    { value: 'all', label: t('myWork.focus.filters.all', 'All') },
    { value: 'tasks', label: t('myWork.focus.filters.tasks', 'Tasks') },
    { value: 'decisions', label: t('myWork.focus.filters.decisions', 'Decisions') },
  ];

  const sortOptions: { value: FocusSort; label: string }[] = [
    { value: 'manual', label: t('myWork.focus.filters.sortManual', 'Manual') },
    { value: 'priority', label: t('myWork.focus.filters.sortPriority', 'Priority') },
    { value: 'dueDate', label: t('myWork.focus.filters.sortDueDate', 'Due date') },
  ];

  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-slate-400" />
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-800 rounded-lg p-0.5">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onFilterChange(opt.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === opt.value
                  ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as FocusSort)}
          className="text-xs bg-transparent border border-slate-200 dark:border-navy-700 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => onHideCompletedChange(!hideCompleted)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
            hideCompleted
              ? 'bg-brand/10 text-brand'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
          title={t('myWork.focus.filters.hideCompleted', 'Hide completed')}
        >
          {hideCompleted ? <EyeOff size={13} /> : <Eye size={13} />}
          {t('myWork.focus.filters.hideCompleted', 'Hide completed')}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// PLAN MY DAY PANEL
// ============================================================================

const PlanMyDayPanel: React.FC<{
  suggestions: FocusItem[];
  onAddToToday: (item: FocusItem) => void;
  onSkip: (item: FocusItem) => void;
  onDone: () => void;
}> = ({ suggestions, onAddToToday, onSkip, onDone }) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleSuggestions = suggestions.filter((s) => !dismissed.has(s.id));

  const handleSkip = (item: FocusItem) => {
    setDismissed((prev) => new Set(prev).add(item.id));
    onSkip(item);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <Sparkles size={18} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-900 dark:text-white">
              {t('myWork.focus.planMyDay.title', 'Plan Your Day')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t(
                'myWork.focus.planMyDay.subtitle',
                'Pick items to focus on today. Sorted by priority and urgency.'
              )}
            </p>
          </div>
        </div>
        <button
          onClick={onDone}
          className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
        >
          {t('myWork.focus.planMyDay.done', 'Done planning')}
        </button>
      </div>

      {visibleSuggestions.length > 0 ? (
        <div className="space-y-2">
          {visibleSuggestions.slice(0, 7).map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              className="flex items-center gap-3 p-3 bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700"
            >
              {item.type === 'decision' ? (
                <Zap size={16} className="text-purple-500 shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      item.type === 'decision'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {item.type === 'decision' ? 'Decision' : 'Task'}
                  </span>
                  {item.priority && ['urgent', 'critical', 'high'].includes(item.priority) && (
                    <span className="text-[10px] font-medium text-red-500">
                      {item.priority}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-navy-900 dark:text-white truncate mt-0.5">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {item.dueDate && (
                    <DueDateIndicator dueDate={item.dueDate} size="sm" />
                  )}
                  {item.initiativeName && (
                    <span className="text-[10px] text-slate-400 truncate">
                      {item.initiativeName}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onAddToToday(item)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
                >
                  <Sun size={12} />
                  {t('myWork.focus.planMyDay.addToday', 'Today')}
                </button>
                <button
                  onClick={() => handleSkip(item)}
                  className="px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
                >
                  {t('myWork.focus.planMyDay.skip', 'Skip')}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
          {t('myWork.focus.planMyDay.noSuggestions', 'No more items to suggest.')}
        </p>
      )}
    </motion.div>
  );
};

// ============================================================================
// SMART SNOOZE POPOVER
// ============================================================================

const SmartSnoozePopover: React.FC<{
  item: FocusItem;
  onSnooze: (item: FocusItem, column: FocusColumn) => void;
  onClose: () => void;
}> = ({ item, onSnooze, onClose }) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const options: { label: string; column: FocusColumn; icon: React.ReactNode }[] = [
    {
      label: t('myWork.focus.snooze.thisWeek', 'This Week'),
      column: 'thisWeek',
      icon: <CalendarDays size={14} />,
    },
    {
      label: t('myWork.focus.snooze.later', 'Later'),
      column: 'later',
      icon: <Calendar size={14} />,
    },
  ];

  const filtered = options.filter((o) => o.column !== item.column);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-navy-900 rounded-lg shadow-xl border border-slate-200 dark:border-navy-700 py-1 min-w-[160px]"
    >
      <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        {t('myWork.focus.snooze.moveTo', 'Move to')}
      </div>
      {filtered.map((opt) => (
        <button
          key={opt.column}
          onClick={() => {
            onSnooze(item, opt.column);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </motion.div>
  );
};

// ============================================================================
// SORTABLE ITEM COMPONENT
// ============================================================================

interface SortableFocusCardProps {
  item: FocusItem;
  isSelected?: boolean;
  onComplete: (item: FocusItem) => void;
  onSnooze: (item: FocusItem, column: FocusColumn) => void;
  onDelegate: (item: FocusItem) => void;
  onRemove: (item: FocusItem) => void;
  onClick: (item: FocusItem) => void;
  isDragging?: boolean;
}

const SortableFocusCard: React.FC<SortableFocusCardProps> = ({
  item,
  isSelected,
  onComplete,
  onSnooze,
  onDelegate,
  onRemove,
  onClick,
  isDragging,
}) => {
  const { t } = useTranslation();
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const pmoCategory =
    item.pmoCategory ||
    getPMOCategory({
      dueDate: item.dueDate,
      priority: item.priority,
    });

  const isOverdue = item.isOverdue || (item.dueDate && new Date(item.dueDate) < new Date());
  const isBlocked = item.status === 'blocked';
  const borderLeft = item.priority ? priorityBorderColor[item.priority] || '' : '';

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      className={`
        group relative bg-white dark:bg-navy-900 rounded-xl border border-l-[3px]
        ${borderLeft}
        ${
          item.isCompleted
            ? 'border-green-200 dark:border-green-800/30 bg-green-50/50 dark:bg-green-900/10'
            : isOverdue
              ? 'border-red-200 dark:border-red-800/30'
              : isSelected
                ? 'border-brand dark:border-brand ring-2 ring-brand/30'
                : 'border-slate-200 dark:border-navy-700 hover:border-brand/30 dark:hover:border-brand/20'
        }
        ${isDragging || isSortableDragging ? 'shadow-xl ring-2 ring-brand opacity-50' : 'shadow-sm'}
        transition-all duration-200 cursor-pointer
      `}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="shrink-0 pt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={14} className="text-slate-400 dark:text-slate-600" />
        </div>

        {/* Type Badge & Completion Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete(item);
          }}
          className="shrink-0 mt-0.5"
        >
          {item.isCompleted ? (
            <CheckCircle2 size={20} className="text-green-500" />
          ) : item.type === 'decision' ? (
            <Zap size={20} className="text-purple-500" />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-brand transition-colors" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0" onClick={() => onClick(item)}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Type label + initiative */}
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    item.type === 'decision'
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {item.type === 'decision'
                    ? t('myWork.focus.decision', 'Decision')
                    : t('myWork.focus.task', 'Task')}
                </span>
                {isBlocked && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    {t('myWork.focus.card.blocked', 'Blocked')}
                  </span>
                )}
                {item.initiativeName && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {item.initiativeName}
                  </span>
                )}
              </div>

              {/* Title */}
              <h4
                className={`text-sm font-semibold leading-snug ${
                  item.isCompleted
                    ? 'text-slate-400 dark:text-slate-500 line-through'
                    : 'text-navy-900 dark:text-white'
                }`}
              >
                {item.title}
              </h4>
            </div>
          </div>

          {/* Meta Row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <PMOPriorityBadge category={pmoCategory} size="sm" showLabel={false} />
            {item.dueDate && (
              <DueDateIndicator
                dueDate={item.dueDate}
                dueTime={item.dueTime}
                isCompleted={item.isCompleted}
                size="sm"
              />
            )}
            {item.checklistTotal != null && item.checklistTotal > 0 && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <ListChecks size={10} />
                {item.checklistDone || 0}/{item.checklistTotal}
              </span>
            )}
            {item.estimatedHours != null && item.estimatedHours > 0 && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Timer size={10} />
                {item.estimatedHours}h
              </span>
            )}
            {item.assignee && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <User size={10} />
                {item.assignee.name}
              </span>
            )}
            {item.daysWaiting != null && item.daysWaiting > 0 && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Clock size={10} />
                {item.daysWaiting}d
              </span>
            )}
          </div>

          {/* Inline decision actions */}
          {item.type === 'decision' && !item.isCompleted && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete(item);
                }}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              >
                <ThumbsUp size={10} />
                {t('myWork.focus.card.approve', 'Approve')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item);
                }}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <ThumbsDown size={10} />
                {t('myWork.focus.card.reject', 'Reject')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row Actions Menu */}
      {!item.isCompleted && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <RowActionsMenu
              size="sm"
              actions={(() => {
                const actions: RowAction[] = [
                  {
                    id: 'done',
                    label: t('myWork.focus.actions.done', 'Done'),
                    icon: Check,
                    onClick: () => onComplete(item),
                    variant: 'primary',
                  },
                  {
                    id: 'snooze',
                    label: t('myWork.focus.actions.snooze', 'Snooze'),
                    icon: Clock,
                    onClick: () => setSnoozeOpen(true),
                  },
                  {
                    id: 'remove',
                    label: t('myWork.focus.actions.remove', 'Remove from focus'),
                    icon: X,
                    onClick: () => onRemove(item),
                    divider: true,
                  },
                  {
                    id: 'delegate',
                    label: t('myWork.focus.actions.delegate', 'Delegate'),
                    icon: UserPlus,
                    onClick: () => onDelegate(item),
                  },
                ];
                return actions;
              })()}
            />
            <AnimatePresence>
              {snoozeOpen && (
                <SmartSnoozePopover
                  item={item}
                  onSnooze={onSnooze}
                  onClose={() => setSnoozeOpen(false)}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ============================================================================
// FOCUS CARD FOR DRAG OVERLAY
// ============================================================================

const FocusCardOverlay: React.FC<{ item: FocusItem }> = ({ item }) => {
  const borderLeft = item.priority ? priorityBorderColor[item.priority] || '' : '';
  return (
    <div
      className={`bg-white dark:bg-navy-900 rounded-xl border border-l-[3px] ${borderLeft} border-brand shadow-2xl p-3 w-[300px] ring-2 ring-brand`}
    >
      <div className="flex items-center gap-3">
        {item.type === 'decision' ? (
          <Zap size={20} className="text-purple-500" />
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-brand" />
        )}
        <div className="flex-1 min-w-0">
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
              item.type === 'decision'
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
            }`}
          >
            {item.type === 'decision' ? 'Decision' : 'Task'}
          </span>
          <h4 className="text-sm font-semibold text-navy-900 dark:text-white truncate mt-1">
            {item.title}
          </h4>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// DROPPABLE COLUMN COMPONENT
// ============================================================================

interface FocusColumnProps {
  column: FocusColumn;
  items: FocusItem[];
  selectedItemId: string | null;
  onComplete: (item: FocusItem) => void;
  onSnooze: (item: FocusItem, targetColumn: FocusColumn) => void;
  onDelegate: (item: FocusItem) => void;
  onRemove: (item: FocusItem) => void;
  onItemClick: (item: FocusItem) => void;
}

const FocusColumnComponent: React.FC<FocusColumnProps> = ({
  column,
  items,
  selectedItemId,
  onComplete,
  onSnooze,
  onDelegate,
  onRemove,
  onItemClick,
}) => {
  const { t } = useTranslation();
  const config = columnConfig[column];
  const completedCount = items.filter((i) => i.isCompleted).length;

  return (
    <div
      className={`flex flex-col rounded-xl border ${config.borderColor} ${config.bgColor} min-h-[400px]`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-4 border-b border-inherit">
        <div className="flex items-center gap-2">
          <span className={config.color}>{config.icon}</span>
          <h3 className={`font-semibold ${config.color}`}>{t(config.titleKey, config.title)}</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {completedCount}/{items.length}
          </span>
        </div>
        {items.length > 0 && (
          <div className="w-16 h-1.5 bg-white/50 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${items.length > 0 ? (completedCount / items.length) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>

      {/* Column Content */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto">
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <SortableFocusCard
                key={item.id}
                item={item}
                isSelected={selectedItemId === item.id}
                onComplete={onComplete}
                onSnooze={onSnooze}
                onDelegate={onDelegate}
                onRemove={onRemove}
                onClick={onItemClick}
              />
            ))}
          </AnimatePresence>
        </SortableContext>

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className={`p-3 rounded-full ${config.bgColor} mb-2`}>{config.icon}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('myWork.focus.emptyColumn', 'No items')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// DELEGATE MODAL
// ============================================================================

interface DelegateModalProps {
  item: FocusItem | null;
  onClose: () => void;
  onDelegate: (itemId: string, userId: string) => void;
}

const DelegateModal: React.FC<DelegateModalProps> = ({ item, onClose, onDelegate }) => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<{ id: string; name: string; avatarUrl?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setLoading(true);
      Api.get('/users')
        .then((res) => {
          const userList = Array.isArray(res) ? res : res.users || [];
          setUsers(userList.slice(0, 10));
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [item]);

  if (!item) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl border border-slate-200 dark:border-navy-700 w-full max-w-md mx-4"
      >
        <div className="p-6">
          <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-2">
            {t('myWork.focus.delegateTitle', 'Delegate Task')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{item.title}</p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-brand" size={24} />
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    selectedUserId === user.id
                      ? 'border-brand bg-brand/5'
                      : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
                  }`}
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-purple-600 flex items-center justify-center">
                      <span className="text-xs font-medium text-white">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-sm font-medium text-navy-900 dark:text-white">
                    {user.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={() => {
              if (selectedUserId) {
                onDelegate(item.id, selectedUserId);
                onClose();
              }
            }}
            disabled={!selectedUserId}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('myWork.focus.actions.delegate', 'Delegate')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================================================
// KEYBOARD SHORTCUTS BAR
// ============================================================================

const KeyboardShortcutsBar: React.FC = () => {
  const { t } = useTranslation();
  const shortcuts = [
    { key: 'j/k', label: t('myWork.focus.shortcuts.navigate', 'Navigate') },
    { key: 'd', label: t('myWork.focus.shortcuts.done', 'Done') },
    { key: 's', label: t('myWork.focus.shortcuts.snooze', 'Snooze') },
    { key: 'r', label: t('myWork.focus.shortcuts.remove', 'Remove') },
    { key: 't', label: t('myWork.focus.shortcuts.moveToday', 'Today') },
    { key: 'w', label: t('myWork.focus.shortcuts.moveWeek', 'Week') },
    { key: 'Enter', label: t('myWork.focus.shortcuts.open', 'Open') },
  ];

  return (
    <div className="flex items-center justify-center gap-4 px-4 py-2 bg-slate-50 dark:bg-navy-800/50 rounded-lg border border-slate-200 dark:border-navy-700">
      {shortcuts.map((s) => (
        <div key={s.key} className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded text-slate-600 dark:text-slate-300 shadow-sm">
            {s.key}
          </kbd>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">{s.label}</span>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// MAIN FOCUS VIEW COMPONENT
// ============================================================================

export const FocusView: React.FC<FocusViewProps> = ({ onItemClick, onNavigateToInbox, refreshTrigger }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FocusItem[]>([]);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [delegateItem, setDelegateItem] = useState<FocusItem | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showPlanMyDay, setShowPlanMyDay] = useState(false);

  // Filters
  const [filter, setFilter] = useState<FocusFilter>('all');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [sort, setSort] = useState<FocusSort>('manual');

  const parseKey = useCallback((key: string): { kind: 'task' | 'decision'; id: string } | null => {
    const [kind, id] = String(key || '').split(':');
    if ((kind === 'task' || kind === 'decision') && id) return { kind, id };
    return null;
  }, []);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load focus data
  const loadFocus = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksRes, decisionsRes, focusStateRes] = await Promise.all([
        Api.get('/my-work/tasks?limit=200').catch(() => ({ tasks: [] })),
        Api.get('/my-work/decisions?limit=120').catch(() => ({ decisions: [] })),
        Api.get('/my-work/focus/state').catch(() => ({ items: [] })),
      ]);

      const tasks = Array.isArray(tasksRes) ? tasksRes : tasksRes.tasks || [];
      const decisions = Array.isArray(decisionsRes) ? decisionsRes : decisionsRes.decisions || [];
      const focusStateItems = Array.isArray((focusStateRes as any)?.items)
        ? (focusStateRes as any).items
        : [];
      const focusStateMap = new Map<string, { column: FocusColumn; position: number }>();
      for (const s of focusStateItems) {
        const itemKey = String(s?.itemKey || s?.item_key || '');
        const col = String(s?.column || s?.column_name || '') as FocusColumn;
        const pos = Number(s?.position || 0);
        if (!itemKey) continue;
        if (!['today', 'thisWeek', 'later'].includes(col)) continue;
        focusStateMap.set(itemKey, { column: col, position: Number.isFinite(pos) ? pos : 0 });
      }

      const now = new Date();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const endOfWeek = new Date(todayStart);
      endOfWeek.setDate(todayStart.getDate() + 7);

      // --- SMART AUTO-CATEGORIZATION (Task 1) ---
      const parseChecklist = (raw: any): { total: number; done: number } => {
        try {
          const list = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
          return {
            total: list.length,
            done: list.filter((c: any) => c.completed || c.checked || c.done).length,
          };
        } catch {
          return { total: 0, done: 0 };
        }
      };

      const taskItemsAll: FocusItem[] = tasks.map((task: any, idx: number) => {
        const key = `task:${task.id}`;
        const persisted = focusStateMap.get(key);
        const priority = task.priority?.toLowerCase();
        const checklist = parseChecklist(task.checklist);

        let column: FocusColumn = persisted?.column || 'later';
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          dueDate.setHours(0, 0, 0, 0);

          if (dueDate < tomorrowStart) {
            column = 'today'; // overdue/today always forces Today
          } else if (dueDate < endOfWeek) {
            column = persisted?.column || 'thisWeek';
          }
        } else if (!persisted) {
          if (priority === 'urgent' || priority === 'critical' || priority === 'high') {
            column = 'thisWeek';
          }
        }

        return {
          id: key,
          type: 'task' as const,
          title: task.title,
          description: task.description,
          column,
          position: persisted?.position ?? idx,
          priority,
          status: task.status,
          dueDate: task.dueDate,
          assignee: task.assignee
            ? task.assignee
            : task.assigneeId
              ? {
                  id: task.assigneeId,
                  name: [task.assigneeFirstName, task.assigneeLastName].filter(Boolean).join(' '),
                  avatarUrl: task.assigneeAvatarUrl,
                }
              : undefined,
          initiativeId: task.initiativeId,
          initiativeName: task.initiativeName || task.projectName,
          isCompleted: task.status === 'done' || task.status === 'completed',
          estimatedHours: task.estimatedHours || task.estimated_hours,
          checklistTotal: checklist.total,
          checklistDone: checklist.done,
        };
      });

      const decisionItemsAll: FocusItem[] = decisions.map((decision: any, idx: number) => {
        const key = `decision:${decision.id}`;
        const persisted = focusStateMap.get(key);
        const priority = decision.priority?.toLowerCase();

        let column: FocusColumn = persisted?.column || 'thisWeek';

        // Force overdue items to Today (even if user moved them away)
        const forceOverdue = decision.isOverdue || (decision.dueDate && new Date(decision.dueDate) < tomorrowStart);
        if (forceOverdue) {
          column = 'today';
        } else if (!persisted) {
          // No user override: auto-categorize by waiting time and priority
          if (decision.daysWaiting && decision.daysWaiting > 1) {
            column = 'today';
          } else if (priority === 'critical' || priority === 'high') {
            column = 'thisWeek';
          }
        }

        return {
          id: key,
          type: 'decision' as const,
          title: decision.title,
          description: decision.description,
          column,
          position: persisted?.position ?? idx,
          priority,
          dueDate: decision.dueDate,
          isOverdue: decision.isOverdue,
          daysWaiting: decision.daysWaiting,
          decisionType: decision.decisionType,
          initiativeName: decision.projectName || decision.relatedObjectName,
          isCompleted: decision.status === 'APPROVED' || decision.status === 'REJECTED',
        };
      });

      // Classify into columns, enforce cap with overflow from Today -> thisWeek
      const byCol: Record<FocusColumn, FocusItem[]> = { today: [], thisWeek: [], later: [] };
      for (const it of [...taskItemsAll, ...decisionItemsAll]) {
        byCol[it.column].push(it);
      }

      // Sort within columns
      const sortCol = (arr: FocusItem[]) => arr.sort((a, b) => a.position - b.position);
      for (const col of ['today', 'thisWeek', 'later'] as FocusColumn[]) {
        sortCol(byCol[col]);
      }

      // AUTO-POPULATE TODAY: if Today has fewer than 3 non-completed items,
      // pull top-scored items from thisWeek/later ensuring type diversity.
      const todayActiveCount = byCol.today.filter((i) => !i.isCompleted).length;
      if (todayActiveCount < 3) {
        const AUTO_PULL_TARGET = 5;
        const needed = AUTO_PULL_TARGET - todayActiveCount;
        const pool = [...byCol.thisWeek, ...byCol.later]
          .filter((i) => !i.isCompleted)
          .sort((a, b) => scoreFocusItem(b, now) - scoreFocusItem(a, now));

        // Guarantee type diversity: pull from tasks and decisions separately
        const taskPool = pool.filter((i) => i.type === 'task');
        const decisionPool = pool.filter((i) => i.type === 'decision');
        const candidates: FocusItem[] = [];

        // Interleave: take up to ceil(needed/2) from each type, then fill remainder
        const perType = Math.ceil(needed / 2);
        candidates.push(...decisionPool.slice(0, Math.min(perType, decisionPool.length)));
        candidates.push(...taskPool.slice(0, Math.min(perType, taskPool.length)));

        // If one type had fewer items, fill from the other
        if (candidates.length < needed) {
          const taken = new Set(candidates.map((c) => c.id));
          const remainder = pool.filter((i) => !taken.has(i.id)).slice(0, needed - candidates.length);
          candidates.push(...remainder);
        }

        const finalCandidates = candidates.slice(0, needed);
        const pulledIds = new Set(finalCandidates.map((c) => c.id));
        for (const candidate of finalCandidates) {
          byCol.today.push({ ...candidate, column: 'today' });
        }
        byCol.thisWeek = byCol.thisWeek.filter((i) => !pulledIds.has(i.id));
        byCol.later = byCol.later.filter((i) => !pulledIds.has(i.id));
      }

      // Cap Today at MAX_TODAY_AUTO; overflow spills to thisWeek
      if (byCol.today.length > MAX_TODAY_AUTO) {
        const overflow = byCol.today.splice(MAX_TODAY_AUTO);
        byCol.thisWeek.unshift(...overflow.map((it) => ({ ...it, column: 'thisWeek' as const })));
      }

      const allItems = [
        ...byCol.today.slice(0, MAX_PER_COLUMN),
        ...byCol.thisWeek.slice(0, MAX_PER_COLUMN),
        ...byCol.later.slice(0, MAX_PER_COLUMN),
      ];

      setItems(allItems);

      // Show Plan My Day if Today still has few items and more are available
      const todayFinal = byCol.today.filter((i) => !i.isCompleted).length;
      const remainingItems = [...byCol.thisWeek, ...byCol.later].filter(
        (i) => !i.isCompleted
      ).length;
      if (todayFinal <= 2 && remainingItems > 0) {
        setShowPlanMyDay(true);
      }
    } catch (error) {
      console.error('Failed to load focus data:', error);
      toast.error(t('myWork.focus.loadError', 'Failed to load focus items'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadFocus();
  }, [loadFocus, refreshTrigger]);

  // Group items by column with filters applied
  const itemsByColumn = useMemo(() => {
    let filtered = items;

    // Apply type filter
    if (filter === 'tasks') filtered = filtered.filter((i) => i.type === 'task');
    if (filter === 'decisions') filtered = filtered.filter((i) => i.type === 'decision');

    // Apply hide completed
    if (hideCompleted) filtered = filtered.filter((i) => !i.isCompleted);

    // Sort function
    const sortFn = (a: FocusItem, b: FocusItem): number => {
      if (sort === 'priority') {
        const pa = PRIORITY_RANK[a.priority || 'medium'] ?? 3;
        const pb = PRIORITY_RANK[b.priority || 'medium'] ?? 3;
        if (pa !== pb) return pa - pb;
        return a.position - b.position;
      }
      if (sort === 'dueDate') {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        if (da !== db) return da - db;
        return a.position - b.position;
      }
      return a.position - b.position;
    };

    const todayItems = filtered.filter((i) => i.column === 'today').sort(sortFn);
    const todayIds = new Set(todayItems.map((i) => i.id));

    return {
      today: todayItems,
      thisWeek: filtered
        .filter((i) => i.column === 'thisWeek' && !todayIds.has(i.id))
        .sort(sortFn),
      later: filtered
        .filter((i) => i.column === 'later' && !todayIds.has(i.id))
        .sort(sortFn),
    };
  }, [items, filter, hideCompleted, sort]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(
    () => [...itemsByColumn.today, ...itemsByColumn.thisWeek, ...itemsByColumn.later],
    [itemsByColumn]
  );

  // Plan My Day suggestions (scored)
  const planSuggestions = useMemo(() => {
    const now = new Date();
    return [...itemsByColumn.thisWeek, ...itemsByColumn.later]
      .filter((i) => !i.isCompleted)
      .sort((a, b) => scoreFocusItem(b, now) - scoreFocusItem(a, now));
  }, [itemsByColumn]);

  // Find item by ID
  const findItemById = useCallback(
    (id: UniqueIdentifier) => items.find((i) => i.id === id),
    [items]
  );

  // --- KEYBOARD SHORTCUTS (Task 4) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const currentIdx = selectedItemId ? flatItems.findIndex((i) => i.id === selectedItemId) : -1;
      const selected = currentIdx >= 0 ? flatItems[currentIdx] : null;

      switch (e.key) {
        case 'j': {
          e.preventDefault();
          const nextIdx = Math.min(currentIdx + 1, flatItems.length - 1);
          if (flatItems[nextIdx]) setSelectedItemId(flatItems[nextIdx].id);
          break;
        }
        case 'k': {
          e.preventDefault();
          const prevIdx = Math.max(currentIdx - 1, 0);
          if (flatItems[prevIdx]) setSelectedItemId(flatItems[prevIdx].id);
          break;
        }
        case 'd':
          if (selected) {
            e.preventDefault();
            handleComplete(selected);
          }
          break;
        case 's':
          if (selected && !selected.isCompleted) {
            e.preventDefault();
            const nextCol: Record<FocusColumn, FocusColumn> = {
              today: 'thisWeek',
              thisWeek: 'later',
              later: 'later',
            };
            handleSnooze(selected, nextCol[selected.column]);
          }
          break;
        case 'r':
          if (selected && !selected.isCompleted) {
            e.preventDefault();
            handleRemoveFromFocus(selected);
          }
          break;
        case 't':
          if (selected && selected.column !== 'today') {
            e.preventDefault();
            handleSnooze(selected, 'today');
          }
          break;
        case 'w':
          if (selected && selected.column !== 'thisWeek') {
            e.preventDefault();
            handleSnooze(selected, 'thisWeek');
          }
          break;
        case 'l':
          if (selected && selected.column !== 'later') {
            e.preventDefault();
            handleSnooze(selected, 'later');
          }
          break;
        case 'Enter':
          if (selected) {
            e.preventDefault();
            onItemClick?.(selected);
          }
          break;
        case 'Escape':
          setSelectedItemId(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId, flatItems]);

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeItem = findItemById(active.id);
    const overItem = findItemById(over.id);

    if (!activeItem) return;

    if (overItem && activeItem.column !== overItem.column) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === activeItem.id ? { ...item, column: overItem.column } : item
        )
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeItem = findItemById(active.id);
    const overItem = findItemById(over.id);

    if (!activeItem || !overItem) return;

    const sourceCol = activeItem.column;
    const targetCol = overItem.column;

    try {
      if (sourceCol === targetCol) {
        const columnItems = itemsByColumn[sourceCol];
        const oldIndex = columnItems.findIndex((i) => i.id === active.id);
        const newIndex = columnItems.findIndex((i) => i.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        if (oldIndex !== newIndex) {
          const newColumnItems = arrayMove(columnItems, oldIndex, newIndex).map((it, idx) => ({
            ...it,
            position: idx,
          }));
          setItems((prev) => [...prev.filter((i) => i.column !== sourceCol), ...newColumnItems]);
        }

        await Api.put('/my-work/focus/reorder', {
          itemId: active.id,
          column: sourceCol,
          position: newIndex,
        });
        return;
      }

      const sourceItems = itemsByColumn[sourceCol]
        .filter((i) => i.id !== active.id)
        .map((it, idx) => ({ ...it, position: idx }));
      const targetItems = [...itemsByColumn[targetCol]];
      const insertAt = targetItems.findIndex((i) => i.id === over.id);
      const moving: FocusItem = { ...activeItem, column: targetCol };
      targetItems.splice(insertAt >= 0 ? insertAt : targetItems.length, 0, moving);
      const targetItemsRe = targetItems.map((it, idx) => ({ ...it, position: idx }));

      setItems((prev) => [
        ...prev.filter((i) => i.column !== sourceCol && i.column !== targetCol),
        ...sourceItems,
        ...targetItemsRe,
      ]);

      await Api.put('/my-work/focus/move', {
        itemId: active.id,
        column: targetCol,
      });
      await Api.put('/my-work/focus/reorder', {
        itemId: active.id,
        column: targetCol,
        position: insertAt >= 0 ? insertAt : targetItemsRe.length - 1,
      });
    } catch (error) {
      console.error('Failed to persist focus state:', error);
    }
  };

  // Action handlers
  const handleComplete = async (item: FocusItem) => {
    try {
      const newCompleted = !item.isCompleted;
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isCompleted: newCompleted } : i))
      );

      const parsed = parseKey(item.id);
      if (!parsed) throw new Error('Invalid focus item key');
      const endpoint = parsed.kind === 'task' ? `/tasks/${parsed.id}` : `/decisions/${parsed.id}`;

      await Api.put(endpoint, {
        status: newCompleted
          ? item.type === 'task'
            ? 'done'
            : 'APPROVED'
          : item.type === 'task'
            ? 'todo'
            : 'PENDING',
      });

      if (newCompleted) {
        await Api.delete(`/my-work/focus/item?itemId=${encodeURIComponent(item.id)}`).catch(
          () => {}
        );
      }

      toast.success(
        newCompleted
          ? t('myWork.focus.completed', 'Marked as done!')
          : t('myWork.focus.reopened', 'Reopened')
      );
    } catch (error) {
      console.error('Failed to complete item:', error);
      loadFocus();
      toast.error(t('myWork.focus.error', 'Failed to update'));
    }
  };

  const handleSnooze = async (item: FocusItem, targetColumn: FocusColumn) => {
    if (item.column === targetColumn) return;

    try {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, column: targetColumn } : i)));

      await Api.put('/my-work/focus/move', {
        itemId: item.id,
        column: targetColumn,
      });

      const colLabel =
        targetColumn === 'today'
          ? t('myWork.focus.columns.today', 'Today')
          : targetColumn === 'thisWeek'
            ? t('myWork.focus.columns.thisWeek', 'This Week')
            : t('myWork.focus.columns.later', 'Later');

      toast.success(`${t('myWork.focus.movedTo', 'Moved to')} ${colLabel}`);
    } catch (error) {
      console.error('Failed to snooze item:', error);
      loadFocus();
      toast.error(t('myWork.focus.error', 'Failed to snooze'));
    }
  };

  const handleRemoveFromFocus = async (item: FocusItem) => {
    try {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      await Api.delete(`/my-work/focus/item?itemId=${encodeURIComponent(item.id)}`);
      toast.success(t('myWork.focus.removed', 'Removed from focus'));
    } catch (error) {
      console.error('Failed to remove from focus:', error);
      loadFocus();
      toast.error(t('myWork.focus.error', 'Failed to update'));
    }
  };

  const handleDelegate = async (itemId: string, userId: string) => {
    try {
      const item = findItemById(itemId);
      if (!item) return;

      const parsed = parseKey(itemId);
      if (!parsed) throw new Error('Invalid focus item key');
      const endpoint =
        parsed.kind === 'task' ? `/tasks/${parsed.id}/assign` : `/decisions/${parsed.id}/delegate`;

      await Api.post(endpoint, { userId });

      setItems((prev) => prev.filter((i) => i.id !== itemId));
      await Api.delete(`/my-work/focus/item?itemId=${encodeURIComponent(itemId)}`).catch(() => {});
      toast.success(t('myWork.focus.delegated', 'Successfully delegated'));
    } catch (error) {
      console.error('Failed to delegate:', error);
      toast.error(t('myWork.focus.error', 'Failed to delegate'));
    }
  };

  const handlePlanAddToToday = async (item: FocusItem) => {
    await handleSnooze(item, 'today');
  };

  const activeItem = activeId ? findItemById(activeId) : null;
  const totalItems = items.filter((i) => !i.isCompleted).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={32} className="animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {/* Daily Progress Strip */}
      {items.length > 0 && (
        <DailyProgressStrip todayItems={itemsByColumn.today} totalItems={totalItems} />
      )}

      {/* Plan My Day Panel */}
      <AnimatePresence>
        {showPlanMyDay && planSuggestions.length > 0 && (
          <PlanMyDayPanel
            suggestions={planSuggestions}
            onAddToToday={handlePlanAddToToday}
            onSkip={() => {}}
            onDone={() => setShowPlanMyDay(false)}
          />
        )}
      </AnimatePresence>

      {/* Toolbar */}
      {items.length > 0 && (
        <FocusToolbar
          filter={filter}
          onFilterChange={setFilter}
          hideCompleted={hideCompleted}
          onHideCompletedChange={setHideCompleted}
          sort={sort}
          onSortChange={setSort}
        />
      )}

      {/* Kanban Board */}
      {items.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['today', 'thisWeek', 'later'] as FocusColumn[]).map((column) => (
              <FocusColumnComponent
                key={column}
                column={column}
                items={itemsByColumn[column]}
                selectedItemId={selectedItemId}
                onComplete={handleComplete}
                onSnooze={handleSnooze}
                onDelegate={(item) => setDelegateItem(item)}
                onRemove={handleRemoveFromFocus}
                onItemClick={(item) => {
                  setSelectedItemId(item.id);
                  onItemClick?.(item);
                }}
              />
            ))}
          </div>

          <DragOverlay>{activeItem && <FocusCardOverlay item={activeItem} />}</DragOverlay>
        </DndContext>
      ) : (
        <EmptyState
          icon={<Target size={48} />}
          title={t('myWork.focus.empty.title', 'No items to focus on')}
          description={t(
            'myWork.focus.empty.description',
            'Your tasks and decisions will appear here. Start by checking your inbox.'
          )}
          action={
            onNavigateToInbox && (
              <button
                onClick={onNavigateToInbox}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white font-medium hover:bg-brand-dark transition-colors"
              >
                {t('myWork.focus.goToInbox', 'Go to Inbox')}
                <ChevronRight size={16} />
              </button>
            )
          }
        />
      )}

      {/* Keyboard Shortcuts Bar */}
      {items.length > 0 && <KeyboardShortcutsBar />}

      {/* Delegate Modal */}
      <AnimatePresence>
        {delegateItem && (
          <DelegateModal
            item={delegateItem}
            onClose={() => setDelegateItem(null)}
            onDelegate={handleDelegate}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default FocusView;
