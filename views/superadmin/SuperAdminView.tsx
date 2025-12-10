import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { User, AppView } from '../../types';
import { Users, Building, AlertCircle, CheckCircle, CreditCard, Trash2, Edit2, Search, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SuperAdminSidebar, SuperAdminSection } from '../../components/SuperAdminSidebar';
import { AdminLLMView } from './AdminLLMView';
import { AdminKnowledgeView } from './AdminKnowledgeView';
import { SuperAdminAccessRequestsView } from './SuperAdminAccessRequestsView';
import { SuperAdminPlansView } from './SuperAdminPlansView';
import { SuperAdminRevenueView } from './SuperAdminRevenueView';
import { AdminMarginConfig } from './AdminMarginConfig';
import { AdminTokenPackages } from './AdminTokenPackages';

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
interface SystemUser {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    status: string;
    organization_id: string;
    organization_name?: string;
    created_at: string;
    last_login?: string;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ currentUser, onNavigate }) => {
    const [activeSection, setActiveSection] = useState<SuperAdminSection>('overview');
    const [stats, setStats] = useState({ totalOrgs: 0, totalUsers: 0, revenue: 0 });
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [allUsers, setAllUsers] = useState<SystemUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const orgs = await Api.getOrganizations();
            setOrganizations(orgs);

            // Calculate Stats
            const totalUsers = orgs.reduce((acc: number, org: Organization) => acc + (org.user_count || 0), 0);
            setStats({
                totalOrgs: orgs.length,
                totalUsers: totalUsers,
                revenue: 0 // Placeholder
            });

            // Fetch all users (for Users section)
            try {
                const users = await Api.getUsers();
                setAllUsers(users);
            } catch (e) {
                console.warn('Could not fetch users', e);
            }

            setLoading(false);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load data');
            setLoading(false);
        }
    };

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
        user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
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
                <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 rounded-lg text-sm transition-colors">
                    <RefreshCw size={16} /> Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-navy-900 border border-white/10 rounded-xl p-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400"><Building size={24} /></div>
                    <div>
                        <p className="text-slate-400 text-sm">Total Organizations</p>
                        <p className="text-2xl font-bold text-white">{stats.totalOrgs}</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400"><Users size={24} /></div>
                    <div>
                        <p className="text-slate-400 text-sm">Total Users</p>
                        <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400"><CreditCard size={24} /></div>
                    <div>
                        <p className="text-slate-400 text-sm">MRR (Est)</p>
                        <p className="text-2xl font-bold text-white">${stats.revenue.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* Quick Stats Table */}
            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
                <p className="text-slate-500 text-sm">Activity feed coming soon...</p>
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
                                    <td className="p-4 font-medium text-white">{user.first_name} {user.last_name}</td>
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
                                        {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
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
            <h1 className="text-2xl font-bold mb-6">Audit Logs</h1>
            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                <p className="text-slate-500 text-sm mb-4">System activity and security events will appear here.</p>
                <div className="text-center py-12 text-slate-600">
                    <p className="text-lg font-medium">Audit logging coming soon</p>
                    <p className="text-sm">Track user actions, API calls, and system events</p>
                </div>
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
