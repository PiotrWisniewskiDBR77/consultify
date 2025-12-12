import React, { useEffect, useState } from 'react';
import {
    Bell, Info, CheckCircle2, AlertTriangle, ArrowRight,
    Sparkles, Layout, Settings, Filter, Trash2, Megaphone, Send, X, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Api } from '../../services/api';
import toast from 'react-hot-toast';

interface NotificationData {
    priority?: 'high' | 'normal' | 'low';
    category?: 'ai' | 'task' | 'system';
    actionLabel?: string;
    link?: string;
}

interface Notification {
    id: string;
    type: 'system' | 'task' | 'task_assigned' | 'alert' | 'info' | 'ai_insight' | 'ai_message';
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
    data?: NotificationData;
}

export const NotificationCenter: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [activePriority, setActivePriority] = useState<'all' | 'high' | 'normal' | 'low'>('all');
    const [activeDate, setActiveDate] = useState<'all' | 'today' | 'week'>('all');
    const [openFilter, setOpenFilter] = useState<'priority' | 'date' | null>(null);
    const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
    const [broadcastData, setBroadcastData] = useState({ title: '', message: '', priority: 'normal' as 'normal' | 'high' | 'low' });
    const [sending, setSending] = useState(false);

    const toggleFilter = (filter: 'priority' | 'date') => {
        setOpenFilter(prev => prev === filter ? null : filter);
    };

    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3005/api/notifications', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                // Sort by date desc
                setNotifications(data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            }
        } catch (error) {
            console.error('Failed to fetch notifications', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id: string, event?: React.MouseEvent) => {
        event?.stopPropagation();
        try {
            const token = localStorage.getItem('token');
            await fetch(`http://localhost:3005/api/notifications/${id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (error) {
            console.error('Failed to mark read', error);
        }
    };

    const markAllRead = async () => {
        try {
            const token = localStorage.getItem('token');
            await fetch('http://localhost:3005/api/notifications/read-all', {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (error) {
            console.error('Failed to mark all read', error);
        }
    };

    const deleteNotification = async (id: string, event: React.MouseEvent) => {
        event.stopPropagation();
        try {
            const token = localStorage.getItem('token');
            await fetch(`http://localhost:3005/api/notifications/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('Failed to delete', error);
        }
    };

    const handleBroadcast = async () => {
        if (!broadcastData.title || !broadcastData.message) return;
        try {
            setSending(true);
            await Api.createNotification({
                type: 'alert',
                title: broadcastData.title,
                message: broadcastData.message,
                priority: broadcastData.priority,
                category: 'system'
            });
            toast.success('Notification broadcasted!');
            setIsBroadcastOpen(false);
            setBroadcastData({ title: '', message: '', priority: 'normal' });
            fetchNotifications();
        } catch (error) {
            toast.error('Failed to broadcast');
        } finally {
            setSending(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const getTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = (now.getTime() - date.getTime()) / 1000;

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    const filteredNotifications = notifications.filter(n => {
        // Priority Filter
        if (activePriority !== 'all' && (n.data?.priority || 'normal') !== activePriority) return false;

        // Date Filter
        if (activeDate !== 'all') {
            const date = new Date(n.createdAt);
            const now = new Date();
            const diffDays = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);

            if (activeDate === 'today' && diffDays > 1) return false;
            if (activeDate === 'week' && diffDays > 7) return false;
        }

        return true;
    });

    const getIcon = (type: string) => {
        if (type === 'ai_insight' || type === 'ai_message') return <Sparkles size={18} className="text-indigo-500" />;
        if (type.includes('task')) return <CheckCircle2 size={18} className="text-emerald-500" />;
        if (type === 'alert') return <AlertTriangle size={18} className="text-red-500" />;
        return <Info size={18} className="text-blue-500" />;
    };

    const getCardStyle = (notif: Notification) => {
        const priority = notif.data?.priority || 'normal';
        let borderClass = 'border-slate-100';

        // Highlight high priority alerts
        if (priority === 'high' && !notif.read) {
            borderClass = 'border-l-4 border-l-red-500 border-slate-200 dark:border-white/10 bg-red-50/20 dark:bg-red-900/20';
        } else if (notif.read) {
            borderClass = 'border-transparent bg-transparent hover:bg-slate-50 dark:hover:bg-white/5';
        } else {
            // Unread normal
            borderClass = 'bg-white dark:bg-navy-800 border-slate-100 dark:border-navy-700 shadow-sm dark:shadow-none bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-900/20 dark:to-transparent';
        }

        return `group p-4 rounded-xl border transition-all hover:shadow-md cursor-pointer relative overflow-hidden ${borderClass}`;
    };

    return (
        <div className="bg-white dark:bg-navy-800 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm h-full flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-lg shadow-sm">
                            <Bell size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-navy-900 dark:text-white">Notification Center</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Manage your alerts & updates</p>
                        </div>
                    </div>
                    <button
                        onClick={markAllRead}
                        className="text-xs font-medium text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 transition-colors"
                    >
                        Mark all read
                    </button>
                    {/* Broadcast Button (Visible for admins ideally, but here for all as requested) */}
                    <button
                        onClick={() => setIsBroadcastOpen(true)}
                        className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/20 rounded-md transition-colors"
                        title="Broadcast Notification"
                    >
                        <Megaphone size={16} />
                    </button>
                </div>

                {/* Filters - Dropdowns */}
                <div className="flex items-center gap-2">
                    {/* Priority Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => toggleFilter('priority')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${activePriority !== 'all'
                                ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/20 dark:text-purple-300'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-navy-900 dark:border-white/10 dark:text-slate-300'
                                }`}
                        >
                            <span className="opacity-70">Priority:</span>
                            <span className="capitalize">{activePriority}</span>
                            <Filter size={12} className="opacity-50" />
                        </button>

                        {openFilter === 'priority' && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenFilter(null)}></div>
                                <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-white/10 z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    {[
                                        { id: 'all', label: 'All' },
                                        { id: 'high', label: 'High', color: 'text-red-600' },
                                        { id: 'normal', label: 'Normal', color: 'text-blue-600' },
                                        { id: 'low', label: 'Low', color: 'text-slate-600' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => {
                                                setActivePriority(opt.id as any);
                                                setOpenFilter(null);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2 ${activePriority === opt.id ? 'font-semibold bg-slate-50 dark:bg-white/5' : ''
                                                } ${opt.color || 'text-slate-700 dark:text-slate-200'}`}
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full ${opt.id === 'all' ? 'bg-slate-400' : opt.id === 'high' ? 'bg-red-500' : opt.id === 'normal' ? 'bg-blue-500' : 'bg-slate-500'} `}></div>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Date Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => toggleFilter('date')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${activeDate !== 'all'
                                ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/20 dark:text-purple-300'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-navy-900 dark:border-white/10 dark:text-slate-300'
                                }`}
                        >
                            <span className="opacity-70">Time:</span>
                            <span>{activeDate === 'all' ? 'Any Time' : activeDate === 'today' ? 'Today' : 'Last 7 Days'}</span>
                            <Filter size={12} className="opacity-50" />
                        </button>

                        {openFilter === 'date' && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenFilter(null)}></div>
                                <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-white/10 z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    {[
                                        { id: 'all', label: 'Any Time' },
                                        { id: 'today', label: 'Today' },
                                        { id: 'week', label: 'Last 7 Days' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => {
                                                setActiveDate(opt.id as any);
                                                setOpenFilter(null);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${activeDate === opt.id ? 'font-semibold bg-slate-50 dark:bg-white/5 text-purple-600 dark:text-purple-400' : 'text-slate-700 dark:text-slate-200'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {loading && (
                    <div className="text-center p-8">
                        <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-xs text-slate-400">Syncing...</p>
                    </div>
                )}

                {!loading && filteredNotifications.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 opacity-50">
                        <Filter size={32} className="mb-3" />
                        <p className="text-sm">No notifications in this category</p>
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {filteredNotifications.map((notif) => (
                        <motion.div
                            key={notif.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            onClick={() => markAsRead(notif.id)}
                            className={getCardStyle(notif)}
                        >
                            <div className="flex gap-4">
                                <div className="shrink-0 mt-1">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${notif.read ? 'bg-slate-100 text-slate-400' : 'bg-white shadow-sm'
                                        }`}>
                                        {getIcon(notif.type)}
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h4 className={`text-sm font-semibold truncate ${notif.read ? 'text-slate-500' : 'text-navy-900'}`}>
                                            {notif.title}
                                        </h4>
                                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{getTimeAgo(notif.createdAt)}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed mb-2">
                                        {notif.message}
                                    </p>

                                    {/* Action Area */}
                                    {notif.data?.link && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <a
                                                href={notif.data.link}
                                                onClick={(e) => e.stopPropagation()}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:text-purple-600 hover:border-purple-200 transition-colors shadow-sm"
                                            >
                                                {notif.data.actionLabel || 'View Details'}
                                                <ArrowRight size={12} />
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* Controls */}
                                <div className="shrink-0 flex flex-col justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => deleteNotification(notif.id, e)}
                                        className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                {!notif.read && (
                                    <div className="absolute top-4 right-4 w-2 h-2 bg-purple-500 rounded-full"></div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Broadcast Modal */}
            <AnimatePresence>
                {isBroadcastOpen && (
                    <div className="absolute inset-0 z-50 rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in zoom-in-95">
                        <div className="w-full max-w-sm space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-navy-900 dark:text-white flex items-center gap-2">
                                    <Megaphone size={18} className="text-purple-500" /> Broadcast
                                </h3>
                                <button onClick={() => setIsBroadcastOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                    <X size={18} />
                                </button>
                            </div>

                            <input
                                autoFocus
                                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                                placeholder="Title"
                                value={broadcastData.title}
                                onChange={e => setBroadcastData({ ...broadcastData, title: e.target.value })}
                            />

                            <textarea
                                className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500 resize-none h-24"
                                placeholder="Message to organization..."
                                value={broadcastData.message}
                                onChange={e => setBroadcastData({ ...broadcastData, message: e.target.value })}
                            />

                            <div className="flex gap-2">
                                {['low', 'normal', 'high'].map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setBroadcastData({ ...broadcastData, priority: p as any })}
                                        className={`flex-1 py-1 text-xs font-medium rounded-md border transition-colors ${broadcastData.priority === p
                                            ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-500/20 dark:border-purple-500/30 dark:text-purple-300'
                                            : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5'
                                            }`}
                                    >
                                        {p.charAt(0).toUpperCase() + p.slice(1)}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleBroadcast}
                                disabled={sending || !broadcastData.title || !broadcastData.message}
                                className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-medium shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {sending ? 'Sending...' : <><Send size={16} /> Send Broadcast</>}
                            </button>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>

    );
};
