import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { useTranslation } from 'react-i18next';
import { Building2, Plus, CreditCard, Users, CheckCircle, AlertCircle, Coins, ShieldCheck, UserCircle } from 'lucide-react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';

interface OrganizationSettingsProps {
    currentUser: User;
    onUpdateUser?: (updates: Partial<User>) => void;
}

export const OrganizationSettings: React.FC<OrganizationSettingsProps> = ({ currentUser }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [selectedOrg, setSelectedOrg] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);

    // Member Add Form
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberRole, setNewMemberRole] = useState('MEMBER');

    useEffect(() => {
        fetchOrganizations();
    }, [currentUser]);

    const fetchOrganizations = async () => {
        try {
            setLoading(true);
            const orgs = await Api.getUserOrganizations();
            setOrganizations(orgs);
            if (orgs.length > 0) {
                // Select first one or current active if stored
                // For now, default to first
                const org = orgs[0];
                await loadOrgDetails(org.id);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load organizations');
        } finally {
            setLoading(false);
        }
    };

    const loadOrgDetails = async (orgId: string) => {
        try {
            const [org, orgMembers] = await Promise.all([
                Api.getOrganization(orgId),
                Api.getOrganizationMembers(orgId)
            ]);
            setSelectedOrg(org);
            setMembers(orgMembers);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load organization details');
        }
    };

    const handleOrgChange = async (orgId: string) => {
        await loadOrgDetails(orgId);
    };

    const handleAddMember = async () => {
        if (!selectedOrg || !newMemberEmail) return;
        try {
            // Note: passing email as targetUserId which backend might reject if not implementing lookup
            // This is a known gap we accepted for the Skeleton phase.
            // Ideally we should look up user ID by email first or have backend do it.
            // For now, let's assume valid UUID is passed OR backend handles email.
            // If backend rejects, we show error.
            await Api.addOrganizationMember(selectedOrg.id, newMemberEmail, newMemberRole);
            toast.success('Member added successfully');
            setNewMemberEmail('');
            setIsAddMemberOpen(false);
            loadOrgDetails(selectedOrg.id);
        } catch (error: any) {
            // If error suggests invalid ID, user knows they need ID
            toast.error(error.message || 'Failed to add member');
        }
    }; const handleActivateBilling = async () => {
        if (!selectedOrg) return;
        try {
            await Api.activateBilling(selectedOrg.id);
            toast.success('Billing activated! Tokens added.');
            loadOrgDetails(selectedOrg.id);
        } catch (error: any) {
            toast.error(error.message || 'Failed to activate billing');
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading organization details...</div>;
    }

    if (organizations.length === 0) {
        return (
            <div className="p-8 text-center bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                <Building2 size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-2">No Organization Found</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                    You are not currently a member of any organization. Create one to get started with team collaboration and token sharing.
                </p>
                <button
                    onClick={() => {
                        const name = prompt('Enter organization name:');
                        if (name) Api.createOrganization(name).then(() => fetchOrganizations());
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    Create Organization
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header / Selector */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                        <Building2 className="text-purple-500" />
                        Organization Settings
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage members, billing, and tokens.</p>
                </div>
                {organizations.length > 1 && (
                    <select
                        className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm"
                        value={selectedOrg?.id}
                        onChange={(e) => handleOrgChange(e.target.value)}
                    >
                        {organizations.map(org => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Billing & Tokens Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2 mb-4">
                        <CreditCard size={20} className="text-slate-400" />
                        Billing Status
                    </h3>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-slate-600 dark:text-slate-300">Status</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${selectedOrg?.billing_status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}>
                            {selectedOrg?.billing_status || 'TRIAL'}
                        </span>
                    </div>
                    {selectedOrg?.billing_status !== 'ACTIVE' && (
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-4 mb-4">
                            <div className="flex gap-3">
                                <AlertCircle size={20} className="text-amber-600 dark:text-amber-500 shrink-0" />
                                <div>
                                    <h4 className="font-semibold text-amber-900 dark:text-amber-400 text-sm">Trial Active</h4>
                                    <p className="text-amber-700 dark:text-amber-500/80 text-xs mt-1">
                                        Upgrade to a paid plan to unlock full features and remove limits.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleActivateBilling}
                        disabled={selectedOrg?.billing_status === 'ACTIVE'}
                        className="w-full bg-slate-900 dark:bg-white text-white dark:text-navy-900 px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {selectedOrg?.billing_status === 'ACTIVE' ? 'Billing Active' : 'Activate Billing (Stub)'}
                    </button>
                </div>

                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2 mb-4">
                        <Coins size={20} className="text-slate-400" />
                        Token Balance
                    </h3>
                    <div className="flex flex-col items-center justify-center py-4">
                        <div className="text-4xl font-bold text-navy-900 dark:text-white mb-1">
                            {selectedOrg?.token_balance?.toLocaleString() || 0}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">Available Tokens</div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400 text-center">
                        Next reset: {new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString()}
                    </div>
                </div>
            </div>

            {/* Members List */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                        <Users size={20} className="text-slate-400" />
                        Team Members
                    </h3>
                    <button
                        onClick={() => setIsAddMemberOpen(!isAddMemberOpen)}
                        className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus size={16} />
                        Add Member
                    </button>
                </div>

                {isAddMemberOpen && (
                    <div className="p-4 bg-slate-50 dark:bg-navy-950/50 border-b border-slate-200 dark:border-white/10 animate-in slide-in-from-top-2">
                        <div className="flex gap-4 items-end">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-slate-500 mb-1">User ID / Email</label>
                                <input
                                    type="text"
                                    value={newMemberEmail}
                                    onChange={(e) => setNewMemberEmail(e.target.value)}
                                    placeholder="Enter User ID (or Email if supported)"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-navy-950 text-sm"
                                />
                            </div>
                            <div className="w-40">
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Role</label>
                                <select
                                    value={newMemberRole}
                                    onChange={(e) => setNewMemberRole(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-navy-950 text-sm"
                                >
                                    <option value="ADMIN">Admin</option>
                                    <option value="MEMBER">Member</option>
                                    <option value="CONSULTANT">Consultant</option>
                                    <option value="VIEWER">Viewer</option>
                                </select>
                            </div>
                            <button
                                onClick={handleAddMember}
                                className="bg-slate-900 dark:bg-white text-white dark:text-navy-900 px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90"
                            >
                                Send Invite
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">
                            * Note: For this release, please use User ID if Email lookup is not configured.
                        </p>
                    </div>
                )}

                <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {members.map((member) => (
                        <div key={member.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-navy-800 flex items-center justify-center text-slate-500 font-bold">
                                    {member.first_name ? member.first_name[0] : <UserCircle size={20} />}
                                </div>
                                <div>
                                    <div className="font-semibold text-navy-900 dark:text-white text-sm">
                                        {member.first_name} {member.last_name} {member.user_id === currentUser.id && '(You)'}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{member.email || member.user_id}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${member.role === 'OWNER' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-500/30' :
                                    member.role === 'ADMIN' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-500/30' :
                                        'bg-slate-100 text-slate-700 border-slate-200 dark:bg-navy-800 dark:text-slate-300 dark:border-slate-700'
                                    }`}>
                                    {member.role === 'OWNER' && <ShieldCheck size={12} className="mr-1" />}
                                    {member.role}
                                </span>
                                <div className="text-xs text-slate-400">
                                    Joined {new Date(member.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    ))}
                    {members.length === 0 && (
                        <div className="p-8 text-center text-slate-500 text-sm">No members found.</div>
                    )}
                </div>
            </div>
        </div>
    );
};
