import {
  AtSign,
  CheckCircle,
  Eye,
  EyeOff,
  Globe,
  Info,
  Loader2,
  Lock,
  MessageSquare,
  Save,
  Shield,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { ProfileVisibility, User } from '../../types';

interface ProfileVisibilitySettingsProps {
  currentUser: User;
  onUpdate?: () => void;
}

type VisibilityLevel = 'public' | 'organization' | 'team' | 'private';
type AllowFrom = 'all' | 'team' | 'none';

const VISIBILITY_OPTIONS: {
  value: VisibilityLevel;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'public',
    label: 'Public',
    description: 'Anyone can view your profile',
    icon: <Globe size={18} />,
  },
  {
    value: 'organization',
    label: 'Organization',
    description: 'Only members of your organization',
    icon: <Users size={18} />,
  },
  {
    value: 'team',
    label: 'Team Only',
    description: 'Only your direct team members',
    icon: <Users size={18} />,
  },
  {
    value: 'private',
    label: 'Private',
    description: 'Only you can see your full profile',
    icon: <Lock size={18} />,
  },
];

const ALLOW_FROM_OPTIONS: { value: AllowFrom; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'team', label: 'Team members only' },
  { value: 'none', label: 'Nobody' },
];

export const ProfileVisibilitySettings: React.FC<ProfileVisibilitySettingsProps> = ({
  currentUser,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [visibility, setVisibility] = useState<ProfileVisibility>({
    profile: 'organization',
    showEmail: false,
    showPhone: false,
    showActivityStatus: true,
    showLastSeen: true,
    showInDirectory: true,
    allowMentionsFrom: 'all',
    allowDirectMessagesFrom: 'all',
  });

  // Load data on mount
  useEffect(() => {
    loadVisibility();
  }, [currentUser.id]);

  const loadVisibility = async () => {
    try {
      const response = await Api.get('/profile/visibility');
      if (response.visibility) {
        setVisibility(response.visibility);
      }
    } catch (error) {
      console.error('Failed to load visibility settings:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Api.put('/profile/visibility', visibility);
      setSaveStatus('success');
      onUpdate?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save visibility settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Styling classes
  const cardClass =
    'bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg p-6';
  const sectionTitleClass =
    'text-sm font-bold text-navy-900 mb-4 uppercase tracking-wider flex items-center gap-2';
  const toggleClass = (enabled: boolean) =>
    `relative w-12 h-6 rounded-full transition-colors ${
      enabled ? 'bg-navy-900' : 'bg-c-surface-raised'
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
      <div className="flex-1">
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
            {t('settings.profile.visibility.title', 'Privacy & Visibility')}
          </h3>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.profile.visibility.description',
              'Control who can see your profile and contact you'
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-c-accent"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
        </button>
      </div>

      {/* Profile Visibility Level */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <Eye size={16} className="text-c-accent" />
          {t('settings.profile.visibility.profileVisibility', 'Profile Visibility')}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {VISIBILITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setVisibility((prev: any) => ({ ...prev, profile: option.value }))}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                visibility.profile === option.value
                  ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                  : 'border-c-border-subtle dark:border-navy-700 hover:border-c-border-subtle dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    visibility.profile === option.value
                      ? 'bg-c-accent-soft dark:bg-c-accent-soft text-c-accent'
                      : 'bg-c-surface-raised text-c-text-muted'
                  }`}
                >
                  {option.icon}
                </div>
                <div>
                  <p
                    className={`font-medium ${
                      visibility.profile === option.value
                        ? 'text-c-accent'
                        : 'text-navy-900'
                    }`}
                  >
                    {option.label}
                  </p>
                  <p className="text-xs text-c-text-muted mt-0.5">
                    {option.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Contact Information Visibility */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <Shield size={16} className="text-c-accent" />
          {t('settings.profile.visibility.contactVisibility', 'Contact Information')}
        </h4>

        <div className="space-y-1">
          <ToggleSwitch
            enabled={visibility.showEmail}
            onChange={(val) => setVisibility((prev: any) => ({ ...prev, showEmail: val }))}
            label={t('settings.profile.visibility.showEmail', 'Show email address')}
            description={t(
              'settings.profile.visibility.showEmailDesc',
              'Allow others to see your email on your profile'
            )}
          />
          <ToggleSwitch
            enabled={visibility.showPhone}
            onChange={(val) => setVisibility((prev: any) => ({ ...prev, showPhone: val }))}
            label={t('settings.profile.visibility.showPhone', 'Show phone number')}
            description={t(
              'settings.profile.visibility.showPhoneDesc',
              'Allow others to see your phone number'
            )}
          />
          <ToggleSwitch
            enabled={visibility.showInDirectory}
            onChange={(val) => setVisibility((prev: any) => ({ ...prev, showInDirectory: val }))}
            label={t('settings.profile.visibility.showInDirectory', 'Show in team directory')}
            description={t(
              'settings.profile.visibility.showInDirectoryDesc',
              'Appear in the organization team directory'
            )}
          />
        </div>
      </div>

      {/* Activity Status */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <Eye size={16} className="text-c-accent" />
          {t('settings.profile.visibility.activityStatus', 'Activity Status')}
        </h4>

        <div className="space-y-1">
          <ToggleSwitch
            enabled={visibility.showActivityStatus}
            onChange={(val) => setVisibility((prev: any) => ({ ...prev, showActivityStatus: val }))}
            label={t('settings.profile.visibility.showActivity', 'Show online status')}
            description={t(
              'settings.profile.visibility.showActivityDesc',
              'Let others see when you are online or away'
            )}
          />
          <ToggleSwitch
            enabled={visibility.showLastSeen}
            onChange={(val) => setVisibility((prev: any) => ({ ...prev, showLastSeen: val }))}
            label={t('settings.profile.visibility.showLastSeen', 'Show last seen')}
            description={t(
              'settings.profile.visibility.showLastSeenDesc',
              'Display when you were last active'
            )}
          />
        </div>
      </div>

      {/* Communication Settings */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <MessageSquare size={16} className="text-c-accent" />
          {t('settings.profile.visibility.communication', 'Communication Settings')}
        </h4>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-navy-900 flex items-center gap-2 mb-2">
              <AtSign size={14} />
              {t('settings.profile.visibility.allowMentions', 'Allow @mentions from')}
            </label>
            <div className="flex flex-wrap gap-2">
              {ALLOW_FROM_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setVisibility((prev: any) => ({ ...prev, allowMentionsFrom: option.value }))
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    visibility.allowMentionsFrom === option.value
                      ? 'bg-c-accent-soft dark:bg-c-accent-soft text-c-accent border-2 border-c-accent'
                      : 'bg-c-surface-raised text-c-text-secondary border-2 border-transparent hover:border-c-border-subtle dark:border-navy-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-navy-900 flex items-center gap-2 mb-2">
              <MessageSquare size={14} />
              {t('settings.profile.visibility.allowDMs', 'Allow direct messages from')}
            </label>
            <div className="flex flex-wrap gap-2">
              {ALLOW_FROM_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setVisibility((prev: any) => ({
                      ...prev,
                      allowDirectMessagesFrom: option.value,
                    }))
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    visibility.allowDirectMessagesFrom === option.value
                      ? 'bg-c-accent-soft dark:bg-c-accent-soft text-c-accent border-2 border-c-accent'
                      : 'bg-c-surface-raised text-c-text-secondary border-2 border-transparent hover:border-c-border-subtle dark:border-navy-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-amber-500 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-amber-900 dark:text-amber-300">
              {t('settings.profile.visibility.note', 'Privacy Note')}
            </h4>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              {t(
                'settings.profile.visibility.noteText',
                'Administrators can always view your basic profile information regardless of these settings. Your name and role will always be visible to team members.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {saveStatus === 'success' && (
        <div className="fixed bottom-8 right-8 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
          <CheckCircle size={16} />
          {t('common.saved', 'Saved!')}
        </div>
      )}
    </div>
  );
};

export default ProfileVisibilitySettings;
