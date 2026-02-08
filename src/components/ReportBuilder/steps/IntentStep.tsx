/**
 * IntentStep
 *
 * Step 1 (Gate): Collect report intent and context BEFORE writing.
 * Includes source selection + report metadata + generation intent parameters.
 */

import { FileText, Loader2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import type { ReportSourceType, SourceOption } from '../useReportBuilder';
import { SourceSelectStep } from './SourceSelectStep';

export type ReportAudience = 'executive' | 'it' | 'operations' | 'mixed';
export type ReportGoal = 'diagnosis' | 'roadmap' | 'investment_decision' | 'stakeholder_update';
export type ReportLanguageCode = 'pl' | 'en';
export type ReportTone = 'consulting' | 'neutral' | 'decisive';
export type ReportScope = 'full' | 'executive' | 'focused';

// New style parameters for controlling generation verbosity
export type VerbosityLevel = 'concise' | 'standard' | 'detailed' | 'comprehensive';
export type WritingStyle = 'formal' | 'professional' | 'consultative' | 'persuasive';
export type IllustrationLevel = 'minimal' | 'moderate' | 'extensive';

export interface ReportIntent {
  audience: ReportAudience;
  goal: ReportGoal;
  language: ReportLanguageCode;
  tone: ReportTone;
  scope: ReportScope;
  focusedAxes?: string[];
  visuals?: {
    assessmentMatrix?: boolean;
  };
  profileId?: string;
  // Style parameters
  verbosity?: VerbosityLevel;
  writingStyle?: WritingStyle;
  illustrationLevel?: IllustrationLevel;
  useMetrics?: boolean;
  includeReferences?: boolean;
}

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
  defaultIntent?: {
    audience?: string;
    goal?: string;
    tone?: string;
    scope?: string;
  };
}

interface IntentStepProps {
  sourceType: ReportSourceType | null;
  selectedSource: SourceOption | null;
  reportTitle: string;
  reportDescription: string;
  intent: ReportIntent;
  onSourceTypeChange: (type: ReportSourceType | null) => void;
  onSourceSelect: (source: SourceOption | null) => void;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onIntentChange: (patch: Partial<ReportIntent>) => void;
  fetchSources: (type: ReportSourceType) => Promise<SourceOption[]>;
  isLoading: boolean;
}

export const IntentStep: React.FC<IntentStepProps> = (props) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const { sourceType, intent, onIntentChange } = props;

  const [profiles, setProfiles] = useState<InvocationProfile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  // Load profiles when source type changes
  useEffect(() => {
    if (sourceType) {
      setIsLoadingProfiles(true);
      Api.get(`/report-builder/profiles/for-source/${sourceType}`)
        .then((res) => {
          setProfiles(res?.profiles || []);
          // Auto-select first profile if none selected
          if (!intent.profileId && res?.profiles?.length > 0) {
            const defaultProfile = res.profiles[0];
            onIntentChange({
              profileId: defaultProfile.id,
              ...(defaultProfile.defaultIntent || {}),
            });
          }
        })
        .catch(() => setProfiles([]))
        .finally(() => setIsLoadingProfiles(false));
    }
  }, [sourceType]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedProfile = profiles.find((p) => p.id === intent.profileId);

  const axisOptions = useMemo(
    () => [
      { id: '1', label: isPl ? 'Oś 1' : 'Axis 1' },
      { id: '2', label: isPl ? 'Oś 2' : 'Axis 2' },
      { id: '3', label: isPl ? 'Oś 3' : 'Axis 3' },
      { id: '4', label: isPl ? 'Oś 4' : 'Axis 4' },
      { id: '5', label: isPl ? 'Oś 5' : 'Axis 5' },
      { id: '6', label: isPl ? 'Oś 6' : 'Axis 6' },
      { id: '7', label: isPl ? 'Oś 7' : 'Axis 7' },
    ],
    [isPl]
  );

  const toggleAxis = (axisId: string) => {
    const current = new Set(intent.focusedAxes || []);
    if (current.has(axisId)) current.delete(axisId);
    else current.add(axisId);
    onIntentChange({ focusedAxes: Array.from(current) });
  };

  const handleProfileSelect = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (profile) {
      const defaultIntent = (profile.defaultIntent || {}) as unknown as Partial<ReportIntent>;
      onIntentChange({
        profileId,
        ...defaultIntent,
      });
    }
  };

  return (
    <div className="space-y-10">
      {/* Source + title/description */}
      <SourceSelectStep {...props} />

      {/* Profile Selection */}
      {sourceType && profiles.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-8 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isPl ? 'Typ raportu' : 'Report Type'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isPl
                ? 'Wybierz szablon raportu dopasowany do Twoich potrzeb'
                : 'Choose a report template that fits your needs'}
            </p>
          </div>

          {isLoadingProfiles ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => handleProfileSelect(profile.id)}
                  className={`
                    p-4 rounded-lg border text-left transition-all
                    ${
                      intent.profileId === profile.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`
                      w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                      ${
                        intent.profileId === profile.id
                          ? 'bg-blue-100 dark:bg-blue-900/50'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }
                    `}
                    >
                      <FileText
                        className={`w-5 h-5 ${
                          intent.profileId === profile.id ? 'text-blue-600' : 'text-slate-500'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {isPl ? profile.namePl : profile.name}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {isPl ? profile.descriptionPl : profile.description}
                      </div>
                      {/* Feature badges */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {profile.features.allowMatrixVisualization && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                            {isPl ? 'Macierz' : 'Matrix'}
                          </span>
                        )}
                        {profile.features.allowCustomSections && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                            {isPl ? 'Własne sekcje' : 'Custom sections'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Intent parameters */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-8 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isPl ? 'Parametry raportu (wymagane)' : 'Report intent (required)'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isPl
              ? 'Te ustawienia są zbierane przed generowaniem i sterują strukturą oraz treścią raportu.'
              : 'These settings are captured before generation and drive report structure and content.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Audience */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isPl ? 'Odbiorca' : 'Audience'}
            </label>
            <select
              value={intent.audience}
              onChange={(e) => onIntentChange({ audience: e.target.value as any })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="executive">{isPl ? 'Zarząd / C-level' : 'Executive / C-level'}</option>
              <option value="it">{isPl ? 'IT / Engineering' : 'IT / Engineering'}</option>
              <option value="operations">{isPl ? 'Operacje' : 'Operations'}</option>
              <option value="mixed">{isPl ? 'Mieszany' : 'Mixed'}</option>
            </select>
          </div>

          {/* Goal */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isPl ? 'Cel raportu' : 'Goal'}
            </label>
            <select
              value={intent.goal}
              onChange={(e) => onIntentChange({ goal: e.target.value as any })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="diagnosis">{isPl ? 'Diagnoza' : 'Diagnosis'}</option>
              <option value="roadmap">
                {isPl ? 'Roadmap / plan działań' : 'Roadmap / action plan'}
              </option>
              <option value="investment_decision">
                {isPl ? 'Decyzja inwestycyjna' : 'Investment decision'}
              </option>
              <option value="stakeholder_update">
                {isPl ? 'Komunikacja do interesariuszy' : 'Stakeholder update'}
              </option>
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isPl ? 'Język raportu' : 'Report language'}
            </label>
            <select
              value={intent.language}
              onChange={(e) => onIntentChange({ language: e.target.value as any })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="pl">PL</option>
              <option value="en">EN</option>
            </select>
          </div>

          {/* Tone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isPl ? 'Ton' : 'Tone'}
            </label>
            <select
              value={intent.tone}
              onChange={(e) => onIntentChange({ tone: e.target.value as any })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="consulting">{isPl ? 'Konsultingowy' : 'Consulting'}</option>
              <option value="neutral">{isPl ? 'Neutralny' : 'Neutral'}</option>
              <option value="decisive">{isPl ? 'Decyzyjny' : 'Decisive'}</option>
            </select>
          </div>

          {/* Scope */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isPl ? 'Zakres' : 'Scope'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'full', label: isPl ? 'Pełny' : 'Full' },
                { id: 'executive', label: isPl ? 'Executive' : 'Executive' },
                { id: 'focused', label: isPl ? 'Wybrany' : 'Focused' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onIntentChange({ scope: opt.id as any })}
                  className={`
                    p-3 rounded-lg border text-center transition-all
                    ${
                      intent.scope === opt.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                    }
                  `}
                >
                  <div className="font-medium text-sm text-slate-900 dark:text-white">
                    {opt.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Focused axes */}
          {intent.scope === 'focused' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {isPl ? 'Wybierz osie' : 'Select axes'}
              </label>
              <div className="flex flex-wrap gap-2">
                {axisOptions.map((ax) => {
                  const selected = (intent.focusedAxes || []).includes(ax.id);
                  return (
                    <button
                      key={ax.id}
                      onClick={() => toggleAxis(ax.id)}
                      className={`
                        px-3 py-1.5 rounded-full border text-sm transition-all
                        ${
                          selected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-200'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'
                        }
                      `}
                    >
                      {ax.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Visuals */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isPl ? 'Wizualizacje' : 'Visuals'}
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(intent.visuals?.assessmentMatrix)}
                onChange={(e) =>
                  onIntentChange({
                    visuals: { ...(intent.visuals || {}), assessmentMatrix: e.target.checked },
                  })
                }
              />
              {isPl ? 'Dodaj macierz oceny (DRD)' : 'Include assessment matrix (DRD)'}
            </label>
          </div>
        </div>
      </div>

      {/* Style & Verbosity Settings */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-8 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isPl ? 'Styl generowania treści' : 'Content Generation Style'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isPl
              ? 'Te ustawienia kontrolują szczegółowość i styl generowanego tekstu'
              : 'These settings control the detail level and style of generated content'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Verbosity */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isPl ? 'Szczegółowość' : 'Verbosity'}
            </label>
            <select
              value={intent.verbosity || 'standard'}
              onChange={(e) => onIntentChange({ verbosity: e.target.value as VerbosityLevel })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="concise">{isPl ? 'Zwięzły' : 'Concise'}</option>
              <option value="standard">{isPl ? 'Standardowy' : 'Standard'}</option>
              <option value="detailed">{isPl ? 'Szczegółowy' : 'Detailed'}</option>
              <option value="comprehensive">{isPl ? 'Wyczerpujący' : 'Comprehensive'}</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              {intent.verbosity === 'comprehensive' &&
                (isPl
                  ? 'Maksymalizuje ilość tekstu i szczegółów'
                  : 'Maximizes content detail and length')}
              {intent.verbosity === 'detailed' &&
                (isPl ? 'Obszerny z wieloma szczegółami' : 'Thorough with extensive details')}
              {intent.verbosity === 'standard' &&
                (isPl ? 'Zbalansowane podejście' : 'Balanced approach')}
              {(intent.verbosity === 'concise' || !intent.verbosity) &&
                (isPl ? 'Skondensowany, tylko kluczowe punkty' : 'Condensed, key points only')}
            </p>
          </div>

          {/* Writing Style */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isPl ? 'Styl pisania' : 'Writing Style'}
            </label>
            <select
              value={intent.writingStyle || 'professional'}
              onChange={(e) => onIntentChange({ writingStyle: e.target.value as WritingStyle })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="formal">{isPl ? 'Formalny' : 'Formal'}</option>
              <option value="professional">{isPl ? 'Profesjonalny' : 'Professional'}</option>
              <option value="consultative">{isPl ? 'Doradczy' : 'Consultative'}</option>
              <option value="persuasive">{isPl ? 'Perswazyjny' : 'Persuasive'}</option>
            </select>
          </div>

          {/* Illustration Level */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isPl ? 'Przykłady' : 'Examples'}
            </label>
            <select
              value={intent.illustrationLevel || 'moderate'}
              onChange={(e) =>
                onIntentChange({ illustrationLevel: e.target.value as IllustrationLevel })
              }
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="minimal">{isPl ? 'Minimalne' : 'Minimal'}</option>
              <option value="moderate">{isPl ? 'Umiarkowane' : 'Moderate'}</option>
              <option value="extensive">{isPl ? 'Rozbudowane' : 'Extensive'}</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              {intent.illustrationLevel === 'extensive' &&
                (isPl ? 'Wiele przykładów i case studies' : 'Many examples and case studies')}
            </p>
          </div>
        </div>

        {/* Additional options */}
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(intent.useMetrics)}
              onChange={(e) => onIntentChange({ useMetrics: e.target.checked })}
              className="rounded border-slate-300"
            />
            {isPl ? 'Używaj metryk i danych liczbowych' : 'Use metrics and quantitative data'}
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(intent.includeReferences)}
              onChange={(e) => onIntentChange({ includeReferences: e.target.checked })}
              className="rounded border-slate-300"
            />
            {isPl
              ? 'Dodaj odniesienia do standardów branżowych'
              : 'Include industry standard references'}
          </label>
        </div>
      </div>
    </div>
  );
};
