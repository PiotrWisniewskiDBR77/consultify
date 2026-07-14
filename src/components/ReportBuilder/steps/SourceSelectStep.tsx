/**
 * SourceSelectStep
 *
 * Step 1: Select the source type and specific source for the report.
 */

import {
  CheckCircle2,
  ClipboardCheck,
  FileQuestion,
  Lightbulb,
  Loader2,
  PackageOpen,
  Search,
  Wrench,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ReportSourceType, SourceOption } from '../useReportBuilder';

// ==========================================
// TYPES
// ==========================================

interface SourceSelectStepProps {
  sourceType: ReportSourceType | null;
  selectedSource: SourceOption | null;
  reportTitle: string;
  reportDescription: string;
  onSourceTypeChange: (type: ReportSourceType | null) => void;
  onSourceSelect: (source: SourceOption | null) => void;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  fetchSources: (type: ReportSourceType) => Promise<SourceOption[]>;
  isLoading: boolean;
}

const SOURCE_TYPES: Array<{
  type: ReportSourceType;
  label: string;
  labelPl: string;
  description: string;
  descriptionPl: string;
  icon: React.ComponentType<{ className?: string }>;
  available: boolean;
}> = [
  {
    type: 'ASSESSMENT',
    label: 'Assessment',
    labelPl: 'Ocena',
    description: 'Create report from an approved assessment (DRD, SIRI)',
    descriptionPl: 'Utwórz raport z zatwierdzonej oceny (DRD, SIRI)',
    icon: ClipboardCheck,
    available: true,
  },
  {
    type: 'INTERVIEW',
    label: 'Interview',
    labelPl: 'Wywiad',
    description: 'Create report from completed interviews',
    descriptionPl: 'Utwórz raport z przeprowadzonych wywiadów',
    icon: FileQuestion,
    available: true,
  },
  {
    type: 'TOOL',
    label: 'Strategy Tool',
    labelPl: 'Narzędzie Strategiczne',
    description: 'Create report from strategy tool analysis',
    descriptionPl: 'Utwórz raport z analizy narzędzia strategicznego',
    icon: Wrench,
    available: true,
  },
  {
    type: 'INITIATIVE',
    label: 'Initiative',
    labelPl: 'Inicjatywa',
    description: 'Create report for initiative progress',
    descriptionPl: 'Utwórz raport postępu inicjatywy',
    icon: Lightbulb,
    available: true,
  },
  {
    type: 'UPLOAD_BUNDLE',
    label: 'Upload Bundle',
    labelPl: 'Paczka Uploadów',
    description: 'Create draft report from uploaded documents',
    descriptionPl: 'Utwórz draft raportu z wrzuconych dokumentów',
    icon: PackageOpen,
    available: true,
  },
];

// ==========================================
// COMPONENT
// ==========================================

export const SourceSelectStep: React.FC<SourceSelectStepProps> = ({
  sourceType,
  selectedSource,
  reportTitle,
  reportDescription,
  onSourceTypeChange,
  onSourceSelect,
  onTitleChange,
  onDescriptionChange,
  fetchSources,
  isLoading,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [sources, setSources] = useState<SourceOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingSources, setLoadingSources] = useState(false);

  // Fetch sources when type changes
  useEffect(() => {
    if (sourceType) {
      setLoadingSources(true);
      fetchSources(sourceType).then((data) => {
        setSources(data);
        setLoadingSources(false);
      });
    } else {
      setSources([]);
    }
  }, [sourceType, fetchSources]);

  // Filter sources by search
  const filteredSources = sources.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Auto-generate title when source is selected
  const handleSourceSelect = useCallback(
    (source: SourceOption) => {
      onSourceSelect(source);
      if (!reportTitle) {
        onTitleChange(`${source.name} - Report`);
      }
    },
    [onSourceSelect, onTitleChange, reportTitle]
  );

  return (
    <div className="space-y-8">
      {/* Source Type Selection */}
      <div>
        <label className="block text-sm font-medium text-c-text mb-3">
          {isPl ? 'Typ Źródła' : 'Source Type'}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SOURCE_TYPES.map((st) => {
            const Icon = st.icon;
            const isSelected = sourceType === st.type;
            const isDisabled = !st.available;

            return (
              <button
                key={st.type}
                onClick={() => {
                  if (!isDisabled) {
                    onSourceTypeChange(isSelected ? null : st.type);
                    onSourceSelect(null);
                  }
                }}
                disabled={isDisabled}
                className={`
                  relative p-4 rounded-xl border-2 text-left transition-all
                  ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : isDisabled
                        ? 'border-c-border-subtle bg-c-surface-raised opacity-50 cursor-not-allowed'
                        : 'border-c-border-subtle hover:border-blue-300 dark:hover:border-blue-700'
                  }
                `}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                  </div>
                )}

                <div
                  className={`
                  w-10 h-10 rounded-lg flex items-center justify-center mb-3
                  ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'bg-c-surface-raised text-c-text-secondary'}
                `}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="font-medium text-c-text">{isPl ? st.labelPl : st.label}</div>
                <div className="text-xs text-c-text-secondary mt-1">
                  {isPl ? st.descriptionPl : st.description}
                </div>

                {isDisabled && (
                  <span className="absolute top-2 right-2 text-xs text-c-text-secondary">
                    {isPl ? 'Niedostępne' : 'Not available'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Source Selection */}
      {sourceType && (
        <div className="animate-fade-in">
          <label className="block text-sm font-medium text-c-text mb-3">
            {isPl ? 'Wybierz Źródło' : 'Select Source'}
          </label>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-c-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isPl ? 'Szukaj...' : 'Search...'}
              className="w-full pl-10 pr-4 py-2 border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Sources List */}
          {loadingSources ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="text-center py-12 text-c-text-secondary">
              {isPl ? 'Brak zatwierdzonych źródeł do wyboru' : 'No approved sources available'}
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredSources.map((source) => {
                const isSelected = selectedSource?.id === source.id;
                const rawDate =
                  (source as any).approvedAt ||
                  (source as any).completedAt ||
                  (source as any).updatedAt ||
                  (source as any).createdAt ||
                  '';
                const dateText = rawDate ? new Date(String(rawDate)).toLocaleDateString() : '—';
                const dateLabel =
                  sourceType === 'ASSESSMENT'
                    ? isPl
                      ? 'Zatwierdzono'
                      : 'Approved'
                    : (source as any).completedAt
                      ? isPl
                        ? 'Zakończono'
                        : 'Completed'
                      : isPl
                        ? 'Zaktualizowano'
                        : 'Updated';

                return (
                  <button
                    key={source.id}
                    onClick={() => handleSourceSelect(source)}
                    className={`
                      w-full p-4 rounded-lg border text-left transition-all
                      ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-c-border-subtle hover:border-blue-300 dark:hover:border-blue-700'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-c-text">{source.name}</div>
                        <div className="text-xs text-c-text-secondary mt-1">
                          {source.framework} • {dateLabel}: {dateText}
                        </div>
                      </div>

                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Report Details */}
      {selectedSource && (
        <div className="animate-fade-in space-y-4 pt-4 border-t border-c-border-subtle">
          <h3 className="font-medium text-c-text">
            {isPl ? 'Szczegóły Raportu' : 'Report Details'}
          </h3>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {isPl ? 'Tytuł Raportu' : 'Report Title'} *
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder={isPl ? 'Wprowadź tytuł raportu...' : 'Enter report title...'}
              className="w-full px-4 py-2 border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {isPl ? 'Opis / Cel Raportu' : 'Description / Report Purpose'}
            </label>
            <textarea
              value={reportDescription}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder={
                isPl
                  ? 'Opisz cel raportu, dla kogo jest przeznaczony, jakie decyzje ma wspierać...'
                  : 'Describe the report purpose, target audience, decisions it should support...'
              }
              rows={3}
              className="w-full px-4 py-2 border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-c-text-secondary mt-1">
              {isPl
                ? 'Ten opis zostanie wykorzystany przez AI do lepszego dopasowania treści raportu'
                : 'This description will be used by AI to better tailor the report content'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SourceSelectStep;
