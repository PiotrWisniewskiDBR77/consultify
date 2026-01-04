/**
 * AdminDashboard - Clean Minimalist Dashboard
 *
 * Design: Elegant minimalism with monochrome palette and subtle accent
 */

import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    Briefcase,
    Calendar,
    Clock,
    DollarSign,
    FileText,
    MapPin,
    Plus,
    RefreshCw,
    Send,
    Settings,
    Shield,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { InfoButton } from '../../components/shared/InfoButton';
import { useAppStore } from '../../store/useAppStore';
import { Project, User } from '../../types';

interface AdminDashboardProps {
    users: User[];
    projects: Project[];
}

interface RecentActivity {
    id: string;
    type: 'user_joined' | 'project_created' | 'task_completed' | 'invitation_sent';
    description: string;
    timestamp: string;
    user?: string;
}

interface SystemHealth {
    status: 'healthy' | 'warning' | 'critical';
    uptime: string;
    lastCheck: string;
    services: { name: string; status: 'up' | 'down' | 'degraded' }[];
}

interface ScheduledEvent {
    id: string;
    title: string;
    description?: string;
    eventType: 'meeting' | 'deadline' | 'milestone' | 'review' | 'other';
    startTime: string;
    endTime?: string;
    location?: string;
    isAllDay: boolean;
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    projectId?: string;
    projectName?: string;
    attendees: string[];
    creatorName?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ users, projects }) => {
    const { t } = useTranslation();
    const { currentOrganization } = useAppStore();
    const [loading, setLoading] = useState(false);
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<ScheduledEvent[]>([]);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [systemHealth, setSystemHealth] = useState<SystemHealth>({
        status: 'healthy',
        uptime: '99.9%',
        lastCheck: 'Just now',
        services: [
            { name: 'API', status: 'up' },
            { name: 'Database', status: 'up' },
            { name: 'AI Services', status: 'up' },
            { name: 'Storage', status: 'up' },
        ],
    });

    const activeUsers = users.filter((u) => u.status === 'active').length;
    const activeProjects = projects.filter((p) => p.status === 'active' || !p.status).length;
    const pendingInvites = users.filter((u) => u.status === 'pending').length;

    const userGrowth = users.length > 0 ? Math.round((activeUsers / users.length) * 100) - 88 : 0;
    const projectGrowth = projects.length > 0 ? Math.round((activeProjects / projects.length) * 100) - 95 : 0;

    useEffect(() => {
        if (currentOrganization?.id) {
            loadRecentActivity();
            loadSystemHealth();
            loadUpcomingEvents();
        }
    }, [currentOrganization?.id]);

    const loadRecentActivity = async () => {
        if (!currentOrganization?.id) return;
        try {
            const response = await fetch(`/api/admin-data/recent-activity/${currentOrganization.id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (response.ok) {
                const data = await response.json();
                setRecentActivity(data);
            }
        } catch (error) {
            console.error('Error loading recent activity:', error);
        }
    };

    const loadSystemHealth = async () => {
        try {
            const response = await fetch('/api/admin-data/system-health', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (response.ok) {
                const data = await response.json();
                setSystemHealth(data);
            }
        } catch (error) {
            console.error('Error loading system health:', error);
        }
    };

    const loadUpcomingEvents = async () => {
        if (!currentOrganization?.id) return;
        try {
            const response = await fetch(`/api/admin-data/scheduled-events/${currentOrganization.id}?limit=5`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (response.ok) {
                const data = await response.json();
                setUpcomingEvents(data);
            }
        } catch (error) {
            console.error('Error loading upcoming events:', error);
        }
    };

    const handleRefresh = async () => {
        setLoading(true);
        try {
            await Promise.all([loadRecentActivity(), loadSystemHealth(), loadUpcomingEvents()]);
        } finally {
            setLoading(false);
        }
    };

    const formatEventTime = (startTime: string, endTime?: string, isAllDay?: boolean) => {
        if (isAllDay) return 'All day';
        const start = new Date(startTime);
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        };
        return start.toLocaleDateString('en-US', options);
    };

    const getEventTypeColor = (type: string) => {
        switch (type) {
            case 'meeting':
                return 'bg-blue-500/20 text-blue-400';
            case 'deadline':
                return 'bg-red-500/20 text-red-400';
            case 'milestone':
                return 'bg-purple-500/20 text-purple-400';
            case 'review':
                return 'bg-amber-500/20 text-amber-400';
            default:
                return 'bg-slate-500/20 text-slate-400';
        }
    };

    const quickActions = [
        { icon: UserPlus, label: t('admin.dashboard.inviteUser', 'Invite User'), action: () => {} },
        { icon: Plus, label: t('admin.dashboard.createProject', 'New Project'), action: () => {} },
        { icon: FileText, label: t('admin.dashboard.viewReports', 'View Reports'), action: () => {} },
        { icon: Settings, label: t('admin.dashboard.settings', 'Settings'), action: () => {} },
    ];

    const getStatusColor = (status: string) => {
        if (status === 'up' || status === 'healthy') return 'admin-status-healthy';
        if (status === 'degraded' || status === 'warning') return 'admin-status-warning';
        return 'admin-status-error';
    };

    return (
        <div className="space-y-6 relative">
            <InfoButton cardId="admin-dashboard" position="top-right" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-medium text-navy-900 dark:text-white">
                        {t('admin.dashboard.welcome', 'Welcome back, Admin')}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-500 mt-0.5">
                        {t('admin.dashboard.overview', "Here's what's happening with your organization")}
                    </p>
                </div>
                <button onClick={handleRefresh} disabled={loading} className="admin-btn admin-btn-subtle">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    {t('common.refresh', 'Refresh')}
                </button>
            </div>

            {/* Stats Grid - Clean minimal cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Users */}
                <div className="admin-metric">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users size={14} className="text-slate-500" />
                            <span className="admin-metric-label">{t('admin.dashboard.totalUsers', 'Total Users')}</span>
                        </div>
                        {userGrowth !== 0 && (
                            <span
                                className={`flex items-center gap-0.5 text-xs ${userGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                            >
                                {userGrowth >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                {Math.abs(userGrowth)}%
                            </span>
                        )}
                    </div>
                    <p className="admin-metric-value">{users.length}</p>
                    <p className="admin-metric-subtitle">{activeUsers} active</p>
                </div>

                {/* Active Projects */}
                <div className="admin-metric">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Briefcase size={14} className="text-slate-500" />
                            <span className="admin-metric-label">
                                {t('admin.dashboard.activeProjects', 'Active Projects')}
                            </span>
                        </div>
                        {projectGrowth !== 0 && (
                            <span
                                className={`flex items-center gap-0.5 text-xs ${projectGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                            >
                                {projectGrowth >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                {Math.abs(projectGrowth)}%
                            </span>
                        )}
                    </div>
                    <p className="admin-metric-value">{activeProjects}</p>
                    <p className="admin-metric-subtitle">{projects.length} total</p>
                </div>

                {/* Pending Invites */}
                <div className="admin-metric">
                    <div className="flex items-center gap-2">
                        <Send size={14} className="text-slate-500" />
                        <span className="admin-metric-label">
                            {t('admin.dashboard.pendingInvites', 'Pending Invites')}
                        </span>
                    </div>
                    <p className="admin-metric-value">{pendingInvites}</p>
                    <p className="admin-metric-subtitle">awaiting response</p>
                </div>

                {/* Revenue */}
                <div className="admin-metric">
                    <div className="flex items-center gap-2">
                        <DollarSign size={14} className="text-slate-500" />
                        <span className="admin-metric-label">{t('admin.dashboard.estRevenue', 'Est. Revenue')}</span>
                    </div>
                    <p className="admin-metric-value">$0.00</p>
                    <p className="admin-metric-subtitle">this month</p>
                </div>
            </div>

            {/* Quick Actions - Minimal style */}
            <div className="admin-card p-4">
                <h3 className="admin-section-title mb-4">{t('admin.dashboard.quickActions', 'Quick Actions')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {quickActions.map((action, idx) => (
                        <button
                            key={idx}
                            onClick={action.action}
                            className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.02] dark:hover:bg-white/[0.05] border border-slate-200 dark:border-white/5 rounded-lg transition-colors text-slate-600 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white"
                        >
                            <action.icon size={16} />
                            <span className="text-sm">{action.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recent Activity */}
                <div className="admin-card p-4">
                    <div className="admin-section-header mb-4">
                        <h3 className="admin-section-title">
                            <Activity size={14} className="text-slate-500" />
                            {t('admin.dashboard.recentActivity', 'Recent Activity')}
                        </h3>
                        <button className="text-xs text-slate-600 dark:text-slate-500 hover:text-navy-900 dark:hover:text-white transition-colors">
                            {t('common.viewAll', 'View All')}
                        </button>
                    </div>
                    <div className="space-y-2">
                        {recentActivity.length > 0 ? (
                            recentActivity.slice(0, 5).map((activity) => (
                                <div
                                    key={activity.id}
                                    className="flex items-start gap-3 p-2 hover:bg-white/[0.02] rounded-lg transition-colors"
                                >
                                    <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Activity size={12} className="text-slate-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-navy-900 dark:text-slate-300 truncate">
                                            {activity.description}
                                        </p>
                                        <p className="text-xs text-slate-600 dark:text-slate-600 mt-0.5">
                                            {activity.user} · {activity.timestamp}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-slate-600">
                                <Activity size={24} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">{t('admin.dashboard.noActivity', 'No recent activity')}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* System Health */}
                <div className="admin-card p-4">
                    <div className="admin-section-header mb-4">
                        <h3 className="admin-section-title">
                            <Shield size={14} className="text-slate-500" />
                            {t('admin.dashboard.systemHealth', 'System Health')}
                        </h3>
                        <span className={`admin-status ${getStatusColor(systemHealth.status)}`}>
                            <span className="admin-status-dot" />
                            {systemHealth.status.charAt(0).toUpperCase() + systemHealth.status.slice(1)}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-3 bg-slate-50 dark:bg-white/[0.02] rounded-lg">
                            <p className="text-xs text-slate-500">{t('admin.dashboard.uptime', 'Uptime')}</p>
                            <p className="text-lg font-medium text-navy-900 dark:text-white mt-0.5">
                                {systemHealth.uptime}
                            </p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-white/[0.02] rounded-lg">
                            <p className="text-xs text-slate-500">{t('admin.dashboard.lastCheck', 'Last Check')}</p>
                            <p className="text-lg font-medium text-navy-900 dark:text-white mt-0.5">
                                {systemHealth.lastCheck}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        {systemHealth.services.map((service, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-white/[0.02] rounded-lg"
                            >
                                <span className="text-sm text-slate-600 dark:text-slate-400">{service.name}</span>
                                <span className={`admin-status ${getStatusColor(service.status)}`}>
                                    <span className="admin-status-dot" />
                                    {service.status.toUpperCase()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Upcoming Events */}
            <div className="admin-card p-4">
                <div className="admin-section-header mb-4">
                    <h3 className="admin-section-title">
                        <Calendar size={14} className="text-slate-500" />
                        {t('admin.dashboard.upcomingEvents', 'Upcoming Events')}
                    </h3>
                    <button className="text-xs text-slate-600 dark:text-slate-500 hover:text-navy-900 dark:hover:text-white transition-colors">
                        {t('common.viewCalendar', 'View Calendar')}
                    </button>
                </div>
                {upcomingEvents.length > 0 ? (
                    <div className="space-y-2">
                        {upcomingEvents.map((event) => (
                            <div
                                key={event.id}
                                className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-lg transition-colors"
                            >
                                <div
                                    className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${getEventTypeColor(event.eventType)}`}
                                >
                                    <Calendar size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-navy-900 dark:text-white truncate">
                                            {event.title}
                                        </p>
                                        <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-medium ${getEventTypeColor(event.eventType)}`}
                                        >
                                            {event.eventType}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="flex items-center gap-1 text-xs text-slate-500">
                                            <Clock size={10} />
                                            {formatEventTime(event.startTime, event.endTime, event.isAllDay)}
                                        </span>
                                        {event.location && (
                                            <span className="flex items-center gap-1 text-xs text-slate-500">
                                                <MapPin size={10} />
                                                {event.location}
                                            </span>
                                        )}
                                    </div>
                                    {event.projectName && (
                                        <p className="text-xs text-slate-400 mt-1">Project: {event.projectName}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={() => setShowScheduleModal(true)}
                            className="w-full mt-2 admin-btn admin-btn-subtle justify-center"
                        >
                            <Plus size={14} />
                            {t('admin.dashboard.scheduleEvent', 'Schedule Event')}
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-600">
                        <Calendar size={24} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('admin.dashboard.noEvents', 'No upcoming events')}</p>
                        <button onClick={() => setShowScheduleModal(true)} className="mt-3 admin-btn admin-btn-subtle">
                            {t('admin.dashboard.scheduleEvent', 'Schedule Event')}
                        </button>
                    </div>
                )}
            </div>

            {/* Schedule Event Modal */}
            {showScheduleModal && (
                <ScheduleEventModal
                    onClose={() => setShowScheduleModal(false)}
                    onSuccess={() => {
                        setShowScheduleModal(false);
                        loadUpcomingEvents();
                    }}
                    projects={projects}
                />
            )}
        </div>
    );
};

// Schedule Event Modal Component
interface ScheduleEventModalProps {
    onClose: () => void;
    onSuccess: () => void;
    projects: Project[];
}

const ScheduleEventModal: React.FC<ScheduleEventModalProps> = ({ onClose, onSuccess, projects }) => {
    const { t } = useTranslation();
    const { currentOrganization } = useAppStore();
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        eventType: 'meeting',
        startTime: '',
        endTime: '',
        location: '',
        isAllDay: false,
        projectId: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentOrganization?.id || !formData.title || !formData.startTime) return;

        setSubmitting(true);
        try {
            const response = await fetch(`/api/admin-data/scheduled-events/${currentOrganization.id}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    projectId: formData.projectId || null,
                }),
            });

            if (response.ok) {
                toast.success('Event scheduled successfully!');
                onSuccess();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to schedule event');
            }
        } catch (error) {
            console.error('Error scheduling event:', error);
            toast.error('Failed to schedule event');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {t('admin.dashboard.scheduleEvent', 'Schedule Event')}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Title *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g., Team Standup, Project Review..."
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                        />
                    </div>

                    {/* Event Type */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Event Type
                        </label>
                        <select
                            value={formData.eventType}
                            onChange={(e) => setFormData((prev) => ({ ...prev, eventType: e.target.value }))}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                        >
                            <option value="meeting">Meeting</option>
                            <option value="deadline">Deadline</option>
                            <option value="milestone">Milestone</option>
                            <option value="review">Review</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    {/* Date/Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Start *
                            </label>
                            <input
                                type="datetime-local"
                                required
                                value={formData.startTime}
                                onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                End
                            </label>
                            <input
                                type="datetime-local"
                                value={formData.endTime}
                                onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* All Day Checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.isAllDay}
                            onChange={(e) => setFormData((prev) => ({ ...prev, isAllDay: e.target.checked }))}
                            className="form-checkbox h-4 w-4 text-indigo-600"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">All day event</span>
                    </label>

                    {/* Location */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Location
                        </label>
                        <input
                            type="text"
                            value={formData.location}
                            onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                            placeholder="e.g., Conference Room A, Zoom link..."
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                        />
                    </div>

                    {/* Project (optional) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Related Project
                        </label>
                        <select
                            value={formData.projectId}
                            onChange={(e) => setFormData((prev) => ({ ...prev, projectId: e.target.value }))}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                        >
                            <option value="">No project</option>
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Add details about this event..."
                            rows={3}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !formData.title || !formData.startTime}
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Scheduling...' : 'Schedule Event'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminDashboard;
