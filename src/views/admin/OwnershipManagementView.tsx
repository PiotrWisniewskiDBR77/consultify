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

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  Clock,
  CreditCard,
  Crown,
  FileText,
  Mail,
  MapPin,
  RefreshCw,
  Shield,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { InfoButton } from '../../components/shared/InfoButton';
import { AdminApi } from '../../services/api/admin.api';
import { useAppStore } from '../../store/useAppStore';
import { BillingAddress, OrganizationOwnership, OwnershipTransferRequest, User } from '../../types';

interface OwnershipManagementViewProps {
  className?: string;
}

export const OwnershipManagementView: React.FC<OwnershipManagementViewProps> = ({
  className = '',
}) => {
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

  // Form states
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const isOwner = currentUser?.id === ownership?.ownerUserId;

  const loadOwnershipData = useCallback(async () => {
    setLoading(true);
    try {
      if (!currentOrganization?.id) {
        setOwnership(null);
        setOwnerUser(null);
        setAdmins([]);
        setPendingTransfer(null);
        return;
      }

      const [ownershipData, adminsData, transferData] = await Promise.all([
        AdminApi.getOrganizationOwnership(currentOrganization.id),
        AdminApi.getOrganizationAdmins(currentOrganization.id),
        AdminApi.getPendingOwnershipTransfer(currentOrganization.id).catch(() => null),
      ]);

      const resolvedOwnership = (ownershipData as any)?.ownership || null;
      const resolvedOwner = (ownershipData as any)?.owner || null;
      const resolvedAdmins = Array.isArray(adminsData)
        ? adminsData
        : Array.isArray((adminsData as any)?.admins)
          ? (adminsData as any).admins
          : [];

      setOwnership(resolvedOwnership);
      setOwnerUser(resolvedOwner);
      setAdmins(
        resolvedAdmins.filter(
          (admin: User) => admin.id !== (resolvedOwnership?.ownerUserId || resolvedOwner?.id)
        )
      );
      setPendingTransfer((transferData as any)?.pendingTransfer || (transferData as any) || null);
    } catch (error) {
      console.error('Failed to load ownership data:', error);
      toast.error('Failed to load ownership information');
      setOwnership(null);
      setOwnerUser(null);
      setAdmins([]);
      setPendingTransfer(null);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

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
      if (!currentOrganization?.id) {
        throw new Error('No organization selected');
      }

      await AdminApi.transferOrganizationOwnership(currentOrganization.id, {
        toUserId: selectedAdminId,
        reason: transferReason,
      });
      toast.success('Ownership transfer request sent. The new owner must accept the transfer.');
      setShowTransferModal(false);
      loadOwnershipData();
    } catch (error) {
      toast.error('Failed to initiate ownership transfer');
    }
    setSaving(false);
  };

  const handleCancelTransfer = async () => {
    try {
      if (!currentOrganization?.id) {
        throw new Error('No organization selected');
      }

      await AdminApi.cancelOrganizationOwnershipTransfer(currentOrganization.id);
      toast.success('Transfer cancelled');
      setPendingTransfer(null);
    } catch (error) {
      toast.error('Failed to cancel transfer');
    }
  };

  const handleAcceptTransfer = async () => {
    try {
      if (!currentOrganization?.id) {
        throw new Error('No organization selected');
      }

      await AdminApi.acceptOrganizationOwnershipTransfer(currentOrganization.id);
      toast.success('You are now the organization owner!');
      loadOwnershipData();
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
      if (!currentOrganization?.id) {
        throw new Error('No organization selected');
      }

      await AdminApi.scheduleOrganizationDeletion(currentOrganization.id);
      toast.success('Organization deletion scheduled. You have 30 days to cancel.');
      setShowDeleteModal(false);
    } catch (error) {
      toast.error('Failed to schedule organization deletion');
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
                You have been selected to become the new organization owner. This will make you the
                billing admin.
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
              Billing Admin since{' '}
              {ownership?.createdAt
                ? new Date(ownership.createdAt).toLocaleDateString()
                : 'Initial Setup'}
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
            The organization owner is the billing admin and cannot be deleted. To remove this user,
            ownership must be transferred first.
          </p>
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
                    Transferring ownership will make the selected user the billing admin. You will
                    retain admin privileges but will no longer manage billing.
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
                    {admins.map((admin) => (
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
    </div>
  );
};

export default OwnershipManagementView;
