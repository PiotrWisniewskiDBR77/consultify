/**
 * DecisionsKanbanBoard - Kanban board view for decisions grouped by status pipeline
 * Card colors depend on decision priority
 * Full drag-and-drop: reorder within columns + move between columns
 *
 * Status pipeline columns: Pending → Escalated → Approved / Rejected / Deferred
 */

import {
  closestCenter,
  type CollisionDetection,
  defaultDropAnimationSideEffects,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  type DropAnimation,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  type UniqueIdentifier,
  useDroppable,
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
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Flag,
  GripVertical,
  Loader2,
  Plus,
  Scale,
  TrendingUp,
  User,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

/* ─── Decision type ─── */

interface Decision {
  id: string;
  title: string;
  description?: string;
  decisionType?: string;
  type?: string;
  status: string;
  decisionOwnerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerRole?: string;
  requestedById?: string;
  requestedByName?: string;
  projectId?: string;
  projectName?: string;
  priority?: string;
  createdAt: string;
  dueDate?: string;
  deadline?: string;
  daysWaiting?: number;
  daysUntilDue?: number;
  isOverdue?: boolean;
  daysOverdue?: number;
  answer?: 'APPROVED' | 'REJECTED' | 'DEFERRED';
  decidedAt?: string;
  decidedByName?: string;
  rationale?: string;
  escalatedAt?: string;
  lastReminderAt?: string;
  reminderCount?: number;
}

type DecisionFilter = 'all' | 'my' | 'awaiting';
type DecisionPriorityFilter = 'all' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface DecisionCounts {
  total: number;
  my: number;
  awaiting: number;
}

interface DecisionsKanbanBoardProps {
  viewMode: DecisionFilter;
  priorityFilter?: DecisionPriorityFilter;
  searchQuery: string;
  onDecisionClick?: (id: string, decisionData?: Decision) => void;
  onCreateDecision?: () => void;
  onCountsChange: (counts: DecisionCounts) => void;
  refreshTrigger?: number;
}

/* ─── Status columns config (pipeline) ─── */

interface KanbanColumnDef {
  id: string;
  label: string;
  statuses: string[];
  apiStatus: string;
  icon: React.ReactNode;
  headerColor: string;
  dotColor: string;
  dropHighlight: string;
}

const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: 'pending',
    label: 'Pending',
    statuses: ['pending'],
    apiStatus: 'PENDING',
    icon: <Clock size={14} />,
    headerColor: 'text-blue-400',
    dotColor: 'bg-blue-500',
    dropHighlight: 'ring-blue-500/40 bg-blue-500/5',
  },
  {
    id: 'escalated',
    label: 'Escalated',
    statuses: ['escalated'],
    apiStatus: 'ESCALATED',
    icon: <TrendingUp size={14} />,
    headerColor: 'text-amber-400',
    dotColor: 'bg-amber-500',
    dropHighlight: 'ring-amber-500/40 bg-amber-500/5',
  },
  {
    id: 'approved',
    label: 'Approved',
    statuses: ['approved'],
    apiStatus: 'APPROVED',
    icon: <CheckCircle2 size={14} />,
    headerColor: 'text-emerald-400',
    dotColor: 'bg-emerald-500',
    dropHighlight: 'ring-emerald-500/40 bg-emerald-500/5',
  },
  {
    id: 'rejected',
    label: 'Rejected',
    statuses: ['rejected'],
    apiStatus: 'REJECTED',
    icon: <X size={14} />,
    headerColor: 'text-danger-400',
    dotColor: 'bg-danger-500',
    dropHighlight: 'ring-danger-500/40 bg-danger-500/5',
  },
  {
    id: 'deferred',
    label: 'Deferred',
    statuses: ['deferred'],
    apiStatus: 'DEFERRED',
    icon: <AlertTriangle size={14} />,
    headerColor: 'text-amber-400',
    dotColor: 'bg-amber-500',
    dropHighlight: 'ring-amber-500/40 bg-amber-500/5',
  },
];

const COLUMN_IDS = KANBAN_COLUMNS.map((c) => c.id);

/** Determine which column a decision belongs to based on its status */
const getColumnForStatus = (status?: string): string => {
  const s = status?.toLowerCase() || 'pending';
  for (const col of KANBAN_COLUMNS) {
    if (col.statuses.includes(s)) return col.id;
  }
  return 'pending';
};

/* ─── Priority → card styles ─── */

const getPriorityCardStyle = (priority?: string) => {
  switch (priority?.toUpperCase()) {
    case 'CRITICAL':
      return {
        border: 'border-l-4 border-l-danger-500',
        bg: 'bg-danger-500/5 dark:bg-danger-500/10',
        badge: 'bg-danger-500/15 text-danger-400 border border-danger-500/20',
        label: 'Critical',
        dot: 'bg-danger-500',
        icon: Zap,
      };
    case 'HIGH':
      return {
        border: 'border-l-4 border-l-amber-500',
        bg: 'bg-amber-500/5 dark:bg-amber-500/10',
        badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
        label: 'High',
        dot: 'bg-amber-500',
        icon: Flag,
      };
    case 'MEDIUM':
      return {
        border: 'border-l-4 border-l-amber-500',
        bg: 'bg-amber-500/5 dark:bg-amber-500/10',
        badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
        label: 'Medium',
        dot: 'bg-amber-500',
        icon: Flag,
      };
    case 'LOW':
      return {
        border: 'border-l-4 border-l-slate-400',
        bg: 'bg-slate-500/5 dark:bg-slate-500/10',
        badge: 'bg-slate-500/15 text-slate-500 dark:text-slate-400 border border-slate-500/20',
        label: 'Low',
        dot: 'bg-slate-400',
        icon: Flag,
      };
    default:
      return {
        border: 'border-l-4 border-l-slate-300',
        bg: 'bg-slate-500/5 dark:bg-slate-500/10',
        badge: 'bg-slate-500/15 text-slate-500 dark:text-slate-400 border border-slate-500/20',
        label: 'Normal',
        dot: 'bg-slate-400',
        icon: Flag,
      };
  }
};

/* ─── Date helpers ─── */

const formatDueDate = (dateStr?: string): string | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  if (dateOnly.getTime() === today.getTime()) return 'Today';
  if (dateOnly.getTime() === tomorrow.getTime()) return 'Tomorrow';

  const diffDays = Math.ceil((dateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === -1) return 'Yesterday';
  if (diffDays <= 7) return `${diffDays}d left`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const isOverdue = (dateStr?: string, status?: string): boolean => {
  if (!dateStr) return false;
  if (status?.toUpperCase() !== 'PENDING') return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const getDaysWaiting = (createdAt: string): number => {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
};

/* ═══════════════════════════════════════════════════════════════
 *  Card content (shared between sortable card and drag overlay)
 * ═══════════════════════════════════════════════════════════════ */

const KanbanCardContent: React.FC<{
  decision: Decision;
  isDragging?: boolean;
  isOverlay?: boolean;
}> = ({ decision, isDragging, isOverlay }) => {
  const priorityStyle = getPriorityCardStyle(decision.priority);
  const dueDate = decision.dueDate || decision.deadline;
  const overdue = isOverdue(dueDate, decision.status);
  const dueLabel = formatDueDate(dueDate);
  const daysWaiting = getDaysWaiting(decision.createdAt);
  const PriorityIcon = priorityStyle.icon;

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      className={`
        rounded-lg p-3 select-none
        ${priorityStyle.border} ${priorityStyle.bg}
        border border-c-border-subtle
        ${isDragging ? 'opacity-30 scale-[0.98]' : ''}
        ${isOverlay ? 'shadow-hig-lg rotate-[3deg] scale-105 ring-1 ring-c-border-strong' : ''}
        transition-all duration-150
      `}
    >
      <div className="flex items-start gap-1.5">
        <div className="mt-0.5 text-c-text-muted group-hover:text-c-text-secondary transition-colors cursor-grab active:cursor-grabbing flex-shrink-0">
          <GripVertical size={14} />
        </div>
        <h4 className="text-sm font-medium text-c-text mb-1 line-clamp-2 leading-snug flex-1">
          {decision.title || 'Untitled decision'}
        </h4>
      </div>

      {decision.description && (
        <p className="text-xs text-c-text-muted mb-2 line-clamp-2 leading-relaxed pl-5">
          {decision.description}
        </p>
      )}

      <div className="flex items-center gap-1.5 mb-2 flex-wrap pl-5">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${priorityStyle.badge}`}
        >
          <PriorityIcon size={10} />
          {priorityStyle.label}
        </span>
        {(decision.decisionType || decision.type) && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-c-surface-raised text-c-text-secondary border border-c-border-subtle">
            <Scale size={10} />
            {decision.decisionType || decision.type}
          </span>
        )}
        {decision.projectName && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-c-surface-raised text-c-text-secondary border border-c-border-subtle truncate max-w-[120px]">
            {decision.projectName}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pl-5">
        {dueLabel ? (
          <span
            className={`flex items-center gap-1 text-[11px] font-medium ${
              overdue ? 'text-danger-400' : 'text-c-text-muted'
            }`}
          >
            <Calendar size={11} />
            {dueLabel}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-c-text-muted">
            <Clock size={11} />
            {daysWaiting}d waiting
          </span>
        )}
        {decision.ownerName ? (
          <div className="flex items-center gap-1.5" title={decision.ownerName}>
            <div className="w-5 h-5 rounded-full bg-c-surface-raised text-c-text-secondary flex items-center justify-center text-[10px] font-bold ring-1 ring-c-border-subtle">
              {getInitials(decision.ownerName)}
            </div>
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-c-surface-raised flex items-center justify-center">
            <User size={10} className="text-c-text-muted" />
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
 *  Sortable Card wrapper
 * ═══════════════════════════════════════════════════════════════ */

const SortableKanbanCard: React.FC<{
  decision: Decision;
  onClick?: (id: string, decisionData?: Decision) => void;
}> = ({ decision, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: decision.id,
    data: { type: 'decision', decision },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group cursor-grab active:cursor-grabbing touch-none"
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onClick?.(decision.id, decision);
        }
      }}
    >
      <KanbanCardContent decision={decision} isDragging={isDragging} />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
 *  Droppable Column
 * ═══════════════════════════════════════════════════════════════ */

const DroppableColumn: React.FC<{
  column: KanbanColumnDef;
  itemIds: string[];
  children: React.ReactNode;
  onCreateDecision?: () => void;
}> = ({ column, itemIds, children, onCreateDecision }) => {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
  });

  return (
    <div
      className={`w-72 flex-shrink-0 flex flex-col rounded-xl border transition-all duration-200 ${
        isOver
          ? `ring-2 ${column.dropHighlight} border-transparent scale-[1.01]`
          : 'bg-c-surface border-c-border-subtle'
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-c-border-subtle">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${column.dotColor}`} />
          <span className={`text-sm font-semibold ${column.headerColor}`}>{column.label}</span>
          <span className="ml-1 text-xs font-medium text-c-text-muted bg-c-surface-raised rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
            {itemIds.length}
          </span>
        </div>
        {column.id === 'pending' && onCreateDecision && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateDecision();
            }}
            className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors"
            title={t('myWork.decisions.addDecision', 'Add decision')}
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Droppable card area */}
      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[300px]">
        {children}

        {/* Drop indicator */}
        {isOver && (
          <div
            className={`w-full rounded-lg border-2 border-dashed flex items-center justify-center transition-all duration-200 ${
              itemIds.length === 0 ? 'h-24' : 'h-14'
            } ${column.headerColor} opacity-40`}
          >
            <span className={`text-xs font-medium ${column.headerColor}`}>
              {t('execution.kanban.dropHere', 'Drop here')}
            </span>
          </div>
        )}

        {/* Empty state */}
        {itemIds.length === 0 && !isOver && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className={`mb-2 ${column.headerColor} opacity-30`}>{column.icon}</div>
            <p className="text-xs text-c-text-muted">
              {t('myWork.decisions.emptyColumn', 'No decisions')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
 *  Collision detection — kanban-optimized
 * ═══════════════════════════════════════════════════════════════ */

const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    const columnHits = pointerCollisions.filter(
      (c) => c.data?.droppableContainer?.data?.current?.type === 'column'
    );
    const itemHits = pointerCollisions.filter(
      (c) => c.data?.droppableContainer?.data?.current?.type === 'decision'
    );
    if (itemHits.length > 0) return [...itemHits, ...columnHits];
    if (columnHits.length > 0) return columnHits;
    return pointerCollisions;
  }

  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) return rectCollisions;

  return closestCenter(args);
};

/* ═══════════════════════════════════════════════════════════════
 *  Drop animation
 * ═══════════════════════════════════════════════════════════════ */

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.5' } },
  }),
};

/* ═══════════════════════════════════════════════════════════════
 *  Helpers
 * ═══════════════════════════════════════════════════════════════ */

type ContainerItems = Record<string, string[]>;

/** Build containerItems from a decision list */
const buildContainerItems = (decisionList: Decision[]): ContainerItems => {
  const priorityOrder: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };

  const items: ContainerItems = {};
  for (const col of KANBAN_COLUMNS) {
    const colDecisions = decisionList
      .filter((d) => col.statuses.includes(d.status?.toLowerCase() || 'pending'))
      .sort((a, b) => {
        const ap = priorityOrder[a.priority?.toUpperCase() || 'MEDIUM'] ?? 2;
        const bp = priorityOrder[b.priority?.toUpperCase() || 'MEDIUM'] ?? 2;
        if (ap !== bp) return ap - bp;
        const ad = a.dueDate || a.deadline;
        const bd = b.dueDate || b.deadline;
        if (ad && bd) return new Date(ad).getTime() - new Date(bd).getTime();
        return 0;
      });
    items[col.id] = colDecisions.map((d) => d.id);
  }
  return items;
};

/** Find which container an item lives in */
const findContainer = (containers: ContainerItems, id: UniqueIdentifier): string | undefined => {
  if (id in containers) return id as string;
  for (const [colId, ids] of Object.entries(containers)) {
    if (ids.includes(id as string)) return colId;
  }
  return undefined;
};

/* ═══════════════════════════════════════════════════════════════
 *  Main Component
 * ═══════════════════════════════════════════════════════════════ */

export const DecisionsKanbanBoard: React.FC<DecisionsKanbanBoardProps> = ({
  viewMode,
  priorityFilter = 'all',
  searchQuery,
  onDecisionClick,
  onCreateDecision,
  onCountsChange,
  refreshTrigger,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAppStore();

  // Raw decision data from API
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  // DnD state
  const [activeDecision, setActiveDecision] = useState<Decision | null>(null);
  const [containerItems, setContainerItems] = useState<ContainerItems>({});
  const dragStartColumn = useRef<string | null>(null);

  // Decision map for O(1) lookup
  const decisionMap = useMemo(() => {
    const map = new Map<string, Decision>();
    decisions.forEach((d) => map.set(d.id, d));
    return map;
  }, [decisions]);

  // Sensors — 8px activation distance prevents accidental drags on click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /* ─── Data fetching ─── */

  const fetchDecisions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getDecisions();
      setDecisions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch decisions:', error);
      toast.error('Failed to load decisions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions, refreshTrigger]);

  /* ─── Filtering ─── */

  const filteredDecisions = useMemo(() => {
    let result = decisions;
    const userId = currentUser?.id;

    const isMineToDecide = (d: Decision) => Boolean(userId) && d.decisionOwnerId === userId;
    const isMyRequest = (d: Decision) =>
      Boolean(userId) && d.requestedById === userId && d.decisionOwnerId !== userId;
    const isRelevantToMe = (d: Decision) => isMineToDecide(d) || isMyRequest(d);

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.title?.toLowerCase().includes(query) || d.description?.toLowerCase().includes(query)
      );
    }

    // Filter by view mode
    if (viewMode === 'my') {
      result = result.filter(isMineToDecide);
    } else if (viewMode === 'awaiting') {
      result = result.filter(isMyRequest);
    } else {
      result = result.filter(isRelevantToMe);
    }

    // Filter by priority
    if (priorityFilter !== 'all') {
      result = result.filter(
        (d) => String(d.priority || 'MEDIUM').toUpperCase() === String(priorityFilter).toUpperCase()
      );
    }

    return result;
  }, [decisions, searchQuery, viewMode, priorityFilter, currentUser?.id]);

  // Rebuild containerItems when filtered decisions change (but NOT during an active drag)
  useEffect(() => {
    if (!activeDecision) {
      setContainerItems(buildContainerItems(filteredDecisions));
    }
  }, [filteredDecisions, activeDecision]);

  /* ─── Counts reporting ─── */

  useEffect(() => {
    const userId = currentUser?.id;
    const isOpen = (d: Decision) =>
      ['PENDING', 'ESCALATED'].includes(String(d.status || '').toUpperCase());
    const myCount = decisions.filter(
      (d) => userId && d.decisionOwnerId === userId && isOpen(d)
    ).length;
    const awaitingCount = decisions.filter(
      (d) => userId && d.requestedById === userId && d.decisionOwnerId !== userId && isOpen(d)
    ).length;
    onCountsChange({
      total: myCount + awaitingCount,
      my: myCount,
      awaiting: awaitingCount,
    });
  }, [decisions, currentUser?.id, onCountsChange]);

  /* ═══ Drag & Drop handlers ═══ */

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string;
      const decision = decisionMap.get(id) || null;
      setActiveDecision(decision);
      dragStartColumn.current = findContainer(containerItems, id) || null;
    },
    [decisionMap, containerItems]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id;

      const activeContainer = findContainer(containerItems, activeId);
      const overContainer = findContainer(containerItems, overId);

      if (!activeContainer || !overContainer) return;
      if (activeContainer === overContainer) return;

      setContainerItems((prev) => {
        const activeItems = [...prev[activeContainer]];
        const overItems = [...prev[overContainer]];

        const activeIndex = activeItems.indexOf(activeId);

        let newIndex: number;
        if (COLUMN_IDS.includes(overId as string)) {
          newIndex = overItems.length;
        } else {
          const overIndex = overItems.indexOf(overId as string);
          const isBelowOverItem =
            over &&
            active.rect.current.translated &&
            active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
          newIndex = isBelowOverItem ? overIndex + 1 : overIndex;
        }

        activeItems.splice(activeIndex, 1);
        overItems.splice(newIndex, 0, activeId);

        return {
          ...prev,
          [activeContainer]: activeItems,
          [overContainer]: overItems,
        };
      });
    },
    [containerItems]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDecision(null);

      if (!over) {
        setContainerItems(buildContainerItems(filteredDecisions));
        dragStartColumn.current = null;
        return;
      }

      const activeId = active.id as string;
      const overId = over.id;

      const activeContainer = findContainer(containerItems, activeId);
      const overContainer = findContainer(containerItems, overId);

      if (!activeContainer || !overContainer) {
        dragStartColumn.current = null;
        return;
      }

      // Same container — reorder
      if (activeContainer === overContainer) {
        const items = containerItems[activeContainer];
        const oldIndex = items.indexOf(activeId);
        const newIndex = COLUMN_IDS.includes(overId as string)
          ? items.length - 1
          : items.indexOf(overId as string);

        if (oldIndex !== newIndex && newIndex >= 0) {
          setContainerItems((prev) => ({
            ...prev,
            [activeContainer]: arrayMove(prev[activeContainer], oldIndex, newIndex),
          }));
        }
      }

      // Check if column actually changed compared to drag start
      const startCol = dragStartColumn.current;
      const endCol = findContainer(containerItems, activeId);
      dragStartColumn.current = null;

      if (startCol && endCol && startCol !== endCol) {
        const targetColDef = KANBAN_COLUMNS.find((c) => c.id === endCol);
        if (!targetColDef) return;

        const decision = decisionMap.get(activeId);
        if (!decision) return;

        const newStatus = targetColDef.apiStatus;
        const previousStatus = decision.status;

        // Optimistic update
        setDecisions((prev) =>
          prev.map((d) => (d.id === activeId ? { ...d, status: newStatus } : d))
        );

        // Persist via API
        try {
          if (newStatus === 'APPROVED' || newStatus === 'REJECTED' || newStatus === 'DEFERRED') {
            await Api.decideDecision(
              activeId,
              newStatus.toLowerCase() as 'approved' | 'rejected' | 'deferred'
            );
          } else if (newStatus === 'ESCALATED') {
            await Api.escalateDecision(activeId, 'Moved to escalated via kanban');
          } else {
            await Api.updateDecision(activeId, { status: newStatus });
          }
          toast.success(`Moved to ${targetColDef.label}`, { duration: 2000, icon: '✓' });
        } catch (error) {
          console.error('Failed to update decision status:', error);
          // Revert
          setDecisions((prev) =>
            prev.map((d) => (d.id === activeId ? { ...d, status: previousStatus } : d))
          );
          toast.error('Failed to update status');
        }
      }
    },
    [containerItems, filteredDecisions, decisionMap]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDecision(null);
    dragStartColumn.current = null;
    setContainerItems(buildContainerItems(filteredDecisions));
  }, [filteredDecisions]);

  /* ─── Render ─── */

  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg">
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 min-w-max">
            {KANBAN_COLUMNS.map((col) => (
              <div
                key={col.id}
                className="w-72 flex-shrink-0 bg-c-surface rounded-xl p-3 animate-pulse"
              >
                <div className="h-5 bg-c-surface-raised rounded w-24 mb-4" />
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-24 bg-c-surface-raised rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg">
        <div className="flex-1 p-4">
          <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-c-surface border border-c-border-subtle rounded-xl">
            <CheckCircle2 size={48} className="text-c-text-muted mb-4" />
            <h3 className="text-lg font-medium text-c-text-secondary mb-2">
              {t('myWork.decisions.emptyTitle', 'No decisions yet')}
            </h3>
            <p className="text-sm text-c-text-muted mb-4">
              {t('myWork.decisions.emptySubtitle', 'Create your first decision to get started')}
            </p>
            {onCreateDecision && (
              <button
                onClick={onCreateDecision}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-c-text text-c-surface rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus size={16} />
                {t('myWork.decisions.createCta', 'Create Decision')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg">
      <div className="flex-1 overflow-x-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={kanbanCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
          <div className="flex gap-4 min-w-max h-full">
            {KANBAN_COLUMNS.map((col) => {
              const ids = containerItems[col.id] || [];

              return (
                <DroppableColumn
                  key={col.id}
                  column={col}
                  itemIds={ids}
                  onCreateDecision={onCreateDecision}
                >
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    {ids.map((id) => {
                      const decision = decisionMap.get(id);
                      if (!decision) return null;
                      return (
                        <SortableKanbanCard
                          key={id}
                          decision={decision}
                          onClick={onDecisionClick}
                        />
                      );
                    })}
                  </SortableContext>
                </DroppableColumn>
              );
            })}
          </div>

          {/* Floating ghost card while dragging */}
          <DragOverlay dropAnimation={dropAnimation}>
            {activeDecision ? (
              <div className="w-72">
                <KanbanCardContent decision={activeDecision} isOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default DecisionsKanbanBoard;
