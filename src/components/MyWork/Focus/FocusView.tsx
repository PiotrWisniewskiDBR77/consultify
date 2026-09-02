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
  Archive,
  ArrowRight,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit2,
  GripVertical,
  ListChecks,
  Loader2,
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

import { renderIconNode } from '@/components/shared/renderIconNode';
import { LoadingState } from '@/components/ui/primitives';
import { EntityStatusChip } from '@/components/ui/primitives/chips';
import { CHIP_TONE_VAR, ChipBase, ChipDot } from '@/components/ui/primitives/chips/chipBase';
import { PREVIEW_PANE_WIDTH } from '@/components/shared/PreviewPane/previewGeometry';
import { PreviewPaneShell } from '@/components/ui/ResizableTable/PreviewPaneShell';
import { useAppStore } from '@/store/useAppStore';

import { Api } from '../../../services/api';
import type { PMOCategory } from '../../../types/myWork';
import { type RowActionSection, RowActionsMenu } from '../../shared/RowActionsMenu';
import { DueDateIndicator } from '../shared/DueDateIndicator';
import { EmptyState } from '../shared/EmptyState';
import { getPMOCategory, PMOPriorityBadge } from '../shared/PMOPriorityBadge';
import { AIPlanView } from './AIPlanView';

// ============================================================================
// TYPES
// ============================================================================

export type FocusColumn = 'today' | 'thisWeek' | 'later';

export type FocusItemType = 'task' | 'decision';

export type FocusFilter = 'all' | 'tasks' | 'decisions';
export type FocusSort = 'manual' | 'priority' | 'dueDate';

type FocusRules = {
  maxToday: number;
  maxWeek: number;
  capacityAware: boolean;
};

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
  controls?: {
    filter: FocusFilter;
    onFilterChange: (f: FocusFilter) => void;
    hideCompleted: boolean;
    onHideCompletedChange: (v: boolean) => void;
    sort: FocusSort;
    onSortChange: (s: FocusSort) => void;
    showAIPlan: boolean;
    onShowAIPlanChange: (v: boolean) => void;
  };
}

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

const MAX_PER_COLUMN = 40;
const FOCUS_TEMPLATE_STORAGE_KEY = 'consultify-focus-template';
const FOCUS_RULE_TEMPLATES = {
  balanced: { key: 'balanced', label: 'Balanced', maxToday: 5, maxWeek: 15, capacityAware: true },
  deepWork: { key: 'deepWork', label: 'Deep Work', maxToday: 3, maxWeek: 10, capacityAware: true },
  manager: { key: 'manager', label: 'Manager', maxToday: 7, maxWeek: 20, capacityAware: false },
} as const;
const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

function loadFocusTemplateKey(): keyof typeof FOCUS_RULE_TEMPLATES {
  try {
    const stored = localStorage.getItem(FOCUS_TEMPLATE_STORAGE_KEY);
    if (stored && stored in FOCUS_RULE_TEMPLATES) {
      return stored as keyof typeof FOCUS_RULE_TEMPLATES;
    }
  } catch {
    // ignore
  }
  return 'balanced';
}

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
    color: 'text-c-text-muted',
    bgColor: 'bg-c-surface',
    borderColor: 'border-c-border-subtle',
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
      className="absolute right-0 top-full mt-1 z-20 bg-c-surface rounded-lg shadow-hig-lg border border-slate-200/60 dark:border-white/[0.03] py-1 min-w-[160px]"
    >
      <div className="px-3 py-1.5 text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider">
        {t('myWork.focus.snooze.moveTo', 'Move to')}
      </div>
      {filtered.map((opt) => (
        <button
          key={opt.column}
          onClick={() => {
            onSnooze(item, opt.column);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-c-text-secondary hover:bg-c-surface-raised transition-colors"
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
  onSelect: (item: FocusItem) => void;
  onOpenFull: (item: FocusItem) => void;
  isDragging?: boolean;
}

const SortableFocusCard: React.FC<SortableFocusCardProps> = ({
  item,
  isSelected,
  onComplete,
  onSnooze,
  onDelegate,
  onRemove,
  onSelect,
  onOpenFull,
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

  return (
    // Canon §8.1/§8.2 — neutral kanban card surface; NO colored border-l accent.
    // Priority is expressed by the PMOPriorityBadge in the meta row, not a side bar.
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      onClick={() => onSelect(item)}
      onDoubleClick={() => onOpenFull(item)}
      className={`
        group relative bg-c-surface rounded-xl border
        ${
          item.isCompleted
            ? 'border-c-border-subtle bg-c-surface-raised'
            : isSelected
              ? 'border-c-border-strong ring-1 ring-inset ring-c-border-strong shadow-[inset_4px_0_0_var(--c-info)]'
              : 'border-c-border-subtle hover:border-c-border'
        }
        ${isDragging || isSortableDragging ? 'shadow-hig-lg ring-1 ring-c-border-strong opacity-70' : 'shadow-sm'}
        transition-all duration-200 cursor-pointer
      `}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 pt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={14} className="text-c-text-muted" />
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
            <Zap size={20} className="text-blue-500" />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-c-border hover:border-c-border-strong transition-colors" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Type label + initiative */}
              <div className="flex items-center gap-2 mb-0.5">
                {/* Type = identity taxonomy → neutral chip + signal dot (§4.0a) */}
                <ChipBase
                  size="sm"
                  leading={
                    <ChipDot
                      colorVar={item.type === 'decision' ? CHIP_TONE_VAR.info : undefined}
                      size="sm"
                    />
                  }
                >
                  {item.type === 'decision'
                    ? t('myWork.focus.decision', 'Decision')
                    : t('myWork.focus.task', 'Task')}
                </ChipBase>
                {/* Blocked = status → EntityStatusChip (maps to danger via statusChipTone) */}
                {isBlocked && (
                  <EntityStatusChip
                    status="blocked"
                    label={t('myWork.focus.card.blocked', 'Blocked')}
                  />
                )}
                {item.initiativeName && (
                  <span className="text-[10px] text-c-text-muted truncate">
                    {item.initiativeName}
                  </span>
                )}
              </div>

              {/* Title */}
              <h4
                className={`text-sm font-semibold leading-snug ${
                  item.isCompleted ? 'text-c-text-muted line-through' : 'text-c-text'
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
              <span className="text-[10px] text-c-text-muted flex items-center gap-1">
                <ListChecks size={10} />
                {item.checklistDone || 0}/{item.checklistTotal}
              </span>
            )}
            {item.estimatedHours != null && item.estimatedHours > 0 && (
              <span className="text-[10px] text-c-text-muted flex items-center gap-1">
                <Timer size={10} />
                {item.estimatedHours}h
              </span>
            )}
            {item.assignee && (
              <span className="text-[10px] text-c-text-muted flex items-center gap-1">
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
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-400 rounded-md hover:bg-danger-100 dark:hover:bg-danger-900/30 transition-colors"
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
              sections={(() => {
                const comingSoon = t('common.comingSoonBackend', 'Wkrótce (backend)');
                const sections: RowActionSection[] = [
                  // GÓRA — kontekst (canon §9.1): focus-specific actions.
                  {
                    id: 'context',
                    kind: 'context',
                    actions: [
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
                        id: 'delegate',
                        label: t('myWork.focus.actions.delegate', 'Delegate'),
                        icon: UserPlus,
                        onClick: () => onDelegate(item),
                      },
                    ],
                  },
                  // DÓŁ — FIXED BOTTOM MANIFEST (canon §9.2).
                  {
                    id: 'fixed',
                    kind: 'manage',
                    actions: [
                      {
                        id: 'open-preview',
                        label: t('myWork.focus.actions.openPreview', 'Otwórz podgląd'),
                        icon: ChevronRight,
                        onClick: () => onSelect(item),
                      },
                      {
                        id: 'edit',
                        label: t('myWork.focus.actions.edit', 'Edytuj'),
                        icon: Edit2,
                        onClick: () => onOpenFull(item),
                      },
                      {
                        id: 'archive',
                        label: t('myWork.focus.actions.archive', 'Archiwizuj'),
                        icon: Archive,
                        disabled: true,
                        description: comingSoon,
                        onClick: () => {},
                      },
                      // 4 — Delay slot present only when the item has a due date (§9.2).
                      ...(item.dueDate
                        ? [
                            {
                              id: 'delay',
                              label: t('myWork.focus.actions.delay', 'Przesuń termin'),
                              icon: Clock,
                              disabled: true,
                              description: comingSoon,
                              onClick: () => {},
                            },
                          ]
                        : []),
                    ],
                  },
                  // DANGER
                  {
                    id: 'danger',
                    kind: 'danger',
                    actions: [
                      {
                        id: 'remove',
                        label: t('myWork.focus.actions.remove', 'Remove from focus'),
                        icon: X,
                        onClick: () => onRemove(item),
                        variant: 'danger',
                      },
                    ],
                  },
                ];
                return sections;
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
  return (
    // Canon §8.2 — neutral surface; no colored border-l accent (parity with the card).
    <div className="bg-c-surface rounded-xl border border-c-border-strong shadow-hig-lg p-3 w-[300px] ring-1 ring-c-border-strong">
      <div className="flex items-center gap-3">
        {item.type === 'decision' ? (
          <Zap size={20} className="text-blue-500" />
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-c-border-strong" />
        )}
        <div className="flex-1 min-w-0">
          <ChipBase
            size="sm"
            leading={
              <ChipDot
                colorVar={item.type === 'decision' ? CHIP_TONE_VAR.info : undefined}
                size="sm"
              />
            }
          >
            {item.type === 'decision' ? 'Decision' : 'Task'}
          </ChipBase>
          <h4 className="text-sm font-semibold text-c-text truncate mt-1">{item.title}</h4>
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
  onSelect: (item: FocusItem) => void;
  onOpenFull: (item: FocusItem) => void;
}

const FocusColumnComponent: React.FC<FocusColumnProps> = ({
  column,
  items,
  selectedItemId,
  onComplete,
  onSnooze,
  onDelegate,
  onRemove,
  onSelect,
  onOpenFull,
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
          <span className={config.color}>{renderIconNode(config.icon, { size: 16 })}</span>
          <h3 className={`font-semibold ${config.color}`}>{t(config.titleKey, config.title)}</h3>
          <span className="text-xs text-c-text-muted">
            {completedCount}/{items.length}
          </span>
        </div>
        {items.length > 0 && (
          <div className="w-16 h-1.5 bg-c-border-subtle rounded-full overflow-hidden">
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
                onSelect={onSelect}
                onOpenFull={onOpenFull}
              />
            ))}
          </AnimatePresence>
        </SortableContext>

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className={`p-3 rounded-full ${config.bgColor} mb-2`}>
              {renderIconNode(config.icon, { size: 16 })}
            </div>
            <p className="text-sm text-c-text-muted">{t('myWork.focus.emptyColumn', 'No items')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// DELEGATE MODAL
// ============================================================================

interface DelegationSuggestion {
  userId: string;
  name: string;
  email?: string;
  openTasks: number;
  score: number;
  reasons: string[];
}

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
  const [aiSuggestions, setAiSuggestions] = useState<DelegationSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setLoading(true);
      setAiLoading(true);

      const parsed = item.id.split(':');
      const taskId = parsed[0] === 'task' ? parsed[1] : '';

      Promise.all([
        Api.get('/users')
          .then((res) => {
            const userList = Array.isArray(res) ? res : res.users || [];
            setUsers(userList.slice(0, 10));
          })
          .catch(console.error),
        Api.get(`/my-work/delegation-suggestions${taskId ? `?taskId=${taskId}` : ''}`)
          .then((res: any) => setAiSuggestions(res?.suggestions || []))
          .catch(() => setAiSuggestions([])),
      ]).finally(() => {
        setLoading(false);
        setAiLoading(false);
      });
    }
  }, [item]);

  if (!item) return null;

  const suggestedIds = new Set(aiSuggestions.map((s) => s.userId));

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
        className="bg-c-surface rounded-xl shadow-hig-lg border border-slate-200/60 dark:border-white/[0.03] w-full max-w-md mx-4"
      >
        <div className="p-6">
          <h3 className="text-lg font-bold text-c-text mb-2">
            {t('myWork.focus.delegateTitle', 'Delegate Task')}
          </h3>
          <p className="text-sm text-c-text-muted mb-4">{item.title}</p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-c-text-muted" size={24} />
            </div>
          ) : (
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {/* AI Suggestions Section */}
              {(aiSuggestions.length > 0 || aiLoading) && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles size={12} className="text-c-info" />
                    <span className="text-[11px] font-semibold text-c-info dark:text-c-info uppercase tracking-wider">
                      {t('myWork.focus.delegate.aiSuggestions', 'AI Suggestions')}
                    </span>
                  </div>
                  {aiLoading ? (
                    <div className="flex items-center gap-2 text-xs text-c-text-secondary py-2">
                      <Loader2 size={12} className="animate-spin" />
                      {t('myWork.focus.delegate.analyzing', 'Analyzing team...')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {aiSuggestions.map((sug) => (
                        <button
                          key={sug.userId}
                          onClick={() => setSelectedUserId(sug.userId)}
                          className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                            selectedUserId === sug.userId
                              ? 'border-c-border-strong bg-c-surface-raised'
                              : 'border-c-border-subtle bg-c-surface hover:border-c-border'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-c-info to-c-info flex items-center justify-center shrink-0">
                            <span className="text-xs font-medium text-white">
                              {(sug.name || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-c-text truncate">
                                {sug.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-c-info/15 text-c-info font-medium shrink-0">
                                {sug.score}%
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {sug.reasons.map((r, ri) => (
                                <span key={ri} className="text-[10px] text-c-text-muted">
                                  {ri > 0 && '·'} {r}
                                </span>
                              ))}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* All Team Members */}
              {users.filter((u) => !suggestedIds.has(u.id)).length > 0 && (
                <div>
                  {aiSuggestions.length > 0 && (
                    <span className="text-[11px] font-semibold text-c-text-secondary uppercase tracking-wider">
                      {t('myWork.focus.delegate.allMembers', 'All Team Members')}
                    </span>
                  )}
                  <div className="space-y-2 mt-2">
                    {users
                      .filter((u) => !suggestedIds.has(u.id))
                      .map((user) => (
                        <button
                          key={user.id}
                          onClick={() => setSelectedUserId(user.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                            selectedUserId === user.id
                              ? 'border-c-border-strong bg-c-surface-raised'
                              : 'border-c-border-subtle hover:border-c-border'
                          }`}
                        >
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.name}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-c-info to-c-info flex items-center justify-center">
                              <span className="text-xs font-medium text-white">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="text-sm font-medium text-c-text">{user.name}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-c-border-subtle">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised transition-colors"
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
            className="px-4 py-2 rounded-lg text-sm font-medium bg-c-text text-c-surface hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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

export const FocusView: React.FC<FocusViewProps> = ({
  onItemClick,
  onNavigateToInbox,
  refreshTrigger,
  controls,
}) => {
  const { t } = useTranslation();
  const currentUser = useAppStore((state) => state.currentUser);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FocusItem[]>([]);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [delegateItem, setDelegateItem] = useState<FocusItem | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [internalShowAIPlan, setInternalShowAIPlan] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [focusRules, setFocusRules] = useState<FocusRules>({
    maxToday: 5,
    maxWeek: 15,
    capacityAware: true,
  });
  const [workloadSummary, setWorkloadSummary] = useState<{
    total: number;
    overdue: number;
    atRisk: number;
  } | null>(null);
  const [activeTemplate, setActiveTemplate] =
    useState<keyof typeof FOCUS_RULE_TEMPLATES>(loadFocusTemplateKey);
  const [rulesSaving, setRulesSaving] = useState(false);

  // Filters
  const [internalFilter, setInternalFilter] = useState<FocusFilter>('all');
  const [internalHideCompleted, setInternalHideCompleted] = useState(false);
  const [internalSort, setInternalSort] = useState<FocusSort>('manual');

  const filter = controls?.filter ?? internalFilter;
  const setFilter = controls?.onFilterChange ?? setInternalFilter;
  const hideCompleted = controls?.hideCompleted ?? internalHideCompleted;
  const setHideCompleted = controls?.onHideCompletedChange ?? setInternalHideCompleted;
  const sort = controls?.sort ?? internalSort;
  const setSort = controls?.onSortChange ?? setInternalSort;
  const showAIPlan = controls?.showAIPlan ?? internalShowAIPlan;
  const setShowAIPlan = controls?.onShowAIPlanChange ?? setInternalShowAIPlan;

  const selectedItem = useMemo(
    () => (selectedItemId ? items.find((i) => i.id === selectedItemId) || null : null),
    [selectedItemId, items]
  );

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
      const [tasksRes, decisionsRes, focusStateRes, rulesRes, workloadRes] = await Promise.all([
        Api.get('/my-work/tasks?limit=200').catch(() => ({ tasks: [] })),
        Api.get('/my-work/decisions?limit=120').catch(() => ({ decisions: [] })),
        Api.get('/my-work/focus/state').catch(() => ({ items: [] })),
        Api.getFocusRules().catch(() => ({ maxToday: 5, maxWeek: 15, capacityAware: true })),
        Api.get('/tasks/my-workload').catch(() => ({ total: 0, overdue: 0, atRisk: 0 })),
      ]);
      setFocusRules(rulesRes);
      setWorkloadSummary({
        total: Number((workloadRes as any)?.total || 0),
        overdue: Number((workloadRes as any)?.overdue || 0),
        atRisk: Number((workloadRes as any)?.atRisk || 0),
      });

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
        const forceOverdue =
          decision.isOverdue || (decision.dueDate && new Date(decision.dueDate) < tomorrowStart);
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
          const remainder = pool
            .filter((i) => !taken.has(i.id))
            .slice(0, needed - candidates.length);
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
      if (byCol.today.length > focusRules.maxToday) {
        const overflow = byCol.today.splice(focusRules.maxToday);
        byCol.thisWeek.unshift(...overflow.map((it) => ({ ...it, column: 'thisWeek' as const })));
      }

      if (focusRules.capacityAware) {
        const activeWeekItems = byCol.thisWeek.filter((i) => !i.isCompleted);
        if (
          activeWeekItems.length + byCol.today.filter((i) => !i.isCompleted).length >
          focusRules.maxWeek
        ) {
          const allowedWeek = Math.max(
            0,
            focusRules.maxWeek - byCol.today.filter((i) => !i.isCompleted).length
          );
          const overflow = activeWeekItems.slice(allowedWeek);
          const overflowIds = new Set(overflow.map((item) => item.id));
          byCol.thisWeek = byCol.thisWeek.filter((item) => !overflowIds.has(item.id));
          byCol.later.unshift(...overflow.map((item) => ({ ...item, column: 'later' as const })));
        }
      }

      const allItems = [
        ...byCol.today.slice(0, MAX_PER_COLUMN),
        ...byCol.thisWeek.slice(0, MAX_PER_COLUMN),
        ...byCol.later.slice(0, MAX_PER_COLUMN),
      ];

      setItems(allItems);
    } catch (error) {
      console.error('Failed to load focus data:', error);
      toast.error(t('myWork.focus.loadError', 'Failed to load focus items'));
    } finally {
      setLoading(false);
    }
  }, [focusRules.capacityAware, focusRules.maxToday, focusRules.maxWeek, t]);

  const persistFocusRules = useCallback(
    async (nextRules: FocusRules, templateKey?: keyof typeof FOCUS_RULE_TEMPLATES) => {
      try {
        setRulesSaving(true);
        setFocusRules(nextRules);
        await Api.updateFocusRules(nextRules);
        if (templateKey) {
          setActiveTemplate(templateKey);
          localStorage.setItem(FOCUS_TEMPLATE_STORAGE_KEY, templateKey);
        }
        toast.success(t('myWork.focus.rulesSaved', 'Focus rules updated'));
        loadFocus();
      } catch (error) {
        console.error('Failed to persist focus rules:', error);
        toast.error(t('myWork.focus.error', 'Failed to update'));
      } finally {
        setRulesSaving(false);
      }
    },
    [loadFocus, t]
  );

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
      thisWeek: filtered.filter((i) => i.column === 'thisWeek' && !todayIds.has(i.id)).sort(sortFn),
      later: filtered.filter((i) => i.column === 'later' && !todayIds.has(i.id)).sort(sortFn),
    };
  }, [items, filter, hideCompleted, sort]);

  const activeCounts = useMemo(
    () => ({
      today: itemsByColumn.today.filter((item) => !item.isCompleted).length,
      thisWeek: itemsByColumn.thisWeek.filter((item) => !item.isCompleted).length,
      later: itemsByColumn.later.filter((item) => !item.isCompleted).length,
    }),
    [itemsByColumn]
  );

  const canMoveToColumn = useCallback(
    (targetColumn: FocusColumn, movingItemId?: string) => {
      const todayCount = itemsByColumn.today.filter(
        (item) => !item.isCompleted && item.id !== movingItemId
      ).length;
      const thisWeekTotal =
        itemsByColumn.today.filter((item) => !item.isCompleted && item.id !== movingItemId).length +
        itemsByColumn.thisWeek.filter((item) => !item.isCompleted && item.id !== movingItemId)
          .length;

      if (targetColumn === 'today' && todayCount >= focusRules.maxToday) {
        toast.error(
          t(
            'myWork.focus.limitToday',
            'Today limit reached. Adjust focus rules or move something out.'
          )
        );
        return false;
      }

      if (
        focusRules.capacityAware &&
        (targetColumn === 'today' || targetColumn === 'thisWeek') &&
        thisWeekTotal >= focusRules.maxWeek
      ) {
        toast.error(
          t(
            'myWork.focus.limitWeek',
            'This week capacity is full. Move items to Later or increase the weekly limit.'
          )
        );
        return false;
      }

      return true;
    },
    [focusRules.capacityAware, focusRules.maxToday, focusRules.maxWeek, itemsByColumn, t]
  );

  // Flat list for keyboard navigation
  const flatItems = useMemo(
    () => [...itemsByColumn.today, ...itemsByColumn.thisWeek, ...itemsByColumn.later],
    [itemsByColumn]
  );

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
          if (flatItems[nextIdx]) {
            setSelectedItemId(flatItems[nextIdx].id);
            setPreviewOpen(true);
          }
          break;
        }
        case 'k': {
          e.preventDefault();
          const prevIdx = Math.max(currentIdx - 1, 0);
          if (flatItems[prevIdx]) {
            setSelectedItemId(flatItems[prevIdx].id);
            setPreviewOpen(true);
          }
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
          setPreviewOpen(false);
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
      if (!canMoveToColumn(targetCol, activeItem.id)) {
        loadFocus();
        return;
      }
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
    if (!canMoveToColumn(targetColumn, item.id)) return;

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

  const activeItem = activeId ? findItemById(activeId) : null;

  if (loading) {
    return <LoadingState variant="spinner" className="p-12" />;
  }

  return (
    <div className="p-4 h-full min-h-0">
      <div className="mb-4 grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                {t('myWork.focus.rules', 'Focus rules')}
              </div>
              <div className="mt-1 text-sm font-semibold text-c-text">
                {t('myWork.focus.owner', 'Planner')}{' '}
                {currentUser?.firstName || currentUser?.email || ''}
              </div>
              <div className="mt-1 text-xs text-c-text-muted">
                {activeCounts.today}/{focusRules.maxToday}{' '}
                {t('myWork.focus.columns.today', 'Today')} ·{' '}
                {activeCounts.today + activeCounts.thisWeek}/{focusRules.maxWeek}{' '}
                {t('myWork.focus.columns.thisWeek', 'This Week')}
              </div>
            </div>
            {rulesSaving ? (
              <Loader2 size={16} className="animate-spin text-brand" />
            ) : (
              <Target size={16} className="text-brand" />
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(FOCUS_RULE_TEMPLATES) as (keyof typeof FOCUS_RULE_TEMPLATES)[]).map(
              (key) => {
                const template = FOCUS_RULE_TEMPLATES[key];
                const active = activeTemplate === key;
                return (
                  <button
                    key={key}
                    onClick={() =>
                      persistFocusRules(
                        {
                          maxToday: template.maxToday,
                          maxWeek: template.maxWeek,
                          capacityAware: template.capacityAware,
                        },
                        key
                      )
                    }
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'border-c-border-strong bg-c-surface-raised text-[var(--c-info)]'
                        : 'border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised'
                    }`}
                  >
                    <Sparkles size={12} />
                    {template.label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
            {t('myWork.focus.capacity', 'Capacity summary')}
          </div>
          <div className="mt-2 flex items-center gap-4">
            <div>
              <div className="text-lg font-semibold text-c-text">{workloadSummary?.total ?? 0}</div>
              <div className="text-xs text-c-text-muted">
                {t('myWork.focus.openItems', 'Open items')}
              </div>
            </div>
            <div>
              <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                {workloadSummary?.atRisk ?? 0}
              </div>
              <div className="text-xs text-c-text-muted">{t('myWork.focus.atRisk', 'At risk')}</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-danger-600 dark:text-danger-400">
                {workloadSummary?.overdue ?? 0}
              </div>
              <div className="text-xs text-c-text-muted">
                {t('myWork.focus.overdue', 'Overdue')}
              </div>
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-c-text-secondary">
            <input
              type="checkbox"
              checked={focusRules.capacityAware}
              onChange={(e) =>
                persistFocusRules(
                  { ...focusRules, capacityAware: e.target.checked },
                  activeTemplate
                )
              }
            />
            {t('myWork.focus.capacityAware', 'Keep week capacity-aware')}
          </label>
        </div>

        <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
            {t('myWork.focus.limits', 'Limits')}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs text-c-text-secondary">
              {t('myWork.focus.maxToday', 'Max today')}
              <input
                type="number"
                min={1}
                max={20}
                value={focusRules.maxToday}
                onChange={(e) =>
                  setFocusRules((prev) => ({
                    ...prev,
                    maxToday: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                  }))
                }
                onBlur={() => persistFocusRules(focusRules, activeTemplate)}
                className="mt-1 w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text px-3 py-2"
              />
            </label>
            <label className="text-xs text-c-text-secondary">
              {t('myWork.focus.maxWeek', 'Max this week')}
              <input
                type="number"
                min={1}
                max={50}
                value={focusRules.maxWeek}
                onChange={(e) =>
                  setFocusRules((prev) => ({
                    ...prev,
                    maxWeek: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                  }))
                }
                onBlur={() => persistFocusRules(focusRules, activeTemplate)}
                className="mt-1 w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text px-3 py-2"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Kanban Board + Right panel (KANON v3: no extra toolbars in content) */}
      {items.length > 0 ? (
        <div className="flex gap-3 min-h-0 h-full">
          <div className="flex-1 min-w-0">
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
                    onSelect={(item) => {
                      setSelectedItemId(item.id);
                      setPreviewOpen(true);
                    }}
                    onOpenFull={(item) => {
                      onItemClick?.(item);
                    }}
                  />
                ))}
              </div>

              <DragOverlay>{activeItem && <FocusCardOverlay item={activeItem} />}</DragOverlay>
            </DndContext>
          </div>

          {showAIPlan ? (
            <div
              data-preview-pane
              className="shrink-0 bg-c-bg p-3"
              style={{ width: PREVIEW_PANE_WIDTH }}
            >
              <PreviewPaneShell
                title={t('myWork.focus.aiPlan', 'AI Plan')}
                onClose={() => setShowAIPlan(false)}
              >
                <AIPlanView embedded onClose={() => setShowAIPlan(false)} />
              </PreviewPaneShell>
            </div>
          ) : previewOpen && selectedItem ? (
            <div
              data-preview-pane
              className="shrink-0 bg-c-bg p-3"
              style={{ width: PREVIEW_PANE_WIDTH }}
            >
              <PreviewPaneShell
                title={selectedItem.title}
                onClose={() => {
                  setPreviewOpen(false);
                  setSelectedItemId(null);
                }}
                actions={
                  <button
                    onClick={() => onItemClick?.(selectedItem)}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-transparent text-c-text-secondary hover:bg-c-surface-raised transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 text-xs font-medium"
                    title={t('common.open', 'Open')}
                  >
                    <ArrowRight size={14} />
                    <span>{t('common.open', 'Open')}</span>
                  </button>
                }
                footer={
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleComplete(selectedItem)}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-green-300/40 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-200 hover:bg-green-100/70 dark:hover:bg-green-500/15 transition-colors text-xs font-medium"
                    >
                      <Check size={14} />
                      {selectedItem.type === 'decision'
                        ? t('myWork.focus.card.approve', 'Approve')
                        : t('myWork.focus.actions.done', 'Done')}
                    </button>
                    <button
                      onClick={() => {
                        const next: Record<FocusColumn, FocusColumn> = {
                          today: 'thisWeek',
                          thisWeek: 'later',
                          later: 'later',
                        };
                        if (selectedItem.column !== 'later')
                          handleSnooze(selectedItem, next[selectedItem.column]);
                      }}
                      disabled={selectedItem.column === 'later'}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text-secondary hover:bg-c-surface-raised transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                      title={t('myWork.focus.actions.snooze', 'Snooze')}
                    >
                      <Clock size={14} />
                      {t('myWork.focus.actions.snooze', 'Snooze')}
                    </button>
                    <button
                      onClick={() => setDelegateItem(selectedItem)}
                      disabled={selectedItem.type !== 'task'}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text-secondary hover:bg-c-surface-raised transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                      title={t('myWork.focus.actions.delegate', 'Delegate')}
                    >
                      <UserPlus size={14} />
                      {t('myWork.focus.actions.delegate', 'Delegate')}
                    </button>
                    <button
                      onClick={() => handleRemoveFromFocus(selectedItem)}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-danger-300/40 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 text-danger-700 dark:text-danger-200 hover:bg-danger-100/70 dark:hover:bg-danger-500/15 transition-colors text-xs font-medium"
                      title={t('myWork.focus.actions.remove', 'Remove from focus')}
                    >
                      <X size={14} />
                      {t('myWork.focus.actions.remove', 'Remove from focus')}
                    </button>
                  </div>
                }
              >
                <div className="space-y-4">
                  <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          selectedItem.type === 'decision'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {selectedItem.type === 'decision'
                          ? t('myWork.focus.decision', 'Decision')
                          : t('myWork.focus.task', 'Task')}
                      </span>
                      {selectedItem.priority ? (
                        <span className="text-[11px] font-semibold text-c-text-secondary">
                          {selectedItem.priority}
                        </span>
                      ) : null}
                      {selectedItem.dueDate ? (
                        <div className="flex items-center gap-2">
                          <DueDateIndicator
                            dueDate={selectedItem.dueDate}
                            dueTime={selectedItem.dueTime}
                            isCompleted={selectedItem.isCompleted}
                            size="sm"
                          />
                        </div>
                      ) : (
                        <span className="text-[11px] font-medium text-c-text-muted italic">
                          {t('myWork.focus.noDue', 'No due date')}
                        </span>
                      )}
                    </div>
                    {selectedItem.initiativeName ? (
                      <div className="mt-2 text-xs text-c-text-secondary truncate">
                        {selectedItem.initiativeName}
                      </div>
                    ) : null}
                  </div>

                  {selectedItem.description ? (
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">
                        {t('common.details', 'Details')}
                      </div>
                      <div className="text-sm text-c-text-secondary leading-relaxed whitespace-pre-wrap">
                        {selectedItem.description}
                      </div>
                    </div>
                  ) : null}
                </div>
              </PreviewPaneShell>
            </div>
          ) : null}
        </div>
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-c-text text-c-surface font-medium hover:opacity-90 transition-opacity"
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
