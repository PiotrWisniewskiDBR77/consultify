import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, AlertCircle, Users, Shield, Search, RefreshCw } from 'lucide-react';
import { UserAcceptanceStatus, LegalDocType } from '../../types';

interface AdminComplianceViewProps {
    organizationId: string;
}

const DOC_TYPE_LABELS: Record<LegalDocType, string> = {
    TOS: 'ToS',
    PRIVACY: 'Privacy',
    COOKIES: 'Cookies',
    AUP: 'AUP',
    AI_POLICY: 'AI Policy',
    DPA: 'DPA'
};

export const AdminComplianceView: React.FC<AdminComplianceViewProps> = ({ organizationId }) => {
    const { t } = useTranslation();
    const [users, setUsers] = useState<UserAcceptanceStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchAcceptanceStatus();
    }, [organizationId]);

    const fetchAcceptanceStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/legal/admin/acceptance-status/organization/${organizationId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                throw new Error('Failed to fetch compliance status');
            }

            const data = await res.json();
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const docTypes: LegalDocType[] = ['TOS', 'PRIVACY', 'COOKIES', 'AUP', 'AI_POLICY', 'DPA'];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64 gap-2 text-red-500">
                <AlertCircle size={20} />
                <span>{error}</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                            {t('admin.compliance.title', 'Legal Compliance')}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {t('admin.compliance.subtitle', 'Track user acceptance of legal documents')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchAcceptanceStatus}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
                    title="Refresh"
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t('admin.compliance.search', 'Search users...')}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
                />
            </div>

            {/* Summary */}
            <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <Users size={16} className="text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-300">
                        {users.length} {t('admin.compliance.users', 'users')}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Check size={16} className="text-green-500" />
                    <span className="text-slate-600 dark:text-slate-300">
                        {users.filter(u => docTypes.every(dt => u.acceptanceStatus[dt]?.accepted)).length} {t('admin.compliance.fullyCompliant', 'fully compliant')}
                    </span>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-navy-800">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                {t('admin.compliance.user', 'User')}
                            </th>
                            {docTypes.map(dt => (
                                <th key={dt} className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    {DOC_TYPE_LABELS[dt]}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {filteredUsers.map(user => (
                            <tr key={user.userId} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                <td className="px-4 py-3">
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {user.firstName} {user.lastName}
                                        </p>
                                        <p className="text-xs text-slate-500">{user.email}</p>
                                    </div>
                                </td>
                                {docTypes.map(dt => {
                                    const status = user.acceptanceStatus[dt];
                                    const accepted = status?.accepted;

                                    return (
                                        <td key={dt} className="px-3 py-3 text-center">
                                            {accepted ? (
                                                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30">
                                                    <Check size={14} className="text-green-600 dark:text-green-400" />
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30">
                                                    <X size={14} className="text-red-600 dark:text-red-400" />
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredUsers.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        {t('admin.compliance.noUsers', 'No users found')}
                    </div>
                )}
            </div>
        </div>
    );
};
