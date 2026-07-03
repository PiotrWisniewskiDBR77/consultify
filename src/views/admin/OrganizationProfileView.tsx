/**
 * OrganizationProfileView - Organization Profile & Branding Management
 *
 * Features:
 * - Organization name, logo, description
 * - Branding (colors, favicon)
 * - Custom domain setup
 * - Regional settings (timezone, language, date format)
 * - Industry & company size
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  Clock,
  DollarSign,
  ExternalLink,
  Globe,
  Image,
  Languages,
  Link,
  Linkedin,
  Palette,
  RefreshCw,
  Save,
  Twitter,
  Upload,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { DegradedState, ReadOnlyState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { useAppStore } from '../../store/useAppStore';
import { CompanySize, OrganizationProfile } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';

// Industry options
const INDUSTRIES = [
  'Technology',
  'Finance & Banking',
  'Healthcare',
  'Manufacturing',
  'Retail',
  'Government',
  'Education',
  'Energy & Utilities',
  'Telecommunications',
  'Real Estate',
  'Consulting',
  'Legal',
  'Media & Entertainment',
  'Transportation & Logistics',
  'Other',
];

// Company size options
const COMPANY_SIZES: { value: CompanySize; label: string }[] = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1001-5000', label: '1001-5000 employees' },
  { value: '5000+', label: '5000+ employees' },
];

// Timezone options (simplified list)
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Warsaw',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Australia/Sydney',
];

// Language options
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'pl', name: 'Polski' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'ar', name: 'العربية' },
];

// Currency options
const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
];

interface OrganizationProfileViewProps {
  className?: string;
}

type DateFormat = NonNullable<OrganizationProfile['dateFormat']>;
type TimeFormat = NonNullable<OrganizationProfile['timeFormat']>;

const DEFAULT_PROFILE: Partial<OrganizationProfile> = {
  description: '',
  industry: 'Technology',
  companySize: '51-200',
  website: '',
  logoUrl: '',
  faviconUrl: '',
  brandColor: '#6366F1',
  accentColor: '#10B981',
  customDomain: '',
  customDomainVerified: false,
  defaultTimezone: 'Europe/Warsaw',
  defaultLanguage: 'en',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  currency: 'USD',
  linkedinUrl: '',
  twitterUrl: '',
};

const normalizeProfileResponse = (
  data: unknown,
  fallback: Partial<OrganizationProfile>
): Partial<OrganizationProfile> => {
  const profileData = data as { exists?: boolean; profile?: Partial<OrganizationProfile> };
  if (profileData.exists && profileData.profile) {
    return { ...fallback, ...profileData.profile };
  }
  return fallback;
};

const profilesMatch = (
  actual: Partial<OrganizationProfile>,
  expected: Partial<OrganizationProfile>
) =>
  Object.entries(expected).every(([key, value]) => {
    const actualValue = actual[key as keyof OrganizationProfile];
    return actualValue === value;
  });

export const OrganizationProfileView: React.FC<OrganizationProfileViewProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const { currentOrganization } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'branding' | 'regional' | 'domain'>(
    'profile'
  );
  const [verifyingDomain, setVerifyingDomain] = useState(false);

  const [profile, setProfile] = useState<Partial<OrganizationProfile>>(DEFAULT_PROFILE);

  const loadProfile = useCallback(
    async (showLoader = true, fallbackProfile = DEFAULT_PROFILE) => {
      if (showLoader) setLoading(true);
      try {
        setLoadError(null);
        const res = await fetch(`/api/organization-profiles/${currentOrganization?.id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        const snapshot = normalizeProfileResponse(data, fallbackProfile);
        setProfile(snapshot);
        return snapshot;
      } catch (error: unknown) {
        setLoadError(normalizeApiErrorMessage(error, 'Failed to load organization profile'));
        return null;
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [currentOrganization?.id]
  );

  useEffect(() => {
    if (currentOrganization?.id) {
      loadProfile();
    }
  }, [currentOrganization?.id, loadProfile]);

  const handleSave = async () => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    setSaveError(null);
    try {
      const expectedProfile = profile;
      const res = await fetch(`/api/organization-profiles/${currentOrganization.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        throw new Error('Save failed');
      }
      const persistedProfile = await loadProfile(false, expectedProfile);
      if (!persistedProfile || !profilesMatch(persistedProfile, expectedProfile)) {
        throw new Error('Organization profile save was not confirmed by the server');
      }
      toast.success(t('admin.org.profileSaved', 'Organization profile saved'));
      setHasChanges(false);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('admin.org.saveError', 'Failed to save profile')
      );
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = <K extends keyof OrganizationProfile>(
    key: K,
    value: OrganizationProfile[K]
  ) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    const formData = new FormData();
    formData.append('logo', file);

    try {
      const res = await fetch(`/api/organizations/${currentOrganization?.id}/logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        updateProfile('logoUrl', data.logoUrl);
        toast.success('Logo uploaded successfully');
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (error) {
      toast.error(normalizeApiErrorMessage(error, 'Failed to upload logo'));
    }
  };

  const handleVerifyDomain = async () => {
    if (!profile.customDomain) return;
    setVerifyingDomain(true);
    try {
      const res = await fetch(`/api/organizations/${currentOrganization?.id}/verify-domain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ domain: profile.customDomain }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.verified) {
          updateProfile('customDomainVerified', true);
          toast.success('Domain verified successfully!');
        } else {
          toast.error(data.message || 'Domain verification failed');
        }
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (error) {
      toast.error(normalizeApiErrorMessage(error, 'Failed to verify domain'));
    }
    setVerifyingDomain(false);
  };

  const tabs = [
    { id: 'profile' as const, label: t('admin.org.tabs.profile', 'Profile'), icon: Building2 },
    { id: 'branding' as const, label: t('admin.org.tabs.branding', 'Branding'), icon: Palette },
    { id: 'regional' as const, label: t('admin.org.tabs.regional', 'Regional'), icon: Globe },
    { id: 'domain' as const, label: t('admin.org.tabs.domain', 'Custom Domain'), icon: Link },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <InfoButton cardId="admin-org-profile" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-c-text flex items-center gap-2">
            <Building2 size={24} />
            {t('admin.org.profile.title', 'Organization Profile')}
          </h2>
          <p className="text-sm text-c-text-muted mt-1">
            {t(
              'admin.org.profile.desc',
              "Manage your organization's profile, branding, and settings"
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges || !!loadError}
          className={`
                        flex items-center gap-2 p-4 py-2.5 rounded-lg font-medium transition-all
                        ${
                          hasChanges
                            ? 'bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] shadow-lg shadow-primary-500/20'
                            : 'bg-slate-200 dark:bg-slate-700 text-c-text-muted cursor-not-allowed'
                        }
                    `}
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('common.saveChanges', 'Save Changes')}
        </button>
      </div>

      {loadError && (
        <DegradedState title="Organization profile unavailable" description={loadError} />
      )}

      {saveError && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400"
        >
          {saveError}
        </div>
      )}

      {/* Tabs */}
      {!loadError && (
        <div className="flex gap-2 border-b border-c-border-subtle">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                            flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2
                            ${
                              activeTab === tab.id
                                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                : 'border-transparent text-c-text-muted hover:text-c-text-secondary dark:hover:text-slate-200'
                            }
                        `}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {!loadError && (
        <AnimatePresence mode="wait">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Organization Name Card */}
              <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
                <div className="flex items-start gap-6">
                  {/* Logo Upload */}
                  <div className="flex-shrink-0">
                    <div
                      className="w-24 h-24 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-navy-700 dark:to-navy-800 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all overflow-hidden"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {profile.logoUrl ? (
                        <img
                          src={profile.logoUrl}
                          alt="Logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center">
                          <Upload className="w-6 h-6 text-c-text-muted mx-auto mb-1" />
                          <span className="text-xs text-c-text-muted">
                            Upload Logo
                          </span>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Basic Info */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-c-text-secondary mb-1">
                        {t('admin.org.name', 'Organization Name')}
                      </label>
                      <div className="text-lg font-semibold text-c-text">
                        {currentOrganization?.name || 'Organization'}
                      </div>
                      <p className="text-xs text-c-text-muted mt-1">
                        Contact support to change organization name
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-c-text-secondary mb-1">
                        {t('admin.org.logoUrl', 'Logo URL')}
                      </label>
                      <input
                        type="text"
                        value={profile.logoUrl || ''}
                        onChange={(e) => updateProfile('logoUrl', e.target.value)}
                        placeholder="/images/org-logos/plastmetcentrum.png"
                        className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <p className="text-xs text-c-text-muted mt-1">
                        {t(
                          'admin.org.logoUrlHint',
                          'Paste a full URL or a public path (e.g. /images/org-logos/...).'
                        )}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-c-text-secondary mb-1">
                        {t('admin.org.description', 'Description')}
                      </label>
                      <textarea
                        value={profile.description || ''}
                        onChange={(e) => updateProfile('description', e.target.value)}
                        rows={3}
                        placeholder="Brief description of your organization..."
                        className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Company Details */}
              <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
                <h3 className="text-lg font-medium text-c-text mb-4 flex items-center gap-2">
                  <Users size={20} />
                  {t('admin.org.companyDetails', 'Company Details')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      {t('admin.org.industry', 'Industry')}
                    </label>
                    <select
                      value={profile.industry || ''}
                      onChange={(e) => updateProfile('industry', e.target.value)}
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:ring-2 focus:ring-primary-500"
                    >
                      {INDUSTRIES.map((industry) => (
                        <option key={industry} value={industry}>
                          {industry}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      {t('admin.org.companySize', 'Company Size')}
                    </label>
                    <select
                      value={profile.companySize || ''}
                      onChange={(e) => updateProfile('companySize', e.target.value as CompanySize)}
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:ring-2 focus:ring-primary-500"
                    >
                      {COMPANY_SIZES.map((size) => (
                        <option key={size.value} value={size.value}>
                          {size.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      {t('admin.org.website', 'Website')}
                    </label>
                    <div className="relative">
                      <Globe
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted"
                        size={16}
                      />
                      <input
                        type="url"
                        value={profile.website || ''}
                        onChange={(e) => updateProfile('website', e.target.value)}
                        placeholder="https://example.com"
                        className="w-full pl-10 pr-4 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
                <h3 className="text-lg font-medium text-c-text mb-4">
                  {t('admin.org.socialLinks', 'Social Links')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      LinkedIn
                    </label>
                    <div className="relative">
                      <Linkedin
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted"
                        size={16}
                      />
                      <input
                        type="url"
                        value={profile.linkedinUrl || ''}
                        onChange={(e) => updateProfile('linkedinUrl', e.target.value)}
                        placeholder="https://linkedin.com/company/..."
                        className="w-full pl-10 pr-4 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      Twitter / X
                    </label>
                    <div className="relative">
                      <Twitter
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted"
                        size={16}
                      />
                      <input
                        type="url"
                        value={profile.twitterUrl || ''}
                        onChange={(e) => updateProfile('twitterUrl', e.target.value)}
                        placeholder="https://twitter.com/..."
                        className="w-full pl-10 pr-4 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <motion.div
              key="branding"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
                <h3 className="text-lg font-medium text-c-text mb-4 flex items-center gap-2">
                  <Palette size={20} />
                  {t('admin.org.brandColors', 'Brand Colors')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-2">
                      {t('admin.org.primaryColor', 'Primary Color')}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={profile.brandColor || '#6366F1'}
                        onChange={(e) => updateProfile('brandColor', e.target.value)}
                        className="w-12 h-12 rounded-lg border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={profile.brandColor || '#6366F1'}
                        onChange={(e) => updateProfile('brandColor', e.target.value)}
                        className="flex-1 px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-2">
                      {t('admin.org.accentColor', 'Accent Color')}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={profile.accentColor || '#10B981'}
                        onChange={(e) => updateProfile('accentColor', e.target.value)}
                        className="w-12 h-12 rounded-lg border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={profile.accentColor || '#10B981'}
                        onChange={(e) => updateProfile('accentColor', e.target.value)}
                        className="flex-1 px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="mt-6 p-4 bg-c-surface-raised rounded-lg">
                  <p className="text-sm text-c-text-muted mb-3">Preview</p>
                  <div className="flex items-center gap-3">
                    <button
                      style={{ backgroundColor: profile.brandColor }}
                      className="px-4 py-2 text-c-text rounded-lg font-medium"
                    >
                      Primary Button
                    </button>
                    <button
                      style={{ backgroundColor: profile.accentColor }}
                      className="px-4 py-2 text-c-text rounded-lg font-medium"
                    >
                      Accent Button
                    </button>
                    <span style={{ color: profile.brandColor }} className="font-semibold">
                      Primary Text
                    </span>
                  </div>
                </div>
              </div>

              {/* Favicon */}
              <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
                <h3 className="text-lg font-medium text-c-text mb-4 flex items-center gap-2">
                  <Image size={20} />
                  {t('admin.org.favicon', 'Favicon')}
                </h3>
                <ReadOnlyState
                  title="Favicon upload is read-only"
                  description="Favicon persistence is not connected yet, so the upload control is disabled."
                  className="mb-4"
                />
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-c-surface-raised flex items-center justify-center opacity-60 overflow-hidden">
                    {profile.faviconUrl ? (
                      <img src={profile.faviconUrl} alt="Favicon" className="w-8 h-8" />
                    ) : (
                      <Image className="w-6 h-6 text-c-text-muted" />
                    )}
                  </div>
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/*,.ico"
                    disabled
                    className="hidden"
                  />
                  <div>
                    <p className="text-sm text-c-text-secondary">
                      Upload a favicon (16x16 or 32x32 pixels)
                    </p>
                    <p className="text-xs text-c-text-muted">
                      PNG, ICO, or SVG recommended
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Regional Tab */}
          {activeTab === 'regional' && (
            <motion.div
              key="regional"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
                <h3 className="text-lg font-medium text-c-text mb-4 flex items-center gap-2">
                  <Globe size={20} />
                  {t('admin.org.regionalSettings', 'Regional Settings')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      <Clock size={14} className="inline mr-1" />
                      {t('admin.org.timezone', 'Default Timezone')}
                    </label>
                    <select
                      value={profile.defaultTimezone || 'UTC'}
                      onChange={(e) => updateProfile('defaultTimezone', e.target.value)}
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:ring-2 focus:ring-primary-500"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      <Languages size={14} className="inline mr-1" />
                      {t('admin.org.language', 'Default Language')}
                    </label>
                    <select
                      value={profile.defaultLanguage || 'en'}
                      onChange={(e) => updateProfile('defaultLanguage', e.target.value)}
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:ring-2 focus:ring-primary-500"
                    >
                      {LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      <Calendar size={14} className="inline mr-1" />
                      {t('admin.org.dateFormat', 'Date Format')}
                    </label>
                    <select
                      value={profile.dateFormat || 'DD/MM/YYYY'}
                      onChange={(e) => updateProfile('dateFormat', e.target.value as DateFormat)}
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2025)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      <Clock size={14} className="inline mr-1" />
                      {t('admin.org.timeFormat', 'Time Format')}
                    </label>
                    <select
                      value={profile.timeFormat || '24h'}
                      onChange={(e) => updateProfile('timeFormat', e.target.value as TimeFormat)}
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="24h">24-hour (14:30)</option>
                      <option value="12h">12-hour (2:30 PM)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-c-text-secondary mb-1">
                      <DollarSign size={14} className="inline mr-1" />
                      {t('admin.org.currency', 'Default Currency')}
                    </label>
                    <select
                      value={profile.currency || 'USD'}
                      onChange={(e) => updateProfile('currency', e.target.value)}
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:ring-2 focus:ring-primary-500"
                    >
                      {CURRENCIES.map((curr) => (
                        <option key={curr.code} value={curr.code}>
                          {curr.symbol} {curr.code} - {curr.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Domain Tab */}
          {activeTab === 'domain' && (
            <motion.div
              key="domain"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="p-6 bg-c-surface rounded-xl border border-c-border-subtle">
                <h3 className="text-lg font-medium text-c-text mb-4 flex items-center gap-2">
                  <Link size={20} />
                  {t('admin.org.customDomain', 'Custom Domain')}
                </h3>
                <p className="text-sm text-c-text-muted mb-4">
                  Use your own domain for a branded experience (e.g., pmo.yourcompany.com)
                </p>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={profile.customDomain || ''}
                    onChange={(e) => updateProfile('customDomain', e.target.value)}
                    placeholder="pmo.yourcompany.com"
                    className="flex-1 px-4 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={handleVerifyDomain}
                    disabled={verifyingDomain || !profile.customDomain}
                    className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifyingDomain ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : profile.customDomainVerified ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    {profile.customDomainVerified ? 'Verified' : 'Verify'}
                  </button>
                </div>

                {profile.customDomain && !profile.customDomainVerified && (
                  <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                      <AlertCircle size={16} />
                      DNS Configuration Required
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                      Add the following CNAME record to your DNS settings:
                    </p>
                    <div className="bg-c-surface p-3 rounded font-mono text-sm">
                      <div className="flex justify-between">
                        <span className="text-c-text-muted">Type:</span>
                        <span className="text-c-text">CNAME</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-c-text-muted">Name:</span>
                        <span className="text-c-text">
                          {profile.customDomain?.split('.')[0]}
                        </span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-c-text-muted">Value:</span>
                        <span className="text-c-text">
                          custom.consultify.app
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {profile.customDomainVerified && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">
                        Domain Verified
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Your custom domain is active and SSL certificate is valid.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default OrganizationProfileView;
