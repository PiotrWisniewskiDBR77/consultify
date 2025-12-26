/**
 * NotificationCenter - Central notification hub
 * Part of My Work Module PMO Upgrade
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    Check,
    CheckCheck,
    Trash2,
    Filter,
    ChevronDown,
    ExternalLink,
    AlertCircle,
    CheckSquare,
    MessageSquare,
    Target,
    Sparkles,
    Clock,
    X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Api } from '../../../services/api';
import toast from 'react-hot-toast';

interface Notification {
    id: string;
    type: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    title: string;
    message: string;
    isRead: boolean;
    readAt?: string;
    createdAt: string;
    isActionable: boolean;
    actionUrl?: string;
    relatedObjectType?: string;
    relatedObjectId?: string;
}

interface NotificationCenterProps {
    onNotificationClick?: (notification: Notification) => void;
    maxHeight?: string;
}

/**
 * Get icon for notification type
 */
const getNotificationIcon = (type: string, severity: string) => {
    const iconClass = severity === 'CRITICAL' 
        ? 'text-red-500' 
        : severity === 'WARNING' 
            ? 'text-amber-500' 
            : 'text-blue-500';
    
    const iconSize = 16;
    
    switch (type) {
        case 'TASK_ASSIGNED':
        case 'TASK_OVERDUE':
            return <CheckSquare size={iconSize} className={iconClass} />;
        case 'DECISION_REQUIRED':
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
 * Format relative time
 */
const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
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
 * Single notification item
 */
const NotificationItem: React.FC<{
    notification: Notification;
    onMarkRead: (id: string) => void;
    onDelete: (id: string) => void;
    onClick: () => void;
}> = ({ notification, onMarkRead, onDelete, onClick }) => {
    const [showActions, setShowActions] = useState(false);
    
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20, height: 0 }}
            className={`
                group relative p-4 border-b border-slate-100 dark:border-white/5 
                hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors
                ${!notification.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
            `}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
            onClick={onClick}
        >
            <div className="flex gap-3">
                {/* Icon */}
                <div className={`
                    shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                    ${notification.severity === 'CRITICAL' 
                        ? 'bg-red-100 dark:bg-red-900/30' 
                        : notification.severity === 'WARNING'
                            ? 'bg-amber-100 dark:bg-amber-900/30'
                            : 'bg-blue-100 dark:bg-blue-900/30'
                    }
                `}>
                    {getNotificationIcon(notification.type, notification.severity)}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <h4 className={`text-sm font-medium truncate ${
                            notification.isRead 
                                ? 'text-slate-600 dark:text-slate-400' 
                                : 'text-navy-900 dark:text-white'
                        }`}>
                            {notification.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {formatRelativeTime(notification.createdAt)}
                        </span>
                    </div>
                    
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {notification.message}
                    </p>
                    
                    {/* Unread indicator */}
                    {!notification.isRead && (
                        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                </div>
                
                {/* Hover Actions */}
                <AnimatePresence>
                    {showActions && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white dark:bg-navy-800 shadow-lg rounded-lg p-1"
                        >
                            {!notification.isRead && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMarkRead(notification.id);
                                    }}
                                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-green-500"
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
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-red-500"
                                title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                            {notification.isActionable && notification.actionUrl && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.location.href = notification.actionUrl!;
                                    }}
                                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-blue-500"
                                    title="Open"
                                >
                                    <ExternalLink size={14} />
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

/**
 * NotificationCenter Component
 */
export const NotificationCenter: React.FC<NotificationCenterProps> = ({
    onNotificationClick,
    maxHeight = '400px'
}) => {
    const { t } = useTranslation();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [showFilter, setShowFilter] = useState(false);
    
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
    const handleMarkRead = async (id: string) => {
        try {
            await Api.put(`/notifications/${id}/read`);
            setNotifications(prev => 
                prev.map(n => n.id === id ? { ...n, isRead: true } : n)
            );
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };
    
    // Mark all as read
    const handleMarkAllRead = async () => {
        try {
            await Api.put('/notifications/mark-all-read');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            toast.success(t('myWork.notifications.markedAllRead', 'All marked as read'));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };
    
    // Delete notification
    const handleDelete = async (id: string) => {
        try {
            await Api.delete(`/notifications/${id}`);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    };
    
    // Group notifications by time
    const groupedNotifications = useMemo(() => {
        const filtered = filter === 'unread' 
            ? notifications.filter(n => !n.isRead)
            : notifications;
        
        const today: Notification[] = [];
        const earlier: Notification[] = [];
        const thisWeek: Notification[] = [];
        
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        filtered.forEach(n => {
            const date = new Date(n.createdAt);
            if (date >= todayStart) {
                today.push(n);
            } else if (date >= weekStart) {
                thisWeek.push(n);
            } else {
                earlier.push(n);
            }
        });
        
        return { today, thisWeek, earlier };
    }, [notifications, filter]);
    
    const unreadCount = notifications.filter(n => !n.isRead).length;
    
    return (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                    <Bell size={18} className="text-slate-500" />
                    <h3 className="font-semibold text-navy-900 dark:text-white">
                        {t('myWork.notifications.title', 'Notifications')}
                    </h3>
                    {unreadCount > 0 && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </div>
                
                <div className="flex items-center gap-2">
                    {/* Filter */}
                    <div className="relative">
                        <button
                            onClick={() => setShowFilter(!showFilter)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded"
                        >
                            <Filter size={12} />
                            {filter === 'all' ? 'All' : 'Unread'}
                            <ChevronDown size={10} />
                        </button>
                        
                        {showFilter && (
                            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 py-1 z-10">
                                <button
                                    onClick={() => { setFilter('all'); setShowFilter(false); }}
                                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 dark:hover:bg-white/5 ${filter === 'all' ? 'text-brand font-medium' : ''}`}
                                >
                                    All notifications
                                </button>
                                <button
                                    onClick={() => { setFilter('unread'); setShowFilter(false); }}
                                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 dark:hover:bg-white/5 ${filter === 'unread' ? 'text-brand font-medium' : ''}`}
                                >
                                    Unread only
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {/* Mark all read */}
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllRead}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-brand hover:bg-slate-100 dark:hover:bg-white/5 rounded"
                        >
                            <CheckCheck size={12} />
                            Mark all read
                        </button>
                    )}
                </div>
            </div>
            
            {/* Notifications List */}
            <div className="overflow-y-auto mywork-scrollbar" style={{ maxHeight }}>
                {loading ? (
                    <div className="flex items-center justify-center p-8">
                        <Clock size={24} className="animate-spin text-slate-400" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                        <Bell size={32} className="mb-2" />
                        <p className="text-sm">{t('myWork.notifications.empty', 'No notifications')}</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {/* Today */}
                        {groupedNotifications.today.length > 0 && (
                            <div>
                                <div className="px-4 py-2 bg-slate-50 dark:bg-white/5 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                                    Today
                                </div>
                                {groupedNotifications.today.map(n => (
                                    <NotificationItem
                                        key={n.id}
                                        notification={n}
                                        onMarkRead={handleMarkRead}
                                        onDelete={handleDelete}
                                        onClick={() => onNotificationClick?.(n)}
                                    />
                                ))}
                            </div>
                        )}
                        
                        {/* This Week */}
                        {groupedNotifications.thisWeek.length > 0 && (
                            <div>
                                <div className="px-4 py-2 bg-slate-50 dark:bg-white/5 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                                    This Week
                                </div>
                                {groupedNotifications.thisWeek.map(n => (
                                    <NotificationItem
                                        key={n.id}
                                        notification={n}
                                        onMarkRead={handleMarkRead}
                                        onDelete={handleDelete}
                                        onClick={() => onNotificationClick?.(n)}
                                    />
                                ))}
                            </div>
                        )}
                        
                        {/* Earlier */}
                        {groupedNotifications.earlier.length > 0 && (
                            <div>
                                <div className="px-4 py-2 bg-slate-50 dark:bg-white/5 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                                    Earlier
                                </div>
                                {groupedNotifications.earlier.map(n => (
                                    <NotificationItem
                                        key={n.id}
                                        notification={n}
                                        onMarkRead={handleMarkRead}
                                        onDelete={handleDelete}
                                        onClick={() => onNotificationClick?.(n)}
                                    />
                                ))}
                            </div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};

export default NotificationCenter;

