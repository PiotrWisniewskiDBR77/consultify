/**
 * PrivacyDataSettings Component
 *
 * Privacy and data management settings with GDPR compliance:
 * - Activity status visibility
 * - Profile visibility
 * - Online status sharing
 * - Data export (GDPR compliance)
 * - Account deletion request
 * - Marketing preferences
 * - Analytics sharing
 */

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileDown,
  Globe,
  Loader2,
  Mail,
  Save,
  Shield,
  Trash2,
  UserCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { User } from '../../types';

interface PrivacyDataSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface PrivacyPreferences {
  // Visibility Settings
  profileVisibility: 'public' | 'organization' | 'private';
  showOnlineStatus: boolean;
  showActivityStatus: boolean;
  showLastSeen: boolean;

  // Data Sharing
  shareAnalytics: boolean;
  shareUsageData: boolean;
  improveAI: boolean;

  // Marketing
  marketingEmails: boolean;
  productUpdates: boolean;
  newsletterSubscribed: boolean;

  // Third Party
  allowThirdPartyIntegrations: boolean;
}

const DEFAULT_PREFERENCES: PrivacyPreferences = {
  profileVisibility: 'organization',
  showOnlineStatus: true,
  showActivityStatus: true,
  showLastSeen: true,
  shareAnalytics: true,
  shareUsageData: false,
  improveAI: true,
  marketingEmails: false,
  productUpdates: true,
  newsletterSubscribed: false,
  allowThirdPartyIntegrations: true,
};

export const PrivacyDataSettings: React.FC<PrivacyDataSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<PrivacyPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [lastExportDate, setLastExportDate] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
  }, [currentUser.id]);

  const loadPreferences = async () => {
    try {
      const data = await Api.get('/settings/preferences/privacy');
      if (data.preferences) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
      }
      if (data.lastExportDate) {
        setLastExportDate(data.lastExportDate);
      }
    } catch (error) {
      console.error('Failed to load privacy preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Api.put('/settings/preferences/privacy', { preferences });
      toast.success(t('settings.privacy.saved', 'Privacy settings saved'));
    } catch (error) {
      toast.error(t('settings.privacy.error', 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = <K extends keyof PrivacyPreferences>(
    key: K,
    value: PrivacyPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const handleExportData = async () => {
    setExportingData(true);
    try {
      const response = await Api.post('/settings/export-data', {});

      // Trigger download if blob is returned
      if (response.downloadUrl) {
        window.open(response.downloadUrl, '_blank');
      }

      toast.success(
        t(
          'settings.privacy.exportStarted',
          'Data export started. You will receive an email when ready.'
        )
      );
      setLastExportDate(new Date().toISOString());
    } catch (error: any) {
      toast.error(error.message || t('settings.privacy.exportError', 'Failed to export data'));
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== currentUser.email) {
      toast.error(t('settings.privacy.emailMismatch', 'Email does not match'));
      return;
    }

    setDeletingAccount(true);
    try {
      await Api.post('/settings/request-deletion', {
        email: currentUser.email,
        reason: 'user_requested',
      });
      toast.success(
        t(
          'settings.privacy.deletionRequested',
          'Account deletion request submitted. You will receive a confirmation email.'
        )
      );
      setShowDeleteModal(false);
    } catch (error: any) {
      toast.error(
        error.message || t('settings.privacy.deletionError', 'Failed to submit deletion request')
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  const visibilityOptions = [
    {
      value: 'public',
      label: t('settings.privacy.visibility.public', 'Public'),
      description: t('settings.privacy.visibility.publicDesc', 'Anyone can view your profile'),
    },
    {
      value: 'organization',
      label: t('settings.privacy.visibility.organization', 'Organization Only'),
      description: t(
        'settings.privacy.visibility.organizationDesc',
        'Only members of your organization'
      ),
    },
    {
      value: 'private',
      label: t('settings.privacy.visibility.private', 'Private'),
      description: t('settings.privacy.visibility.privateDesc', 'Only you can see your profile'),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Shield size={28} className="text-emerald-500" />
            {t('settings.privacy.title', 'Privacy & Data')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t('settings.privacy.description', 'Manage your privacy settings and personal data')}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save Changes')}
        </button>
      </div>

      {/* Profile Visibility */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <UserCircle size={20} className="text-blue-500" />
          {t('settings.privacy.profileVisibility', 'Profile Visibility')}
        </h3>
        <p className="text-sm text-c-text-muted mb-4">
          {t(
            'settings.privacy.profileVisibilityDescription',
            'Control who can see your profile information'
          )}
        </p>

        <div className="space-y-3">
          {visibilityOptions.map((option) => {
            const isSelected = preferences.profileVisibility === option.value;
            return (
              <label
                key={option.value}
                className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                    : 'border-c-border-subtle dark:border-navy-700 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="profileVisibility"
                    value={option.value}
                    checked={isSelected}
                    onChange={() =>
                      updatePreference(
                        'profileVisibility',
                        option.value as PrivacyPreferences['profileVisibility']
                      )
                    }
                    className="sr-only"
                  />
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-blue-500 bg-blue-500' : 'border-c-border-subtle'
                    }`}
                  >
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                  <div>
                    <span
                      className={`font-medium ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-c-text-secondary'}`}
                    >
                      {option.label}
                    </span>
                    <p className="text-xs text-c-text-muted mt-0.5">{option.description}</p>
                  </div>
                </div>
                {isSelected ? (
                  <Eye size={18} className="text-blue-500" />
                ) : (
                  <EyeOff size={18} className="text-c-text-secondary" />
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Activity & Status */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Activity size={20} className="text-green-500" />
          {t('settings.privacy.activityStatus', 'Activity & Status')}
        </h3>

        <div className="space-y-4">
          {/* Online Status */}
          <div className="flex items-center justify-between py-3">
            <div>
              <label className="block font-medium text-c-text-secondary flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                {t('settings.privacy.showOnlineStatus', 'Show Online Status')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.privacy.showOnlineStatusDescription',
                  'Let others see when you are online'
                )}
              </p>
            </div>
            <button
              onClick={() => updatePreference('showOnlineStatus', !preferences.showOnlineStatus)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.showOnlineStatus ? 'bg-emerald-600' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.showOnlineStatus ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>

          {/* Activity Status */}
          <div className="flex items-center justify-between py-3 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.privacy.showActivityStatus', 'Show Activity Status')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.privacy.showActivityStatusDescription',
                  'Show what you are currently working on'
                )}
              </p>
            </div>
            <button
              onClick={() =>
                updatePreference('showActivityStatus', !preferences.showActivityStatus)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.showActivityStatus ? 'bg-emerald-600' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.showActivityStatus ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>

          {/* Last Seen */}
          <div className="flex items-center justify-between py-3 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary flex items-center gap-2">
                <Clock size={16} className="text-c-text-secondary" />
                {t('settings.privacy.showLastSeen', 'Show Last Seen')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t('settings.privacy.showLastSeenDescription', 'Show when you were last active')}
              </p>
            </div>
            <button
              onClick={() => updatePreference('showLastSeen', !preferences.showLastSeen)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.showLastSeen ? 'bg-emerald-600' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.showLastSeen ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Data Sharing & Analytics */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <BarChart3 size={20} className="text-c-accent" />
          {t('settings.privacy.dataSharing', 'Data Sharing')}
        </h3>

        <div className="space-y-4">
          {/* Analytics */}
          <div className="flex items-center justify-between py-3">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.privacy.shareAnalytics', 'Share Analytics Data')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.privacy.shareAnalyticsDescription',
                  'Help us improve with anonymous usage statistics'
                )}
              </p>
            </div>
            <button
              onClick={() => updatePreference('shareAnalytics', !preferences.shareAnalytics)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.shareAnalytics ? 'bg-c-focus' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.shareAnalytics ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>

          {/* AI Improvement */}
          <div className="flex items-center justify-between py-3 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.privacy.improveAI', 'Help Improve AI')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.privacy.improveAIDescription',
                  'Allow anonymized data to improve AI responses'
                )}
              </p>
            </div>
            <button
              onClick={() => updatePreference('improveAI', !preferences.improveAI)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.improveAI ? 'bg-c-focus' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.improveAI ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>

          {/* Third Party Integrations */}
          <div className="flex items-center justify-between py-3 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary flex items-center gap-2">
                <Globe size={16} className="text-blue-500" />
                {t('settings.privacy.thirdParty', 'Third-Party Integrations')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.privacy.thirdPartyDescription',
                  'Allow connected apps to access your data'
                )}
              </p>
            </div>
            <button
              onClick={() =>
                updatePreference(
                  'allowThirdPartyIntegrations',
                  !preferences.allowThirdPartyIntegrations
                )
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.allowThirdPartyIntegrations ? 'bg-c-focus' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.allowThirdPartyIntegrations ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Marketing Preferences */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Mail size={20} className="text-amber-500" />
          {t('settings.privacy.marketing', 'Communication Preferences')}
        </h3>

        <div className="space-y-4">
          {/* Product Updates */}
          <div className="flex items-center justify-between py-3">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.privacy.productUpdates', 'Product Updates')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.privacy.productUpdatesDescription',
                  'Receive emails about new features and improvements'
                )}
              </p>
            </div>
            <button
              onClick={() => updatePreference('productUpdates', !preferences.productUpdates)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.productUpdates ? 'bg-amber-500' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.productUpdates ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>

          {/* Marketing Emails */}
          <div className="flex items-center justify-between py-3 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.privacy.marketingEmails', 'Marketing Emails')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.privacy.marketingEmailsDescription',
                  'Receive promotional offers and marketing content'
                )}
              </p>
            </div>
            <button
              onClick={() => updatePreference('marketingEmails', !preferences.marketingEmails)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.marketingEmails ? 'bg-amber-500' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.marketingEmails ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>

          {/* Newsletter */}
          <div className="flex items-center justify-between py-3 border-t border-c-border-subtle dark:border-navy-700">
            <div>
              <label className="block font-medium text-c-text-secondary">
                {t('settings.privacy.newsletter', 'Newsletter')}
              </label>
              <p className="text-sm text-c-text-muted">
                {t('settings.privacy.newsletterDescription', 'Subscribe to our monthly newsletter')}
              </p>
            </div>
            <button
              onClick={() =>
                updatePreference('newsletterSubscribed', !preferences.newsletterSubscribed)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.newsletterSubscribed ? 'bg-amber-500' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`${preferences.newsletterSubscribed ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Data Export & Deletion */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Download size={20} className="text-blue-500" />
          {t('settings.privacy.dataManagement', 'Data Management')}
        </h3>
        <p className="text-sm text-c-text-muted mb-6">
          {t(
            'settings.privacy.dataManagementDescription',
            'Export or delete your personal data in compliance with GDPR'
          )}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export Data */}
          <div className="p-4 bg-c-surface-raised rounded-xl border border-c-border-subtle dark:border-navy-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                <FileDown size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-c-text">
                  {t('settings.privacy.exportData', 'Export Your Data')}
                </h4>
                <p className="text-xs text-c-text-muted">
                  {t(
                    'settings.privacy.exportDataDescription',
                    'Download all your data in JSON format'
                  )}
                </p>
              </div>
            </div>
            {lastExportDate && (
              <p className="text-xs text-c-text-muted mb-3">
                {t('settings.privacy.lastExport', 'Last export:')}{' '}
                {new Date(lastExportDate).toLocaleDateString()}
              </p>
            )}
            <button
              onClick={handleExportData}
              disabled={exportingData}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {exportingData ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {exportingData
                ? t('settings.privacy.exporting', 'Exporting...')
                : t('settings.privacy.requestExport', 'Request Export')}
            </button>
          </div>

          {/* Delete Account */}
          <div className="p-4 bg-danger-50 dark:bg-danger-900/10 rounded-xl border border-danger-200 dark:border-danger-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-danger-100 dark:bg-danger-500/20 rounded-lg">
                <Trash2 size={20} className="text-danger-600 dark:text-danger-400" />
              </div>
              <div>
                <h4 className="font-medium text-danger-900 dark:text-danger-300">
                  {t('settings.privacy.deleteAccount', 'Delete Account')}
                </h4>
                <p className="text-xs text-danger-700 dark:text-danger-400">
                  {t('settings.privacy.deleteAccountWarning', 'This action is irreversible')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-danger-600 hover:bg-danger-500 text-white rounded-lg transition-colors"
            >
              <Trash2 size={16} />
              {t('settings.privacy.requestDeletion', 'Request Deletion')}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-c-surface rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-danger-100 dark:bg-danger-500/20 rounded-full">
                <AlertTriangle size={24} className="text-danger-600 dark:text-danger-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-c-text">
                  {t('settings.privacy.confirmDeletion', 'Confirm Account Deletion')}
                </h3>
                <p className="text-sm text-c-text-muted">
                  {t(
                    'settings.privacy.deletionWarningDetail',
                    'This will permanently delete all your data'
                  )}
                </p>
              </div>
            </div>

            <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-500/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-danger-700 dark:text-danger-300">
                {t(
                  'settings.privacy.deletionConsequences',
                  'You will lose access to all your projects, tasks, and data. This action cannot be undone.'
                )}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-c-text-secondary mb-2">
                {t('settings.privacy.typeEmailToConfirm', 'Type your email to confirm:')}
              </label>
              <input
                type="email"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={currentUser.email}
                className="w-full px-4 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmation('');
                }}
                className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg font-medium"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirmation !== currentUser.email}
                className="px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-500 disabled:opacity-50 font-medium flex items-center gap-2"
              >
                {deletingAccount && <Loader2 size={16} className="animate-spin" />}
                {deletingAccount
                  ? t('settings.privacy.deleting', 'Deleting...')
                  : t('settings.privacy.permanentlyDelete', 'Permanently Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivacyDataSettings;
