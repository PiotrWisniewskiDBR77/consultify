/**
 * LicenseManagementPanel - Manage user seat licenses
 * 
 * Features:
 * - License dashboard (used/available)
 * - Assign/revoke licenses
 * - License types overview
 * - Bulk operations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Users, UserPlus, UserMinus, Crown, Shield, Briefcase,
    Search, Filter, Loader2, Check, X, AlertTriangle,
    MoreHorizontal, Mail
} from 'lucide-react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { User } from '../../types';

interface LicensePlan {
    id: string;
    name: string;
    price_monthly: number;
    features: string;
}

interface UserWithLicense extends User {
    licensePlan?: LicensePlan;
    licenseAssignedAt?: string;
}

interface LicenseStats {
    totalSeats: number;
    usedSeats: number;
    availableSeats: number;
    byType: { planId: string; planName: string; count: number }[];
}

export const LicenseManagementPanel: React.FC = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<UserWithLicense[]>([]);
    const [licensePlans, setLicensePlans] = useState<LicensePlan[]>([]);
    const [stats, setStats] = useState<LicenseStats | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterLicense, setFilterLicense] = useState<string>('all');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [assigningLicense, setAssigningLicense] = useState<string | null>(null);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [bulkAssignPlan, setBulkAssignPlan] = useState<string>('');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [usersData, plansData] = await Promise.all([
                Api.getUsers(),
                Api.getUserPlans()
            ]);

            setUsers(usersData);
            setLicensePlans(plansData);

            // Calculate stats
            const totalSeats = 50; // This would come from org subscription
            const usedSeats = usersData.filter((u: User) => u.licensePlanId).length;
            const byType: { planId: string; planName: string; count: number }[] = [];
            
            plansData.forEach((plan: LicensePlan) => {
                const count = usersData.filter((u: User) => u.licensePlanId === plan.id).length;
                if (count > 0) {
                    byType.push({ planId: plan.id, planName: plan.name, count });
                }
            });

            setStats({
                totalSeats,
                usedSeats,
                availableSeats: totalSeats - usedSeats,
                byType
            });
        } catch (error) {
            console.error('Failed to fetch license data:', error);
            toast.error(t('admin.licenses.fetchError', 'Failed to load license data'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAssignLicense = async (userId: string, planId: string) => {
        try {
            setAssigningLicense(userId);
            await Api.updateUser(userId, { licensePlanId: planId || null });
            toast.success(t('admin.licenses.assigned', 'License updated'));
            await fetchData();
        } catch (error) {
            console.error('Failed to assign license:', error);
            toast.error(t('admin.licenses.assignError', 'Failed to update license'));
        } finally {
            setAssigningLicense(null);
        }
    };

    const handleBulkAssign = async () => {
        if (selectedUsers.size === 0) return;

        try {
            setAssigningLicense('bulk');
            const promises = Array.from(selectedUsers).map(userId =>
                Api.updateUser(userId, { licensePlanId: bulkAssignPlan || null })
            );
            await Promise.all(promises);
            toast.success(t('admin.licenses.bulkAssigned', `${selectedUsers.size} licenses updated`));
            setSelectedUsers(new Set());
            setShowAssignModal(false);
            await fetchData();
        } catch (error) {
            console.error('Failed to bulk assign licenses:', error);
            toast.error(t('admin.licenses.bulkAssignError', 'Failed to update some licenses'));
        } finally {
            setAssigningLicense(null);
        }
    };

    const filteredUsers = users.filter(user => {
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            fullName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterLicense === 'all' ||
            (filterLicense === 'none' ? !user.licensePlanId : user.licensePlanId === filterLicense);
        return matchesSearch && matchesFilter;
    });

    const toggleUserSelection = (userId: string) => {
        const newSelected = new Set(selectedUsers);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUsers(newSelected);
    };

    const selectAllFiltered = () => {
        if (selectedUsers.size === filteredUsers.length) {
            setSelectedUsers(new Set());
        } else {
            setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
        }
    };

    const getLicenseIcon = (planName?: string) => {
        if (!planName) return <Users className="w-4 h-4 text-slate-400" />;
        if (planName.toLowerCase().includes('enterprise')) return <Crown className="w-4 h-4 text-amber-500" />;
        if (planName.toLowerCase().includes('pro')) return <Shield className="w-4 h-4 text-purple-500" />;
        return <Briefcase className="w-4 h-4 text-blue-500" />;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white">
                    <p className="text-sm opacity-80">{t('admin.licenses.totalSeats', 'Total Seats')}</p>
                    <p className="text-3xl font-bold mt-1">{stats?.totalSeats || 0}</p>
                </div>
                <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                    <p className="text-sm text-slate-500">{t('admin.licenses.usedSeats', 'Used')}</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats?.usedSeats || 0}</p>
                </div>
                <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                    <p className="text-sm text-slate-500">{t('admin.licenses.available', 'Available')}</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats?.availableSeats || 0}</p>
                </div>
                <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                    <p className="text-sm text-slate-500">{t('admin.licenses.utilization', 'Utilization')}</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                        {stats ? Math.round((stats.usedSeats / stats.totalSeats) * 100) : 0}%
                    </p>
                </div>
            </div>

            {/* License Types Breakdown */}
            {stats?.byType && stats.byType.length > 0 && (
                <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                        {t('admin.licenses.byType', 'Licenses by Type')}
                    </h4>
                    <div className="flex flex-wrap gap-3">
                        {stats.byType.map(item => (
                            <div key={item.planId} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-white/10 rounded-full">
                                {getLicenseIcon(item.planName)}
                                <span className="text-sm text-slate-700 dark:text-slate-300">{item.planName}</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white">{item.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Search and Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('admin.licenses.searchUsers', 'Search users...')}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500"
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        value={filterLicense}
                        onChange={(e) => setFilterLicense(e.target.value)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="all">{t('admin.licenses.allLicenses', 'All Licenses')}</option>
                        <option value="none">{t('admin.licenses.noLicense', 'No License')}</option>
                        {licensePlans.map(plan => (
                            <option key={plan.id} value={plan.id}>{plan.name}</option>
                        ))}
                    </select>
                    {selectedUsers.size > 0 && (
                        <button
                            onClick={() => setShowAssignModal(true)}
                            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                        >
                            <UserPlus className="w-4 h-4" />
                            {t('admin.licenses.bulkAssign', `Assign (${selectedUsers.size})`)}
                        </button>
                    )}
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-navy-950">
                        <tr>
                            <th className="px-4 py-3 text-left">
                                <input
                                    type="checkbox"
                                    checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                                    onChange={selectAllFiltered}
                                    className="rounded border-slate-300 dark:border-white/20 text-purple-600 focus:ring-purple-500"
                                />
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                {t('admin.licenses.user', 'User')}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                {t('admin.licenses.currentLicense', 'Current License')}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                {t('admin.licenses.assignedDate', 'Assigned')}
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                                {t('admin.licenses.actions', 'Actions')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {filteredUsers.map(user => {
                            const userLicense = licensePlans.find(p => p.id === user.licensePlanId);
                            return (
                                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedUsers.has(user.id)}
                                            onChange={() => toggleUserSelection(user.id)}
                                            className="rounded border-slate-300 dark:border-white/20 text-purple-600 focus:ring-purple-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                                                {(user.firstName || user.email).charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">{`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}</p>
                                                <p className="text-sm text-slate-500">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {userLicense ? (
                                            <span className="flex items-center gap-2 px-3 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-full w-fit">
                                                {getLicenseIcon(userLicense.name)}
                                                {userLicense.name}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">{t('admin.licenses.none', 'No license')}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-500">
                                        {user.licenseAssignedAt 
                                            ? new Date(user.licenseAssignedAt).toLocaleDateString()
                                            : '-'
                                        }
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <select
                                                value={user.licensePlanId || ''}
                                                onChange={(e) => handleAssignLicense(user.id, e.target.value)}
                                                disabled={assigningLicense === user.id}
                                                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                                            >
                                                <option value="">{t('admin.licenses.noLicense', 'No License')}</option>
                                                {licensePlans.map(plan => (
                                                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                                                ))}
                                            </select>
                                            {assigningLicense === user.id && (
                                                <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {filteredUsers.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        {t('admin.licenses.noUsersFound', 'No users found')}
                    </div>
                )}
            </div>

            {/* Bulk Assign Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="p-6 border-b border-slate-200 dark:border-white/10">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {t('admin.licenses.bulkAssignTitle', 'Bulk Assign Licenses')}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {t('admin.licenses.bulkAssignDesc', `Assign license to ${selectedUsers.size} selected users`)}
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    {t('admin.licenses.selectLicense', 'Select License Type')}
                                </label>
                                <select
                                    value={bulkAssignPlan}
                                    onChange={(e) => setBulkAssignPlan(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="">{t('admin.licenses.removeLicense', 'Remove License')}</option>
                                    {licensePlans.map(plan => (
                                        <option key={plan.id} value={plan.id}>{plan.name} - ${plan.price_monthly}/mo</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="p-6 pt-0 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowAssignModal(false);
                                    setBulkAssignPlan('');
                                }}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-white/5"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={handleBulkAssign}
                                disabled={assigningLicense === 'bulk'}
                                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {assigningLicense === 'bulk' ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('common.processing', 'Processing...')}
                                    </>
                                ) : (
                                    t('admin.licenses.assign', 'Assign')
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LicenseManagementPanel;







