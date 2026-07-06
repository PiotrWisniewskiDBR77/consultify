import {
  Award,
  Briefcase,
  CheckCircle,
  FileText,
  GraduationCap,
  Info,
  Loader2,
  Plus,
  Save,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { Certification, User, UserSkill } from '../../types';

interface BioAboutSectionProps {
  currentUser: User;
  onUpdate?: () => void;
}

interface BioFormState {
  shortBio: string;
  longBio: string;
  skills: string[];
  yearsExperience: number | '';
}

// Common skill suggestions
const SKILL_SUGGESTIONS = [
  'Project Management',
  'Agile',
  'Scrum',
  'Leadership',
  'Communication',
  'Strategic Planning',
  'Data Analysis',
  'Problem Solving',
  'Team Building',
  'Risk Management',
  'Stakeholder Management',
  'Budgeting',
  'Negotiation',
  'Process Improvement',
  'Change Management',
  'Software Development',
  'UX Design',
  'Product Management',
  'Marketing',
  'Sales',
];

export const BioAboutSection: React.FC<BioAboutSectionProps> = ({ currentUser, onUpdate }) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [newSkill, setNewSkill] = useState('');
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);

  const [formState, setFormState] = useState<BioFormState>({
    shortBio: '',
    longBio: '',
    skills: [],
    yearsExperience: '',
  });

  // Load bio data on mount
  useEffect(() => {
    loadBioData();
  }, [currentUser.id]);

  const loadBioData = async () => {
    try {
      const response = await Api.get(`/profile/bio`);
      if (response.bio) {
        setFormState({
          shortBio: response.bio.shortBio || '',
          longBio: response.bio.longBio || '',
          skills: response.bio.skills || [],
          yearsExperience: response.bio.yearsExperience || '',
        });
      }
    } catch (error) {
      console.error('Failed to load bio:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Api.put('/profile/bio', {
        shortBio: formState.shortBio,
        longBio: formState.longBio,
        skills: formState.skills,
        yearsExperience: formState.yearsExperience || null,
      });
      setSaveStatus('success');
      onUpdate?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save bio:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const addSkill = (skill: string) => {
    const trimmedSkill = skill.trim();
    if (trimmedSkill && !formState.skills.includes(trimmedSkill)) {
      setFormState((prev) => ({
        ...prev,
        skills: [...prev.skills, trimmedSkill],
      }));
    }
    setNewSkill('');
    setShowSkillSuggestions(false);
  };

  const removeSkill = (skillToRemove: string) => {
    setFormState((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skillToRemove),
    }));
  };

  const filteredSuggestions = SKILL_SUGGESTIONS.filter(
    (s) => s.toLowerCase().includes(newSkill.toLowerCase()) && !formState.skills.includes(s)
  );

  // Styling classes
  const inputClass =
    'w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-md text-navy-900 focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none transition-all';
  const labelClass = 'text-xs font-medium text-c-text-muted';
  const cardClass =
    'bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg p-6';
  const sectionTitleClass =
    'text-sm font-bold text-navy-900 mb-4 uppercase tracking-wider flex items-center gap-2';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-navy-900">
            {t('settings.profile.bioAbout.title', 'Bio & About')}
          </h3>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.profile.bioAbout.description',
              'Tell others about yourself and your expertise'
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

      {/* Short Bio */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <FileText size={16} className="text-c-accent" />
          {t('settings.profile.bioAbout.shortBio', 'Short Bio')}
        </h4>
        <div className="space-y-2">
          <input
            value={formState.shortBio}
            onChange={(e) => setFormState((prev) => ({ ...prev, shortBio: e.target.value }))}
            placeholder={t(
              'settings.profile.bioAbout.shortBioPlaceholder',
              'A brief one-liner about yourself...'
            )}
            maxLength={150}
            className={inputClass}
          />
          <div className="flex justify-between text-xs text-c-text-secondary">
            <span>
              {t('settings.profile.bioAbout.shortBioHint', 'Displayed on your profile card')}
            </span>
            <span>{formState.shortBio.length}/150</span>
          </div>
        </div>
      </div>

      {/* Long Bio */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <FileText size={16} className="text-c-accent" />
          {t('settings.profile.bioAbout.longBio', 'About Me')}
        </h4>
        <div className="space-y-2">
          <textarea
            value={formState.longBio}
            onChange={(e) => setFormState((prev) => ({ ...prev, longBio: e.target.value }))}
            placeholder={t(
              'settings.profile.bioAbout.longBioPlaceholder',
              'Tell your story, share your background, interests, and what drives you...'
            )}
            maxLength={2000}
            rows={6}
            className={inputClass + ' resize-none'}
          />
          <div className="flex justify-between text-xs text-c-text-secondary">
            <span>
              {t('settings.profile.bioAbout.longBioHint', 'Markdown formatting supported')}
            </span>
            <span>{formState.longBio.length}/2000</span>
          </div>
        </div>
      </div>

      {/* Skills */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <Award size={16} className="text-c-accent" />
          {t('settings.profile.bioAbout.skills', 'Skills & Expertise')}
        </h4>

        {/* Skill Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {formState.skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-c-accent-soft dark:bg-c-accent-soft text-c-accent rounded-full text-sm"
            >
              {skill}
              <button
                onClick={() => removeSkill(skill)}
                className="ml-1 hover:text-c-accent transition-colors"
              >
                <X size={14} />
              </button>
            </span>
          ))}
          {formState.skills.length === 0 && (
            <span className="text-c-text-secondary text-sm italic">
              {t('settings.profile.bioAbout.noSkills', 'No skills added yet')}
            </span>
          )}
        </div>

        {/* Add Skill Input */}
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onFocus={() => setShowSkillSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSkillSuggestions(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill(newSkill);
                  }
                }}
                placeholder={t('settings.profile.bioAbout.addSkill', 'Add a skill...')}
                className={inputClass}
              />

              {/* Suggestions dropdown */}
              {showSkillSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg shadow-lg">
                  {filteredSuggestions.slice(0, 8).map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => addSkill(skill)}
                      className="w-full px-3 py-2 text-left text-sm text-c-text-secondary hover:bg-c-accent-soft dark:hover:bg-c-accent-soft transition-colors"
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => addSkill(newSkill)}
              disabled={!newSkill.trim()}
              className="px-4 py-2 bg-c-surface-raised hover:bg-c-surface-raised dark:hover:bg-navy-800 text-c-text-secondary rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Experience */}
      <div className={cardClass}>
        <h4 className={sectionTitleClass}>
          <Briefcase size={16} className="text-c-accent" />
          {t('settings.profile.bioAbout.experience', 'Experience')}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className={labelClass}>
              {t('settings.profile.bioAbout.yearsExperience', 'Years of Experience')}
            </label>
            <input
              type="number"
              min={0}
              max={50}
              value={formState.yearsExperience}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  yearsExperience: e.target.value ? parseInt(e.target.value) : '',
                }))
              }
              placeholder="e.g. 5"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Tip Card */}
      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-blue-500 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300">
              {t('settings.profile.bioAbout.tip', 'Profile Tip')}
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              {t(
                'settings.profile.bioAbout.tipText',
                'A complete profile helps your team members understand your background and expertise. It also helps AI provide more personalized assistance.'
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

export default BioAboutSection;
