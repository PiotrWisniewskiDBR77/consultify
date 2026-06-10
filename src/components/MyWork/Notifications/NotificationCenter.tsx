/**
 * NotificationCenter - Central notification hub with expandable details
 * Part of My Work Module PMO Upgrade
 *
 * Features:
 * - Expandable notification panels with full details
 * - Project context badges
 * - Smart navigation to related objects
 * - Quick actions based on notification type
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Bell,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Filter,
  Folder,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useNotificationNavigation } from '../../../hooks/useNotificationNavigation';
import { Api } from '../../../services/api';
import { NotificationData, NotificationDetailPanel } from './NotificationDetailPanel';

interface Notification extends NotificationData {
  readAt?: string;
}

interface NotificationCenterProps {
  onNotificationClick?: (notification: Notification) => void;
  onOpenTaskModal?: (taskId: string) => void;
  onOpenDecisionPanel?: (decisionId: string) => void;
  onOpenInitiative?: (initiativeId: string) => void;
  maxHeight?: string;
}

/**
 * Get icon for notification type
 */
const getNotificationIcon = (type: string, severity: string) => {
  const iconClass =
    severity === 'CRITICAL'
      ? 'text-rose-500'
      : severity === 'WARNING'
        ? 'text-amber-500'
        : 'text-blue-500';

  const iconSize = 16;

  switch (type) {
    case 'TASK_ASSIGNED':
    case 'TASK_OVERDUE':
    case 'TASK_BLOCKED':
      return <CheckSquare size={iconSize} className={iconClass} />;
    case 'DECISION_REQUIRED':
    case 'DECISION_OVERDUE':
      return <AlertCircle size={iconSize} className={iconClass} />;
    case 'AI_RECOMMENDATION':
    case 'AI_RISK_DETECTED':
      return <Sparkles size={iconSize} className={iconClass} />;
    case 'GATE_PENDING_APPROVAL':
      return <Target size={iconSize} className={iconClass} />;
    default:
      return <Bell size={iconSize} className={iconClass} />;
  }
};

/**
 * Format relative time - handles invalid/missing dates gracefully
 */
const formatRelativeTime = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Recently';

  const date = new Date(dateString);

  // Check if date is valid
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

/**
 * Get severity badge color
 */
const getSeverityBadgeClass = (severity: string): string => {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300';
    case 'WARNING':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300';
    default:
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
  }
};

/**
 * Single notification item with expandable panel
 */
const NotificationItem: React.FC<{
  notification: Notification;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: () => void;
  canNavigate: boolean;
  navigationLabel: string;
}> = ({
  notification,
  isExpanded,
  onToggleExpand,
  onMarkRead,
  onDelete,
  onNavigate,
  canNavigate,
  navigationLabel,
}) => {
  const [showHoverActions, setShowHoverActions] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={`
                relative border-b border-slate-200 dark:border-navy-700
                transition-colors
                ${!notification.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
                ${isExpanded ? 'bg-slate-50/50 dark:bg-white/[0.02]' : ''}
            `}
    >
      {/* Compact View (always visible) */}
      <div
        className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
        onClick={onToggleExpand}
        onMouseEnter={() => setShowHoverActions(true)}
        onMouseLeave={() => setShowHoverActions(false)}
      >
        <div className="flex gap-3">
          {/* Unread indicator */}
          {!notification.isRead && (
            <div className="absolute left-1.5 top-6 w-1.5 h-1.5 rounded-full bg-blue-500" />
          )}

          {/* Icon */}
          <div
            className={`
                        shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                        ${
                          notification.severity === 'CRITICAL'
                            ? 'bg-rose-100 dark:bg-rose-900/30'
                            : notification.severity === 'WARNING'
                              ? 'bg-amber-100 dark:bg-amber-900/30'
                              : 'bg-blue-100 dark:bg-blue-900/30'
                        }
                    `}
          >
            {getNotificationIcon(notification.type, notification.severity)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Project Badge + Title Row */}
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <div className="flex items-center gap-2 min-w-0">
                {/* Project Badge */}
                {notification.projectName && (
                  <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-medium text-slate-600 dark:text-slate-300">
                    <Folder size={8} />
                    {notification.projectName.length > 12
                      ? notification.projectName.slice(0, 12) + '...'
                      : notification.projectName}
                  </span>
                )}
                <h4
                  className={`text-sm font-medium truncate ${
                    notification.isRead
                      ? 'text-slate-600 dark:text-slate-400'
                      : 'text-navy-900 dark:text-white'
                  }`}
                >
                  {notification.title}
                </h4>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-slate-600 dark:text-slate-500 whitespace-nowrap">
                  {formatRelativeTime(notification.createdAt)}
                </span>
                {/* Expand/Collapse indicator */}
                {isExpanded ? (
                  <ChevronUp size={12} className="text-slate-600 dark:text-slate-500" />
                ) : (
                  <ChevronDown size={12} className="text-slate-600 dark:text-slate-500" />
                )}
              </div>
            </div>

            {/* Message preview */}
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              {notification.message}
            </p>
          </div>

          {/* Quick Hover Actions (only when not expanded) */}
          <AnimatePresence>
            {showHoverActions && !isExpanded && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white dark:bg-navy-800 shadow-lg rounded-lg p-1"
                onClick={(e) => e.stopPropagation()}
              >
                {!notification.isRead && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkRead(notification.id);
                    }}
                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-green-500"
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
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-rose-500"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
                {canNavigate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate();
                    }}
                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-blue-500"
                    title={navigationLabel}
                  >
                    <ExternalLink size={14} />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Expanded Detail Panel */}
      <AnimatePresence>
        {isExpanded && (
          <NotificationDetailPanel
            notification={notification}
            onNavigate={onNavigate}
            onMarkRead={() => onMarkRead(notification.id)}
            onDelete={() => onDelete(notification.id)}
            canNavigate={canNavigate}
            navigationLabel={navigationLabel}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/**
 * NotificationCenter Component
 */
export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  onNotificationClick,
  onOpenTaskModal,
  onOpenDecisionPanel,
  onOpenInitiative,
  maxHeight = '100%',
}) => {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Navigation hook
  const { navigateToObject, canNavigate, getNavigationLabel } = useNotificationNavigation(
    onOpenTaskModal,
    onOpenDecisionPanel,
    onOpenInitiative
  );

  // Load notifications
  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await Api.get('/notifications?limit=50');
      setNotifications(response || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark as read
  const handleMarkRead = useCallback(async (id: string) => {
    try {
      await Api.patch(`/notifications/${id}/read`, {});
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, []);

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await Api.post('/notifications/mark-all-read', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success(t('myWork.notifications.markedAllRead', 'All marked as read'));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Delete notification
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await Api.delete(`/notifications/${id}`);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (expandedId === id) {
          setExpandedId(null);
        }
      } catch (error) {
        console.error('Failed to delete notification:', error);
      }
    },
    [expandedId]
  );

  // Toggle expand
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // Navigate to related object
  const handleNavigate = useCallback(
    (notification: Notification) => {
      // Mark as read when navigating
      if (!notification.isRead) {
        handleMarkRead(notification.id);
      }

      navigateToObject({
        relatedObjectType: notification.relatedObjectType as any,
        relatedObjectId: notification.relatedObjectId,
        projectId: notification.projectId,
        actionUrl: notification.actionUrl,
      });

      // Also trigger the legacy callback if provided
      onNotificationClick?.(notification);
    },
    [navigateToObject, handleMarkRead, onNotificationClick]
  );

  // Group notifications by time
  const groupedNotifications = useMemo(() => {
    const filtered = filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

    const today: Notification[] = [];
    const earlier: Notification[] = [];
    const thisWeek: Notification[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    filtered.forEach((n) => {
      const date = new Date(n.createdAt);
      if (isNaN(date.getTime()) || date >= todayStart) {
        today.push(n);
      } else if (date >= weekStart) {
        thisWeek.push(n);
      } else {
        earlier.push(n);
      }
    });

    return { today, thisWeek, earlier };
  }, [notifications, filter]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Render notification group
  const renderNotificationGroup = (items: Notification[], title: string) => {
    if (items.length === 0) return null;

    return (
      <div>
        <div className="px-4 py-2 bg-slate-50 dark:bg-white/5 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium sticky top-0 z-10">
          {title}
        </div>
        {items.map((n) => (
          <NotificationItem
            key={n.id}
            notification={n}
            isExpanded={expandedId === n.id}
            onToggleExpand={() => handleToggleExpand(n.id)}
            onMarkRead={handleMarkRead}
            onDelete={handleDelete}
            onNavigate={() => handleNavigate(n)}
            canNavigate={canNavigate({
              relatedObjectType: n.relatedObjectType,
              relatedObjectId: n.relatedObjectId,
              actionUrl: n.actionUrl,
            })}
            navigationLabel={getNavigationLabel(n.relatedObjectType)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700 shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-slate-500 dark:text-slate-400" />
          <h3 className="font-semibold text-navy-900 dark:text-white">
            {t('myWork.notifications.title', 'Notifications')}
          </h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded"
            >
              <Filter size={12} />
              {filter === 'all' ? 'All' : 'Unread'}
              <ChevronDown size={10} />
            </button>

            {showFilter && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFilter(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 py-1 z-20">
                  <button
                    onClick={() => {
                      setFilter('all');
                      setShowFilter(false);
                    }}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 dark:hover:bg-white/5 ${filter === 'all' ? 'text-primary-600 font-medium' : ''}`}
                  >
                    All notifications
                  </button>
                  <button
                    onClick={() => {
                      setFilter('unread');
                      setShowFilter(false);
                    }}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 dark:hover:bg-white/5 ${filter === 'unread' ? 'text-primary-600 font-medium' : ''}`}
                  >
                    Unread only
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mark all read */}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded"
            >
              <CheckCheck size={12} />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto mywork-scrollbar" style={{ maxHeight }}>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Clock size={24} className="animate-spin text-slate-600 dark:text-slate-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-600 dark:text-slate-500">
            <Bell size={32} className="mb-2" />
            <p className="text-sm">{t('myWork.notifications.empty', 'No notifications')}</p>
          </div>
        ) : (
          <div>
            {renderNotificationGroup(groupedNotifications.today, 'Today')}
            {renderNotificationGroup(groupedNotifications.thisWeek, 'This Week')}
            {renderNotificationGroup(groupedNotifications.earlier, 'Earlier')}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
