import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, X, AlertCircle, Info, CheckCircle, Clock, Sparkles, ArrowRight } from 'lucide-react';
import { Api } from '../services/api';
import { Notification } from '../types';
import toast from 'react-hot-toast';

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
                Api.getUnreadNotificationCount()
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
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            toast.error('Failed to mark as read');
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await Api.markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
            toast.success('All marked as read');
        } catch (error) {
            toast.error('Failed to action');
        }
    };

    const handleDelete = async (id: string, event: React.MouseEvent) => {
        event.stopPropagation();
        try {
            await Api.deleteNotification(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
            if (!notifications.find(n => n.id === id)?.read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    const getIcon = (type: string) => {
        if (type === 'ai_insight' || type === 'ai_message') return <Sparkles size={16} className="text-indigo-500" />;
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
                className="relative text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 outline-none focus:ring-2 focus:ring-purple-500/20"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full px-1 border-2 border-white dark:border-navy-950 shadow-sm">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-navy-900 rounded-xl shadow-2xl border border-slate-100 dark:border-white/10 overflow-hidden z-[100] transform transition-all duration-200 origin-top-right animate-in fade-in zoom-in-95">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-black/20 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-navy-900 dark:text-white text-sm">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-full text-xs font-medium">
                                    {unreadCount} New
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 font-medium transition-colors flex items-center gap-1"
                            >
                                <Check size={12} /> Mark all read
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
                        {loading && notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">
                                <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                Loading...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center">
                                <div className="w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
                                    <Bell size={20} className="text-slate-300" />
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No notifications yet</p>
                                <p className="text-slate-400 text-xs mt-1">You're all caught up!</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50 dark:divide-white/5">
                                {notifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        className={`group relative p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer ${!notification.read
                                                ? (notification.type.includes('ai') ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : 'bg-purple-50/50 dark:bg-purple-900/10')
                                                : ''
                                            }`}
                                        onClick={() => !notification.read && handleMarkAsRead(notification.id, {} as any)}
                                    >
                                        <div className="flex gap-3">
                                            <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${!notification.read ? 'bg-white dark:bg-white/10 shadow-sm' : 'bg-slate-100 dark:bg-white/5'}`}>
                                                {getIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-sm font-medium truncate ${!notification.read ? 'text-navy-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                                        {notification.title}
                                                    </p>
                                                    <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                                                        {formatTime(notification.createdAt)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                                                    {notification.message}
                                                </p>

                                                {/* Action Button Small */}
                                                {notification.data?.link && (
                                                    <a
                                                        href={notification.data.link}
                                                        className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-purple-600 hover:text-purple-700 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-md transition-colors"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {notification.data.actionLabel || 'View'} <ArrowRight size={10} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/80 dark:bg-navy-900/80 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-slate-100 dark:border-white/5">
                                            {!notification.read && (
                                                <button
                                                    onClick={(e) => handleMarkAsRead(notification.id, e)}
                                                    className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/20 rounded-md transition-colors"
                                                    title="Mark as read"
                                                >
                                                    <Check size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => handleDelete(notification.id, e)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-md transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        {!notification.read && (
                                            <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${notification.type.includes('ai') ? 'bg-indigo-500' : 'bg-purple-500'
                                                }`}></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
