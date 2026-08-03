/**
 * CompanyFactsPanel - Right sidebar for Interview
 *
 * Shows:
 * - Company Facts (name, industry, size, location)
 * - Key Metrics extracted from interview
 * - Stakeholders identified
 * - Open Gaps that need follow-up
 */

import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  Edit3,
  MapPin,
  Plus,
  Save,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

// Types
export interface CompanyProfile {
  name?: string;
  industry?: string;
  size?: string;
  location?: string;
  founded?: string;
  employees?: number;
  revenue?: string;
  website?: string;
}

export interface KeyMetric {
  id: string;
  name: string;
  value: string;
  category?: string;
}

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  department?: string;
  influence?: 'high' | 'medium' | 'low';
}

export interface OpenGap {
  id: string;
  category: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CompanyFactsPanelProps {
  companyProfile: CompanyProfile;
  keyMetrics: KeyMetric[];
  stakeholders: Stakeholder[];
  openGaps: OpenGap[];
  onUpdateProfile: (profile: CompanyProfile) => Promise<void>;
  onAddMetric?: (metric: Omit<KeyMetric, 'id'>) => Promise<void>;
  onAddStakeholder?: (stakeholder: Omit<Stakeholder, 'id'>) => Promise<void>;
  isLoading?: boolean;
  readOnly?: boolean;
}

// Size options
const SIZE_OPTIONS = [
  { value: '1-10', label: '1-10' },
  { value: '11-50', label: '11-50' },
  { value: '51-200', label: '51-200' },
  { value: '201-500', label: '201-500' },
  { value: '501-1000', label: '501-1000' },
  { value: '1001-5000', label: '1001-5000' },
  { value: '5000+', label: '5000+' },
];

export const CompanyFactsPanel: React.FC<CompanyFactsPanelProps> = ({
  companyProfile,
  keyMetrics,
  stakeholders,
  openGaps,
  onUpdateProfile,
  onAddMetric,
  onAddStakeholder,
  isLoading = false,
  readOnly = false,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState<CompanyProfile>(companyProfile);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['profile', 'gaps'])
  );

  // Toggle section
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Save profile
  const handleSaveProfile = useCallback(async () => {
    await onUpdateProfile(editedProfile);
    setIsEditingProfile(false);
  }, [editedProfile, onUpdateProfile]);

  // Cancel edit
  const handleCancelEdit = useCallback(() => {
    setEditedProfile(companyProfile);
    setIsEditingProfile(false);
  }, [companyProfile]);

  if (isLoading) {
    return <LoadingState variant="spinner" className="h-48 py-0" />;
  }

  return (
    <div className="w-72 shrink-0 bg-c-surface border-l border-c-border flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-c-border">
        <h2 className="font-bold text-c-text dark:text-white flex items-center gap-2">
          <Building2 size={18} className="text-blue-500" />
          {t('interview.companyFactsPanel.companyFacts')}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Company Profile Section */}
        <div className="border-b border-c-border">
          <button
            onClick={() => toggleSection('profile')}
            className="w-full flex items-center justify-between p-3 hover:bg-c-bg dark:hover:bg-c-surface-raised"
          >
            <span className="text-sm font-medium text-c-text dark:text-white">
              {t('interview.companyFactsPanel.companyProfile')}
            </span>
            <ChevronRight
              size={16}
              className={`text-c-text-secondary transition-transform ${
                expandedSections.has('profile') ? 'rotate-90' : ''
              }`}
            />
          </button>

          {expandedSections.has('profile') && (
            <div className="px-3 pb-3 space-y-3">
              {isEditingProfile ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-c-text-muted mb-1">
                      {t('interview.companyFactsPanel.name')}
                    </label>
                    <input
                      type="text"
                      value={editedProfile.name || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-c-border rounded bg-c-bg text-c-text dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-c-text-muted mb-1">
                      {t('interview.companyFactsPanel.industry')}
                    </label>
                    <input
                      type="text"
                      value={editedProfile.industry || ''}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, industry: e.target.value })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-c-border rounded bg-c-bg text-c-text dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-c-text-muted mb-1">
                      {t('interview.companyFactsPanel.size')}
                    </label>
                    <select
                      value={editedProfile.size || ''}
                      onChange={(e) => setEditedProfile({ ...editedProfile, size: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-c-border rounded bg-c-bg text-c-text dark:text-white"
                    >
                      <option value="">{t('interview.companyFactsPanel.select')}</option>
                      {SIZE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} {t('interview.companyFactsPanel.employees')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-c-text-muted mb-1">
                      {t('interview.companyFactsPanel.location')}
                    </label>
                    <input
                      type="text"
                      value={editedProfile.location || ''}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, location: e.target.value })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-c-border rounded bg-c-bg text-c-text dark:text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={handleCancelEdit}
                      className="px-2 py-1 text-xs text-c-text-secondary hover:text-c-text-secondary"
                    >
                      {t('interview.companyFactsPanel.cancel')}
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded"
                    >
                      <Save size={12} />
                      {t('interview.companyFactsPanel.save')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    {companyProfile.name ? (
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-c-text-secondary shrink-0" />
                        <span className="text-sm text-c-text dark:text-white font-medium">
                          {companyProfile.name}
                        </span>
                      </div>
                    ) : null}

                    {companyProfile.industry && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-c-text-muted">
                          {t('interview.companyFactsPanel.industry2')}
                        </span>
                        <span className="text-sm text-c-text dark:text-white">
                          {companyProfile.industry}
                        </span>
                      </div>
                    )}

                    {companyProfile.size && (
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-c-text-secondary shrink-0" />
                        <span className="text-sm text-c-text dark:text-white">
                          {companyProfile.size} {t('interview.companyFactsPanel.employees')}
                        </span>
                      </div>
                    )}

                    {companyProfile.location && (
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-c-text-secondary shrink-0" />
                        <span className="text-sm text-c-text dark:text-white">
                          {companyProfile.location}
                        </span>
                      </div>
                    )}
                  </div>

                  {!readOnly && (
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-2"
                    >
                      <Edit3 size={12} />
                      {t('interview.companyFactsPanel.editProfile')}
                    </button>
                  )}

                  {!companyProfile.name && !companyProfile.industry && !companyProfile.size && (
                    <p className="text-xs text-c-text-secondary italic">
                      {t('interview.companyFactsPanel.noCompanyDataClickEdit')}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Key Metrics Section */}
        <div className="border-b border-c-border">
          <button
            onClick={() => toggleSection('metrics')}
            className="w-full flex items-center justify-between p-3 hover:bg-c-bg dark:hover:bg-c-surface-raised"
          >
            <span className="text-sm font-medium text-c-text dark:text-white">
              {t('interview.companyFactsPanel.keyMetrics')}
              <span className="ml-1 text-xs text-c-text-secondary">({keyMetrics.length})</span>
            </span>
            <ChevronRight
              size={16}
              className={`text-c-text-secondary transition-transform ${
                expandedSections.has('metrics') ? 'rotate-90' : ''
              }`}
            />
          </button>

          {expandedSections.has('metrics') && (
            <div className="px-3 pb-3">
              {keyMetrics.length > 0 ? (
                <div className="space-y-2">
                  {keyMetrics.map((metric) => (
                    <div key={metric.id} className="p-2 bg-c-bg rounded-lg">
                      <p className="text-xs text-c-text-muted">{metric.name}</p>
                      <p className="text-sm font-medium text-c-text dark:text-white">
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-c-text-secondary italic">
                  {t('interview.companyFactsPanel.metricsWillBeExtractedFrom')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Stakeholders Section */}
        <div className="border-b border-c-border">
          <button
            onClick={() => toggleSection('stakeholders')}
            className="w-full flex items-center justify-between p-3 hover:bg-c-bg dark:hover:bg-c-surface-raised"
          >
            <span className="text-sm font-medium text-c-text dark:text-white">
              {t('interview.companyFactsPanel.stakeholders')}
              <span className="ml-1 text-xs text-c-text-secondary">({stakeholders.length})</span>
            </span>
            <ChevronRight
              size={16}
              className={`text-c-text-secondary transition-transform ${
                expandedSections.has('stakeholders') ? 'rotate-90' : ''
              }`}
            />
          </button>

          {expandedSections.has('stakeholders') && (
            <div className="px-3 pb-3">
              {stakeholders.length > 0 ? (
                <div className="space-y-2">
                  {stakeholders.map((person) => (
                    <div key={person.id} className="flex items-center gap-2 p-2 bg-c-bg rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                          {person.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-c-text dark:text-white truncate">
                          {person.name}
                        </p>
                        <p className="text-xs text-c-text-muted truncate">{person.role}</p>
                      </div>
                      {person.influence && (
                        <span
                          className={`px-1.5 py-0.5 text-xs rounded ${
                            person.influence === 'high'
                              ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
                              : person.influence === 'medium'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-c-surface-raised text-c-text-secondary dark:bg-c-surface-raised dark:text-c-text-muted'
                          }`}
                        >
                          {person.influence}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-c-text-secondary italic">
                  {t('interview.companyFactsPanel.stakeholdersWillBeIdentifiedFrom')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Open Gaps Section */}
        <div>
          <button
            onClick={() => toggleSection('gaps')}
            className="w-full flex items-center justify-between p-3 hover:bg-c-bg dark:hover:bg-c-surface-raised"
          >
            <span className="text-sm font-medium text-c-text dark:text-white flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" />
              {t('interview.companyFactsPanel.openGaps')}
              <span className="text-xs text-c-text-secondary">({openGaps.length})</span>
            </span>
            <ChevronRight
              size={16}
              className={`text-c-text-secondary transition-transform ${
                expandedSections.has('gaps') ? 'rotate-90' : ''
              }`}
            />
          </button>

          {expandedSections.has('gaps') && (
            <div className="px-3 pb-3">
              {openGaps.length > 0 ? (
                <div className="space-y-2">
                  {openGaps.map((gap) => (
                    <div
                      key={gap.id}
                      className={`p-2 rounded-lg border-l-2 ${
                        gap.priority === 'high'
                          ? 'bg-danger-50 dark:bg-danger-900/10 border-danger-500'
                          : gap.priority === 'medium'
                            ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500'
                            : 'bg-c-bg border-c-border-strong'
                      }`}
                    >
                      <p className="text-xs font-medium text-c-text-muted mb-1">{gap.category}</p>
                      <p className="text-sm text-c-text dark:text-white">{gap.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-c-text-secondary italic">
                  {t('interview.companyFactsPanel.noInformationGapsIdentified')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-c-border">
        <p className="text-xs text-c-text-secondary text-center">
          {t('interview.companyFactsPanel.dataUpdatedAutomatically')}
        </p>
      </div>
    </div>
  );
};

export default CompanyFactsPanel;
