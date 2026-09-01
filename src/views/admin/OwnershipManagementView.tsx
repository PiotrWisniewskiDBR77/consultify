/**
 * OwnershipManagementView - Team ownership safeguards
 *
 * Critical Features:
 * - Display current organization owner
 * - Transfer ownership to another admin
 * - Owner cannot be deleted without transfer
 */

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Check, Crown, RefreshCw, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { DegradedState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { LoadingState } from '../../components/ui/primitives';
import { AdminApi } from '../../services/api/admin.api';
import { useAppStore } from '../../store/useAppStore';
import { OrganizationOwnership, OwnershipTransferRequest, User } from '../../types';
import { formatListDate } from '../../utils/listDateFormat';

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingTransferLoadError, setPendingTransferLoadError] = useState<string | null>(null);

  // Modal states
  const [showTransferModal, setShowTransferModal] = useState(false);
  // Form states
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const isOwner = currentUser?.id === ownership?.ownerUserId;

  const loadOwnershipData = useCallback(async () => {
    setLoading(true);
    try {
      if (!currentOrganization?.id) {
        setOwnership(null);
        setOwnerUser(null);
        setAdmins([]);
        setPendingTransfer(null);
        setLoadError(null);
        setPendingTransferLoadError(null);
        return;
      }

      setLoadError(null);
      setPendingTransferLoadError(null);

      const [ownershipResult, adminsResult, transferResult] = await Promise.allSettled([
        AdminApi.getOrganizationOwnership(currentOrganization.id),
        AdminApi.getOrganizationAdmins(currentOrganization.id),
        AdminApi.getPendingOwnershipTransfer(currentOrganization.id),
      ]);

      const ownershipData = ownershipResult.status === 'fulfilled' ? ownershipResult.value : null;
      const adminsData = adminsResult.status === 'fulfilled' ? adminsResult.value : [];

      const resolvedOwnership = (ownershipData as any)?.ownership || null;
      const resolvedOwner = (ownershipData as any)?.owner || null;
      const resolvedAdmins =
        adminsResult.status === 'fulfilled'
          ? Array.isArray(adminsData)
            ? adminsData
            : Array.isArray((adminsData as any)?.admins)
              ? (adminsData as any).admins
              : []
          : [];

      setOwnership(resolvedOwnership);
      setOwnerUser(resolvedOwner);
      setAdmins(
        resolvedAdmins.filter(
          (admin: User) => admin.id !== (resolvedOwnership?.ownerUserId || resolvedOwner?.id)
        )
      );
      if (ownershipResult.status === 'rejected') {
        setLoadError(
          ownershipResult.reason instanceof Error
            ? ownershipResult.reason.message
            : t('admin.ownership.errors.loadFallback', 'Ownership information failed to load.')
        );
      }
      if (adminsResult.status === 'rejected') {
        setPendingTransferLoadError(
          t('admin.ownership.errors.adminsFallback', 'Admin candidates failed to load.')
        );
      }
      if (transferResult.status === 'fulfilled') {
        const transferData = transferResult.value;
        setPendingTransfer((transferData as any)?.pendingTransfer || (transferData as any) || null);
      } else {
        setPendingTransfer(null);
        setPendingTransferLoadError(
          t(
            'admin.ownership.errors.pendingTransferFallback',
            'Pending ownership transfer status failed to load.'
          )
        );
      }
    } catch (error) {
      console.error('Failed to load ownership data:', error);
      setOwnership(null);
      setOwnerUser(null);
      setAdmins([]);
      setPendingTransfer(null);
      setLoadError(
        error instanceof Error
          ? error.message
          : t('admin.ownership.errors.genericLoad', 'Failed to load ownership information')
      );
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, t]);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadOwnershipData();
    }
  }, [currentOrganization?.id, loadOwnershipData]);

  const handleTransferOwnership = async () => {
    if (!selectedAdminId) {
      toast.error(t('admin.ownership.toasts.selectAdmin', 'Please select an admin to transfer ownership to'));
      return;
    }

    setSaving(true);
    try {
      if (!currentOrganization?.id) {
        throw new Error(t('admin.ownership.errors.noOrganization', 'No organization selected'));
      }

      await AdminApi.transferOrganizationOwnership(currentOrganization.id, {
        toUserId: selectedAdminId,
        reason: transferReason,
      });
      toast.success(
        t(
          'admin.ownership.toasts.transferSent',
          'Ownership transfer request sent. The new owner must accept the transfer.'
        )
      );
      setShowTransferModal(false);
      loadOwnershipData();
    } catch (error) {
      toast.error(t('admin.ownership.toasts.transferFailed', 'Failed to initiate ownership transfer'));
    }
    setSaving(false);
  };

  const handleCancelTransfer = async () => {
    try {
      if (!currentOrganization?.id) {
        throw new Error(t('admin.ownership.errors.noOrganization', 'No organization selected'));
      }

      await AdminApi.cancelOrganizationOwnershipTransfer(currentOrganization.id);
      toast.success(t('admin.ownership.toasts.transferCancelled', 'Transfer cancelled'));
      setPendingTransfer(null);
    } catch (error) {
      toast.error(t('admin.ownership.toasts.cancelFailed', 'Failed to cancel transfer'));
    }
  };

  const handleAcceptTransfer = async () => {
    try {
      if (!currentOrganization?.id) {
        throw new Error(t('admin.ownership.errors.noOrganization', 'No organization selected'));
      }

      await AdminApi.acceptOrganizationOwnershipTransfer(currentOrganization.id);
      toast.success(t('admin.ownership.toasts.acceptedOwnership', 'You are now the organization owner!'));
      loadOwnershipData();
    } catch (error) {
      toast.error(t('admin.ownership.toasts.acceptFailed', 'Failed to accept transfer'));
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
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
          {t('admin.ownership.desc', 'Manage the team owner and ownership transfer safeguards')}
        </p>
      </div>

      {loadError ? (
        <DegradedState
          title={t('admin.ownership.errors.loadTitle', 'Ownership information unavailable')}
          description={loadError}
        />
      ) : (
        <>
          {/* Pending Transfer Alert */}
          {pendingTransfer && pendingTransfer.toUserId === currentUser?.id && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-c-info/10 border border-c-info/30 rounded-xl"
            >
              <div className="flex items-start gap-3">
                <Crown className="w-5 h-5 text-c-info mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-c-text">
                    {t('admin.ownership.pendingBanner.title', 'Ownership Transfer Pending')}
                  </h4>
                  <p className="text-sm text-c-text-secondary mt-1">
                    {t(
                      'admin.ownership.pendingBanner.description',
                      'You have been selected to become the new organization owner for this team.'
                    )}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleAcceptTransfer}
                      className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium"
                    >
                      <Check size={16} />
                      {t('admin.ownership.pendingBanner.accept', 'Accept Ownership')}
                    </button>
                    <button
                      onClick={handleCancelTransfer}
                      className="flex items-center gap-2 px-4 py-2 border border-c-info/40 text-c-info rounded-lg text-sm font-medium hover:bg-c-info/10"
                    >
                      <X size={16} />
                      {t('admin.ownership.pendingBanner.decline', 'Decline')}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {pendingTransferLoadError && (
            <DegradedState
              title={t(
                'admin.ownership.errors.pendingTransferTitle',
                'Pending ownership transfer status unavailable'
              )}
              description={pendingTransferLoadError}
            />
          )}

          {/* Owner Card */}
          <div className="p-6 bg-gradient-to-br from-amber-50 to-amber-50 dark:from-amber-900/20 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-amber-500/30">
                {ownerUser?.firstName?.[0] || 'O'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {ownerUser?.firstName} {ownerUser?.lastName}
                  </h3>
                  <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full font-medium">
                    {t('admin.ownership.ownerCard.badge', 'OWNER')}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {ownerUser?.email}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                  {t('admin.ownership.ownerCard.since', 'Owner since')}{' '}
                  {ownership?.createdAt
                    ? formatListDate(ownership.createdAt)
                    : t('admin.ownership.ownerCard.initialSetup', 'Initial Setup')}
                </p>
              </div>
              {isOwner && (
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                >
                  <ArrowRight size={16} />
                  {t('admin.ownership.transferAction', 'Transfer Ownership')}
                </button>
              )}
            </div>

            {/* Warning */}
            <div className="mt-4 p-3 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t(
                  'admin.ownership.ownerCard.warning',
                  'The organization owner cannot be removed from the team list. To remove this user, transfer ownership first.'
                )}
              </p>
            </div>
          </div>

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
                      {t('admin.ownership.transferAction', 'Transfer Ownership')}
                    </h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        {t(
                          'admin.ownership.modal.info',
                          'Transferring ownership moves owner-only team safeguards to the selected admin. You will retain admin privileges but will no longer be the team owner.'
                        )}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {t('admin.ownership.modal.selectLabel', 'Select New Owner')}
                      </label>
                      <select
                        value={selectedAdminId}
                        onChange={(e) => setSelectedAdminId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                      >
                        <option value="">
                          {t('admin.ownership.modal.selectPlaceholder', 'Select an admin...')}
                        </option>
                        {admins.map((admin) => (
                          <option key={admin.id} value={admin.id}>
                            {admin.firstName} {admin.lastName} ({admin.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {t('admin.ownership.modal.reasonLabel', 'Reason (optional)')}
                      </label>
                      <textarea
                        value={transferReason}
                        onChange={(e) => setTransferReason(e.target.value)}
                        rows={2}
                        placeholder={t(
                          'admin.ownership.modal.reasonPlaceholder',
                          'Why are you transferring ownership?'
                        )}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
                    <button
                      onClick={() => setShowTransferModal(false)}
                      className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      {t('admin.ownership.modal.cancel', 'Cancel')}
                    </button>
                    <button
                      onClick={handleTransferOwnership}
                      disabled={saving || !selectedAdminId}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium disabled:opacity-50"
                    >
                      {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                      {t('admin.ownership.transferAction', 'Transfer Ownership')}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default OwnershipManagementView;
