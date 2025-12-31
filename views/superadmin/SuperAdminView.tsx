import React, { useState, useEffect, useCallback } from 'react';
import { Api } from '../../services/api';
import { User, AppView } from '../../types';
import {
    Lock,
    RefreshCw,
    Building,
    UserPlus,
    TrendingUp,
    Users,
    Activity,
    Brain,
    Zap,
    DollarSign,
    Search,
    CheckCircle,
    AlertCircle,
    Edit2,
    Trash2,
    Plus
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { SuperAdminSidebar, SuperAdminSection, appViewToSection, sectionToAppView } from '../../components/SuperAdminSidebar';
import { AdminKnowledgeView } from '../admin/AdminKnowledgeView';
import { SuperAdminOrgDetailsModal } from './SuperAdminOrgDetailsModal';
import { SystemSettings } from './SystemSettings';
import { BillingCenterView } from './BillingCenterView';
import { OrganizationsView } from './OrganizationsView';
import { AIConfigurationView } from './AIConfigurationView';
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { SuperAdminUserManagement } from './SuperAdminUserManagement';
// Enterprise Views
import { SSOConfigurationView } from './SSOConfigurationView';
import { SecurityPoliciesView } from './SecurityPoliciesView';
import { APIManagementView } from './APIManagementView';
import { WhitelabelStudioView } from './WhitelabelStudioView';
import { ComplianceCenterView } from './ComplianceCenterView';
import { InvoiceCenterView } from './InvoiceCenterView';
import { BulkOperationsView } from '../admin/BulkOperationsView';
import { PlaybookTemplatesListView } from './PlaybookTemplatesListView';

import { SuperAdminFeedbackView } from './SuperAdminFeedbackView';

// Floating Widgets
import { HelpToggleButton } from '../../components/Help/HelpToggleButton';
import { HelpSidePanel } from '../../components/Help/HelpSidePanel';
import { DocumentToggleButton } from '../../components/documents/DocumentToggleButton';
import { DocumentSidePanel } from '../../components/documents/DocumentSidePanel';
import { FeedbackToggleButton } from '../../components/Feedback/FeedbackToggleButton';
import { FeedbackSidePanel } from '../../components/Feedback/FeedbackSidePanel';


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
    const { isSidebarCollapsed, currentView, setCurrentView } = useAppStore();

    // Derive activeSection from currentView for backward compatibility
    const activeSection: SuperAdminSection = appViewToSection[currentView] || 'dashboard';

    // Helper to set section (updates currentView in store)
    const setActiveSection = (section: SuperAdminSection) => {
        setCurrentView(sectionToAppView[section]);
    };

    const [stats, setStats] = useState({ totalOrgs: 0, totalUsers: 0, revenue: 0, aiCalls: 0, tokens: 0, activeUsers7d: 0, liveUsers: 0, pendingRequests: 0 });
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    // User Management State
    const [movingUser, setMovingUser] = useState<User | null>(null);
    const [targetOrgId, setTargetOrgId] = useState('');
    const [viewingOrgUsers, setViewingOrgUsers] = useState<Organization | null>(null);

    // Initialize to dashboard if not a superadmin view
    useEffect(() => {
        if (!currentView.startsWith('SUPERADMIN_')) {
            setCurrentView(AppView.SUPERADMIN_DASHBOARD);
        }
    }, []);

    const fetchData = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);

        // 1. Fetch Core Data (Orgs) - Critical
        try {
            const orgs = await Api.getOrganizations();
            setOrganizations(orgs);

            // Calculate basic stats from orgs immediately so UI is not empty
            const totalUsers = orgs.reduce((acc: number, org: Organization) => acc + (org.user_count || 0), 0);
            setStats(prev => ({
                ...prev,
                totalOrgs: orgs.length,
                totalUsers: totalUsers
            }));

        } catch (err) {
            console.error('Failed to load organizations', err);
            toast.error('Failed to load organizations');
        }

        // 2. Fetch Dashboard Stats (Optional / Diagnostic)
        try {
            const dashboardData = await Api.getSuperAdminDashboard();
            setStats(prev => ({
                ...prev,
                totalOrgs: dashboardData?.counts?.total_orgs || prev.totalOrgs,
                totalUsers: dashboardData?.counts?.total_users || prev.totalUsers,
                aiCalls: dashboardData?.ai?.total_ai_calls || 0,
                tokens: dashboardData?.ai?.total_tokens || 0,
                activeUsers7d: dashboardData?.counts?.active_users_7d || 0,
                liveUsers: dashboardData?.live?.total_active_connections || 0
            }));
        } catch (err) {
            console.warn('Could not fetch dashboard stats', err);
            // Don't show toast error for stats, as it's secondary
        }

        // 3. Fetch Users (Critical for Users Tab)
        try {
            const users = await Api.getSuperAdminUsers();
            setAllUsers(users);
        } catch (e) {
            console.warn('Could not fetch users', e);
        }

        // 4. Fetch Activities
        try {
            const acts = await Api.getActivities(20);
            setActivities(acts);
        } catch (e) {
            console.warn('Could not fetch activities', e);
        }

        // 5. Fetch Pending Requests Count
        try {
            const requests = await Api.getAccessRequests();
            const pendingCount = requests.filter((r: any) => r.status === 'pending').length;
            setStats(prev => ({ ...prev, pendingRequests: pendingCount }));
        } catch (e) {
            console.warn('Could not fetch pending requests', e);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => fetchData(false), 0);
        return () => clearTimeout(timer);
    }, [fetchData]);

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



    const handleMoveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!movingUser || !targetOrgId) return;

        try {
            await Api.updateSuperAdminUser(movingUser.id, { organizationId: targetOrgId });
            toast.success('User moved successfully');
            setMovingUser(null);
            setTargetOrgId(''); // Reset selection
            fetchData();
        } catch (err) {
            toast.error('Failed to move user');
        }
    };

    const handleImpersonateUser = async (userId: string) => {
        if (!confirm('Are you sure you want to impersonate this user? You will be logged in as them.')) return;
        try {
            const { token } = await Api.impersonateUser(userId);
            localStorage.setItem('token', token);
            // Force reload to pick up new user context
            window.location.href = '/';
        } catch (err: any) {
            toast.error(err.message || 'Failed to impersonate user');
        }
    };

    const handleLogout = () => {
        onNavigate(AppView.WELCOME);
    };

    const filteredOrgs = organizations.filter(org =>
        (org.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.id || '').includes(searchTerm)
    );

    const filteredUsers = allUsers.filter(user =>
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.lastName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Render content based on currentView (unified AppView navigation)
    const renderContent = () => {
        switch (currentView) {
            case AppView.SUPERADMIN_DASHBOARD:
                return (
                    <SuperAdminDashboard
                        stats={stats}
                        activities={activities}
                        loading={loading}
                        onRefresh={() => fetchData(true)}
                        onNavigateToOrganizations={() => setActiveSection('organizations')}
                        onNavigateToUsers={() => setActiveSection('users')}
                        onNavigateToBilling={() => setActiveSection('billing')}
                    />
                );
            case AppView.SUPERADMIN_ORGANIZATIONS:
                return <OrganizationsView />;
            case AppView.SUPERADMIN_USERS:
                return <SuperAdminUserManagement organizations={organizations} />;
            case AppView.SUPERADMIN_BILLING:
                return <BillingCenterView />;
            case AppView.SUPERADMIN_AI_CONFIG:
                return <AIConfigurationView />;
            case AppView.SUPERADMIN_PLAYBOOK_TEMPLATES:
                return <PlaybookTemplatesListView />;
            case AppView.SUPERADMIN_KNOWLEDGE:
                return <div className="p-8 overflow-y-auto h-full"><AdminKnowledgeView /></div>;
            case AppView.SUPERADMIN_SETTINGS:
                return <div className="p-8 overflow-y-auto h-full"><SystemSettings /></div>;
            // Enterprise Views
            case AppView.SUPERADMIN_SSO:
                return <div className="p-8 overflow-y-auto h-full"><SSOConfigurationView /></div>;
            case AppView.SUPERADMIN_SECURITY_POLICIES:
                return <div className="p-8 overflow-y-auto h-full"><SecurityPoliciesView /></div>;
            case AppView.SUPERADMIN_API_MANAGEMENT:
                return <div className="p-8 overflow-y-auto h-full"><APIManagementView /></div>;
            case AppView.SUPERADMIN_WHITELABEL:
                return <div className="p-8 overflow-y-auto h-full"><WhitelabelStudioView /></div>;
            case AppView.SUPERADMIN_COMPLIANCE:
                return <div className="p-8 overflow-y-auto h-full"><ComplianceCenterView /></div>;
            case AppView.SUPERADMIN_INVOICES:
                return <div className="p-8 overflow-y-auto h-full"><InvoiceCenterView /></div>;
            case AppView.SUPERADMIN_BULK_OPERATIONS:
                return <div className="p-8 overflow-y-auto h-full"><BulkOperationsView /></div>;
            case AppView.SUPERADMIN_FEEDBACK:
                return <div className="p-8 overflow-y-auto h-full"><SuperAdminFeedbackView /></div>;
            default:
                // Fallback for any other view - show dashboard
                return (
                    <SuperAdminDashboard
                        stats={stats}
                        activities={activities}
                        loading={loading}
                        onRefresh={() => fetchData(true)}
                        onNavigateToOrganizations={() => setActiveSection('organizations')}
                        onNavigateToUsers={() => setActiveSection('users')}
                        onNavigateToBilling={() => setActiveSection('billing')}
                    />
                );
        }
    };

    const renderDashboard = () => (
        <div className="p-8 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-slate-400 text-sm mt-1">System overview and quick actions</p>
                </div>
                <button onClick={() => fetchData(true)} className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 rounded-lg text-sm transition-colors border border-white/10">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <button
                    onClick={() => setActiveSection('organizations')}
                    className="bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/20 rounded-xl p-4 text-left hover:border-blue-500/40 transition-all group"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <Building size={20} className="text-blue-400" />
                        <span className="text-white font-medium">Organizations</span>
                    </div>
                    <p className="text-xs text-slate-400">Manage orgs & subscriptions</p>
                </button>
                <button
                    onClick={() => setActiveSection('users')}
                    className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/10 border border-emerald-500/20 rounded-xl p-4 text-left hover:border-emerald-500/40 transition-all group"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <UserPlus size={20} className="text-emerald-400" />
                        <span className="text-white font-medium">Invite User</span>
                    </div>
                    <p className="text-xs text-slate-400">Add new users to system</p>
                </button>
                <button
                    onClick={() => setActiveSection('billing')}
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
                        onClick={() => setActiveSection('organizations')}
                        className="bg-gradient-to-br from-yellow-600/20 to-yellow-700/10 border border-yellow-500/20 rounded-xl p-4 text-left hover:border-yellow-500/40 transition-all group relative"
                    >
                        <span className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">{stats.pendingRequests}</span>
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
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400"><Users size={20} /></div>
                    <div>
                        <p className="text-slate-400 text-xs">Active (7d)</p>
                        <p className="text-xl font-bold text-white">{stats.activeUsers7d}</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400"><Brain size={20} /></div>
                    <div>
                        <p className="text-slate-400 text-xs">AI Calls (7d)</p>
                        <p className="text-xl font-bold text-white">{stats.aiCalls}</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400"><Zap size={20} /></div>
                    <div>
                        <p className="text-slate-400 text-xs">Tokens (7d)</p>
                        <p className="text-xl font-bold text-white">{(stats.tokens / 1000).toFixed(1)}k</p>
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400"><DollarSign size={20} /></div>
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
                                            <button
                                                onClick={() => setViewingOrgUsers(org)}
                                                className="p-1.5 hover:bg-green-500/20 text-slate-400 hover:text-green-400 rounded transition-colors"
                                                title="View Users"
                                            >
                                                <Users size={16} />
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

    const handleBlockUser = async (userId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
        const action = newStatus === 'blocked' ? 'Block' : 'Unblock';

        if (!confirm(`Are you sure you want to ${action} this user?`)) return;

        try {
            await Api.updateSuperAdminUser(userId, { status: newStatus });
            toast.success(`User ${newStatus === 'blocked' ? 'blocked' : 'unblocked'} successfully`);
            fetchData();
        } catch {
            toast.error(`Failed to ${action.toLowerCase()} user`);
        }
    };

    // Invite User Logic
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteForm, setInviteForm] = useState({ email: '', role: 'USER', organizationId: '' });

    const handleInviteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await Api.inviteUser(inviteForm.email, inviteForm.role, inviteForm.organizationId);
            toast.success('Invitation sent successfully');
            setShowInviteModal(false);
            setInviteForm({ email: '', role: 'USER', organizationId: '' });
        } catch (err: any) {
            toast.error(err.message || 'Failed to send invitation');
        }
    };

    // Reset Password Logic
    const [resetLinkData, setResetLinkData] = useState<{ resetLink: string, token: string } | null>(null);

    const handleResetPassword = async (userId: string) => {
        try {
            const data = await Api.adminResetPassword(userId);
            setResetLinkData(data);
        } catch (err: any) {
            toast.error(err.message || 'Failed to generate reset link');
        }
    };

    const renderUsers = () => (
        <div className="p-8 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">All Users</h1>
                <div className="flex gap-4">
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors"
                    >
                        <Plus size={16} /> Invite User
                    </button>
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
            </div>

            <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-navy-950 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="p-4 font-medium">Name</th>
                            <th className="p-4 font-medium">Email</th>
                            <th className="p-4 font-medium">Organization</th>
                            <th className="p-4 font-medium">Role</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium">Last Login</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                        {filteredUsers.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-500">No users found</td></tr>
                        ) : (
                            filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-medium text-white">{user.firstName} {user.lastName}</td>
                                    <td className="p-4 text-slate-300">{user.email}</td>
                                    <td className="p-4 text-slate-300">
                                        {(user as any).organizationName || <span className="text-slate-600 italic">None</span>}
                                    </td>
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
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleResetPassword(user.id)}
                                                className="p-1.5 hover:bg-yellow-500/20 text-slate-400 hover:text-yellow-400 rounded transition-colors text-xs font-medium"
                                                title="Reset Password"
                                            >
                                                <Lock size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleImpersonateUser(user.id)}
                                                className="p-1.5 hover:bg-purple-500/20 text-slate-400 hover:text-purple-400 rounded transition-colors text-xs font-medium"
                                                title="Impersonate User"
                                            >
                                                Impersonate
                                            </button>
                                            <button
                                                onClick={() => setMovingUser(user)}
                                                className="p-1.5 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 rounded transition-colors text-xs font-medium"
                                                title="Move User"
                                            >
                                                Move
                                            </button>
                                            {user.role !== 'SUPERADMIN' && (
                                                <button
                                                    onClick={() => handleBlockUser(user.id, user.status)}
                                                    className={`p-1.5 rounded transition-colors text-xs font-medium ${user.status === 'active' ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400' : 'hover:bg-green-500/20 text-red-400 hover:text-green-400'}`}
                                                    title={user.status === 'active' ? 'Block User' : 'Unblock User'}
                                                >
                                                    {user.status === 'active' ? 'Block' : 'Unblock'}
                                                </button>
                                            )}
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
            {/* Sidebar (Fixed Position) */}
            <SuperAdminSidebar
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                onLogout={handleLogout}
                currentUserEmail={currentUser.email}
            />

            {/* Main Content (Push with ml-xx) */}
            <main
                className={`flex-1 overflow-hidden flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'ml-16' : 'ml-72'}`}
            >
                {renderContent()}
            </main>

            {showEditModal && editingOrg && (
                <SuperAdminOrgDetailsModal
                    org={editingOrg}
                    onClose={() => { setShowEditModal(false); setEditingOrg(null); }}
                    onUpdate={() => { setShowEditModal(false); setEditingOrg(null); fetchData(); }}
                />
            )}

            {/* Floating Action Buttons */}
            <div className="fixed right-0 top-[66%] z-50 flex flex-col gap-3 items-end translate-x-0 pointer-events-none">
                <div className="pointer-events-auto"><HelpToggleButton /></div>
                <div className="pointer-events-auto"><DocumentToggleButton /></div>
                <div className="pointer-events-auto"><FeedbackToggleButton /></div>
            </div>
            <HelpSidePanel />
            <DocumentSidePanel />
            <FeedbackSidePanel />

            {/* Reset Password Link Modal */}
            {resetLinkData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl text-center">
                        <div className="mx-auto w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                            <Lock className="text-blue-500" size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Password Reset Link Generated</h3>
                        <p className="text-sm text-slate-400 mb-6">
                            Copy this link and send it to the user. This link is valid for 24 hours.
                        </p>

                        <div className="bg-navy-950 p-3 rounded border border-white/10 mb-6 break-all font-mono text-xs text-slate-300">
                            {resetLinkData.resetLink}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(resetLinkData.resetLink);
                                    toast.success('Copied to clipboard');
                                }}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium"
                            >
                                Copy Link
                            </button>
                            <button
                                onClick={() => setResetLinkData(null)}
                                className="flex-1 py-2 bg-transparent border border-white/10 hover:bg-white/5 rounded text-slate-300"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite User Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">Invite New User</h3>
                        <form onSubmit={handleInviteSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={inviteForm.email}
                                    onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                                    className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
                                <select
                                    value={inviteForm.role}
                                    onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                                    className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                                >
                                    <option value="USER">User (Standard)</option>
                                    <option value="ADMIN">Admin (Organization)</option>
                                    <option value="MANAGER">Manager</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Organization</label>
                                <select
                                    value={inviteForm.organizationId}
                                    onChange={e => setInviteForm({ ...inviteForm, organizationId: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                                >
                                    <option value="">Select Organization...</option>
                                    {organizations.map(org => (
                                        <option key={org.id} value={org.id}>{org.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowInviteModal(false)} className="flex-1 py-2 bg-transparent border border-white/10 hover:bg-white/5 rounded text-slate-300">Cancel</button>
                                <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium">Send Invitation</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Move User Modal */}
            {movingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">Move User to Organization</h3>
                        <p className="text-sm text-slate-400 mb-4">
                            Select the new organization for <span className="text-white font-medium">{movingUser.firstName} {movingUser.lastName}</span> ({movingUser.email}).
                        </p>
                        <form onSubmit={handleMoveUser} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Target Organization</label>
                                <select
                                    value={targetOrgId}
                                    onChange={e => setTargetOrgId(e.target.value)}
                                    className="w-full px-3 py-2 bg-navy-950 border border-white/10 rounded text-white focus:border-blue-500 outline-none"
                                    required
                                >
                                    <option value="">Select Organization...</option>
                                    {organizations.map(org => (
                                        <option key={org.id} value={org.id}>{org.name} ({org.status})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => { setMovingUser(null); setTargetOrgId(''); }} className="flex-1 py-2 bg-transparent border border-white/10 hover:bg-white/5 rounded text-slate-300">Cancel</button>
                                <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium">Move User</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Org Users Modal */}
            {viewingOrgUsers && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-6 w-full max-w-4xl shadow-2xl h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-xl font-bold">Users in {viewingOrgUsers.name}</h3>
                                <p className="text-sm text-slate-400">{viewingOrgUsers.plan} • {viewingOrgUsers.status}</p>
                            </div>
                            <button onClick={() => setViewingOrgUsers(null)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white">
                                <Users size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-navy-950 border border-white/5 rounded-lg">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-navy-900 shadow-md">
                                    <tr className="text-slate-400 text-xs uppercase tracking-wider">
                                        <th className="p-3 font-medium">Name</th>
                                        <th className="p-3 font-medium">Email</th>
                                        <th className="p-3 font-medium">Role</th>
                                        <th className="p-3 font-medium">Last Login</th>
                                        <th className="p-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {allUsers.filter(u => u.organizationId === viewingOrgUsers.id).length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-slate-500">No users in this organization</td></tr>
                                    ) : (
                                        allUsers.filter(u => u.organizationId === viewingOrgUsers.id).map(user => (
                                            <tr key={user.id} className="hover:bg-white/5">
                                                <td className="p-3 font-medium text-white">{user.firstName} {user.lastName}</td>
                                                <td className="p-3 text-slate-300">{user.email}</td>
                                                <td className="p-3"><span className="text-xs font-bold uppercase bg-slate-800 px-2 py-1 rounded text-slate-300">{user.role}</span></td>
                                                <td className="p-3 text-slate-500 text-xs">{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : '-'}</td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        onClick={() => { setMovingUser(user); setViewingOrgUsers(null); }}
                                                        className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                                                    >
                                                        Move Out
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="pt-4 flex justify-end">
                            <button onClick={() => setViewingOrgUsers(null)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-white text-sm">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

