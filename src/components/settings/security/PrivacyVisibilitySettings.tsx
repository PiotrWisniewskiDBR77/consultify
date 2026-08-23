/**
 * PrivacyVisibilitySettings - Granular Privacy Controls
 *
 * Features:
 * - Profile picture visibility (public/org/private)
 * - Email visibility settings
 * - Phone number visibility
 * - Activity feed granular controls
 * - Search visibility (appear in search results)
 * - Directory listing opt-out
 */

import {
  Activity,
  BookUser,
  Building2,
  Eye,
  EyeOff,
  Globe,
  Image,
  Info,
  Loader2,
  Lock,
  Mail,
  Phone,
  Save,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { User } from '../../../types';

interface PrivacyVisibilitySettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

type VisibilityLevel = 'public' | 'organization' | 'team' | 'private';

interface PrivacySettings {
  // Profile visibility
  profileVisibility: VisibilityLevel;
  avatarVisibility: VisibilityLevel;
  emailVisibility: VisibilityLevel;
  phoneVisibility: VisibilityLevel;

  // Activity controls
  showActivityStatus: boolean;
  showLastSeen: boolean;
  activityFeedVisibility: VisibilityLevel;
  showTaskActivity: boolean;
  showProjectActivity: boolean;
  showCommentActivity: boolean;

  // Directory & Search
  showInDirectory: boolean;
  showInSearch: boolean;
  allowMentionsFrom: 'all' | 'team' | 'none';
  allowDirectMessagesFrom: 'all' | 'team' | 'none';

  // Profile sections visibility
  showBio: boolean;
  showSkills: boolean;
  showCertifications: boolean;
  showEducation: boolean;
  showWorkHistory: boolean;
  showSocialLinks: boolean;
}

const defaultSettings: PrivacySettings = {
  profileVisibility: 'organization',
  avatarVisibility: 'organization',
  emailVisibility: 'organization',
  phoneVisibility: 'team',
  showActivityStatus: true,
  showLastSeen: true,
  activityFeedVisibility: 'team',
  showTaskActivity: true,
  showProjectActivity: true,
  showCommentActivity: true,
  showInDirectory: true,
  showInSearch: true,
  allowMentionsFrom: 'all',
  allowDirectMessagesFrom: 'all',
  showBio: true,
  showSkills: true,
  showCertifications: true,
  showEducation: true,
  showWorkHistory: true,
  showSocialLinks: true,
};

export const PrivacyVisibilitySettings: React.FC<PrivacyVisibilitySettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PrivacySettings>(defaultSettings);

  useEffect(() => {
    loadSettings();
  }, [currentUser.id]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await Api.get('/api/user/privacy-settings');
      if (response.success && response.data) {
        setSettings({ ...defaultSettings, ...response.data });
      }
    } catch (error) {
      console.error('Error loading privacy settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Api.put('/api/user/privacy-settings', settings);
      toast.success(t('settings.privacy.saved', 'Privacy settings saved'));
    } catch (error) {
      toast.error(t('settings.privacy.error', 'Failed to save privacy settings'));
    } finally {
      setSaving(false);
    }
  };

  const VisibilitySelector: React.FC<{
    value: VisibilityLevel;
    onChange: (value: VisibilityLevel) => void;
    label: string;
    description?: string;
    icon: React.ElementType;
  }> = ({ value, onChange, label, description, icon: Icon }) => {
    const options: {
      value: VisibilityLevel;
      label: string;
      icon: React.ElementType;
      color: string;
    }[] = [
      { value: 'public', label: 'Public', icon: Globe, color: 'text-green-600' },
      { value: 'organization', label: 'Organization', icon: Building2, color: 'text-blue-600' },
      { value: 'team', label: 'Team Only', icon: Users, color: 'text-c-accent' },
      { value: 'private', label: 'Private', icon: Lock, color: 'text-danger-600' },
    ];

    return (
      <div className="p-4 bg-c-surface-raised rounded-lg space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-c-surface rounded-lg">
            <Icon size={18} className="text-c-text-secondary" />
          </div>
          <div className="flex-1">
            <label className="font-medium text-c-text">{label}</label>
            {description && <p className="text-sm text-c-text-muted">{description}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const OptionIcon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => onChange(option.value)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  value === option.value
                    ? 'bg-navy-900 text-white dark:bg-c-surface dark:text-navy-950'
                    : 'bg-c-surface dark:bg-[#F4F7FB] text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-800 dark:hover:bg-[#DDE5EF]'
                }`}
              >
                <OptionIcon size={14} />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const ToggleSetting: React.FC<{
    value: boolean;
    onChange: (value: boolean) => void;
    label: string;
    description?: string;
    icon: React.ElementType;
  }> = ({ value, onChange, label, description, icon: Icon }) => {
    return (
      <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-c-surface rounded-lg">
            <Icon size={18} className="text-c-text-secondary" />
          </div>
          <div>
            <label className="font-medium text-c-text">{label}</label>
            {description && <p className="text-sm text-c-text-muted">{description}</p>}
          </div>
        </div>
        <button
          onClick={() => onChange(!value)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            value ? 'bg-navy-900' : 'bg-c-surface-raised'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${
              value ? 'left-7' : 'left-1'
            }`}
          />
        </button>
      </div>
    );
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Eye size={28} className="text-c-accent" />
            {t('settings.privacy.visibility.title', 'Privacy & Visibility')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t('settings.privacy.visibility.description', 'Control who can see your information')}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Profile Visibility Section */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Shield size={20} className="text-blue-500" />
          Profile Visibility
        </h3>

        <VisibilitySelector
          value={settings.profileVisibility}
          onChange={(v) => setSettings({ ...settings, profileVisibility: v })}
          label="Overall Profile"
          description="Who can view your profile page"
          icon={Users}
        />

        <VisibilitySelector
          value={settings.avatarVisibility}
          onChange={(v) => setSettings({ ...settings, avatarVisibility: v })}
          label="Profile Picture"
          description="Who can see your profile photo"
          icon={Image}
        />

        <VisibilitySelector
          value={settings.emailVisibility}
          onChange={(v) => setSettings({ ...settings, emailVisibility: v })}
          label="Email Address"
          description="Who can see your email"
          icon={Mail}
        />

        <VisibilitySelector
          value={settings.phoneVisibility}
          onChange={(v) => setSettings({ ...settings, phoneVisibility: v })}
          label="Phone Number"
          description="Who can see your phone number"
          icon={Phone}
        />
      </div>

      {/* Activity Controls Section */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Activity size={20} className="text-green-500" />
          Activity Controls
        </h3>

        <ToggleSetting
          value={settings.showActivityStatus}
          onChange={(v) => setSettings({ ...settings, showActivityStatus: v })}
          label="Show Activity Status"
          description="Let others see when you're online"
          icon={Eye}
        />

        <ToggleSetting
          value={settings.showLastSeen}
          onChange={(v) => setSettings({ ...settings, showLastSeen: v })}
          label="Show Last Seen"
          description="Display when you were last active"
          icon={Activity}
        />

        <VisibilitySelector
          value={settings.activityFeedVisibility}
          onChange={(v) => setSettings({ ...settings, activityFeedVisibility: v })}
          label="Activity Feed"
          description="Who can see your activity feed"
          icon={Activity}
        />

        <div className="border-t border-c-border-subtle dark:border-navy-700 pt-4 space-y-3">
          <p className="text-sm font-medium text-c-text-secondary">Show in Activity Feed:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 p-3 bg-c-surface-raised rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showTaskActivity}
                onChange={(e) => setSettings({ ...settings, showTaskActivity: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Task Activity</span>
            </label>
            <label className="flex items-center gap-2 p-3 bg-c-surface-raised rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showProjectActivity}
                onChange={(e) =>
                  setSettings({ ...settings, showProjectActivity: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm">Project Activity</span>
            </label>
            <label className="flex items-center gap-2 p-3 bg-c-surface-raised rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showCommentActivity}
                onChange={(e) =>
                  setSettings({ ...settings, showCommentActivity: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm">Comment Activity</span>
            </label>
          </div>
        </div>
      </div>

      {/* Directory & Search Section */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Search size={20} className="text-amber-500" />
          Directory & Search
        </h3>

        <ToggleSetting
          value={settings.showInDirectory}
          onChange={(v) => setSettings({ ...settings, showInDirectory: v })}
          label="Show in Directory"
          description="Appear in the organization's people directory"
          icon={BookUser}
        />

        <ToggleSetting
          value={settings.showInSearch}
          onChange={(v) => setSettings({ ...settings, showInSearch: v })}
          label="Appear in Search Results"
          description="Allow others to find you via search"
          icon={Search}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-c-surface-raised rounded-lg space-y-2">
            <label className="block font-medium text-c-text">Allow @mentions from</label>
            <select
              value={settings.allowMentionsFrom}
              onChange={(e) =>
                setSettings({ ...settings, allowMentionsFrom: e.target.value as any })
              }
              className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
            >
              <option value="all">Everyone</option>
              <option value="team">Team members only</option>
              <option value="none">Nobody</option>
            </select>
          </div>

          <div className="p-4 bg-c-surface-raised rounded-lg space-y-2">
            <label className="block font-medium text-c-text">Allow direct messages from</label>
            <select
              value={settings.allowDirectMessagesFrom}
              onChange={(e) =>
                setSettings({ ...settings, allowDirectMessagesFrom: e.target.value as any })
              }
              className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
            >
              <option value="all">Everyone</option>
              <option value="team">Team members only</option>
              <option value="none">Nobody</option>
            </select>
          </div>
        </div>
      </div>

      {/* Profile Sections Visibility */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Info size={20} className="text-indigo-500" />
          Profile Sections
        </h3>
        <p className="text-sm text-c-text-muted">
          Choose which sections are visible on your profile
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { key: 'showBio', label: 'Bio / About Me' },
            { key: 'showSkills', label: 'Skills' },
            { key: 'showCertifications', label: 'Certifications' },
            { key: 'showEducation', label: 'Education' },
            { key: 'showWorkHistory', label: 'Work History' },
            { key: 'showSocialLinks', label: 'Social Links' },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-3 p-3 bg-c-surface-raised rounded-lg cursor-pointer hover:bg-c-surface-raised dark:hover:bg-navy-800 transition-colors"
            >
              <input
                type="checkbox"
                checked={(settings as any)[item.key]}
                onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-c-text-secondary">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Privacy Info */}
      <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Privacy Note</p>
            <p>
              Administrators may have access to your information regardless of these settings for
              compliance and security purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyVisibilitySettings;
