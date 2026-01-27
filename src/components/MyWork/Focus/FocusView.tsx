/**
 * FocusView - Kanban Board for focused task management
 * Part of My Work Module PMO Upgrade
 *
 * Features:
 * - Kanban board with 3 columns: Today / This Week / Later
 * - Drag & drop between columns using @dnd-kit
 * - Quick actions: Mark Done, Snooze, Delegate
 * - Integration with tasks and decisions
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
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Sun,
  Target,
  User,
  UserPlus,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import type { PMOCategory } from '../../../types/myWork';
import { DueDateIndicator } from '../shared/DueDateIndicator';
import { EmptyState } from '../shared/EmptyState';
import { getPMOCategory, PMOPriorityBadge } from '../shared/PMOPriorityBadge';

// ============================================================================
// TYPES
// ============================================================================

export type FocusColumn = 'today' | 'thisWeek' | 'later';

export type FocusItemType = 'task' | 'decision';

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
  // For decisions
  decisionType?: string;
  isOverdue?: boolean;
  daysWaiting?: number;
}

interface FocusViewProps {
  onItemClick?: (item: FocusItem) => void;
  onNavigateToInbox?: () => void;
}

// ============================================================================
// COLUMN CONFIG
// ============================================================================

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
// SORTABLE ITEM COMPONENT
// ============================================================================

interface SortableFocusCardProps {
  item: FocusItem;
  onComplete: (item: FocusItem) => void;
  onSnooze: (item: FocusItem, column: FocusColumn) => void;
  onDelegate: (item: FocusItem) => void;
  onClick: (item: FocusItem) => void;
  isDragging?: boolean;
}

const SortableFocusCard: React.FC<SortableFocusCardProps> = ({
  item,
  onComplete,
  onSnooze,
  onDelegate,
  onClick,
  isDragging,
}) => {
  const { t } = useTranslation();
  const [showQuickActions, setShowQuickActions] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } =
    useSortable({ id: item.id });

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

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      className={`
        group relative bg-white dark:bg-navy-900 rounded-xl border
        ${
          item.isCompleted
            ? 'border-green-200 dark:border-green-800/30 bg-green-50/50 dark:bg-green-900/10'
            : isOverdue
              ? 'border-red-200 dark:border-red-800/30'
              : 'border-slate-200 dark:border-navy-700 hover:border-brand/30 dark:hover:border-brand/20'
        }
        ${isDragging || isSortableDragging ? 'shadow-xl ring-2 ring-brand opacity-50' : 'shadow-sm'}
        transition-all duration-200 cursor-pointer
      `}
      onMouseEnter={() => setShowQuickActions(true)}
      onMouseLeave={() => setShowQuickActions(false)}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="shrink-0 pt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={16} className="text-slate-300 dark:text-slate-600" />
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
            <CheckCircle2 size={22} className="text-green-500" />
          ) : item.type === 'decision' ? (
            <Zap size={22} className="text-purple-500" />
          ) : (
            <div className="w-[22px] h-[22px] rounded-full border-2 border-slate-300 hover:border-brand transition-colors" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0" onClick={() => onClick(item)}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Type label */}
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    item.type === 'decision'
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {item.type === 'decision' ? t('myWork.focus.decision', 'Decision') : t('myWork.focus.task', 'Task')}
                </span>
                {item.initiativeName && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {item.initiativeName}
                  </span>
                )}
              </div>

              {/* Title */}
              <h4
                className={`text-sm font-semibold truncate ${
                  item.isCompleted ? 'text-slate-400 line-through' : 'text-navy-900 dark:text-white'
                }`}
              >
                {item.title}
              </h4>
            </div>
          </div>

          {/* Meta Row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <PMOPriorityBadge category={pmoCategory} size="sm" showLabel={false} />
            {item.dueDate && (
              <DueDateIndicator
                dueDate={item.dueDate}
                dueTime={item.dueTime}
                isCompleted={item.isCompleted}
                size="sm"
              />
            )}
            {item.assignee && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <User size={10} />
                {item.assignee.name}
              </span>
            )}
            {item.daysWaiting && item.daysWaiting > 0 && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Clock size={10} />
                {item.daysWaiting}d waiting
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Overlay */}
      <AnimatePresence>
        {showQuickActions && !item.isCompleted && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-gradient-to-t from-white dark:from-navy-900 to-transparent"
          >
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete(item);
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                title={t('myWork.focus.actions.markDone', 'Mark Done')}
              >
                <Check size={14} />
                <span className="hidden sm:inline">{t('myWork.focus.actions.done', 'Done')}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Snooze to next column
                  const nextColumn: Record<FocusColumn, FocusColumn> = {
                    today: 'thisWeek',
                    thisWeek: 'later',
                    later: 'later',
                  };
                  onSnooze(item, nextColumn[item.column]);
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                title={t('myWork.focus.actions.snooze', 'Snooze')}
              >
                <Clock size={14} />
                <span className="hidden sm:inline">{t('myWork.focus.actions.snooze', 'Snooze')}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelegate(item);
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title={t('myWork.focus.actions.delegate', 'Delegate')}
              >
                <UserPlus size={14} />
                <span className="hidden sm:inline">{t('myWork.focus.actions.delegate', 'Delegate')}</span>
              </button>
            </div>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-all"
            >
              <MoreHorizontal size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================================================
// FOCUS CARD FOR DRAG OVERLAY
// ============================================================================

const FocusCardOverlay: React.FC<{ item: FocusItem }> = ({ item }) => {
  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-brand shadow-2xl p-4 w-[300px] ring-2 ring-brand">
      <div className="flex items-center gap-3">
        {item.type === 'decision' ? (
          <Zap size={22} className="text-purple-500" />
        ) : (
          <div className="w-[22px] h-[22px] rounded-full border-2 border-brand" />
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
          <h4 className="text-sm font-semibold text-navy-900 dark:text-white truncate mt-1">{item.title}</h4>
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
  onComplete: (item: FocusItem) => void;
  onSnooze: (item: FocusItem, targetColumn: FocusColumn) => void;
  onDelegate: (item: FocusItem) => void;
  onItemClick: (item: FocusItem) => void;
}

const FocusColumnComponent: React.FC<FocusColumnProps> = ({
  column,
  items,
  onComplete,
  onSnooze,
  onDelegate,
  onItemClick,
}) => {
  const { t } = useTranslation();
  const config = columnConfig[column];
  const completedCount = items.filter((i) => i.isCompleted).length;

  return (
    <div className={`flex flex-col rounded-xl border ${config.borderColor} ${config.bgColor} min-h-[400px]`}>
      {/* Column Header */}
      <div className="flex items-center justify-between p-4 border-b border-inherit">
        <div className="flex items-center gap-2">
          <span className={config.color}>{config.icon}</span>
          <h3 className={`font-semibold ${config.color}`}>{t(config.titleKey, config.title)}</h3>
          <span className="text-xs text-slate-400 dark:text-slate-500">
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
                onComplete={onComplete}
                onSnooze={onSnooze}
                onDelegate={onDelegate}
                onClick={onItemClick}
              />
            ))}
          </AnimatePresence>
        </SortableContext>

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className={`p-3 rounded-full ${config.bgColor} mb-2`}>{config.icon}</div>
            <p className="text-sm text-slate-400 dark:text-slate-500">
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
          setUsers(userList.slice(0, 10)); // Limit for UI
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
                      <span className="text-xs font-medium text-white">{user.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <span className="text-sm font-medium text-navy-900 dark:text-white">{user.name}</span>
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
// MAIN FOCUS VIEW COMPONENT
// ============================================================================

export const FocusView: React.FC<FocusViewProps> = ({ onItemClick, onNavigateToInbox }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FocusItem[]>([]);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [delegateItem, setDelegateItem] = useState<FocusItem | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load focus data
  const loadFocus = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksRes, decisionsRes] = await Promise.all([
        Api.get('/my-work/tasks').catch(() => ({ tasks: [] })),
        Api.get('/my-work/decisions').catch(() => ({ decisions: [] })),
      ]);

      const tasks = Array.isArray(tasksRes) ? tasksRes : tasksRes.tasks || [];
      const decisions = Array.isArray(decisionsRes) ? decisionsRes : decisionsRes.decisions || [];

      // Map tasks to FocusItems
      const taskItems: FocusItem[] = tasks.slice(0, 20).map((task: any, idx: number) => {
        // Determine column based on due date
        let column: FocusColumn = 'later';
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(today);
          endOfWeek.setDate(today.getDate() + 7);

          if (dueDate <= today) {
            column = 'today';
          } else if (dueDate <= endOfWeek) {
            column = 'thisWeek';
          }
        }

        return {
          id: `task-${task.id}`,
          type: 'task' as const,
          title: task.title,
          description: task.description,
          column,
          position: idx,
          priority: task.priority,
          status: task.status,
          dueDate: task.dueDate,
          assignee: task.assignee,
          initiativeId: task.initiativeId,
          initiativeName: task.initiativeName || task.projectName,
          isCompleted: task.status === 'done' || task.status === 'completed',
        };
      });

      // Map decisions to FocusItems
      const decisionItems: FocusItem[] = decisions.slice(0, 10).map((decision: any, idx: number) => {
        let column: FocusColumn = 'thisWeek';
        if (decision.isOverdue || (decision.daysWaiting && decision.daysWaiting > 5)) {
          column = 'today';
        } else if (decision.dueDate) {
          const dueDate = new Date(decision.dueDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (dueDate <= today) {
            column = 'today';
          }
        }

        return {
          id: `decision-${decision.id}`,
          type: 'decision' as const,
          title: decision.title,
          description: decision.description,
          column,
          position: idx,
          priority: decision.priority?.toLowerCase(),
          dueDate: decision.dueDate,
          isOverdue: decision.isOverdue,
          daysWaiting: decision.daysWaiting,
          decisionType: decision.decisionType,
          initiativeName: decision.projectName || decision.relatedObjectName,
          isCompleted: decision.status === 'APPROVED' || decision.status === 'REJECTED',
        };
      });

      setItems([...taskItems, ...decisionItems]);
    } catch (error) {
      console.error('Failed to load focus data:', error);
      toast.error(t('myWork.focus.loadError', 'Failed to load focus items'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadFocus();
  }, [loadFocus]);

  // Group items by column
  const itemsByColumn = useMemo(() => {
    return {
      today: items.filter((i) => i.column === 'today').sort((a, b) => a.position - b.position),
      thisWeek: items.filter((i) => i.column === 'thisWeek').sort((a, b) => a.position - b.position),
      later: items.filter((i) => i.column === 'later').sort((a, b) => a.position - b.position),
    };
  }, [items]);

  // Find item by ID
  const findItemById = (id: UniqueIdentifier) => items.find((i) => i.id === id);

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

    // If dragging over another item, determine which column it's in
    if (overItem && activeItem.column !== overItem.column) {
      setItems((prev) =>
        prev.map((item) => (item.id === activeItem.id ? { ...item, column: overItem.column } : item))
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeItem = findItemById(active.id);
    const overItem = findItemById(over.id);

    if (!activeItem) return;

    // If dropped in the same column, reorder
    if (overItem && activeItem.column === overItem.column) {
      const columnItems = itemsByColumn[activeItem.column];
      const oldIndex = columnItems.findIndex((i) => i.id === active.id);
      const newIndex = columnItems.findIndex((i) => i.id === over.id);

      if (oldIndex !== newIndex) {
        const newColumnItems = arrayMove(columnItems, oldIndex, newIndex);
        setItems((prev) => {
          const otherItems = prev.filter((i) => i.column !== activeItem.column);
          return [...otherItems, ...newColumnItems.map((item, idx) => ({ ...item, position: idx }))];
        });
      }
    }

    // Save to API (debounced in real implementation)
    try {
      await Api.put('/my-work/focus/reorder', {
        itemId: active.id,
        column: activeItem.column,
        position: activeItem.position,
      });
    } catch (error) {
      console.error('Failed to save reorder:', error);
    }
  };

  // Action handlers
  const handleComplete = async (item: FocusItem) => {
    try {
      const newCompleted = !item.isCompleted;
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isCompleted: newCompleted } : i)));

      const endpoint =
        item.type === 'task'
          ? `/tasks/${item.id.replace('task-', '')}`
          : `/decisions/${item.id.replace('decision-', '')}`;

      await Api.put(endpoint, {
        status: newCompleted ? (item.type === 'task' ? 'done' : 'APPROVED') : (item.type === 'task' ? 'todo' : 'PENDING'),
      });

      toast.success(
        newCompleted ? t('myWork.focus.completed', 'Marked as done!') : t('myWork.focus.reopened', 'Reopened')
      );
    } catch (error) {
      console.error('Failed to complete item:', error);
      loadFocus(); // Revert
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

      toast.success(t('myWork.focus.snoozed', 'Snoozed'));
    } catch (error) {
      console.error('Failed to snooze item:', error);
      loadFocus();
      toast.error(t('myWork.focus.error', 'Failed to snooze'));
    }
  };

  const handleDelegate = async (itemId: string, userId: string) => {
    try {
      const item = findItemById(itemId);
      if (!item) return;

      const endpoint =
        item.type === 'task' ? `/tasks/${itemId.replace('task-', '')}/assign` : `/decisions/${itemId.replace('decision-', '')}/delegate`;

      await Api.post(endpoint, { userId });

      // Remove from list after delegation
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast.success(t('myWork.focus.delegated', 'Successfully delegated'));
    } catch (error) {
      console.error('Failed to delegate:', error);
      toast.error(t('myWork.focus.error', 'Failed to delegate'));
    }
  };

  const activeItem = activeId ? findItemById(activeId) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={32} className="animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
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
                onComplete={handleComplete}
                onSnooze={handleSnooze}
                onDelegate={(item) => setDelegateItem(item)}
                onItemClick={(item) => onItemClick?.(item)}
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

      {/* Delegate Modal */}
      <AnimatePresence>
        {delegateItem && (
          <DelegateModal item={delegateItem} onClose={() => setDelegateItem(null)} onDelegate={handleDelegate} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default FocusView;
