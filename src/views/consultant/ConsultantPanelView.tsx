import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { AppView } from '../../../types';
import { Api } from '../../../services/api';
import { Building, Plus, ExternalLink, Settings as LucideSettings, Users as LucideUsers, LogOut as LucideLogOut } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface LinkedOrg {
    id: string;
    name: string;
    status: string;
    role_in_org: string;
    link_status: string;
    linked_at: string;
}

export const ConsultantPanelView = () => {
    const { setCurrentView, currentUser, logout: appLogout } = useAppStore();
    const [linkedOrgs, setLinkedOrgs] = useState<LinkedOrg[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadLinkedOrgs();
    }, []);

    const loadLinkedOrgs = async () => {
        try {
            setIsLoading(true);
            // Assuming Api helper handles auth headers
            const data = await Api.getConsultantOrgs();
            setLinkedOrgs(data);
        } catch (error) {
            console.error(error);
            toast.error('Error loading organizations');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSwitchToOrg = (orgId: string) => {
        // Here we would ideally token-exchange or set the org context
        // For now, let's assume we can navigate if the backend permits.
        // In a real multi-tenant app, this might involve a full reload or context switch API call.
        toast.success(`Switching to organization context: ${orgId}`);
        // TODO: Implement actual context switch logic in AppStore/Backend
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto w-full space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-navy-900 dark:text-white">Consultant Panel</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            Welcome back, {currentUser?.firstName || 'Consultant'}. Manage your client organizations.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setCurrentView(AppView.CONSULTANT_INVITES)}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-navy-800 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors font-medium shadow-sm"
                        >
                            <Plus size={18} />
                            Create Invite
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white dark:bg-navy-800 rounded-xl shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
                            <h2 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                                <Building size={20} className="text-purple-500" />
                                Linked Organizations
                            </h2>
                            <span className="text-xs font-medium px-2 py-1 bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 rounded-full">
                                {linkedOrgs.length} Active
                            </span>
                        </div>

                        {isLoading ? (
                            <div className="p-12 text-center text-slate-400">Loading...</div>
                        ) : linkedOrgs.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-slate-100 dark:bg-navy-900 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Building size={32} className="text-slate-400" />
                                </div>
                                <h3 className="text-lg font-medium text-navy-900 dark:text-white mb-2">No Organizations Linked</h3>
                                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
                                    You don't have access to any organizations yet. Invite a client to get started.
                                </p>
                                <button
                                    onClick={() => setCurrentView(AppView.CONSULTANT_INVITES)}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
                                >
                                    Invite Client
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                {linkedOrgs.map((org) => (
                                    <div key={org.id} className="p-6 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xl uppercase">
                                                    {org.name.substring(0, 2)}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                                        {org.name}
                                                    </h3>
                                                    <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                        <span className="capitalize">{org.status.toLowerCase()}</span>
                                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                        <span className="capitalize text-slate-400">Role: {org.role_in_org.toLowerCase()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleSwitchToOrg(org.id)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-navy-700 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 rounded-lg hover:border-purple-500 hover:text-purple-500 dark:hover:text-purple-400 transition-all font-medium text-sm"
                                                >
                                                    Open Workspace
                                                    <ExternalLink size={16} />
                                                </button>
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
    );
};
