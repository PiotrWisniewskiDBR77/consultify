import React from 'react';
import { Building, Users, Brain, Zap, Activity, DollarSign, TrendingUp, UserPlus, RefreshCw } from 'lucide-react';
import { InfoButton } from '../../components/shared/InfoButton';

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
        <div className="p-8 overflow-y-auto relative">
            <InfoButton cardId="superadmin-dashboard" position="top-right" />
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-slate-400 text-sm mt-1">System overview and quick actions</p>
                </div>
                <div className="flex items-center gap-2">
                    <InfoButton cardId="superadmin-dashboard" position="header-inline" size="md" showLabel label="Help" />
                    <button 
                        onClick={onRefresh} 
                        className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 rounded-lg text-sm transition-colors border border-white/10"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <button
                    onClick={onNavigateToOrganizations}
                    className="bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/20 rounded-xl p-4 text-left hover:border-blue-500/40 transition-all group"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <Building size={20} className="text-blue-400" />
                        <span className="text-white font-medium">Organizations</span>
                    </div>
                    <p className="text-xs text-slate-400">Manage orgs & subscriptions</p>
                </button>
                <button
                    onClick={onNavigateToUsers}
                    className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/10 border border-emerald-500/20 rounded-xl p-4 text-left hover:border-emerald-500/40 transition-all group"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <UserPlus size={20} className="text-emerald-400" />
                        <span className="text-white font-medium">Invite User</span>
                    </div>
                    <p className="text-xs text-slate-400">Add new users to system</p>
                </button>
                <button
                    onClick={onNavigateToBilling}
                    className="bg-gradient-to-br from-purple-600/20 to-purple-700/10 border border-purple-500/20 rounded-xl p-4 text-left hover:border-purple-500/40 transition-all group"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingUp size={20} className="text-purple-400" />
                        <span className="text-white font-medium">Revenue</span>
                    </div>
                    <p className="text-xs text-slate-400">View billing & analytics</p>
                </button>
                {stats.pendingRequests > 0 && (
                    <button
                        onClick={onNavigateToOrganizations}
                        className="bg-gradient-to-br from-yellow-600/20 to-yellow-700/10 border border-yellow-500/20 rounded-xl p-4 text-left hover:border-yellow-500/40 transition-all group relative"
                    >
                        <span className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                            {stats.pendingRequests}
                        </span>
                        <div className="flex items-center gap-3 mb-2">
                            <Users size={20} className="text-yellow-400" />
                            <span className="text-white font-medium">Pending</span>
                        </div>
                        <p className="text-xs text-slate-400">Review access requests</p>
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                        <Building size={20} />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs">Organizations</p>
                        <p className="text-xl font-bold text-white">{stats.totalOrgs}</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">
                        <Users size={20} />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs">Total Users</p>
                        <p className="text-xl font-bold text-white">{stats.totalUsers}</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500 relative">
                        <Activity size={20} />
                        <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-navy-900"></span>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs">Live Now</p>
                        <p className="text-xl font-bold text-white">{stats.liveUsers}</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400">
                        <Users size={20} />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs">Active (7d)</p>
                        <p className="text-xl font-bold text-white">{stats.activeUsers7d}</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                        <Brain size={20} />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs">AI Calls (7d)</p>
                        <p className="text-xl font-bold text-white">{stats.aiCalls}</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <Zap size={20} />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs">Tokens (7d)</p>
                        <p className="text-xl font-bold text-white">{(stats.tokens / 1000).toFixed(1)}k</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <DollarSign size={20} />
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs">MRR (Est)</p>
                        <p className="text-xl font-bold text-white">${stats.revenue.toFixed(0)}</p>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 text-white">Recent Activity</h2>
                {activities.length === 0 ? (
                    <p className="text-slate-500 text-sm">No recent activity recorded yet.</p>
                ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                        {activities.slice(0, 10).map((act, idx) => (
                            <div key={act.id || idx} className="flex items-center gap-3 text-sm border-b border-white/5 pb-2">
                                <div className={`w-2 h-2 rounded-full ${
                                    act.action === 'created' ? 'bg-green-500' : 
                                    act.action === 'deleted' ? 'bg-red-500' : 
                                    'bg-blue-500'
                                }`} />
                                <span className="text-slate-400">{act.user_name || act.user_email || 'System'}</span>
                                <span className="text-slate-500">{act.action}</span>
                                <span className="text-white font-medium">{act.entity_type}</span>
                                <span className="text-slate-500">{act.entity_name || act.entity_id?.slice(0, 8) || ''}</span>
                                <span className="ml-auto text-slate-600 text-xs">
                                    {act.created_at ? new Date(act.created_at).toLocaleString() : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SuperAdminDashboard;

