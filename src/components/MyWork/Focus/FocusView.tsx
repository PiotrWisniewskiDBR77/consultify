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
  Sun,
  Target,
  User,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  onRemove: (item: FocusItem) => void;
  onClick: (item: FocusItem) => void;
  isDragging?: boolean;
}

const SortableFocusCard: React.FC<SortableFocusCardProps> = ({
  item,
  onComplete,
  onSnooze,
  onDelegate,
  onRemove,
  onClick,
  isDragging,
}) => {
  const { t } = useTranslation();

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
    >
      <div className="flex items-start gap-3 p-4">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="shrink-0 pt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical
            size={16}
            className="text-slate-700 dark:text-slate-300 dark:text-slate-600"
          />
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
                  {item.type === 'decision'
                    ? t('myWork.focus.decision', 'Decision')
                    : t('myWork.focus.task', 'Task')}
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
                  item.isCompleted
                    ? 'text-slate-500 dark:text-slate-400 line-through'
                    : 'text-navy-900 dark:text-white'
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
              <span className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 flex items-center gap-1">
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

      {/* Row Actions Menu (A3.2: replaces overlapping inline buttons) */}
      {!item.isCompleted && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <RowActionsMenu
            size="sm"
            actions={(() => {
              const nextColumn: Record<FocusColumn, FocusColumn> = {
                today: 'thisWeek',
                thisWeek: 'later',
                later: 'later',
              };
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
                  onClick: () => onSnooze(item, nextColumn[item.column]),
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
        </div>
      )}
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
  onComplete: (item: FocusItem) => void;
  onSnooze: (item: FocusItem, targetColumn: FocusColumn) => void;
  onDelegate: (item: FocusItem) => void;
  onRemove: (item: FocusItem) => void;
  onItemClick: (item: FocusItem) => void;
}

const FocusColumnComponent: React.FC<FocusColumnProps> = ({
  column,
  items,
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
          <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
            {completedCount}/{items.length}
          </span>
        </div>
        {items.length > 0 && (
          <div className="w-16 h-1.5 bg-slate-50 dark:bg-white/50 dark:bg-white/10 rounded-full overflow-hidden">
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
                onRemove={onRemove}
                onClick={onItemClick}
              />
            ))}
          </AnimatePresence>
        </SortableContext>

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className={`p-3 rounded-full ${config.bgColor} mb-2`}>{config.icon}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
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
                      <span className="text-xs font-medium text-slate-900 dark:text-white">
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
// MAIN FOCUS VIEW COMPONENT
// ============================================================================

export const FocusView: React.FC<FocusViewProps> = ({ onItemClick, onNavigateToInbox }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FocusItem[]>([]);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [delegateItem, setDelegateItem] = useState<FocusItem | null>(null);

  const parseKey = useCallback((key: string): { kind: 'task' | 'decision'; id: string } | null => {
    const [kind, id] = String(key || '').split(':');
    if ((kind === 'task' || kind === 'decision') && id) return { kind, id };
    return null;
  }, []);

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
      const [tasksRes, decisionsRes, focusStateRes] = await Promise.all([
        Api.get('/my-work/tasks').catch(() => ({ tasks: [] })),
        Api.get('/my-work/decisions').catch(() => ({ decisions: [] })),
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

      // Map tasks to FocusItems
      // A3.1: Compute date boundaries once, then assign each task to exactly one column
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const endOfWeek = new Date(todayStart);
      endOfWeek.setDate(todayStart.getDate() + 7);

      const taskItems: FocusItem[] = tasks.slice(0, 20).map((task: any, idx: number) => {
        // Determine column based on due date
        const key = `task:${task.id}`;
        const persisted = focusStateMap.get(key);
        let column: FocusColumn = persisted?.column || 'later';
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          dueDate.setHours(0, 0, 0, 0);

          if (dueDate < tomorrowStart) {
            // Due today or overdue → Today
            column = persisted?.column || 'today';
          } else if (dueDate < endOfWeek) {
            // Due this week (but NOT today) → This Week
            column = persisted?.column || 'thisWeek';
          }
        }

        return {
          id: key,
          type: 'task' as const,
          title: task.title,
          description: task.description,
          column,
          position: persisted?.position ?? idx,
          priority: task.priority,
          status: task.status,
          dueDate: task.dueDate,
          assignee: task.assignee,
          initiativeId: task.initiativeId,
          initiativeName: task.initiativeName || task.projectName,
          isCompleted: task.status === 'done' || task.status === 'completed',
        };
      });

      // Map decisions to FocusItems (A3.1: use same date boundaries as tasks)
      const decisionItems: FocusItem[] = decisions
        .slice(0, 10)
        .map((decision: any, idx: number) => {
          const key = `decision:${decision.id}`;
          const persisted = focusStateMap.get(key);
          let column: FocusColumn = persisted?.column || 'thisWeek';
          if (decision.isOverdue || (decision.daysWaiting && decision.daysWaiting > 5)) {
            column = persisted?.column || 'today';
          } else if (decision.dueDate) {
            const dueDate = new Date(decision.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            if (dueDate < tomorrowStart) {
              column = persisted?.column || 'today';
            }
          }

          return {
            id: key,
            type: 'decision' as const,
            title: decision.title,
            description: decision.description,
            column,
            position: persisted?.position ?? idx,
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

  // Group items by column (A3.1: This Week excludes items already in Today)
  const itemsByColumn = useMemo(() => {
    const todayItems = items
      .filter((i) => i.column === 'today')
      .sort((a, b) => a.position - b.position);
    const todayIds = new Set(todayItems.map((i) => i.id));

    return {
      today: todayItems,
      thisWeek: items
        .filter((i) => i.column === 'thisWeek' && !todayIds.has(i.id))
        .sort((a, b) => a.position - b.position),
      later: items
        .filter((i) => i.column === 'later' && !todayIds.has(i.id))
        .sort((a, b) => a.position - b.position),
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

      // Cross-column move: remove from source, insert into target before overItem
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
        // Remove from focus state once completed (roundtrip persist/reload)
        await Api.delete(`/my-work/focus/item?itemId=${encodeURIComponent(item.id)}`).catch(() => {});
      }

      toast.success(
        newCompleted
          ? t('myWork.focus.completed', 'Marked as done!')
          : t('myWork.focus.reopened', 'Reopened')
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

      // Remove from list after delegation
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      await Api.delete(`/my-work/focus/item?itemId=${encodeURIComponent(itemId)}`).catch(() => {});
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
                onRemove={handleRemoveFromFocus}
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
