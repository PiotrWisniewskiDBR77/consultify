/**
 * TasksKanbanBoard - Kanban board view for tasks grouped by status
 * Card colors depend on task priority
 * Full drag-and-drop: reorder within columns + move between columns
 *
 * Uses the dnd-kit "multiple sortable containers" pattern:
 *  - containerItems: Record<columnId, taskId[]> — tracks ordering per column
 *  - onDragOver: live cross-container movement (item follows cursor between columns)
 *  - onDragEnd: persist status change via API
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
  AlertCircle,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  GripVertical,
  Plus,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { Task, TaskStatus } from '@/types';

type TaskFilter = 'all' | 'overdue' | 'today' | 'week' | 'urgent';

interface TaskCounts {
  total: number;
  overdue: number;
  today: number;
  week: number;
  urgent: number;
}

interface TasksKanbanBoardProps {
  activeFilter: TaskFilter;
  searchQuery: string;
  onTaskClick: (taskId: string, taskData?: Task) => void;
  onCreateTask: () => void;
  onCountsChange: (counts: TaskCounts) => void;
  refreshTrigger?: number;
}

/* ─── Status columns config ─── */

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
    id: 'todo',
    label: 'To Do',
    // PILNE-3 (2026-07-27): listy statusów pokrywały tylko część wartości, jakie
    // realnie siedzą w `tasks.status` (unia TaskStatus zna też backlog/review/
    // on_hold/cancelled, a baza demo ma m.in. 'archived'). Karta o statusie spoza
    // list wypadała ze WSZYSTKICH kolumn → suma kolumn < licznik „All".
    statuses: ['todo', 'pending', 'new', 'backlog', 'open', 'not_started'],
    // PILNE-3: baza trzyma statusy MAŁYMI literami (demo: 100% wierszy `tasks`).
    // Kanban zapisywał 'TODO'/'IN_PROGRESS' — serwer pisze wartość dosłownie, więc
    // każdy drag zaśmiecał dane drugim wariantem tego samego statusu.
    apiStatus: 'todo',
    icon: <Circle size={14} />,
    headerColor: 'text-c-text-muted',
    dotColor: 'bg-c-border-strong',
    dropHighlight: 'ring-c-border-strong/40 bg-c-surface-raised',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    statuses: ['in_progress', 'in progress', 'active', 'review', 'in_review'],
    apiStatus: 'in_progress',
    icon: <Clock size={14} />,
    headerColor: 'text-blue-400',
    dotColor: 'bg-blue-500',
    dropHighlight: 'ring-blue-500/40 bg-blue-500/5',
  },
  {
    id: 'blocked',
    label: 'Blocked',
    statuses: ['blocked', 'on_hold', 'on hold', 'waiting'],
    apiStatus: 'blocked',
    icon: <AlertCircle size={14} />,
    headerColor: 'text-danger-400',
    dotColor: 'bg-danger-500',
    dropHighlight: 'ring-danger-500/40 bg-danger-500/5',
  },
  {
    id: 'done',
    label: 'Done',
    statuses: ['done', 'completed', 'validated'],
    apiStatus: 'done',
    icon: <CheckCircle2 size={14} />,
    headerColor: 'text-emerald-400',
    dotColor: 'bg-emerald-500',
    dropHighlight: 'ring-emerald-500/40 bg-emerald-500/5',
  },
];

const COLUMN_IDS = KANBAN_COLUMNS.map((c) => c.id);

/** Determine which column a task belongs to based on its status */
const getColumnForStatus = (status?: string): string => {
  const s = status?.toLowerCase() || 'todo';
  for (const col of KANBAN_COLUMNS) {
    if (col.statuses.includes(s)) return col.id;
  }
  return 'todo';
};

/* ─── Priority → card styles ───
 *
 * N-24 (przegląd 128 zrzutów, 2026-07-27): karta kanbana pokazywała priorytet
 * jako pełną pigułkę `● CRITICAL` UPPERCASE z tłem i ramką — czyli TEN SAM
 * moduł miał dwa różne standardy priorytetu: tabela Tasks robiła kropkę
 * + tekst (kanon A4, ekran przyjęty przez Piotra), a kanban obok — dokładnie
 * to, czego kanon A9 zabrania („pełne czerwone pigułki priorytetów").
 * `badge` niesie teraz sam tonowany kolor tekstu, w skali wspólnej ze
 * `standard/PriorityCell`. Pasek akcentu na lewej krawędzi karty (`border`)
 * i delikatny tint tła (`bg`) ZOSTAJĄ — kanon A9 wprost ich wymaga.
 */

const getPriorityCardStyle = (priority?: string) => {
  switch (priority?.toLowerCase()) {
    case 'urgent':
    case 'critical':
      return {
        border: 'border-l-4 border-l-danger-500',
        bg: 'bg-danger-500/5 dark:bg-danger-500/10',
        badge: 'text-danger-700 dark:text-danger-300',
        label: 'Critical',
        dot: 'bg-danger-500',
      };
    case 'high':
      return {
        border: 'border-l-4 border-l-amber-500',
        bg: 'bg-amber-500/5 dark:bg-amber-500/10',
        badge: 'text-c-text-secondary',
        label: 'High',
        dot: 'bg-amber-500',
      };
    case 'medium':
      return {
        border: 'border-l-4 border-l-blue-500',
        bg: 'bg-blue-500/5 dark:bg-blue-500/10',
        badge: 'text-c-text-secondary',
        label: 'Medium',
        dot: 'bg-blue-500',
      };
    case 'low':
      return {
        border: 'border-l-4 border-l-slate-400',
        bg: 'bg-slate-500/5 dark:bg-slate-500/10',
        badge: 'text-c-text-muted',
        label: 'Low',
        dot: 'bg-slate-400',
      };
    default:
      return {
        border: 'border-l-4 border-l-slate-300',
        bg: 'bg-slate-500/5 dark:bg-slate-500/10',
        badge: 'text-c-text-muted',
        label: 'Normal',
        dot: 'bg-slate-400',
      };
  }
};

/* ─── Date helpers ─── */

const formatDueDate = (dueDate?: string | Date): string | null => {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  if (dateOnly.getTime() === today.getTime()) return 'Today';
  if (dateOnly.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const isOverdue = (dueDate?: string | Date, status?: string): boolean => {
  if (!dueDate) return false;
  if (['done', 'completed', 'validated'].includes(status?.toLowerCase() || '')) return false;
  const date = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

/* ═══════════════════════════════════════════════════════════════
 *  Card content (shared between sortable card and drag overlay)
 * ═══════════════════════════════════════════════════════════════ */

const KanbanCardContent: React.FC<{
  task: Task;
  isDragging?: boolean;
  isOverlay?: boolean;
}> = ({ task, isDragging, isOverlay }) => {
  const priorityStyle = getPriorityCardStyle(task.priority);
  const overdue = isOverdue(task.dueDate, task.status);
  const dueLabel = formatDueDate(task.dueDate);
  const assigneeName = task.assignee?.firstName
    ? `${task.assignee.firstName} ${task.assignee.lastName || ''}`.trim()
    : null;
  const assigneeInitial = assigneeName ? assigneeName[0].toUpperCase() : '';

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
        <h4 className="text-sm font-medium text-c-text mb-2 line-clamp-2 leading-snug flex-1">
          {task.title || 'Untitled task'}
        </h4>
      </div>

      {task.description && (
        <p className="text-xs text-c-text-muted mb-3 line-clamp-2 leading-relaxed pl-5">
          {task.description}
        </p>
      )}

      <div className="flex items-center gap-1.5 mb-3 flex-wrap pl-5">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-medium ${priorityStyle.badge}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
          {priorityStyle.label}
        </span>
        {task.projectName && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-c-surface-raised text-c-text-secondary border border-c-border-subtle truncate max-w-[120px]">
            {task.projectName}
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
          <span />
        )}
        {assigneeName ? (
          <div className="flex items-center gap-1.5" title={assigneeName}>
            {task.assignee?.avatarUrl ? (
              <img
                src={task.assignee.avatarUrl}
                alt={assigneeName}
                className="w-5 h-5 rounded-full object-cover ring-1 ring-white/20"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-c-surface-raised text-c-text-secondary flex items-center justify-center text-[10px] font-bold ring-1 ring-c-border-subtle">
                {assigneeInitial}
              </div>
            )}
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
  task: Task;
  onClick: (taskId: string, taskData?: Task) => void;
}> = ({ task, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
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
        // Only fire click if this wasn't a drag
        if (!isDragging) {
          e.stopPropagation();
          onClick(task.id, task);
        }
      }}
    >
      <KanbanCardContent task={task} isDragging={isDragging} />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
 *  Droppable Column
 * ═══════════════════════════════════════════════════════════════ */

const DroppableColumn: React.FC<{
  column: KanbanColumnDef;
  taskIds: string[];
  children: React.ReactNode;
  onCreateTask: () => void;
}> = ({ column, taskIds, children, onCreateTask }) => {
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
            {taskIds.length}
          </span>
        </div>
        {column.id === 'todo' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateTask();
            }}
            className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors"
            title="Add task"
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
              taskIds.length === 0 ? 'h-24' : 'h-14'
            } ${column.headerColor} opacity-40`}
          >
            <span className={`text-xs font-medium ${column.headerColor}`}>Drop here</span>
          </div>
        )}

        {/* Empty state */}
        {taskIds.length === 0 && !isOver && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className={`mb-2 ${column.headerColor} opacity-30`}>{column.icon}</div>
            <p className="text-xs text-c-text-muted">No tasks</p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
 *  Collision detection — kanban-optimized
 *
 *  Priority: pointerWithin (columns) → closestCenter (items) → rect fallback
 *  Guarantees empty columns are always valid drop targets.
 * ═══════════════════════════════════════════════════════════════ */

const kanbanCollisionDetection: CollisionDetection = (args) => {
  // First: check if pointer is within any droppable rect
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    // Prefer column containers, then items within that column
    const columnHits = pointerCollisions.filter(
      (c) => c.data?.droppableContainer?.data?.current?.type === 'column'
    );
    const itemHits = pointerCollisions.filter(
      (c) => c.data?.droppableContainer?.data?.current?.type === 'task'
    );
    // Return items first (for precise positioning) then columns as fallback
    if (itemHits.length > 0) return [...itemHits, ...columnHits];
    if (columnHits.length > 0) return columnHits;
    return pointerCollisions;
  }

  // Fallback: rect intersection
  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) return rectCollisions;

  // Last resort
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

/** Build containerItems from a task list */
const buildContainerItems = (taskList: Task[]): ContainerItems => {
  const priorityOrder: Record<string, number> = {
    urgent: 0,
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const items: ContainerItems = {};
  for (const col of KANBAN_COLUMNS) {
    // PILNE-3: przydział przez `getColumnForStatus` (ten sam mechanizm co reszta
    // komponentu) zamiast surowego `col.statuses.includes(...)` — dzięki temu
    // status nieznany trafia do fallbackowej kolumny „To Do" zamiast zniknąć
    // z tablicy. Suma kolumn == liczba zadań ZAWSZE.
    const colTasks = taskList
      .filter((t) => getColumnForStatus(t.status) === col.id)
      .sort((a, b) => {
        const ap = priorityOrder[a.priority?.toLowerCase() || 'medium'] ?? 2;
        const bp = priorityOrder[b.priority?.toLowerCase() || 'medium'] ?? 2;
        if (ap !== bp) return ap - bp;
        if (a.dueDate && b.dueDate)
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return 0;
      });
    items[col.id] = colTasks.map((t) => t.id);
  }
  return items;
};

/** Find which container an item lives in */
const findContainer = (containers: ContainerItems, id: UniqueIdentifier): string | undefined => {
  // Is it a column id itself?
  if (id in containers) return id as string;
  // Otherwise search items
  for (const [colId, ids] of Object.entries(containers)) {
    if (ids.includes(id as string)) return colId;
  }
  return undefined;
};

/* ═══════════════════════════════════════════════════════════════
 *  Main Component
 * ═══════════════════════════════════════════════════════════════ */

export const TasksKanbanBoard: React.FC<TasksKanbanBoardProps> = ({
  activeFilter,
  searchQuery,
  onTaskClick,
  onCreateTask,
  onCountsChange,
  refreshTrigger,
}) => {
  const { t } = useTranslation();

  // Raw task data from API
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // DnD state
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [containerItems, setContainerItems] = useState<ContainerItems>({});
  // Track the column a task started in when drag began, so we know if it changed
  const dragStartColumn = useRef<string | null>(null);

  // Task map for O(1) lookup
  const taskMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  // Sensors — 8px activation distance prevents accidental drags on click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /* ─── Data fetching ─── */

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getPersonalTasks();
      setTasks(data || []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast.error(t('myWork.errors.fetchFailed', 'Failed to load tasks'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, refreshTrigger]);

  /* ─── Filtering ─── */

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) => t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
      );
    }
    if (activeFilter === 'urgent') {
      result = result.filter((t) => {
        const p = t.priority?.toLowerCase();
        return p === 'urgent' || p === 'critical' || p === 'high';
      });
    }
    if (activeFilter === 'overdue') {
      result = result.filter((t) => isOverdue(t.dueDate, t.status));
    }
    if (activeFilter === 'today') {
      result = result.filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        const now = new Date();
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      });
    }
    if (activeFilter === 'week') {
      result = result.filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setDate(end.getDate() + 7);
        return d >= now && d < end;
      });
    }
    return result;
  }, [tasks, searchQuery, activeFilter]);

  // Rebuild containerItems when filtered tasks change (but NOT during an active drag)
  useEffect(() => {
    if (!activeTask) {
      setContainerItems(buildContainerItems(filteredTasks));
    }
  }, [filteredTasks, activeTask]);

  /* ─── Counts reporting ─── */

  useEffect(() => {
    const overdue = tasks.filter((t) => isOverdue(t.dueDate, t.status)).length;
    const today = tasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }).length;
    const week = tasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setDate(end.getDate() + 7);
      return d >= now && d < end;
    }).length;
    const urgent = tasks.filter((t) => {
      const p = t.priority?.toLowerCase();
      return p === 'urgent' || p === 'critical' || p === 'high';
    }).length;
    onCountsChange({ total: tasks.length, overdue, today, week, urgent });
  }, [tasks, onCountsChange]);

  /* ═══ Drag & Drop handlers ═══ */

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string;
      const task = taskMap.get(id) || null;
      setActiveTask(task);
      dragStartColumn.current = findContainer(containerItems, id) || null;
    },
    [taskMap, containerItems]
  );

  /**
   * onDragOver — fires continuously while dragging.
   * Handles LIVE cross-container movement so the card visually follows the cursor.
   */
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id;

      const activeContainer = findContainer(containerItems, activeId);
      const overContainer = findContainer(containerItems, overId);

      if (!activeContainer || !overContainer) return;

      // Only act when moving BETWEEN containers
      if (activeContainer === overContainer) return;

      setContainerItems((prev) => {
        const activeItems = [...prev[activeContainer]];
        const overItems = [...prev[overContainer]];

        const activeIndex = activeItems.indexOf(activeId);

        // Find insertion index
        let newIndex: number;
        if (COLUMN_IDS.includes(overId as string)) {
          // Dropped on the column itself (not on a specific card) → append at end
          newIndex = overItems.length;
        } else {
          const overIndex = overItems.indexOf(overId as string);
          // Insert below the card we're hovering over if cursor is in the lower half
          const isBelowOverItem =
            over &&
            active.rect.current.translated &&
            active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
          newIndex = isBelowOverItem ? overIndex + 1 : overIndex;
        }

        // Remove from source
        activeItems.splice(activeIndex, 1);
        // Insert into target
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

  /**
   * onDragEnd — fires once when the drag finishes.
   * Handles same-container reordering + persists cross-container status change.
   */
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);

      if (!over) {
        // Cancelled — rebuild from tasks
        setContainerItems(buildContainerItems(filteredTasks));
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

        const task = taskMap.get(activeId);
        if (!task) return;

        const newStatus = targetColDef.apiStatus;
        const previousStatus = task.status;

        // Optimistic update on the task data
        setTasks((prev) =>
          prev.map((t) => (t.id === activeId ? { ...t, status: newStatus as TaskStatus } : t))
        );

        // Persist via API
        try {
          await Api.updatePersonalTask(activeId, { status: newStatus });
          toast.success(
            t('myWork.kanban.statusMoved', 'Przeniesiono do „{{column}}"', {
              column: targetColDef.label,
            }),
            { duration: 2000, icon: '✓' }
          );
        } catch (error) {
          console.error('Failed to update task status:', error);
          // Revert
          setTasks((prev) =>
            prev.map((t) => (t.id === activeId ? { ...t, status: previousStatus } : t))
          );
          // PILNE-3: „Failed to update status" nic nie mówiło — ani co się stało,
          // ani co zrobić. Komunikat rozróżnia teraz realne przypadki i zawsze
          // podaje tytuł zadania + kolumnę docelową + krok naprawczy.
          const httpStatus = Number((error as { status?: number } | undefined)?.status) || 0;
          const shortTitle =
            (task.title || '').length > 40
              ? `${(task.title || '').slice(0, 40)}…`
              : task.title || '';
          const ctx = { title: shortTitle, column: targetColDef.label };
          let message: string;
          if (httpStatus === 404) {
            message = t(
              'myWork.kanban.statusFailedNotFound',
              'Nie zapisano: zadanie „{{title}}" już nie istnieje (mogło zostać usunięte lub przypisane komuś innemu). Odśwież tablicę.',
              ctx
            );
          } else if (httpStatus === 401 || httpStatus === 403) {
            message = t(
              'myWork.kanban.statusFailedForbidden',
              'Nie zapisano: brak uprawnień do zmiany statusu zadania „{{title}}". Poproś właściciela zadania o zmianę.',
              ctx
            );
          } else if (httpStatus >= 500) {
            message = t(
              'myWork.kanban.statusFailedServer',
              'Nie zapisano „{{title}}" → {{column}}: błąd serwera ({{code}}). Karta wróciła na miejsce — spróbuj ponownie za chwilę.',
              { ...ctx, code: httpStatus }
            );
          } else if (!httpStatus) {
            message = t(
              'myWork.kanban.statusFailedOffline',
              'Nie zapisano „{{title}}" → {{column}}: brak połączenia z serwerem. Karta wróciła na miejsce — sprawdź internet i spróbuj ponownie.',
              ctx
            );
          } else {
            message = t(
              'myWork.kanban.statusFailedGeneric',
              'Nie zapisano „{{title}}" → {{column}} ({{code}}). Karta wróciła na miejsce — spróbuj ponownie.',
              { ...ctx, code: httpStatus }
            );
          }
          toast.error(message, { duration: 6000 });
        }
      }
    },
    [containerItems, filteredTasks, taskMap, t]
  );

  const handleDragCancel = useCallback(() => {
    setActiveTask(null);
    dragStartColumn.current = null;
    // Rebuild from source of truth
    setContainerItems(buildContainerItems(filteredTasks));
  }, [filteredTasks]);

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
                  {[1, 2, 3].map((i) => (
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

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg">
        <div className="flex-1 p-4">
          <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl">
            <CheckCircle2 size={48} className="text-c-text-muted mb-4" />
            <h3 className="text-lg font-medium text-c-text-secondary mb-2">No tasks yet</h3>
            <p className="text-sm text-c-text-muted mb-4">Create your first task to get started</p>
            <button
              onClick={onCreateTask}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-c-text text-c-surface rounded-lg hover:opacity-90 transition-opacity"
            >
              <Plus size={16} />
              Create Task
            </button>
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
                  taskIds={ids}
                  onCreateTask={onCreateTask}
                >
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    {ids.map((id) => {
                      const task = taskMap.get(id);
                      if (!task) return null;
                      return <SortableKanbanCard key={id} task={task} onClick={onTaskClick} />;
                    })}
                  </SortableContext>
                </DroppableColumn>
              );
            })}
          </div>

          {/* Floating ghost card while dragging */}
          <DragOverlay dropAnimation={dropAnimation}>
            {activeTask ? (
              <div className="w-72">
                <KanbanCardContent task={activeTask} isOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default TasksKanbanBoard;
