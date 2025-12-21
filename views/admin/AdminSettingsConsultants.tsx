import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { User, UserRole } from '../../types';
import { toast } from 'react-hot-toast';
import { Users, UserPlus, Trash2, Mail, Shield, CheckCircle, ExternalLink } from 'lucide-react';

export const AdminSettingsConsultants: React.FC = () => {
    const [consultants, setConsultants] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviting, setInviting] = useState(false);

    const loadConsultants = async () => {
        try {
            setLoading(true);
            const users = await Api.getUsers(); // Org Admin gets org members
            // Filter for consultants
            const consultantUsers = users.filter(u => u.role === UserRole.CONSULTANT);
            setConsultants(consultantUsers);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load consultants');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConsultants();
    }, []);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;

        setInviting(true);
        try {
            // Use Api.createOrganizationInvitation (which we added/verified exists)
            await Api.createOrganizationInvitation(inviteEmail, 'CONSULTANT');
            toast.success('Invitation sent to consultant');
            setShowInviteModal(false);
            setInviteEmail('');
            // Typically an invite is pending, so it won't show in user list yet unless we fetch pending invites.
            // For now, simple success message.
        } catch (err: any) {
            toast.error(err.message || 'Failed to send invitation');
        } finally {
            setInviting(false);
        }
    };

    const handleRemove = async (userId: string) => {
        if (!confirm('Are you sure you want to remove this consultant from your organization?')) return;
        try {
            await Api.deleteUser(userId); // Access Control: Org Admin can delete members
            toast.success('Consultant removed');
            loadConsultants();
        } catch (err) {
            toast.error('Failed to remove consultant');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Shield className="text-purple-500" />
                        External Consultants
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Manage external advisors who have access to your organization's data.
                    </p>
                </div>
                <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                >
                    <UserPlus size={18} />
                    Invite Consultant
                </button>
            </div>

            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-navy-950 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-white/10">
                        <tr>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Joined</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading consultants...</td></tr>
                        ) : consultants.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center gap-3">
                                        <Users className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                                        <p>No consultants linked to this organization yet.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            consultants.map(consultant => (
                                <tr key={consultant.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
                                            {consultant.firstName?.[0] || 'C'}
                                        </div>
                                        {consultant.firstName} {consultant.lastName}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{consultant.email}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                                            <CheckCircle size={12} /> Active
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                        Joined Recently
                                    </td>

                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleRemove(consultant.id)}
                                            className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg"
                                            title="Revoke Access"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Invite Consultant</h3>
                            <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <ExternalLink size={20} className="rotate-45" /> {/* Using generic close icon alternative if X not imported, or relying on user knowing how to close. Wait, I didn't import X. */}
                            </button>
                        </div>
                        <form onSubmit={handleInvite} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Consultant Email
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
                                    <input
                                        type="email"
                                        required
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        placeholder="consultant@firm.com"
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    The user will receive an email invitation to join your organization as a Consultant.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowInviteModal(false)}
                                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={inviting}
                                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                >
                                    {inviting ? 'Sending...' : 'Send Invite'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
