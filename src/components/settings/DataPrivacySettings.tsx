import {
  AlertTriangle,
  CheckCircle,
  Database,
  Download,
  Eye,
  FileText,
  Info,
  Loader2,
  Save,
  Shield,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';

import { Api } from '../../services/api';
import { User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';

interface DataPrivacySettingsProps {
  currentUser: User;
  onUpdate?: () => void;
}

type DataRetentionPolicy = 'minimal' | 'standard' | 'extended';

interface PrivacyPreferences {
  shareAnalytics: boolean;
  shareUsageData: boolean;
  improveAI: boolean;
  marketingEmails: boolean;
  productUpdates: boolean;
  newsletterSubscribed: boolean;
  allowThirdPartyIntegrations: boolean;
  dataRetentionPolicy: DataRetentionPolicy;
  enablePiiRedaction: boolean;
}

const DEFAULT_PRIVACY_PREFERENCES: PrivacyPreferences = {
  shareAnalytics: true,
  shareUsageData: false,
  improveAI: true,
  marketingEmails: false,
  productUpdates: true,
  newsletterSubscribed: false,
  allowThirdPartyIntegrations: true,
  dataRetentionPolicy: 'standard',
  enablePiiRedaction: false,
};

export const DataPrivacySettings: React.FC<DataPrivacySettingsProps> = ({
  currentUser,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [privacySettings, setPrivacySettings] = useState<PrivacyPreferences>(
    DEFAULT_PRIVACY_PREFERENCES
  );

  const normalizePreferences = useCallback((response: unknown): PrivacyPreferences | null => {
    const preferences = (response as { preferences?: Partial<PrivacyPreferences> })?.preferences;
    if (!preferences) return null;
    return { ...DEFAULT_PRIVACY_PREFERENCES, ...preferences };
  }, []);

  const preferencesMatch = (left: PrivacyPreferences, right: PrivacyPreferences) =>
    JSON.stringify(left) === JSON.stringify(right);

  const loadPrivacySettings = useCallback(async (): Promise<PrivacyPreferences | null> => {
    try {
      setLoadError(null);
      const response = await Api.get('/settings/preferences/privacy');
      const next = normalizePreferences(response);
      if (!next) {
        throw new Error('Data privacy preferences response was missing preferences');
      }
      setPrivacySettings(next);
      return next;
    } catch (error: unknown) {
      setLoadError(normalizeApiErrorMessage(error, 'Failed to load data privacy settings'));
      return null;
    }
  }, [normalizePreferences]);

  // Load preferences
  useEffect(() => {
    void loadPrivacySettings();
  }, [currentUser.id, loadPrivacySettings]);

  const confirmRequestAccepted = (response: unknown, fallbackMessage: string) => {
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error(fallbackMessage);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      setActionError(null);
      await Api.put('/settings/preferences/privacy', privacySettings);
      const persisted = await loadPrivacySettings();
      if (!persisted || !preferencesMatch(persisted, privacySettings)) {
        throw new Error('Data privacy preferences save was not confirmed by the server');
      }
      setSaveStatus('success');
      onUpdate?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: unknown) {
      setActionError(
        normalizeApiErrorMessage(
          error,
          t('settings.dataPrivacy.saveFailed', 'Failed to save privacy settings')
        )
      );
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      setActionError(null);
      const response = await Api.post('/settings/export-data', {});
      confirmRequestAccepted(response, 'Data export request was not accepted by the server');
      // Show success message
      alert(
        t(
          'settings.dataPrivacy.exportRequested',
          'Data export requested. You will receive an email when ready.'
        )
      );
    } catch (error: unknown) {
      setActionError(normalizeApiErrorMessage(error, 'Failed to request data export'));
      alert(
        t('settings.dataPrivacy.exportFailed', 'Failed to request data export. Please try again.')
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmEmail !== currentUser.email) {
      return;
    }

    try {
      setActionError(null);
      const response = await Api.post('/settings/request-deletion', {
        email: deleteConfirmEmail,
        reason: 'user_requested',
      });
      confirmRequestAccepted(response, 'Account deletion request was not accepted by the server');
      alert(
        t(
          'settings.dataPrivacy.deleteRequested',
          'Account deletion requested. You will receive a confirmation email.'
        )
      );
      setShowDeleteConfirm(false);
    } catch (error: unknown) {
      setActionError(normalizeApiErrorMessage(error, 'Failed to request account deletion'));
      alert(t('settings.dataPrivacy.deleteFailed', 'Failed to request account deletion.'));
    }
  };

  // Styling
  const cardClass =
    'bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg p-6';
  const sectionTitleClass =
    'text-sm font-bold text-navy-900 mb-4 uppercase tracking-wider flex items-center gap-2';
  const toggleClass = (enabled: boolean) =>
    `relative w-12 h-6 rounded-full transition-colors ${
      enabled ? 'bg-c-accent' : 'bg-c-surface-raised'
    }`;
  const toggleKnobClass = (enabled: boolean) =>
    `absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${enabled ? 'left-7' : 'left-1'}`;

  const ToggleSwitch = ({
    enabled,
    onChange,
    label,
    description,
  }: {
    enabled: boolean;
    onChange: (value: boolean) => void;
    label: string;
    description: string;
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-c-border-subtle dark:border-navy-700 last:border-0">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-navy-900">{label}</p>
        <p className="text-xs text-c-text-muted mt-0.5">{description}</p>
      </div>
      <button onClick={() => onChange(!enabled)} className={toggleClass(enabled)}>
        <span className={toggleKnobClass(enabled)} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-navy-900">
            {t('settings.dataPrivacy.title', 'Data & Privacy')}
          </h3>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.dataPrivacy.description',
              'Control how your data is used and manage your privacy settings'
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || !!loadError}
          className="flex items-center gap-2 px-4 py-2 bg-c-accent hover:bg-c-accent text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-c-accent"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
        </button>
      </div>

      {loadError && <DegradedState title="Data privacy unavailable" description={loadError} />}

      {actionError && <Banner variant="danger" title={actionError} />}

      {!loadError && (
        <>
          {/* Data Sharing */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>
              <Eye size={16} className="text-c-accent" />
              {t('settings.dataPrivacy.dataSharing', 'Data Sharing')}
            </h4>

            <div className="space-y-1">
              <ToggleSwitch
                enabled={privacySettings.shareAnalytics}
                onChange={(val) => setPrivacySettings((prev) => ({ ...prev, shareAnalytics: val }))}
                label={t('settings.dataPrivacy.shareAnalytics', 'Share analytics data')}
                description={t(
                  'settings.dataPrivacy.shareAnalyticsDesc',
                  'Help us improve by sharing anonymous usage analytics'
                )}
              />
              <ToggleSwitch
                enabled={privacySettings.shareUsageData}
                onChange={(val) => setPrivacySettings((prev) => ({ ...prev, shareUsageData: val }))}
                label={t('settings.dataPrivacy.shareUsageData', 'Share detailed usage data')}
                description={t(
                  'settings.dataPrivacy.shareUsageDataDesc',
                  'Include more detailed interaction data for product improvement'
                )}
              />
              <ToggleSwitch
                enabled={privacySettings.improveAI}
                onChange={(val) => setPrivacySettings((prev) => ({ ...prev, improveAI: val }))}
                label={t('settings.dataPrivacy.improveAI', 'Help improve AI')}
                description={t(
                  'settings.dataPrivacy.improveAIDesc',
                  'Allow your interactions to help train better AI models'
                )}
              />
            </div>
          </div>

          {/* Communication Preferences */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>
              <FileText size={16} className="text-c-accent" />
              {t('settings.dataPrivacy.communications', 'Communication Preferences')}
            </h4>

            <div className="space-y-1">
              <ToggleSwitch
                enabled={privacySettings.productUpdates}
                onChange={(val) => setPrivacySettings((prev) => ({ ...prev, productUpdates: val }))}
                label={t('settings.dataPrivacy.productUpdates', 'Product updates')}
                description={t(
                  'settings.dataPrivacy.productUpdatesDesc',
                  'Receive emails about new features and improvements'
                )}
              />
              <ToggleSwitch
                enabled={privacySettings.marketingEmails}
                onChange={(val) =>
                  setPrivacySettings((prev) => ({ ...prev, marketingEmails: val }))
                }
                label={t('settings.dataPrivacy.marketingEmails', 'Marketing emails')}
                description={t(
                  'settings.dataPrivacy.marketingEmailsDesc',
                  'Receive promotional offers and marketing communications'
                )}
              />
              <ToggleSwitch
                enabled={privacySettings.newsletterSubscribed}
                onChange={(val) =>
                  setPrivacySettings((prev) => ({ ...prev, newsletterSubscribed: val }))
                }
                label={t('settings.dataPrivacy.newsletter', 'Newsletter subscription')}
                description={t(
                  'settings.dataPrivacy.newsletterDesc',
                  'Weekly newsletter with tips and best practices'
                )}
              />
            </div>
          </div>

          {/* Data Retention */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>
              <Database size={16} className="text-c-accent" />
              {t('settings.dataPrivacy.dataRetention', 'Data Retention')}
            </h4>

            <p className="text-sm text-c-text-muted mb-4">
              {t('settings.dataPrivacy.dataRetentionDesc', 'Choose how long we keep your data')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { value: 'minimal', label: 'Minimal', desc: '30 days of history' },
                { value: 'standard', label: 'Standard', desc: '1 year of history' },
                { value: 'extended', label: 'Extended', desc: 'Full history kept' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setPrivacySettings((prev) => ({
                      ...prev,
                      dataRetentionPolicy: option.value as DataRetentionPolicy,
                    }))
                  }
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    privacySettings.dataRetentionPolicy === option.value
                      ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                      : 'border-c-border-subtle dark:border-navy-700 hover:border-c-border-subtle'
                  }`}
                >
                  <p
                    className={`font-medium ${
                      privacySettings.dataRetentionPolicy === option.value
                        ? 'text-c-accent'
                        : 'text-navy-900'
                    }`}
                  >
                    {option.label}
                  </p>
                  <p className="text-xs text-c-text-muted mt-0.5">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Security */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>
              <Shield size={16} className="text-c-accent" />
              {t('settings.dataPrivacy.security', 'Security')}
            </h4>

            <div className="space-y-1">
              <ToggleSwitch
                enabled={privacySettings.enablePiiRedaction}
                onChange={(val) =>
                  setPrivacySettings((prev) => ({ ...prev, enablePiiRedaction: val }))
                }
                label={t('settings.dataPrivacy.piiRedaction', 'Enable PII redaction')}
                description={t(
                  'settings.dataPrivacy.piiRedactionDesc',
                  'Automatically redact personally identifiable information in AI interactions'
                )}
              />
              <ToggleSwitch
                enabled={privacySettings.allowThirdPartyIntegrations}
                onChange={(val) =>
                  setPrivacySettings((prev) => ({ ...prev, allowThirdPartyIntegrations: val }))
                }
                label={t('settings.dataPrivacy.thirdParty', 'Allow third-party integrations')}
                description={t(
                  'settings.dataPrivacy.thirdPartyDesc',
                  'Enable connections to external services and apps'
                )}
              />
            </div>
          </div>

          {/* Data Export */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>
              <Download size={16} className="text-c-accent" />
              {t('settings.dataPrivacy.exportData', 'Export Your Data')}
            </h4>

            <p className="text-sm text-c-text-muted mb-4">
              {t(
                'settings.dataPrivacy.exportDataDesc',
                'Download a copy of all your data. This may take some time to prepare.'
              )}
            </p>

            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-c-surface-raised hover:bg-c-surface-raised dark:hover:bg-navy-800 text-c-text-secondary rounded-lg transition-colors disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {isExporting
                ? t('settings.dataPrivacy.preparing', 'Preparing...')
                : t('settings.dataPrivacy.requestExport', 'Request Data Export')}
            </button>

            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Info size={14} className="text-blue-500 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {t(
                    'settings.dataPrivacy.exportNote',
                    'You will receive an email with a download link within 24 hours. The link expires after 7 days.'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Delete Account */}
          <div className={`${cardClass} border-rose-200 dark:border-rose-500/20`}>
            <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-4 uppercase tracking-wider flex items-center gap-2">
              <Trash2 size={16} />
              {t('settings.dataPrivacy.dangerZone', 'Danger Zone')}
            </h4>

            <p className="text-sm text-c-text-muted mb-4">
              {t(
                'settings.dataPrivacy.deleteDesc',
                'Permanently delete your account and all associated data. This action cannot be undone.'
              )}
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
                {t('settings.dataPrivacy.requestDeletion', 'Request Account Deletion')}
              </button>
            ) : (
              <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg space-y-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} className="text-rose-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                      {t('settings.dataPrivacy.confirmDelete', 'Are you sure?')}
                    </p>
                    <p className="text-xs text-rose-500 mt-1">
                      {t(
                        'settings.dataPrivacy.confirmDeleteDesc',
                        'Type your email address to confirm account deletion.'
                      )}
                    </p>
                  </div>
                </div>

                <input
                  type="email"
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                  placeholder={currentUser.email}
                  className="w-full px-3 py-2 bg-c-surface border border-rose-200 dark:border-rose-500/30 rounded-md text-navy-900 focus:ring-2 focus:ring-rose-500/50 outline-none"
                />

                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmEmail !== currentUser.email}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={16} />
                    {t('settings.dataPrivacy.confirmDeleteButton', 'Delete My Account')}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmEmail('');
                    }}
                    className="px-4 py-2 bg-c-surface-raised text-c-text-secondary rounded-lg transition-colors hover:bg-c-surface-raised dark:hover:bg-navy-700"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Success Toast */}
          {saveStatus === 'success' && (
            <div className="fixed bottom-8 right-8 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
              <CheckCircle size={16} />
              {t('common.saved', 'Saved!')}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DataPrivacySettings;
