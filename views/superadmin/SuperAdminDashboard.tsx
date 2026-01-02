/**
 * SuperAdminDashboard - Minimalist Dashboard
 * 
 * Redesigned with elegant technological minimalism:
 * - No colorful gradients
 * - Clean metric displays
 * - Subtle interactions
 */

import React from 'react';
import { 
    Building, 
    Users, 
    Brain, 
    Zap, 
    Activity, 
    DollarSign, 
    ChevronRight,
    UserPlus,
    TrendingUp,
    Clock
} from 'lucide-react';
import { MetricCard } from '../../components/Admin/shared/MetricCard';
import { Card, Section } from '../../components/Admin/shared/Card';
import { PageHeader } from '../../components/Admin/shared/PageHeader';

interface SuperAdminStats {
    totalOrgs: number;
    totalUsers: number;
    revenue: number;
    aiCalls: number;
    tokens: number;
    activeUsers7d: number;
    liveUsers: number;
    pendingRequests: number;
}

interface ActivityItem {
    id?: string;
    user_name?: string;
    user_email?: string;
    action?: string;
    entity_type?: string;
    entity_name?: string;
    entity_id?: string;
    created_at?: string;
}

interface SuperAdminDashboardProps {
    stats: SuperAdminStats;
    activities: ActivityItem[];
    loading: boolean;
    onRefresh: () => void;
    onNavigateToOrganizations: () => void;
    onNavigateToUsers: () => void;
    onNavigateToBilling: () => void;
}

// Quick Action Button - Minimalist
const QuickAction: React.FC<{
    icon: React.ElementType;
    label: string;
    description: string;
    onClick: () => void;
    badge?: number;
}> = ({ icon: Icon, label, description, onClick, badge }) => (
    <button
        onClick={onClick}
        className="group relative border border-white/[0.06] hover:border-white/[0.12] rounded-xl p-4 text-left transition-all hover:bg-white/[0.02]"
    >
        {badge !== undefined && badge > 0 && (
            <span className="absolute top-3 right-3 bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {badge}
            </span>
        )}
        <div className="flex items-center gap-3 mb-1.5">
            <Icon size={18} className="text-slate-400 group-hover:text-slate-300 transition-colors" />
            <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                {label}
            </span>
            <ChevronRight size={14} className="ml-auto text-slate-600 group-hover:text-slate-400 transition-colors" />
        </div>
        <p className="text-xs text-slate-500">{description}</p>
    </button>
);

// Activity Item - Clean
const ActivityRow: React.FC<{ activity: ActivityItem }> = ({ activity }) => {
    const actionColors: Record<string, string> = {
        created: 'bg-emerald-400',
        deleted: 'bg-red-400',
        updated: 'bg-blue-400',
    };
    
    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-b-0">
            <span className={`w-1.5 h-1.5 rounded-full ${actionColors[activity.action || ''] || 'bg-slate-500'}`} />
            <span className="text-sm text-slate-400 min-w-[100px] truncate">
                {activity.user_name || activity.user_email || 'System'}
            </span>
            <span className="text-xs text-slate-500 px-1.5 py-0.5 rounded bg-slate-800/50">
                {activity.action}
            </span>
            <span className="text-sm text-slate-300 font-medium">
                {activity.entity_type}
            </span>
            <span className="text-sm text-slate-500 truncate flex-1">
                {activity.entity_name || activity.entity_id?.slice(0, 8) || ''}
            </span>
            <span className="text-xs text-slate-600 ml-auto whitespace-nowrap">
                {activity.created_at ? new Date(activity.created_at).toLocaleString() : ''}
            </span>
        </div>
    );
};

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
    stats,
    activities,
    loading,
    onRefresh,
    onNavigateToOrganizations,
    onNavigateToUsers,
    onNavigateToBilling
}) => {
    return (
        <div className="p-8 overflow-y-auto">
            {/* Header */}
            <PageHeader 
                title="Dashboard" 
                subtitle="System overview and quick actions"
            />

            {/* Quick Actions */}
            <Section className="mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <QuickAction
                        icon={Building}
                        label="Organizations"
                        description="Manage orgs & subscriptions"
                        onClick={onNavigateToOrganizations}
                    />
                    <QuickAction
                        icon={UserPlus}
                        label="Invite User"
                        description="Add new users to system"
                        onClick={onNavigateToUsers}
                    />
                    <QuickAction
                        icon={TrendingUp}
                        label="Revenue"
                        description="View billing & analytics"
                        onClick={onNavigateToBilling}
                    />
                    {stats.pendingRequests > 0 && (
                        <QuickAction
                            icon={Clock}
                            label="Pending"
                            description="Review access requests"
                            onClick={onNavigateToOrganizations}
                            badge={stats.pendingRequests}
                        />
                    )}
                </div>
            </Section>

            {/* Metrics Grid */}
            <Section className="mb-8">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    <Card variant="bordered" padding="md">
                        <MetricCard
                            icon={Building}
                            label="Organizations"
                            value={stats.totalOrgs}
                        />
                    </Card>
                    <Card variant="bordered" padding="md">
                        <MetricCard
                            icon={Users}
                            label="Total Users"
                            value={stats.totalUsers}
                        />
                    </Card>
                    <Card variant="bordered" padding="md">
                        <MetricCard
                            icon={Activity}
                            label="Live Now"
                            value={stats.liveUsers}
                            subtitle="Active sessions"
                        />
                    </Card>
                    <Card variant="bordered" padding="md">
                        <MetricCard
                            icon={Users}
                            label="Active (7d)"
                            value={stats.activeUsers7d}
                        />
                    </Card>
                    <Card variant="bordered" padding="md">
                        <MetricCard
                            icon={Brain}
                            label="AI Calls (7d)"
                            value={stats.aiCalls.toLocaleString()}
                        />
                    </Card>
                    <Card variant="bordered" padding="md">
                        <MetricCard
                            icon={Zap}
                            label="Tokens (7d)"
                            value={`${(stats.tokens / 1000).toFixed(1)}k`}
                        />
                    </Card>
                    <Card variant="bordered" padding="md">
                        <MetricCard
                            icon={DollarSign}
                            label="MRR (Est)"
                            value={`$${stats.revenue.toFixed(0)}`}
                        />
                    </Card>
                </div>
            </Section>

            {/* Recent Activity */}
            <Section title="Recent Activity">
                <Card variant="bordered" padding="none">
                    <div className="p-5">
                        {activities.length === 0 ? (
                            <p className="text-slate-500 text-sm py-4 text-center">
                                No recent activity recorded yet.
                            </p>
                        ) : (
                            <div className="max-h-72 overflow-y-auto">
                                {activities.slice(0, 15).map((act, idx) => (
                                    <ActivityRow key={act.id || idx} activity={act} />
                                ))}
                            </div>
                        )}
                    </div>
                </Card>
            </Section>
        </div>
    );
};

export default SuperAdminDashboard;
