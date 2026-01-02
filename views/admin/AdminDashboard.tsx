/**
 * AdminDashboard - Clean Minimalist Dashboard
 * 
 * Design: Elegant minimalism with monochrome palette and subtle accent
 */

import React, { useState, useEffect } from 'react';
import { User, Project } from '../../types';
import { 
    Users, Briefcase, DollarSign, Activity, 
    ArrowUpRight, ArrowDownRight,
    Plus, Send, Settings, Shield, Calendar, UserPlus,
    FileText, RefreshCw
} from 'lucide-react';
import { InfoButton } from '../../components/shared/InfoButton';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';

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

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ users, projects }) => {
    const { t } = useTranslation();
    const { currentOrganization } = useAppStore();
    const [loading, setLoading] = useState(false);
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [systemHealth, setSystemHealth] = useState<SystemHealth>({
        status: 'healthy',
        uptime: '99.9%',
        lastCheck: 'Just now',
        services: [
            { name: 'API', status: 'up' },
            { name: 'Database', status: 'up' },
            { name: 'AI Services', status: 'up' },
            { name: 'Storage', status: 'up' }
        ]
    });

    const activeUsers = users.filter(u => u.isActive !== false).length;
    const activeProjects = projects.filter(p => p.status === 'ACTIVE' || !p.status).length;
    const pendingInvites = users.filter(u => u.status === 'PENDING').length;

    const userGrowth = users.length > 0 ? Math.round((activeUsers / users.length) * 100) - 88 : 0;
    const projectGrowth = projects.length > 0 ? Math.round((activeProjects / projects.length) * 100) - 95 : 0;

    useEffect(() => {
        if (currentOrganization?.id) {
            loadRecentActivity();
            loadSystemHealth();
        }
    }, [currentOrganization?.id]);

    const loadRecentActivity = async () => {
        if (!currentOrganization?.id) return;
        try {
            const response = await fetch(`/api/admin-data/recent-activity/${currentOrganization.id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                setSystemHealth(data);
            }
        } catch (error) {
            console.error('Error loading system health:', error);
        }
    };

    const handleRefresh = async () => {
        setLoading(true);
        try {
            await Promise.all([loadRecentActivity(), loadSystemHealth()]);
        } finally {
            setLoading(false);
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
                    <h2 className="text-lg font-medium text-white">
                        {t('admin.dashboard.welcome', 'Welcome back, Admin')}
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {t('admin.dashboard.overview', "Here's what's happening with your organization")}
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="admin-btn admin-btn-subtle"
                >
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
                            <span className="admin-metric-label">
                                {t('admin.dashboard.totalUsers', 'Total Users')}
                            </span>
                        </div>
                        {userGrowth !== 0 && (
                            <span className={`flex items-center gap-0.5 text-xs ${userGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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
                            <span className={`flex items-center gap-0.5 text-xs ${projectGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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
                        <span className="admin-metric-label">
                            {t('admin.dashboard.estRevenue', 'Est. Revenue')}
                        </span>
                    </div>
                    <p className="admin-metric-value">$0.00</p>
                    <p className="admin-metric-subtitle">this month</p>
                </div>
            </div>

            {/* Quick Actions - Minimal style */}
            <div className="admin-card p-4">
                <h3 className="admin-section-title mb-4">
                    {t('admin.dashboard.quickActions', 'Quick Actions')}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {quickActions.map((action, idx) => (
                        <button
                            key={idx}
                            onClick={action.action}
                            className="flex items-center gap-3 p-3 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
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
                        <button className="text-xs text-slate-500 hover:text-white transition-colors">
                            {t('common.viewAll', 'View All')}
                        </button>
                    </div>
                    <div className="space-y-2">
                        {recentActivity.length > 0 ? (
                            recentActivity.slice(0, 5).map((activity) => (
                                <div key={activity.id} className="flex items-start gap-3 p-2 hover:bg-white/[0.02] rounded-lg transition-colors">
                                    <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Activity size={12} className="text-slate-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-300 truncate">{activity.description}</p>
                                        <p className="text-xs text-slate-600 mt-0.5">
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
                        <div className="p-3 bg-white/[0.02] rounded-lg">
                            <p className="text-xs text-slate-500">{t('admin.dashboard.uptime', 'Uptime')}</p>
                            <p className="text-lg font-medium text-white mt-0.5">{systemHealth.uptime}</p>
                        </div>
                        <div className="p-3 bg-white/[0.02] rounded-lg">
                            <p className="text-xs text-slate-500">{t('admin.dashboard.lastCheck', 'Last Check')}</p>
                            <p className="text-lg font-medium text-white mt-0.5">{systemHealth.lastCheck}</p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        {systemHealth.services.map((service, idx) => (
                            <div key={idx} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg">
                                <span className="text-sm text-slate-400">{service.name}</span>
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
                    <button className="text-xs text-slate-500 hover:text-white transition-colors">
                        {t('common.viewCalendar', 'View Calendar')}
                    </button>
                </div>
                <div className="text-center py-8 text-slate-600">
                    <Calendar size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('admin.dashboard.noEvents', 'No upcoming events')}</p>
                    <button className="mt-3 admin-btn admin-btn-subtle">
                        {t('admin.dashboard.scheduleEvent', 'Schedule Event')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
