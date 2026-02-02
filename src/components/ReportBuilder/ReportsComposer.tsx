/**
 * ReportsComposer
 *
 * Admin UI for managing report builder configuration:
 * - Block Types (custom section types)
 * - Templates (section presets)
 * - Invocation Profiles (context-specific configurations)
 */

import { ArrowLeft, Blocks, FileText, Layers, Loader2, Plus, Settings } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { BlockTypesManager } from './BlockTypesManager';

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
  const { i18n } = useTranslation();
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
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isPl ? 'Profile Wywołania' : 'Invocation Profiles'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isPl
              ? 'Profile definiują dostępne bloki, szablony i ustawienia dla różnych kontekstów'
              : 'Profiles define available blocks, templates, and settings for different contexts'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="p-5 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {isPl ? profile.namePl : profile.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {isPl ? profile.descriptionPl : profile.description}
                </p>

                {/* Source types */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {profile.sourceTypes.map((type) => (
                    <span
                      key={type}
                      className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded"
                    >
                      {type}
                    </span>
                  ))}
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {profile.features.allowMatrixVisualization && (
                    <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                      {isPl ? 'Macierz' : 'Matrix'}
                    </span>
                  )}
                  {profile.features.allowCustomSections && (
                    <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                      {isPl ? 'Własne sekcje' : 'Custom sections'}
                    </span>
                  )}
                  {profile.features.allowPdfExport && (
                    <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                      PDF
                    </span>
                  )}
                  {profile.features.allowPublicSharing && (
                    <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                      {isPl ? 'Udostępnianie' : 'Sharing'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {profiles.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          {isPl ? 'Brak zdefiniowanych profili' : 'No profiles defined'}
        </div>
      )}

      {/* Info box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium">{isPl ? 'Profile systemowe' : 'System Profiles'}</p>
            <p className="mt-1 text-blue-600 dark:text-blue-400">
              {isPl
                ? 'Profile są obecnie zdefiniowane w konfiguracji systemu. W przyszłej wersji będzie możliwe tworzenie własnych profili.'
                : 'Profiles are currently defined in system configuration. Custom profile creation will be available in a future version.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// TEMPLATES LIST COMPONENT
// ==========================================

const TemplatesList: React.FC = () => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isPl ? 'Szablony Raportów' : 'Report Templates'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isPl
              ? 'Predefiniowane struktury sekcji dla różnych typów raportów'
              : 'Predefined section structures for different report types'}
          </p>
        </div>
      </div>

      {/* Placeholder for templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Assessment Full Template */}
        <div className="p-5 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white">
                {isPl ? 'Pełna Ocena DRD' : 'Full DRD Assessment'}
              </h3>
              <p className="text-xs text-slate-500">8 {isPl ? 'sekcji' : 'sections'}</p>
            </div>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPl
              ? 'Kompleksowy raport z wszystkimi sekcjami oceny'
              : 'Comprehensive report with all assessment sections'}
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
              {isPl ? 'Streszczenie' : 'Summary'}
            </span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
              {isPl ? 'Macierz' : 'Matrix'}
            </span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
              {isPl ? 'Analiza' : 'Analysis'}
            </span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">+5</span>
          </div>
        </div>

        {/* Assessment Summary Template */}
        <div className="p-5 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white">
                {isPl ? 'Podsumowanie Oceny' : 'Assessment Summary'}
              </h3>
              <p className="text-xs text-slate-500">3 {isPl ? 'sekcje' : 'sections'}</p>
            </div>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPl ? 'Szybkie podsumowanie dla zarządu' : 'Quick executive summary'}
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
              {isPl ? 'Streszczenie' : 'Summary'}
            </span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
              {isPl ? 'Macierz' : 'Matrix'}
            </span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
              {isPl ? 'Rekomendacje' : 'Recommendations'}
            </span>
          </div>
        </div>

        {/* Tool Report Template */}
        <div className="p-5 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white">
                {isPl ? 'Raport Narzędzia' : 'Tool Report'}
              </h3>
              <p className="text-xs text-slate-500">4 {isPl ? 'sekcje' : 'sections'}</p>
            </div>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPl
              ? 'Raport z analizy narzędzia konsultingowego'
              : 'Report from consulting tool analysis'}
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
              {isPl ? 'Podsumowanie' : 'Summary'}
            </span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
              {isPl ? 'Analiza' : 'Analysis'}
            </span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
              {isPl ? 'Wnioski' : 'Findings'}
            </span>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700 dark:text-amber-300">
            <p className="font-medium">{isPl ? 'Szablony systemowe' : 'System Templates'}</p>
            <p className="mt-1 text-amber-600 dark:text-amber-400">
              {isPl
                ? 'Szablony są obecnie zdefiniowane w konfiguracji systemu. Edycja szablonów będzie dostępna w przyszłej wersji.'
                : 'Templates are currently defined in system configuration. Template editing will be available in a future version.'}
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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [activeTab, setActiveTab] = useState<ComposerTab>(initialTab);

  const tabs: Array<{ id: ComposerTab; label: string; labelPl: string; icon: React.ReactNode }> = [
    {
      id: 'blocks',
      label: 'Block Types',
      labelPl: 'Typy Bloków',
      icon: <Blocks className="w-4 h-4" />,
    },
    {
      id: 'templates',
      label: 'Templates',
      labelPl: 'Szablony',
      icon: <FileText className="w-4 h-4" />,
    },
    { id: 'profiles', label: 'Profiles', labelPl: 'Profile', icon: <Layers className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isPl ? 'Kompozytor Raportów' : 'Reports Composer'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {isPl
                ? 'Zarządzaj blokami, szablonami i profilami raportów'
                : 'Manage report blocks, templates, and profiles'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-navy-900 text-slate-900 dark:text-white shadow'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }
            `}
          >
            {tab.icon}
            {isPl ? tab.labelPl : tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow border border-slate-200 dark:border-slate-700 p-6">
        {activeTab === 'blocks' && <BlockTypesManager embedded />}
        {activeTab === 'templates' && <TemplatesList />}
        {activeTab === 'profiles' && <ProfilesList />}
      </div>
    </div>
  );
};

export default ReportsComposer;
