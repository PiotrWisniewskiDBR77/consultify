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
  isPolish,
}: {
  sections: ContentSection[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  isPolish: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {isPolish ? 'Wybierz zawartość' : 'Select content'}
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

  const [reportSections, setReportSections] = useState<Set<string>>(
    new Set(['executive-summary', 'swot-matrix', 'insights'])
  );
  const [presSections, setPresSections] = useState<Set<string>>(
    new Set(['executive-summary', 'swot-matrix'])
  );
  const [reportCreated, setReportCreated] = useState(false);
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

  const contentSections: ContentSection[] = useMemo(
    () => [
      {
        id: 'executive-summary',
        label: isPolish ? 'Executive Summary' : 'Executive Summary',
        description: isPolish ? 'Podsumowanie całej analizy' : 'Full analysis summary',
        available: !!summary?.executiveSummary,
        itemCount: 0,
      },
      {
        id: 'swot-matrix',
        label: isPolish ? 'Macierz SWOT' : 'SWOT Matrix',
        description: isPolish ? 'Czynniki w 4 kwadrantach' : 'Factors in 4 quadrants',
        available: items.length > 0,
        itemCount: items.length,
      },
      {
        id: 'insights',
        label: isPolish ? 'Wnioski strategiczne' : 'Strategic Insights',
        description: isPolish ? 'Kluczowe wnioski i obserwacje' : 'Key insights and observations',
        available: (summary?.keyInsights?.length || 0) > 0 || tensions.length > 0,
        itemCount: (summary?.keyInsights?.length || 0) + tensions.length,
      },
      {
        id: 'correlations',
        label: isPolish ? 'Korelacje' : 'Correlations',
        description: isPolish ? 'Powiązania między czynnikami' : 'Cross-factor correlations',
        available: correlations.length > 0,
        itemCount: correlations.length,
      },
      {
        id: 'recommendations',
        label: isPolish ? 'Rekomendacje' : 'Recommendations',
        description: isPolish ? 'Rekomendowane ruchy strategiczne' : 'Recommended strategic moves',
        available: moves.length > 0,
        itemCount: moves.length,
      },
      {
        id: 'initiatives',
        label: isPolish ? 'Inicjatywy' : 'Initiatives',
        description: isPolish
          ? 'Drafty inicjatyw do realizacji'
          : 'Initiative drafts for execution',
        available: allInitiatives.length > 0,
        itemCount: allInitiatives.length,
      },
    ],
    [isPolish, summary, items, tensions, correlations, moves, allInitiatives]
  );

  const readinessChecklist = [
    {
      label: isPolish ? 'Mission brief jest jasny' : 'Mission brief is clear',
      done: !!swotData.context.goal && !!swotData.context.scope,
    },
    {
      label: isPolish ? 'Czynniki SWOT zdefiniowane' : 'SWOT factors defined',
      done: items.length >= 4,
    },
    {
      label: isPolish ? 'Wnioski strategiczne' : 'Strategic insights exist',
      done: (summary?.keyInsights?.length || 0) > 0 || tensions.length > 0,
    },
    {
      label: isPolish ? 'Rekomendacje lub ruchy' : 'Recommendations or moves',
      done: moves.length > 0 || allInitiatives.length > 0,
    },
    {
      label: isPolish ? 'Inicjatywy zdefiniowane' : 'Initiatives defined',
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
          title={isPolish ? 'Outputs & Actions' : 'Outputs & Actions'}
          badge={isPolish ? 'Zarządzanie wynikami' : 'Output management'}
          description={
            isPolish
              ? 'Zamień wyniki analizy w konkretne deliverables: inicjatywy do realizacji, raporty, prezentacje i idee do dalszej eksploracji.'
              : 'Turn analysis results into concrete deliverables: initiatives for execution, reports, presentations, and ideas for further exploration.'
          }
        />
        <div className="p-5">
          {/* Readiness bar */}
          <div className="mb-5 flex items-center gap-4">
            <div className="flex-1">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isPolish ? 'Gotowość analizy' : 'Analysis readiness'}
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
                label: isPolish ? 'Czynniki' : 'Factors',
                value: items.length,
                color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
              },
              {
                label: isPolish ? 'Napięcia' : 'Tensions',
                value: tensions.length,
                color: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
              },
              {
                label: isPolish ? 'Ruchy' : 'Moves',
                value: moves.length,
                color:
                  'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
              },
              {
                label: isPolish ? 'Inicjatywy' : 'Initiatives',
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
          title={isPolish ? 'Inicjatywy — tabela decyzyjna' : 'Initiatives — decision table'}
          badge={isPolish ? 'Inicjatywy' : 'Initiatives'}
          description={
            isPolish
              ? 'Zdecyduj, które inicjatywy chcesz opracować, które odłożyć, a które zachować jako idee.'
              : 'Decide which initiatives to develop, which to defer, and which to keep as ideas.'
          }
        />
        <div className="p-5">
          {allInitiatives.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center dark:border-navy-700">
              <Rocket className="mx-auto h-8 w-8 text-slate-600 dark:text-slate-400" />
              <div className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                {isPolish
                  ? 'Brak inicjatyw. Wróć do kroku "Synthesis & Insights" i utwórz inicjatywy z rekomendacji.'
                  : 'No initiatives yet. Go back to "Synthesis & Insights" step and create initiatives from recommendations.'}
              </div>
            </div>
          ) : (
            <>
              {/* Summary counters */}
              {Object.keys(initiativeActions).length > 0 && (
                <div className="mb-4 flex flex-wrap gap-3">
                  {developCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                      <Rocket className="h-3 w-3" /> {developCount}{' '}
                      {isPolish ? 'do realizacji' : 'to develop'}
                    </span>
                  )}
                  {deferCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                      <Shield className="h-3 w-3" /> {deferCount}{' '}
                      {isPolish ? 'odłożone' : 'deferred'}
                    </span>
                  )}
                  {ideaCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                      <Lightbulb className="h-3 w-3" /> {ideaCount}{' '}
                      {isPolish ? 'jako idee' : 'as ideas'}
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
                                {isPolish ? 'Wpływ' : 'Impact'}: {initiative.estimatedImpact}
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
                                {isPolish ? 'Wysiłek' : 'Effort'}: {initiative.estimatedEffort}
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
                                {isPolish ? 'Uzasadnienie' : 'Rationale'}
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
                                ? isPolish
                                  ? 'Zwiń'
                                  : 'Collapse'
                                : isPolish
                                  ? 'Szczegóły'
                                  : 'Details'}
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
                                {isPolish ? 'Realizuj' : 'Develop'}
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
                                {isPolish ? 'Odłóż' : 'Defer'}
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
                                {isPolish ? 'Jako idea' : 'As idea'}
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
          title={isPolish ? 'Utwórz raport' : 'Create report'}
          badge={isPolish ? 'Raport' : 'Report'}
          description={
            isPolish
              ? 'Wybierz, które elementy analizy chcesz zawrzeć w raporcie konsultingowym.'
              : 'Select which analysis elements to include in the consulting report.'
          }
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
                {reportSections.size} {isPolish ? 'sekcji wybranych' : 'sections selected'}
              </div>
              {reportCreated ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                  <Check className="h-3.5 w-3.5" />
                  {isPolish ? 'Raport utworzony' : 'Report created'}
                </span>
              ) : (
                <button
                  onClick={() => setReportCreated(true)}
                  disabled={reportSections.size === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {isPolish ? 'Generuj raport' : 'Generate report'}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CREATE PRESENTATION */}
      <section className="rounded-[28px] border border-slate-200/70 bg-white dark:border-navy-700/70 dark:bg-navy-900/40">
        <SectionHeader
          title={isPolish ? 'Utwórz prezentację' : 'Create presentation'}
          badge={isPolish ? 'Prezentacja' : 'Presentation'}
          description={
            isPolish
              ? 'Wybierz, które elementy analizy chcesz zawrzeć w prezentacji dla stakeholderów.'
              : 'Select which analysis elements to include in the stakeholder presentation.'
          }
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
                {presSections.size} {isPolish ? 'sekcji wybranych' : 'sections selected'}
              </div>
              {presCreated ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                  <Check className="h-3.5 w-3.5" />
                  {isPolish ? 'Prezentacja utworzona' : 'Presentation created'}
                </span>
              ) : (
                <button
                  onClick={() => setPresCreated(true)}
                  disabled={presSections.size === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] px-4 py-2 text-xs font-semibold text-white dark:text-navy-950 shadow-sm transition-all hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-40"
                >
                  <Presentation className="h-3.5 w-3.5" />
                  {isPolish ? 'Generuj prezentację' : 'Generate presentation'}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* IDEAS BANK */}
      <section className="rounded-[28px] border border-slate-200/70 bg-white dark:border-navy-700/70 dark:bg-navy-900/40">
        <SectionHeader
          title={isPolish ? 'Bank idei' : 'Ideas bank'}
          badge={isPolish ? 'Idee' : 'Ideas'}
          description={
            isPolish
              ? 'Idee i obserwacje do dalszej eksploracji — nie wymagają natychmiastowego działania.'
              : 'Ideas and observations for further exploration — no immediate action required.'
          }
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
                    {isPolish
                      ? 'Oznacz inicjatywy jako "Jako idea" w tabeli powyżej, aby dodać je tutaj.'
                      : 'Mark initiatives as "As idea" in the table above to add them here.'}
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
          {isPolish ? 'Final Summary i inicjatywy' : 'Final Summary & Initiatives'}
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
              {isPolish
                ? 'Final source summary (AI proposal)'
                : 'Final source summary (AI proposal)'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {summaryData.summary ||
                (isPolish
                  ? 'Kliknij "Generuj analizę" aby otrzymać podsumowanie AI.'
                  : 'Click "Generate Analysis" to get an AI summary.')}
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
            {isPolish ? 'Final source summary' : 'Final source summary'}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {summaryData.summary ||
              (isPolish
                ? 'Kliknij "Generuj analizę" aby otrzymać podsumowanie AI.'
                : 'Click "Generate Analysis" to get an AI summary.')}
          </p>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {toolType === 'market-forces' && (
          <>
            <MetricCard
              label={isPolish ? 'Atrakcyjność branży' : 'Industry Attractiveness'}
              value={`${((summaryData.metrics as any).attractiveness || 0).toFixed(1)}/5`}
              color="emerald"
            />
            <MetricCard
              label={isPolish ? 'Śr. siła konkurencji' : 'Avg. Force Score'}
              value={`${((summaryData.metrics as any).avgForceScore || 0).toFixed(1)}/5`}
              color="blue"
            />
          </>
        )}
        {toolType === 'growth-paths' && (
          <>
            <MetricCard
              label={isPolish ? 'Penetracja' : 'Penetration'}
              value={(summaryData.metrics as any).marketPenetration || 0}
              color="emerald"
            />
            <MetricCard
              label={isPolish ? 'Rozwój rynku' : 'Market dev.'}
              value={(summaryData.metrics as any).marketDevelopment || 0}
              color="blue"
            />
            <MetricCard
              label={isPolish ? 'Rozwój produktu' : 'Product dev.'}
              value={(summaryData.metrics as any).productDevelopment || 0}
              color="purple"
            />
            <MetricCard
              label={isPolish ? 'Dywersyfikacja' : 'Diversification'}
              value={(summaryData.metrics as any).diversification || 0}
              color="amber"
            />
          </>
        )}
        {toolType === 'portfolio-priority' && (
          <>
            <MetricCard
              label={isPolish ? 'Stars' : 'Stars'}
              value={(summaryData.metrics as any).stars || 0}
              color="emerald"
            />
            <MetricCard
              label={isPolish ? 'Cash Cows' : 'Cash Cows'}
              value={(summaryData.metrics as any).cashCows || 0}
              color="blue"
            />
            <MetricCard
              label={isPolish ? 'Question Marks' : 'Question Marks'}
              value={(summaryData.metrics as any).questionMarks || 0}
              color="amber"
            />
            <MetricCard
              label={isPolish ? 'Dogs' : 'Dogs'}
              value={(summaryData.metrics as any).dogs || 0}
              color="red"
            />
          </>
        )}
        {toolType === 'risk-uncertainty' && (
          <>
            <MetricCard
              label={isPolish ? 'Założenia' : 'Assumptions'}
              value={(summaryData.metrics as any).assumptions || 0}
              color="emerald"
            />
            <MetricCard
              label={isPolish ? 'Ryzyka' : 'Risks'}
              value={(summaryData.metrics as any).risks || 0}
              color="amber"
            />
            <MetricCard
              label={isPolish ? 'Scenariusze' : 'Scenarios'}
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
              label={isPolish ? 'Elementy' : 'Items'}
              value={(summaryData.metrics as any).totalItems || 0}
              color="emerald"
            />
            <MetricCard
              label={isPolish ? 'Sekcje' : 'Sections'}
              value={(summaryData.metrics as any).sectionsWithItems || 0}
              color="blue"
            />
          </>
        )}
      </div>

      {/* Visualization */}
      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white mb-4">
          {isPolish ? 'Wizualizacja' : 'Visualization'}
        </h3>
        {toolType === 'market-forces' && (
          <PorterRadar data={inputData as PorterData} isPolish={isPolish} />
        )}
        {toolType === 'growth-paths' && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Podsumowanie ścieżek wzrostu znajduje się w metrykach powyżej.'
              : 'Growth paths summary is reflected in the metrics above.'}
          </div>
        )}
        {toolType === 'portfolio-priority' && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Macierz BCG jest dostępna w kroku Portfolio Matrix.'
              : 'BCG matrix is available in the Portfolio Matrix step.'}
          </div>
        )}
        {toolType === 'risk-uncertainty' && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Podsumowanie ryzyk jest widoczne w metrykach powyżej.'
              : 'Risk summary is reflected in the metrics above.'}
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
            {isPolish
              ? 'Podsumowanie operacyjne jest widoczne w metrykach powyżej.'
              : 'Operational summary is reflected in the metrics above.'}
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
              {isPolish ? 'Kluczowe wnioski' : 'Key Insights'}
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
              {isPolish ? 'Wnioski aplikowane' : 'Applied Conclusions'}
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
              {isPolish
                ? 'Jeśli coś tu jest nieprecyzyjne, wróć do rozmowy z AI i doprecyzuj wnioski przed generowaniem outputów.'
                : 'If anything here feels too vague, go back to the AI conversation and refine the conclusions before generating outputs.'}
            </div>
          </div>
        )}

      {/* Recommended Initiatives */}
      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          {isPolish ? 'Rekomendowane inicjatywy' : 'Recommended Initiatives'}
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
            {isPolish
              ? 'Kliknij "Generuj analizę" aby otrzymać rekomendacje inicjatyw.'
              : 'Click "Generate Analysis" to get initiative recommendations.'}
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
