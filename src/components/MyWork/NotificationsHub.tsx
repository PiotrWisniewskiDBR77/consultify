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
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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
      ? 'text-red-500'
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
      return <Target size={12} className="text-purple-500" />;
    case 'PROJECT':
      return <FolderOpen size={12} className="text-emerald-500" />;
    default:
      return <FileText size={12} className="text-slate-400 dark:text-slate-500" />;
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
            <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
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
            className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
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
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
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
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
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
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded text-[11px]">
                    <Briefcase size={12} className="text-purple-500" />
                    <span className="text-purple-700 dark:text-purple-400">
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
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['thisWeek', 'earlier'])
  );

  const currentUserId = useAppStore((state) => state.currentUser?.id);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = (await Api.getNotifications(false, 50)) as any;
      setNotifications(data || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
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
      activeColor: 'bg-purple-500 text-white',
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
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
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

        {/* Mark All Read Button - EXACTLY matching New Task button style */}
        {counts.unread > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-white bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 rounded-lg shadow-sm hover:shadow transition-all duration-150"
          >
            <CheckCheck size={14} />
            <span>{t('myWork.markAllRead', 'Mark all read')}</span>
          </button>
        )}
      </div>

      {/* Filter Chips - EXACTLY matching QuickFilterBar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-slate-50/50 dark:bg-navy-800/30 border-b border-slate-100 dark:border-navy-700">
        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mr-1">
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
                                          ? 'bg-white dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-white/20'
                                          : 'bg-slate-100 dark:bg-navy-800/50 text-slate-400 dark:text-slate-500 border border-transparent cursor-not-allowed opacity-50'
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
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Bell size={40} className="text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-[13px] text-slate-500 dark:text-slate-400">
              {t('myWork.noNotifications', 'No notifications')}
            </p>
          </div>
        ) : (
          <>
            {/* This Week */}
            {groupedNotifications.thisWeek.length > 0 && (
              <div>
                <button
                  onClick={() => toggleGroup('thisWeek')}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-navy-800/50 text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                >
                  {expandedGroups.has('thisWeek') ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronRight size={12} />
                  )}
                  {t('notifications.thisWeek', 'This Week')}
                  <span className="ml-auto px-1.5 py-0.5 text-[10px] bg-slate-200 dark:bg-white/10 rounded-full">
                    {groupedNotifications.thisWeek.length}
                  </span>
                </button>

                {expandedGroups.has('thisWeek') && (
                  <AnimatePresence>
                    {groupedNotifications.thisWeek.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkRead={handleMarkRead}
                        onDelete={handleDelete}
                        onClick={handleNotificationClick}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            )}

            {/* Earlier */}
            {groupedNotifications.earlier.length > 0 && (
              <div>
                <button
                  onClick={() => toggleGroup('earlier')}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-navy-800/50 text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                >
                  {expandedGroups.has('earlier') ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronRight size={12} />
                  )}
                  {t('notifications.earlier', 'Earlier')}
                  <span className="ml-auto px-1.5 py-0.5 text-[10px] bg-slate-200 dark:bg-white/10 rounded-full">
                    {groupedNotifications.earlier.length}
                  </span>
                </button>

                {expandedGroups.has('earlier') && (
                  <AnimatePresence>
                    {groupedNotifications.earlier.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkRead={handleMarkRead}
                        onDelete={handleDelete}
                        onClick={handleNotificationClick}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationsHub;
