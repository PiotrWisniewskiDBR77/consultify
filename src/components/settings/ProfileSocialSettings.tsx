/**
 * ProfileSocialSettings - Social media links and profile visibility
 *
 * Features:
 * - Social media links (Twitter, GitHub, Website)
 * - Profile visibility settings
 */

import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Github,
  Globe,
  Loader2,
  Save,
  Twitter,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';

interface ProfileSocialSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', icon: Globe, description: 'Visible to everyone' },
  { value: 'team', label: 'Team Only', icon: Users, description: 'Visible to team members' },
  { value: 'private', label: 'Private', icon: EyeOff, description: 'Only visible to you' },
] as const;

export const ProfileSocialSettings: React.FC<ProfileSocialSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [twitter, setTwitter] = useState(currentUser.socialLinks?.twitter || '');
  const [github, setGithub] = useState(currentUser.socialLinks?.github || '');
  const [website, setWebsite] = useState(currentUser.socialLinks?.website || '');
  const [profileVisibility, setProfileVisibility] = useState<
    'public' | 'team' | 'private' | 'internal'
  >((currentUser.profileVisibility as 'public' | 'team' | 'private' | 'internal') || 'team');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    setTwitter(currentUser.socialLinks?.twitter || '');
    setGithub(currentUser.socialLinks?.github || '');
    setWebsite(currentUser.socialLinks?.website || '');
    setProfileVisibility((currentUser.profileVisibility as any) || 'team');
  }, [currentUser]);

  const normalizeUrl = (url: string, prefix: string) => {
    if (!url) return '';
    url = url.trim();
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${prefix}${url}`;
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const socialLinks: any = {};
      if (twitter.trim()) socialLinks.twitter = normalizeUrl(twitter, 'https://twitter.com/');
      if (github.trim()) socialLinks.github = normalizeUrl(github, 'https://github.com/');
      if (website.trim()) socialLinks.website = normalizeUrl(website, 'https://');

      await Api.updateUser(currentUser.id, {
        socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
        profileVisibility,
      });

      onUpdateUser({
        socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
        profileVisibility,
      });

      setSaveStatus('success');
      toast.success(t('settings.profile.social.saved', 'Social links updated successfully'));

      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: any) {
      setSaveStatus('error');
      toast.error(
        error.message || t('settings.profile.social.error', 'Failed to update social links')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const selectedVisibility = VISIBILITY_OPTIONS.find((opt) => opt.value === profileVisibility);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-c-text mb-2">
          {t('settings.profile.social.title', 'Social Links & Visibility')}
        </h3>
        <p className="text-sm text-c-text-muted">
          {t(
            'settings.profile.social.subtitle',
            'Add your social media profiles and control who can see your profile'
          )}
        </p>
      </div>

      {/* Social Links */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-c-text-secondary">
          {t('settings.profile.social.socialLinks', 'Social Media Links')}
        </label>

        {/* Twitter */}
        <div className="space-y-1.5">
          <label className="text-xs text-c-text-muted flex items-center gap-2">
            <Twitter size={14} />
            Twitter
          </label>
          <div className="flex items-center gap-2">
            <span className="text-c-text-secondary">twitter.com/</span>
            <input
              type="text"
              value={twitter.replace('https://twitter.com/', '').replace('@', '')}
              onChange={(e) => setTwitter(e.target.value.replace('@', ''))}
              placeholder={t('settings.profile.social.twitterPlaceholder', 'username')}
              className="flex-1 px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
            />
          </div>
        </div>

        {/* GitHub */}
        <div className="space-y-1.5">
          <label className="text-xs text-c-text-muted flex items-center gap-2">
            <Github size={14} />
            GitHub
          </label>
          <div className="flex items-center gap-2">
            <span className="text-c-text-secondary">github.com/</span>
            <input
              type="text"
              value={github.replace('https://github.com/', '')}
              onChange={(e) => setGithub(e.target.value)}
              placeholder={t('settings.profile.social.githubPlaceholder', 'username')}
              className="flex-1 px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
            />
          </div>
        </div>

        {/* Website */}
        <div className="space-y-1.5">
          <label className="text-xs text-c-text-muted flex items-center gap-2">
            <Globe size={14} />
            {t('settings.profile.social.website', 'Website')}
          </label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder={t('settings.profile.social.websitePlaceholder', 'https://example.com')}
            className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
          />
        </div>
      </div>

      {/* Profile Visibility */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-c-text-secondary">
          {t('settings.profile.social.profileVisibility', 'Profile Visibility')}
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {VISIBILITY_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = profileVisibility === option.value;

            return (
              <button
                key={option.value}
                onClick={() => setProfileVisibility(option.value)}
                className={`
                                    flex flex-col items-start gap-2 p-4 rounded-lg border-2 transition-all text-left
                                    ${
                                      isSelected
                                        ? 'border-c-border-strong bg-c-surface-raised'
                                        : 'border-c-border-subtle dark:border-navy-700 hover:border-c-border-strong'
                                    }
                                `}
              >
                <Icon
                  size={20}
                  className={
                    isSelected ? 'text-c-text-secondary' : 'text-c-text-secondary'
                  }
                />
                <div>
                  <div
                    className={`text-sm font-medium ${
                      isSelected
                        ? 'text-c-text'
                        : 'text-c-text-secondary'
                    }`}
                  >
                    {option.label}
                  </div>
                  <div className="text-xs text-c-text-muted mt-0.5">
                    {option.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t('common.saving', 'Saving...')}
            </>
          ) : (
            <>
              <Save size={16} />
              {t('common.save', 'Save')}
            </>
          )}
        </button>
      </div>

      {/* Success/Error Messages */}
      {saveStatus === 'success' && (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
          <CheckCircle size={16} />
          {t('settings.profile.social.saved', 'Social links updated successfully')}
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 text-danger-600 dark:text-danger-400 text-sm">
          <AlertCircle size={16} />
          {t('settings.profile.social.error', 'Failed to update social links')}
        </div>
      )}
    </div>
  );
};

export default ProfileSocialSettings;
