/**
 * ProfileBioSettings - User bio/about me section
 *
 * Features:
 * - Bio/About me text area
 * - Skills/tags management
 * - Pronouns selection
 * - Birthday and location
 */

import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Loader2,
  MapPin,
  Plus,
  Save,
  Tag,
  User as UserIcon,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';

interface ProfileBioSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

const PRONOUN_OPTIONS = [
  { value: 'he/him', label: 'He/Him' },
  { value: 'she/her', label: 'She/Her' },
  { value: 'they/them', label: 'They/Them' },
  { value: 'other', label: 'Other' },
] as const;

export const ProfileBioSettings: React.FC<ProfileBioSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [bio, setBio] = useState(currentUser.bio || '');
  const [pronouns, setPronouns] = useState(currentUser.pronouns || '');
  const [birthday, setBirthday] = useState(
    currentUser.birthday ? currentUser.birthday.split('T')[0] : ''
  );
  const [location, setLocation] = useState(currentUser.location || '');
  const [skills, setSkills] = useState<string[]>(currentUser.skills || []);
  const [newSkill, setNewSkill] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    setBio(currentUser.bio || '');
    setPronouns(currentUser.pronouns || '');
    setBirthday(currentUser.birthday ? currentUser.birthday.split('T')[0] : '');
    setLocation(currentUser.location || '');
    setSkills(currentUser.skills || []);
  }, [currentUser]);

  const handleAddSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await Api.updateUser(currentUser.id, {
        bio: bio.trim() || undefined,
        pronouns: pronouns || undefined,
        birthday: birthday || undefined,
        location: location.trim() || undefined,
        skills: skills.length > 0 ? skills : undefined,
      } as any);

      onUpdateUser({
        bio: bio.trim() || undefined,
        pronouns: pronouns || undefined,
        birthday: birthday || undefined,
        location: location.trim() || undefined,
        skills: skills.length > 0 ? skills : undefined,
      } as any);

      setSaveStatus('success');
      toast.success(t('settings.profile.bio.saved', 'Bio updated successfully'));

      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: any) {
      setSaveStatus('error');
      toast.error(error.message || t('settings.profile.bio.error', 'Failed to update bio'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-c-text mb-2">
          {t('settings.profile.bio.title', 'About Me')}
        </h3>
        <p className="text-sm text-c-text-muted">
          {t('settings.profile.bio.subtitle', 'Tell others about yourself')}
        </p>
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-c-text-secondary">
          {t('settings.profile.bio.bio', 'Bio')}
          <span className="text-c-text-secondary text-xs ml-1">
            ({t('common.optional', 'Optional')})
          </span>
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t(
            'settings.profile.bio.bioPlaceholder',
            'Write a short bio about yourself...'
          )}
          rows={4}
          maxLength={500}
          className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none resize-none"
        />
        <p className="text-xs text-c-text-secondary">
          {bio.length}/500 {t('common.characters', 'characters')}
        </p>
      </div>

      {/* Pronouns */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-c-text-secondary">
          {t('settings.profile.bio.pronouns', 'Pronouns')}
          <span className="text-c-text-secondary text-xs ml-1">
            ({t('common.optional', 'Optional')})
          </span>
        </label>
        <select
          value={pronouns}
          onChange={(e) => setPronouns(e.target.value)}
          className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
        >
          <option value="">{t('settings.profile.bio.selectPronouns', 'Select pronouns')}</option>
          {PRONOUN_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Birthday */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-c-text-secondary flex items-center gap-2">
          <Calendar size={16} />
          {t('settings.profile.bio.birthday', 'Birthday')}
          <span className="text-c-text-secondary text-xs ml-1">
            ({t('common.optional', 'Optional')})
          </span>
        </label>
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
        />
      </div>

      {/* Location */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-c-text-secondary flex items-center gap-2">
          <MapPin size={16} />
          {t('settings.profile.bio.location', 'Location')}
          <span className="text-c-text-secondary text-xs ml-1">
            ({t('common.optional', 'Optional')})
          </span>
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={t('settings.profile.bio.locationPlaceholder', 'e.g., Warsaw, Poland')}
          className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
        />
      </div>

      {/* Skills */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-c-text-secondary flex items-center gap-2">
          <Tag size={16} />
          {t('settings.profile.bio.skills', 'Skills')}
          <span className="text-c-text-secondary text-xs ml-1">
            ({t('common.optional', 'Optional')})
          </span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSkill();
              }
            }}
            placeholder={t('settings.profile.bio.skillPlaceholder', 'Add a skill...')}
            className="flex-1 px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
          />
          <button
            onClick={handleAddSkill}
            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            {t('common.add', 'Add')}
          </button>
        </div>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 px-3 py-1 bg-c-accent-soft dark:bg-c-accent-soft text-c-accent rounded-full text-sm"
              >
                {skill}
                <button onClick={() => handleRemoveSkill(skill)} className="hover:text-c-accent">
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}
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
          {t('settings.profile.bio.saved', 'Bio updated successfully')}
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 text-danger-600 dark:text-danger-400 text-sm">
          <AlertCircle size={16} />
          {t('settings.profile.bio.error', 'Failed to update bio')}
        </div>
      )}
    </div>
  );
};

export default ProfileBioSettings;
