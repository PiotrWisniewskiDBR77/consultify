import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle,
  CheckSquare,
  Clock,
  CreditCard,
  Flag,
  Inbox,
  Info,
  Megaphone,
  MessageSquare,
  Scale,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { buildNotificationContent } from '@/components/Notifications/notificationContent';
import { type SnoozePreset, useNotificationSnooze } from '@/hooks/useNotificationSnooze';
import { usePageAwarePolling } from '@/hooks/usePageAwarePolling';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import {
  isNotificationTypeMuted,
  NOTIFICATION_MUTE_SESSION_CHANGED_EVENT,
} from '@/utils/notificationMuteSession';

import { Api } from '../../services/api';
import { Notification } from '../../types';
import TeresaMark from '../shared/TeresaMark';
export const NotificationDropdown = () => {
  const { t } = useTranslation();
  const { setCurrentView, setMyWorkIntent, isChatCollapsed, toggleChatCollapse } = useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();
  const { snooze, isSnoozed, formatRemainingTime, getSnoozedIds } = useNotificationSnooze();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const [data, count] = await Promise.all([
        Api.getNotifications(false, 20), // Get recent 20
        Api.getUnreadNotificationCount(),
      ]);
      setNotifications(
        (Array.isArray(data) ? data : []).filter((n: any) => !isNotificationTypeMuted(n.type))
      );
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageAwarePolling(fetchNotifications, {
    intervalMs: 120_000,
    initialDelayMs: 2_000,
    runImmediately: true,
  });

  // Refresh immediately when session mute changes
  useEffect(() => {
    const handle = () => fetchNotifications();
    window.addEventListener(NOTIFICATION_MUTE_SESSION_CHANGED_EVENT, handle as any);
    return () => window.removeEventListener(NOTIFICATION_MUTE_SESSION_CHANGED_EVENT, handle as any);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await Api.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      toast.error(t('notificationDropdown.toast.markReadFailed', 'Failed to mark as read'));
    }
  };

  const openInMyWork = async (notification: Notification) => {
    try {
      // Optimistic: mark as read immediately to keep badge accurate
      if (!notification.isRead) {
        await Api.markNotificationRead(notification.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
      }
    } catch {
      // ignore; detail view will retry
    }

    setMyWorkIntent({
      tab: 'inbox',
      open: {
        type: 'notification',
        id: notification.id,
        name: notification.title,
        data: notification,
      },
    });
    setCurrentView(AppView.MY_WORK);
    setIsOpen(false);
  };

  const handleMarkAllRead = async () => {
    try {
      await Api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success(t('notificationDropdown.toast.allMarkedRead', 'All marked as read'));
    } catch {
      toast.error(t('notificationDropdown.toast.actionFailed', 'Action failed'));
    }
  };

  const handleDelete = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await Api.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (!notifications.find((n) => n.id === id)?.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      toast.error(t('notificationDropdown.toast.deleteFailed', 'Failed to delete'));
    }
  };

  // Handle opening chat with notification context
  const handleOpenChat = (notification: Notification, event: React.MouseEvent) => {
    event.stopPropagation();

    // Ensure chat panel is visible
    if (isChatCollapsed) {
      toggleChatCollapse();
    }

    // Push notification context into the unified chat workspace context
    updateWorkspaceFromView(AppView.MY_WORK, notification.id, {
      type: 'notification',
      id: notification.id,
      notificationType: notification.type,
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      relatedEntity:
        notification.relatedObjectType && notification.relatedObjectId
          ? {
              type: notification.relatedObjectType,
              id: notification.relatedObjectId,
            }
          : null,
      projectId: notification.projectId || null,
      projectName: notification.projectName || null,
    });

    setIsOpen(false);
    toast.success(t('notificationDropdown.toast.chatOpened', 'Chat opened'));
  };

  // Handle snoozing a notification
  const handleSnooze = (notificationId: string, preset: SnoozePreset, event: React.MouseEvent) => {
    event.stopPropagation();
    snooze(notificationId, preset);
    setShowSnoozeMenu(null);

    const durationLabel = t(
      `notificationDropdown.snoozeDuration.${preset}`,
      {
        '1h': '1 hour',
        '4h': '4 hours',
        '1d': '1 day',
        '3d': '3 days',
      }[preset]
    );
    toast.success(
      t('notificationDropdown.toast.snoozedFor', 'Notification snoozed for {{duration}}', {
        duration: durationLabel,
      })
    );
  };

  const handleDeleteAll = async () => {
    try {
      // Delete all notifications one by one (or implement bulk delete API)
      const deletePromises = notifications.map((n) => Api.deleteNotification(n.id));
      await Promise.all(deletePromises);
      setNotifications([]);
      setUnreadCount(0);
      toast.success(t('notificationDropdown.toast.allDeleted', 'All notifications deleted'));
    } catch {
      toast.error(
        t('notificationDropdown.toast.deleteAllFailed', 'Failed to delete all notifications')
      );
    }
  };

  const handleClearRead = async () => {
    try {
      const readNotifications = notifications.filter((n) => n.isRead);
      const deletePromises = readNotifications.map((n) => Api.deleteNotification(n.id));
      await Promise.all(deletePromises);
      setNotifications((prev) => prev.filter((n) => !n.isRead));
      toast.success(t('notificationDropdown.toast.readCleared', 'Read notifications cleared'));
    } catch {
      toast.error(
        t('notificationDropdown.toast.clearReadFailed', 'Failed to clear read notifications')
      );
    }
  };

  // Type-aware icon mapping (matches NotificationDetailView TYPE_ICONS).
  // Tints follow the canonical severity palette (c.*): danger / warning /
  // success / info + brand accent for AI/DBR77. Icon color agrees with the
  // severity dot so the two never disagree.
  const getIcon = (type: string) => {
    const t = (type || '').toUpperCase();
    if (t === 'TASK_ASSIGNED') return <CheckSquare size={16} className="text-c-info" />;
    if (t === 'TASK_OVERDUE') return <Clock size={16} className="text-c-danger" />;
    if (t === 'TASK_BLOCKED') return <AlertCircle size={16} className="text-c-danger" />;
    if (t === 'DECISION_REQUIRED') return <Scale size={16} className="text-c-warning" />;
    if (t === 'DECISION_OVERDUE') return <Scale size={16} className="text-c-danger" />;
    if (t === 'GATE_PENDING_APPROVAL') return <Flag size={16} className="text-c-warning" />;
    if (t.includes('INITIATIVE_STARTED') || t.includes('INITIATIVE_COMPLETED'))
      return <Target size={16} className="text-c-success" />;
    if (t.includes('INITIATIVE_STALLED')) return <Target size={16} className="text-c-warning" />;
    if (t === 'AI_RISK_DETECTED' || t === 'AI_OVERLOAD_DETECTED')
      return <AlertTriangle size={16} className="text-c-warning" />;
    if (t === 'AI_RECOMMENDATION' || t === 'AI_DEPENDENCY_CONFLICT')
      return <TeresaMark size={16} className="text-c-accent" />;
    if (t.includes('AI')) return <Sparkles size={16} className="text-c-accent" />;
    if (t === 'SYSTEM_ALERT') return <AlertCircle size={16} className="text-c-danger" />;
    if (t === 'PAYMENT_FAILED') return <CreditCard size={16} className="text-c-danger" />;
    if (t === 'USAGE_ALERT' || t.includes('LIMIT'))
      return <AlertTriangle size={16} className="text-c-warning" />;
    if (t === 'SUBSCRIPTION_CHANGE') return <CreditCard size={16} className="text-c-info" />;
    if (t.startsWith('DBR77_')) {
      if (t.includes('KB')) return <BookOpen size={16} className="text-c-success" />;
      return <Megaphone size={16} className="text-c-accent" />;
    }
    if (t === 'MILESTONE_COMPLETED') return <CheckCircle size={16} className="text-c-success" />;
    if (t.includes('TASK')) return <CheckSquare size={16} className="text-c-info" />;
    if (t.includes('FEEDBACK') || t.includes('TICKET'))
      return <MessageSquare size={16} className="text-c-warning" />;
    return <Inbox size={16} className="text-c-text-muted" />;
  };

  // Severity color dot — canonical semantic tokens (critical=danger, NOT
  // crimson; crimson is brand-only). Neutral falls back to info.
  const getSeverityColor = (notification: Notification): string => {
    const severity = ((notification as any).severity || '').toUpperCase();
    const type = (notification.type || '').toUpperCase();

    // Auto-compute from type if no severity
    if (
      severity === 'CRITICAL' ||
      type.includes('BLOCKED') ||
      type === 'DECISION_OVERDUE' ||
      type === 'SYSTEM_ALERT' ||
      type === 'PAYMENT_FAILED'
    )
      return 'bg-c-danger';
    if (
      severity === 'WARNING' ||
      type.includes('OVERDUE') ||
      type.includes('ESCALAT') ||
      type === 'DECISION_REQUIRED' ||
      type === 'GATE_PENDING_APPROVAL' ||
      type.includes('AI_RISK') ||
      type === 'USAGE_ALERT' ||
      type.includes('LIMIT')
    )
      return 'bg-c-warning';
    if (type.startsWith('DBR77_')) return 'bg-c-accent';
    return 'bg-c-info';
  };

  // Priority badge color — semantic tokens over tinted surface.
  const getPriorityBadgeStyle = (priority: string): string => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-c-danger/10 text-c-danger border-c-danger/30';
      case 'HIGH':
        return 'bg-c-warning/10 text-c-warning border-c-warning/30';
      case 'MEDIUM':
        return 'bg-c-info/10 text-c-info border-c-info/30';
      default:
        return 'bg-c-surface text-c-text-secondary border-c-border-subtle';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffMins < 1) return t('notificationDropdown.time.justNow', 'Just now');
    if (diffMins < 60)
      return t('notificationDropdown.time.minutesAgo', '{{count}}m ago', { count: diffMins });
    if (diffHours < 24)
      return t('notificationDropdown.time.hoursAgo', '{{count}}h ago', { count: diffHours });
    return t('notificationDropdown.time.daysAgo', '{{count}}d ago', { count: diffDays });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-c-text-secondary hover:text-c-accent transition-colors p-1.5 rounded-lg hover:bg-c-surface outline-none focus:ring-2 focus:ring-c-focus"
        title={t('notificationDropdown.title', 'Inbox')}
      >
        <Inbox size={20} />
        {unreadCount > 0 && (
          <span // bialy tekst na `c-danger` dawal 3.44 (w ciemnym token podnosi sie do
            // #ed5565, co pomaga TLU, ale szkodzi TEKSTOWI na nim). Odznaka ma
            // 10px, wiec obowiazuje prog 4.5 — staly danger-600 daje ~7.4:1.
            className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-danger-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full px-1 border-2 border-c-surface shadow-sm"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[420px] bg-c-surface-raised rounded-xl shadow-xl border border-c-border-subtle overflow-hidden z-dropdown animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="px-4 py-3 border-b border-c-border-subtle flex items-center justify-between bg-c-surface">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-c-text text-sm">
                {t('notificationDropdown.title', 'Inbox')}
              </h3>
              {unreadCount > 0 && (
                <span className="bg-c-accent-soft text-c-accent px-2 py-0.5 rounded-full text-xs font-medium">
                  {unreadCount} {t('notificationDropdown.new', 'New')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setMyWorkIntent({ tab: 'inbox' });
                  setCurrentView(AppView.MY_WORK);
                  setIsOpen(false);
                }}
                className="text-xs text-c-text-secondary hover:text-c-accent font-medium transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-c-surface"
                title={t('notificationDropdown.openInbox', 'Open Inbox (Action Queue)')}
              >
                <ArrowRight size={14} /> {t('notificationDropdown.inbox', 'Inbox')}
              </button>
              <button
                onClick={() => {
                  setMyWorkIntent({ tab: 'inbox' });
                  setCurrentView(AppView.MY_WORK);
                  setIsOpen(false);
                }}
                className="text-xs text-c-text-secondary hover:text-c-accent font-medium transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-c-surface"
                title={t('notificationDropdown.openCenter', 'Open Notification Center')}
              >
                <ArrowRight size={14} /> {t('notificationDropdown.center', 'Center')}
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-c-text-secondary hover:text-c-accent font-medium transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-c-surface"
                  title={t('notificationDropdown.markAllRead', 'Mark all as read')}
                >
                  <Check size={14} /> {t('notificationDropdown.markAllReadShort', 'Mark all read')}
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-c-text-secondary hover:text-c-text rounded-md hover:bg-c-surface transition-colors"
                title={t('common.close', 'Close')}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-c-border scrollbar-track-transparent">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-c-text-muted text-sm">
                <div className="animate-spin w-5 h-5 border-2 border-c-accent border-t-transparent rounded-full mx-auto mb-2"></div>
                {t('common.loading', 'Loading...')}
              </div>
            ) : notifications.filter((n) => !isSnoozed(n.id)).length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center">
                <div className="w-12 h-12 bg-c-surface rounded-full flex items-center justify-center mb-3">
                  <Inbox size={20} className="text-c-text-muted" />
                </div>
                <p className="text-c-text-secondary text-sm font-medium">
                  {t('myWork.notifications.emptyTitle', 'No notifications')}
                </p>
                <p className="text-c-text-muted text-xs mt-1">
                  {t('myWork.notifications.emptySubtitle', "You're all caught up!")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-c-border-subtle">
                {notifications
                  .filter((n) => !isSnoozed(n.id)) // Filter out snoozed notifications
                  .map((notification) =>
                    (() => {
                      const contract = buildNotificationContent(notification as any, t);
                      const primaryLabel =
                        contract.primaryCta.kind === 'none'
                          ? t('notificationDropdown.open', 'Open')
                          : contract.primaryCta.label;
                      return (
                        <div
                          key={notification.id}
                          className={`group relative p-4 hover:bg-c-surface transition-colors cursor-pointer ${
                            !notification.isRead
                              ? notification.type.includes('ai')
                                ? 'bg-c-accent-soft'
                                : 'bg-c-surface'
                              : ''
                          }`}
                          onClick={() => openInMyWork(notification)}
                        >
                          <div className="flex gap-3 pr-8">
                            {/* Icon with severity color dot */}
                            <div className="relative mt-0.5 shrink-0">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center ${!notification.isRead ? 'bg-c-surface-raised shadow-sm border border-slate-200/60 dark:border-white/[0.03]' : 'bg-c-surface'}`}
                              >
                                {getIcon(notification.type)}
                              </div>
                              <div
                                className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-c-surface-raised ${getSeverityColor(notification)}`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p
                                  className={`text-sm font-semibold leading-tight line-clamp-2 ${!notification.isRead ? 'text-c-text' : 'text-c-text-secondary'}`}
                                >
                                  {notification.title}
                                </p>
                                <span className="text-[10px] text-c-text-muted shrink-0 whitespace-nowrap mt-0.5">
                                  {formatTime(notification.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-c-text-secondary leading-relaxed line-clamp-2">
                                {contract.contextLine || contract.whyImportant}
                              </p>

                              {/* Priority badge + Primary CTA */}
                              <div className="mt-2 inline-flex items-center gap-2">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${getPriorityBadgeStyle(contract.priority)}`}
                                >
                                  {contract.priority}
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-c-accent bg-c-accent-soft px-2.5 py-1 rounded-md transition-colors">
                                  {primaryLabel} <ArrowRight size={14} />
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Actions - Always visible for better UX */}
                          <div className="absolute right-2 top-2 flex items-center gap-1 bg-c-surface-raised/90 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-c-border-subtle">
                            {/* Chat button */}
                            <button
                              onClick={(e) => handleOpenChat(notification, e)}
                              className="p-1.5 text-c-text-secondary hover:text-c-accent hover:bg-c-accent-soft rounded-md transition-colors"
                              title={t('notificationDropdown.openChat', 'Open chat')}
                            >
                              <MessageSquare size={14} />
                            </button>

                            {/* Snooze button with dropdown */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowSnoozeMenu(
                                    showSnoozeMenu === notification.id ? null : notification.id
                                  );
                                }}
                                className="p-1.5 text-c-text-secondary hover:text-c-warning hover:bg-c-warning/10 rounded-md transition-colors"
                                title={t('notificationDropdown.snooze', 'Snooze')}
                              >
                                <Clock size={14} />
                              </button>
                              {showSnoozeMenu === notification.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-dropdown"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowSnoozeMenu(null);
                                    }}
                                  />
                                  <div className="absolute right-0 top-full mt-1 z-dropdown py-1 bg-c-surface-raised rounded-lg shadow-lg border border-c-border-subtle min-w-[100px]">
                                    {[
                                      {
                                        preset: '1h' as SnoozePreset,
                                        label: t('notificationDropdown.snoozePreset.1h', '1 hour'),
                                      },
                                      {
                                        preset: '4h' as SnoozePreset,
                                        label: t('notificationDropdown.snoozePreset.4h', '4 hours'),
                                      },
                                      {
                                        preset: '1d' as SnoozePreset,
                                        label: t('notificationDropdown.snoozePreset.1d', '1 day'),
                                      },
                                      {
                                        preset: '3d' as SnoozePreset,
                                        label: t('notificationDropdown.snoozePreset.3d', '3 days'),
                                      },
                                    ].map(({ preset, label }) => (
                                      <button
                                        key={preset}
                                        onClick={(e) => handleSnooze(notification.id, preset, e)}
                                        className="w-full px-3 py-1.5 text-left text-xs text-c-text-secondary hover:bg-c-surface transition-colors"
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>

                            {!notification.isRead && (
                              <button
                                onClick={(e) => handleMarkAsRead(notification.id, e)}
                                className="p-1.5 text-c-text-secondary hover:text-c-success hover:bg-c-success/10 rounded-md transition-colors"
                                title={t('notificationDropdown.markAsRead', 'Mark as read')}
                              >
                                <Check size={14} />
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDelete(notification.id, e)}
                              className="p-1.5 text-c-text-secondary hover:text-c-danger hover:bg-c-danger/10 rounded-md transition-colors"
                              title={t('common.delete', 'Delete')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {!notification.isRead && (
                            <div
                              className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${getSeverityColor(notification)}`}
                            ></div>
                          )}
                        </div>
                      );
                    })()
                  )}
              </div>
            )}
          </div>

          {/* Footer with management actions */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-c-border-subtle bg-c-surface flex items-center justify-between">
              <div className="text-xs text-c-text-secondary">
                {t('notificationDropdown.countLabel', {
                  count: notifications.filter((n) => !isSnoozed(n.id)).length,
                })}
                {getSnoozedIds().length > 0 && (
                  <span className="ml-2 text-c-warning">
                    ({t('notificationDropdown.snoozedLabel', { count: getSnoozedIds().length })})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {notifications.some((n) => n.isRead) && (
                  <button
                    onClick={handleClearRead}
                    className="text-xs text-c-text-secondary hover:text-c-text font-medium transition-colors px-2 py-1 rounded-md hover:bg-c-surface"
                    title={t('notificationDropdown.clearReadFull', 'Clear read notifications')}
                  >
                    {t('notificationDropdown.clearRead', 'Clear read')}
                  </button>
                )}
                {notifications.length > 1 && (
                  <button
                    onClick={handleDeleteAll}
                    className="text-xs text-c-danger hover:opacity-80 font-medium transition-opacity px-2 py-1 rounded-md hover:bg-c-danger/10"
                    title={t('notificationDropdown.deleteAllFull', 'Delete all notifications')}
                  >
                    {t('notificationDropdown.clearAll', 'Clear all')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
