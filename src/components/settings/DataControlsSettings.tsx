/**
 * DataControlsSettings — Consolidated GDPR & Data Management
 *
 * Single professional screen covering:
 * 1. GDPR compliance banner
 * 2. Consent management (toggles)
 * 3. Data retention period
 * 4. Data portability (export)
 * 5. Account deletion (danger zone)
 * 6. Related legal documents
 *
 * Uses unified SettingsSection pattern for consistency with the rest of Settings.
 */

import {
  AlertTriangle,
  BarChart3,
  Brain,
  Clock,
  Database,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Globe,
  Info,
  Loader2,
  Lock,
  Mail,
  Share2,
  Shield,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Banner } from '@/components/shared/Banner';

import { useDemo } from '../../hooks/useDemo';
import { cn } from '../../lib/utils';
import { ROUTES } from '../../routes/routeConfig';
import { Api } from '../../services/api';
import { User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import { SettingsDivider, SettingsSection, SettingsToggle } from './shared';

interface DataControlsSettingsProps {
  currentUser: User;
  onUpdateUser?: (updates: Partial<User>) => void;
  className?: string;
}

interface ConsentSettings {
  analytics: boolean;
  personalization: boolean;
  marketing: boolean;
  thirdPartySharing: boolean;
  aiTraining: boolean;
}

interface DataRetention {
  period: '30' | '90' | '180' | '365' | 'forever';
  autoDelete: boolean;
}

const DEFAULT_CONSENTS: ConsentSettings = {
  analytics: true,
  personalization: true,
  marketing: false,
  thirdPartySharing: false,
  aiTraining: true,
};

const DEFAULT_RETENTION: DataRetention = {
  period: '365',
  autoDelete: false,
};

const EXPORT_STATUS_POLL_INTERVAL_MS = 2_000;
const EXPORT_STATUS_MAX_ATTEMPTS = 30;

const waitForExportPoll = () =>
  new Promise<void>((resolve) => window.setTimeout(resolve, EXPORT_STATUS_POLL_INTERVAL_MS));

const CONSENT_ITEMS: Array<{
  key: keyof ConsentSettings;
  icon: React.ElementType;
  titleKey: string;
  titleDefault: string;
  descKey: string;
  descDefault: string;
}> = [
  {
    key: 'analytics',
    icon: BarChart3,
    titleKey: 'settings.data.analytics',
    titleDefault: 'Usage Analytics',
    descKey: 'settings.data.analyticsDesc',
    descDefault: 'Help improve the product by sharing anonymous usage data',
  },
  {
    key: 'personalization',
    icon: Brain,
    titleKey: 'settings.data.personalization',
    titleDefault: 'Personalization',
    descKey: 'settings.data.personalizationDesc',
    descDefault: 'Use your data to personalize your experience and recommendations',
  },
  {
    key: 'marketing',
    icon: Mail,
    titleKey: 'settings.data.marketing',
    titleDefault: 'Marketing Communications',
    descKey: 'settings.data.marketingDesc',
    descDefault: 'Receive product updates, tips, and promotional offers',
  },
  {
    key: 'thirdPartySharing',
    icon: Share2,
    titleKey: 'settings.data.thirdParty',
    titleDefault: 'Third-Party Data Sharing',
    descKey: 'settings.data.thirdPartyDesc',
    descDefault: 'Share data with trusted partners for enhanced features',
  },
  {
    key: 'aiTraining',
    icon: Brain,
    titleKey: 'settings.data.aiTraining',
    titleDefault: 'AI Model Training',
    descKey: 'settings.data.aiTrainingDesc',
    descDefault: 'Allow your anonymized data to improve our AI models',
  },
];

const RETENTION_OPTIONS = [
  { value: '30', labelKey: 'settings.data.retention30', labelDefault: '30 days' },
  { value: '90', labelKey: 'settings.data.retention90', labelDefault: '90 days' },
  { value: '180', labelKey: 'settings.data.retention180', labelDefault: '6 months' },
  { value: '365', labelKey: 'settings.data.retention365', labelDefault: '1 year' },
  { value: 'forever', labelKey: 'settings.data.retentionForever', labelDefault: 'Forever' },
];

const LEGAL_DOCS = [
  {
    to: ROUTES.LEGAL.PRIVACY,
    icon: Shield,
    titleKey: 'settings.data.privacyPolicy',
    titleDefault: 'Privacy Policy',
    descKey: 'settings.data.privacyPolicyDesc',
    desc: 'How we handle your data',
  },
  {
    to: ROUTES.LEGAL.TERMS,
    icon: FileText,
    titleKey: 'settings.data.terms',
    titleDefault: 'Terms of Service',
    descKey: 'settings.data.termsDesc',
    desc: 'Core product and account terms',
  },
  {
    to: ROUTES.LEGAL.SUBSCRIPTION,
    icon: Globe,
    titleKey: 'settings.data.subscription',
    titleDefault: 'Subscription & Pricing',
    descKey: 'settings.data.subscriptionDesc',
    desc: 'Plans, billing, seats, and AI budget',
  },
  {
    to: ROUTES.LEGAL.DPA,
    icon: Database,
    titleKey: 'settings.data.dpa',
    titleDefault: 'Data Processing',
    descKey: 'settings.data.dpaDesc',
    desc: 'GDPR DPA terms',
  },
  {
    to: ROUTES.LEGAL.SLA,
    icon: Clock,
    titleKey: 'settings.data.sla',
    titleDefault: 'Service Levels',
    descKey: 'settings.data.slaDesc',
    desc: 'Support response and service commitments',
  },
  {
    to: ROUTES.LEGAL.SECURITY,
    icon: Lock,
    titleKey: 'settings.data.security',
    titleDefault: 'Security Overview',
    descKey: 'settings.data.securityDesc',
    desc: 'Security controls and review information',
  },
  {
    to: ROUTES.LEGAL.SUBPROCESSORS,
    icon: Share2,
    titleKey: 'settings.data.subprocessors',
    titleDefault: 'Sub-processors',
    descKey: 'settings.data.subprocessorsDesc',
    desc: 'Third-party services and data flow',
  },
  {
    to: ROUTES.LEGAL.CENTER,
    icon: ExternalLink,
    titleKey: 'settings.data.legalCenter',
    titleDefault: 'Legal Center',
    descKey: 'settings.data.legalCenterDesc',
    desc: 'All legal and compliance documents',
  },
];

export const DataControlsSettings: React.FC<DataControlsSettingsProps> = ({
  currentUser,
  className = '',
}) => {
  const { t } = useTranslation();
  const { isDemoMode, demoOrganization, isDemoLoading, toggleDemoMode } = useDemo();
  const [consents, setConsents] = useState<ConsentSettings>(DEFAULT_CONSENTS);
  const [retention, setRetention] = useState<DataRetention>(DEFAULT_RETENTION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [requestingDeletion, setRequestingDeletion] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const exportInFlightRef = useRef(false);

  const [originalConsents, setOriginalConsents] = useState<ConsentSettings>(DEFAULT_CONSENTS);
  const [originalRetention, setOriginalRetention] = useState<DataRetention>(DEFAULT_RETENTION);
  const deleteConfirmationPhrase = t('settings.data.deleteConfirmPhrase', 'delete my data');

  useEffect(() => {
    const dirty =
      JSON.stringify(consents) !== JSON.stringify(originalConsents) ||
      JSON.stringify(retention) !== JSON.stringify(originalRetention);
    setIsDirty(dirty);
  }, [consents, retention, originalConsents, originalRetention]);

  const settingsMatch = useCallback(
    (
      nextConsents: ConsentSettings,
      expectedConsents: ConsentSettings,
      nextRetention: DataRetention,
      expectedRetention: DataRetention
    ) =>
      JSON.stringify(nextConsents) === JSON.stringify(expectedConsents) &&
      JSON.stringify(nextRetention) === JSON.stringify(expectedRetention),
    []
  );

  const loadSettings = useCallback(async (): Promise<{
    consents: ConsentSettings;
    retention: DataRetention;
  } | null> => {
    setLoading(true);
    try {
      setLoadError(null);
      const [consentsRes, retentionRes] = await Promise.all([
        Api.getGdprConsents(),
        Api.getGdprRetention(),
      ]);
      if (!consentsRes?.consents || !retentionRes?.retention) {
        throw new Error('Data controls response was missing consents or retention');
      }
      const mergedConsents = { ...DEFAULT_CONSENTS, ...consentsRes.consents };
      const mergedRetention = retentionRes.retention;
      setConsents(mergedConsents);
      setOriginalConsents(mergedConsents);
      setRetention(mergedRetention);
      setOriginalRetention(mergedRetention);
      return { consents: mergedConsents, retention: mergedRetention };
    } catch (error: unknown) {
      setLoadError(normalizeApiErrorMessage(error, 'Failed to load data controls'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [currentUser.id, loadSettings]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      setActionError(null);
      await Promise.all([Api.saveGdprConsents(consents), Api.saveGdprRetention(retention)]);
      const [consentsRes, retentionRes] = await Promise.all([
        Api.getGdprConsents(),
        Api.getGdprRetention(),
      ]);
      if (!consentsRes?.consents || !retentionRes?.retention) {
        throw new Error('Data controls save was not confirmed by the server');
      }
      const nextConsents = { ...DEFAULT_CONSENTS, ...consentsRes.consents };
      const nextRetention = retentionRes.retention;
      if (!settingsMatch(nextConsents, consents, nextRetention, retention)) {
        throw new Error('Data controls save was not confirmed by the server');
      }
      setConsents(nextConsents);
      setRetention(nextRetention);
      setOriginalConsents(nextConsents);
      setOriginalRetention(nextRetention);
      toast.success(t('settings.data.saved', 'Data control preferences saved'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.data.saveError', 'Failed to save preferences')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [consents, retention, settingsMatch, t]);

  const handleExportData = async () => {
    if (exportInFlightRef.current) return;
    exportInFlightRef.current = true;
    setExporting(true);
    try {
      setActionError(null);
      const response = await Api.requestGdprExport();
      const requestId = response?.request?.id;
      if (!requestId || response?.success === false) {
        throw new Error('Data export request was not confirmed by the server');
      }

      let ready = response.request.status === 'ready';
      for (let attempt = 0; !ready && attempt < EXPORT_STATUS_MAX_ATTEMPTS; attempt += 1) {
        await waitForExportPoll();
        const statusResponse = await Api.getGdprExportStatus();
        const statusRequest = statusResponse?.request;
        if (!statusRequest || statusRequest.id !== requestId) {
          throw new Error('Data export status did not match the requested export');
        }
        if (statusRequest.status === 'failed') {
          throw new Error('Data export processing failed');
        }
        ready = statusRequest.status === 'ready';
      }
      if (!ready) throw new Error('Data export is still processing. Please try again later.');

      const data = await Api.get(`/api/gdpr/download-export/${encodeURIComponent(requestId)}`);
      if (!data) throw new Error('Data export response was empty');

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      try {
        anchor.href = url;
        anchor.download = `consultify-data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        URL.revokeObjectURL(url);
      }
      toast.success(t('settings.data.exportSuccess', 'Data exported successfully'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.data.exportError', 'Failed to request data export')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      exportInFlightRef.current = false;
      setExporting(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (deleteConfirmText.toLowerCase() !== deleteConfirmationPhrase.toLowerCase()) {
      toast.error(
        t('settings.data.deleteConfirmError', 'Please type "{{phrase}}" to confirm', {
          phrase: deleteConfirmationPhrase,
        })
      );
      return;
    }
    if (!deletePassword.trim()) {
      toast.error(
        t('settings.data.deletePasswordRequired', 'Please enter your password to confirm deletion')
      );
      return;
    }
    setRequestingDeletion(true);
    try {
      setActionError(null);
      const response = await Api.requestGdprDeletion(deletePassword);
      if (response?.request) {
        setShowDeleteConfirm(false);
        setDeleteConfirmText('');
        setDeletePassword('');
        toast.success(
          t(
            'settings.data.deletionRequested',
            'Account deletion scheduled. You will receive a confirmation email.'
          )
        );
      } else {
        throw new Error('Account deletion request was not confirmed by the server');
      }
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.data.deletionError', 'Failed to request account deletion')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setRequestingDeletion(false);
    }
  };

  const sectionLabel =
    'text-xs font-bold text-c-text-secondary uppercase tracking-wider flex items-center gap-2 mb-4';
  const cardClass = 'bg-c-surface-raised border border-c-border-subtle rounded-lg p-5';

  return (
    <SettingsSection
      icon={Database}
      title={t('settings.data.title', 'Data Controls')}
      description={t(
        'settings.data.description',
        'Manage how your data is collected, used, and stored'
      )}
      cardId="settings-data-controls"
      isDirty={isDirty}
      onSave={handleSave}
      saving={saving}
      loading={loading}
      className={className}
    >
      <div className="space-y-6">
        {loadError && <DegradedState title="Data controls unavailable" description={loadError} />}

        {actionError && <Banner variant="danger" title={actionError} />}

        {!loadError && (
          <>
            {/* GDPR Compliance Banner */}
            <div className="p-4 bg-c-accent-soft border border-c-accent rounded-lg flex items-start gap-3">
              <Shield size={18} className="text-c-accent flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-c-accent">
                  {t('settings.data.gdprTitle', 'GDPR Compliant')}
                </p>
                <p className="text-xs text-c-text-secondary mt-0.5">
                  {t(
                    'settings.data.gdprDesc',
                    'We comply with GDPR regulations. You have full control over your personal data, including the right to access, export, and delete it.'
                  )}
                </p>
              </div>
            </div>

            {/* ─── Consent Management ─── */}
            <div>
              <h4 className={sectionLabel}>
                <Shield size={14} className="text-c-accent" />
                {t('settings.data.consentsTitle', 'Consent Management')}
              </h4>
              <p className="text-xs text-c-text-muted mb-4">
                {t('settings.data.consentsDesc', 'Choose how we can use your data')}
              </p>
              <div className="space-y-3">
                {CONSENT_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.key} className="flex items-start gap-3">
                      <div
                        className={cn(
                          'p-1.5 rounded-md flex-shrink-0 mt-0.5',
                          consents[item.key]
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-c-surface-raised text-c-text-muted'
                        )}
                      >
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <SettingsToggle
                          checked={consents[item.key]}
                          onChange={(val) => setConsents((prev) => ({ ...prev, [item.key]: val }))}
                          label={t(item.titleKey, item.titleDefault)}
                          description={t(item.descKey, item.descDefault)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <SettingsDivider />

            {/* ─── Data Retention ─── */}
            <div>
              <h4 className={sectionLabel}>
                <Clock size={14} className="text-c-accent" />
                {t('settings.data.retentionTitle', 'Data Retention')}
              </h4>
              <p className="text-xs text-c-text-muted mb-4">
                {t('settings.data.retentionDesc', 'Choose how long we keep your data')}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {RETENTION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      setRetention((prev) => ({
                        ...prev,
                        period: option.value as DataRetention['period'],
                      }))
                    }
                    className={cn(
                      'px-4 py-2.5 rounded-lg text-sm font-medium transition-all border',
                      retention.period === option.value
                        ? 'bg-navy-900 text-white border-navy-900 shadow-sm dark:border-c-accent'
                        : 'bg-c-surface-raised text-c-text-secondary border-c-border-subtle hover:border-c-border-subtle dark:hover:border-white/20'
                    )}
                  >
                    {t(option.labelKey, option.labelDefault)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-c-text-muted mt-3 flex items-center gap-1.5">
                <Info size={12} />
                {t(
                  'settings.data.retentionNote',
                  'After this period, inactive data will be automatically anonymized or deleted.'
                )}
              </p>
            </div>

            <SettingsDivider />

            {/* ─── Data Portability ─── */}
            <div>
              <h4 className={sectionLabel}>
                <Download size={14} className="text-c-accent" />
                {t('settings.data.portabilityTitle', 'Data Portability')}
              </h4>
              <div className={cardClass}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {t('settings.data.exportData', 'Export Your Data')}
                    </p>
                    <p className="text-xs text-c-text-secondary mt-1">
                      {t(
                        'settings.data.exportDataDesc',
                        'Download a copy of all your personal data including profile, settings, activity history, and documents. Processing typically takes 24-48 hours.'
                      )}
                    </p>
                  </div>
                  <button
                    onClick={handleExportData}
                    disabled={exporting}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0',
                      'bg-c-accent-soft text-c-accent border border-c-accent',
                      'hover:bg-c-accent-soft hover:border-c-accent',
                      'disabled:opacity-50'
                    )}
                  >
                    {exporting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    {exporting
                      ? t('settings.data.exporting', 'Exporting...')
                      : t('settings.data.requestExport', 'Request Export')}
                  </button>
                </div>
              </div>
            </div>

            <SettingsDivider />

            {/* ─── Danger Zone: Delete Account ─── */}
            <div>
              <h4 className="text-xs font-bold text-danger-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                <AlertTriangle size={14} />
                {t('settings.data.dangerZone', 'Danger Zone')}
              </h4>
              <div className="bg-danger-500/5 border border-danger-500/20 rounded-lg p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-danger-300">
                      {t('settings.data.deleteAccount', 'Delete Account & Data')}
                    </p>
                    <p className="text-xs text-c-text-secondary mt-1">
                      {t(
                        'settings.data.deleteAccountDesc',
                        'Permanently delete your account and all associated data. This action cannot be undone. A 30-day grace period applies before final deletion.'
                      )}
                    </p>
                  </div>
                  {!showDeleteConfirm && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 bg-danger-500/10 text-danger-400 border border-danger-500/30 hover:bg-danger-500/20 hover:border-danger-500/50"
                    >
                      <Trash2 size={14} />
                      {t('settings.data.requestDeletion', 'Delete Account')}
                    </button>
                  )}
                </div>

                {showDeleteConfirm && (
                  <div className="mt-4 p-4 bg-danger-50/50 border border-danger-200 dark:border-danger-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-danger-400 mb-3">
                      <AlertTriangle size={16} />
                      <span className="text-sm font-medium">
                        {t('settings.data.deleteConfirmTitle', 'Are you absolutely sure?')}
                      </span>
                    </div>
                    <p className="text-xs text-c-text-secondary mb-3">
                      {t(
                        'settings.data.deleteConfirmDesc',
                        'This action cannot be undone. All your data, including projects, settings, and history will be permanently deleted after a 30-day grace period.'
                      )}
                    </p>
                    <label className="text-xs font-medium text-c-text-secondary mb-1.5 block">
                      {t('settings.data.deleteConfirmType', 'Type "{{phrase}}" to confirm:', {
                        phrase: deleteConfirmationPhrase,
                      })}
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full px-3 py-2 bg-c-surface border border-danger-300 dark:border-danger-500/30 rounded-lg text-c-text text-sm focus:ring-2 focus:ring-danger-500/50 outline-none transition-all mb-3"
                      placeholder={deleteConfirmationPhrase}
                    />
                    <label className="text-xs font-medium text-c-text-secondary mb-1.5 block">
                      {t('settings.data.deletePasswordLabel', 'Enter your password to confirm:')}
                    </label>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full px-3 py-2 bg-c-surface border border-danger-300 dark:border-danger-500/30 rounded-lg text-c-text text-sm focus:ring-2 focus:ring-danger-500/50 outline-none transition-all mb-3"
                      placeholder={t(
                        'settings.data.deletePasswordPlaceholder',
                        'Your account password'
                      )}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteRequest}
                        disabled={
                          requestingDeletion ||
                          !deletePassword.trim() ||
                          deleteConfirmText.toLowerCase() !== deleteConfirmationPhrase.toLowerCase()
                        }
                        className="flex items-center gap-2 px-4 py-2 bg-danger-600 hover:bg-danger-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {requestingDeletion ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        {t('settings.data.confirmDelete', 'Delete Everything')}
                      </button>
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText('');
                          setDeletePassword('');
                        }}
                        className="px-4 py-2 bg-c-surface-raised border border-white/10 text-c-text-secondary rounded-lg text-sm font-medium hover:bg-c-surface-raised transition-colors"
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <SettingsDivider />

            {/* ─── Sample / Demo Data ─── */}
            <div>
              <h4 className={sectionLabel}>
                <FlaskConical size={14} className="text-c-accent" />
                {t('settings.data.sampleWorkspace', 'Sample Workspace')}
              </h4>
              <div className={cardClass}>
                <SettingsToggle
                  checked={isDemoMode}
                  disabled={isDemoLoading}
                  onChange={() => {
                    void toggleDemoMode(undefined, { source: 'settings_data_controls' });
                  }}
                  label={t('settings.data.demoToggle', 'Explore the sample workspace')}
                  description={
                    isDemoMode
                      ? t(
                          'settings.data.demoToggleOnDesc',
                          'Sample data is active — you are exploring a read-only demo organization. Toggle off to return to your own workspace.'
                        )
                      : t(
                          'settings.data.demoToggleOffDesc',
                          'Load a read-only sample organization to explore the product without touching your own data.'
                        )
                  }
                />
                {isDemoMode && demoOrganization && (
                  <p className="mt-3 text-[11px] text-amber-300/90 flex items-center gap-1.5">
                    <Info size={11} />
                    {t('settings.data.demoActiveOrg', 'Active sample: {{name}} (read only)', {
                      name: demoOrganization.name,
                    })}
                  </p>
                )}
              </div>
            </div>

            <SettingsDivider />

            {/* ─── Legal Documents ─── */}
            <div>
              <h4 className={sectionLabel}>
                <FileText size={14} className="text-c-accent" />
                {t('settings.data.relatedDocs', 'Legal Documents')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                {LEGAL_DOCS.map((doc) => {
                  const Icon = doc.icon;
                  return (
                    <Link
                      key={doc.to}
                      to={doc.to}
                      className="flex items-start gap-3 p-3 bg-c-surface-raised border border-c-border-subtle rounded-lg hover:border-c-border-subtle dark:hover:border-c-accent hover:bg-c-surface-raised dark:hover:bg-c-accent-soft transition-all group"
                    >
                      <Icon
                        size={14}
                        className="text-c-text-muted group-hover:text-c-accent mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-c-text-secondary group-hover:text-c-accent">
                            {t(doc.titleKey, doc.titleDefault)}
                          </span>
                          <ExternalLink size={10} className="text-c-text-secondary" />
                        </div>
                        <span className="text-[11px] text-c-text-muted">
                          {t(doc.descKey, doc.desc)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </SettingsSection>
  );
};

export default DataControlsSettings;
