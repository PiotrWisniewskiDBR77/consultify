import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { AppView } from '../../../types';
import { Api } from '../../../services/api';
import { ArrowLeft, Copy, Send, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Invite {
    id: string;
    invite_code: string;
    invite_type: string;
    target_email?: string;
    expires_at: string;
    uses_count: number;
    max_uses: number;
    created_at: string;
}

export const ConsultantInviteView = () => {
    const { setCurrentView } = useAppStore();
    const [invites, setInvites] = useState<Invite[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form State
    const [type, setType] = useState('TRIAL_ORG');
    const [targetEmail, setTargetEmail] = useState('');
    const [targetCompany, setTargetCompany] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [link, setLink] = useState('');

    useEffect(() => {
        loadInvites();
    }, []);

    const loadInvites = async () => {
        try {
            const data = await Api.getConsultantInvites();
            setInvites(data);
        } catch (error: unknown) {
            console.error('Failed to load invites:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to load invites');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const result = await Api.createConsultantInvite({
                email: targetEmail || '',
                invitationType: type,
                firmName: targetCompany || undefined,
            });

            if (result.link) {
                setLink(result.link);
            }

            toast.success('Invite Created Successfully');
            setTargetEmail('');
            setTargetCompany('');
            loadInvites();
        } catch (error: unknown) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to create invite');
        } finally {
            setIsCreating(false);
        }
    };

    const copyToClipboard = (code: string) => {
        navigator.clipboard.writeText(code);
        toast.success(`Code ${code} copied!`);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full space-y-6">
                <button
                    onClick={() => setCurrentView(AppView.CONSULTANT_PANEL)}
                    className="flex items-center gap-2 text-slate-500 hover:text-navy-900 dark:hover:text-white transition-colors text-sm font-medium"
                >
                    <ArrowLeft size={16} />
                    Back to Panel
                </button>

                <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Generate Invites</h1>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Access Generation Form */}
                    <div className="bg-white dark:bg-navy-800 rounded-xl shadow-sm border border-slate-200 dark:border-white/5 p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Send size={18} className="text-purple-500" />
                            New Invitation
                        </h2>

                        <form onSubmit={handleCreateInvite} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Invite Type</label>
                                <select
                                    value={type} onChange={(e) => setType(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                                >
                                    <option value="TRIAL_ORG">New Trial Company (Org)</option>
                                    <option value="TRIAL_USER">Existing Trial User</option>
                                    <option value="ORG_ADD_CONSULTANT">Add Me to Organization</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Name (Optional)</label>
                                <input
                                    type="text"
                                    value={targetCompany}
                                    onChange={(e) => setTargetCompany(e.target.value)}
                                    placeholder="e.g. Acme Corp"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Email (Optional)</label>
                                <input
                                    type="email"
                                    value={targetEmail}
                                    onChange={(e) => setTargetEmail(e.target.value)}
                                    placeholder="user@example.com"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                                />
                                <p className="text-xs text-slate-400 mt-1">Leave empty for a generic code.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={isCreating}
                                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium shadow-md transition-colors disabled:opacity-50"
                            >
                                {isCreating ? 'Generating...' : 'Generate Code'}
                            </button>
                        </form>
                    </div>

                    {/* History */}
                    <div className="bg-white dark:bg-navy-800 rounded-xl shadow-sm border border-slate-200 dark:border-white/5 flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 text-lg font-semibold flex items-center gap-2">
                            <Clock size={18} className="text-blue-500" />
                            Recent Invites
                        </div>
                        <div className="flex-1 overflow-y-auto max-h-[400px] p-2">
                            {isLoading ? (
                                <div className="p-4 text-center text-slate-400">Loading...</div>
                            ) : invites.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">No invites generated yet.</div>
                            ) : (
                                <div className="space-y-2">
                                    {invites.map(invite => (
                                        <div key={invite.id} className="p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="font-mono font-bold text-lg tracking-wider text-purple-600 dark:text-purple-400">
                                                    {invite.invite_code}
                                                </div>
                                                <button onClick={() => copyToClipboard(invite.invite_code)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded text-slate-500">
                                                    <Copy size={14} />
                                                </button>
                                            </div>
                                            <div className="text-xs text-slate-500 space-y-1">
                                                <div className="flex justify-between">
                                                    <span>Type:</span>
                                                    <span className="font-medium text-slate-700 dark:text-slate-300">{invite.invite_type}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Uses:</span>
                                                    <span>{invite.uses_count} / {invite.max_uses}</span>
                                                </div>
                                                {invite.target_email && (
                                                    <div className="flex justify-between">
                                                        <span>To:</span>
                                                        <span className="truncate max-w-[120px]">{invite.target_email}</span>
                                                    </div>
                                                )}
                                                <div className="pt-1 border-t border-slate-200 dark:border-white/10 mt-1 opacity-70">
                                                    Exp: {new Date(invite.expires_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
