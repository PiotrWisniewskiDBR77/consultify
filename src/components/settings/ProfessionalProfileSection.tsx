/**
 * ProfessionalProfileSection - Extended Professional Profile
 *
 * Features:
 * - Bio/About Me
 * - Skills/Tags
 * - Certifications
 * - Education
 * - Work Experience
 * - Social Media Links
 */

import {
  Award,
  Briefcase,
  Edit2,
  ExternalLink,
  Github,
  Globe,
  GraduationCap,
  Link2,
  Loader2,
  Plus,
  Save,
  Tag,
  Trash2,
  Twitter,
  UserCircle,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { Certification, Education, SocialLinks, User, WorkExperience } from '../../types';

interface ProfessionalProfileSectionProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

export const ProfessionalProfileSection: React.FC<ProfessionalProfileSectionProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // State
  const [bio, setBio] = useState(currentUser.bio || '');
  const [skills, setSkills] = useState<string[]>(currentUser.skills || []);
  const [newSkill, setNewSkill] = useState('');
  const [certifications, setCertifications] = useState<Certification[]>(
    currentUser.certifications || []
  );
  const [education, setEducation] = useState<Education[]>(currentUser.education || []);
  const [workExperience, setWorkExperience] = useState<WorkExperience[]>(
    currentUser.workExperience || []
  );
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(currentUser.socialLinks || {});

  // Edit states
  const [editingCert, setEditingCert] = useState<string | null>(null);
  const [editingEdu, setEditingEdu] = useState<string | null>(null);
  const [editingWork, setEditingWork] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, [currentUser.id]);

  const loadProfile = async () => {
    try {
      const data = await Api.get('/api/user/professional-profile');
      if (data) {
        setBio(data.bio || '');
        setSkills(data.skills || []);
        setCertifications(data.certifications || []);
        setEducation(data.education || []);
        setWorkExperience(data.workExperience || []);
        setSocialLinks(data.socialLinks || {});
      }
    } catch (error) {
      console.error('Failed to load professional profile:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = {
        bio,
        skills,
        certifications,
        education,
        workExperience,
        socialLinks,
      };
      await Api.put('/api/user/professional-profile', updates);
      onUpdateUser(updates);
      toast.success(t('settings.profile.professional.saved', 'Professional profile saved'));
    } catch (error) {
      toast.error(t('settings.profile.professional.error', 'Failed to save profile'));
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const addCertification = () => {
    const newCert: Certification = {
      id: Date.now().toString(),
      name: '',
      issuer: '',
      issueDate: new Date().toISOString().split('T')[0],
      expiryDate: undefined,
      credentialId: '',
      credentialUrl: '',
    };
    setCertifications([...certifications, newCert]);
    setEditingCert(newCert.id);
  };

  const updateCertification = (id: string, updates: Partial<Certification>) => {
    setCertifications((certs) => certs.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCertification = (id: string) => {
    setCertifications((certs) => certs.filter((c) => c.id !== id));
    setEditingCert(null);
  };

  const addEducation = () => {
    const newEdu: Education = {
      id: Date.now().toString(),
      institution: '',
      degree: '',
      fieldOfStudy: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: undefined,
      isCurrent: false,
      description: '',
    };
    setEducation([...education, newEdu]);
    setEditingEdu(newEdu.id);
  };

  const updateEducation = (id: string, updates: Partial<Education>) => {
    setEducation((edu) => edu.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  const removeEducation = (id: string) => {
    setEducation((edu) => edu.filter((e) => e.id !== id));
    setEditingEdu(null);
  };

  const addWorkExperience = () => {
    const newWork: WorkExperience = {
      id: Date.now().toString(),
      company: '',
      position: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: undefined,
      isCurrent: false,
      description: '',
      location: '',
    };
    setWorkExperience([...workExperience, newWork]);
    setEditingWork(newWork.id);
  };

  const updateWorkExperience = (id: string, updates: Partial<WorkExperience>) => {
    setWorkExperience((work) => work.map((w) => (w.id === id ? { ...w, ...updates } : w)));
  };

  const removeWorkExperience = (id: string) => {
    setWorkExperience((work) => work.filter((w) => w.id !== id));
    setEditingWork(null);
  };

  const updateSocialLink = (key: keyof SocialLinks, value: string) => {
    setSocialLinks((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <UserCircle size={28} className="text-c-accent" />
            {t('settings.profile.professional.title', 'Professional Profile')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.profile.professional.description',
              'Showcase your professional background and expertise'
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save Changes')}
        </button>
      </div>

      {/* Bio/About Me */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4">
          {t('settings.profile.professional.bio', 'About Me')}
        </h3>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t(
            'settings.profile.professional.bioPlaceholder',
            'Tell us about yourself, your experience, and what you do...'
          )}
          rows={6}
          className="w-full px-4 py-3 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none resize-none"
        />
        <p className="text-xs text-c-text-muted mt-2">
          {bio.length} / 2000 {t('settings.profile.professional.characters', 'characters')}
        </p>
      </div>

      {/* Skills */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Tag size={20} className="text-blue-500" />
          {t('settings.profile.professional.skills', 'Skills')}
        </h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {skills.map((skill, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-c-accent-soft dark:bg-c-accent-soft text-c-accent rounded-lg text-sm font-medium"
            >
              {skill}
              <button onClick={() => removeSkill(skill)} className="hover:text-c-accent">
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addSkill()}
            placeholder={t('settings.profile.professional.addSkill', 'Add a skill...')}
            className="flex-1 px-4 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
          />
          <button
            onClick={addSkill}
            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Certifications */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <Award size={20} className="text-amber-500" />
            {t('settings.profile.professional.certifications', 'Certifications')}
          </h3>
          <button
            onClick={addCertification}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
          >
            <Plus size={16} />
            {t('settings.profile.professional.addCert', 'Add Certification')}
          </button>
        </div>
        <div className="space-y-4">
          {certifications.map((cert) => (
            <CertificationCard
              key={cert.id}
              cert={cert}
              isEditing={editingCert === cert.id}
              onEdit={() => setEditingCert(cert.id)}
              onSave={() => setEditingCert(null)}
              onCancel={() => {
                setEditingCert(null);
                if (!cert.name) removeCertification(cert.id);
              }}
              onUpdate={(updates) => updateCertification(cert.id, updates)}
              onDelete={() => removeCertification(cert.id)}
            />
          ))}
          {certifications.length === 0 && (
            <p className="text-sm text-c-text-muted text-center py-8">
              {t('settings.profile.professional.noCerts', 'No certifications added yet')}
            </p>
          )}
        </div>
      </div>

      {/* Education */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <GraduationCap size={20} className="text-green-500" />
            {t('settings.profile.professional.education', 'Education')}
          </h3>
          <button
            onClick={addEducation}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
          >
            <Plus size={16} />
            {t('settings.profile.professional.addEdu', 'Add Education')}
          </button>
        </div>
        <div className="space-y-4">
          {education.map((edu) => (
            <EducationCard
              key={edu.id}
              edu={edu}
              isEditing={editingEdu === edu.id}
              onEdit={() => setEditingEdu(edu.id)}
              onSave={() => setEditingEdu(null)}
              onCancel={() => {
                setEditingEdu(null);
                if (!edu.institution) removeEducation(edu.id);
              }}
              onUpdate={(updates) => updateEducation(edu.id, updates)}
              onDelete={() => removeEducation(edu.id)}
            />
          ))}
          {education.length === 0 && (
            <p className="text-sm text-c-text-muted text-center py-8">
              {t('settings.profile.professional.noEdu', 'No education entries added yet')}
            </p>
          )}
        </div>
      </div>

      {/* Work Experience */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <Briefcase size={20} className="text-indigo-500" />
            {t('settings.profile.professional.workExperience', 'Work Experience')}
          </h3>
          <button
            onClick={addWorkExperience}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
          >
            <Plus size={16} />
            {t('settings.profile.professional.addWork', 'Add Experience')}
          </button>
        </div>
        <div className="space-y-4">
          {workExperience.map((work) => (
            <WorkExperienceCard
              key={work.id}
              work={work}
              isEditing={editingWork === work.id}
              onEdit={() => setEditingWork(work.id)}
              onSave={() => setEditingWork(null)}
              onCancel={() => {
                setEditingWork(null);
                if (!work.company) removeWorkExperience(work.id);
              }}
              onUpdate={(updates) => updateWorkExperience(work.id, updates)}
              onDelete={() => removeWorkExperience(work.id)}
            />
          ))}
          {workExperience.length === 0 && (
            <p className="text-sm text-c-text-muted text-center py-8">
              {t('settings.profile.professional.noWork', 'No work experience added yet')}
            </p>
          )}
        </div>
      </div>

      {/* Social Links */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Link2 size={20} className="text-pink-500" />
          {t('settings.profile.professional.socialLinks', 'Social Links')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SocialLinkInput
            icon={<Twitter size={18} />}
            label="Twitter"
            value={socialLinks.twitter || ''}
            onChange={(value) => updateSocialLink('twitter', value)}
            placeholder="@username"
          />
          <SocialLinkInput
            icon={<Github size={18} />}
            label="GitHub"
            value={socialLinks.github || ''}
            onChange={(value) => updateSocialLink('github', value)}
            placeholder="username"
          />
          <SocialLinkInput
            icon={<Globe size={18} />}
            label="Website"
            value={socialLinks.website || ''}
            onChange={(value) => updateSocialLink('website', value)}
            placeholder="https://..."
          />
          <SocialLinkInput
            icon={<Link2 size={18} />}
            label="Portfolio"
            value={socialLinks.portfolio || ''}
            onChange={(value) => updateSocialLink('portfolio', value)}
            placeholder="https://..."
          />
        </div>
      </div>
    </div>
  );
};

// Sub-components
interface CertificationCardProps {
  cert: Certification;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdate: (updates: Partial<Certification>) => void;
  onDelete: () => void;
}

const CertificationCard: React.FC<CertificationCardProps> = ({
  cert,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onUpdate,
  onDelete,
}) => {
  if (isEditing) {
    return (
      <div className="p-4 border border-c-accent dark:border-c-accent rounded-lg bg-c-accent-soft dark:bg-c-accent-soft">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            value={cert.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Certification Name"
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="text"
            value={cert.issuer}
            onChange={(e) => onUpdate({ issuer: e.target.value })}
            placeholder="Issuing Organization"
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="date"
            value={cert.issueDate}
            onChange={(e) => onUpdate({ issueDate: e.target.value })}
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="date"
            value={cert.expiryDate || ''}
            onChange={(e) => onUpdate({ expiryDate: e.target.value || undefined })}
            placeholder="Expiry Date (optional)"
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="text"
            value={cert.credentialId || ''}
            onChange={(e) => onUpdate({ credentialId: e.target.value })}
            placeholder="Credential ID (optional)"
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="url"
            value={cert.credentialUrl || ''}
            onChange={(e) => onUpdate({ credentialUrl: e.target.value })}
            placeholder="Verification URL (optional)"
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onSave}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-c-surface-raised text-c-text-secondary rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-danger-600 text-white rounded-lg text-sm ml-auto"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border border-c-border-subtle dark:border-navy-700 rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold text-c-text">{cert.name}</h4>
          <p className="text-sm text-c-text-secondary">{cert.issuer}</p>
          <div className="flex gap-4 mt-2 text-xs text-c-text-muted">
            <span>Issued: {new Date(cert.issueDate).toLocaleDateString()}</span>
            {cert.expiryDate && (
              <span>Expires: {new Date(cert.expiryDate).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="p-2 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg"
          >
            <Edit2 size={16} />
          </button>
          {cert.credentialUrl && (
            <a
              href={cert.credentialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg"
            >
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

interface EducationCardProps {
  edu: Education;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdate: (updates: Partial<Education>) => void;
  onDelete: () => void;
}

const EducationCard: React.FC<EducationCardProps> = ({
  edu,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onUpdate,
  onDelete,
}) => {
  if (isEditing) {
    return (
      <div className="p-4 border border-c-accent dark:border-c-accent rounded-lg bg-c-accent-soft dark:bg-c-accent-soft">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            value={edu.institution}
            onChange={(e) => onUpdate({ institution: e.target.value })}
            placeholder="Institution Name"
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="text"
            value={edu.degree}
            onChange={(e) => onUpdate({ degree: e.target.value })}
            placeholder="Degree"
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="text"
            value={edu.fieldOfStudy || ''}
            onChange={(e) => onUpdate({ fieldOfStudy: e.target.value })}
            placeholder="Field of Study (optional)"
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={edu.isCurrent}
              onChange={(e) => onUpdate({ isCurrent: e.target.checked })}
              className="rounded"
            />
            <label className="text-sm">Currently studying</label>
          </div>
          <input
            type="date"
            value={edu.startDate}
            onChange={(e) => onUpdate({ startDate: e.target.value })}
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          {!edu.isCurrent && (
            <input
              type="date"
              value={edu.endDate || ''}
              onChange={(e) => onUpdate({ endDate: e.target.value || undefined })}
              className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
            />
          )}
          <textarea
            value={edu.description || ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Description (optional)"
            rows={3}
            className="md:col-span-2 px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg resize-none"
          />
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onSave}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-c-surface-raised text-c-text-secondary rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-danger-600 text-white rounded-lg text-sm ml-auto"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border border-c-border-subtle dark:border-navy-700 rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold text-c-text">{edu.degree}</h4>
          <p className="text-sm text-c-text-secondary">{edu.institution}</p>
          {edu.fieldOfStudy && <p className="text-xs text-c-text-muted mt-1">{edu.fieldOfStudy}</p>}
          <div className="flex gap-4 mt-2 text-xs text-c-text-muted">
            <span>{new Date(edu.startDate).getFullYear()}</span>
            {edu.endDate && <span>- {new Date(edu.endDate).getFullYear()}</span>}
            {edu.isCurrent && <span className="text-green-600">Current</span>}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="p-2 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg"
        >
          <Edit2 size={16} />
        </button>
      </div>
    </div>
  );
};

interface WorkExperienceCardProps {
  work: WorkExperience;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdate: (updates: Partial<WorkExperience>) => void;
  onDelete: () => void;
}

const WorkExperienceCard: React.FC<WorkExperienceCardProps> = ({
  work,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onUpdate,
  onDelete,
}) => {
  if (isEditing) {
    return (
      <div className="p-4 border border-c-accent dark:border-c-accent rounded-lg bg-c-accent-soft dark:bg-c-accent-soft">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            value={work.company}
            onChange={(e) => onUpdate({ company: e.target.value })}
            placeholder="Company Name"
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="text"
            value={work.position}
            onChange={(e) => onUpdate({ position: e.target.value })}
            placeholder="Position/Title"
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <input
            type="text"
            value={work.location || ''}
            onChange={(e) => onUpdate({ location: e.target.value })}
            placeholder="Location (optional)"
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={work.isCurrent}
              onChange={(e) => onUpdate({ isCurrent: e.target.checked })}
              className="rounded"
            />
            <label className="text-sm">Current position</label>
          </div>
          <input
            type="date"
            value={work.startDate}
            onChange={(e) => onUpdate({ startDate: e.target.value })}
            className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
          />
          {!work.isCurrent && (
            <input
              type="date"
              value={work.endDate || ''}
              onChange={(e) => onUpdate({ endDate: e.target.value || undefined })}
              className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
            />
          )}
          <textarea
            value={work.description || ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Description (optional)"
            rows={3}
            className="md:col-span-2 px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg resize-none"
          />
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onSave}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-c-surface-raised text-c-text-secondary rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-danger-600 text-white rounded-lg text-sm ml-auto"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border border-c-border-subtle dark:border-navy-700 rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold text-c-text">{work.position}</h4>
          <p className="text-sm text-c-text-secondary">{work.company}</p>
          {work.location && <p className="text-xs text-c-text-muted mt-1">{work.location}</p>}
          <div className="flex gap-4 mt-2 text-xs text-c-text-muted">
            <span>{new Date(work.startDate).toLocaleDateString()}</span>
            {work.endDate && <span>- {new Date(work.endDate).toLocaleDateString()}</span>}
            {work.isCurrent && <span className="text-green-600">Current</span>}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="p-2 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg"
        >
          <Edit2 size={16} />
        </button>
      </div>
    </div>
  );
};

interface SocialLinkInputProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

const SocialLinkInput: React.FC<SocialLinkInputProps> = ({
  icon,
  label,
  value,
  onChange,
  placeholder,
}) => {
  return (
    <div className="flex items-center gap-3">
      <div className="text-c-text-secondary">{icon}</div>
      <div className="flex-1">
        <label className="block text-sm font-medium text-c-text-secondary mb-1">{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
        />
      </div>
    </div>
  );
};

export default ProfessionalProfileSection;
