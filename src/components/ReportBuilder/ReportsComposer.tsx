/**
 * ReportsComposer
 *
 * Admin UI for managing report builder configuration:
 * - Block Types (custom section types)
 * - Templates (section presets)
 * - Invocation Profiles (context-specific configurations)
 */

import { ArrowLeft, Blocks, FileText, Layers, Loader2, Plus, Settings } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Api } from '../../services/api';
import { BlockTypesManager } from './BlockTypesManager';
import { TemplatesManager } from './TemplatesManager';

// ==========================================
// TYPES
// ==========================================

type ComposerTab = 'blocks' | 'templates' | 'profiles';

interface InvocationProfile {
  id: string;
  name: string;
  namePl: string;
  description: string;
  descriptionPl: string;
  sourceTypes: string[];
  features: {
    allowCustomSections: boolean;
    allowReordering: boolean;
    allowMatrixVisualization: boolean;
    allowPdfExport: boolean;
    allowPublicSharing: boolean;
  };
}

interface ReportsComposerProps {
  onBack: () => void;
  initialTab?: ComposerTab;
}

// ==========================================
// PROFILES LIST COMPONENT
// ==========================================

const ProfilesList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [profiles, setProfiles] = useState<InvocationProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Api.get('/report-builder/profiles')
      .then((res) => setProfiles(res?.profiles || []))
      .catch(() => setProfiles([]))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-c-text">
            {t('reportBuilder.reportsComposer.invocationProfiles', 'Invocation Profiles')}
          </h2>
          <p className="text-sm text-c-text-secondary mt-1">
            {t(
              'reportBuilder.reportsComposer.profilesDefineAvailableBlocksTemplatesAnd',
              'Profiles define available blocks, templates, and settings for different contexts'
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="p-5 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <Layers className="w-6 h-6 text-c-text" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-c-text">
                  {isPl ? profile.namePl : profile.name}
                </h3>
                <p className="text-sm text-c-text-secondary mt-1">
                  {isPl ? profile.descriptionPl : profile.description}
                </p>

                {/* Source types */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {profile.sourceTypes.map((type) => (
                    <span
                      key={type}
                      className="text-xs px-2 py-0.5 bg-c-surface-raised text-c-text-secondary rounded"
                    >
                      {type}
                    </span>
                  ))}
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {profile.features.allowMatrixVisualization && (
                    <span className="text-xs px-2 py-1 bg-c-accent-soft text-c-accent rounded-full">
                      {t('reportBuilder.reportsComposer.matrix', 'Matrix')}
                    </span>
                  )}
                  {profile.features.allowCustomSections && (
                    <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                      {t('reportBuilder.reportsComposer.customSections', 'Custom sections')}
                    </span>
                  )}
                  {profile.features.allowPdfExport && (
                    <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                      PDF
                    </span>
                  )}
                  {profile.features.allowPublicSharing && (
                    <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                      {t('reportBuilder.reportsComposer.sharing', 'Sharing')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {profiles.length === 0 && (
        <div className="text-center py-12 text-c-text-secondary">
          {t('reportBuilder.reportsComposer.noProfilesDefined', 'No profiles defined')}
        </div>
      )}

      {/* Info box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium">
              {t('reportBuilder.reportsComposer.systemProfiles', 'System Profiles')}
            </p>
            <p className="mt-1 text-blue-600 dark:text-blue-400">
              {t(
                'reportBuilder.reportsComposer.profilesAreCurrentlyDefinedInSystem',
                'Profiles are currently defined in system configuration. Custom profile creation will be available in a future version.'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const ReportsComposer: React.FC<ReportsComposerProps> = ({
  onBack,
  initialTab = 'blocks',
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const navigate = useNavigate();

  const handleUseTemplate = useCallback(
    (templateId: string) => {
      navigate(`/reports/builder?new=true&templateId=${encodeURIComponent(templateId)}`);
    },
    [navigate]
  );

  const [activeTab, setActiveTab] = useState<ComposerTab>(initialTab);

  const tabs: Array<{ id: ComposerTab; label: string; labelKey: string; icon: React.ReactNode }> = [
    {
      id: 'blocks',
      label: 'Block Types',
      labelKey: 'reportBuilder.reportsComposer.tab.blocks',
      icon: <Blocks className="w-4 h-4" />,
    },
    {
      id: 'templates',
      label: 'Templates',
      labelKey: 'reportBuilder.reportsComposer.tab.templates',
      icon: <FileText className="w-4 h-4" />,
    },
    // Profiles tab hidden – profiles are system-defined presets with no user-facing value currently
    // { id: 'profiles', label: 'Profiles', labelPl: 'Profile', icon: <Layers className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-c-text">
              {t('reportBuilder.reportsComposer.reportsComposer', 'Reports Composer')}
            </h1>
            <p className="text-c-text-secondary mt-1">
              {t(
                'reportBuilder.reportsComposer.manageReportBlocksAndTemplates',
                'Manage report blocks and templates'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-c-surface-raised rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${
                activeTab === tab.id
                  ? 'bg-c-surface text-c-text shadow'
                  : 'text-c-text-secondary hover:text-c-text'
              }
            `}
          >
            {tab.icon}
            {t(tab.labelKey, tab.label)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-c-surface rounded-xl shadow border border-slate-200/60 dark:border-white/[0.03] p-6">
        {activeTab === 'blocks' && <BlockTypesManager embedded />}
        {activeTab === 'templates' && (
          <TemplatesManager embedded onUseTemplate={handleUseTemplate} />
        )}
        {activeTab === 'profiles' && <ProfilesList />}
      </div>
    </div>
  );
};

export default ReportsComposer;
