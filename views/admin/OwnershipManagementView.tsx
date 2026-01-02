/**
 * OwnershipManagementView - Organization Owner & Billing Admin Management
 * 
 * Critical Features:
 * - Display current organization owner (billing admin)
 * - Transfer ownership to another admin
 * - Owner cannot be deleted without transfer
 * - Billing contact information
 * - Organization deletion (30-day grace period)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Crown,
    Shield,
    CreditCard,
    ArrowRight,
    AlertTriangle,
    Check,
    X,
    Mail,
    User as UserIcon,
    Building2,
    Clock,
    Trash2,
    RefreshCw,
    AlertCircle,
    FileText,
    MapPin
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { OrganizationOwnership, BillingAddress, User, OwnershipTransferRequest } from '../../types';
import { InfoButton } from '../../components/shared/InfoButton';

interface OwnershipManagementViewProps {
    className?: string;
}

export const OwnershipManagementView: React.FC<OwnershipManagementViewProps> = ({ className = '' }) => {
    const { t } = useTranslation();
    const { currentOrganization, currentUser } = useAppStore();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [ownership, setOwnership] = useState<OrganizationOwnership | null>(null);
    const [ownerUser, setOwnerUser] = useState<User | null>(null);
    const [admins, setAdmins] = useState<User[]>([]);
    const [pendingTransfer, setPendingTransfer] = useState<OwnershipTransferRequest | null>(null);

    // Modal states
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showBillingModal, setShowBillingModal] = useState(false);

    // Form states
    const [selectedAdminId, setSelectedAdminId] = useState('');
    const [transferReason, setTransferReason] = useState('');
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [billingForm, setBillingForm] = useState<Partial<OrganizationOwnership>>({});

    const isOwner = currentUser?.id === ownership?.ownerUserId;

    const loadOwnershipData = useCallback(async () => {
        setLoading(true);
        try {
            // Load ownership info
            const ownershipRes = await fetch(`/api/organizations/${currentOrganization?.id}/ownership`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (ownershipRes.ok) {
                const data = await ownershipRes.json();
                setOwnership(data.ownership);
                setOwnerUser(data.owner);
                setBillingForm(data.ownership || {});
            }

            // Load admins for transfer
            const adminsRes = await fetch(`/api/organizations/${currentOrganization?.id}/admins`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (adminsRes.ok) {
                const data = await adminsRes.json();
                setAdmins(data.filter((a: User) => a.id !== ownership?.ownerUserId));
            }

            // Check pending transfer
            const transferRes = await fetch(`/api/organizations/${currentOrganization?.id}/ownership/pending-transfer`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (transferRes.ok) {
                const data = await transferRes.json();
                setPendingTransfer(data);
            }
        } catch (error) {
            console.error('Failed to load ownership data:', error);
            // Mock data for development
            setOwnership({
                id: 'owner-1',
                organizationId: currentOrganization?.id || '',
                ownerUserId: currentUser?.id || '',
                billingEmail: currentUser?.email || '',
                billingName: `${currentUser?.firstName} ${currentUser?.lastName}`,
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            setOwnerUser(currentUser || null);
        }
        setLoading(false);
    }, [currentOrganization, currentUser, ownership?.ownerUserId]);

    useEffect(() => {
        if (currentOrganization?.id) {
            loadOwnershipData();
        }
    }, [currentOrganization?.id, loadOwnershipData]);

    const handleTransferOwnership = async () => {
        if (!selectedAdminId) {
            toast.error('Please select an admin to transfer ownership to');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/organizations/${currentOrganization?.id}/ownership/transfer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    toUserId: selectedAdminId,
                    reason: transferReason
                })
            });

            if (res.ok) {
                toast.success('Ownership transfer request sent. The new owner must accept the transfer.');
                setShowTransferModal(false);
                loadOwnershipData();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to initiate transfer');
            }
        } catch (error) {
            toast.error('Failed to initiate ownership transfer');
        }
        setSaving(false);
    };

    const handleCancelTransfer = async () => {
        try {
            const res = await fetch(`/api/organizations/${currentOrganization?.id}/ownership/cancel-transfer`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (res.ok) {
                toast.success('Transfer cancelled');
                setPendingTransfer(null);
            }
        } catch (error) {
            toast.error('Failed to cancel transfer');
        }
    };

    const handleAcceptTransfer = async () => {
        try {
            const res = await fetch(`/api/organizations/${currentOrganization?.id}/ownership/accept-transfer`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (res.ok) {
                toast.success('You are now the organization owner!');
                loadOwnershipData();
            }
        } catch (error) {
            toast.error('Failed to accept transfer');
        }
    };

    const handleDeleteOrganization = async () => {
        if (deleteConfirmText !== currentOrganization?.name) {
            toast.error('Please type the organization name exactly to confirm deletion');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/organizations/${currentOrganization?.id}/schedule-deletion`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (res.ok) {
                toast.success('Organization deletion scheduled. You have 30 days to cancel.');
                setShowDeleteModal(false);
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to schedule deletion');
            }
        } catch (error) {
            toast.error('Failed to schedule organization deletion');
        }
        setSaving(false);
    };

    const handleSaveBillingInfo = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/organizations/${currentOrganization?.id}/billing-info`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(billingForm)
            });

            if (res.ok) {
                toast.success('Billing information updated');
                setShowBillingModal(false);
                loadOwnershipData();
            }
        } catch (error) {
            toast.error('Failed to update billing information');
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className}`}>
            <InfoButton cardId="admin-ownership" position="top-right" />

            {/* Header */}
            <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Crown className="text-amber-500" size={24} />
                    {t('admin.ownership.title', 'Organization Ownership')}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('admin.ownership.desc', 'Manage billing admin and organization ownership')}
                </p>
            </div>

            {/* Pending Transfer Alert */}
            {pendingTransfer && pendingTransfer.toUserId === currentUser?.id && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl"
                >
                    <div className="flex items-start gap-3">
                        <Crown className="w-5 h-5 text-violet-600 dark:text-violet-400 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="font-medium text-violet-800 dark:text-violet-200">
                                Ownership Transfer Pending
                            </h4>
                            <p className="text-sm text-violet-600 dark:text-violet-300 mt-1">
                                You have been selected to become the new organization owner. This will make you the billing admin.
                            </p>
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={handleAcceptTransfer}
                                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium"
                                >
                                    <Check size={16} />
                                    Accept Ownership
                                </button>
                                <button
                                    onClick={handleCancelTransfer}
                                    className="flex items-center gap-2 px-4 py-2 border border-violet-300 dark:border-violet-600 text-violet-700 dark:text-violet-300 rounded-lg text-sm font-medium hover:bg-violet-50 dark:hover:bg-violet-900/30"
                                >
                                    <X size={16} />
                                    Decline
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Owner Card */}
            <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-amber-500/30">
                        {ownerUser?.firstName?.[0] || 'O'}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                {ownerUser?.firstName} {ownerUser?.lastName}
                            </h3>
                            <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full font-medium">
                                OWNER
                            </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{ownerUser?.email}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                            Billing Admin since {new Date(ownership?.createdAt || '').toLocaleDateString()}
                        </p>
                    </div>
                    {isOwner && (
                        <button
                            onClick={() => setShowTransferModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                        >
                            <ArrowRight size={16} />
                            Transfer Ownership
                        </button>
                    )}
                </div>

                {/* Warning */}
                <div className="mt-4 p-3 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                        The organization owner is the billing admin and cannot be deleted. To remove this user, ownership must be transferred first.
                    </p>
                </div>
            </div>

            {/* Billing Information */}
            <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText size={20} />
                        Billing Information
                    </h3>
                    {isOwner && (
                        <button
                            onClick={() => setShowBillingModal(true)}
                            className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
                        >
                            Edit
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-slate-400" />
                        <div>
                            <p className="text-xs text-slate-500">Billing Email</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                                {ownership?.billingEmail || ownerUser?.email}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <UserIcon className="w-5 h-5 text-slate-400" />
                        <div>
                            <p className="text-xs text-slate-500">Billing Name</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                                {ownership?.billingName || `${ownerUser?.firstName} ${ownerUser?.lastName}`}
                            </p>
                        </div>
                    </div>
                    {ownership?.taxId && (
                        <div className="flex items-center gap-3">
                            <Building2 className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">Tax ID / VAT</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                    {ownership.taxId}
                                </p>
                            </div>
                        </div>
                    )}
                    {ownership?.billingAddress && (
                        <div className="flex items-center gap-3">
                            <MapPin className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">Billing Address</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                    {ownership.billingAddress.city}, {ownership.billingAddress.country}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Method Preview */}
            <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <CreditCard size={20} />
                        Payment Method
                    </h3>
                    {isOwner && (
                        <a href="#billing" className="text-sm text-violet-600 dark:text-violet-400 hover:underline">
                            Manage
                        </a>
                    )}
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-navy-700/50 rounded-lg">
                    <div className="p-3 bg-white dark:bg-navy-800 rounded-lg">
                        <CreditCard className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div>
                        <p className="font-medium text-slate-900 dark:text-white">•••• •••• •••• 4242</p>
                        <p className="text-sm text-slate-500">Expires 12/2026</p>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            {isOwner && (
                <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <h3 className="text-lg font-medium text-red-800 dark:text-red-200 flex items-center gap-2 mb-2">
                        <AlertTriangle size={20} />
                        Danger Zone
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                        These actions are irreversible. Please proceed with caution.
                    </p>
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
                    >
                        <Trash2 size={16} />
                        Delete Organization
                    </button>
                </div>
            )}

            {/* Transfer Modal */}
            <AnimatePresence>
                {showTransferModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-200 dark:border-navy-700">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Crown className="text-amber-500" size={20} />
                                    Transfer Ownership
                                </h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                    <p className="text-sm text-amber-700 dark:text-amber-300">
                                        Transferring ownership will make the selected user the billing admin. You will retain admin privileges but will no longer manage billing.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Select New Owner
                                    </label>
                                    <select
                                        value={selectedAdminId}
                                        onChange={(e) => setSelectedAdminId(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                                    >
                                        <option value="">Select an admin...</option>
                                        {admins.map(admin => (
                                            <option key={admin.id} value={admin.id}>
                                                {admin.firstName} {admin.lastName} ({admin.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Reason (optional)
                                    </label>
                                    <textarea
                                        value={transferReason}
                                        onChange={(e) => setTransferReason(e.target.value)}
                                        rows={2}
                                        placeholder="Why are you transferring ownership?"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowTransferModal(false)}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleTransferOwnership}
                                    disabled={saving || !selectedAdminId}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium disabled:opacity-50"
                                >
                                    {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    Transfer Ownership
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Modal */}
            <AnimatePresence>
                {showDeleteModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
                        >
                            <div className="p-6 border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 flex items-center gap-2">
                                    <AlertTriangle size={20} />
                                    Delete Organization
                                </h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                                    <p className="text-sm text-red-700 dark:text-red-300 font-medium mb-2">
                                        This action will:
                                    </p>
                                    <ul className="text-sm text-red-600 dark:text-red-400 space-y-1 list-disc list-inside">
                                        <li>Schedule organization deletion in 30 days</li>
                                        <li>Cancel your subscription immediately</li>
                                        <li>Remove all users from the organization</li>
                                        <li>Delete all projects, tasks, and data</li>
                                    </ul>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Type "<span className="font-bold">{currentOrganization?.name}</span>" to confirm
                                    </label>
                                    <input
                                        type="text"
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        placeholder={currentOrganization?.name}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-red-200 dark:border-red-800 rounded-lg text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteOrganization}
                                    disabled={saving || deleteConfirmText !== currentOrganization?.name}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
                                >
                                    {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    Delete Organization
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Billing Info Modal */}
            <AnimatePresence>
                {showBillingModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden max-h-[90vh] overflow-y-auto"
                        >
                            <div className="p-6 border-b border-slate-200 dark:border-navy-700">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <FileText size={20} />
                                    Edit Billing Information
                                </h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Billing Name
                                        </label>
                                        <input
                                            type="text"
                                            value={billingForm.billingName || ''}
                                            onChange={(e) => setBillingForm({ ...billingForm, billingName: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Billing Email
                                        </label>
                                        <input
                                            type="email"
                                            value={billingForm.billingEmail || ''}
                                            onChange={(e) => setBillingForm({ ...billingForm, billingEmail: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Tax ID
                                        </label>
                                        <input
                                            type="text"
                                            value={billingForm.taxId || ''}
                                            onChange={(e) => setBillingForm({ ...billingForm, taxId: e.target.value })}
                                            placeholder="e.g., PL1234567890"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            VAT Number
                                        </label>
                                        <input
                                            type="text"
                                            value={billingForm.vatNumber || ''}
                                            onChange={(e) => setBillingForm({ ...billingForm, vatNumber: e.target.value })}
                                            placeholder="e.g., EU123456789"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-200 dark:border-navy-700">
                                    <h4 className="font-medium text-slate-900 dark:text-white mb-3">Billing Address</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <input
                                                type="text"
                                                placeholder="Address Line 1"
                                                value={billingForm.billingAddress?.line1 || ''}
                                                onChange={(e) => setBillingForm({
                                                    ...billingForm,
                                                    billingAddress: { ...billingForm.billingAddress, line1: e.target.value } as BillingAddress
                                                })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="text"
                                                placeholder="Address Line 2 (optional)"
                                                value={billingForm.billingAddress?.line2 || ''}
                                                onChange={(e) => setBillingForm({
                                                    ...billingForm,
                                                    billingAddress: { ...billingForm.billingAddress, line2: e.target.value } as BillingAddress
                                                })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="City"
                                                value={billingForm.billingAddress?.city || ''}
                                                onChange={(e) => setBillingForm({
                                                    ...billingForm,
                                                    billingAddress: { ...billingForm.billingAddress, city: e.target.value } as BillingAddress
                                                })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Postal Code"
                                                value={billingForm.billingAddress?.postalCode || ''}
                                                onChange={(e) => setBillingForm({
                                                    ...billingForm,
                                                    billingAddress: { ...billingForm.billingAddress, postalCode: e.target.value } as BillingAddress
                                                })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="text"
                                                placeholder="Country"
                                                value={billingForm.billingAddress?.country || ''}
                                                onChange={(e) => setBillingForm({
                                                    ...billingForm,
                                                    billingAddress: { ...billingForm.billingAddress, country: e.target.value } as BillingAddress
                                                })}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowBillingModal(false)}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveBillingInfo}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium disabled:opacity-50"
                                >
                                    {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    Save Changes
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default OwnershipManagementView;


