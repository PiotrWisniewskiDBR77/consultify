/**
 * ApprovedDomainsSettings - Approved email domains management
 *
 * Features:
 * - List of domains with actions (Edit, Delete)
 * - "Add domain" button
 * - Toggle: "Allow auto-join" (like Slack)
 * - Domain verification status
 *
 * Design: List with add/remove actions, HubSpot-style
 */

import {
  AlertCircle,
  Check,
  ChevronRight,
  Globe,
  HelpCircle,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Input } from '../../ui/primitives/Input';
import { Modal } from '../../ui/primitives/Modal';
import { Tooltip } from '../../ui/primitives/Tooltip';

export interface ApprovedDomain {
  id: string;
  domain: string;
  autoJoin: boolean;
  verified: boolean;
  verificationMethod?: 'dns' | 'email';
  addedAt: string;
  addedBy?: string;
  usersCount?: number;
}

interface ApprovedDomainsSettingsProps {
  domains: ApprovedDomain[];
  onAdd: (domain: string, autoJoin: boolean) => Promise<void>;
  onUpdate: (id: string, updates: Partial<ApprovedDomain>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onVerify: (id: string) => Promise<boolean>;
  className?: string;
}

export const ApprovedDomainsSettings: React.FC<ApprovedDomainsSettingsProps> = ({
  domains,
  onAdd,
  onUpdate,
  onDelete,
  onVerify,
  className,
}) => {
  const { t } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [autoJoin, setAutoJoin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Validate domain format
  const isValidDomain = useCallback((domain: string): boolean => {
    return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/.test(domain);
  }, []);

  // Handle add domain
  const handleAdd = useCallback(async () => {
    if (!newDomain.trim()) {
      setError(t('admin.org.domains.errors.required', 'Domain is required'));
      return;
    }

    if (!isValidDomain(newDomain.trim())) {
      setError(t('admin.org.domains.errors.invalid', 'Invalid domain format'));
      return;
    }

    // Check for duplicates
    if (domains.some((d) => d.domain.toLowerCase() === newDomain.toLowerCase().trim())) {
      setError(t('admin.org.domains.errors.duplicate', 'Domain already exists'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onAdd(newDomain.trim().toLowerCase(), autoJoin);
      setShowAddModal(false);
      setNewDomain('');
      setAutoJoin(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [newDomain, autoJoin, domains, onAdd, isValidDomain, t]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!showDeleteModal) return;

    setLoading(true);
    try {
      await onDelete(showDeleteModal);
      setShowDeleteModal(null);
    } catch (err) {
      console.error('Failed to delete domain:', err);
    } finally {
      setLoading(false);
    }
  }, [showDeleteModal, onDelete]);

  // Handle verify
  const handleVerify = useCallback(
    async (id: string) => {
      setVerifyingId(id);
      try {
        await onVerify(id);
      } catch (err) {
        console.error('Failed to verify domain:', err);
      } finally {
        setVerifyingId(null);
      }
    },
    [onVerify]
  );

  // Handle toggle auto-join
  const handleToggleAutoJoin = useCallback(
    async (domain: ApprovedDomain) => {
      try {
        await onUpdate(domain.id, { autoJoin: !domain.autoJoin });
      } catch (err) {
        console.error('Failed to update domain:', err);
      }
    },
    [onUpdate]
  );

  const domainToDelete = showDeleteModal ? domains.find((d) => d.id === showDeleteModal) : null;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header Card */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail size={20} className="text-primary-500" />
            <h3 className="text-lg font-medium text-navy-900 dark:text-white">
              {t('admin.org.domains.title', 'Approved Email Domains')}
            </h3>
            <Tooltip
              content={t(
                'admin.org.domains.tooltip',
                'Users with email addresses from approved domains can sign up without an invitation'
              )}
            >
              <button className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300">
                <HelpCircle size={16} />
              </button>
            </Tooltip>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            icon={<Plus size={16} />}
          >
            {t('admin.org.domains.addDomain', 'Add Domain')}
          </Button>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {t(
            'admin.org.domains.description',
            'Manage which email domains can automatically join your organization.'
          )}
        </p>

        {/* Domains List */}
        {domains.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-navy-900 rounded-lg border border-dashed border-slate-300 dark:border-navy-600">
            <Globe size={40} className="mx-auto mb-3 text-slate-400 dark:text-slate-500" />
            <h4 className="text-sm font-medium text-navy-900 dark:text-white mb-1">
              {t('admin.org.domains.empty.title', 'No approved domains')}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {t(
                'admin.org.domains.empty.description',
                'Add domains to allow users to sign up automatically'
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddModal(true)}
              icon={<Plus size={16} />}
            >
              {t('admin.org.domains.addFirst', 'Add your first domain')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {domains.map((domain) => (
              <div
                key={domain.id}
                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      domain.verified
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : 'bg-amber-100 dark:bg-amber-900/30'
                    )}
                  >
                    {domain.verified ? (
                      <Shield size={20} className="text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertCircle size={20} className="text-amber-600 dark:text-amber-400" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-navy-900 dark:text-white">
                        @{domain.domain}
                      </span>
                      {domain.verified ? (
                        <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
                          {t('admin.org.domains.verified', 'Verified')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                          {t('admin.org.domains.pending', 'Pending')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {domain.usersCount !== undefined && (
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {domain.usersCount} {t('admin.org.domains.users', 'users')}
                        </span>
                      )}
                      <span>
                        {t('admin.org.domains.addedOn', 'Added')}{' '}
                        {new Date(domain.addedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Auto-join toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {t('admin.org.domains.autoJoin', 'Auto-join')}
                    </span>
                    <button
                      onClick={() => handleToggleAutoJoin(domain)}
                      className={cn(
                        'relative w-10 h-6 rounded-full transition-colors',
                        domain.autoJoin ? 'bg-c-surface' : 'bg-slate-200 dark:bg-navy-700'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-1 w-4 h-4 bg-white dark:bg-navy-900 rounded-full transition-transform',
                          domain.autoJoin ? 'left-5' : 'left-1'
                        )}
                      />
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {!domain.verified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerify(domain.id)}
                        loading={verifyingId === domain.id}
                      >
                        {t('admin.org.domains.verify', 'Verify')}
                      </Button>
                    )}
                    <button
                      onClick={() => setShowDeleteModal(domain.id)}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Shield size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-1">
              {t('admin.org.domains.securityNote.title', 'Security Note')}
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t(
                'admin.org.domains.securityNote.description',
                'When auto-join is enabled, anyone with an email address from the approved domain can create an account and join your organization automatically. Make sure you only approve domains that you control.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Add Domain Modal */}
      <Modal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewDomain('');
          setAutoJoin(false);
          setError(null);
        }}
        title={t('admin.org.domains.addModal.title', 'Add Approved Domain')}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label={t('admin.org.domains.addModal.domainLabel', 'Domain')}
            value={newDomain}
            onChange={(e) => {
              setNewDomain(e.target.value);
              setError(null);
            }}
            placeholder="example.com"
            error={error || undefined}
            icon={<Globe size={16} />}
          />

          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-900 rounded-lg">
            <div>
              <p className="text-sm font-medium text-navy-900 dark:text-white">
                {t('admin.org.domains.addModal.autoJoinLabel', 'Enable auto-join')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'admin.org.domains.addModal.autoJoinDescription',
                  'Users with this domain can sign up without invitation'
                )}
              </p>
            </div>
            <button
              onClick={() => setAutoJoin(!autoJoin)}
              className={cn(
                'relative w-10 h-6 rounded-full transition-colors',
                autoJoin ? 'bg-c-surface' : 'bg-slate-200 dark:bg-navy-700'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white dark:bg-navy-900 rounded-full transition-transform',
                  autoJoin ? 'left-5' : 'left-1'
                )}
              />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-navy-700">
          <Button variant="outline" onClick={() => setShowAddModal(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="primary" onClick={handleAdd} loading={loading}>
            {t('admin.org.domains.addModal.submit', 'Add Domain')}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!showDeleteModal}
        onClose={() => setShowDeleteModal(null)}
        title={t('admin.org.domains.deleteModal.title', 'Remove Domain')}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('admin.org.domains.deleteModal.description', 'Are you sure you want to remove')}{' '}
            <strong className="text-navy-900 dark:text-white">@{domainToDelete?.domain}</strong>
            {t(
              'admin.org.domains.deleteModal.descriptionEnd',
              '? Users from this domain will no longer be able to auto-join.'
            )}
          </p>

          {(domainToDelete?.usersCount ?? 0) > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <AlertCircle size={16} />
                <span className="text-sm">
                  {domainToDelete?.usersCount}{' '}
                  {t(
                    'admin.org.domains.deleteModal.existingUsers',
                    'existing users from this domain will not be affected.'
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-navy-700">
          <Button variant="outline" onClick={() => setShowDeleteModal(null)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={loading}>
            {t('admin.org.domains.deleteModal.confirm', 'Remove Domain')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default ApprovedDomainsSettings;
