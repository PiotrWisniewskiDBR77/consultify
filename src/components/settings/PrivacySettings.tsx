/**
 * PrivacySettings — Visibility & Communication Preferences
 *
 * Consolidated screen covering:
 * 1. Online status & directory visibility
 * 2. Activity visibility (everyone / team / private)
 * 3. Profile visibility (public / organization / private)
 * 4. Communication & AI preferences
 *
 * Uses unified SettingsSection pattern for consistency.
 */

import { AtSign, Building2, Eye, Globe, Lock, Shield, UserCircle, Users } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';

import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
import { User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import { SettingsDivider, SettingsSection, SettingsToggle } from './shared';

interface PrivacySettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface PrivacyPreferences {
  showOnlineStatus: boolean;
  activityVisibility: 'all' | 'team' | 'private';
  profileVisibility: 'public' | 'organization' | 'private';
  allowMentions: boolean;
  showInDirectory: boolean;
  shareActivityWithAI: boolean;
}

interface PrivacyPreferencesResponse {
  preferences?: Partial<PrivacyPreferences>;
}

const DEFAULT_PREFERENCES: PrivacyPreferences = {
  showOnlineStatus: true,
  activityVisibility: 'team',
  profileVisibility: 'organization',
  allowMentions: true,
  showInDirectory: true,
  shareActivityWithAI: true,
};

const ACTIVITY_OPTIONS: Array<{
  value: PrivacyPreferences['activityVisibility'];
  labelKey: string;
  labelDefault: string;
  descKey: string;
  icon: React.ElementType;
  desc: string;
}> = [
  {
    value: 'all',
    labelKey: 'settings.privacy.visibility.all',
    labelDefault: 'Everyone',
    descKey: 'settings.privacy.visibility.allDesc',
    icon: Globe,
    desc: 'All users can see your activity',
  },
  {
    value: 'team',
    labelKey: 'settings.privacy.visibility.team',
    labelDefault: 'Team Only',
    descKey: 'settings.privacy.visibility.teamDesc',
    icon: Users,
    desc: 'Only your team members',
  },
  {
    value: 'private',
    labelKey: 'settings.privacy.visibility.private',
    labelDefault: 'Private',
    descKey: 'settings.privacy.visibility.privateDesc',
    icon: Lock,
    desc: 'Only you can see',
  },
];

const PROFILE_OPTIONS: Array<{
  value: PrivacyPreferences['profileVisibility'];
  labelKey: string;
  labelDefault: string;
  descKey: string;
  icon: React.ElementType;
  desc: string;
}> = [
  {
    value: 'public',
    labelKey: 'settings.privacy.profile.public',
    labelDefault: 'Public',
    descKey: 'settings.privacy.profile.publicDesc',
    icon: Globe,
    desc: 'Anyone can view your profile',
  },
  {
    value: 'organization',
    labelKey: 'settings.privacy.profile.organization',
    labelDefault: 'Organization',
    descKey: 'settings.privacy.profile.organizationDesc',
    icon: Building2,
    desc: 'Only organization members',
  },
  {
    value: 'private',
    labelKey: 'settings.privacy.profile.private',
    labelDefault: 'Private',
    descKey: 'settings.privacy.profile.privateDesc',
    icon: Lock,
    desc: 'Profile hidden from others',
  },
];

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<PrivacyPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [originalPreferences, setOriginalPreferences] =
    useState<PrivacyPreferences>(DEFAULT_PREFERENCES);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const normalizePreferences = useCallback(
    (data: PrivacyPreferencesResponse | null | undefined): PrivacyPreferences | null => {
      if (!data?.preferences) return null;
      return { ...DEFAULT_PREFERENCES, ...data.preferences };
    },
    []
  );

  const preferencesMatch = useCallback(
    (left: PrivacyPreferences, right: PrivacyPreferences) =>
      JSON.stringify(left) === JSON.stringify(right),
    []
  );

  useEffect(() => {
    setIsDirty(JSON.stringify(preferences) !== JSON.stringify(originalPreferences));
  }, [preferences, originalPreferences]);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const data = (await Api.getPrivacyPreferences()) as PrivacyPreferencesResponse;
      const merged = normalizePreferences(data);
      if (!merged) {
        throw new Error('Privacy preferences response was missing preferences');
      }
      setPreferences(merged);
      setOriginalPreferences(merged);
    } catch (error: unknown) {
      setLoadError(normalizeApiErrorMessage(error, 'Failed to load privacy preferences'));
    } finally {
      setLoading(false);
    }
  }, [normalizePreferences]);

  useEffect(() => {
    void loadPreferences();
  }, [currentUser.id, loadPreferences]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      setSaveError(null);
      await Api.savePrivacyPreferences(preferences);
      const data = (await Api.getPrivacyPreferences()) as PrivacyPreferencesResponse;
      const next = normalizePreferences(data);
      if (!next || !preferencesMatch(next, preferences)) {
        throw new Error('Privacy preferences save was not confirmed by the server');
      }
      setPreferences(next);
      setOriginalPreferences(next);
      toast.success(t('settings.privacy.saved', 'Privacy settings saved'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.privacy.error', 'Failed to save preferences')
      );
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [normalizePreferences, preferences, preferencesMatch, t]);

  const updatePreference = <K extends keyof PrivacyPreferences>(
    key: K,
    value: PrivacyPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const sectionLabel =
    'text-xs font-bold text-c-text-secondary uppercase tracking-wider flex items-center gap-2 mb-4';

  return (
    <SettingsSection
      icon={Shield}
      title={t('settings.privacy.title', 'Privacy & Visibility')}
      description={t(
        'settings.privacy.description',
        'Control who can see your information and activity'
      )}
      cardId="settings-privacy"
      isDirty={isDirty}
      onSave={handleSave}
      saving={saving}
      loading={loading}
    >
      <div className="space-y-6">
        {loadError && (
          <DegradedState title="Privacy preferences unavailable" description={loadError} />
        )}

        {saveError && <Banner variant="danger" title={saveError} />}

        {!loadError && (
          <>
            {/* ─── Online Status ─── */}
            <div>
              <h4 className={sectionLabel}>
                <Eye size={14} className="text-c-text-secondary" />
                {t('settings.privacy.statusTitle', 'Online Status')}
              </h4>
              <div className="space-y-3">
                <SettingsToggle
                  checked={preferences.showOnlineStatus}
                  onChange={(val) => updatePreference('showOnlineStatus', val)}
                  label={t('settings.privacy.showOnlineStatus', 'Show Online Status')}
                  description={t(
                    'settings.privacy.showOnlineStatusDescription',
                    'Let others see when you are online'
                  )}
                />
                <SettingsToggle
                  checked={preferences.showInDirectory}
                  onChange={(val) => updatePreference('showInDirectory', val)}
                  label={t('settings.privacy.showInDirectory', 'Show in Team Directory')}
                  description={t(
                    'settings.privacy.showInDirectoryDescription',
                    'Appear in the organization member directory'
                  )}
                />
              </div>
            </div>

            <SettingsDivider />

            {/* ─── Activity Visibility ─── */}
            <div>
              <h4 className={sectionLabel}>
                <Users size={14} className="text-c-text-secondary" />
                {t('settings.privacy.activityTitle', 'Activity Visibility')}
              </h4>
              <p className="text-xs text-c-text-muted mb-4">
                {t(
                  'settings.privacy.activityDescription',
                  'Choose who can see your recent activity and contributions'
                )}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {ACTIVITY_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = preferences.activityVisibility === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => updatePreference('activityVisibility', option.value)}
                      className={cn(
                        'p-4 rounded-lg border transition-all text-left',
                        isSelected
                          ? 'bg-c-surface-raised border-c-border-strong shadow-sm.06]'
                          : 'bg-c-surface-raised border-c-border-subtle hover:border-c-border-subtle dark:hover:border-white/20'
                      )}
                    >
                      <Icon
                        size={20}
                        className={isSelected ? 'text-[var(--c-info)]' : 'text-c-text-muted'}
                      />
                      <div
                        className={cn(
                          'mt-2 text-sm font-medium',
                          isSelected ? 'text-c-text' : 'text-c-text-secondary'
                        )}
                      >
                        {t(option.labelKey, option.labelDefault)}
                      </div>
                      <div className="text-[11px] text-c-text-muted mt-0.5">
                        {t(option.descKey, option.desc)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <SettingsDivider />

            {/* ─── Profile Visibility ─── */}
            <div>
              <h4 className={sectionLabel}>
                <UserCircle size={14} className="text-c-text-secondary" />
                {t('settings.privacy.profileTitle', 'Profile Visibility')}
              </h4>
              <p className="text-xs text-c-text-muted mb-4">
                {t(
                  'settings.privacy.profileDescription',
                  'Control who can view your profile information'
                )}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {PROFILE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = preferences.profileVisibility === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => updatePreference('profileVisibility', option.value)}
                      className={cn(
                        'p-4 rounded-lg border transition-all text-left',
                        isSelected
                          ? 'bg-c-surface-raised border-c-border-strong shadow-sm.06]'
                          : 'bg-c-surface-raised border-c-border-subtle hover:border-c-border-subtle dark:hover:border-white/20'
                      )}
                    >
                      <Icon
                        size={20}
                        className={isSelected ? 'text-[var(--c-info)]' : 'text-c-text-muted'}
                      />
                      <div
                        className={cn(
                          'mt-2 text-sm font-medium',
                          isSelected ? 'text-c-text' : 'text-c-text-secondary'
                        )}
                      >
                        {t(option.labelKey, option.labelDefault)}
                      </div>
                      <div className="text-[11px] text-c-text-muted mt-0.5">
                        {t(option.descKey, option.desc)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <SettingsDivider />

            {/* ─── Communication & AI ─── */}
            <div>
              <h4 className={sectionLabel}>
                <AtSign size={14} className="text-c-text-secondary" />
                {t('settings.privacy.communicationTitle', 'Communication & AI')}
              </h4>
              <div className="space-y-3">
                <SettingsToggle
                  checked={preferences.allowMentions}
                  onChange={(val) => updatePreference('allowMentions', val)}
                  label={t('settings.privacy.allowMentions', 'Allow @Mentions')}
                  description={t(
                    'settings.privacy.allowMentionsDescription',
                    'Let others mention you in comments and discussions'
                  )}
                />
                <SettingsToggle
                  checked={preferences.shareActivityWithAI}
                  onChange={(val) => updatePreference('shareActivityWithAI', val)}
                  label={t('settings.privacy.shareWithAI', 'Share Activity with AI')}
                  description={t(
                    'settings.privacy.shareWithAIDescription',
                    'Allow AI assistant to use your activity for personalized recommendations'
                  )}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </SettingsSection>
  );
};

export default PrivacySettings;
