/**
 * NotificationsHub - Dual-mode notifications panel (Project/Personal)
 * Part of Unified MyWork Module
 * UNIFIED DESIGN: Same UI/UX as Tasks panel
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  BellOff,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  FolderOpen,
  Layers,
  Sparkles,
  Target,
  Trash2,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type CardViewStyle, CardViewSwitcher } from '@/components/shared/CardViewSwitcher';
import { EmptyState, LoadingState } from '@/components/shared/states';
import type { GenericListItem, ListColumn, ListSection } from '@/components/shared/ViewLayouts';
import { ClickUpListView, NotionListView } from '@/components/shared/ViewLayouts';
import {
  clearMutedNotificationTypesForSession,
  getMutedNotificationTypes,
  isNotificationTypeMuted,
  NOTIFICATION_MUTE_SESSION_CHANGED_EVENT,
  unmuteNotificationTypeForSession,
} from '@/utils/notificationMuteSession';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';

export type NotificationMode = 'project' | 'personal' | 'all';
export type NotificationFilter = 'all' | 'unread' | 'today' | 'week';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  read: boolean;
  readAt?: string;
  createdAt: string;
  relatedObjectType?: string;
  relatedObjectId?: string;
  projectId?: string;
  projectName?: string;
  userId?: string;
  scope?: 'PROJECT' | 'PERSONAL' | 'SYSTEM';
}

/* ─────────────── Notification → GenericListItem mapping ─────────────── */

const getSeverityVariant = (severity?: string): GenericListItem['statusVariant'] => {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL':
      return 'danger';
    case 'WARNING':
      return 'warning';
    case 'INFO':
      return 'info';
    default:
      return 'neutral';
  }
};

const notificationToGenericItem = (n: Notification): GenericListItem => ({
  id: n.id,
  title: n.title,
  subtitle: n.message || undefined,
  status: n.severity || 'INFO',
  statusVariant: getSeverityVariant(n.severity),
  secondaryLabel: n.relatedObjectType?.replace(/_/g, ' ').toLowerCase() || undefined,
  tertiaryLabel: n.scope || 'System',
  isHighlighted: !n.read,
  dueDate: n.createdAt
    ? new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : undefined,
  _raw: n,
});

const NOTIFICATION_CLICKUP_COLUMNS: ListColumn[] = [
  { key: 'title', label: 'Notification', width: 'flex-1 min-w-0' },
  { key: 'status', label: 'Severity', width: 'w-24' },
  { key: 'secondaryLabel', label: 'Related to', width: 'w-28' },
  { key: 'tertiaryLabel', label: 'Source', width: 'w-24' },
  { key: 'dueDate', label: 'Time', width: 'w-24' },
];

interface NotificationsHubProps {
  onOpenTask?: (taskId: string) => void;
  onOpenDecision?: (decisionId: string) => void;
  onOpenInitiative?: (initiativeId: string) => void;
}

// Group notifications by time
const groupByTime = (notifications: Notification[]) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const thisWeek: Notification[] = [];
  const earlier: Notification[] = [];

  notifications.forEach((n) => {
    const date = new Date(n.createdAt);
    if (date >= weekAgo) {
      thisWeek.push(n);
    } else {
      earlier.push(n);
    }
  });

  return { thisWeek, earlier };
};

// Format relative time
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
  return date.toLocaleDateString();
};

// Get notification icon
const getNotificationIcon = (type: string, severity: string) => {
  const iconClass =
    severity === 'CRITICAL'
      ? 'text-danger-500'
      : severity === 'WARNING'
        ? 'text-amber-500'
        : 'text-blue-500';

  switch (type) {
    case 'TASK_ASSIGNED':
    case 'TASK_OVERDUE':
    case 'TASK_BLOCKED':
      return <CheckSquare size={14} className={iconClass} />;
    case 'DECISION_REQUIRED':
    case 'DECISION_OVERDUE':
      return <AlertCircle size={14} className={iconClass} />;
    case 'AI_RECOMMENDATION':
    case 'AI_RISK_DETECTED':
      return <Sparkles size={14} className={iconClass} />;
    case 'GATE_PENDING_APPROVAL':
      return <Target size={14} className={iconClass} />;
    default:
      return <Bell size={14} className={iconClass} />;
  }
};

// Get related object icon
const getRelatedObjectIcon = (type: string | undefined) => {
  switch (type) {
    case 'TASK':
      return <CheckSquare size={12} className="text-blue-500" />;
    case 'DECISION':
      return <AlertCircle size={12} className="text-amber-500" />;
    case 'INITIATIVE':
      return <Target size={12} className="text-blue-500" />;
    case 'PROJECT':
      return <FolderOpen size={12} className="text-emerald-500" />;
    default:
      return (
        <FileText size={12} className="text-slate-500 dark:text-slate-400 dark:text-slate-500" />
      );
  }
};

// Get related object label
const getRelatedObjectLabel = (type: string | undefined): string => {
  switch (type) {
    case 'TASK':
      return 'Task';
    case 'DECISION':
      return 'Decision';
    case 'INITIATIVE':
      return 'Initiative';
    case 'PROJECT':
      return 'Project';
    case 'GATE':
      return 'Gate Review';
    default:
      return 'Item';
  }
};

// Notification Item Component
const NotificationItem: React.FC<{
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (n: Notification) => void;
}> = ({ notification, onMarkRead, onDelete, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = () => {
    setIsExpanded(!isExpanded);
    if (!notification.read) {
      onMarkRead(notification.id);
    }
  };

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(notification);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
                border-b border-slate-100 dark:border-navy-700
                transition-colors duration-150
                ${notification.read ? 'bg-white dark:bg-navy-900/50' : 'bg-blue-50/50 dark:bg-blue-900/10'}
                ${isExpanded ? 'bg-slate-50/80 dark:bg-white/5' : ''}
                hover:bg-slate-50 dark:hover:bg-white/5
            `}
    >
      {/* Main row - always visible */}
      <div onClick={handleClick} className="flex items-start gap-3 px-4 py-3 cursor-pointer">
        {/* Unread indicator */}
        <div className="shrink-0 pt-1">
          {!notification.read ? (
            <div className="w-2 h-2 rounded-full bg-blue-500" />
          ) : (
            <div className="w-2 h-2" />
          )}
        </div>

        {/* Icon */}
        <div className="shrink-0 mt-0.5">
          {getNotificationIcon(notification.type, notification.severity)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-[13px] leading-tight ${isExpanded ? '' : 'line-clamp-2'} ${
                notification.read
                  ? 'text-slate-600 dark:text-slate-400'
                  : 'text-slate-800 dark:text-white font-medium'
              }`}
            >
              {notification.title}
            </p>
            <span className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500">
              {formatRelativeTime(notification.createdAt)}
            </span>
          </div>

          {notification.message && !isExpanded && (
            <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5 line-clamp-1">
              {notification.message}
            </p>
          )}
        </div>

        {/* Expand indicator */}
        <div className="shrink-0 pt-0.5">
          <ChevronDown
            size={14}
            className={`text-slate-500 dark:text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>

        {/* Hover Actions */}
        {isHovered && !isExpanded && (
          <div className="shrink-0 flex items-center gap-0.5">
            {!notification.read && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead(notification.id);
                }}
                className="p-1.5 text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                title="Mark as read"
              >
                <Check size={14} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(notification.id);
              }}
              className="p-1.5 text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pl-[52px] space-y-3">
              {/* Full message */}
              {notification.message && (
                <div className="text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {notification.message}
                </div>
              )}

              {/* Related object info */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Related object type */}
                {notification.relatedObjectType && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-white/10 rounded text-[11px]">
                    {getRelatedObjectIcon(notification.relatedObjectType)}
                    <span className="text-slate-600 dark:text-slate-400">
                      {getRelatedObjectLabel(notification.relatedObjectType)}
                    </span>
                  </div>
                )}

                {/* Project name */}
                {notification.projectName && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-primary-50 dark:bg-primary-900/20 rounded text-[11px]">
                    <Briefcase size={12} className="text-primary-500" />
                    <span className="text-primary-700 dark:text-primary-400">
                      {notification.projectName}
                    </span>
                  </div>
                )}

                {/* Scope badge */}
                {notification.scope && (
                  <div
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] ${
                      notification.scope === 'PROJECT'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : notification.scope === 'PERSONAL'
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {notification.scope === 'PROJECT' ? (
                      <Building2 size={12} />
                    ) : (
                      <User size={12} />
                    )}
                    <span>
                      {notification.scope === 'PROJECT'
                        ? 'Project'
                        : notification.scope === 'PERSONAL'
                          ? 'Personal'
                          : 'System'}
                    </span>
                  </div>
                )}

                {/* Severity badge */}
                {notification.severity && notification.severity !== 'INFO' && (
                  <div
                    className={`px-2 py-1 rounded text-[11px] font-medium ${
                      notification.severity === 'CRITICAL'
                        ? 'bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400'
                        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {notification.severity}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                {notification.relatedObjectId && notification.relatedObjectType && (
                  <button
                    onClick={handleNavigate}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-[11px] font-medium rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                  >
                    <span>View {getRelatedObjectLabel(notification.relatedObjectType)}</span>
                    <ArrowRight size={12} />
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(notification.id);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                  <Trash2 size={12} />
                  <span>Dismiss</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Mode Tab Config
interface ModeTab {
  key: NotificationMode;
  label: string;
  icon: React.ElementType;
  count: number;
  activeColor: string;
}

// Filter Chip Config
interface FilterChip {
  key: NotificationFilter;
  label: string;
  icon: React.ElementType;
  count?: number;
}

export const NotificationsHub: React.FC<NotificationsHubProps> = ({
  onOpenTask,
  onOpenDecision,
  onOpenInitiative,
}) => {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<NotificationMode>('all');
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [cardViewStyle, setCardViewStyle] = useState<CardViewStyle>('d');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['thisWeek', 'earlier'])
  );

  const currentUserId = useAppStore((state) => state.currentUser?.id);

  // Session-muted types UI (lightweight)
  const [mutedTypesOpen, setMutedTypesOpen] = useState(false);
  const [mutedTypes, setMutedTypes] = useState<string[]>(() => getMutedNotificationTypes());

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = (await Api.getNotifications(false, 50)) as any;
      setNotifications(
        (Array.isArray(data) ? data : []).filter((n: any) => !isNotificationTypeMuted(n.type))
      );
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (mutedTypes.length === 0 && mutedTypesOpen) setMutedTypesOpen(false);
  }, [mutedTypes.length, mutedTypesOpen]);

  // Refresh on session mute changes
  useEffect(() => {
    const handle = () => {
      setMutedTypes(getMutedNotificationTypes());
      fetchNotifications();
    };
    window.addEventListener(NOTIFICATION_MUTE_SESSION_CHANGED_EVENT, handle as any);
    return () => window.removeEventListener(NOTIFICATION_MUTE_SESSION_CHANGED_EVENT, handle as any);
  }, [fetchNotifications]);

  // Filter by mode
  const modeFilteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (mode === 'all') return true;
      if (mode === 'project') {
        return n.projectId || n.scope === 'PROJECT';
      }
      if (mode === 'personal') {
        return (
          n.userId === currentUserId ||
          n.scope === 'PERSONAL' ||
          ['TASK_ASSIGNED', 'DECISION_REQUIRED'].includes(n.type)
        );
      }
      return true;
    });
  }, [notifications, mode, currentUserId]);

  // Apply additional filter
  const filteredNotifications = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    return modeFilteredNotifications.filter((n) => {
      if (filter === 'all') return true;
      if (filter === 'unread') return !n.read;
      if (filter === 'today') {
        const date = new Date(n.createdAt);
        return date >= today;
      }
      if (filter === 'week') {
        const date = new Date(n.createdAt);
        return date >= weekAgo;
      }
      return true;
    });
  }, [modeFilteredNotifications, filter]);

  // Group notifications
  const groupedNotifications = useMemo(() => {
    return groupByTime(filteredNotifications);
  }, [filteredNotifications]);

  // Counts
  const counts = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    return {
      total: notifications.length,
      unread: notifications.filter((n) => !n.read).length,
      today: notifications.filter((n) => new Date(n.createdAt) >= today).length,
      week: notifications.filter((n) => new Date(n.createdAt) >= weekAgo).length,
      project: notifications.filter((n) => n.projectId || n.scope === 'PROJECT').length,
      personal: notifications.filter(
        (n) =>
          n.userId === currentUserId ||
          n.scope === 'PERSONAL' ||
          ['TASK_ASSIGNED', 'DECISION_REQUIRED'].includes(n.type)
      ).length,
    };
  }, [notifications, currentUserId]);

  // Handlers
  const handleMarkRead = async (id: string) => {
    try {
      await Api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
      toast.error(t('notifications.error', 'Failed to update'));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await Api.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read: true,
          readAt: new Date().toISOString(),
        }))
      );
      toast.success(t('notifications.allMarkedRead', 'All marked as read'));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error(t('notifications.error', 'Failed to update'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await Api.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error(t('notifications.error', 'Failed to delete'));
    }
  };

  // New notification (A6.4) — admin broadcast
  const [showNewNotification, setShowNewNotification] = useState(false);
  const [newNotifTitle, setNewNotifTitle] = useState('');
  const [newNotifMessage, setNewNotifMessage] = useState('');
  const [newNotifSeverity, setNewNotifSeverity] = useState<'INFO' | 'WARNING' | 'CRITICAL'>('INFO');
  const [creatingNotif, setCreatingNotif] = useState(false);

  const handleCreateNotification = () => {
    setShowNewNotification(true);
  };

  const handleSubmitNewNotification = async () => {
    if (!newNotifTitle.trim()) return;
    setCreatingNotif(true);
    try {
      await Api.post('/notifications', {
        title: newNotifTitle.trim(),
        message: newNotifMessage.trim(),
        severity: newNotifSeverity,
        scope: 'PROJECT',
        type: 'ADMIN_BROADCAST',
      });
      toast.success(t('notifications.created', 'Notification created'));
      setShowNewNotification(false);
      setNewNotifTitle('');
      setNewNotifMessage('');
      setNewNotifSeverity('INFO');
      fetchNotifications();
    } catch (error) {
      console.error('Failed to create notification:', error);
      toast.error(t('notifications.createError', 'Failed to create notification'));
    } finally {
      setCreatingNotif(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      handleMarkRead(notification.id);
    }
    if (notification.relatedObjectType === 'TASK' && notification.relatedObjectId && onOpenTask) {
      onOpenTask(notification.relatedObjectId);
    } else if (
      notification.relatedObjectType === 'DECISION' &&
      notification.relatedObjectId &&
      onOpenDecision
    ) {
      onOpenDecision(notification.relatedObjectId);
    } else if (
      (notification.relatedObjectType === 'INITIATIVE' ||
        notification.relatedObjectType === 'initiative') &&
      notification.relatedObjectId &&
      onOpenInitiative
    ) {
      onOpenInitiative(notification.relatedObjectId);
    }
  };

  /* ─── Sections for N / C views ─── */
  const notifViewSections: ListSection[] = useMemo(() => {
    const critical = filteredNotifications
      .filter((n) => n.severity === 'CRITICAL')
      .map(notificationToGenericItem);
    const warning = filteredNotifications
      .filter((n) => n.severity === 'WARNING')
      .map(notificationToGenericItem);
    const info = filteredNotifications
      .filter((n) => n.severity === 'INFO')
      .map(notificationToGenericItem);
    const other = filteredNotifications
      .filter((n) => !['CRITICAL', 'WARNING', 'INFO'].includes(n.severity))
      .map(notificationToGenericItem);

    return [
      ...(critical.length > 0
        ? [{ id: 'critical', label: 'Critical', items: critical, accentColor: 'text-danger-500' }]
        : []),
      ...(warning.length > 0
        ? [{ id: 'warning', label: 'Warning', items: warning, accentColor: 'text-amber-500' }]
        : []),
      ...(info.length > 0
        ? [{ id: 'info', label: 'Information', items: info, accentColor: 'text-blue-500' }]
        : []),
      ...(other.length > 0
        ? [
            {
              id: 'other',
              label: 'Other',
              items: other,
              accentColor: 'text-slate-500 dark:text-slate-400',
            },
          ]
        : []),
    ];
  }, [filteredNotifications]);

  const handleNotifItemClick = useCallback(
    (item: GenericListItem) => {
      const n = item._raw as Notification;
      handleNotificationClick(n);
    },
    [handleNotificationClick]
  );

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  // Mode tabs - EXACTLY matching PillNavigation style
  const modeTabs: ModeTab[] = [
    {
      key: 'project',
      label: t('myWork.projectNotifications', 'Project'),
      icon: Building2,
      count: counts.project,
      activeColor: 'bg-navy-900 text-white dark:bg-white dark:text-navy-950',
    },
    {
      key: 'personal',
      label: t('myWork.personalNotifications', 'Personal'),
      icon: User,
      count: counts.personal,
      activeColor: 'bg-blue-500 text-white',
    },
    {
      key: 'all',
      label: t('myWork.allNotifications', 'All'),
      icon: Layers,
      count: counts.total,
      activeColor: 'bg-slate-700 text-white dark:bg-slate-600',
    },
  ];

  // Filter chips - EXACTLY matching QuickFilterBar style
  const filterChips: FilterChip[] = [
    { key: 'all', label: t('common.all', 'All'), icon: Layers },
    { key: 'unread', label: t('notifications.unread', 'Unread'), icon: Bell, count: counts.unread },
    { key: 'today', label: t('myWork.today', 'Today'), icon: Clock, count: counts.today },
    { key: 'week', label: t('myWork.thisWeek', 'This Week'), icon: Calendar, count: counts.week },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-navy-900">
      {/* Header - EXACTLY matching PillNavigation */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
        {/* Mode Pill Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-navy-800 rounded-lg">
          {modeTabs.map((tab) => {
            const isActive = mode === tab.key;
            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                onClick={() => setMode(tab.key)}
                className={`
                                    flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium
                                    transition-all duration-150
                                    ${
                                      isActive
                                        ? `${tab.activeColor} shadow-sm`
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/50 dark:hover:bg-white/5'
                                    }
                                `}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`
                                        px-1.5 min-w-[20px] text-center text-[10px] font-semibold rounded-full
                                        ${isActive ? 'bg-white/25' : 'bg-slate-200 dark:bg-white/10'}
                                    `}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* New Notification Button (A6.4) — admin broadcast */}
          <button
            onClick={handleCreateNotification}
            className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 rounded-lg shadow-sm hover:shadow transition-all duration-150"
          >
            <Bell size={14} />
            <span>{t('notifications.new', 'New notification')}</span>
          </button>

          {/* Mark All Read Button */}
          {counts.unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 rounded-lg shadow-sm hover:shadow transition-all duration-150"
            >
              <CheckCheck size={14} />
              <span>{t('myWork.markAllRead', 'Mark all read')}</span>
            </button>
          )}

          {/* A7.1: View style switcher */}
          <CardViewSwitcher
            moduleId="my-work-notifications"
            value={cardViewStyle}
            onChange={setCardViewStyle}
            compact
          />
        </div>
      </div>

      {/* Filter Chips - EXACTLY matching QuickFilterBar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-slate-50/50 dark:bg-navy-800/30 border-b border-slate-100 dark:border-navy-700">
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 mr-1">
          {t('common.show', 'Show')}:
        </span>

        <div className="flex items-center gap-1.5 flex-wrap">
          {filterChips.map((chip) => {
            const isActive = filter === chip.key;
            const Icon = chip.icon;
            const hasItems = chip.count === undefined || chip.count > 0;

            return (
              <button
                key={chip.key}
                onClick={() => setFilter(chip.key)}
                disabled={!hasItems && chip.key !== 'all'}
                className={`
                                    flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium
                                    transition-all duration-150
                                    ${
                                      isActive
                                        ? 'bg-slate-700 text-white dark:bg-slate-600 shadow-sm'
                                        : hasItems
                                          ? 'bg-white dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-c-border'
                                          : 'bg-slate-100 dark:bg-navy-800/50 text-slate-500 dark:text-slate-400 dark:text-slate-500 border border-transparent cursor-not-allowed opacity-50'
                                    }
                                `}
              >
                <Icon size={11} />
                <span>{chip.label}</span>
                {chip.count !== undefined && chip.count > 0 && (
                  <span
                    className={`
                                        px-1 min-w-[16px] text-center text-[10px] rounded-full
                                        ${isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/10'}
                                    `}
                  >
                    {chip.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Session-muted types quick control */}
        {mutedTypes.length > 0 && (
          <div className="ml-auto relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMutedTypesOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium bg-white dark:bg-navy-800 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-c-border transition-all"
              title={t('notifications.mutedSession', 'Muted types (session)')}
            >
              <BellOff size={11} className="text-slate-500 dark:text-slate-400" />
              {t('common.muted', 'Muted')} ({mutedTypes.length})
              <ChevronDown size={12} className="text-slate-500 dark:text-slate-400" />
            </button>

            {mutedTypesOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMutedTypesOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700/60 shadow-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-200 dark:border-navy-700/60 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {t('notifications.mutedSession', 'Muted types (session)')}
                    </span>
                    <button
                      onClick={() => setMutedTypesOpen(false)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
                    >
                      <X size={14} className="text-slate-500 dark:text-slate-400" />
                    </button>
                  </div>

                  <div className="max-h-56 overflow-auto">
                    {mutedTypes.map((type) => (
                      <div
                        key={type}
                        className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-navy-800/60"
                      >
                        <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                          {type.replace(/_/g, ' ')}
                        </span>
                        <button
                          onClick={() => unmuteNotificationTypeForSession(type)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-slate-300/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                        >
                          {t('common.unmute', 'Unmute')}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="px-3 py-2 border-t border-slate-200 dark:border-navy-700/60 flex justify-end">
                    <button
                      onClick={() => clearMutedNotificationTypesForSession()}
                      className="text-[11px] font-medium text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white"
                    >
                      {t('common.clearAll', 'Clear all')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Notifications content — switches layout based on cardViewStyle (A7.2/A7.3) */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4">
            <LoadingState template="list" rows={6} />
          </div>
        ) : filteredNotifications.length === 0 ? (
          filter !== 'all' ? (
            <EmptyState
              variant="filter"
              title={t('myWork.notifications.filterEmptyTitle', 'No notifications match this filter')}
              description={t(
                'myWork.notifications.filterEmptyDesc',
                'Try a different filter to see more notifications.',
              )}
              primaryAction={{
                label: t('common.clearFilters', 'Clear filters'),
                onClick: () => setFilter('all'),
              }}
            />
          ) : (
            <EmptyState
              variant="new"
              icon={Bell}
              title={t('myWork.noNotifications', 'No notifications')}
              description={t(
                'myWork.notifications.newEmptyDesc',
                'You are all caught up — new notifications will appear here.',
              )}
            />
          )
        ) : cardViewStyle === 'n' ? (
          <div className="p-4">
            <NotionListView
              sections={notifViewSections}
              onItemClick={handleNotifItemClick}
              emptyMessage={t('myWork.noNotifications', 'No notifications')}
            />
          </div>
        ) : cardViewStyle === 'c' ? (
          <div className="p-4">
            <ClickUpListView
              sections={notifViewSections}
              columns={NOTIFICATION_CLICKUP_COLUMNS}
              onItemClick={handleNotifItemClick}
              emptyMessage={t('myWork.noNotifications', 'No notifications')}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */  className="w-full">
              <thead className="bg-slate-50 dark:bg-navy-900 sticky top-0 z-10">
                <tr>
                  <th className="w-6 px-2 py-2"></th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('notifications.col.type', 'Type')}
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('notifications.col.title', 'Title')}
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[100px]">
                    {t('notifications.col.relatedTo', 'Related to')}
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[90px]">
                    {t('notifications.col.source', 'Source')}
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[80px]">
                    {t('notifications.col.time', 'Time')}
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[50px]">
                    {t('notifications.col.actions', '')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                {filteredNotifications.map((notification) => (
                  <tr
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.02] ${
                      !notification.read ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''
                    }`}
                  >
                    {/* Unread dot */}
                    <td className="px-2 py-2.5">
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 mx-auto" />
                      )}
                    </td>
                    {/* Type — with wrap fix (A6.1) */}
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">
                        {getNotificationIcon(notification.type, notification.severity)}
                        <span className="truncate text-slate-600 dark:text-slate-400">
                          {notification.type.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      </span>
                    </td>
                    {/* Title — single line with ellipsis */}
                    <td className="px-3 py-2.5">
                      <span
                        className={`text-[13px] block truncate max-w-[300px] ${
                          notification.read
                            ? 'text-slate-600 dark:text-slate-400'
                            : 'text-slate-900 dark:text-white font-medium'
                        }`}
                        title={notification.title}
                      >
                        {notification.title}
                      </span>
                    </td>
                    {/* Related to (A6.2) */}
                    <td className="px-3 py-2.5">
                      {notification.relatedObjectType ? (
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          {getRelatedObjectIcon(notification.relatedObjectType)}
                          <span className="text-slate-600 dark:text-slate-400">
                            {getRelatedObjectLabel(notification.relatedObjectType)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">—</span>
                      )}
                    </td>
                    {/* Source (A6.3) */}
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${
                          notification.scope === 'PROJECT'
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                            : notification.scope === 'PERSONAL'
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                              : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {notification.scope === 'PROJECT' ? (
                          <Building2 size={10} />
                        ) : notification.scope === 'PERSONAL' ? (
                          <User size={10} />
                        ) : (
                          <Sparkles size={10} />
                        )}
                        <span>{notification.scope || 'System'}</span>
                      </span>
                    </td>
                    {/* Time */}
                    <td className="px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatRelativeTime(notification.createdAt)}
                    </td>
                    {/* Actions */}
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        {!notification.read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkRead(notification.id);
                            }}
                            className="p-1 text-slate-500 dark:text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                            title={t('notifications.markRead', 'Mark as read')}
                          >
                            <Check size={13} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notification.id);
                          }}
                          className="p-1 text-slate-500 dark:text-slate-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded"
                          title={t('notifications.delete', 'Delete')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Notification Modal (A6.4) */}
      {showNewNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-navy-800 rounded-xl shadow-2xl border border-slate-200 dark:border-navy-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {t('notifications.newTitle', 'Create Notification')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {t('notifications.titleLabel', 'Title')}
                </label>
                <input
                  type="text"
                  value={newNotifTitle}
                  onChange={(e) => setNewNotifTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/40"
                  placeholder={t('notifications.titlePlaceholder', 'Notification title...')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {t('notifications.messageLabel', 'Message')}
                </label>
                <textarea
                  value={newNotifMessage}
                  onChange={(e) => setNewNotifMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/40"
                  placeholder={t('notifications.messagePlaceholder', 'Notification message...')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {t('notifications.severityLabel', 'Severity')}
                </label>
                <div className="flex gap-2">
                  {(['INFO', 'WARNING', 'CRITICAL'] as const).map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setNewNotifSeverity(sev)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        newNotifSeverity === sev
                          ? sev === 'CRITICAL'
                            ? 'bg-danger-100 border-danger-300 text-danger-700 dark:bg-danger-900/30 dark:border-danger-700 dark:text-danger-300'
                            : sev === 'WARNING'
                              ? 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300'
                              : 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                          : 'bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowNewNotification(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-600"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleSubmitNewNotification}
                disabled={creatingNotif || !newNotifTitle.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
              >
                {creatingNotif ? t('common.creating', 'Creating...') : t('common.create', 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsHub;
