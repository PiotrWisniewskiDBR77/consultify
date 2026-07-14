/**
 * OutlineProposalStep
 *
 * Path B (Free Intelligence Mode): AI proposes an outline for the report.
 * User can review, reorder visually, edit titles, remove/add sections,
 * then accept the final structure.
 */

import { Check, GripVertical, Loader2, Plus, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';

export interface ProposedSection {
  key: string;
  type: string;
  title: string;
  summary: string;
  required: boolean;
  defaultLength: 'short' | 'medium' | 'long';
}

export interface OutlineProposalStepProps {
  reportId: string;
  intent: any;
  onAcceptOutline: (sections: ProposedSection[]) => void;
  isLoading: boolean;
}

const lengthBadgeClasses: Record<string, string> = {
  short: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  long: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

export const OutlineProposalStep: React.FC<OutlineProposalStepProps> = ({
  reportId,
  intent,
  onAcceptOutline,
  isLoading: externalLoading,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [sections, setSections] = useState<ProposedSection[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addingSection, setAddingSection] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');

  useEffect(() => {
    if (!reportId) return;
    setFetching(true);
    setError(null);

    Api.post(`/report-builder/${reportId}/propose-outline`, { intent })
      .then((res: any) => {
        setSections(res?.sections ?? res?.variants?.[0]?.sections ?? res?.outline ?? []);
      })
      .catch(() => {
        setError(
          isPl ? 'Nie udało się pobrać propozycji struktury.' : 'Failed to fetch outline proposal.'
        );
      })
      .finally(() => setFetching(false));
  }, [reportId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateTitle = useCallback((key: string, title: string) => {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, title } : s)));
  }, []);

  const removeSection = useCallback((key: string) => {
    setSections((prev) => prev.filter((s) => s.key !== key));
  }, []);

  const addSection = useCallback(() => {
    if (!newTitle.trim()) return;
    const key = `custom_${Date.now()}`;
    setSections((prev) => [
      ...prev,
      {
        key,
        type: 'custom',
        title: newTitle.trim(),
        summary: newSummary.trim(),
        required: false,
        defaultLength: 'medium',
      },
    ]);
    setNewTitle('');
    setNewSummary('');
    setAddingSection(false);
  }, [newTitle, newSummary]);

  const busy = fetching || externalLoading;

  if (busy) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative">
          <Sparkles className="w-8 h-8 text-c-accent absolute -top-2 -right-2 animate-pulse" />
          <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
        </div>
        <p className="text-sm text-c-text-secondary">
          {isPl ? 'Analizuję definicję raportu...' : 'Analyzing your report definition...'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-sm text-danger-500 dark:text-danger-400">{error}</p>
        <button
          onClick={() => {
            setFetching(true);
            setError(null);
            Api.post(`/report-builder/${reportId}/propose-outline`, { intent })
              .then((res: any) =>
                setSections(res?.sections ?? res?.variants?.[0]?.sections ?? res?.outline ?? [])
              )
              .catch(() =>
                setError(
                  isPl
                    ? 'Nie udało się pobrać propozycji struktury.'
                    : 'Failed to fetch outline proposal.'
                )
              )
              .finally(() => setFetching(false));
          }}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-c-text hover:bg-blue-700 transition-colors"
        >
          {isPl ? 'Spróbuj ponownie' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-c-accent-soft flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-c-accent" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-c-text">
            {isPl ? 'Propozycja struktury AI' : 'AI Outline Proposal'}
          </h3>
          <p className="text-sm text-c-text-secondary">
            {isPl
              ? 'Przejrzyj i dostosuj proponowane sekcje raportu'
              : 'Review and customize the proposed report sections'}
          </p>
        </div>
      </div>

      {/* Section list */}
      <div className="space-y-3">
        {sections.map((section, idx) => (
          <div
            key={section.key}
            className="group flex items-start gap-3 p-4 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
          >
            {/* Drag handle (visual) */}
            <div className="pt-1 cursor-grab text-c-text-secondary group-hover:text-c-text-muted">
              <GripVertical className="w-5 h-5" />
            </div>

            {/* Index */}
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-c-surface-raised flex items-center justify-center text-xs font-semibold text-c-text-secondary">
              {idx + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              <input
                type="text"
                value={section.title}
                onChange={(e) => updateTitle(section.key, e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-c-text border-b border-transparent hover:border-c-border-subtle focus:border-blue-500 focus:outline-none transition-colors pb-0.5"
              />
              <p className="text-xs text-c-text-secondary leading-relaxed">{section.summary}</p>
              <div className="flex items-center gap-2 pt-1">
                {section.required && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
                    {isPl ? 'Wymagana' : 'Required'}
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${lengthBadgeClasses[section.defaultLength] || ''}`}
                >
                  {section.defaultLength}
                </span>
              </div>
            </div>

            {/* Remove */}
            <button
              onClick={() => removeSection(section.key)}
              disabled={section.required}
              className={`flex-shrink-0 p-1.5 rounded-md transition-colors ${
                section.required
                  ? 'text-c-text-secondary cursor-not-allowed'
                  : 'text-c-text-secondary hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20'
              }`}
              title={
                section.required
                  ? isPl
                    ? 'Sekcja wymagana'
                    : 'Required section'
                  : isPl
                    ? 'Usuń sekcję'
                    : 'Remove section'
              }
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add section */}
      {addingSection ? (
        <div className="p-4 rounded-lg border border-dashed border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10 space-y-3">
          <input
            type="text"
            placeholder={isPl ? 'Tytuł sekcji' : 'Section title'}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 text-sm border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder={isPl ? 'Krótki opis (opcjonalnie)' : 'Brief description (optional)'}
            value={newSummary}
            onChange={(e) => setNewSummary(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={addSection}
              disabled={!newTitle.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-c-text hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPl ? 'Dodaj' : 'Add'}
            </button>
            <button
              onClick={() => {
                setAddingSection(false);
                setNewTitle('');
                setNewSummary('');
              }}
              className="px-4 py-2 text-sm rounded-lg text-c-text-secondary hover:bg-c-surface-raised transition-colors"
            >
              {isPl ? 'Anuluj' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingSection(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-c-border-subtle text-sm text-c-text-secondary hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {isPl ? 'Dodaj sekcję' : 'Add section'}
        </button>
      )}

      {/* Accept */}
      <div className="pt-4 border-t border-c-border-subtle">
        <button
          onClick={() => onAcceptOutline(sections)}
          disabled={sections.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-c-text font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-5 h-5" />
          {isPl ? 'Zaakceptuj strukturę' : 'Accept Outline'}
        </button>
      </div>
    </div>
  );
};
