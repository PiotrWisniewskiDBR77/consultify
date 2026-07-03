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
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
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
      toast.error('Failed to mark as read');
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
      toast.success('All marked as read');
    } catch {
      toast.error('Failed to action');
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
      toast.error('Failed to delete');
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
    toast.success(isPolish ? 'Otwarto czat' : 'Chat opened');
  };

  // Handle snoozing a notification
  const handleSnooze = (notificationId: string, preset: SnoozePreset, event: React.MouseEvent) => {
    event.stopPropagation();
    snooze(notificationId, preset);
    setShowSnoozeMenu(null);

    const presetLabels: Record<SnoozePreset, { en: string; pl: string }> = {
      '1h': { en: '1 hour', pl: '1 godzinę' },
      '4h': { en: '4 hours', pl: '4 godziny' },
      '1d': { en: '1 day', pl: '1 dzień' },
      '3d': { en: '3 days', pl: '3 dni' },
    };
    toast.success(
      isPolish
        ? `Powiadomienie odłożone na ${presetLabels[preset].pl}`
        : `Notification snoozed for ${presetLabels[preset].en}`
    );
  };

  const handleDeleteAll = async () => {
    try {
      // Delete all notifications one by one (or implement bulk delete API)
      const deletePromises = notifications.map((n) => Api.deleteNotification(n.id));
      await Promise.all(deletePromises);
      setNotifications([]);
      setUnreadCount(0);
      toast.success('All notifications deleted');
    } catch {
      toast.error('Failed to delete all notifications');
    }
  };

  const handleClearRead = async () => {
    try {
      const readNotifications = notifications.filter((n) => n.isRead);
      const deletePromises = readNotifications.map((n) => Api.deleteNotification(n.id));
      await Promise.all(deletePromises);
      setNotifications((prev) => prev.filter((n) => !n.isRead));
      toast.success('Read notifications cleared');
    } catch {
      toast.error('Failed to clear read notifications');
    }
  };

  // Type-aware icon mapping (matches NotificationDetailView TYPE_ICONS)
  const getIcon = (type: string) => {
    const t = (type || '').toUpperCase();
    if (t === 'TASK_ASSIGNED') return <CheckSquare size={16} className="text-blue-400" />;
    if (t === 'TASK_OVERDUE') return <Clock size={16} className="text-danger-400" />;
    if (t === 'TASK_BLOCKED') return <AlertCircle size={16} className="text-danger-400" />;
    if (t === 'DECISION_REQUIRED') return <Scale size={16} className="text-primary-400" />;
    if (t === 'DECISION_OVERDUE') return <Scale size={16} className="text-danger-400" />;
    if (t === 'GATE_PENDING_APPROVAL') return <Flag size={16} className="text-amber-400" />;
    if (t.includes('INITIATIVE_STARTED') || t.includes('INITIATIVE_COMPLETED'))
      return <Target size={16} className="text-emerald-400" />;
    if (t.includes('INITIATIVE_STALLED')) return <Target size={16} className="text-amber-400" />;
    if (t === 'AI_RISK_DETECTED' || t === 'AI_OVERLOAD_DETECTED')
      return <AlertTriangle size={16} className="text-amber-400" />;
    if (t === 'AI_RECOMMENDATION' || t === 'AI_DEPENDENCY_CONFLICT')
      return <TeresaMark size={16} className="text-primary-400" />;
    if (t.includes('AI')) return <Sparkles size={16} className="text-indigo-500" />;
    if (t === 'SYSTEM_ALERT') return <AlertCircle size={16} className="text-danger-500" />;
    if (t === 'PAYMENT_FAILED') return <CreditCard size={16} className="text-danger-500" />;
    if (t === 'USAGE_ALERT' || t.includes('LIMIT'))
      return <AlertTriangle size={16} className="text-amber-400" />;
    if (t === 'SUBSCRIPTION_CHANGE') return <CreditCard size={16} className="text-indigo-400" />;
    if (t.startsWith('DBR77_')) {
      if (t.includes('KB')) return <BookOpen size={16} className="text-emerald-400" />;
      return <Megaphone size={16} className="text-primary-400" />;
    }
    if (t === 'MILESTONE_COMPLETED') return <CheckCircle size={16} className="text-emerald-500" />;
    if (t.includes('TASK')) return <CheckSquare size={16} className="text-blue-400" />;
    if (t.includes('FEEDBACK') || t.includes('TICKET'))
      return <MessageSquare size={16} className="text-amber-400" />;
    return <Inbox size={16} className="text-slate-600" />;
  };

  // Severity color dot
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
      return 'bg-danger-500';
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
      return 'bg-amber-500';
    if (type.startsWith('DBR77_')) return 'bg-navy-900';
    return 'bg-blue-500';
  };

  // Priority badge color
  const getPriorityBadgeStyle = (priority: string): string => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-danger-500/10 text-danger-500 border-danger-500/30';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
      default:
        return 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-navy-700';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 outline-none focus:ring-2 focus:ring-primary-500/20"
        title={isPolish ? 'Inbox' : 'Inbox'}
      >
        <Inbox size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-danger-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full px-1 border-2 border-white dark:border-navy-950 shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[420px] bg-white dark:bg-navy-900 rounded-xl shadow-xl border border-slate-200 dark:border-navy-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* Header - Purple gradient following standard */}
          <div className="px-4 py-3 border-b border-primary-200/40 dark:border-primary-500/20 flex items-center justify-between bg-gradient-to-r from-white/80 via-primary-50/30 to-white/80 dark:from-navy-900/80 dark:via-primary-900/20 dark:to-navy-900/80">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-navy-900 dark:text-white text-sm">
                {isPolish ? 'Inbox' : 'Inbox'}
              </h3>
              {unreadCount > 0 && (
                <span className="bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-300 px-2 py-0.5 rounded-full text-xs font-medium">
                  {unreadCount} {isPolish ? 'Nowe' : 'New'}
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
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5"
                title={isPolish ? 'Otwórz skrzynkę' : 'Open Inbox (Action Queue)'}
              >
                <ArrowRight size={14} /> {isPolish ? 'Skrzynka' : 'Inbox'}
              </button>
              <button
                onClick={() => {
                  setMyWorkIntent({ tab: 'inbox' });
                  setCurrentView(AppView.MY_WORK);
                  setIsOpen(false);
                }}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5"
                title={isPolish ? 'Otwórz centrum powiadomień' : 'Open Notification Center'}
              >
                <ArrowRight size={14} /> {isPolish ? 'Centrum' : 'Center'}
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5"
                  title={isPolish ? 'Oznacz wszystkie jako przeczytane' : 'Mark all as read'}
                >
                  <Check size={14} /> {isPolish ? 'Przeczytane' : 'Mark all read'}
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                title={isPolish ? 'Zamknij' : 'Close'}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-600 dark:text-slate-500 text-sm">
                <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                {isPolish ? 'Ładowanie...' : 'Loading...'}
              </div>
            ) : notifications.filter((n) => !isSnoozed(n.id)).length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center">
                <div className="w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
                  <Inbox size={20} className="text-slate-600" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                  {isPolish ? 'Brak powiadomień' : 'No notifications yet'}
                </p>
                <p className="text-slate-600 dark:text-slate-500 text-xs mt-1">
                  {isPolish ? 'Wszystko załatwione!' : "You're all caught up!"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-white/5">
                {notifications
                  .filter((n) => !isSnoozed(n.id)) // Filter out snoozed notifications
                  .map((notification) =>
                    (() => {
                      const contract = buildNotificationContent(notification as any, t);
                      const primaryLabel =
                        contract.primaryCta.kind === 'none'
                          ? isPolish
                            ? 'Otwórz'
                            : 'Open'
                          : contract.primaryCta.label;
                      return (
                        <div
                          key={notification.id}
                          className={`group relative p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer ${
                            !notification.isRead
                              ? notification.type.includes('ai')
                                ? 'bg-primary-50/50 dark:bg-primary-900/20'
                                : 'bg-slate-50 dark:bg-navy-800/30'
                              : ''
                          }`}
                          onClick={() => openInMyWork(notification)}
                        >
                          <div className="flex gap-3 pr-8">
                            {/* Icon with severity color dot */}
                            <div className="relative mt-0.5 shrink-0">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center ${!notification.isRead ? 'bg-white dark:bg-white/10 shadow-sm border border-slate-200 dark:border-navy-700' : 'bg-slate-100 dark:bg-white/5'}`}
                              >
                                {getIcon(notification.type)}
                              </div>
                              <div
                                className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-navy-900 ${getSeverityColor(notification)}`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p
                                  className={`text-sm font-semibold leading-tight line-clamp-2 ${!notification.isRead ? 'text-navy-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
                                >
                                  {notification.title}
                                </p>
                                <span className="text-[10px] text-slate-600 dark:text-slate-500 shrink-0 whitespace-nowrap mt-0.5">
                                  {formatTime(notification.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                                {contract.contextLine || contract.whyImportant}
                              </p>

                              {/* Priority badge + Primary CTA */}
                              <div className="mt-2 inline-flex items-center gap-2">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${getPriorityBadgeStyle(contract.priority)}`}
                                >
                                  {contract.priority}
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 dark:bg-primary-900/20 px-2.5 py-1 rounded-md transition-colors hover:bg-primary-100 dark:hover:bg-primary-900/30">
                                  {primaryLabel} <ArrowRight size={14} />
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Actions - Always visible for better UX */}
                          <div className="absolute right-2 top-2 flex items-center gap-1 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-slate-200 dark:border-navy-700">
                            {/* Chat button */}
                            <button
                              onClick={(e) => handleOpenChat(notification, e)}
                              className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/20 rounded-md transition-colors"
                              title={isPolish ? 'Otwórz czat' : 'Open chat'}
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
                                className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded-md transition-colors"
                                title={isPolish ? 'Odłóż' : 'Snooze'}
                              >
                                <Clock size={14} />
                              </button>
                              {showSnoozeMenu === notification.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowSnoozeMenu(null);
                                    }}
                                  />
                                  <div className="absolute right-0 top-full mt-1 z-50 py-1 bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 min-w-[100px]">
                                    {[
                                      {
                                        preset: '1h' as SnoozePreset,
                                        label: isPolish ? '1 godz.' : '1 hour',
                                      },
                                      {
                                        preset: '4h' as SnoozePreset,
                                        label: isPolish ? '4 godz.' : '4 hours',
                                      },
                                      {
                                        preset: '1d' as SnoozePreset,
                                        label: isPolish ? '1 dzień' : '1 day',
                                      },
                                      {
                                        preset: '3d' as SnoozePreset,
                                        label: isPolish ? '3 dni' : '3 days',
                                      },
                                    ].map(({ preset, label }) => (
                                      <button
                                        key={preset}
                                        onClick={(e) => handleSnooze(notification.id, preset, e)}
                                        className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
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
                                className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 rounded-md transition-colors"
                                title={isPolish ? 'Oznacz jako przeczytane' : 'Mark as read'}
                              >
                                <Check size={14} />
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDelete(notification.id, e)}
                              className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/20 rounded-md transition-colors"
                              title={isPolish ? 'Usuń' : 'Delete'}
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
            <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-700 bg-slate-50/50 dark:bg-white/5 flex items-center justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {notifications.filter((n) => !isSnoozed(n.id)).length}{' '}
                {isPolish
                  ? notifications.filter((n) => !isSnoozed(n.id)).length === 1
                    ? 'powiadomienie'
                    : 'powiadomień'
                  : notifications.filter((n) => !isSnoozed(n.id)).length === 1
                    ? 'notification'
                    : 'notifications'}
                {getSnoozedIds().length > 0 && (
                  <span className="ml-2 text-amber-500">
                    ({getSnoozedIds().length} {isPolish ? 'odłożone' : 'snoozed'})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {notifications.some((n) => n.isRead) && (
                  <button
                    onClick={handleClearRead}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300 font-medium transition-colors px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5"
                    title={isPolish ? 'Wyczyść przeczytane' : 'Clear read notifications'}
                  >
                    {isPolish ? 'Wyczyść przeczytane' : 'Clear read'}
                  </button>
                )}
                {notifications.length > 1 && (
                  <button
                    onClick={handleDeleteAll}
                    className="text-xs text-danger-600 hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-300 font-medium transition-colors px-2 py-1 rounded-md hover:bg-danger-50 dark:hover:bg-danger-500/10"
                    title={isPolish ? 'Usuń wszystkie' : 'Delete all notifications'}
                  >
                    {isPolish ? 'Usuń wszystkie' : 'Clear all'}
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
