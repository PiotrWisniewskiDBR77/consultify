/**
 * IntentStep V3
 *
 * Report Definition Layer: collects report type (R1-R4/custom), intent, and context
 * BEFORE writing. Supports both canonical (Path A) and free (Path B) flows.
 */

import {
  BarChart3,
  CalendarRange,
  FileText,
  LayoutDashboard,
  Loader2,
  Lock,
  Shield,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import type {
  CommunicationRegister,
  Confidentiality,
  DataLevel,
  GoalV3,
  ReportDensity,
  ReportForm,
  ReportSourceType,
  ReportTypeV3,
  SourceOption,
} from '../useReportBuilder';
import { SourceSelectStep } from './SourceSelectStep';

export type ReportAudience = 'executive' | 'it' | 'operations' | 'mixed';
export type ReportGoal = 'diagnosis' | 'roadmap' | 'investment_decision' | 'stakeholder_update';
export type ReportLanguageCode = 'pl' | 'en';
export type ReportTone = 'consulting' | 'neutral' | 'decisive';
export type ReportScope = 'full' | 'executive' | 'focused';

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
  visuals?: { assessmentMatrix?: boolean };
  profileId?: string;
  verbosity?: VerbosityLevel;
  writingStyle?: WritingStyle;
  illustrationLevel?: IllustrationLevel;
  useMetrics?: boolean;
  includeReferences?: boolean;
  // V3 Report Definition Layer
  reportTypeV3?: ReportTypeV3;
  goalV3?: GoalV3;
  communicationRegister?: CommunicationRegister;
  density?: ReportDensity;
  form?: ReportForm;
  dataLevel?: DataLevel;
  confidentiality?: Confidentiality;
  periodFrom?: string;
  periodTo?: string;
  themeId?: string;
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

const REPORT_TYPE_V3_OPTIONS: Array<{
  id: ReportTypeV3;
  icon: React.ElementType;
  labelEn: string;
  labelPl: string;
  descEn: string;
  descPl: string;
  frequency: string;
}> = [
  {
    id: 'R1',
    icon: LayoutDashboard,
    labelEn: 'R1 — Weekly Execution',
    labelPl: 'R1 — Tygodniowy raport realizacji',
    descEn: 'Operational control of initiative execution for PMO / Project Team',
    descPl: 'Kontrola operacyjna realizacji inicjatyw dla PMO / Zespołu Projektowego',
    frequency: 'Weekly',
  },
  {
    id: 'R2',
    icon: Users,
    labelEn: 'R2 — Steering Committee',
    labelPl: 'R2 — Komitet Sterujący',
    descEn: 'Strategic oversight & decision-making for Sponsors / Board',
    descPl: 'Nadzór strategiczny i podejmowanie decyzji dla Sponsorów / Zarządu',
    frequency: 'Monthly',
  },
  {
    id: 'R3',
    icon: TrendingUp,
    labelEn: 'R3 — Benefits Tracking',
    labelPl: 'R3 — Śledzenie korzyści',
    descEn: 'Verify delivered initiatives produce business value',
    descPl: 'Weryfikacja, czy dostarczone inicjatywy przynoszą wartość biznesową',
    frequency: 'Quarterly',
  },
  {
    id: 'R4',
    icon: BarChart3,
    labelEn: 'R4 — Portfolio Overview',
    labelPl: 'R4 — Przegląd portfela',
    descEn: 'High-level view of transformation portfolio for Executives',
    descPl: 'Widok portfela transformacyjnego dla kadry zarządzającej',
    frequency: 'On-demand',
  },
  {
    id: 'custom',
    icon: FileText,
    labelEn: 'Custom Report',
    labelPl: 'Raport własny',
    descEn: 'Free-form report with AI-proposed outline',
    descPl: 'Raport dowolny z proponowaną strukturą AI',
    frequency: '',
  },
];

const selectClasses =
  'w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text focus:ring-2 focus:ring-blue-500 text-sm';

export const IntentStep: React.FC<IntentStepProps> = (props) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const { sourceType, intent, onIntentChange } = props;

  const [profiles, setProfiles] = useState<InvocationProfile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  useEffect(() => {
    if (sourceType) {
      setIsLoadingProfiles(true);
      Api.get(`/report-builder/profiles/for-source/${sourceType}`)
        .then((res) => {
          setProfiles(res?.profiles || []);
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
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        id: String(i + 1),
        label: isPl ? `Oś ${i + 1}` : `Axis ${i + 1}`,
      })),
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
      onIntentChange({ profileId, ...(profile.defaultIntent || {}) } as Partial<ReportIntent>);
    }
  };

  const reportTypeV3 = intent.reportTypeV3 || 'custom';
  const isCanonical = reportTypeV3 !== 'custom';

  return (
    <div className="space-y-10">
      {/* Source + title/description */}
      <SourceSelectStep {...props} />

      {/* ── V3: Report Type Selection ── */}
      <div className="border-t border-c-border-subtle pt-8 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-c-text">
            {isPl ? 'Typ raportu' : 'Report Type'}
          </h3>
          <p className="text-sm text-c-text-secondary mt-1">
            {isPl
              ? 'Wybierz kanoniczny typ raportowy (R1-R4) lub stwórz własny raport'
              : 'Choose a canonical report type (R1-R4) or create a custom report'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {REPORT_TYPE_V3_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = reportTypeV3 === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onIntentChange({ reportTypeV3: opt.id })}
                className={`
                  p-4 rounded-lg border text-left transition-all
                  ${
                    selected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                      : 'border-c-border-subtle hover:border-blue-300 hover:bg-c-surface-raised'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      selected
                        ? 'bg-blue-100 dark:bg-blue-900/50'
                        : 'bg-c-surface-raised'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${selected ? 'text-blue-600' : 'text-c-text-secondary'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-c-text text-sm">
                      {isPl ? opt.labelPl : opt.labelEn}
                    </div>
                    <div className="text-xs text-c-text-secondary mt-0.5">
                      {isPl ? opt.descPl : opt.descEn}
                    </div>
                    {opt.frequency && (
                      <span className="inline-block mt-1.5 text-xs px-2 py-0.5 bg-c-surface-raised text-c-text-secondary rounded">
                        {opt.frequency}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Legacy profile selection (only for custom + source-based) ── */}
      {reportTypeV3 === 'custom' && sourceType && profiles.length > 0 && (
        <div className="border-t border-c-border-subtle pt-8 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-c-text">
              {isPl ? 'Profil inwokacji' : 'Invocation Profile'}
            </h3>
            <p className="text-sm text-c-text-secondary mt-1">
              {isPl
                ? 'Opcjonalnie wybierz szablon generowania dopasowany do źródła'
                : 'Optionally select a generation template tailored to your source'}
            </p>
          </div>

          {isLoadingProfiles ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-c-text-secondary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => handleProfileSelect(profile.id)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    intent.profileId === profile.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                      : 'border-c-border-subtle hover:border-blue-300 hover:bg-c-surface-raised'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        intent.profileId === profile.id
                          ? 'bg-blue-100 dark:bg-blue-900/50'
                          : 'bg-c-surface-raised'
                      }`}
                    >
                      <FileText
                        className={`w-5 h-5 ${intent.profileId === profile.id ? 'text-blue-600' : 'text-c-text-secondary'}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-c-text">
                        {isPl ? profile.namePl : profile.name}
                      </div>
                      <div className="text-sm text-c-text-secondary mt-0.5">
                        {isPl ? profile.descriptionPl : profile.description}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {profile.features.allowMatrixVisualization && (
                          <span className="text-xs px-2 py-0.5 bg-c-accent-soft text-c-accent rounded">
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

      {/* ── V3 Report Definition Layer ── */}
      <div className="border-t border-c-border-subtle pt-8 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-c-text">
            {isPl ? 'Definicja raportu' : 'Report Definition'}
          </h3>
          <p className="text-sm text-c-text-secondary mt-1">
            {isPl
              ? 'Te parametry sterują strukturą, stylem i treścią raportu'
              : 'These parameters control the structure, style, and content of the report'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Goal V3 */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {isPl ? 'Cel raportu' : 'Report Goal'}
            </label>
            <select
              value={intent.goalV3 || 'inform'}
              onChange={(e) => onIntentChange({ goalV3: e.target.value as GoalV3 })}
              className={selectClasses}
            >
              <option value="inform">{isPl ? 'Informować' : 'Inform'}</option>
              <option value="decide">{isPl ? 'Wspierać decyzję' : 'Support Decision'}</option>
              <option value="sell">{isPl ? 'Sprzedać / przekonać' : 'Sell / Convince'}</option>
              <option value="align">{isPl ? 'Zgrać zespół' : 'Align Stakeholders'}</option>
            </select>
          </div>

          {/* Communication Register */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {isPl ? 'Rejestr komunikacji' : 'Communication Register'}
            </label>
            <select
              value={intent.communicationRegister || 'professional'}
              onChange={(e) =>
                onIntentChange({ communicationRegister: e.target.value as CommunicationRegister })
              }
              className={selectClasses}
            >
              <option value="executive">{isPl ? 'Executive' : 'Executive'}</option>
              <option value="professional">{isPl ? 'Profesjonalny' : 'Professional'}</option>
              <option value="technical">{isPl ? 'Techniczny' : 'Technical'}</option>
              <option value="narrative">{isPl ? 'Narracyjny' : 'Narrative'}</option>
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {isPl ? 'Język raportu' : 'Report Language'}
            </label>
            <select
              value={intent.language}
              onChange={(e) => onIntentChange({ language: e.target.value as any })}
              className={selectClasses}
            >
              <option value="pl">PL</option>
              <option value="en">EN</option>
            </select>
          </div>

          {/* Density */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {isPl ? 'Gęstość treści' : 'Content Density'}
            </label>
            <select
              value={intent.density || 'standard'}
              onChange={(e) => onIntentChange({ density: e.target.value as ReportDensity })}
              className={selectClasses}
            >
              <option value="concise">{isPl ? 'Zwięzły' : 'Concise'}</option>
              <option value="standard">{isPl ? 'Standardowy' : 'Standard'}</option>
              <option value="detailed">{isPl ? 'Szczegółowy' : 'Detailed'}</option>
              <option value="comprehensive">{isPl ? 'Wyczerpujący' : 'Comprehensive'}</option>
            </select>
          </div>

          {/* Form */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {isPl ? 'Forma raportu' : 'Report Form'}
            </label>
            <select
              value={intent.form || 'strategic'}
              onChange={(e) => onIntentChange({ form: e.target.value as ReportForm })}
              className={selectClasses}
            >
              <option value="strategic">{isPl ? 'Strategiczny' : 'Strategic'}</option>
              <option value="operational">{isPl ? 'Operacyjny' : 'Operational'}</option>
              <option value="technical">{isPl ? 'Techniczny' : 'Technical'}</option>
              <option value="investment">{isPl ? 'Inwestorski' : 'Investment'}</option>
            </select>
          </div>

          {/* Data Level */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {isPl ? 'Poziom danych' : 'Data Level'}
            </label>
            <select
              value={intent.dataLevel || 'balanced'}
              onChange={(e) => onIntentChange({ dataLevel: e.target.value as DataLevel })}
              className={selectClasses}
            >
              <option value="data-heavy">{isPl ? 'Dużo danych' : 'Data-heavy'}</option>
              <option value="balanced">{isPl ? 'Zbalansowany' : 'Balanced'}</option>
              <option value="narrative-heavy">{isPl ? 'Narracyjny' : 'Narrative-heavy'}</option>
            </select>
          </div>

          {/* Period */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              <CalendarRange className="inline w-4 h-4 mr-1 -mt-0.5" />
              {isPl ? 'Okres od' : 'Period From'}
            </label>
            <input
              type="date"
              value={intent.periodFrom || ''}
              onChange={(e) => onIntentChange({ periodFrom: e.target.value })}
              className={selectClasses}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              <CalendarRange className="inline w-4 h-4 mr-1 -mt-0.5" />
              {isPl ? 'Okres do' : 'Period To'}
            </label>
            <input
              type="date"
              value={intent.periodTo || ''}
              onChange={(e) => onIntentChange({ periodTo: e.target.value })}
              className={selectClasses}
            />
          </div>

          {/* Confidentiality */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              <Shield className="inline w-4 h-4 mr-1 -mt-0.5" />
              {isPl ? 'Poufność' : 'Confidentiality'}
            </label>
            <select
              value={intent.confidentiality || 'internal'}
              onChange={(e) =>
                onIntentChange({ confidentiality: e.target.value as Confidentiality })
              }
              className={selectClasses}
            >
              <option value="confidential">
                {isPl ? 'Poufny (Confidential)' : 'Confidential'}
              </option>
              <option value="internal">{isPl ? 'Wewnętrzny (Internal)' : 'Internal'}</option>
              <option value="public">{isPl ? 'Publiczny (Public)' : 'Public'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Legacy intent parameters (Audience, Tone, Scope) ── */}
      <div className="border-t border-c-border-subtle pt-8 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-c-text">
            {isPl ? 'Zaawansowane parametry' : 'Advanced Parameters'}
          </h3>
          <p className="text-sm text-c-text-secondary mt-1">
            {isPl
              ? 'Dodatkowe ustawienia sterujące generowaniem treści'
              : 'Additional settings controlling content generation'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Audience */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {isPl ? 'Odbiorca' : 'Audience'}
            </label>
            <select
              value={intent.audience}
              onChange={(e) => onIntentChange({ audience: e.target.value as any })}
              className={selectClasses}
            >
              <option value="executive">{isPl ? 'Zarząd / C-level' : 'Executive / C-level'}</option>
              <option value="it">{isPl ? 'IT / Engineering' : 'IT / Engineering'}</option>
              <option value="operations">{isPl ? 'Operacje' : 'Operations'}</option>
              <option value="mixed">{isPl ? 'Mieszany' : 'Mixed'}</option>
            </select>
          </div>

          {/* Tone */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {isPl ? 'Ton' : 'Tone'}
            </label>
            <select
              value={intent.tone}
              onChange={(e) => onIntentChange({ tone: e.target.value as any })}
              className={selectClasses}
            >
              <option value="consulting">{isPl ? 'Konsultingowy' : 'Consulting'}</option>
              <option value="neutral">{isPl ? 'Neutralny' : 'Neutral'}</option>
              <option value="decisive">{isPl ? 'Decyzyjny' : 'Decisive'}</option>
            </select>
          </div>

          {/* Scope */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-c-text mb-2">
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
                  className={`p-3 rounded-lg border text-center transition-all ${
                    intent.scope === opt.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-c-border-subtle hover:border-blue-300'
                  }`}
                >
                  <div className="font-medium text-sm text-c-text">
                    {opt.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {intent.scope === 'focused' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-c-text mb-2">
                {isPl ? 'Wybierz osie' : 'Select axes'}
              </label>
              <div className="flex flex-wrap gap-2">
                {axisOptions.map((ax) => {
                  const selected = (intent.focusedAxes || []).includes(ax.id);
                  return (
                    <button
                      key={ax.id}
                      onClick={() => toggleAxis(ax.id)}
                      className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                        selected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-200'
                          : 'border-c-border-subtle text-c-text-secondary hover:border-blue-300'
                      }`}
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
            <label className="block text-sm font-medium text-c-text mb-2">
              {isPl ? 'Wizualizacje' : 'Visuals'}
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-c-text">
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

      {/* Style & Verbosity */}
      <div className="border-t border-c-border-subtle pt-8 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-c-text">
            {isPl ? 'Styl generowania treści' : 'Content Generation Style'}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium text-c-text mb-2">
              {isPl ? 'Styl pisania' : 'Writing Style'}
            </label>
            <select
              value={intent.writingStyle || 'professional'}
              onChange={(e) => onIntentChange({ writingStyle: e.target.value as WritingStyle })}
              className={selectClasses}
            >
              <option value="formal">{isPl ? 'Formalny' : 'Formal'}</option>
              <option value="professional">{isPl ? 'Profesjonalny' : 'Professional'}</option>
              <option value="consultative">{isPl ? 'Doradczy' : 'Consultative'}</option>
              <option value="persuasive">{isPl ? 'Perswazyjny' : 'Persuasive'}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text mb-2">
              {isPl ? 'Przykłady' : 'Examples'}
            </label>
            <select
              value={intent.illustrationLevel || 'moderate'}
              onChange={(e) =>
                onIntentChange({ illustrationLevel: e.target.value as IllustrationLevel })
              }
              className={selectClasses}
            >
              <option value="minimal">{isPl ? 'Minimalne' : 'Minimal'}</option>
              <option value="moderate">{isPl ? 'Umiarkowane' : 'Moderate'}</option>
              <option value="extensive">{isPl ? 'Rozbudowane' : 'Extensive'}</option>
            </select>
          </div>

          <div className="flex flex-col justify-end gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-c-text">
              <input
                type="checkbox"
                checked={Boolean(intent.useMetrics)}
                onChange={(e) => onIntentChange({ useMetrics: e.target.checked })}
                className="rounded border-c-border-subtle"
              />
              {isPl ? 'Metryki liczbowe' : 'Use metrics'}
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-c-text">
              <input
                type="checkbox"
                checked={Boolean(intent.includeReferences)}
                onChange={(e) => onIntentChange({ includeReferences: e.target.checked })}
                className="rounded border-c-border-subtle"
              />
              {isPl ? 'Standardy branżowe' : 'Industry references'}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
