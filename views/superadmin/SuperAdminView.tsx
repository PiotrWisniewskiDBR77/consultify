import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { User, AppView } from '../../types';
import { Users, Building, AlertCircle, CheckCircle, CreditCard, Trash2, Edit2, Search, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SuperAdminSidebar, SuperAdminSection } from '../../components/SuperAdminSidebar';
import { AdminLLMView } from '../admin/AdminLLMView';
import { AdminKnowledgeView } from '../admin/AdminKnowledgeView';
import { SuperAdminAccessRequestsView } from './SuperAdminAccessRequestsView';
import { SuperAdminPlansView } from './SuperAdminPlansView';
import { SuperAdminRevenueView } from './SuperAdminRevenueView';
import { AdminLLMMultipliers } from '../admin/AdminLLMMultipliers';
import { AdminMarginConfig } from '../admin/AdminMarginConfig';
import { AdminTokenPackages } from '../admin/AdminTokenPackages';

interface SuperAdminViewProps {
    currentUser: User;
    onNavigate: (view: any) => void;
}

interface Organization {
    id: string;
    name: string;
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'blocked' | 'trial';
    created_at: string;
    user_count: number;
    discount_percent?: number;
}


export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ currentUser, onNavigate }) => {
    const [activeSection, setActiveSection] = useState<SuperAdminSection>('overview');
    const [stats, setStats] = useState({ totalOrgs: 0, totalUsers: 0, revenue: 0, aiCalls: 0, tokens: 0, activeUsers7d: 0 });
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    const fetchData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const [orgs, dashboardData] = await Promise.all([
                Api.getOrganizations(),
                Api.getSuperAdminDashboard().catch(() => null)
            ]);

            setOrganizations(orgs);

            // Calculate Stats from dashboard API
            const totalUsers = dashboardData?.counts?.total_users || orgs.reduce((acc: number, org: Organization) => acc + (org.user_count || 0), 0);
            setStats({
                totalOrgs: dashboardData?.counts?.total_orgs || orgs.length,
                totalUsers: totalUsers,
                revenue: 0,
                aiCalls: dashboardData?.ai?.total_ai_calls || 0,
                tokens: dashboardData?.ai?.total_tokens || 0,
                activeUsers7d: dashboardData?.counts?.active_users_7d || 0
            });

            // Fetch all users (for Users section)
            try {
                const users = await Api.getUsers();
                setAllUsers(users);
            } catch (e) {
                console.warn('Could not fetch users', e);
            }

            // Fetch recent activities
            try {
                const acts = await Api.getActivities(20);
                setActivities(acts);
            } catch (e) {
                console.warn('Could not fetch activities', e);
            }

            setLoading(false);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load data');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(false);
    }, []);

    const handleDeleteOrg = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete organization "${name}" and all its users? This cannot be undone.`)) return;

        try {
            await Api.deleteOrganization(id);
            toast.success('Organization deleted');
            fetchData();
        } catch (err) {
            toast.error('Failed to delete organization');
        }
    };

    const handleUpdateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingOrg) return;

        try {
            await Api.updateOrganization(editingOrg.id, {
                plan: editingOrg.plan,
                status: editingOrg.status,
                discount_percent: editingOrg.discount_percent
            });
            toast.success('Organization updated');
            setShowEditModal(false);
            setEditingOrg(null);
            fetchData();
        } catch (err) {
            toast.error('Failed to update organization');
        }
    };

    const handleLogout = () => {
        onNavigate(AppView.WELCOME);
    };

    const filteredOrgs = organizations.filter(org =>
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.id.includes(searchTerm)
    );

    const filteredUsers = allUsers.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Render content based on active section
    const renderContent = () => {
        switch (activeSection) {
            case 'overview':
                return renderOverview();
            case 'organizations':
                return renderOrganizations();
            case 'users':
                return renderUsers();
            case 'access-requests':
                return <div className="p-8 overflow-y-auto"><SuperAdminAccessRequestsView /></div>;
            case 'llm':
                return <AdminLLMView />;
            case 'knowledge':
                return <AdminKnowledgeView />;
            case 'plans':
                return <div className="p-8 overflow-y-auto"><SuperAdminPlansView /></div>;
            case 'token-billing':
                return (
                    <div className="p-8 overflow-y-auto">
                        <h1 className="text-2xl font-bold mb-6">Token Billing Management</h1>
                        <div className="grid grid-cols-1 gap-6">
                            <AdminLLMMultipliers />
                            <AdminMarginConfig />
                            <AdminTokenPackages />
                        </div>
                    </div>
                );
            case 'revenue':
                return <div className="p-8 overflow-y-auto"><SuperAdminRevenueView /></div>;
            case 'settings':
                return renderSettings();
            case 'audit':
                return renderAuditLogs();
            default:
                return renderOverview();
        }
    };

    const renderOverview = () => (
        <div className="p-8 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">System Overview</h1>
                <button onClick={() => fetchData(true)} className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 rounded-lg text-sm transition-colors">
                    <RefreshCw size={16} /> Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400"><Building size={20} /></div>
                    <div>
                        <p className="text-slate-400 text-xs">Organizations</p>
                        <p className="text-xl font-bold text-white">{stats.totalOrgs}</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400"><Users size={20} /></div>
                    <div>
                        <p className="text-slate-400 text-xs">Total Users</p>
                        <p className="text-xl font-bold text-white">{stats.totalUsers}</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400"><Users size={20} /></div>
                    <div>
                        <p className="text-slate-400 text-xs">Active (7d)</p>
                        <p className="text-xl font-bold text-white">{stats.activeUsers7d}</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400"><CreditCard size={20} /></div>
                    <div>
                        <p className="text-slate-400 text-xs">AI Calls (7d)</p>
                        <p className="text-xl font-bold text-white">{stats.aiCalls}</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400"><CreditCard size={20} /></div>
                    <div>
                        <p className="text-slate-400 text-xs">Tokens (7d)</p>
                        <p className="text-xl font-bold text-white">{(stats.tokens / 1000).toFixed(1)}k</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400"><CreditCard size={20} /></div>
                    <div>
                        <p className="text-slate-400 text-xs">MRR (Est)</p>
                        <p className="text-xl font-bold text-white">${stats.revenue.toFixed(0)}</p>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
                {activities.length === 0 ? (
                    <p className="text-slate-500 text-sm">No recent activity recorded yet.</p>
                ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                        {activities.slice(0, 10).map((act: any, idx: number) => (
                            <div key={act.id || idx} className="flex items-center gap-3 text-sm border-b border-white/5 pb-2">
                                <div className={`w-2 h-2 rounded-full ${act.action === 'created' ? 'bg-green-500' : act.action === 'deleted' ? 'bg-red-500' : 'bg-blue-500'}`} />
                                <span className="text-slate-400">{act.user_name || act.user_email || 'System'}</span>
                                <span className="text-slate-500">{act.action}</span>
                                <span className="text-white font-medium">{act.entity_type}</span>
                                <span className="text-slate-500">{act.entity_name || act.entity_id?.slice(0, 8) || ''}</span>
                                <span className="ml-auto text-slate-600 text-xs">{act.created_at ? new Date(act.created_at).toLocaleString() : ''}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    const renderOrganizations = () => (
        <div className="p-8 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Organizations</h1>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-sm text-white focus:border-blue-500 outline-none w-64"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-navy-950 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="p-4 font-medium">Name</th>
                            <th className="p-4 font-medium">Users</th>
                            <th className="p-4 font-medium">Plan</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium">Discount</th>
                            <th className="p-4 font-medium">Created At</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                        {loading ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading...</td></tr>
                        ) : filteredOrgs.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-500">No organizations found</td></tr>
                        ) : (
                            filteredOrgs.map(org => (
                                <tr key={org.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-medium text-white">{org.name}</td>
                                    <td className="p-4 text-slate-300">{org.user_count}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${org.plan === 'enterprise' ? 'bg-purple-500/20 text-purple-400' :
                                            org.plan === 'pro' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-slate-700 text-slate-300'
                                            }`}>
                                            {org.plan}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`flex items-center gap-1.5 ${org.status === 'active' ? 'text-green-400' :
                                            org.status === 'blocked' ? 'text-red-400' : 'text-yellow-400'
                                            }`}>
                                            {org.status === 'active' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                            {org.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-300">
                                        {org.discount_percent ? <span className="text-green-400 font-bold">-{org.discount_percent}%</span> : '-'}
                                    </td>
                                    <td className="p-4 text-slate-500 text-xs">
                                        {new Date(org.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => { setEditingOrg(org); setShowEditModal(true); }}
                                                className="p-1.5 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 rounded transition-colors"
                                                title="Edit Plan/Status"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteOrg(org.id, org.name)}
                                                className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-colors"
                                                title="Delete Organization"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderUsers = () => (
        <div className="p-8 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">All Users</h1>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-sm text-white focus:border-blue-500 outline-none w-64"
                    />
                </div>
            </div>

            <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-navy-950 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="p-4 font-medium">Name</th>
                            <th className="p-4 font-medium">Email</th>
                            <th className="p-4 font-medium">Role</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium">Last Login</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                        {filteredUsers.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">No users found</td></tr>
                        ) : (
                            filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-medium text-white">{user.firstName} {user.lastName}</td>
                                    <td className="p-4 text-slate-300">{user.email}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${user.role === 'SUPERADMIN' ? 'bg-red-500/20 text-red-400' :
                                            user.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-400' :
                                                'bg-slate-700 text-slate-300'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`flex items-center gap-1.5 ${user.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                                            {user.status === 'active' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-500 text-xs">
                                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderSettings = () => (
        <div className="p-8 overflow-y-auto">
            <h1 className="text-2xl font-bold mb-6">System Settings</h1>
            <div className="bg-navy-900 border border-white/10 rounded-xl p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Application Name</label>
                    <input
                        type="text"
                        defaultValue="Consultify"
                        className="w-full max-w-md px-4 py-2 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Default Language</label>
                    <select className="w-full max-w-md px-4 py-2 bg-navy-950 border border-white/10 rounded-lg text-white focus:border-blue-500 outline-none">
                        <option value="EN">English</option>
                        <option value="PL">Polish</option>
                        <option value="DE">German</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Maintenance Mode</label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" className="w-5 h-5 rounded border-white/20 bg-navy-950 text-red-500 focus:ring-red-500" />
                        <span className="text-sm text-slate-300">Enable maintenance mode (blocks all non-admin access)</span>
                    </label>
                </div>
                <button className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition-colors">
                    Save Settings
                </button>
            </div>
        </div>
    );

    const renderAuditLogs = () => (
        <div className="p-8 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Audit Logs</h1>
                <button onClick={() => fetchData(true)} className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 rounded-lg text-sm transition-colors">
                    <RefreshCw size={16} /> Refresh
                </button>
            </div>
            <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-navy-950 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="p-4 font-medium">Time</th>
                            <th className="p-4 font-medium">User</th>
                            <th className="p-4 font-medium">Action</th>
                            <th className="p-4 font-medium">Entity</th>
                            <th className="p-4 font-medium">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                        {activities.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">No audit logs recorded yet. Activity will appear here as users interact with the system.</td></tr>
                        ) : (
                            activities.map((act: any, idx: number) => (
                                <tr key={act.id || idx} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 text-slate-500 text-xs">{act.created_at ? new Date(act.created_at).toLocaleString() : '-'}</td>
                                    <td className="p-4 text-slate-300">{act.user_name || act.user_email || 'System'}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${act.action === 'created' ? 'bg-green-500/20 text-green-400' : act.action === 'deleted' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                            {act.action}
                                        </span>
                                    </td>
                                    <td className="p-4 text-white font-medium">{act.entity_type} {act.entity_name ? `(${act.entity_name})` : ''}</td>
                                    <td className="p-4 text-slate-500 text-xs max-w-xs truncate">{act.entity_id || '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="flex h-full bg-navy-950 text-white overflow-hidden">
            {/* Sidebar */}
            <SuperAdminSidebar
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                onLogout={handleLogout}
                currentUserEmail={currentUser.email}
            />

            {/* Main Content */}
            <main className="flex-1 overflow-hidden flex flex-col">
                {renderContent()}
            </main>

            {/* Edit Organization Modal */}
            {showEditModal && editingOrg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">Edit Organization</h3>
                        <form onSubmit={handleUpdateOrg} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Organization Name</label>
                                <input disabled value={editingOrg.name} className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-slate-500" />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Plan</label>
                                <select
                                    value={editingOrg.plan}
                                    onChange={e => setEditingOrg({ ...editingOrg, plan: e.target.value as any })}
                                    className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                                >
                                    <option value="free">Free</option>
                                    <option value="pro">Pro</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                                <select
                                    value={editingOrg.status}
                                    onChange={e => setEditingOrg({ ...editingOrg, status: e.target.value as any })}
                                    className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                                >
                                    <option value="active">Active</option>
                                    <option value="trial">Trial</option>
                                    <option value="blocked">Blocked</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Discount (%)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={editingOrg.discount_percent || 0}
                                    onChange={e => setEditingOrg({ ...editingOrg, discount_percent: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">Discount applied to all future invoices.</p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-2 bg-transparent border border-white/10 hover:bg-white/5 rounded text-slate-300">Cancel</button>
                                <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
