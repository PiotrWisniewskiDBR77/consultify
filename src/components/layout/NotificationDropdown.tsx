import {
  AlertCircle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle,
  Info,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '../../services/api';
import { Notification } from '../../types';

export const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const [data, count] = await Promise.all([
        Api.getNotifications(false, 20), // Get recent 20
        Api.getUnreadNotificationCount(),
      ]);
      setNotifications(data);
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Optional: Poll for new notifications every 60s
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
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

  const getIcon = (type: string) => {
    if (type === 'ai_insight' || type === 'ai_message')
      return <Sparkles size={16} className="text-indigo-500" />;
    if (type.includes('task')) return <CheckCircle size={16} className="text-emerald-500" />;
    if (type === 'alert') return <AlertCircle size={16} className="text-amber-500" />;
    return <Info size={16} className="text-blue-500" />;
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
        className="relative text-slate-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 outline-none focus:ring-2 focus:ring-purple-500/20"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full px-1 border-2 border-white dark:border-navy-950 shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[420px] bg-white dark:bg-navy-900 rounded-xl shadow-xl border border-slate-200 dark:border-navy-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-navy-700 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-navy-900 dark:text-white text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-full text-xs font-medium">
                  {unreadCount} New
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 font-medium transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5"
                  title="Mark all as read"
                >
                  <Check size={12} /> Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center">
                <div className="w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
                  <Bell size={20} className="text-slate-300" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                  No notifications yet
                </p>
                <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                  You're all caught up!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-white/5">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`group relative p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer ${
                      !notification.isRead
                        ? notification.type.includes('ai')
                          ? 'bg-purple-50/50 dark:bg-purple-900/20'
                          : 'bg-slate-50 dark:bg-navy-800/30'
                        : ''
                    }`}
                    onClick={() =>
                      !notification.isRead && handleMarkAsRead(notification.id, {} as any)
                    }
                  >
                    <div className="flex gap-3 pr-8">
                      <div
                        className={`mt-0.5 shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${!notification.isRead ? 'bg-white dark:bg-white/10 shadow-sm border border-slate-200 dark:border-navy-700' : 'bg-slate-100 dark:bg-white/5'}`}
                      >
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p
                            className={`text-sm font-semibold leading-tight ${!notification.isRead ? 'text-navy-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
                          >
                            {notification.title}
                          </p>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 whitespace-nowrap mt-0.5">
                            {formatTime(notification.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">
                          {notification.message}
                        </p>

                        {/* Action Button */}
                        {notification.data?.link && (
                          <a
                            href={notification.data.link}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 bg-purple-50 dark:bg-purple-900/20 px-2.5 py-1 rounded-md transition-colors hover:bg-purple-100 dark:hover:bg-purple-900/30"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {notification.data.actionLabel || 'View'} <ArrowRight size={12} />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Actions - Always visible for better UX */}
                    <div className="absolute right-2 top-2 flex items-center gap-1 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-slate-100 dark:border-navy-700">
                      {!notification.isRead && (
                        <button
                          onClick={(e) => handleMarkAsRead(notification.id, e)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/20 rounded-md transition-colors"
                          title="Mark as read"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDelete(notification.id, e)}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {!notification.isRead && (
                      <div
                        className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${
                          notification.type.includes('ai') ? 'bg-indigo-500' : 'bg-purple-500'
                        }`}
                      ></div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with management actions */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-navy-700 bg-slate-50/50 dark:bg-white/5 flex items-center justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {notifications.length}{' '}
                {notifications.length === 1 ? 'notification' : 'notifications'}
              </div>
              <div className="flex items-center gap-2">
                {notifications.some((n) => n.isRead) && (
                  <button
                    onClick={handleClearRead}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300 font-medium transition-colors px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5"
                    title="Clear read notifications"
                  >
                    Clear read
                  </button>
                )}
                {notifications.length > 1 && (
                  <button
                    onClick={handleDeleteAll}
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"
                    title="Delete all notifications"
                  >
                    Clear all
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
