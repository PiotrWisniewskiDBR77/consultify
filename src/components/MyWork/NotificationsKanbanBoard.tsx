/**
 * NotificationsKanbanBoard - Kanban board view for notifications grouped by read status
 * Columns: Unread | Read
 * Card colors depend on notification severity
 * Full drag-and-drop: reorder within columns + move between columns (toggles read status)
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
  AlertTriangle,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Eye,
  EyeOff,
  FolderOpen,
  GripVertical,
  Info,
  Loader2,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  isNotificationTypeMuted,
  NOTIFICATION_MUTE_SESSION_CHANGED_EVENT,
} from '@/utils/notificationMuteSession';

/* ─── Notification type ─── */

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  body?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  priority?: string;
  category?: string;
  read: boolean;
  isRead?: boolean;
  readAt?: string;
  createdAt: string;
  relatedObjectType?: string;
  relatedObjectId?: string;
  projectId?: string;
  projectName?: string;
  data?: Record<string, unknown>;
}

type NotificationFilter = 'all' | 'unread' | 'today' | 'week';

interface NotificationCounts {
  total: number;
  unread: number;
  today: number;
  week: number;
}

interface NotificationsKanbanBoardProps {
  filter: NotificationFilter;
  searchQuery: string;
  onNotificationClick?: (notificationId: string, notificationData?: Notification) => void;
  onCountsChange: (counts: NotificationCounts) => void;
}

/* ─── Status columns config ─── */

interface KanbanColumnDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  headerColor: string;
  dotColor: string;
  dropHighlight: string;
}

const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: 'unread',
    label: 'Unread',
    icon: <EyeOff size={14} />,
    headerColor: 'text-amber-400',
    dotColor: 'bg-amber-500',
    dropHighlight: 'ring-amber-500/40 bg-amber-500/5',
  },
  {
    id: 'read',
    label: 'Read',
    icon: <Eye size={14} />,
    headerColor: 'text-c-text-muted',
    dotColor: 'bg-c-border-strong',
    dropHighlight: 'ring-c-border-strong/40 bg-c-surface-raised',
  },
];

const COLUMN_IDS = KANBAN_COLUMNS.map((c) => c.id);

/* ─── Severity → card styles ─── */

const getSeverityCardStyle = (severity?: string) => {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL':
      return {
        border: 'border-l-4 border-l-rose-500',
        bg: 'bg-rose-500/5 dark:bg-rose-500/10',
        badge: 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
        label: 'Critical',
        dot: 'bg-rose-500',
        icon: Zap,
      };
    case 'WARNING':
      return {
        border: 'border-l-4 border-l-amber-500',
        bg: 'bg-amber-500/5 dark:bg-amber-500/10',
        badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
        label: 'Warning',
        dot: 'bg-amber-500',
        icon: AlertTriangle,
      };
    default:
      return {
        border: 'border-l-4 border-l-blue-500',
        bg: 'bg-blue-500/5 dark:bg-blue-500/10',
        badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
        label: 'Info',
        dot: 'bg-blue-500',
        icon: Info,
      };
  }
};

/* ─── Type config ─── */

const getTypeConfig = (type: string) => {
  const typeUpper = type?.toUpperCase() || '';
  if (typeUpper.includes('TASK')) return { label: 'Task', icon: CheckSquare };
  if (typeUpper.includes('DECISION')) return { label: 'Decision', icon: AlertCircle };
  if (typeUpper.includes('AI') || typeUpper.includes('RECOMMENDATION'))
    return { label: 'AI Insight', icon: Sparkles };
  if (typeUpper.includes('GATE') || typeUpper.includes('APPROVAL'))
    return { label: 'Approval', icon: Target };
  if (typeUpper.includes('SYSTEM') || typeUpper.includes('SECURITY'))
    return { label: 'System', icon: Bot };
  return { label: 'Alert', icon: Bell };
};

/* ─── Date helpers ─── */

const formatRelativeTime = (dateString: string): string => {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Recently';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/* ═══════════════════════════════════════════════════════════════
 *  Card content (shared between sortable card and drag overlay)
 * ═══════════════════════════════════════════════════════════════ */

const KanbanCardContent: React.FC<{
  notification: Notification;
  isDragging?: boolean;
  isOverlay?: boolean;
}> = ({ notification, isDragging, isOverlay }) => {
  const severityStyle = getSeverityCardStyle(notification.severity);
  const typeConfig = getTypeConfig(notification.type);
  const TypeIcon = typeConfig.icon;
  const SeverityIcon = severityStyle.icon;
  const isRead = notification.read || notification.isRead;

  return (
    <div
      className={`
        rounded-lg p-3 select-none
        ${severityStyle.border} ${severityStyle.bg}
        border border-c-border-subtle
        ${isDragging ? 'opacity-30 scale-[0.98]' : ''}
        ${isOverlay ? 'shadow-hig-lg rotate-[3deg] scale-105 ring-1 ring-c-border-strong' : ''}
        ${isRead ? 'opacity-70' : ''}
        transition-all duration-150
      `}
    >
      <div className="flex items-start gap-1.5">
        <div className="mt-0.5 text-c-text-muted group-hover:text-c-text-secondary transition-colors cursor-grab active:cursor-grabbing flex-shrink-0">
          <GripVertical size={14} />
        </div>
        <h4
          className={`text-sm mb-1 line-clamp-2 leading-snug flex-1 ${
            isRead
              ? 'text-c-text-secondary'
              : 'font-medium text-c-text'
          }`}
        >
          {notification.title || 'Untitled notification'}
        </h4>
      </div>

      {notification.message && (
        <p className="text-xs text-c-text-muted mb-2 line-clamp-2 leading-relaxed pl-5">
          {notification.message}
        </p>
      )}

      <div className="flex items-center gap-1.5 mb-2 flex-wrap pl-5">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${severityStyle.badge}`}
        >
          <SeverityIcon size={10} />
          {severityStyle.label}
        </span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-c-surface-raised text-c-text-secondary border border-c-border-subtle">
          <TypeIcon size={10} />
          {typeConfig.label}
        </span>
        {notification.projectName && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-c-surface-raised text-c-text-secondary border border-c-border-subtle truncate max-w-[120px]">
            <FolderOpen size={10} />
            {notification.projectName}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pl-5">
        <span className="flex items-center gap-1 text-[11px] text-c-text-muted">
          <Clock size={11} />
          {formatRelativeTime(notification.createdAt)}
        </span>
        {!isRead && (
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Unread" />
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
 *  Sortable Card wrapper
 * ═══════════════════════════════════════════════════════════════ */

const SortableKanbanCard: React.FC<{
  notification: Notification;
  onClick?: (id: string, data?: Notification) => void;
}> = ({ notification, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: notification.id,
    data: { type: 'notification', notification },
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
          onClick?.(notification.id, notification);
        }
      }}
    >
      <KanbanCardContent notification={notification} isDragging={isDragging} />
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
}> = ({ column, itemIds, children }) => {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
  });

  return (
    <div
      className={`w-80 flex-shrink-0 flex flex-col rounded-xl border transition-all duration-200 ${
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
              {t('myWork.notifications.emptyTitle', 'No notifications')}
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
      (c) => c.data?.droppableContainer?.data?.current?.type === 'notification'
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

/** Build containerItems from notification list */
const buildContainerItems = (notificationList: Notification[]): ContainerItems => {
  const items: ContainerItems = { unread: [], read: [] };

  // Sort by severity then date (critical first, newest first)
  const severityOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  const sorted = [...notificationList].sort((a, b) => {
    const as = severityOrder[a.severity] ?? 2;
    const bs = severityOrder[b.severity] ?? 2;
    if (as !== bs) return as - bs;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  sorted.forEach((n) => {
    const isRead = n.read || n.isRead;
    if (isRead) {
      items.read.push(n.id);
    } else {
      items.unread.push(n.id);
    }
  });

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

export const NotificationsKanbanBoard: React.FC<NotificationsKanbanBoardProps> = ({
  filter,
  searchQuery,
  onNotificationClick,
  onCountsChange,
}) => {
  const { t } = useTranslation();

  // Raw notification data from API
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // DnD state
  const [activeNotification, setActiveNotification] = useState<Notification | null>(null);
  const [containerItems, setContainerItems] = useState<ContainerItems>({});
  const dragStartColumn = useRef<string | null>(null);

  // Notification map for O(1) lookup
  const notificationMap = useMemo(() => {
    const map = new Map<string, Notification>();
    notifications.forEach((n) => map.set(n.id, n));
    return map;
  }, [notifications]);

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /* ─── Data fetching ─── */

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getNotifications();
      const mapped = (Array.isArray(data) ? data : []).map((n: any) => ({
        ...n,
        severity: n.severity || 'INFO',
        message: n.message || n.body || '',
        isRead: n.isRead ?? (n.read === true || n.read === 1),
        data: n.data || n.metadata || {},
      }));
      setNotifications(mapped.filter((n: any) => !isNotificationTypeMuted(n.type)));
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Refresh on session mute changes
  useEffect(() => {
    const handle = () => fetchNotifications();
    window.addEventListener(NOTIFICATION_MUTE_SESSION_CHANGED_EVENT, handle as any);
    return () => window.removeEventListener(NOTIFICATION_MUTE_SESSION_CHANGED_EVENT, handle as any);
  }, [fetchNotifications]);

  /* ─── Filtering ─── */

  const filteredNotifications = useMemo(() => {
    let result = notifications;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (n) => n.title?.toLowerCase().includes(query) || n.message?.toLowerCase().includes(query)
      );
    }

    // Status filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    switch (filter) {
      case 'unread':
        result = result.filter((n) => !(n.read || n.isRead));
        break;
      case 'today':
        result = result.filter((n) => new Date(n.createdAt) >= today);
        break;
      case 'week':
        result = result.filter((n) => new Date(n.createdAt) >= weekAgo);
        break;
    }

    return result;
  }, [notifications, searchQuery, filter]);

  // Rebuild containerItems when filtered notifications change (but NOT during an active drag)
  useEffect(() => {
    if (!activeNotification) {
      setContainerItems(buildContainerItems(filteredNotifications));
    }
  }, [filteredNotifications, activeNotification]);

  /* ─── Counts reporting ─── */

  useEffect(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    onCountsChange({
      total: notifications.length,
      unread: notifications.filter((n) => !(n.read || n.isRead)).length,
      today: notifications.filter((n) => new Date(n.createdAt) >= today).length,
      week: notifications.filter((n) => new Date(n.createdAt) >= weekAgo).length,
    });
  }, [notifications, onCountsChange]);

  /* ═══ Drag & Drop handlers ═══ */

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string;
      const notification = notificationMap.get(id) || null;
      setActiveNotification(notification);
      dragStartColumn.current = findContainer(containerItems, id) || null;
    },
    [notificationMap, containerItems]
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
      setActiveNotification(null);

      if (!over) {
        setContainerItems(buildContainerItems(filteredNotifications));
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

      // Check if column actually changed
      const startCol = dragStartColumn.current;
      const endCol = findContainer(containerItems, activeId);
      dragStartColumn.current = null;

      if (startCol && endCol && startCol !== endCol) {
        const notification = notificationMap.get(activeId);
        if (!notification) return;

        const movingToRead = endCol === 'read';
        const previousRead = Boolean(notification.read ?? notification.isRead);

        // Optimistic update
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === activeId ? { ...n, read: movingToRead, isRead: movingToRead } : n
          )
        );

        // Persist via API
        try {
          if (movingToRead) {
            await Api.markNotificationRead(activeId);
            toast.success('Marked as read', { duration: 2000, icon: '✓' });
          } else {
            // Mark as unread - use patch to set read=false
            await Api.patch(`/notifications/${activeId}`, { read: false });
            toast.success('Marked as unread', { duration: 2000, icon: '✓' });
          }
        } catch (error) {
          console.error('Failed to update notification status:', error);
          // Revert
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === activeId ? { ...n, read: previousRead, isRead: previousRead } : n
            )
          );
          toast.error('Failed to update notification');
        }
      }
    },
    [containerItems, filteredNotifications, notificationMap]
  );

  const handleDragCancel = useCallback(() => {
    setActiveNotification(null);
    dragStartColumn.current = null;
    setContainerItems(buildContainerItems(filteredNotifications));
  }, [filteredNotifications]);

  /* ─── Render ─── */

  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg">
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 min-w-max">
            {KANBAN_COLUMNS.map((col) => (
              <div
                key={col.id}
                className="w-80 flex-shrink-0 bg-c-surface rounded-xl p-3 animate-pulse"
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

  if (notifications.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg">
        <div className="flex-1 p-4">
          <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl">
            <Bell
              size={48}
              className="text-c-text-muted mb-4"
            />
            <h3 className="text-lg font-medium text-c-text-secondary mb-2">
              {t('myWork.notifications.emptyTitle', 'No notifications')}
            </h3>
            <p className="text-sm text-c-text-muted">
              {t('myWork.notifications.emptySubtitle', "You're all caught up!")}
            </p>
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
                <DroppableColumn key={col.id} column={col} itemIds={ids}>
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    {ids.map((id) => {
                      const notification = notificationMap.get(id);
                      if (!notification) return null;
                      return (
                        <SortableKanbanCard
                          key={id}
                          notification={notification}
                          onClick={onNotificationClick}
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
            {activeNotification ? (
              <div className="w-80">
                <KanbanCardContent notification={activeNotification} isOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default NotificationsKanbanBoard;
