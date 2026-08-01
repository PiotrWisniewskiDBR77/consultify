/**
 * SummaryStep - Final step for all tools
 *
 * Displays final source summary, insights, and recommended initiatives.
 */

import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Lightbulb,
  Presentation,
  Rocket,
  Shield,
  Target,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Api } from '@/services/api';
import {
  buildToolConclusionModel,
  extractToolConclusionFacts,
} from '@/services/report/toolConclusion';
import {
  GrowthPathsData,
  InitiativeDraft,
  PorterData,
  PortfolioPriorityData,
  ProposalCardType,
  RiskUncertaintyData,
  SWOTData,
  ToolSession,
  ToolType,
} from '@/store/useToolStore';

import { ProposalCard } from '../shared/ProposalCard';
import { PorterRadar } from '../visualizations/PorterRadar';
import { ToolConclusionSummary } from './ToolConclusionSummary';

// ==================== TYPES ====================

interface SummaryStepProps {
  toolType: ToolType;
  session: ToolSession;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
}

// ==================== INITIATIVE TYPE META ====================

const INITIATIVE_TYPE_META: Record<
  InitiativeDraft['type'],
  { label: { en: string; pl: string }; color: string; icon: typeof Rocket }
> = {
  strategic: {
    label: { en: 'Strategic', pl: 'Strategiczna' },
    color: 'text-primary-600 dark:text-primary-400',
    icon: Target,
  },
  operational: {
    label: { en: 'Operational', pl: 'Operacyjna' },
    color: 'text-blue-600 dark:text-blue-400',
    icon: Wrench,
  },
  defensive: {
    label: { en: 'Defensive', pl: 'Defensywna' },
    color: 'text-amber-600 dark:text-amber-400',
    icon: Shield,
  },
  growth: {
    label: { en: 'Growth', pl: 'Wzrostowa' },
    color: 'text-emerald-600 dark:text-emerald-400',
    icon: Rocket,
  },
};

type InitiativeAction = 'develop' | 'defer' | 'idea';

// ==================== SECTION HEADER ====================

function SectionHeader({
  title,
  badge,
  description,
  children,
}: {
  title: string;
  badge: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between border-b border-slate-200/60 px-6 py-4 dark:border-navy-700/50">
      <div className="min-w-0 flex-1">
        {children || (
          <>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </>
        )}
      </div>
      <span className="ml-4 flex-shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:border-navy-600 dark:bg-navy-800 dark:text-slate-400">
        {badge}
      </span>
    </div>
  );
}

// ==================== CONTENT SELECTOR ====================

interface ContentSection {
  id: string;
  label: string;
  description: string;
  available: boolean;
  itemCount: number;
}

function ContentSelector({
  sections,
  selected,
  onToggle,
}: {
  sections: ContentSection[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  isPolish: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {t('discoveryToolsSteps.summaryStep.selectContent')}
      </div>
      {sections.map((s) => (
        <label
          key={s.id}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
            !s.available
              ? 'cursor-not-allowed border-slate-200 bg-slate-50/30 opacity-50 dark:border-navy-800 dark:bg-navy-950/20'
              : selected.has(s.id)
                ? 'border-primary-300 bg-primary-50/40 dark:border-primary-800 dark:bg-primary-950/20'
                : 'border-slate-200/60 bg-white/60 hover:border-slate-300 dark:border-navy-700/50 dark:bg-navy-950/30 dark:hover:border-navy-600'
          }`}
        >
          <input
            type="checkbox"
            checked={selected.has(s.id)}
            onChange={() => s.available && onToggle(s.id)}
            disabled={!s.available}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-navy-600"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {s.label}
              </span>
              {s.itemCount > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-navy-800 dark:text-slate-400">
                  {s.itemCount}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{s.description}</div>
          </div>
        </label>
      ))}
    </div>
  );
}

// ==================== DYNAMIC SWOT OUTPUTS ====================

function DynamicSwotOutputs({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: {
  session: ToolSession;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const swotData = session.inputData as SWOTData;

  const allInitiatives: InitiativeDraft[] = useMemo(() => {
    const local = Array.isArray(session.generatedInitiatives) ? session.generatedInitiatives : [];
    const fromSummary = swotData.summary?.recommendedInitiatives || [];
    const merged = new Map<string, InitiativeDraft>();
    [...fromSummary, ...local].forEach((i) => merged.set(i.id, i));
    return Array.from(merged.values());
  }, [session.generatedInitiatives, swotData.summary?.recommendedInitiatives]);

  const items = swotData.items || [];
  const tensions = swotData.tensions || [];
  const correlations = swotData.correlations || [];
  const moves = swotData.recommendedMoves || [];
  const summary = swotData.summary;

  const [initiativeActions, setInitiativeActions] = useState<Record<string, InitiativeAction>>({});
  const [expandedInitiative, setExpandedInitiative] = useState<string | null>(null);
  const [materializing, setMaterializing] = useState(false);
  const [materializedCount, setMaterializedCount] = useState(0);

  const [reportSections, setReportSections] = useState<Set<string>>(
    new Set(['executive-summary', 'swot-matrix', 'insights'])
  );
  const [presSections, setPresSections] = useState<Set<string>>(
    new Set(['executive-summary', 'swot-matrix'])
  );
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportCreating, setReportCreating] = useState(false);
  const [presCreated, setPresCreated] = useState(false);

  const toggleReportSection = (id: string) => {
    setReportSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  const togglePresSection = (id: string) => {
    setPresSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const setAction = (id: string, action: InitiativeAction) => {
    setInitiativeActions((prev) => ({ ...prev, [id]: action }));
  };

  const handleCreateReport = async () => {
    if (reportCreating || reportSections.size === 0) return;
    setReportCreating(true);
    try {
      const result = await Api.promoteToolOutput(session.id, {
        outputType: 'report',
        title: `${session.name || 'SWOT'} — SWOT Report`,
        description: isPolish
          ? 'Raport utworzony z zatwierdzonej sesji Dynamic SWOT.'
          : 'Report created from an approved Dynamic SWOT session.',
        selectedSections: Array.from(reportSections),
      });
      if (!result?.id) throw new Error('Report identifier missing from server response');
      setReportId(String(result.id));
      toast.success(
        isPolish ? 'Raport zapisano w Report Builderze.' : 'Report saved in Report Builder.'
      );
    } catch (error: any) {
      toast.error(
        error?.message ||
          (isPolish ? 'Nie udało się utworzyć raportu.' : 'Failed to create report.')
      );
    } finally {
      setReportCreating(false);
    }
  };

  // H1.4 / S6.2 — materialize the recommendations into the real Initiatives
  // backbone through the canonical server handler (POST /initiatives/from-tool-
  // session). Persists the ones marked "develop" (or all, when nothing was
  // marked yet), tagged source_type='tool_session'. Server-side idempotent, so
  // a repeat click never duplicates. Fail-safe: an error keeps the local
  // session intact and surfaces a toast (identical doctrine to the per-move
  // CreateInitiativeFromMoveButton handoff).
  const handleMaterializeInitiatives = async () => {
    if (materializing) return;
    const marked = allInitiatives.filter((i) => initiativeActions[i.id] === 'develop');
    const toCreate = marked.length > 0 ? marked : allInitiatives;
    if (toCreate.length === 0) return;
    setMaterializing(true);
    try {
      const result = await Api.createInitiativesFromToolSession({
        toolSessionId: session.id,
        recommendations: toCreate.map((i) => ({
          title: i.title,
          description: i.description,
          rationale: i.rationale || i.description,
          category: i.type,
          impact: i.estimatedImpact,
          effort: i.estimatedEffort,
        })),
      });
      setMaterializedCount((prev) => prev + result.created.length);
      if (result.created.length > 0) {
        toast.success(
          t('discoveryToolsSteps.summaryStep.dynamicSwot.materialize.createdToast', {
            count: result.created.length,
            defaultValue: `${result.created.length} initiative(s) created`,
          })
        );
      } else {
        toast(
          t('discoveryToolsSteps.summaryStep.dynamicSwot.materialize.allExistToast', {
            defaultValue: 'All recommendations were already created',
          })
        );
      }
    } catch (err) {
      console.error('[Tools→Initiatives] session handoff failed:', err);
      toast.error(
        t('discoveryToolsSteps.summaryStep.dynamicSwot.materialize.failedToast', {
          defaultValue: 'Could not create initiatives — your session is safe',
        })
      );
    } finally {
      setMaterializing(false);
    }
  };

  const contentSections: ContentSection[] = useMemo(
    () => [
      {
        id: 'executive-summary',
        label: t('discoveryToolsSteps.summaryStep.dynamicSwot.sections.executiveSummary.label'),
        description: t(
          'discoveryToolsSteps.summaryStep.dynamicSwot.sections.executiveSummary.description'
        ),
        available: !!summary?.executiveSummary,
        itemCount: 0,
      },
      {
        id: 'swot-matrix',
        label: t('discoveryToolsSteps.summaryStep.dynamicSwot.sections.swotMatrix.label'),
        description: t(
          'discoveryToolsSteps.summaryStep.dynamicSwot.sections.swotMatrix.description'
        ),
        available: items.length > 0,
        itemCount: items.length,
      },
      {
        id: 'insights',
        label: t('discoveryToolsSteps.summaryStep.dynamicSwot.sections.insights.label'),
        description: t('discoveryToolsSteps.summaryStep.dynamicSwot.sections.insights.description'),
        available: (summary?.keyInsights?.length || 0) > 0 || tensions.length > 0,
        itemCount: (summary?.keyInsights?.length || 0) + tensions.length,
      },
      {
        id: 'correlations',
        label: t('discoveryToolsSteps.summaryStep.dynamicSwot.sections.correlations.label'),
        description: t(
          'discoveryToolsSteps.summaryStep.dynamicSwot.sections.correlations.description'
        ),
        available: correlations.length > 0,
        itemCount: correlations.length,
      },
      {
        id: 'recommendations',
        label: t('discoveryToolsSteps.summaryStep.dynamicSwot.sections.recommendations.label'),
        description: t(
          'discoveryToolsSteps.summaryStep.dynamicSwot.sections.recommendations.description'
        ),
        available: moves.length > 0,
        itemCount: moves.length,
      },
      {
        id: 'initiatives',
        label: t('discoveryToolsSteps.summaryStep.dynamicSwot.sections.initiatives.label'),
        description: t(
          'discoveryToolsSteps.summaryStep.dynamicSwot.sections.initiatives.description'
        ),
        available: allInitiatives.length > 0,
        itemCount: allInitiatives.length,
      },
    ],
    [t, summary, items, tensions, correlations, moves, allInitiatives]
  );

  const readinessChecklist = [
    {
      label: t('discoveryToolsSteps.summaryStep.dynamicSwot.readiness.missionBrief'),
      done: !!swotData.context.goal && !!swotData.context.scope,
    },
    {
      label: t('discoveryToolsSteps.summaryStep.dynamicSwot.readiness.swotFactors'),
      done: items.length >= 4,
    },
    {
      label: t('discoveryToolsSteps.summaryStep.dynamicSwot.readiness.strategicInsights'),
      done: (summary?.keyInsights?.length || 0) > 0 || tensions.length > 0,
    },
    {
      label: t('discoveryToolsSteps.summaryStep.dynamicSwot.readiness.recommendationsOrMoves'),
      done: moves.length > 0 || allInitiatives.length > 0,
    },
    {
      label: t('discoveryToolsSteps.summaryStep.dynamicSwot.readiness.initiativesDefined'),
      done: allInitiatives.length > 0,
    },
  ];
  const readinessScore = readinessChecklist.filter((c) => c.done).length;
  const readinessTotal = readinessChecklist.length;

  const developCount = Object.values(initiativeActions).filter((a) => a === 'develop').length;
  const deferCount = Object.values(initiativeActions).filter((a) => a === 'defer').length;
  const ideaCount = Object.values(initiativeActions).filter((a) => a === 'idea').length;

  return (
    <div className="space-y-5">
      {/* HEADER + READINESS */}
      <section className="rounded-[28px] border border-slate-200/70 bg-white dark:border-navy-700/70 dark:bg-navy-900/40">
        <SectionHeader
          title={t('discoveryToolsSteps.summaryStep.dynamicSwot.outputsActions.title')}
          badge={t('discoveryToolsSteps.summaryStep.dynamicSwot.outputsActions.badge')}
          description={t('discoveryToolsSteps.summaryStep.dynamicSwot.outputsActions.description')}
        />
        <div className="p-5">
          {/* Readiness bar */}
          <div className="mb-5 flex items-center gap-4">
            <div className="flex-1">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('discoveryToolsSteps.summaryStep.dynamicSwot.analysisReadiness')}
                </span>
                <span
                  className={`text-sm font-bold ${readinessScore >= 4 ? 'text-emerald-600 dark:text-emerald-400' : readinessScore >= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-danger-600 dark:text-danger-400'}`}
                >
                  {readinessScore}/{readinessTotal}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800">
                <div
                  className={`h-full rounded-full transition-all ${readinessScore >= 4 ? 'bg-emerald-500' : readinessScore >= 2 ? 'bg-amber-500' : 'bg-danger-500'}`}
                  style={{ width: `${(readinessScore / readinessTotal) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Readiness checklist */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {readinessChecklist.map((item) => (
              <div key={item.label} className="flex items-center gap-2.5 text-sm">
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${item.done ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-slate-100 dark:bg-navy-800'}`}
                >
                  {item.done ? (
                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                  )}
                </span>
                <span
                  className={
                    item.done
                      ? 'text-slate-700 dark:text-slate-300'
                      : 'text-slate-600 dark:text-slate-500'
                  }
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* Metric pills */}
          <div className="mt-5 flex flex-wrap gap-3">
            {[
              {
                label: t('discoveryToolsSteps.summaryStep.dynamicSwot.metricPills.factors'),
                value: items.length,
                color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
              },
              {
                label: t('discoveryToolsSteps.summaryStep.dynamicSwot.metricPills.tensions'),
                value: tensions.length,
                color: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
              },
              {
                label: t('discoveryToolsSteps.summaryStep.dynamicSwot.metricPills.moves'),
                value: moves.length,
                color:
                  'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
              },
              {
                label: t('discoveryToolsSteps.summaryStep.dynamicSwot.metricPills.initiatives'),
                value: allInitiatives.length,
                color:
                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
              },
            ].map((m) => (
              <div
                key={m.label}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${m.color}`}
              >
                <span className="text-lg font-bold">{m.value}</span> {m.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INITIATIVE DRAFTS TABLE */}
      <section className="rounded-[28px] border border-slate-200/70 bg-white dark:border-navy-700/70 dark:bg-navy-900/40">
        <SectionHeader
          title={t('discoveryToolsSteps.summaryStep.dynamicSwot.initiativesTable.title')}
          badge={t('discoveryToolsSteps.summaryStep.dynamicSwot.initiativesTable.badge')}
          description={t(
            'discoveryToolsSteps.summaryStep.dynamicSwot.initiativesTable.description'
          )}
        />
        <div className="p-5">
          {allInitiatives.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center dark:border-navy-700">
              <Rocket className="mx-auto h-8 w-8 text-slate-600 dark:text-slate-400" />
              <div className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                {t('discoveryToolsSteps.summaryStep.dynamicSwot.initiativesTable.empty')}
              </div>
            </div>
          ) : (
            <>
              {/* H1.4 / S6.2 — materialize recommendations into the Initiatives backbone */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleMaterializeInitiatives}
                  disabled={materializing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text transition hover:border-c-focus disabled:opacity-40"
                >
                  <Rocket className="h-3 w-3" />
                  {materializing
                    ? t('discoveryToolsSteps.summaryStep.dynamicSwot.materialize.creating', {
                        defaultValue: 'Creating…',
                      })
                    : t('discoveryToolsSteps.summaryStep.dynamicSwot.materialize.button', {
                        count: developCount > 0 ? developCount : allInitiatives.length,
                        defaultValue: `Create ${
                          developCount > 0 ? developCount : allInitiatives.length
                        } initiative(s)`,
                      })}
                </button>
                {materializedCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-c-success/10 px-3 py-1 text-xs font-semibold text-c-success">
                    <Check className="h-3 w-3" /> {materializedCount}{' '}
                    {t('discoveryToolsSteps.summaryStep.dynamicSwot.materialize.createdBadge', {
                      defaultValue: 'in backbone',
                    })}
                  </span>
                )}
              </div>

              {/* Summary counters */}
              {Object.keys(initiativeActions).length > 0 && (
                <div className="mb-4 flex flex-wrap gap-3">
                  {developCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-c-success/10 px-3 py-1 text-xs font-semibold text-c-success">
                      <Rocket className="h-3 w-3" /> {developCount}{' '}
                      {t('discoveryToolsSteps.summaryStep.dynamicSwot.counters.toDevelop')}
                    </span>
                  )}
                  {deferCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                      <Shield className="h-3 w-3" /> {deferCount}{' '}
                      {t('discoveryToolsSteps.summaryStep.dynamicSwot.counters.deferred')}
                    </span>
                  )}
                  {ideaCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                      <Lightbulb className="h-3 w-3" /> {ideaCount}{' '}
                      {t('discoveryToolsSteps.summaryStep.dynamicSwot.counters.asIdeas')}
                    </span>
                  )}
                </div>
              )}

              {/* Initiative rows */}
              <div className="space-y-3">
                {allInitiatives.map((initiative, idx) => {
                  const meta =
                    INITIATIVE_TYPE_META[initiative.type] || INITIATIVE_TYPE_META.strategic;
                  const TypeIcon = meta.icon;
                  const action = initiativeActions[initiative.id];
                  const isExpanded = expandedInitiative === initiative.id;

                  return (
                    <div
                      key={initiative.id}
                      className={`rounded-xl border transition-all ${
                        action === 'develop'
                          ? 'border-emerald-200/70 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                          : action === 'defer'
                            ? 'border-amber-200/70 bg-amber-50/20 dark:border-amber-900/40 dark:bg-amber-950/10'
                            : action === 'idea'
                              ? 'border-blue-200/70 bg-blue-50/20 dark:border-blue-900/40 dark:bg-blue-950/10'
                              : 'border-slate-200/60 bg-white/70 dark:border-navy-700/50 dark:bg-navy-950/40'
                      }`}
                    >
                      <div className="flex items-start gap-3 p-4">
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <TypeIcon className={`h-3.5 w-3.5 ${meta.color}`} />
                            <span
                              className={`text-[10px] font-bold uppercase tracking-[0.14em] ${meta.color}`}
                            >
                              {isPolish ? meta.label.pl : meta.label.en}
                            </span>
                            <div className="ml-auto flex items-center gap-1.5">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                  initiative.estimatedImpact === 'high'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
                                    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                                }`}
                              >
                                {t('discoveryToolsSteps.summaryStep.dynamicSwot.impactLabel')}:{' '}
                                {initiative.estimatedImpact}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                  initiative.estimatedEffort === 'low'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
                                    : initiative.estimatedEffort === 'medium'
                                      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                                      : 'border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300'
                                }`}
                              >
                                {t('discoveryToolsSteps.summaryStep.dynamicSwot.effortLabel')}:{' '}
                                {initiative.estimatedEffort}
                              </span>
                            </div>
                          </div>
                          <h4 className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {initiative.title}
                          </h4>
                          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            {initiative.description}
                          </p>

                          {isExpanded && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-navy-700/40 dark:bg-navy-950/20">
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                                {t('discoveryToolsSteps.summaryStep.dynamicSwot.rationaleLabel')}
                              </div>
                              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                {initiative.rationale}
                              </p>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={() =>
                                setExpandedInitiative(isExpanded ? null : initiative.id)
                              }
                              className="text-xs text-slate-600 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                            >
                              {isExpanded ? (
                                <ChevronUp className="inline h-3 w-3" />
                              ) : (
                                <ChevronDown className="inline h-3 w-3" />
                              )}{' '}
                              {isExpanded
                                ? t('discoveryToolsSteps.summaryStep.dynamicSwot.collapse')
                                : t('discoveryToolsSteps.summaryStep.dynamicSwot.details')}
                            </button>
                            <div className="ml-auto flex gap-1.5">
                              <button
                                onClick={() => setAction(initiative.id, 'develop')}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                                  action === 'develop'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-navy-800 dark:text-slate-300 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300'
                                }`}
                              >
                                <Rocket className="h-3 w-3" />
                                {t('discoveryToolsSteps.summaryStep.dynamicSwot.develop')}
                              </button>
                              <button
                                onClick={() => setAction(initiative.id, 'defer')}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                                  action === 'defer'
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700 dark:bg-navy-800 dark:text-slate-300 dark:hover:bg-amber-900/20 dark:hover:text-amber-300'
                                }`}
                              >
                                <Shield className="h-3 w-3" />
                                {t('discoveryToolsSteps.summaryStep.dynamicSwot.defer')}
                              </button>
                              <button
                                onClick={() => setAction(initiative.id, 'idea')}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                                  action === 'idea'
                                    ? 'bg-blue-500 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:bg-navy-800 dark:text-slate-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-300'
                                }`}
                              >
                                <Lightbulb className="h-3 w-3" />
                                {t('discoveryToolsSteps.summaryStep.dynamicSwot.asIdea')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* CREATE REPORT */}
      <section className="rounded-[28px] border border-slate-200/70 bg-white dark:border-navy-700/70 dark:bg-navy-900/40">
        <SectionHeader
          title={t('discoveryToolsSteps.summaryStep.dynamicSwot.createReport.title')}
          badge={t('discoveryToolsSteps.summaryStep.dynamicSwot.createReport.badge')}
          description={t('discoveryToolsSteps.summaryStep.dynamicSwot.createReport.description')}
        />
        <div className="p-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
            <ContentSelector
              sections={contentSections}
              selected={reportSections}
              onToggle={toggleReportSection}
              isPolish={isPolish}
            />
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 px-8 py-6 dark:border-navy-700">
              <BookOpen className="h-8 w-8 text-slate-600 dark:text-slate-400" />
              <div className="text-center text-sm text-slate-500 dark:text-slate-400">
                {reportSections.size}{' '}
                {t('discoveryToolsSteps.summaryStep.dynamicSwot.sectionsSelected')}
              </div>
              {reportId ? (
                <button
                  type="button"
                  onClick={() => navigate(`/reports/builder/${encodeURIComponent(reportId)}`)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                >
                  <Check className="h-3.5 w-3.5" />
                  {t('discoveryToolsSteps.summaryStep.dynamicSwot.reportCreated')}
                </button>
              ) : (
                <button
                  onClick={handleCreateReport}
                  disabled={reportSections.size === 0 || reportCreating}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {reportCreating
                    ? isPolish
                      ? 'Tworzenie…'
                      : 'Creating…'
                    : t('discoveryToolsSteps.summaryStep.dynamicSwot.generateReport')}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CREATE PRESENTATION */}
      <section className="rounded-[28px] border border-slate-200/70 bg-white dark:border-navy-700/70 dark:bg-navy-900/40">
        <SectionHeader
          title={t('discoveryToolsSteps.summaryStep.dynamicSwot.createPresentation.title')}
          badge={t('discoveryToolsSteps.summaryStep.dynamicSwot.createPresentation.badge')}
          description={t(
            'discoveryToolsSteps.summaryStep.dynamicSwot.createPresentation.description'
          )}
        />
        <div className="p-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
            <ContentSelector
              sections={contentSections}
              selected={presSections}
              onToggle={togglePresSection}
              isPolish={isPolish}
            />
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 px-8 py-6 dark:border-navy-700">
              <Presentation className="h-8 w-8 text-slate-600 dark:text-slate-400" />
              <div className="text-center text-sm text-slate-500 dark:text-slate-400">
                {presSections.size}{' '}
                {t('discoveryToolsSteps.summaryStep.dynamicSwot.sectionsSelected')}
              </div>
              {presCreated ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                  <Check className="h-3.5 w-3.5" />
                  {t('discoveryToolsSteps.summaryStep.dynamicSwot.presentationCreated')}
                </span>
              ) : (
                <button
                  onClick={() => setPresCreated(true)}
                  disabled={presSections.size === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] px-4 py-2 text-xs font-semibold text-white dark:text-navy-950 shadow-sm transition-all hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-40"
                >
                  <Presentation className="h-3.5 w-3.5" />
                  {t('discoveryToolsSteps.summaryStep.dynamicSwot.generatePresentation')}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* IDEAS BANK */}
      <section className="rounded-[28px] border border-slate-200/70 bg-white dark:border-navy-700/70 dark:bg-navy-900/40">
        <SectionHeader
          title={t('discoveryToolsSteps.summaryStep.dynamicSwot.ideasBank.title')}
          badge={t('discoveryToolsSteps.summaryStep.dynamicSwot.ideasBank.badge')}
          description={t('discoveryToolsSteps.summaryStep.dynamicSwot.ideasBank.description')}
        />
        <div className="p-5">
          {(() => {
            const ideaInitiatives = allInitiatives.filter(
              (i) => initiativeActions[i.id] === 'idea'
            );
            const ideaCandidates =
              swotData.outputCandidates?.filter((c) => c.readiness === 'keep-as-idea') || [];
            const hasIdeas = ideaInitiatives.length > 0 || ideaCandidates.length > 0;

            if (!hasIdeas) {
              return (
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center dark:border-navy-700">
                  <Lightbulb className="mx-auto h-7 w-7 text-slate-600 dark:text-slate-400" />
                  <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {t('discoveryToolsSteps.summaryStep.dynamicSwot.ideasBank.empty')}
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-2">
                {ideaInitiatives.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-start gap-3 rounded-xl border border-blue-200/50 bg-blue-50/30 p-3 dark:border-blue-900/30 dark:bg-blue-950/10"
                  >
                    <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {i.title}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {i.description}
                      </div>
                    </div>
                  </div>
                ))}
                {ideaCandidates.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-3 rounded-xl border border-blue-200/50 bg-blue-50/30 p-3 dark:border-blue-900/30 dark:bg-blue-950/10"
                  >
                    <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {c.title}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {c.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </section>
    </div>
  );
}

// ==================== COMPONENT ====================

export const SummaryStep: React.FC<SummaryStepProps> = ({
  toolType,
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}) => {
  const { t } = useTranslation();
  const inputData = session.inputData;
  const initiatives = session.generatedInitiatives;
  const swotSummary = toolType === 'dynamic-swot' ? (inputData as SWOTData).summary : undefined;
  const hasPendingSummaryProposal =
    swotSummary?.proposalStatus === 'ai-proposed' || swotSummary?.proposalStatus === 'rethinking';

  type SummaryData = {
    summary: string;
    insights: string[];
    appliedConclusions: string[];
    initiatives: InitiativeDraft[];
    metrics: Record<string, number>;
  };

  const getSummaryData = (): SummaryData => {
    if (toolType === 'dynamic-swot') {
      const swotData = inputData as SWOTData;
      const swotSummary = swotData.summary;
      const recommendedInitiatives = swotSummary?.recommendedInitiatives || [];
      return {
        summary: swotSummary?.executiveSummary || swotSummary?.keyInsights?.join(' ') || '',
        insights: swotSummary?.keyInsights || [],
        appliedConclusions: swotSummary?.appliedConclusions || [],
        initiatives: recommendedInitiatives.length > 0 ? recommendedInitiatives : initiatives,
        metrics: {},
      };
    } else if (toolType === 'market-forces') {
      const porterData = inputData as PorterData;
      return {
        summary: porterData.summary?.keyInsights?.join(' ') || '',
        insights: porterData.summary?.keyInsights || [],
        appliedConclusions:
          (porterData.summary as { appliedConclusions?: string[] } | undefined)
            ?.appliedConclusions || [],
        initiatives: porterData.summary?.recommendedInitiatives || initiatives,
        metrics: {
          attractiveness: porterData.overallAttractiveness || 0,
          avgForceScore: Object.values(porterData.forces).reduce((sum, f) => sum + f.score, 0) / 5,
        },
      };
    } else if (toolType === 'growth-paths') {
      const growthData = inputData as GrowthPathsData;
      return {
        summary: growthData.summary?.keyInsights?.join(' ') || '',
        insights: growthData.summary?.keyInsights || [],
        appliedConclusions:
          (growthData.summary as { appliedConclusions?: string[] } | undefined)
            ?.appliedConclusions || [],
        initiatives: growthData.summary?.recommendedInitiatives || initiatives,
        metrics: {
          marketPenetration: growthData.quadrants.marketPenetration.length,
          marketDevelopment: growthData.quadrants.marketDevelopment.length,
          productDevelopment: growthData.quadrants.productDevelopment.length,
          diversification: growthData.quadrants.diversification.length,
        },
      };
    } else if (toolType === 'portfolio-priority') {
      const portfolioData = inputData as PortfolioPriorityData;
      return {
        summary: portfolioData.summary?.keyInsights?.join(' ') || '',
        insights: portfolioData.summary?.keyInsights || [],
        appliedConclusions:
          (portfolioData.summary as { appliedConclusions?: string[] } | undefined)
            ?.appliedConclusions || [],
        initiatives: portfolioData.summary?.recommendedInitiatives || initiatives,
        metrics: {
          total: portfolioData.initiatives.length,
          stars: portfolioData.initiatives.filter((i) => i.category === 'star').length,
          cashCows: portfolioData.initiatives.filter((i) => i.category === 'cash-cow').length,
          questionMarks: portfolioData.initiatives.filter((i) => i.category === 'question-mark')
            .length,
          dogs: portfolioData.initiatives.filter((i) => i.category === 'dog').length,
        },
      };
    } else if (toolType === 'risk-uncertainty') {
      const riskData = inputData as RiskUncertaintyData;
      return {
        summary: riskData.summary?.keyInsights?.join(' ') || '',
        insights: riskData.summary?.keyInsights || [],
        appliedConclusions:
          (riskData.summary as { appliedConclusions?: string[] } | undefined)?.appliedConclusions ||
          [],
        initiatives: riskData.summary?.recommendedInitiatives || initiatives,
        metrics: {
          assumptions: riskData.assumptions.length,
          risks: riskData.risks.length,
          scenarios: riskData.scenarios.length,
        },
      };
    } else if (
      [
        'sop-builder',
        'a3-problem-solving',
        'smed-planner',
        'dms-builder',
        'inventory-autopilot',
      ].includes(toolType)
    ) {
      const operational = inputData as { sections?: Record<string, unknown[]>; summary?: any };
      const sections = (operational.sections || {}) as Record<string, unknown[]>;
      const sectionItems = Object.values(sections);
      const totalItems = sectionItems.reduce(
        (sum, items) => sum + (Array.isArray(items) ? items.length : 0),
        0
      );
      const sectionsWithItems = sectionItems.filter(
        (items) => Array.isArray(items) && items.length > 0
      ).length;
      return {
        summary: operational.summary?.keyInsights?.join(' ') || '',
        insights: operational.summary?.keyInsights || [],
        appliedConclusions: operational.summary?.appliedConclusions || [],
        initiatives: operational.summary?.recommendedInitiatives || initiatives,
        metrics: {
          totalItems,
          sectionsWithItems,
        },
      };
    }
    return { summary: '', insights: [], appliedConclusions: [], initiatives, metrics: {} };
  };

  const summaryData = getSummaryData();

  // OXFORD O2.3 — CONCLUSION LAYER (W2): build a validated K1-K4 wniosek from
  // this session's own moves/insights (numbers only from the engine/session,
  // never invented — see toolConclusion.ts). Computed unconditionally (Rules
  // of Hooks — must run before the dynamic-swot early return below) even
  // though only the non-SWOT branch renders it; SWOT has its own dedicated
  // W2 conclusion path (summary.verdict) inside DynamicSwotOutputs already.
  const toolConclusionModel = useMemo(
    () =>
      buildToolConclusionModel(
        extractToolConclusionFacts({
          toolName: toolType,
          language: isPolish ? 'pl' : 'en',
          inputData,
          fallbackInitiatives: initiatives,
        })
      ),
    [toolType, isPolish, inputData, initiatives]
  );

  if (toolType === 'dynamic-swot') {
    return (
      <DynamicSwotOutputs
        session={session}
        isPolish={isPolish}
        onAcceptCard={onAcceptCard}
        onRejectCard={onRejectCard}
        onRethinkCard={onRethinkCard}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
          <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('discoveryToolsSteps.summaryStep.generic.title')}
        </h2>
      </div>

      {/* Executive Summary */}
      {hasPendingSummaryProposal ? (
        <ProposalCard
          cardId={swotSummary?.proposalId || 'swot-summary'}
          cardType="conclusion"
          proposalStatus={swotSummary?.proposalStatus}
          onAccept={onAcceptCard || (() => {})}
          onReject={onRejectCard || (() => {})}
          onRethink={onRethinkCard || (() => {})}
        >
          <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
            <h3 className="font-medium text-slate-900 dark:text-white mb-2">
              {t('discoveryToolsSteps.summaryStep.generic.finalSourceSummaryProposal')}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {summaryData.summary ||
                t('discoveryToolsSteps.summaryStep.generic.generateAnalysisHint')}
            </p>
            {summaryData.insights.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                {summaryData.insights.map((insight: string, index: number) => (
                  <li key={index}>• {insight}</li>
                ))}
              </ul>
            )}
            {summaryData.appliedConclusions.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                {summaryData.appliedConclusions.map((conclusion: string, index: number) => (
                  <li key={index}>• {conclusion}</li>
                ))}
              </ul>
            )}
          </div>
        </ProposalCard>
      ) : toolConclusionModel.isPublishable ? (
        <ToolConclusionSummary model={toolConclusionModel} />
      ) : (
        <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
          <h3 className="font-medium text-slate-900 dark:text-white mb-2">
            {t('discoveryToolsSteps.summaryStep.generic.finalSourceSummary')}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {summaryData.summary ||
              t('discoveryToolsSteps.summaryStep.generic.generateAnalysisHint')}
          </p>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {toolType === 'market-forces' && (
          <>
            <MetricCard
              label={t('discoveryToolsSteps.summaryStep.generic.metrics.industryAttractiveness')}
              value={`${((summaryData.metrics as any).attractiveness || 0).toFixed(1)}/5`}
              color="emerald"
            />
            <MetricCard
              label={t('discoveryToolsSteps.summaryStep.generic.metrics.avgForceScore')}
              value={`${((summaryData.metrics as any).avgForceScore || 0).toFixed(1)}/5`}
              color="blue"
            />
          </>
        )}
        {toolType === 'growth-paths' && (
          <>
            <MetricCard
              label={t('discoveryToolsSteps.summaryStep.generic.metrics.penetration')}
              value={(summaryData.metrics as any).marketPenetration || 0}
              color="emerald"
            />
            <MetricCard
              label={t('discoveryToolsSteps.summaryStep.generic.metrics.marketDev')}
              value={(summaryData.metrics as any).marketDevelopment || 0}
              color="blue"
            />
            <MetricCard
              label={t('discoveryToolsSteps.summaryStep.generic.metrics.productDev')}
              value={(summaryData.metrics as any).productDevelopment || 0}
              color="purple"
            />
            <MetricCard
              label={t('discoveryToolsSteps.summaryStep.generic.metrics.diversification')}
              value={(summaryData.metrics as any).diversification || 0}
              color="amber"
            />
          </>
        )}
        {toolType === 'portfolio-priority' && (
          <>
            <MetricCard
              label={t('discoveryToolsSteps.summaryStep.generic.metrics.stars')}
              value={(summaryData.metrics as any).stars || 0}
              color="emerald"
            />
            <MetricCard
              label={t('discoveryToolsSteps.summaryStep.generic.metrics.cashCows')}
              value={(summaryData.metrics as any).cashCows || 0}
              color="blue"
            />
            <MetricCard
              label={t('discoveryToolsSteps.summaryStep.generic.metrics.questionMarks')}
              value={(summaryData.metrics as any).questionMarks || 0}
              color="amber"
            />
            <MetricCard
              label={t('discoveryToolsSteps.summaryStep.generic.metrics.dogs')}
              value={(summaryData.metrics as any).dogs || 0}
              color="red"
            />
          </>
        )}
        {toolType === 'risk-uncertainty' && (
          <>
            <MetricCard
              label={t('discoveryToolsSteps.summaryStep.generic.metrics.assumptions')}
              value={(summaryData.metrics as any).assumptions || 0}
              color="emerald"
            />
            <MetricCard
              label={t('discoveryToolsSteps.summaryStep.generic.metrics.risks')}
              value={(summaryData.metrics as any).risks || 0}
              color="amber"
            />
            <MetricCard
              label={t('discoveryToolsSteps.summaryStep.generic.metrics.scenarios')}
              value={(summaryData.metrics as any).scenarios || 0}
              color="blue"
            />
          </>
        )}
        {[
          'sop-builder',
          'a3-problem-solving',
          'smed-planner',
          'dms-builder',
          'inventory-autopilot',
        ].includes(toolType) && (
          <>
            <MetricCard
              label={t('discoveryToolsSteps.summaryStep.generic.metrics.items')}
              value={(summaryData.metrics as any).totalItems || 0}
              color="emerald"
            />
            <MetricCard
              label={t('discoveryToolsSteps.summaryStep.generic.metrics.sections')}
              value={(summaryData.metrics as any).sectionsWithItems || 0}
              color="blue"
            />
          </>
        )}
      </div>

      {/* Visualization */}
      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white mb-4">
          {t('discoveryToolsSteps.summaryStep.generic.visualization')}
        </h3>
        {toolType === 'market-forces' && (
          <PorterRadar data={inputData as PorterData} isPolish={isPolish} />
        )}
        {toolType === 'growth-paths' && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t('discoveryToolsSteps.summaryStep.generic.visualizationNote.growthPaths')}
          </div>
        )}
        {toolType === 'portfolio-priority' && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t('discoveryToolsSteps.summaryStep.generic.visualizationNote.portfolioPriority')}
          </div>
        )}
        {toolType === 'risk-uncertainty' && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t('discoveryToolsSteps.summaryStep.generic.visualizationNote.riskUncertainty')}
          </div>
        )}
        {[
          'sop-builder',
          'a3-problem-solving',
          'smed-planner',
          'dms-builder',
          'inventory-autopilot',
        ].includes(toolType) && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t('discoveryToolsSteps.summaryStep.generic.visualizationNote.operational')}
          </div>
        )}
      </div>

      {/* Key Insights — subsumed by ToolConclusionSummary's rationale/K3 when
          publishable (O2.3); shown standalone only in the legacy fallback. */}
      {summaryData.insights.length > 0 &&
        !hasPendingSummaryProposal &&
        !toolConclusionModel.isPublishable && (
          <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
            <h3 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-500" />
              {t('discoveryToolsSteps.summaryStep.generic.keyInsights')}
            </h3>
            <ul className="space-y-2">
              {summaryData.insights.map((insight: string, index: number) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                >
                  <span className="text-primary-500">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

      {summaryData.appliedConclusions.length > 0 &&
        !hasPendingSummaryProposal &&
        !toolConclusionModel.isPublishable && (
          <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
            <h3 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-500" />
              {t('discoveryToolsSteps.summaryStep.generic.appliedConclusions')}
            </h3>
            <ul className="space-y-2">
              {summaryData.appliedConclusions.map((conclusion: string, index: number) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                >
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{conclusion}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {t('discoveryToolsSteps.summaryStep.generic.refineConclusionsHint')}
            </div>
          </div>
        )}

      {/* Recommended Initiatives */}
      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          {t('discoveryToolsSteps.summaryStep.generic.recommendedInitiatives')}
        </h3>
        {summaryData.initiatives.length > 0 ? (
          <div className="space-y-3">
            {summaryData.initiatives.map((initiative) => (
              <div
                key={initiative.id}
                className="p-3 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white">
                      {initiative.title}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {initiative.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        initiative.type === 'strategic'
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                          : initiative.type === 'operational'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : initiative.type === 'defensive'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      }`}
                    >
                      {initiative.type}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  <span>Impact: {initiative.estimatedImpact}</span>
                  <span>Effort: {initiative.estimatedEffort}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            {t('discoveryToolsSteps.summaryStep.generic.generateInitiativesHint')}
          </p>
        )}
      </div>
    </div>
  );
};

// Metric card helper component
const MetricCard: React.FC<{
  label: string;
  value: number | string;
  color: string;
}> = ({ label, value, color }) => (
  <div
    className={`p-4 rounded-lg bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-200 dark:border-${color}-800`}
  >
    <div className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</div>
    <div className="text-sm text-slate-600 dark:text-slate-400">{label}</div>
  </div>
);

export default SummaryStep;
