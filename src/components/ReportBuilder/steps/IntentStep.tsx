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
  const { t, i18n } = useTranslation();
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
        label: t('reportBuilder.intentStep.axisN', {
          defaultValue: `Axis ${i + 1}`,
          number: i + 1,
        }),
      })),
    [t]
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
            {t('reportBuilder.intentStep.reportType', 'Report Type')}
          </h3>
          <p className="text-sm text-c-text-secondary mt-1">
            {t('reportBuilder.intentStep.chooseACanonicalReportTypeR1', 'Choose a canonical report type (R1-R4) or create a custom report')}
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
                      selected ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-c-surface-raised'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${selected ? 'text-blue-600' : 'text-c-text-secondary'}`}
                    />
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
              {t('reportBuilder.intentStep.invocationProfile', 'Invocation Profile')}
            </h3>
            <p className="text-sm text-c-text-secondary mt-1">
              {t('reportBuilder.intentStep.optionallySelectAGenerationTemplateTailored', 'Optionally select a generation template tailored to your source')}
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
                            {t('reportBuilder.intentStep.matrix', 'Matrix')}
                          </span>
                        )}
                        {profile.features.allowCustomSections && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                            {t('reportBuilder.intentStep.customSections', 'Custom sections')}
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
            {t('reportBuilder.intentStep.reportDefinition', 'Report Definition')}
          </h3>
          <p className="text-sm text-c-text-secondary mt-1">
            {t('reportBuilder.intentStep.theseParametersControlTheStructureStyle', 'These parameters control the structure, style, and content of the report')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Goal V3 */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {t('reportBuilder.intentStep.reportGoal', 'Report Goal')}
            </label>
            <select
              value={intent.goalV3 || 'inform'}
              onChange={(e) => onIntentChange({ goalV3: e.target.value as GoalV3 })}
              className={selectClasses}
            >
              <option value="inform">{t('reportBuilder.intentStep.inform', 'Inform')}</option>
              <option value="decide">{t('reportBuilder.intentStep.supportDecision', 'Support Decision')}</option>
              <option value="sell">{t('reportBuilder.intentStep.sellConvince', 'Sell / Convince')}</option>
              <option value="align">{t('reportBuilder.intentStep.alignStakeholders', 'Align Stakeholders')}</option>
            </select>
          </div>

          {/* Communication Register */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {t('reportBuilder.intentStep.communicationRegister', 'Communication Register')}
            </label>
            <select
              value={intent.communicationRegister || 'professional'}
              onChange={(e) =>
                onIntentChange({ communicationRegister: e.target.value as CommunicationRegister })
              }
              className={selectClasses}
            >
              <option value="executive">{t('reportBuilder.intentStep.executive', 'Executive')}</option>
              <option value="professional">{t('reportBuilder.intentStep.professional', 'Professional')}</option>
              <option value="technical">{t('reportBuilder.intentStep.technical', 'Technical')}</option>
              <option value="narrative">{t('reportBuilder.intentStep.narrative', 'Narrative')}</option>
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {t('reportBuilder.intentStep.reportLanguage', 'Report Language')}
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
              {t('reportBuilder.intentStep.contentDensity', 'Content Density')}
            </label>
            <select
              value={intent.density || 'standard'}
              onChange={(e) => onIntentChange({ density: e.target.value as ReportDensity })}
              className={selectClasses}
            >
              <option value="concise">{t('reportBuilder.intentStep.concise', 'Concise')}</option>
              <option value="standard">{t('reportBuilder.intentStep.standard', 'Standard')}</option>
              <option value="detailed">{t('reportBuilder.intentStep.detailed', 'Detailed')}</option>
              <option value="comprehensive">{t('reportBuilder.intentStep.comprehensive', 'Comprehensive')}</option>
            </select>
          </div>

          {/* Form */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {t('reportBuilder.intentStep.reportForm', 'Report Form')}
            </label>
            <select
              value={intent.form || 'strategic'}
              onChange={(e) => onIntentChange({ form: e.target.value as ReportForm })}
              className={selectClasses}
            >
              <option value="strategic">{t('reportBuilder.intentStep.strategic', 'Strategic')}</option>
              <option value="operational">{t('reportBuilder.intentStep.operational', 'Operational')}</option>
              <option value="technical">{t('reportBuilder.intentStep.technical', 'Technical')}</option>
              <option value="investment">{t('reportBuilder.intentStep.investment', 'Investment')}</option>
            </select>
          </div>

          {/* Data Level */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {t('reportBuilder.intentStep.dataLevel', 'Data Level')}
            </label>
            <select
              value={intent.dataLevel || 'balanced'}
              onChange={(e) => onIntentChange({ dataLevel: e.target.value as DataLevel })}
              className={selectClasses}
            >
              <option value="data-heavy">{t('reportBuilder.intentStep.dataHeavy', 'Data-heavy')}</option>
              <option value="balanced">{t('reportBuilder.intentStep.balanced', 'Balanced')}</option>
              <option value="narrative-heavy">{t('reportBuilder.intentStep.narrativeHeavy', 'Narrative-heavy')}</option>
            </select>
          </div>

          {/* Period */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              <CalendarRange className="inline w-4 h-4 mr-1 -mt-0.5" />
              {t('reportBuilder.intentStep.periodFrom', 'Period From')}
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
              {t('reportBuilder.intentStep.periodTo', 'Period To')}
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
              {t('reportBuilder.intentStep.confidentiality', 'Confidentiality')}
            </label>
            <select
              value={intent.confidentiality || 'internal'}
              onChange={(e) =>
                onIntentChange({ confidentiality: e.target.value as Confidentiality })
              }
              className={selectClasses}
            >
              <option value="confidential">
                {t('reportBuilder.intentStep.confidential', 'Confidential')}
              </option>
              <option value="internal">{t('reportBuilder.intentStep.internal', 'Internal')}</option>
              <option value="public">{t('reportBuilder.intentStep.public', 'Public')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Legacy intent parameters (Audience, Tone, Scope) ── */}
      <div className="border-t border-c-border-subtle pt-8 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-c-text">
            {t('reportBuilder.intentStep.advancedParameters', 'Advanced Parameters')}
          </h3>
          <p className="text-sm text-c-text-secondary mt-1">
            {t('reportBuilder.intentStep.additionalSettingsControllingContentGeneration', 'Additional settings controlling content generation')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Audience */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {t('reportBuilder.intentStep.audience', 'Audience')}
            </label>
            <select
              value={intent.audience}
              onChange={(e) => onIntentChange({ audience: e.target.value as any })}
              className={selectClasses}
            >
              <option value="executive">{t('reportBuilder.intentStep.executiveCLevel', 'Executive / C-level')}</option>
              <option value="it">{t('reportBuilder.intentStep.itEngineering', 'IT / Engineering')}</option>
              <option value="operations">{t('reportBuilder.intentStep.operations', 'Operations')}</option>
              <option value="mixed">{t('reportBuilder.intentStep.mixed', 'Mixed')}</option>
            </select>
          </div>

          {/* Tone */}
          <div>
            <label className="block text-sm font-medium text-c-text mb-1">
              {t('reportBuilder.intentStep.tone', 'Tone')}
            </label>
            <select
              value={intent.tone}
              onChange={(e) => onIntentChange({ tone: e.target.value as any })}
              className={selectClasses}
            >
              <option value="consulting">{t('reportBuilder.intentStep.consulting', 'Consulting')}</option>
              <option value="neutral">{t('reportBuilder.intentStep.neutral', 'Neutral')}</option>
              <option value="decisive">{t('reportBuilder.intentStep.decisive', 'Decisive')}</option>
            </select>
          </div>

          {/* Scope */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-c-text mb-2">
              {t('reportBuilder.intentStep.scope', 'Scope')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'full', label: t('reportBuilder.intentStep.full', 'Full') },
                { id: 'executive', label: t('reportBuilder.intentStep.executive', 'Executive') },
                { id: 'focused', label: t('reportBuilder.intentStep.focused', 'Focused') },
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
                  <div className="font-medium text-sm text-c-text">{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {intent.scope === 'focused' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-c-text mb-2">
                {t('reportBuilder.intentStep.selectAxes', 'Select axes')}
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
              {t('reportBuilder.intentStep.visuals', 'Visuals')}
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
              {t('reportBuilder.intentStep.includeAssessmentMatrixDrd', 'Include assessment matrix (DRD)')}
            </label>
          </div>
        </div>
      </div>

      {/* Style & Verbosity */}
      <div className="border-t border-c-border-subtle pt-8 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-c-text">
            {t('reportBuilder.intentStep.contentGenerationStyle', 'Content Generation Style')}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium text-c-text mb-2">
              {t('reportBuilder.intentStep.writingStyle', 'Writing Style')}
            </label>
            <select
              value={intent.writingStyle || 'professional'}
              onChange={(e) => onIntentChange({ writingStyle: e.target.value as WritingStyle })}
              className={selectClasses}
            >
              <option value="formal">{t('reportBuilder.intentStep.formal', 'Formal')}</option>
              <option value="professional">{t('reportBuilder.intentStep.professional', 'Professional')}</option>
              <option value="consultative">{t('reportBuilder.intentStep.consultative', 'Consultative')}</option>
              <option value="persuasive">{t('reportBuilder.intentStep.persuasive', 'Persuasive')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text mb-2">
              {t('reportBuilder.intentStep.examples', 'Examples')}
            </label>
            <select
              value={intent.illustrationLevel || 'moderate'}
              onChange={(e) =>
                onIntentChange({ illustrationLevel: e.target.value as IllustrationLevel })
              }
              className={selectClasses}
            >
              <option value="minimal">{t('reportBuilder.intentStep.minimal', 'Minimal')}</option>
              <option value="moderate">{t('reportBuilder.intentStep.moderate', 'Moderate')}</option>
              <option value="extensive">{t('reportBuilder.intentStep.extensive', 'Extensive')}</option>
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
              {t('reportBuilder.intentStep.useMetrics', 'Use metrics')}
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-c-text">
              <input
                type="checkbox"
                checked={Boolean(intent.includeReferences)}
                onChange={(e) => onIntentChange({ includeReferences: e.target.checked })}
                className="rounded border-c-border-subtle"
              />
              {t('reportBuilder.intentStep.industryReferences', 'Industry references')}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
